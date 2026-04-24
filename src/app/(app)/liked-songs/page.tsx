/*
 * Liked Songs page — browse saved tracks with per-song genre/BPM analysis.
 * Loads 50 tracks at a time with pagination.
 * After analysis completes, fetches a micro-genre profile card in the background.
 * Access: /liked-songs
 */

"use client";

import { useEffect, useState } from "react";
import { PlaylistTrackDetail, TrackAnalysis, MicroGenre } from "@/lib/types";
import TrackList from "@/components/TrackList";
import AppNav from "@/components/AppNav";

type Stage = "loading" | "analyzing" | "done" | "error";

interface ProfileResult {
  musicPersonality: string;
  microGenres: MicroGenre[];
  summary: string;
}

export default function LikedSongsPage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [trackDetails, setTrackDetails] = useState<PlaylistTrackDetail[]>([]);
  const [trackAnalyses, setTrackAnalyses] = useState<TrackAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileResult | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const pageSize = 50;

  useEffect(() => {
    loadPage(0);
  }, []);

  async function loadPage(newOffset: number) {
    setError("");
    setTrackAnalyses([]);
    setTrackDetails([]);
    setProfile(null);
    setOffset(newOffset);

    try {
      setStage("loading");
      const res = await fetch(`/api/saved-tracks?offset=${newOffset}&limit=${pageSize}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch saved tracks");
      }
      const data = await res.json();
      setTrackDetails(data.tracks);
      setTotal(data.total);

      setStage("analyzing");
      const analyzeRes = await fetch("/api/saved-tracks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: data.tracks }),
      });
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error || "Analysis failed");
      }
      const analysis = await analyzeRes.json();
      setTrackAnalyses(analysis.tracks || []);
      setStage("done");

      // Background: fetch micro-genre profile without blocking the UI
      fetchProfile(data.tracks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }

  async function fetchProfile(tracks: PlaylistTrackDetail[]) {
    setProfileLoading(true);
    try {
      const res = await fetch("/api/saved-tracks/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks }),
      });
      if (!res.ok) return;
      const data: ProfileResult = await res.json();
      setProfile(data);
    } catch {
      // Fail silently — profile is optional
    } finally {
      setProfileLoading(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.floor(offset / pageSize) + 1;

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <AppNav />

      <h1 className="text-2xl font-bold mb-2">Liked Songs</h1>
      {total > 0 && (
        <p className="text-neutral-500 text-sm mb-8">
          {total} saved tracks — showing {offset + 1}–{Math.min(offset + pageSize, total)}
        </p>
      )}

      {stage === "loading" && (
        <LoadingState title="Fetching your liked songs..." />
      )}

      {stage === "analyzing" && (
        <LoadingState title={`Analyzing ${trackDetails.length} tracks with AI...`} />
      )}

      {stage === "error" && (
        <div className="text-center py-12 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 mb-2">{error}</p>
          <button
            onClick={() => loadPage(offset)}
            className="text-sm text-neutral-400 hover:text-white underline"
          >
            Retry
          </button>
        </div>
      )}

      {stage === "done" && trackAnalyses.length > 0 && (
        <>
          {/* Micro-genre profile card — shown above track list */}
          {profileLoading && !profile && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-3/4" />
            </div>
          )}

          {profile && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 mb-6">
              <p className="text-neutral-300 text-sm leading-relaxed mb-3">
                {profile.musicPersonality}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.microGenres.slice(0, 3).map((g) => (
                  <span
                    key={g.name}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <TrackList
            tracks={trackAnalyses}
            trackDetails={trackDetails.map((t) => ({
              ...t,
              estimatedBpm: null,
            }))}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => loadPage(offset - pageSize)}
                disabled={offset === 0}
                className="px-4 py-2 rounded-lg bg-white/10 text-sm text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => loadPage(offset + pageSize)}
                disabled={offset + pageSize >= total}
                className="px-4 py-2 rounded-lg bg-white/10 text-sm text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
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
