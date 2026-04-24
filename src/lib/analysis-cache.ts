/*
 * sessionStorage cache for analysis results, timeline, and radar data.
 * Results expire after 2 hours so stale data from a previous session isn't served.
 */

import { AnalysisResult, TasteTimelineEntry, RadarSuggestion } from "./types";

const KEY = "anatomusik_analysis";
const TIMELINE_KEY = "anatomusik_timeline";
const RADAR_KEY = "anatomusik_radar";
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function save<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch { /* quota exceeded or SSR */ }
}

function load<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export const saveAnalysis = (r: AnalysisResult) => save(KEY, r);
export const loadAnalysis = () => load<AnalysisResult>(KEY);

export const saveTimeline = (t: TasteTimelineEntry[]) => save(TIMELINE_KEY, t);
export const loadTimeline = () => load<TasteTimelineEntry[]>(TIMELINE_KEY);

export const saveRadarResults = (r: RadarSuggestion[]) => save(RADAR_KEY, r);
export const loadRadarResults = () => load<RadarSuggestion[]>(RADAR_KEY);
