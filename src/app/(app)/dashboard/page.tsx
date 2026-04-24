/*
 * Dashboard page — fetches Spotify data, sends it to Claude for analysis,
 * and displays the micro-genre results including per-song breakdown.
 * Access: /dashboard (redirected here after Spotify OAuth)
 */

"use client";

import AnalysisResults from "@/components/AnalysisResults";
import AppNav from "@/components/AppNav";
import { GenreCardSkeleton } from "@/components/SkeletonLoader";
import { useAnalysis } from "@/lib/AnalysisContext";

export default function DashboardPage() {
  const { stage, result, trackDetails, error } = useAnalysis();

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <AppNav />

      {stage === "loading-spotify" && <GenreGridSkeleton />}

      {stage === "analyzing" && <GenreGridSkeleton />}

      {stage === "error" && (
        <div className="text-center py-20">
          <p className="text-red-400 text-lg font-medium mb-3">
            {error || "Something went wrong"}
          </p>
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

function GenreGridSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GenreCardSkeleton />
        <GenreCardSkeleton />
        <GenreCardSkeleton />
        <GenreCardSkeleton />
      </div>
    </div>
  );
}
