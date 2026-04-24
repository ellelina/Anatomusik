"use client";

/*
 * AnalysisResults — renders the full Claude music analysis output.
 * Sections (top to bottom):
 *   1. Stats bar (micro-genre count, tracks analyzed, unique genres, niche level)
 *   2. Music Personality headline
 *   3. Micro-Genres grid
 *   4. Taste Evolution timeline (tasteTimeline data)
 *   5. Per-song track list
 *   6. Unique Insights
 *   7. Summary footer
 */

import Link from "next/link";
import { AnalysisResult, RecentTrackDetail, TasteTimelineEntry } from "@/lib/types";
import GenreCard from "./GenreCard";
import TrackList from "./TrackList";

interface Props {
  result: AnalysisResult;
  trackDetails: RecentTrackDetail[];
}

// --- Stats bar helpers ---

function calcNicheLevel(microGenres: AnalysisResult["microGenres"]): string {
  if (microGenres.length === 0) return "Eclectic";
  const highCount = microGenres.filter((g) => g.confidence === "high").length;
  const ratio = highCount / microGenres.length;
  if (ratio > 0.6) return "Deep Niche";
  if (ratio >= 0.4) return "Eclectic";
  return "Mainstream Adjacent";
}

function StatPill({ label }: { label: string }) {
  return (
    <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-400">
      {label}
    </span>
  );
}

// --- Taste Evolution timeline ---

const PERIOD_ORDER: TasteTimelineEntry["period"][] = [
  "long_term",
  "medium_term",
  "short_term",
];

function TasteTimeline({ entries }: { entries: TasteTimelineEntry[] }) {
  // Sort into the expected left-to-right order
  const ordered = PERIOD_ORDER.map((p) => entries.find((e) => e.period === p)).filter(
    Boolean
  ) as TasteTimelineEntry[];

  if (ordered.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-5">
        Taste Evolution
      </h2>

      <div className="flex items-stretch gap-2">
        {ordered.map((entry, idx) => (
          <div key={entry.period} className="flex items-stretch gap-2 flex-1 min-w-0">
            {/* Column card */}
            <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <p className="text-xs font-semibold text-neutral-400 mb-1">{entry.label}</p>

              {entry.resolvedScene && (
                <p className="text-xs mb-3" style={{ color: "rgba(147,197,253,0.85)" }}>
                  {entry.resolvedScene}
                </p>
              )}

              <div className="flex flex-wrap gap-1">
                {entry.topGenres.slice(0, 5).map((genre) => (
                  <span
                    key={genre}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-400"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>

            {/* Arrow between columns */}
            {idx < ordered.length - 1 && (
              <div className="flex items-center flex-shrink-0 text-neutral-600 text-sm select-none">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Main component ---

export default function AnalysisResults({ result, trackDetails }: Props) {
  // Stats bar values
  const uniqueArtistCount = new Set(
    result.microGenres.flatMap((g) => g.representativeArtists)
  ).size;
  const nicheLevel = calcNicheLevel(result.microGenres);

  const timeline = result.tasteTimeline ?? [];

  return (
    <div className="space-y-10">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 mb-8 justify-center">
        <StatPill label={`${result.microGenres.length} micro-genres identified`} />
        <StatPill label={`${result.trackAnalyses.length} tracks analyzed`} />
        <StatPill label={`${uniqueArtistCount} featured artists`} />
        <StatPill label={nicheLevel} />
      </div>

      {/* Music Personality */}
      <section className="text-center max-w-2xl mx-auto">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-3">
          Your Music Personality
        </h2>
        <p className="text-xl md:text-2xl font-medium text-neutral-200 leading-relaxed">
          {result.musicPersonality}
        </p>
      </section>

      {/* Micro-Genres Grid */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-5">
          Your Micro-Genres
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {result.microGenres.map((genre) => (
            <GenreCard key={genre.name} genre={genre} />
          ))}
        </div>
      </section>

      {/* Taste Evolution timeline */}
      {timeline.length > 0 && <TasteTimeline entries={timeline} />}

      {/* Per-Song Breakdown */}
      {result.trackAnalyses && result.trackAnalyses.length > 0 && (
        <TrackList
          tracks={result.trackAnalyses}
          trackDetails={trackDetails}
          title="Recently Played — Click a Song for Recommendations"
        />
      )}

      {/* Unique Insights */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-5">
          Unique Insights
        </h2>
        <ul className="space-y-3">
          {result.uniqueInsights.map((insight, i) => (
            <li
              key={i}
              className="flex gap-3 bg-white/5 border border-white/10 rounded-xl p-4"
            >
              <span
                className="text-lg leading-none mt-0.5"
                style={{ color: "rgba(180,200,255,0.7)" }}
              >
                *
              </span>
              <p className="text-neutral-300 text-sm leading-relaxed">{insight}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Summary */}
      <section className="text-center max-w-2xl mx-auto border-t border-white/10 pt-8">
        <p className="text-neutral-400 leading-relaxed">{result.summary}</p>
      </section>

      {/* Liked Songs entry point */}
      <Link
        href="/liked-songs"
        className="flex items-center justify-between rounded-2xl px-5 py-4 transition-colors hover:bg-white/[0.05]"
        style={{
          background: "rgba(180,200,255,0.03)",
          border: "1px solid rgba(180,200,255,0.08)",
        }}
      >
        <div>
          <p className="text-sm font-medium text-white mb-0.5">Liked Songs</p>
          <p className="text-xs" style={{ color: "rgba(180,200,255,0.45)" }}>
            Browse and analyze your saved tracks
          </p>
        </div>
        <span className="text-lg" style={{ color: "rgba(180,200,255,0.3)" }}>→</span>
      </Link>
    </div>
  );
}
