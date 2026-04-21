/*
 * Migration Trail legend — bottom-left floating card.
 * Shows past → middle → present dots with genre/region labels.
 */

"use client";

import { TasteTimelineEntry } from "@/lib/types";

interface Props {
  timeline: TasteTimelineEntry[];
  offsetBottom?: number;
}

const PERIOD_LABELS: Record<string, string> = {
  long_term: "Past",
  medium_term: "6 months",
  short_term: "Now",
};

export default function MigrationLegend({ timeline, offsetBottom = 16 }: Props) {
  const resolved = timeline.filter((t) => t.resolvedScene && t.coordinates);
  if (resolved.length < 2) return null;

  return (
    <div
      className="fixed left-4 z-20 bg-neutral-900/90 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 min-w-[180px]"
      style={{ bottom: offsetBottom }}
    >
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2 font-medium">
        Migration Trail
      </p>
      <div className="flex flex-col gap-2">
        {resolved.map((entry, i) => (
          <div key={entry.period} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 ${
                  i === resolved.length - 1
                    ? "bg-amber-400 border-amber-300"
                    : i === 0
                    ? "bg-amber-400/40 border-amber-500/50"
                    : "bg-amber-400/70 border-amber-400/60"
                }`}
              />
              {i < resolved.length - 1 && (
                <div className="w-px h-3 border-l border-dashed border-amber-500/30" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-500">
                {PERIOD_LABELS[entry.period] || entry.label}
              </span>
              <span className="text-xs text-white font-medium">
                {entry.resolvedScene}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
