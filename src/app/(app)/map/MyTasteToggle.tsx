"use client";

interface Props {
  myTasteMode: boolean;
  onToggle: () => void;
}

export default function MyTasteToggle({ myTasteMode, onToggle }: Props) {
  return (
    <div className="fixed top-[60px] right-4 z-20">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
          myTasteMode
            ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
            : "bg-white/5 border-white/15 text-neutral-400"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            myTasteMode ? "bg-cyan-400" : "bg-neutral-600"
          }`}
        />
        {myTasteMode ? "My taste" : "Global"}
      </button>
    </div>
  );
}
