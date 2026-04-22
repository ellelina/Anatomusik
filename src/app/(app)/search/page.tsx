/*
 * Search page — look up any song and discover its micro-genres, BPM, and mood.
 * Access: /search (requires Spotify auth)
 */

"use client";

import { useState, FormEvent, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SearchTrackResult, TrackAnalysis } from "@/lib/types";
import RecommendPanel from "@/components/RecommendPanel";
import AppNav from "@/components/AppNav";

type Stage = "idle" | "searching" | "results" | "analyzing" | "analyzed";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [stage, setStage] = useState<Stage>("idle");
  const [results, setResults] = useState<SearchTrackResult[]>([]);
  const [selected, setSelected] = useState<SearchTrackResult | null>(null);
  const [analysis, setAnalysis] = useState<TrackAnalysis | null>(null);
  const [error, setError] = useState("");

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setStage("searching");
    setError("");
    setAnalysis(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.tracks || []);
      setStage("results");
    } catch {
      setError("Failed to search Spotify. Make sure you're logged in.");
      setStage("idle");
    }
  }, []);

  // Auto-trigger search when navigated here with ?q= param
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) runSearch(q);
  }, [searchParams, runSearch]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  async function handleSelect(track: SearchTrackResult) {
    setSelected(track);
    setStage("analyzing");
    setError("");

    try {
      const res = await fetch("/api/search/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: track.id,
          name: track.name,
          artists: track.artists,
          genres: track.genres,
        }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setAnalysis(data.track);
      setStage("analyzed");
    } catch {
      setError("Failed to analyze track.");
      setStage("results");
    }
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <AppNav />

      {/* Search bar */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-white mb-2">Search a Song</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Look up any track to discover its micro-genres, BPM, and mood
        </p>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Nights by Frank Ocean"
            className="flex-1 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none transition-colors"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,200,255,0.1)" }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(180,200,255,0.4)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(180,200,255,0.1)")}
          />
          <button
            type="submit"
            disabled={stage === "searching" || !query.trim()}
            className="px-6 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-125"
            style={{
              background: "rgba(150,180,255,0.08)",
              border: "1px solid rgba(180,200,255,0.25)",
              color: "rgba(180,200,255,0.85)",
            }}
          >
            {stage === "searching" ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-6">{error}</p>
      )}

      {/* Searching spinner */}
      {stage === "searching" && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin mb-4" />
          <p className="text-neutral-400 text-sm">Searching Spotify...</p>
        </div>
      )}

      {/* Results grid */}
      {(stage === "results" || stage === "analyzing") && results.length > 0 && (
        <div>
          <p className="text-neutral-500 text-xs uppercase tracking-widest font-semibold mb-4">
            {results.length} result{results.length !== 1 ? "s" : ""} — tap to analyze
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {results.map((track) => (
              <button
                key={track.id}
                onClick={() => handleSelect(track)}
                disabled={stage === "analyzing"}
                className="text-left flex gap-3 rounded-xl p-4 transition-all disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(180,200,255,0.08)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(180,200,255,0.25)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(180,200,255,0.08)")}
              >
                {track.albumImage && (
                  <img
                    src={track.albumImage}
                    alt={track.albumName}
                    className="w-14 h-14 rounded-lg flex-shrink-0 object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate text-sm">{track.name}</p>
                  <p className="text-neutral-500 text-xs truncate">{track.artists.join(", ")}</p>
                  {track.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {track.genres.slice(0, 3).map((g) => (
                        <span
                          key={g}
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {stage === "results" && results.length === 0 && (
        <p className="text-neutral-500 text-center py-12">No tracks found. Try a different search.</p>
      )}

      {/* Analyzing spinner */}
      {stage === "analyzing" && selected && (
        <div className="mt-8 text-center py-12 rounded-xl bg-white/5 border border-white/10">
          <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin mb-4" />
          <p className="text-white font-medium text-sm">
            Analyzing &ldquo;{selected.name}&rdquo;...
          </p>
          <p className="text-neutral-500 text-xs mt-1">Identifying micro-genres, BPM, and mood</p>
        </div>
      )}

      {/* Analyzed result */}
      {stage === "analyzed" && analysis && selected && (
        <div className="mt-8">
          <button
            onClick={() => setStage("results")}
            className="text-neutral-500 hover:text-neutral-300 text-sm mb-4 transition-colors"
          >
            &larr; Back to results
          </button>

          {/* Track card */}
          <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,200,255,0.2)" }}>
            <div className="flex gap-4">
              {selected.albumImage && (
                <img
                  src={selected.albumImage}
                  alt={selected.albumName}
                  className="w-20 h-20 rounded-lg flex-shrink-0 object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-lg truncate">{analysis.trackName}</p>
                    <p className="text-neutral-400 text-sm truncate">
                      {(analysis.artists || []).join(", ")}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(150,180,255,0.1)", color: "rgba(180,200,255,0.85)" }}>
                    {analysis.estimatedBpm} BPM
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {(analysis.genres || []).map((genre) => (
                    <span
                      key={genre}
                      className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300"
                    >
                      {genre}
                    </span>
                  ))}
                  <span className="text-xs italic text-neutral-500 ml-1">
                    {analysis.mood}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="mt-3">
            <RecommendPanel track={analysis} />
          </div>
        </div>
      )}
    </main>
  );
}
