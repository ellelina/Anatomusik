/*
 * Shareable profile card page — /share
 * Renders a styled music DNA card and lets users download it as a PNG.
 * Uses html-to-image's toPng() to capture the card div.
 */

"use client";

import { useRef } from "react";
import { toPng } from "html-to-image";
import { useAnalysis } from "@/lib/AnalysisContext";
import AppNav from "@/components/AppNav";

export default function SharePage() {
  const { result, stage } = useAnalysis();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!cardRef.current) return;
    toPng(cardRef.current, { cacheBust: true }).then((dataUrl) => {
      const link = document.createElement("a");
      link.download = "anatomusik-profile.png";
      link.href = dataUrl;
      link.click();
    });
  };

  const isLoading = stage !== "done" && stage !== "error";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <AppNav />

      <h1
        className="text-2xl font-bold mb-1"
        style={{
          fontFamily: "var(--font-orbitron), sans-serif",
          background: "linear-gradient(135deg, #e8f0ff 0%, #c8d8ff 50%, #a0b8ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Share
      </h1>
      <p className="text-sm mb-8" style={{ color: "rgba(180,200,255,0.5)" }}>
        Share your music DNA
      </p>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin" />
          <p className="text-sm" style={{ color: "rgba(180,200,255,0.5)" }}>
            Loading your profile...
          </p>
        </div>
      ) : !result ? (
        <p className="text-sm" style={{ color: "rgba(180,200,255,0.4)" }}>
          No analysis data. Visit the dashboard first.
        </p>
      ) : (
        <>
          {/* Profile card — captured by html-to-image */}
          <div
            ref={cardRef}
            style={{
              background: "#09071a",
              borderRadius: "16px",
              padding: "32px",
              width: "480px",
              maxWidth: "100%",
              border: "1px solid rgba(180,200,255,0.1)",
              boxSizing: "border-box",
            }}
          >
            {/* Logo */}
            <p
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontSize: "11px",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                background: "linear-gradient(135deg, #e8f0ff 0%, #c8d8ff 50%, #a0b8ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginBottom: "20px",
              }}
            >
              ANATOMUSIK
            </p>

            {/* Top micro-genre pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "18px" }}>
              {result.microGenres.slice(0, 3).map((g, i) => {
                const colors = [
                  { bg: "rgba(100,140,255,0.2)", border: "rgba(100,140,255,0.4)", text: "#a0b8ff" },
                  { bg: "rgba(160,100,255,0.2)", border: "rgba(160,100,255,0.4)", text: "#c8a8ff" },
                  { bg: "rgba(80,200,200,0.15)", border: "rgba(80,200,200,0.35)", text: "#80e0e0" },
                ];
                const c = colors[i % colors.length];
                return (
                  <span
                    key={g.name}
                    style={{
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      color: c.text,
                      borderRadius: "9999px",
                      padding: "6px 14px",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {g.name}
                  </span>
                );
              })}
            </div>

            {/* Music personality paragraph */}
            <p
              style={{
                color: "rgba(180,200,255,0.7)",
                fontSize: "13px",
                lineHeight: 1.65,
                marginBottom: "20px",
              }}
            >
              {result.musicPersonality}
            </p>

            {/* Representative artists chips */}
            {(() => {
              const allArtists = result.microGenres.flatMap((g) => g.representativeArtists);
              const unique = Array.from(new Set(allArtists)).slice(0, 6);
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "24px" }}>
                  {unique.map((a) => (
                    <span
                      key={a}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(180,200,255,0.6)",
                        borderRadius: "9999px",
                        padding: "3px 10px",
                        fontSize: "11px",
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              );
            })()}

            {/* Watermark */}
            <p
              style={{
                color: "rgba(180,200,255,0.2)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                textAlign: "right",
              }}
            >
              anatomusik.app
            </p>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="mt-6 px-6 py-3 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
            style={{
              background: "linear-gradient(135deg, rgba(100,140,255,0.25) 0%, rgba(160,100,255,0.25) 100%)",
              border: "1px solid rgba(180,200,255,0.2)",
              color: "rgba(180,200,255,0.9)",
            }}
          >
            Download as Image
          </button>
        </>
      )}
    </div>
  );
}
