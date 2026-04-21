/*
 * Shared layout for authenticated pages.
 * Wraps all post-auth routes in AnalysisProvider so Spotify data
 * is fetched once and shared across dashboard, map, tempo, etc.
 */

"use client";

import { AnalysisProvider } from "@/lib/AnalysisContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AnalysisProvider>{children}</AnalysisProvider>;
}
