"use client";

/*
 * TrackList — expandable per-track rows with audio preview and album art color theming.
 * Features:
 *   - Play/pause button for 30-second Spotify previews (one track at a time)
 *   - Expanded row samples album art dominant color via canvas for subtle tinted background
 *   - BPM badge, genre pills, mood label, recommendation panel on expand
 */

import { useState, useRef, useCallback } from "react";
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
  const [playingTrackName, setPlayingTrackName] = useState<string | null>(null);

  // Shared audio element — only one plays at a time
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Map of track name → extracted dominant color as "r,g,b" string
  const [extractedColors, setExtractedColors] = useState<Map<string, string>>(new Map());

  const handlePlayPause = useCallback(
    (e: React.MouseEvent, trackName: string, previewUrl: string) => {
      e.stopPropagation();

      if (playingTrackName === trackName) {
        audioRef.current?.pause();
        setPlayingTrackName(null);
        return;
      }

      // Stop previous track
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      audio.play().catch(() => {});
      setPlayingTrackName(trackName);

      audio.addEventListener("ended", () => setPlayingTrackName(null), { once: true });
    },
    [playingTrackName]
  );

  const extractColor = useCallback(
    (trackName: string, imageUrl: string) => {
      if (extractedColors.has(trackName)) return;

      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width || 56;
          canvas.height = img.height || 56;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const cx = Math.floor(canvas.width / 2);
          const cy = Math.floor(canvas.height / 2);
          const px = ctx.getImageData(cx, cy, 1, 1).data;
          const [r, g, b] = [px[0], px[1], px[2]];

          setExtractedColors((prev) => {
            const next = new Map(prev);
            next.set(trackName, `${r},${g},${b}`);
            return next;
          });
        } catch {
          // Canvas tainted or CORS failure — fall back silently
        }
      };
    },
    [extractedColors]
  );

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
          const isSelected =
            selectedTrack?.trackName === track.trackName &&
            selectedTrack?.artists?.join() === track.artists?.join();

          const isPlaying = playingTrackName === track.trackName;
          const hasPreview = !!detail?.previewUrl;

          // Determine row background: use extracted color when expanded, otherwise defaults
          let rowStyle: React.CSSProperties = {};
          let rowClassName: string;

          if (isSelected) {
            const rgb = extractedColors.get(track.trackName);
            if (rgb) {
              rowStyle = {
                backgroundColor: `rgba(${rgb},0.08)`,
                borderColor: `rgba(${rgb},0.35)`,
              };
              rowClassName =
                "w-full text-left flex gap-4 rounded-xl p-4 transition-colors border";
            } else {
              rowClassName =
                "w-full text-left flex gap-4 rounded-xl p-4 transition-colors bg-emerald-500/10 border border-emerald-500/30";
            }
          } else {
            rowClassName =
              "w-full text-left flex gap-4 rounded-xl p-4 transition-colors bg-white/5 border border-white/10 hover:bg-white/[0.07]";
          }

          return (
            <div key={`${track.trackName}-${i}`}>
              <button
                onClick={() => {
                  const next = isSelected ? null : track;
                  setSelectedTrack(next);
                  // Kick off color extraction when expanding
                  if (next && detail?.albumImage) {
                    extractColor(track.trackName, detail.albumImage);
                  }
                }}
                className={rowClassName}
                style={rowStyle}
              >
                {/* Play/pause preview button — shown only if track has a previewUrl */}
                {hasPreview && (
                  <div className="flex-shrink-0 flex items-center">
                    <button
                      onClick={(e) => handlePlayPause(e, track.trackName, detail!.previewUrl!)}
                      className="w-8 h-8 rounded-full flex items-center justify-center border border-white/20 text-cyan-200 hover:bg-white/10 transition-colors text-[13px]"
                      title={isPlaying ? "Pause preview" : "Play 30s preview"}
                    >
                      {isPlaying ? "■" : "▶"}
                    </button>
                  </div>
                )}

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
                      <p className="text-white font-medium truncate">{track.trackName}</p>
                      <p className="text-neutral-500 text-sm truncate">
                        {(track.artists || []).join(", ")}
                      </p>
                    </div>

                    <div className="flex-shrink-0 flex items-center gap-2">
                      <span className="inline-block text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">
                        {track.estimatedBpm ?? "?"} BPM
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
              {isSelected && <RecommendPanel track={track} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
