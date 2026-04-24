/*
 * Playlist detail page — fetches tracks, runs Claude analysis, and shows micro-genre profile.
 * Access: /playlists/[id]
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PlaylistTrackDetail, TrackAnalysis, MicroGenre } from "@/lib/types";
import TrackList from "@/components/TrackList";
import AppNav from "@/components/AppNav";

type Stage = "loading-tracks" | "analyzing" | "done" | "error";

interface PlaylistProfile {
  musicPersonality: string;
  microGenres: MicroGenre[];
  summary: string;
}

const confidencePill = {
  high: "bg-emerald-500/20 text-emerald-300",
  medium: "bg-amber-500/20 text-amber-300",
  low: "bg-purple-500/20 text-purple-300",
};

export default function PlaylistDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const playlistId = params.id as string;
  const playlistName = searchParams.get("name") || "Playlist";

  const [stage, setStage] = useState<Stage>("loading-tracks");
  const [trackDetails, setTrackDetails] = useState<PlaylistTrackDetail[]>([]);
  const [trackAnalyses, setTrackAnalyses] = useState<TrackAnalysis[]>([]);
  const [profile, setProfile] = useState<PlaylistProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      try {
        setStage("loading-tracks");
        const tracksRes = await fetch(`/api/playlists/${playlistId}`);
        if (!tracksRes.ok) {
          const err = await tracksRes.json();
          throw new Error(err.error || "Failed to fetch tracks");
        }
        const tracks: PlaylistTrackDetail[] = await tracksRes.json();
        setTrackDetails(tracks);

        setStage("analyzing");
        const [analyzeRes] = await Promise.all([
          fetch(`/api/playlists/${playlistId}/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tracks, playlistName }),
          }),
          // Fetch profile in parallel with track analysis
          (async () => {
            setProfileLoading(true);
            try {
              const profileRes = await fetch("/api/playlists/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tracks, playlistName }),
              });
              if (profileRes.ok) setProfile(await profileRes.json());
            } catch { /* non-critical */ }
            finally { setProfileLoading(false); }
          })(),
        ]);

        if (!analyzeRes.ok) {
          const err = await analyzeRes.json();
          throw new Error(err.error || "Analysis failed");
        }
        const analysis = await analyzeRes.json();
        setTrackAnalyses(analysis.tracks || []);
        setStage("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStage("error");
      }
    }
    run();
  }, [playlistId, playlistName]);

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <AppNav />

      <h1 className="text-2xl font-bold mb-8">{playlistName}</h1>

      {stage === "loading-tracks" && <LoadingState title="Fetching tracks..." />}
      {stage === "analyzing" && <LoadingState title={`Analyzing ${trackDetails.length} tracks with AI...`} />}

      {stage === "error" && (
        <div className="text-center py-12 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 mb-2">{error}</p>
          <a href="/playlists" className="text-sm text-neutral-400 hover:text-white underline">
            Back to playlists
          </a>
        </div>
      )}

      {stage === "done" && trackAnalyses.length > 0 && (
        <div>
          {/* Playlist micro-genre profile */}
          {profileLoading && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-3/4 mb-3" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          )}

          {profile && !profileLoading && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6">
              <p className="text-sm text-neutral-300 leading-relaxed mb-3">
                {profile.musicPersonality}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.microGenres.map((g) => (
                  <span
                    key={g.name}
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${confidencePill[g.confidence]}`}
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-neutral-500 text-sm mb-6">
            {trackAnalyses.length} tracks analyzed
          </p>

          <TrackList
            tracks={trackAnalyses}
            trackDetails={trackDetails.map((t) => ({ ...t, estimatedBpm: null }))}
          />
        </div>
      )}
    </main>
  );
}

function LoadingState({ title }: { title: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin mb-4" />
      <p className="text-neutral-300">{title}</p>
    </div>
  );
}
