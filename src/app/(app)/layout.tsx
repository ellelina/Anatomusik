/*
 * Shared layout for authenticated pages.
 * Wraps all post-auth routes in AnalysisProvider so Spotify data
 * is fetched once and shared across dashboard, map, tempo, etc.
 */

"use client";

import { AnalysisProvider } from "@/lib/AnalysisContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AnalysisProvider>
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(ellipse at 50% 30%, #09071a 0%, #05040f 100%)" }}
      >
        {/* Subtle purple atmospheric bloom */}
        <div
          className="fixed pointer-events-none"
          style={{
            width: "800px",
            height: "400px",
            top: "0",
            left: "50%",
            transform: "translateX(-50%)",
            background: "radial-gradient(ellipse at 50% 0%, rgba(60,40,160,0.12) 0%, transparent 70%)",
            filter: "blur(60px)",
            zIndex: 0,
          }}
        />
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </div>
    </AnalysisProvider>
  );
}
