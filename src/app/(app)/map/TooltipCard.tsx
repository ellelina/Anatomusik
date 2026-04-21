"use client";

import { useEffect, useState } from "react";
import { SceneEntry } from "@/lib/genre-map-data";

interface Props {
  scene: SceneEntry;
  pos: { x: number; y: number };
}

export default function TooltipCard({ scene, pos }: Props) {
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Clamp to viewport
  const cardW = 260;
  const cardH = 220;
  const x = Math.min(pos.x + 12, dims.w - cardW - 16);
  const y = Math.min(pos.y + 12, dims.h - cardH - 16);

  return (
    <div
      className="fixed z-30 pointer-events-none bg-neutral-900 border border-white/10 rounded-2xl p-4 shadow-2xl animate-fade-in"
      style={{ left: x, top: y, width: cardW }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-white font-bold text-sm">{scene.name}</h3>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            scene.emerging
              ? "bg-amber-500/20 text-amber-300"
              : "bg-emerald-500/15 text-emerald-400"
          }`}
        >
          {scene.emerging ? "Emerging" : "Established"}
        </span>
      </div>
      <p className="text-neutral-500 text-[11px] mb-2">{scene.region}</p>
      <p className="text-neutral-300 text-xs leading-relaxed mb-3 line-clamp-2">
        {scene.description}
      </p>
      <div className="flex flex-wrap gap-1">
        {scene.artists.slice(0, 3).map((a) => (
          <span
            key={a}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-neutral-300"
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}
