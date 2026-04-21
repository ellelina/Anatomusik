/*
 * sessionStorage cache for analysis results, timeline, and radar data.
 * Allows the map page to read cached results without re-running Claude.
 */

import { AnalysisResult, TasteTimelineEntry, RadarSuggestion } from "./types";

const KEY = "anatomusik_analysis";
const TIMELINE_KEY = "anatomusik_timeline";
const RADAR_KEY = "anatomusik_radar";

export function saveAnalysis(result: AnalysisResult): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(result));
  } catch { /* quota exceeded or SSR */ }
}

export function loadAnalysis(): AnalysisResult | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AnalysisResult) : null;
  } catch {
    return null;
  }
}

export function saveTimeline(timeline: TasteTimelineEntry[]): void {
  try {
    sessionStorage.setItem(TIMELINE_KEY, JSON.stringify(timeline));
  } catch { /* quota exceeded or SSR */ }
}

export function loadTimeline(): TasteTimelineEntry[] | null {
  try {
    const raw = sessionStorage.getItem(TIMELINE_KEY);
    return raw ? (JSON.parse(raw) as TasteTimelineEntry[]) : null;
  } catch {
    return null;
  }
}

export function saveRadarResults(results: RadarSuggestion[]): void {
  try {
    sessionStorage.setItem(RADAR_KEY, JSON.stringify(results));
  } catch { /* quota exceeded or SSR */ }
}

export function loadRadarResults(): RadarSuggestion[] | null {
  try {
    const raw = sessionStorage.getItem(RADAR_KEY);
    return raw ? (JSON.parse(raw) as RadarSuggestion[]) : null;
  } catch {
    return null;
  }
}
