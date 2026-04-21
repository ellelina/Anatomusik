import { MicroGenre } from "@/lib/types";
import ArtistChip from "./ArtistChip";

const confidenceColors = {
  high: "border-emerald-500/50 bg-emerald-500/5",
  medium: "border-amber-500/50 bg-amber-500/5",
  low: "border-purple-500/50 bg-purple-500/5",
};

const confidenceBadge = {
  high: "bg-emerald-500/20 text-emerald-300",
  medium: "bg-amber-500/20 text-amber-300",
  low: "bg-purple-500/20 text-purple-300",
};

export default function GenreCard({ genre }: { genre: MicroGenre }) {
  return (
    <div
      className={`rounded-2xl border p-5 transition-all hover:scale-[1.02] ${confidenceColors[genre.confidence]}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-lg font-bold text-white">{genre.name}</h3>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${confidenceBadge[genre.confidence]}`}
        >
          {genre.confidence}
        </span>
      </div>
      <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
        {genre.description}
      </p>
      <div className="flex flex-wrap gap-2">
        {genre.representativeArtists.map((artist) => (
          <ArtistChip key={artist} name={artist} />
        ))}
      </div>
    </div>
  );
}
