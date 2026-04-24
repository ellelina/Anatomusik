/*
 * Discovery Playlist page — /discover
 * Calls POST /api/discover with the user's micro-genre profile.
 * Claude curates 15 real songs tailored to their exact taste.
 */

"use client";

import { useState } from "react";
import { useAnalysis } from "@/lib/AnalysisContext";
import AppNav from "@/components/AppNav";

interface PlaylistTrack {
  trackName: string;
  artists: string[];
  genres: string[];
  estimatedBpm: number | null;
  whyMatch: string;
  spotifyUrl?: string;
  albumImage?: string;
}

export default function DiscoverPage() {
  const { result, stage } = useAnalysis();
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAnalyzing = stage !== "done" && stage !== "error";

  const handleBuild = async () => {
    if (!result) return;
    setLoading(true);
    setError("");

    // Collect everything the user already knows so Claude can avoid it
    const knownArtists = Array.from(new Set([
      ...result.microGenres.flatMap((g) => g.representativeArtists),
      ...result.trackAnalyses.flatMap((t) => t.artists),
    ]));
    const knownTracks = result.trackAnalyses.map((t) => t.trackName);

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          microGenres: result.microGenres,
          musicPersonality: result.musicPersonality,
          knownArtists,
          knownTracks,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setPlaylist(data.playlist || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate playlist. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <AppNav />

      <h1
        className="text-2xl font-bold mb-1"
        style={{
          fontFamily: "var(--font-orbitron), sans-serif",
          background: "linear-gradient(135deg, #e8f0ff 0%, #c8d8ff 50%, #a0b8ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Discovery Playlist
      </h1>
      <p className="text-sm mb-8" style={{ color: "rgba(180,200,255,0.5)" }}>
        15 songs curated for your exact micro-genre taste
      </p>

      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin" />
          <p className="text-sm" style={{ color: "rgba(180,200,255,0.5)" }}>
            Loading your profile...
          </p>
        </div>
      ) : !result ? (
        <p className="text-sm" style={{ color: "rgba(180,200,255,0.4)" }}>
          No analysis data found. Visit the dashboard first.
        </p>
      ) : !result.microGenres?.length ? (
        <p className="text-sm" style={{ color: "rgba(180,200,255,0.4)" }}>
          Micro-genre profile not found. Try refreshing your analysis on the dashboard.
        </p>
      ) : (
        <>
          {playlist.length === 0 && !loading && (
            <button
              onClick={handleBuild}
              className="px-6 py-3 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
              style={{
                background: "linear-gradient(135deg, rgba(100,140,255,0.25) 0%, rgba(160,100,255,0.25) 100%)",
                border: "1px solid rgba(180,200,255,0.2)",
                color: "rgba(180,200,255,0.9)",
              }}
            >
              Build My Discovery Playlist
            </button>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin" />
              <p className="text-sm" style={{ color: "rgba(180,200,255,0.6)" }}>
                Claude is curating your playlist...
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 mb-4">{error}</p>
          )}

          {playlist.length > 0 && (
            <>
              <div className="flex flex-col gap-3 mb-6">
                {playlist.map((track, i) => {
                  const spotifyHref = track.spotifyUrl ||
                    `https://open.spotify.com/search/${encodeURIComponent(track.trackName + " " + (track.artists[0] || ""))}`;
                  return (
                    <div
                      key={i}
                      className="rounded-2xl p-4"
                      style={{
                        background: "rgba(180,200,255,0.03)",
                        border: "1px solid rgba(180,200,255,0.08)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Album art or index number */}
                        {track.albumImage ? (
                          <img
                            src={track.albumImage}
                            alt=""
                            className="w-10 h-10 rounded-lg shrink-0 object-cover"
                            style={{ opacity: 0.85 }}
                          />
                        ) : (
                          <span
                            className="text-lg font-bold shrink-0 w-7 text-right mt-0.5"
                            style={{ color: "rgba(180,200,255,0.2)" }}
                          >
                            {i + 1}
                          </span>
                        )}

                        <div className="flex-1 min-w-0">
                          {/* Track + artists */}
                          <p className="text-white font-semibold text-sm leading-snug">
                            {track.trackName}
                          </p>
                          <p className="text-xs mb-2" style={{ color: "rgba(180,200,255,0.5)" }}>
                            {track.artists.join(", ")}
                          </p>

                          {/* BPM + genre tags row */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            {track.estimatedBpm && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                                style={{
                                  background: "rgba(80,200,200,0.15)",
                                  border: "1px solid rgba(80,200,200,0.3)",
                                  color: "#80e0e0",
                                }}
                              >
                                {track.estimatedBpm} BPM
                              </span>
                            )}
                            {track.genres.slice(0, 2).map((g) => (
                              <span
                                key={g}
                                className="text-[10px] px-1.5 py-0.5 rounded-full"
                                style={{
                                  background: "rgba(100,140,255,0.12)",
                                  border: "1px solid rgba(100,140,255,0.25)",
                                  color: "rgba(180,200,255,0.7)",
                                }}
                              >
                                {g}
                              </span>
                            ))}
                          </div>

                          {/* Why match */}
                          <p
                            className="text-xs italic leading-relaxed mb-2"
                            style={{ color: "rgba(180,200,255,0.45)" }}
                          >
                            {track.whyMatch}
                          </p>

                          {/* Spotify link */}
                          <a
                            href={spotifyHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium transition-opacity hover:opacity-80"
                            style={{ color: "#1ed760" }}
                          >
                            {track.spotifyUrl ? "Open in Spotify ↗" : "Search on Spotify ↗"}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rebuild button */}
              <button
                onClick={handleBuild}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors hover:opacity-80 disabled:opacity-40"
                style={{
                  background: "rgba(180,200,255,0.08)",
                  border: "1px solid rgba(180,200,255,0.15)",
                  color: "rgba(180,200,255,0.7)",
                }}
              >
                Regenerate Playlist
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
