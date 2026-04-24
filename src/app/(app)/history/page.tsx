/*
 * Listening Patterns page — /history
 * Renders a 7×24 heatmap plus derived insight panels from RecentTrackDetail.playedAt timestamps.
 */

"use client";

import { useMemo } from "react";
import { useAnalysis } from "@/lib/AnalysisContext";
import AppNav from "@/components/AppNav";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TIME_SLOTS = [
  { label: "Morning",   start: 5,  end: 12, color: "rgba(96,165,250,0.8)" },
  { label: "Afternoon", start: 12, end: 17, color: "rgba(52,211,153,0.8)" },
  { label: "Evening",   start: 17, end: 22, color: "rgba(167,139,250,0.8)" },
  { label: "Night",     start: 22, end: 29, color: "rgba(244,114,182,0.8)" }, // 29 wraps to 5am
];

function cellColor(count: number): string {
  if (count === 0) return "rgba(255,255,255,0.05)";
  if (count === 1) return "rgba(96,165,250,0.30)";
  if (count === 2) return "rgba(96,165,250,0.60)";
  return "rgba(96,165,250,0.90)";
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

  // Build 7×24 grid of play counts
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

  // Peak hour
  const peakHour = useMemo(() => {
    if (!grid.hasData) return null;
    const totals = HOURS.map((h) => DAYS.map((_, d) => grid.counts[d][h]).reduce((a, b) => a + b, 0));
    const max = Math.max(...totals);
    return max === 0 ? null : totals.indexOf(max);
  }, [grid]);

  // Day totals for bar chart
  const dayTotals = useMemo(() => {
    return DAYS.map((_, d) => HOURS.reduce((sum, h) => sum + grid.counts[d][h], 0));
  }, [grid]);

  const peakDay = useMemo(() => {
    const max = Math.max(...dayTotals);
    return max === 0 ? null : dayTotals.indexOf(max);
  }, [dayTotals]);

  // Time-of-day buckets
  const timeBuckets = useMemo(() => {
    return TIME_SLOTS.map((slot) => {
      let count = 0;
      for (let h = 0; h < 24; h++) {
        const inSlot = slot.end <= 24
          ? h >= slot.start && h < slot.end
          : h >= slot.start || h < (slot.end - 24);
        if (inSlot) {
          for (let d = 0; d < 7; d++) count += grid.counts[d][h];
        }
      }
      return { ...slot, count };
    });
  }, [grid]);

  const totalPlays = useMemo(() => timeBuckets.reduce((s, b) => s + b.count, 0), [timeBuckets]);

  // Quick stats
  const stats = useMemo(() => {
    const uniqueArtists = new Set<string>();
    const activeDays = new Set<string>();
    for (const t of trackDetails) {
      if (!t.playedAt) continue;
      const d = new Date(t.playedAt);
      if (isNaN(d.getTime())) continue;
      (t.artists ?? []).forEach((a) => uniqueArtists.add(a));
      activeDays.add(d.toDateString());
    }
    return { uniqueArtists: uniqueArtists.size, activeDays: activeDays.size };
  }, [trackDetails]);

  // Top genres from recent plays
  const topGenres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of trackDetails) {
      for (const g of t.genres ?? []) {
        counts.set(g, (counts.get(g) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [trackDetails]);

  // Top artists by play count
  const topArtists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of trackDetails) {
      for (const a of t.artists ?? []) {
        counts.set(a, (counts.get(a) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [trackDetails]);

  // Most replayed tracks (played 2+ times)
  const topTracks = useMemo(() => {
    const counts = new Map<string, { count: number; artists: string[]; albumImage: string }>();
    for (const t of trackDetails) {
      const key = t.name;
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { count: 1, artists: t.artists ?? [], albumImage: t.albumImage ?? "" });
      }
    }
    return Array.from(counts.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter((t) => t.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [trackDetails]);

  // Album diversity score
  const albumDiversity = useMemo(() => {
    const albums = new Set<string>();
    for (const t of trackDetails) {
      if (t.albumName) albums.add(t.albumName);
    }
    const uniqueAlbums = albums.size;
    const ratio = totalPlays > 0 ? Math.round((uniqueAlbums / totalPlays) * 100) : 0;
    return { uniqueAlbums, ratio };
  }, [trackDetails, totalPlays]);

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
        When you listen
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
          style={{ background: "rgba(180,200,255,0.03)", border: "1px solid rgba(180,200,255,0.08)" }}
        >
          <p className="text-base mb-2" style={{ color: "rgba(180,200,255,0.6)" }}>
            Not enough recent listening data
          </p>
          <p className="text-sm" style={{ color: "rgba(180,200,255,0.35)" }}>
            Keep listening on Spotify and check back.
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Plays tracked", value: totalPlays },
              { label: "Unique artists", value: stats.uniqueArtists },
              { label: "Days active", value: stats.activeDays },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-2xl p-4 text-center"
                style={{ background: "rgba(180,200,255,0.03)", border: "1px solid rgba(180,200,255,0.08)" }}
              >
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(180,200,255,0.45)" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Heatmap */}
          <div
            className="rounded-2xl p-4 overflow-x-auto"
            style={{ background: "rgba(180,200,255,0.02)", border: "1px solid rgba(180,200,255,0.08)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(180,200,255,0.35)" }}>
              Activity by hour
            </p>
            <div className="min-w-[520px]">
              <div className="flex mb-1 ml-10">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="flex-1 text-center"
                    style={{
                      fontSize: "9px",
                      color: [0, 6, 12, 18].includes(h) ? "rgba(180,200,255,0.5)" : "transparent",
                      userSelect: "none",
                    }}
                  >
                    {[0, 6, 12, 18].includes(h) ? hourLabel(h) : "·"}
                  </div>
                ))}
              </div>

              {DAYS.map((day, d) => (
                <div key={day} className="flex items-center mb-1">
                  <div className="w-10 shrink-0 text-right pr-2" style={{ fontSize: "10px", color: "rgba(180,200,255,0.45)" }}>
                    {day}
                  </div>
                  {HOURS.map((h) => {
                    const count = grid.counts[d][h];
                    return (
                      <div
                        key={h}
                        title={`${day} ${hourLabel(h)}: ${count} track${count !== 1 ? "s" : ""}`}
                        className="flex-1 mx-px rounded-sm"
                        style={{ height: "20px", background: cellColor(count) }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 -mt-3">
            <span className="text-[10px]" style={{ color: "rgba(180,200,255,0.35)" }}>Less</span>
            {[0, 1, 2, 3].map((level) => (
              <div key={level} className="w-3.5 h-3.5 rounded-sm" style={{ background: cellColor(level) }} />
            ))}
            <span className="text-[10px]" style={{ color: "rgba(180,200,255,0.35)" }}>More</span>
          </div>

          {/* Day of week breakdown */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(180,200,255,0.02)", border: "1px solid rgba(180,200,255,0.08)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(180,200,255,0.35)" }}>
              By day of week
            </p>
            <div className="space-y-2">
              {DAYS.map((day, d) => {
                const count = dayTotals[d];
                const maxCount = Math.max(...dayTotals, 1);
                const pct = (count / maxCount) * 100;
                const isPeak = d === peakDay;
                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-[11px] w-7 shrink-0" style={{ color: isPeak ? "rgba(180,200,255,0.9)" : "rgba(180,200,255,0.4)" }}>
                      {day}
                    </span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: isPeak ? "rgba(96,165,250,0.85)" : "rgba(96,165,250,0.35)" }}
                      />
                    </div>
                    <span className="text-[11px] font-mono w-6 text-right shrink-0" style={{ color: isPeak ? "rgba(180,200,255,0.8)" : "rgba(180,200,255,0.35)" }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
            {peakDay !== null && (
              <p className="text-xs mt-4" style={{ color: "rgba(180,200,255,0.5)" }}>
                <span className="text-white font-medium">{DAYS[peakDay]}</span> is your heaviest listening day.
              </p>
            )}
          </div>

          {/* Time of day profile */}
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(180,200,255,0.02)", border: "1px solid rgba(180,200,255,0.08)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(180,200,255,0.35)" }}>
              Time of day
            </p>
            <div className="grid grid-cols-2 gap-3">
              {timeBuckets.map((slot) => {
                const pct = totalPlays > 0 ? Math.round((slot.count / totalPlays) * 100) : 0;
                return (
                  <div
                    key={slot.label}
                    className="rounded-xl p-4"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-white">{slot.label}</span>
                      <span className="text-xs font-mono font-bold" style={{ color: slot.color }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: slot.color }}
                      />
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: "rgba(180,200,255,0.35)" }}>
                      {slot.count} {slot.count === 1 ? "play" : "plays"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Peak listening time */}
          {peakHour !== null && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(100,140,255,0.07)", border: "1px solid rgba(100,140,255,0.15)" }}
            >
              <p className="text-sm font-medium mb-1" style={{ color: "rgba(180,200,255,0.8)" }}>
                Peak listening time
              </p>
              <p className="text-base" style={{ color: "rgba(180,200,255,0.6)" }}>
                You listen most at{" "}
                <span className="text-white font-semibold">{hourLabel(peakHour)}</span>
                , during {peakDescription(peakHour)} sessions.
              </p>
            </div>
          )}

          {/* Top genres from recent plays */}
          {topGenres.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(180,200,255,0.02)", border: "1px solid rgba(180,200,255,0.08)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(180,200,255,0.35)" }}>
                Genres in rotation
              </p>
              <div className="space-y-2">
                {topGenres.map(([genre, count]) => {
                  const maxCount = topGenres[0][1];
                  const pct = (count / maxCount) * 100;
                  return (
                    <div key={genre} className="flex items-center gap-3">
                      <span className="text-[11px] min-w-0 flex-1 truncate" style={{ color: "rgba(180,200,255,0.7)" }}>
                        {genre}
                      </span>
                      <div className="w-24 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: "rgba(168,85,247,0.7)" }}
                        />
                      </div>
                      <span className="text-[10px] font-mono w-4 text-right shrink-0" style={{ color: "rgba(180,200,255,0.35)" }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top artists */}
          {topArtists.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(180,200,255,0.02)", border: "1px solid rgba(180,200,255,0.08)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(180,200,255,0.35)" }}>
                Top artists
              </p>
              <div className="space-y-2">
                {topArtists.map(([artist, count], i) => {
                  const maxCount = topArtists[0][1];
                  const pct = (count / maxCount) * 100;
                  const isTop = i === 0;
                  return (
                    <div key={artist} className="flex items-center gap-3">
                      <span
                        className="text-[10px] font-mono w-4 shrink-0 text-right"
                        style={{ color: "rgba(180,200,255,0.25)" }}
                      >
                        {i + 1}
                      </span>
                      <span
                        className="text-[11px] min-w-0 flex-1 truncate"
                        style={{ color: isTop ? "rgba(180,200,255,0.9)" : "rgba(180,200,255,0.65)" }}
                      >
                        {artist}
                      </span>
                      <div className="w-24 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: isTop ? "rgba(96,165,250,0.85)" : "rgba(96,165,250,0.4)" }}
                        />
                      </div>
                      <span className="text-[10px] font-mono w-4 text-right shrink-0" style={{ color: "rgba(180,200,255,0.35)" }}>
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs mt-4" style={{ color: "rgba(180,200,255,0.5)" }}>
                <span className="text-white font-medium">{topArtists[0][0]}</span> leads your recent plays.
              </p>
            </div>
          )}

          {/* Most replayed tracks */}
          {topTracks.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(180,200,255,0.02)", border: "1px solid rgba(180,200,255,0.08)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(180,200,255,0.35)" }}>
                On repeat
              </p>
              <div className="space-y-3">
                {topTracks.map((track, i) => (
                  <div key={track.name} className="flex items-center gap-3">
                    {track.albumImage ? (
                      <img
                        src={track.albumImage}
                        alt=""
                        className="w-8 h-8 rounded-md shrink-0 object-cover"
                        style={{ opacity: 0.75 }}
                      />
                    ) : (
                      <span
                        className="text-[10px] font-mono w-8 text-right shrink-0"
                        style={{ color: "rgba(180,200,255,0.25)" }}
                      >
                        {i + 1}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate" style={{ color: "rgba(180,200,255,0.85)" }}>
                        {track.name}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "rgba(180,200,255,0.4)" }}>
                        {track.artists.join(", ")}
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-mono font-bold shrink-0 px-2 py-0.5 rounded-full"
                      style={{
                        background: "rgba(52,211,153,0.12)",
                        border: "1px solid rgba(52,211,153,0.25)",
                        color: "rgba(52,211,153,0.85)",
                      }}
                    >
                      ×{track.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Album diversity */}
          {albumDiversity.uniqueAlbums > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "rgba(180,200,255,0.02)", border: "1px solid rgba(180,200,255,0.08)" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(180,200,255,0.35)" }}>
                Variety score
              </p>
              <div className="flex items-end gap-4 mb-3">
                <p className="text-3xl font-bold text-white">{albumDiversity.ratio}%</p>
                <p className="text-[11px] pb-1" style={{ color: "rgba(180,200,255,0.4)" }}>
                  {albumDiversity.uniqueAlbums} albums across {totalPlays} plays
                </p>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(albumDiversity.ratio, 100)}%`, background: "linear-gradient(90deg, rgba(96,165,250,0.6), rgba(168,85,247,0.6))" }}
                />
              </div>
              <p className="text-xs mt-3" style={{ color: "rgba(180,200,255,0.45)" }}>
                {albumDiversity.ratio >= 70
                  ? "You explore broadly — rarely circling the same albums."
                  : albumDiversity.ratio >= 40
                  ? "A mix of exploration and comfort picks."
                  : "You tend to stick to familiar albums when you listen."}
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
