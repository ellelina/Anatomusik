"use client";

import { useState } from "react";
import { TrackAnalysis, RecentTrackDetail } from "@/lib/types";
import RecommendPanel from "./RecommendPanel";

interface TrackListProps {
  tracks: TrackAnalysis[];
  trackDetails: RecentTrackDetail[];
  title?: string;
}

export default function TrackList({ tracks, trackDetails, title }: TrackListProps) {
  const detailMap = new Map(trackDetails.map((t) => [t.name, t]));
  const [selectedTrack, setSelectedTrack] = useState<TrackAnalysis | null>(null);

  return (
    <section>
      {title && (
        <h2 className="text-sm font-semibold uppercase tracking-widest text-neutral-500 mb-5">
          {title}
        </h2>
      )}
      <div className="space-y-3">
        {tracks.map((track, i) => {
          const detail = detailMap.get(track.trackName);
          const isSelected = selectedTrack?.trackName === track.trackName
            && selectedTrack?.artists?.join() === track.artists?.join();

          return (
            <div key={`${track.trackName}-${i}`}>
              <button
                onClick={() => setSelectedTrack(isSelected ? null : track)}
                className={`w-full text-left flex gap-4 rounded-xl p-4 transition-colors ${
                  isSelected
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-white/5 border border-white/10 hover:bg-white/[0.07]"
                }`}
              >
                {/* Album art */}
                {detail?.albumImage && (
                  <img
                    src={detail.albumImage}
                    alt={detail.albumName}
                    className="w-14 h-14 rounded-lg flex-shrink-0 object-cover"
                  />
                )}

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">
                        {track.trackName}
                      </p>
                      <p className="text-neutral-500 text-sm truncate">
                        {(track.artists || []).join(", ")}
                      </p>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className="inline-block text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">
                        {track.estimatedBpm} BPM
                      </span>
                      <span className="text-[10px] text-neutral-600">
                        {isSelected ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {(track.genres || []).map((genre) => (
                      <span
                        key={genre}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300"
                      >
                        {genre}
                      </span>
                    ))}
                    <span className="text-[11px] italic text-neutral-500 ml-1">
                      {track.mood}
                    </span>
                  </div>
                </div>
              </button>

              {/* Recommendation panel slides in below selected track */}
              {isSelected && (
                <RecommendPanel track={track} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
