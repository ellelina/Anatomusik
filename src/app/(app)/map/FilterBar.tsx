"use client";

export const FILTERS = [
  "All",
  "Electronic",
  "Indie/alt",
  "Urban",
  "Experimental",
  "Emerging only",
  "My genres",
] as const;

export type FilterType = (typeof FILTERS)[number];

interface Props {
  activeFilter: FilterType;
  onFilter: (f: FilterType) => void;
  hasMatchedGenres: boolean;
}

export default function FilterBar({ activeFilter, onFilter, hasMatchedGenres }: Props) {
  return (
    <div className="fixed top-[52px] left-0 right-0 z-20 px-4 py-2 flex gap-2 overflow-x-auto"
      style={{ scrollbarWidth: "none" }}
    >
      {FILTERS.map((filter) => (
        <button
          key={filter}
          onClick={() => onFilter(filter)}
          className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeFilter === filter
              ? "bg-emerald-500/30 border border-emerald-500/50 text-emerald-300"
              : "bg-white/5 border border-white/10 text-neutral-400 hover:text-white"
          } ${filter === "My genres" && !hasMatchedGenres ? "opacity-40" : ""}`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
