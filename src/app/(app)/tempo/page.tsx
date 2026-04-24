/*
 * Tempo Lab — music self-literacy for complete beginners.
 * Teaches BPM, groove, and instrumentation using the user's own Spotify data.
 * Access: /tempo (requires Spotify auth + analysis data)
 *
 * Four sections:
 *   1. Your Tempo Identity — BPM spectrum with Claude personality paragraph
 *   2. Pick a Song — search + plain-English breakdown
 *   3. Tempo Zones — browse library by energy/feel
 *   4. Instrument Explainer — Claude-generated reference
 */

"use client";

import { useEffect, useState, useMemo, FormEvent, useCallback } from "react";
import { AnalysisResult, TrackAnalysis, SearchTrackResult } from "@/lib/types";
import RecommendPanel from "@/components/RecommendPanel";
import AppNav from "@/components/AppNav";
import { useAnalysis } from "@/lib/AnalysisContext";

// --- BPM Zone definitions ---
const BPM_ZONES = [
  { min: 0, max: 70, label: "Slow burn", color: "#3B8BD4", description: "Music built for feeling, not moving." },
  { min: 70, max: 100, label: "Walking pace", color: "#1D9E75", description: "Conversational, emotionally present." },
  { min: 100, max: 120, label: "Head nod", color: "#7F77DD", description: "The sweet spot for most pop and R&B." },
  { min: 120, max: 140, label: "Dance floor", color: "#D4537E", description: "Your body wants to move." },
  { min: 140, max: 300, label: "Full send", color: "#D85A30", description: "Electronic, drill, hyperpop, jungle." },
] as const;

type BpmZoneData = {
  zone: string;
  label: string;
  description: string;
  color: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
  tracks: TrackAnalysis[];
};

function getZoneForBpm(bpm: number) {
  return BPM_ZONES.find((z) => bpm >= z.min && bpm < z.max) || BPM_ZONES[4];
}

interface InstrumentEntry {
  instrument: string;
  description: string;
  genres: string[];
}

interface BreakdownResult {
  tempoExplained: string;
  grooveFeel: string;
  anchorInstrument: string;
  whyYouLikeIt: string;
}

export default function TempoLabPage() {
  const { stage: contextStage, result: contextResult } = useAnalysis();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Section 1
  const [personality, setPersonality] = useState<string | null>(null);
  const [personalityLoading, setPersonalityLoading] = useState(false);

  // Section 2
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchTrackResult[]>([]);
  const [searchStage, setSearchStage] = useState<"idle" | "searching" | "results" | "analyzing" | "done">("idle");
  const [selectedTrack, setSelectedTrack] = useState<SearchTrackResult | null>(null);
  const [trackAnalysis, setTrackAnalysis] = useState<TrackAnalysis | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownResult | null>(null);

  // Section 3
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const [zoneRecommendTrack, setZoneRecommendTrack] = useState<TrackAnalysis | null>(null);

  // Section 4
  const [instruments, setInstruments] = useState<InstrumentEntry[]>([]);
  const [instrumentsLoading, setInstrumentsLoading] = useState(false);

  // Compute BPM zone distribution from track analyses
  const zoneData = useMemo((): BpmZoneData[] => {
    const tracks = analysis?.trackAnalyses || [];
    const withBpm = tracks.filter((t) => t.estimatedBpm != null && t.estimatedBpm > 0);
    const total = withBpm.length || 1;

    return BPM_ZONES.map((zone) => {
      const zoneTracks = withBpm.filter(
        (t) => t.estimatedBpm! >= zone.min && t.estimatedBpm! < zone.max
      );
      return {
        zone: `${zone.min}–${zone.max === 300 ? "+" : zone.max} BPM`,
        label: zone.label,
        description: zone.description,
        color: zone.color,
        min: zone.min,
        max: zone.max,
        count: zoneTracks.length,
        percentage: Math.round((zoneTracks.length / total) * 100),
        tracks: zoneTracks,
      };
    });
  }, [analysis]);

  const dominantZone = useMemo(
    () => zoneData.reduce((best, z) => (z.count > best.count ? z : best), zoneData[0]),
    [zoneData]
  );

  // Use shared context — no duplicate fetch
  useEffect(() => {
    if (contextStage === "done" && contextResult) {
      setAnalysis(contextResult);
      setLoading(false);
    } else if (contextStage === "error") {
      setError("Failed to load analysis");
      setLoading(false);
    }
  }, [contextStage, contextResult]);

  // Fetch personality paragraph once we have zone data
  useEffect(() => {
    if (!analysis || personalityLoading || personality !== null) return;
    if (zoneData.every((z) => z.count === 0)) return;

    setPersonalityLoading(true);
    fetch("/api/tempo/personality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zones: zoneData.map((z) => ({ zone: z.zone, count: z.count, percentage: z.percentage })),
        totalTracks: analysis.trackAnalyses.length,
      }),
    })
      .then((r) => r.json())
      .then((data) => setPersonality(data.paragraph || null))
      .catch(() => {})
      .finally(() => setPersonalityLoading(false));
  }, [analysis, zoneData, personality, personalityLoading]);

  // Fetch instruments once we have genres
  useEffect(() => {
    if (!analysis || instrumentsLoading || instruments.length > 0) return;
    const genres = analysis.microGenres?.map((g) => g.name) || [];
    if (genres.length === 0) return;

    setInstrumentsLoading(true);
    fetch("/api/tempo/instruments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genres }),
    })
      .then((r) => r.json())
      .then((data) => setInstruments(data.instruments || []))
      .catch(() => {})
      .finally(() => setInstrumentsLoading(false));
  }, [analysis, instruments.length, instrumentsLoading]);

  // Section 2: search
  const handleSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;

      setSearchStage("searching");
      setBreakdown(null);
      setTrackAnalysis(null);
      setSelectedTrack(null);

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setSearchResults(data.tracks || []);
        setSearchStage("results");
      } catch {
        setSearchStage("idle");
      }
    },
    [searchQuery]
  );

  const handleSelectTrack = useCallback(
    async (track: SearchTrackResult) => {
      setSelectedTrack(track);
      setSearchStage("analyzing");
      setBreakdown(null);

      try {
        // Get track analysis
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
        if (!analyzeRes.ok) throw new Error("Analysis failed");
        const data = await analyzeRes.json();
        const ta: TrackAnalysis = data.track;
        setTrackAnalysis(ta);

        // Get plain-English breakdown
        const breakdownRes = await fetch("/api/tempo/breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackName: ta.trackName,
            artists: ta.artists,
            genres: ta.genres,
            bpm: ta.estimatedBpm,
            mood: ta.mood,
            userDominantZone: dominantZone.zone,
            userDominantPercentage: dominantZone.percentage,
          }),
        });
        if (breakdownRes.ok) {
          const bd = await breakdownRes.json();
          setBreakdown(bd);
        }

        setSearchStage("done");
      } catch {
        setSearchStage("results");
      }
    },
    [dominantZone]
  );

  // Section 3: zone recommendation
  const handleZoneRecommend = useCallback((zone: BpmZoneData) => {
    if (zone.tracks.length === 0) return;
    // Pick a representative track from this zone
    const representative = zone.tracks[Math.floor(zone.tracks.length / 2)];
    setZoneRecommendTrack({
      ...representative,
      // Override mood to include zone context
      mood: representative.mood || zone.label,
    });
  }, []);

  // --- Render ---

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
        <Nav />
        <div className="text-center py-20">
          <div className="inline-block w-10 h-10 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin mb-6" />
          <p className="text-lg font-medium text-white mb-1">Loading your music data...</p>
          <p className="text-sm text-neutral-500">This may take a moment if it&apos;s your first visit</p>
        </div>
      </main>
    );
  }

  if (error || !analysis) {
    return (
      <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
        <Nav />
        <div className="text-center py-20">
          <p className="text-red-400 text-lg font-medium mb-2">Something went wrong</p>
          <p className="text-neutral-500 mb-6">{error || "No analysis data found."}</p>
          <a
            href="/api/auth/login"
            className="inline-block bg-white/10 hover:bg-white/15 text-white px-6 py-2 rounded-full text-sm transition-colors"
          >
            Log in with Spotify
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <Nav />

      {/* Page header */}
      <div className="mb-16">
        <h1 className="text-3xl font-bold text-white mb-3">Tempo Lab</h1>
        <p className="text-neutral-400 text-lg leading-relaxed max-w-2xl">
          Why does your favorite song feel the way it does? Let&apos;s find out —
          using your own music as the textbook.
        </p>
      </div>

      {/* ── Section 1: Your Tempo Identity ── */}
      <section className="mb-24">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-2">
          Section 1
        </h2>
        <h3 className="text-2xl font-bold text-white mb-2">Your Tempo Identity</h3>
        <p className="text-neutral-400 text-sm mb-8 max-w-xl">
          Every song has a speed — measured in BPM (beats per minute). Here&apos;s
          how your music spreads across the tempo spectrum.
        </p>

        {/* BPM Spectrum bar */}
        <div className="mb-6">
          <div className="flex rounded-xl overflow-hidden h-12 bg-white/5 border border-white/10">
            {zoneData.map((zone) => {
              const widthPct = Math.max(zone.percentage, 2);
              return (
                <div
                  key={zone.label}
                  className="relative group flex items-center justify-center transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: zone.color,
                    opacity: zone.count > 0 ? 0.7 : 0.15,
                  }}
                >
                  {zone.percentage >= 12 && (
                    <span className="text-white text-[10px] font-bold">
                      {zone.percentage}%
                    </span>
                  )}
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
                    <p className="text-white text-xs font-semibold">{zone.label}</p>
                    <p className="text-neutral-400 text-[10px]">{zone.zone}</p>
                    <p className="text-neutral-500 text-[10px]">{zone.count} tracks · {zone.percentage}%</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Zone labels */}
          <div className="flex mt-2">
            {zoneData.map((zone) => (
              <div
                key={zone.label}
                className="text-center"
                style={{ width: `${Math.max(zone.percentage, 2)}%` }}
              >
                {zone.percentage >= 8 && (
                  <p className="text-[10px] text-neutral-500 truncate">{zone.label}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Track dots visualization */}
        <div className="mb-8 p-4 rounded-xl bg-white/[0.02] border border-white/5">
          <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-3 font-medium">
            Your tracks on the spectrum
          </p>
          <div className="relative h-8">
            {(analysis.trackAnalyses || [])
              .filter((t) => t.estimatedBpm != null && t.estimatedBpm > 0)
              .map((track, i) => {
                const bpm = Math.min(Math.max(track.estimatedBpm!, 40), 200);
                const pct = ((bpm - 40) / (200 - 40)) * 100;
                const zone = getZoneForBpm(bpm);
                return (
                  <div
                    key={`dot-${i}`}
                    className="absolute w-2 h-2 rounded-full group cursor-default"
                    style={{
                      left: `${pct}%`,
                      top: `${(i * 7) % 24}px`,
                      backgroundColor: zone.color,
                      opacity: 0.6,
                    }}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 shadow-xl">
                      <p className="text-white text-[10px] font-medium">{track.trackName}</p>
                      <p className="text-neutral-500 text-[10px]">{(track.artists || []).join(", ")} · {track.estimatedBpm} BPM</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Claude personality paragraph */}
        {personalityLoading && (
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Reading your tempo identity...</span>
          </div>
        )}
        {personality && (
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6">
            <p className="text-neutral-200 text-sm leading-relaxed">{personality}</p>
          </div>
        )}
      </section>

      {/* ── Section 2: Pick a Song ── */}
      <section className="mb-24">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-2">
          Section 2
        </h2>
        <h3 className="text-2xl font-bold text-white mb-2">Pick a Song — Understand Why It Hits</h3>
        <p className="text-neutral-400 text-sm mb-8 max-w-xl">
          Search for any song and we&apos;ll break down exactly why it feels the way
          it does — in plain English, no music degree required.
        </p>

        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. Nights by Frank Ocean"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={searchStage === "searching" || !searchQuery.trim()}
            className="px-6 py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium text-sm hover:bg-purple-500/30 transition-colors disabled:opacity-40"
          >
            {searchStage === "searching" ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Search results */}
        {searchStage === "searching" && (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin mb-3" />
            <p className="text-neutral-500 text-sm">Searching Spotify...</p>
          </div>
        )}

        {(searchStage === "results" || searchStage === "analyzing") && searchResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {searchResults.map((track) => (
              <button
                key={track.id}
                onClick={() => handleSelectTrack(track)}
                disabled={searchStage === "analyzing"}
                className="text-left flex gap-3 rounded-xl p-4 bg-white/5 border border-white/10 hover:bg-white/[0.07] hover:border-purple-500/30 transition-colors disabled:opacity-50"
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

        {/* Analyzing state */}
        {searchStage === "analyzing" && selectedTrack && (
          <div className="text-center py-8 rounded-xl bg-white/[0.03] border border-white/10">
            <div className="inline-block w-6 h-6 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin mb-3" />
            <p className="text-white text-sm font-medium">
              Breaking down &ldquo;{selectedTrack.name}&rdquo;...
            </p>
            <p className="text-neutral-500 text-xs mt-1">Understanding tempo, groove, and instrumentation</p>
          </div>
        )}

        {/* Breakdown result */}
        {searchStage === "done" && trackAnalysis && selectedTrack && (
          <div>
            <button
              onClick={() => { setSearchStage("results"); setBreakdown(null); setTrackAnalysis(null); }}
              className="text-neutral-500 hover:text-neutral-300 text-sm mb-4 transition-colors"
            >
              &larr; Back to results
            </button>

            {/* Track header */}
            <div className="flex gap-4 mb-6 p-5 rounded-xl bg-white/5 border border-purple-500/30">
              {selectedTrack.albumImage && (
                <img src={selectedTrack.albumImage} alt="" className="w-16 h-16 rounded-lg flex-shrink-0 object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-lg truncate">{trackAnalysis.trackName}</p>
                <p className="text-neutral-400 text-sm truncate">{(trackAnalysis.artists || []).join(", ")}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">
                    {trackAnalysis.estimatedBpm} BPM
                  </span>
                  <span className="text-xs italic text-neutral-500">{trackAnalysis.mood}</span>
                </div>
              </div>
            </div>

            {/* Plain-English breakdown */}
            {breakdown ? (
              <div className="space-y-4">
                <BreakdownCard
                  title="The tempo, in human terms"
                  icon="metronome"
                  text={breakdown.tempoExplained}
                  color="#7F77DD"
                />
                <BreakdownCard
                  title="The groove feel"
                  icon="wave"
                  text={breakdown.grooveFeel}
                  color="#1D9E75"
                />
                <BreakdownCard
                  title="The anchor instrument"
                  icon="drum"
                  text={breakdown.anchorInstrument}
                  color="#D4537E"
                />
                <BreakdownCard
                  title="Why you probably like it"
                  icon="heart"
                  text={breakdown.whyYouLikeIt}
                  color="#D85A30"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 py-4">
                <div className="w-4 h-4 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
                <span className="text-sm text-neutral-500">Generating breakdown...</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section 3: Tempo Zones ── */}
      <section className="mb-24">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-2">
          Section 3
        </h2>
        <h3 className="text-2xl font-bold text-white mb-2">Tempo Zones — Explore by Feel</h3>
        <p className="text-neutral-400 text-sm mb-8 max-w-xl">
          Your library, reorganized by energy instead of artist or genre.
          A completely new way to experience music you already own.
        </p>

        <div className="space-y-3">
          {zoneData.map((zone) => {
            const isExpanded = expandedZone === zone.label;
            const previewTracks = zone.tracks.slice(0, 3);

            return (
              <div key={zone.label}>
                <button
                  onClick={() => setExpandedZone(isExpanded ? null : zone.label)}
                  className="w-full text-left rounded-xl p-5 border transition-all"
                  style={{
                    backgroundColor: isExpanded ? `${zone.color}10` : "rgba(255,255,255,0.02)",
                    borderColor: isExpanded ? `${zone.color}40` : "rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: zone.color }}
                        />
                        <h4 className="text-white font-semibold">{zone.label}</h4>
                        <span className="text-neutral-600 text-xs font-mono">{zone.zone}</span>
                      </div>
                      <p className="text-neutral-400 text-sm">{zone.description}</p>
                    </div>
                    <span className="text-neutral-500 text-sm font-mono flex-shrink-0">
                      {zone.count} track{zone.count !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Preview tracks */}
                  {!isExpanded && previewTracks.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {previewTracks.map((t, i) => (
                        <span
                          key={i}
                          className="text-[11px] text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full truncate max-w-[180px]"
                        >
                          {t.trackName}
                        </span>
                      ))}
                      {zone.tracks.length > 3 && (
                        <span className="text-[11px] text-neutral-600">
                          +{zone.tracks.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </button>

                {/* Expanded zone */}
                {isExpanded && (
                  <div className="mt-1 rounded-xl bg-white/[0.02] border border-white/5 p-4">
                    {zone.tracks.length === 0 ? (
                      <p className="text-neutral-600 text-sm py-4 text-center">
                        No tracks in this zone yet
                      </p>
                    ) : (
                      <>
                        {/* Sort hint */}
                        <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-3 font-medium">
                          {zone.tracks.length} tracks sorted by mood
                        </p>

                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                          {[...zone.tracks]
                            .sort((a, b) => (a.mood || "").localeCompare(b.mood || ""))
                            .map((track, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                              >
                                <span className="text-neutral-600 text-[10px] font-mono w-3 text-right">
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm truncate">{track.trackName}</p>
                                  <p className="text-neutral-500 text-xs truncate">
                                    {(track.artists || []).join(", ")}
                                  </p>
                                </div>
                                <span className="text-[10px] font-mono text-neutral-500 flex-shrink-0">
                                  {track.estimatedBpm}
                                </span>
                                <span className="text-[10px] italic text-neutral-600 flex-shrink-0 max-w-[120px] truncate">
                                  {track.mood}
                                </span>
                              </div>
                            ))}
                        </div>

                        {/* Recommend button */}
                        <button
                          onClick={() => handleZoneRecommend(zone)}
                          className="mt-4 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                          style={{
                            backgroundColor: `${zone.color}15`,
                            borderColor: `${zone.color}30`,
                            color: zone.color,
                            border: "1px solid",
                          }}
                        >
                          Find more music that feels like this
                        </button>

                        {/* Inline recommendations */}
                        {zoneRecommendTrack &&
                          expandedZone === zone.label && (
                            <div className="mt-3">
                              <RecommendPanel track={zoneRecommendTrack} />
                            </div>
                          )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Section 4: The Instrument Explainer ── */}
      <section className="mb-24">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-2">
          Section 4
        </h2>
        <h3 className="text-2xl font-bold text-white mb-2">The Instrument Explainer</h3>
        <p className="text-neutral-400 text-sm mb-8 max-w-xl">
          The sounds and instruments that define your music — explained like
          you&apos;ve never read a music textbook (because you probably haven&apos;t, and
          that&apos;s fine).
        </p>

        {instrumentsLoading && (
          <div className="flex items-center gap-3 py-4">
            <div className="w-4 h-4 border-2 border-white/20 border-t-purple-400 rounded-full animate-spin" />
            <span className="text-sm text-neutral-500">Identifying the sounds in your music...</span>
          </div>
        )}

        {instruments.length > 0 && (
          <div className="space-y-4">
            {instruments.map((inst, i) => (
              <div
                key={i}
                className="rounded-xl bg-white/[0.03] border border-white/10 p-6"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-white font-semibold text-lg">{inst.instrument}</h4>
                  <div className="flex gap-1 flex-shrink-0">
                    {(inst.genres || []).slice(0, 2).map((g) => (
                      <span
                        key={g}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-neutral-300 text-sm leading-relaxed">
                  {inst.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {!instrumentsLoading && instruments.length === 0 && analysis && (
          <p className="text-neutral-600 text-sm">
            Not enough genre data to generate instrument explainers.
          </p>
        )}
      </section>
    </main>
  );
}

// --- Sub-components ---

function Nav() {
  return <AppNav />;
}

function BreakdownCard({
  title,
  text,
  color,
}: {
  title: string;
  icon: string;
  text: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-5 border"
      style={{
        backgroundColor: `${color}08`,
        borderColor: `${color}25`,
      }}
    >
      <h4 className="text-white text-sm font-semibold mb-2">{title}</h4>
      <p className="text-neutral-300 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
