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
          className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            filter === "My genres" && !hasMatchedGenres ? "opacity-40" : ""
          }`}
          style={
            activeFilter === filter
              ? {
                  background: "rgba(150,180,255,0.12)",
                  borderColor: "rgba(180,200,255,0.35)",
                  color: "rgba(180,200,255,0.9)",
                }
              : {
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "rgba(180,200,255,0.4)",
                }
          }
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
