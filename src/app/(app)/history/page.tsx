/*
 * Listening Patterns page — /history
 * Renders a 7×24 heatmap (day × hour) from RecentTrackDetail.playedAt timestamps.
 * Shows peak listening time summary below the grid.
 */

"use client";

import { useMemo } from "react";
import { useAnalysis } from "@/lib/AnalysisContext";
import AppNav from "@/components/AppNav";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Cell color based on play count
function cellColor(count: number): string {
  if (count === 0) return "rgba(255,255,255,0.05)";
  if (count === 1) return "rgba(96,165,250,0.30)";  // blue-400/30
  if (count === 2) return "rgba(96,165,250,0.60)";  // blue-400/60
  return "rgba(96,165,250,0.90)";                    // blue-400/90
}

function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function peakDescription(h: number): string {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "late night";
}

export default function HistoryPage() {
  const { trackDetails, stage } = useAnalysis();

  const isLoading = stage !== "done" && stage !== "error";

  // Build a 7×24 grid of play counts
  const grid = useMemo(() => {
    const counts: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let hasData = false;
    for (const track of trackDetails) {
      if (!track.playedAt) continue;
      const d = new Date(track.playedAt);
      if (isNaN(d.getTime())) continue;
      counts[d.getDay()][d.getHours()]++;
      hasData = true;
    }
    return { counts, hasData };
  }, [trackDetails]);

  // Find the hour with the most plays (for peak summary)
  const peakHour = useMemo(() => {
    if (!grid.hasData) return null;
    const hourTotals = HOURS.map((h) =>
      DAYS.map((_, d) => grid.counts[d][h]).reduce((a, b) => a + b, 0)
    );
    const max = Math.max(...hourTotals);
    if (max === 0) return null;
    return hourTotals.indexOf(max);
  }, [grid]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
      <AppNav />

      <h1
        className="text-2xl font-bold mb-1"
        style={{
          fontFamily: "var(--font-orbitron), sans-serif",
          background: "linear-gradient(135deg, #e8f0ff 0%, #c8d8ff 50%, #a0b8ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Listening Patterns
      </h1>
      <p className="text-sm mb-8" style={{ color: "rgba(180,200,255,0.5)" }}>
        When You Listen
      </p>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin" />
          <p className="text-sm" style={{ color: "rgba(180,200,255,0.5)" }}>
            Loading your listening history...
          </p>
        </div>
      ) : !grid.hasData ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: "rgba(180,200,255,0.03)",
            border: "1px solid rgba(180,200,255,0.08)",
          }}
        >
          <p className="text-base mb-2" style={{ color: "rgba(180,200,255,0.6)" }}>
            Not enough recent listening data
          </p>
          <p className="text-sm" style={{ color: "rgba(180,200,255,0.35)" }}>
            Keep listening on Spotify and check back!
          </p>
        </div>
      ) : (
        <>
          {/* Heatmap grid */}
          <div
            className="rounded-2xl p-4 overflow-x-auto"
            style={{
              background: "rgba(180,200,255,0.02)",
              border: "1px solid rgba(180,200,255,0.08)",
            }}
          >
            <div className="min-w-[520px]">
              {/* X-axis hour labels — only show 0, 6, 12, 18 */}
              <div className="flex mb-1 ml-10">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex-1 text-center"
                    style={{
                      fontSize: "9px",
                      color: [0, 6, 12, 18].includes(h)
                        ? "rgba(180,200,255,0.5)"
                        : "transparent",
                      userSelect: "none",
                    }}
                  >
                    {[0, 6, 12, 18].includes(h) ? hourLabel(h) : "·"}
                  </div>
                ))}
              </div>

              {/* Rows: one per day */}
              {DAYS.map((day, d) => (
                <div key={day} className="flex items-center mb-1">
                  {/* Y-axis label */}
                  <div
                    className="w-10 shrink-0 text-right pr-2"
                    style={{ fontSize: "10px", color: "rgba(180,200,255,0.45)" }}
                  >
                    {day}
                  </div>
                  {/* Hour cells */}
                  {HOURS.map((h) => {
                    const count = grid.counts[d][h];
                    return (
                      <div
                        key={h}
                        title={`${day} ${hourLabel(h)}: ${count} track${count !== 1 ? "s" : ""}`}
                        className="flex-1 mx-px rounded-sm"
                        style={{
                          height: "20px",
                          background: cellColor(count),
                          cursor: count > 0 ? "default" : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 mb-6">
            <span className="text-[10px]" style={{ color: "rgba(180,200,255,0.35)" }}>
              Less
            </span>
            {[0, 1, 2, 3].map((level) => (
              <div
                key={level}
                className="w-3.5 h-3.5 rounded-sm"
                style={{ background: cellColor(level) }}
              />
            ))}
            <span className="text-[10px]" style={{ color: "rgba(180,200,255,0.35)" }}>
              More
            </span>
          </div>

          {/* Peak listening summary */}
          {peakHour !== null && (
            <div
              className="rounded-2xl p-5"
              style={{
                background: "rgba(100,140,255,0.07)",
                border: "1px solid rgba(100,140,255,0.15)",
              }}
            >
              <p className="text-sm font-medium mb-1" style={{ color: "rgba(180,200,255,0.8)" }}>
                Peak listening time
              </p>
              <p className="text-base" style={{ color: "rgba(180,200,255,0.6)" }}>
                You listen most at{" "}
                <span className="text-white font-semibold">{hourLabel(peakHour)}</span>{" "}
                — {peakDescription(peakHour)} listening sessions.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
