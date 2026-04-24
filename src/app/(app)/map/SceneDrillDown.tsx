/*
 * SceneDrillDown — side panel (desktop) / bottom sheet (mobile) for selected map scenes.
 * Shows scene details and lets users fetch recommendations via POST /api/recommend.
 * Rendered in map/page.tsx when a scene dot is clicked on desktop.
 */

"use client";

import { useState } from "react";
import { SceneEntry } from "@/lib/genre-map-data";

interface Recommendation {
  trackName: string;
  artists: string[];
  genres: string[];
  estimatedBpm: number | null;
  whyMatch: string;
  spotifyUrl?: string;
  albumImage?: string;
}

interface Props {
  scene: SceneEntry;
  onClose: () => void;
}

export default function SceneDrillDown({ scene, onClose }: Props) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDiscover = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackName: "intro track",
          artists: [""],
          genres: [scene.name],
          bpm: 120,
          mood: "genre exploration",
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      const data = await res.json();
      setRecs((data.recommendations || []).slice(0, 5));
    } catch {
      setError("Could not load recommendations. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop (closes panel) */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Side panel */}
      <div
        className="fixed right-0 top-0 h-full z-40 overflow-y-auto"
        style={{
          width: "320px",
          background: "rgba(9,7,26,0.97)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(180,200,255,0.1)",
          padding: "24px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-white/10"
          style={{ color: "rgba(180,200,255,0.5)" }}
        >
          ✕
        </button>

        {/* Scene name + region */}
        <div className="pr-8 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-white font-bold text-base">{scene.name}</h2>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                scene.emerging
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-emerald-500/15 text-emerald-400"
              }`}
            >
              {scene.emerging ? "Emerging" : "Established"}
            </span>
          </div>
          <p className="text-xs" style={{ color: "rgba(180,200,255,0.4)" }}>
            {scene.region}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(180,200,255,0.65)" }}>
          {scene.description}
        </p>

        {/* Artists */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "rgba(180,200,255,0.35)" }}>
            Representative Artists
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scene.artists.map((a) => (
              <span
                key={a}
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(180,200,255,0.7)",
                }}
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* Discover button */}
        {recs.length === 0 && !loading && (
          <button
            onClick={handleDiscover}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors hover:opacity-80 mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(100,140,255,0.2) 0%, rgba(160,100,255,0.2) 100%)",
              border: "1px solid rgba(180,200,255,0.2)",
              color: "rgba(180,200,255,0.9)",
            }}
          >
            Discover This Scene
          </button>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 py-6">
            <div className="w-5 h-5 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin" />
            <span className="text-xs" style={{ color: "rgba(180,200,255,0.5)" }}>
              Finding tracks...
            </span>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 mb-4">{error}</p>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(180,200,255,0.35)" }}>
              Recommended Tracks
            </p>
            <div className="flex flex-col gap-3">
              {recs.map((rec, i) => {
                const href = rec.spotifyUrl ||
                  `https://open.spotify.com/search/${encodeURIComponent(`${rec.trackName} ${rec.artists[0] ?? ""}`)}`;
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 rounded-xl p-3 transition-colors hover:bg-white/[0.04]"
                    style={{
                      background: "rgba(180,200,255,0.03)",
                      border: "1px solid rgba(180,200,255,0.07)",
                    }}
                  >
                    {rec.albumImage && (
                      <img src={rec.albumImage} alt="" className="w-9 h-9 rounded shrink-0 object-cover" style={{ opacity: 0.85 }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold leading-snug truncate">{rec.trackName}</p>
                      <p className="text-[11px] mb-1" style={{ color: "rgba(180,200,255,0.45)" }}>{rec.artists.join(", ")}</p>
                      <p className="text-[11px] italic mb-1.5 leading-relaxed" style={{ color: "rgba(180,200,255,0.4)" }}>{rec.whyMatch}</p>
                      <span className="text-[11px] font-medium" style={{ color: "#1ed760" }}>
                        {rec.spotifyUrl ? "Open in Spotify ↗" : "Search on Spotify ↗"}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Re-discover button */}
            <button
              onClick={handleDiscover}
              disabled={loading}
              className="w-full mt-4 py-2 rounded-xl text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-40"
              style={{
                background: "rgba(180,200,255,0.06)",
                border: "1px solid rgba(180,200,255,0.12)",
                color: "rgba(180,200,255,0.6)",
              }}
            >
              Refresh Recommendations
            </button>
          </div>
        )}
      </div>
    </>
  );
}
