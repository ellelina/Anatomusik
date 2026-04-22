"use client";

import { AnalysisResult, RecentTrackDetail } from "@/lib/types";
import GenreCard from "./GenreCard";
import TrackList from "./TrackList";

interface Props {
  result: AnalysisResult;
  trackDetails: RecentTrackDetail[];
}

export default function AnalysisResults({ result, trackDetails }: Props) {
  return (
    <div className="space-y-10">
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

      {/* Per-Song Breakdown */}
      {result.trackAnalyses && result.trackAnalyses.length > 0 && (
        <TrackList tracks={result.trackAnalyses} trackDetails={trackDetails} title="Recently Played — Click a Song for Recommendations" />
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
              <span className="text-lg leading-none mt-0.5" style={{ color: "rgba(180,200,255,0.7)" }}>*</span>
              <p className="text-neutral-300 text-sm leading-relaxed">{insight}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Summary */}
      <section className="text-center max-w-2xl mx-auto border-t border-white/10 pt-8">
        <p className="text-neutral-400 leading-relaxed">{result.summary}</p>
      </section>
    </div>
  );
}
