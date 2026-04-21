/*
 * Energy overlay legend — bottom-left floating card.
 * Shows BPM tier color swatches.
 */

"use client";

interface Props {
  offsetBottom?: number;
}

const TIERS = [
  { label: "High energy", detail: "130+ BPM", color: "#D85A30" },
  { label: "Mid tempo", detail: "90\u2013130 BPM", color: "#7F77DD" },
  { label: "Slow / atmospheric", detail: "under 90 BPM", color: "#3B8BD4" },
];

export default function EnergyLegend({ offsetBottom = 16 }: Props) {
  return (
    <div
      className="fixed left-4 z-20 bg-neutral-900/90 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3 min-w-[180px]"
      style={{ bottom: offsetBottom }}
    >
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-2 font-medium">
        Energy Overlay
      </p>
      <div className="flex flex-col gap-1.5">
        {TIERS.map((tier) => (
          <div key={tier.color} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: tier.color, opacity: 0.8 }}
            />
            <span className="text-xs text-neutral-300">
              {tier.label}
              <span className="text-neutral-500 ml-1">{tier.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
