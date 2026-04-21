/*
 * Unified overlay toggle panel — replaces MyTasteToggle.
 * Four toggle buttons: My Taste, Migration Trail, Radar, Energy.
 * Position: fixed top-right, below NavBar.
 */

"use client";

type OverlayKey = "myTaste" | "migration" | "radar" | "energy";

interface Props {
  myTasteMode: boolean;
  migrationTrail: boolean;
  radar: boolean;
  energy: boolean;
  onToggle: (overlay: OverlayKey) => void;
}

const TOGGLES: {
  key: OverlayKey;
  label: string;
  activeLabel: string;
  color: string;
  dotColor: string;
  borderColor: string;
}[] = [
  {
    key: "myTaste",
    label: "Global",
    activeLabel: "My taste",
    color: "bg-cyan-500/20",
    dotColor: "bg-cyan-400",
    borderColor: "border-cyan-500/40",
  },
  {
    key: "migration",
    label: "Trail",
    activeLabel: "Trail",
    color: "bg-amber-500/20",
    dotColor: "bg-amber-400",
    borderColor: "border-amber-500/40",
  },
  {
    key: "radar",
    label: "Radar",
    activeLabel: "Radar",
    color: "bg-emerald-500/20",
    dotColor: "bg-emerald-400",
    borderColor: "border-emerald-500/40",
  },
  {
    key: "energy",
    label: "Energy",
    activeLabel: "Energy",
    color: "bg-purple-500/20",
    dotColor: "bg-purple-400",
    borderColor: "border-purple-500/40",
  },
];

export default function OverlayPanel({
  myTasteMode,
  migrationTrail,
  radar,
  energy,
  onToggle,
}: Props) {
  const states: Record<OverlayKey, boolean> = {
    myTaste: myTasteMode,
    migration: migrationTrail,
    radar,
    energy,
  };

  return (
    <div className="fixed top-[60px] right-4 z-20 flex flex-col gap-1.5">
      {TOGGLES.map((t) => {
        const active = states[t.key];

        return (
          <button
            key={t.key}
            onClick={() => onToggle(t.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              active
                ? `${t.color} ${t.borderColor} text-white`
                : "bg-white/5 border-white/15 text-neutral-400 hover:bg-white/10"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                active ? t.dotColor : "bg-neutral-600"
              }`}
            />
            {active ? t.activeLabel : t.label}
          </button>
        );
      })}
    </div>
  );
}
