/*
 * Shared analysis context — fetches Spotify data + Claude analysis once,
 * caches in memory and sessionStorage, shares across all pages.
 * Eliminates duplicate API calls when navigating between tabs.
 * Usage: wrap authenticated pages in <AnalysisProvider>, consume via useAnalysis()
 */

"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { SpotifyData, AnalysisResult, RecentTrackDetail } from "./types";
import { saveAnalysis, loadAnalysis } from "./analysis-cache";

type Stage = "idle" | "loading-spotify" | "analyzing" | "done" | "error";

interface AnalysisContextValue {
  stage: Stage;
  result: AnalysisResult | null;
  trackDetails: RecentTrackDetail[];
  error: string;
  refetch: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue>({
  stage: "idle",
  result: null,
  trackDetails: [],
  error: "",
  refetch: () => {},
});

export function useAnalysis() {
  return useContext(AnalysisContext);
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [trackDetails, setTrackDetails] = useState<RecentTrackDetail[]>([]);
  const [error, setError] = useState("");

  const fetchAnalysis = useCallback(async () => {
    // Check sessionStorage cache first
    const cached = loadAnalysis();
    if (cached) {
      setResult(cached);
      setStage("done");
      return;
    }

    try {
      setStage("loading-spotify");
      const spotifyRes = await fetch("/api/spotify/data");
      if (!spotifyRes.ok) {
        const err = await spotifyRes.json();
        throw new Error(err.error || "Failed to fetch Spotify data");
      }
      const spotifyData: SpotifyData = await spotifyRes.json();
      setTrackDetails(spotifyData.recentTrackDetails || []);

      setStage("analyzing");
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(spotifyData),
      });
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json();
        throw new Error(err.error || "Analysis failed");
      }
      const analysis: AnalysisResult = await analyzeRes.json();

      setResult(analysis);
      saveAnalysis(analysis);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  return (
    <AnalysisContext.Provider value={{ stage, result, trackDetails, error, refetch: fetchAnalysis }}>
      {children}
    </AnalysisContext.Provider>
  );
}
