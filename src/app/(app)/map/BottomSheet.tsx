"use client";

import { SceneEntry } from "@/lib/genre-map-data";

interface Props {
  scene: SceneEntry;
  onClose: () => void;
}

export default function BottomSheet({ scene, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-neutral-900 border-t border-white/10 rounded-t-3xl p-6 max-h-[60vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-white font-bold text-lg">{scene.name}</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
              scene.emerging
                ? "bg-amber-500/20 text-amber-300"
                : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            {scene.emerging ? "Emerging" : "Established"}
          </span>
        </div>

        <p className="text-neutral-500 text-sm mb-3">{scene.region}</p>
        <p className="text-neutral-300 text-sm leading-relaxed mb-4">
          {scene.description}
        </p>

        <div className="flex flex-wrap gap-2 mb-5">
          {scene.artists.map((a) => (
            <span
              key={a}
              className="text-xs px-2 py-1 rounded-full bg-white/10 text-neutral-300"
            >
              {a}
            </span>
          ))}
        </div>

        <a
          href={`/search?q=${encodeURIComponent(scene.name)}`}
          className="inline-block px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
        >
          Explore this genre
        </a>
      </div>
    </div>
  );
}
