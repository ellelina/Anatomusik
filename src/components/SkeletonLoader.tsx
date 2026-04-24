/*
 * Skeleton loading placeholders for GenreCard and TrackRow.
 * Use animate-pulse shimmer to indicate data is loading.
 * Export: GenreCardSkeleton, TrackRowSkeleton
 */

export function GenreCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      {/* Title bar ~60% width */}
      <div className="h-5 w-3/5 rounded-lg bg-white/[0.06] animate-pulse mb-4" />

      {/* Description lines */}
      <div className="space-y-2 mb-5">
        <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
        <div className="h-3 w-11/12 rounded bg-white/[0.06] animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-white/[0.06] animate-pulse" />
      </div>

      {/* Artist chips */}
      <div className="flex gap-2">
        <div className="h-6 w-20 rounded-full bg-white/[0.06] animate-pulse" />
        <div className="h-6 w-24 rounded-full bg-white/[0.06] animate-pulse" />
      </div>
    </div>
  );
}

export function TrackRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      {/* Album art square */}
      <div className="w-10 h-10 rounded-lg bg-white/[0.06] animate-pulse flex-shrink-0" />

      {/* Title + artist */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 w-2/5 rounded bg-white/[0.06] animate-pulse" />
        <div className="h-2.5 w-1/3 rounded bg-white/[0.06] animate-pulse" />
      </div>

      {/* BPM badge on right */}
      <div className="h-5 w-16 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0" />
    </div>
  );
}
