/*
 * Sound Anatomy — dissects any song into individual sound layers.
 * Explains each layer in plain English for complete beginners.
 * Access: /anatomy (requires Spotify auth)
 *
 * Three sections:
 *   Top: Track search + header card
 *   Middle: Sound layers panel (expandable rows)
 *   Bottom: Groove feel, At a glance, Find similar
 */

"use client";

import { useState, useCallback, FormEvent } from "react";
import { SearchTrackResult, TrackAnalysis } from "@/lib/types";
import RecommendPanel from "@/components/RecommendPanel";
import AppNav from "@/components/AppNav";

// --- Types for anatomy response ---
interface SoundLayer {
  name: string;
  type: "melodic" | "harmonic" | "spatial" | "dynamic";
  shortDescription: string;
  presencePercent: number;
  explanation: string;
  questionTags: [string, string];
}

interface GrooveFeel {
  type: "straight" | "swung" | "syncopated" | "free";
  explanation: string;
  beatPattern: number[];
}

interface SpotifyMeasurements {
  tempo: number;
  key: string;
  energy: number;
  acousticness: number;
  danceability: number;
  instrumentalness: number;
  loudness: number;
  valence: number;
}

interface AnatomyResult {
  layers: SoundLayer[];
  grooveFeel: GrooveFeel;
  key: string;
  keyFeel: string;
  dynamicRange: "narrow" | "medium" | "wide";
  dynamicExplanation: string;
  texture: "sparse" | "layered" | "dense";
  textureExplanation: string;
  hasRealData: boolean;
  confirmedBpm: number | null;
  spotifyData?: SpotifyMeasurements;
}

// --- Color config by layer type ---
const TYPE_COLORS: Record<string, { iconBg: string; barFill: string; label: string }> = {
  melodic:  { iconBg: "#E6F1FB", barFill: "#378ADD", label: "Melodic" },
  harmonic: { iconBg: "#E1F5EE", barFill: "#1D9E75", label: "Rhythm" },
  spatial:  { iconBg: "#EEEDFE", barFill: "#7F77DD", label: "Texture" },
  dynamic:  { iconBg: "#FAEEDA", barFill: "#EF9F27", label: "Expressive" },
};

// --- BPM human translations ---
function bpmHuman(bpm: number): string {
  if (bpm < 70)  return "resting pace";
  if (bpm < 90)  return "walking pace";
  if (bpm < 110) return "head nod";
  if (bpm < 130) return "moving energy";
  if (bpm < 150) return "dance floor";
  return "full send";
}

type Stage = "idle" | "searching" | "results" | "analyzing" | "done";

export default function AnatomyPage() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [searchResults, setSearchResults] = useState<SearchTrackResult[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<SearchTrackResult | null>(null);
  const [trackAnalysis, setTrackAnalysis] = useState<TrackAnalysis | null>(null);
  const [anatomy, setAnatomy] = useState<AnatomyResult | null>(null);
  const [expandedLayer, setExpandedLayer] = useState<number>(0);
  const [showSimilar, setShowSimilar] = useState(false);

  // Search
  const handleSearch = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setStage("searching");
    setAnatomy(null);
    setTrackAnalysis(null);
    setSelectedTrack(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSearchResults(data.tracks || []);
      setStage("results");
    } catch {
      setStage("idle");
    }
  }, [query]);

  // Select track → analyze + anatomy in parallel
  const handleSelect = useCallback(async (track: SearchTrackResult) => {
    setSelectedTrack(track);
    setStage("analyzing");
    setAnatomy(null);
    setTrackAnalysis(null);
    setExpandedLayer(0);
    setShowSimilar(false);

    try {
      // Step 1: get basic analysis (BPM, mood, genres)
      const analyzeRes = await fetch("/api/search/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: track.id,
          name: track.name,
          artists: track.artists,
          genres: track.genres,
        }),
      });
      if (!analyzeRes.ok) throw new Error();
      const analyzeData = await analyzeRes.json();
      const ta: TrackAnalysis = analyzeData.track;
      setTrackAnalysis(ta);

      // Step 2: get anatomy breakdown (passes track ID for Spotify audio features)
      const anatomyRes = await fetch("/api/anatomy/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: track.id,
          trackName: ta.trackName,
          artists: ta.artists,
          genres: ta.genres,
          bpm: ta.estimatedBpm,
          mood: ta.mood,
        }),
      });
      if (!anatomyRes.ok) throw new Error();
      const anatomyData: AnatomyResult = await anatomyRes.json();
      setAnatomy(anatomyData);
      setStage("done");
    } catch {
      setStage("results");
    }
  }, []);

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <Nav />

      {/* Page header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-3">Sound Anatomy</h1>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-2xl">
          Pick any song and we&apos;ll pull it apart into its individual sounds —
          then explain each one in plain English.
        </p>
      </div>

      {/* ── Track Search ── */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Redbone by Childish Gambino"
          className="flex-1 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none transition-colors"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,200,255,0.1)" }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(180,200,255,0.4)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(180,200,255,0.1)")}
        />
        <button
          type="submit"
          disabled={stage === "searching" || !query.trim()}
          className="px-6 py-3 rounded-xl font-medium text-sm hover:brightness-125 transition-all disabled:opacity-40"
          style={{ background: "rgba(150,180,255,0.08)", border: "1px solid rgba(180,200,255,0.25)", color: "rgba(180,200,255,0.85)" }}
        >
          {stage === "searching" ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Search spinner */}
      {stage === "searching" && (
        <div className="text-center py-8">
          <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin mb-3" />
          <p className="text-neutral-500 text-sm">Searching Spotify...</p>
        </div>
      )}

      {/* Search results */}
      {(stage === "results" || stage === "analyzing") && searchResults.length > 0 && !anatomy && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {searchResults.map((track) => (
            <button
              key={track.id}
              onClick={() => handleSelect(track)}
              disabled={stage === "analyzing"}
              className="text-left flex gap-3 rounded-xl p-4 bg-white/5 border border-white/10 hover:bg-white/[0.07] hover:border-[rgba(180,200,255,0.25)] transition-colors disabled:opacity-50"
            >
              {track.albumImage && (
                <img src={track.albumImage} alt="" className="w-12 h-12 rounded-lg flex-shrink-0 object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate text-sm">{track.name}</p>
                <p className="text-neutral-500 text-xs truncate">{track.artists.join(", ")}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Analyzing skeleton ── */}
      {stage === "analyzing" && selectedTrack && (
        <div>
          {/* Track header skeleton */}
          <TrackHeader track={selectedTrack} analysis={trackAnalysis} />

          {/* Layer skeletons */}
          <div className="mt-8 space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/5 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-3 w-32 bg-white/5 rounded animate-pulse mb-2" />
                    <div className="h-2 w-48 bg-white/[0.03] rounded animate-pulse" />
                  </div>
                  <div className="w-20 h-2 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Bottom card skeletons */}
          <div className="mt-8 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/5 p-6">
                <div className="h-4 w-28 bg-white/5 rounded animate-pulse mb-4" />
                <div className="h-3 w-full bg-white/[0.03] rounded animate-pulse mb-2" />
                <div className="h-3 w-3/4 bg-white/[0.03] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full anatomy display ── */}
      {stage === "done" && anatomy && trackAnalysis && selectedTrack && (
        <div>
          <button
            onClick={() => { setStage("results"); setAnatomy(null); setTrackAnalysis(null); }}
            className="text-neutral-500 hover:text-neutral-300 text-sm mb-4 transition-colors"
          >
            &larr; Back to results
          </button>

          {/* Track header */}
          <TrackHeader track={selectedTrack} analysis={trackAnalysis} />

          {/* ── Sound Layers Panel ── */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-4">
              Sound Layers
            </h2>

            <div className="space-y-2">
              {anatomy.layers.map((layer, i) => {
                const colors = TYPE_COLORS[layer.type] || TYPE_COLORS.melodic;
                const isExpanded = expandedLayer === i;

                return (
                  <div key={i}>
                    {/* Layer row */}
                    <button
                      onClick={() => setExpandedLayer(isExpanded ? -1 : i)}
                      className={`w-full text-left rounded-xl p-4 border transition-all ${
                        isExpanded
                          ? "bg-white/[0.04] border-white/15"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Color-coded icon square */}
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: colors.iconBg }}
                        >
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: colors.barFill }}
                          >
                            {colors.label.slice(0, 3).toUpperCase()}
                          </span>
                        </div>

                        {/* Name + short description */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {layer.name}
                          </p>
                          <p className="text-neutral-500 text-xs truncate">
                            {layer.shortDescription}
                          </p>
                        </div>

                        {/* Presence bar */}
                        <div className="w-24 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${layer.presencePercent}%`,
                                  backgroundColor: colors.barFill,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono w-7 text-right">
                              {layer.presencePercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div
                        className="rounded-b-xl -mt-1 pt-4 pb-5 px-5 border border-t-0"
                        style={{ borderColor: `${colors.barFill}25`, backgroundColor: `${colors.barFill}06` }}
                      >
                        <h3 className="text-white font-semibold mb-3">{layer.name}</h3>

                        {/* Decorative waveform bars */}
                        <div className="flex items-end gap-[2px] h-8 mb-4">
                          {Array.from({ length: 32 }).map((_, bi) => {
                            const seed = Math.sin(bi * 1.3 + i * 7.4 + layer.presencePercent) * 10000;
                            const height = 20 + Math.sin(bi * 0.7 + i * 2) * 15 + (seed - Math.floor(seed)) * 10;
                            return (
                              <div
                                key={bi}
                                className="flex-1 rounded-sm"
                                style={{
                                  height: `${Math.max(height, 4)}%`,
                                  backgroundColor: colors.barFill,
                                  opacity: 0.3 + (height / 100) * 0.5,
                                }}
                              />
                            );
                          })}
                        </div>

                        {/* Explanation */}
                        <p className="text-neutral-300 text-sm leading-relaxed mb-4">
                          {layer.explanation}
                        </p>

                        {/* Question tags */}
                        <div className="flex flex-wrap gap-2">
                          {layer.questionTags.map((q, qi) => (
                            <a
                              key={qi}
                              href={`/search?q=${encodeURIComponent(q)}`}
                              className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                              style={{
                                borderColor: `${colors.barFill}30`,
                                color: colors.barFill,
                                backgroundColor: `${colors.barFill}08`,
                              }}
                            >
                              {q}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Bottom Cards ── */}
          <div className="mt-10 space-y-4">
            {/* Card 1: Groove Feel */}
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6">
              <h3 className="text-white font-semibold mb-1">Groove Feel</h3>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 mb-3">
                {anatomy.grooveFeel.type}
              </span>
              <p className="text-neutral-300 text-sm leading-relaxed mb-5">
                {anatomy.grooveFeel.explanation}
              </p>

              {/* Beat dot visualizer */}
              <div className="flex items-center justify-center gap-3 py-3">
                {(anatomy.grooveFeel.beatPattern || []).slice(0, 8).map((val, bi) => (
                  <div key={bi} className="flex flex-col items-center gap-1">
                    {val === 2 ? (
                      <div className="w-4 h-4 rounded-full bg-white" />
                    ) : val === 1 ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-white/60" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full border border-white/30" />
                    )}
                    <span className="text-[8px] text-neutral-600 font-mono">
                      {bi + 1}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-neutral-600 text-center mt-1">
                Large dots = strong beats &middot; Small dots = weak beats &middot; Empty = rest
              </p>
            </div>

            {/* Card 2: At a Glance — uses Spotify data when available */}
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">At a Glance</h3>
                {!anatomy.hasRealData && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                    Estimated values
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Tempo"
                  value={`${anatomy.confirmedBpm || trackAnalysis.estimatedBpm} BPM`}
                  detail={bpmHuman(anatomy.confirmedBpm || trackAnalysis.estimatedBpm)}
                  estimated={!anatomy.hasRealData}
                />
                <MetricCard
                  label="Key"
                  value={anatomy.key}
                  detail={anatomy.keyFeel}
                  estimated={!anatomy.hasRealData}
                />
                <MetricCard
                  label="Dynamic Range"
                  value={capitalize(anatomy.dynamicRange)}
                  detail={anatomy.dynamicExplanation}
                  estimated={!anatomy.hasRealData}
                />
                <MetricCard
                  label="Texture"
                  value={capitalize(anatomy.texture)}
                  detail={anatomy.textureExplanation}
                  estimated={!anatomy.hasRealData}
                />
              </div>
              {anatomy.hasRealData && anatomy.spotifyData && (
                <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-3">
                  <MiniStat label="Energy" value={`${anatomy.spotifyData.energy}%`} />
                  <MiniStat label="Danceability" value={`${anatomy.spotifyData.danceability}%`} />
                  <MiniStat label="Acousticness" value={`${anatomy.spotifyData.acousticness}%`} />
                  <MiniStat label="Mood valence" value={`${anatomy.spotifyData.valence}%`} />
                </div>
              )}
            </div>

            {/* Card 3: Find Similar */}
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6">
              <h3 className="text-white font-semibold mb-2">Find Similar Anatomy</h3>
              <p className="text-neutral-400 text-sm mb-4">
                Discover songs built from the same sonic ingredients.
              </p>
              {!showSimilar ? (
                <button
                  onClick={() => setShowSimilar(true)}
                  className="w-full text-center px-4 py-3 rounded-xl font-medium text-sm transition-all hover:brightness-125"
                  style={{ background: "rgba(150,180,255,0.08)", border: "1px solid rgba(180,200,255,0.25)", color: "rgba(180,200,255,0.85)" }}
                >
                  Find 5 songs with the same sound anatomy as &ldquo;{trackAnalysis.trackName}&rdquo;
                </button>
              ) : (
                <RecommendPanel track={trackAnalysis} />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// --- Sub-components ---

function Nav() {
  return <AppNav />;
}

function TrackHeader({ track, analysis }: { track: SearchTrackResult; analysis: TrackAnalysis | null }) {
  return (
    <div className="flex gap-4 p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,200,255,0.15)" }}>
      {track.albumImage && (
        <img src={track.albumImage} alt="" className="w-16 h-16 rounded-lg flex-shrink-0 object-cover" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-lg truncate">
          {analysis?.trackName || track.name}
        </p>
        <p className="text-neutral-400 text-sm truncate">
          {analysis ? (analysis.artists || []).join(", ") : track.artists.join(", ")}
        </p>
        {analysis && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(150,180,255,0.1)", color: "rgba(180,200,255,0.85)" }}>
              {analysis.estimatedBpm} BPM
              <span className="font-normal text-blue-400/60 ml-1">
                {bpmHuman(analysis.estimatedBpm)}
              </span>
            </span>
            <span className="text-xs italic px-2 py-0.5 rounded-full bg-white/5 text-neutral-400">
              {analysis.mood}
            </span>
            {(analysis.genres || []).slice(0, 1).map((g) => (
              <span
                key={g}
                className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300"
              >
                {g}
              </span>
            ))}
          </div>
        )}
        {!analysis && (
          <div className="flex gap-2 mt-2">
            <div className="h-5 w-20 bg-white/5 rounded-full animate-pulse" />
            <div className="h-5 w-24 bg-white/5 rounded-full animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, estimated }: { label: string; value: string; detail: string; estimated?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[10px] text-neutral-600 uppercase tracking-wider font-medium">
          {label}
        </p>
        {estimated && (
          <span className="text-[8px] font-medium px-1 py-px rounded bg-amber-500/10 text-amber-500">
            est.
          </span>
        )}
      </div>
      <p className="text-white text-sm font-semibold mb-0.5">{value}</p>
      <p className="text-neutral-500 text-xs">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-neutral-600">{label}</span>
      <span className="text-[10px] font-mono font-semibold text-neutral-400">{value}</span>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
