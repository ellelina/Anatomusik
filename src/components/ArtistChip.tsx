export default function ArtistChip({ name }: { name: string }) {
  return (
    <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-neutral-300 hover:bg-white/15 transition-colors">
      {name}
    </span>
  );
}
