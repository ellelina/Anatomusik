"use client";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export default function ZoomControls({ onZoomIn, onZoomOut }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-20 flex flex-col gap-2">
      <button
        onClick={onZoomIn}
        className="w-9 h-9 rounded-full bg-white/10 border border-white/15 text-white text-lg hover:bg-white/20 transition-colors flex items-center justify-center"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        className="w-9 h-9 rounded-full bg-white/10 border border-white/15 text-white text-lg hover:bg-white/20 transition-colors flex items-center justify-center"
      >
        &minus;
      </button>
    </div>
  );
}
