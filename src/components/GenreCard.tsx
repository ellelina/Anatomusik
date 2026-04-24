import { MicroGenre } from "@/lib/types";
import ArtistChip from "./ArtistChip";

function truncateSentences(text: string, max = 3): string {
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g);
  if (!sentences || sentences.length <= max) return text;
  return sentences.slice(0, max).join("").trimEnd() + "…";
}

const confidenceColors = {
  high: "border-emerald-500/50 bg-emerald-500/5",
  medium: "border-amber-500/50 bg-amber-500/5",
  low: "border-purple-500/50 bg-purple-500/5",
};

// Filled dot color per confidence level
const dotFilled = {
  high: "#34d399",   // emerald-400
  medium: "#fbbf24", // amber-400
  low: "#c084fc",    // purple-400
};

// Number of filled dots per level (out of 3)
const dotCount = { high: 3, medium: 2, low: 1 };

function ConfidenceDots({ level }: { level: "high" | "medium" | "low" }) {
  const filled = dotCount[level];
  const color = dotFilled[level];
  return (
    <div className="flex items-center gap-1 flex-shrink-0 mt-1">
      {[0, 1, 2].map((i) =>
        i < filled ? (
          <span
            key={i}
            className="block rounded-full"
            style={{ width: 6, height: 6, backgroundColor: color }}
          />
        ) : (
          <span
            key={i}
            className="block rounded-full"
            style={{ width: 6, height: 6, border: `1.5px solid ${color}`, opacity: 0.4 }}
          />
        )
      )}
    </div>
  );
}

export default function GenreCard({ genre }: { genre: MicroGenre }) {
  return (
    <div
      className={`rounded-2xl border-t border-r border-b border-l-4 p-5 transition-all hover:scale-[1.02] ${confidenceColors[genre.confidence]}`}
      style={{ borderLeftColor: "rgba(168,85,247,0.5)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-xl font-bold text-white">{genre.name}</h3>
        <ConfidenceDots level={genre.confidence} />
      </div>
      <p className="text-[15px] text-neutral-400 mb-4 leading-7">
        {truncateSentences(genre.description)}
      </p>
      <div className="flex flex-wrap gap-2">
        {genre.representativeArtists.map((artist) => (
          <ArtistChip key={artist} name={artist} />
        ))}
      </div>
    </div>
  );
}
