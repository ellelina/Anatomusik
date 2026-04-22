/*
 * Dashboard page — fetches Spotify data, sends it to Claude for analysis,
 * and displays the micro-genre results including per-song breakdown.
 * Access: /dashboard (redirected here after Spotify OAuth)
 */

"use client";

import AnalysisResults from "@/components/AnalysisResults";
import AppNav from "@/components/AppNav";
import { useAnalysis } from "@/lib/AnalysisContext";

export default function DashboardPage() {
  const { stage, result, trackDetails, error } = useAnalysis();

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <AppNav />

      {stage === "loading-spotify" && (
        <LoadingState
          title="Fetching your Spotify data..."
          subtitle="Pulling your top artists, tracks, and recently played"
        />
      )}

      {stage === "analyzing" && (
        <LoadingState
          title="Analyzing your taste with AI..."
          subtitle="Identifying micro-genres, BPM, and per-song patterns"
        />
      )}

      {stage === "error" && (
        <div className="text-center py-20">
          <p className="text-red-400 text-lg font-medium mb-2">Something went wrong</p>
          <p className="text-neutral-500 mb-6">{error}</p>
          <a
            href="/api/auth/login"
            className="inline-block bg-white/10 hover:bg-white/15 text-white px-6 py-2 rounded-full text-sm transition-colors"
          >
            Try again
          </a>
        </div>
      )}

      {stage === "done" && result && (
        <AnalysisResults result={result} trackDetails={trackDetails} />
      )}
    </main>
  );
}

function LoadingState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center py-20">
      <div className="inline-block w-10 h-10 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin mb-6" />
      <p className="text-lg font-medium text-white mb-1">{title}</p>
      <p className="text-sm text-neutral-500">{subtitle}</p>
    </div>
  );
}
