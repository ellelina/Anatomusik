/*
 * Shared analysis context — streams GET /api/analyze which emits two SSE events:
 *   1. "spotify" → recentTrackDetails available, stage → "analyzing"
 *   2. "analysis" → full AnalysisResult available, stage → "done"
 * This lets the dashboard show the track list within ~4s while Claude
 * continues in the background for another 8-15s.
 * Usage: wrap authenticated pages in <AnalysisProvider>, consume via useAnalysis()
 */

"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { AnalysisResult, RecentTrackDetail } from "./types";
import { saveAnalysis, loadAnalysis } from "./analysis-cache";

export type Stage = "idle" | "loading-spotify" | "analyzing" | "done" | "error";

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
    const cached = loadAnalysis();
    if (cached) {
      setResult(cached);
      setStage("done");
      return;
    }

    setStage("loading-spotify");
    setError("");

    try {
      const res = await fetch("/api/analyze");

      // Non-200 before streaming starts (e.g. 401)
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newline
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6));

          if (payload.type === "spotify") {
            // Spotify done — show track details immediately, keep loading genre analysis
            setTrackDetails(payload.recentTrackDetails || []);
            setStage("analyzing");
          } else if (payload.type === "analysis") {
            setResult(payload.analysis);
            saveAnalysis(payload.analysis);
            setStage("done");
          } else if (payload.type === "error") {
            throw new Error(payload.error);
          }
        }
      }
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
