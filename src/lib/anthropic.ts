/*
 * Anthropic API helper.
 * Exports: client, MODEL, parseJson — shared by all API routes.
 * Uses two parallel Claude calls:
 *   1. Overall taste profile (micro-genres, personality, insights)
 *   2. Per-song analysis for recently played — batches run in parallel
 * Prompt caching on stable system instructions reduces latency on repeat calls.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SpotifyData, AnalysisResult, TrackAnalysis } from "./types";
import { SCENE_ENTRIES } from "./genre-map-data";

export const MODEL = "claude-sonnet-4-20250514";
export const HAIKU_MODEL = "claude-haiku-4-5-20251001"; // fast model for structured extraction tasks
export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function parseJson(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse JSON from Claude response");
  return JSON.parse(jsonMatch[0]);
}

// Stable system instructions — cached across calls
const mapGenreNames = SCENE_ENTRIES.map((e) => e.name).join(", ");

const PROFILE_SYSTEM = `You are a music taste analyst specializing in micro-genres and niche listening patterns.

Respond with ONLY a JSON object (no markdown):

{
  "musicPersonality": "2-3 sentences of precise, factual taste analysis. State the dominant genre clusters, any notable listening patterns or cross-genre tensions in the data, and what that implies about how this person uses music. No metaphors, no flattery, no narrative framing — just accurate description.",
  "microGenres": [
    {
      "name": "Micro-genre name",
      "description": "What this micro-genre sounds like and why it fits this listener",
      "confidence": "high|medium|low",
      "representativeArtists": ["Artist1", "Artist2"]
    }
  ],
  "uniqueInsights": ["One specific, verifiable observation about this listener's data — an unusual genre pairing, a temporal shift, an outlier artist, or a pattern that distinguishes them. One sentence, no hyperbole."],
  "summary": "2-3 sentences summarizing the key genre findings and any notable divergence between short-term and medium-term listening. Factual and specific — name actual genres and patterns, no embellishment.",
  "matchedMapGenres": ["exact scene name from the list"]
}

Guidelines:
- Identify 4-8 micro-genres (go beyond Spotify's broad labels — think sub-sub-genres)
- 3-5 unique insights
- Be specific and creative with micro-genre names
- Reference actual artists from their data
- matchedMapGenres: From this exact list of global music scenes: ${mapGenreNames}
  Pick 0-6 scene names that best match this listener's taste. Only use names from this list verbatim.`;

const TRACK_BATCH_SYSTEM = `Analyze each song listed. Respond with ONLY a JSON object (no markdown):

{
  "tracks": [
    {
      "trackName": "Exact song name",
      "artists": ["Artist1"],
      "genres": ["micro-genre1", "micro-genre2"],
      "estimatedBpm": 120,
      "mood": "2-4 word mood descriptor"
    }
  ]
}

Rules:
- Include ALL songs listed in order
- 1-3 specific micro-genres per track (not "pop" — say "bedroom pop", "trap soul", etc.)
- If BPM unknown, estimate it. If known, use that value.
- Mood: evocative, specific (e.g. "melancholic night drive", "euphoric rush")`;

const SINGLE_TRACK_SYSTEM = `Analyze a single song. Respond with ONLY a JSON object (no markdown):

{
  "trackName": "Exact song name",
  "artists": ["Artist1"],
  "genres": ["micro-genre1", "micro-genre2"],
  "estimatedBpm": 120,
  "mood": "2-4 word mood descriptor"
}

Rules:
- 1-3 specific micro-genres (not "pop" — say "bedroom pop", "trap soul", etc.)
- If BPM unknown, estimate it. If known, use that value.
- Mood: evocative, specific (e.g. "melancholic night drive", "euphoric rush")`;

export async function analyzeListeningHistory(
  data: SpotifyData
): Promise<AnalysisResult> {
  const [profile, tracks] = await Promise.all([
    analyzeProfile(data),
    analyzeRecentTracks(data),
  ]);
  return { ...profile, trackAnalyses: tracks };
}

async function analyzeProfile(data: SpotifyData): Promise<Omit<AnalysisResult, "trackAnalyses">> {
  const artistSummaries = data.topArtistsMedium
    .slice(0, 30)
    .map((a) => `${a.name} (genres: ${(a.genres || []).join(", ") || "none listed"})`)
    .join("\n");

  const recentArtistSummaries = data.topArtistsShort
    .slice(0, 20)
    .map((a) => `${a.name} (genres: ${(a.genres || []).join(", ") || "none listed"})`)
    .join("\n");

  const topTrackNames = data.topTracksMedium
    .slice(0, 25)
    .map((t) => `"${t.name}" by ${t.artists.map((a) => a.name).join(", ")}`)
    .join("\n");

  const userContent = `## Top Artists (Medium-term, ~6 months)
${artistSummaries}

## Recent Top Artists (Short-term, ~4 weeks)
${recentArtistSummaries}

## Top Tracks (Medium-term)
${topTrackNames}

## All Spotify Genre Tags
${data.allGenres.join(", ")}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: PROFILE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJson(text);
}

export async function analyzeTrack(
  name: string,
  artists: string[],
  genres: string[],
  bpm: number | null
): Promise<TrackAnalysis> {
  const bpmStr = bpm ? `BPM: ${bpm}` : "BPM: unknown";
  const genreStr = genres.length > 0 ? genres.join(", ") : "no genres listed";

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 350,
    system: [{ type: "text", text: SINGLE_TRACK_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `"${name}" by ${artists.join(", ")} [${genreStr}] [${bpmStr}]` }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJson(text);
}

async function analyzeRecentTracks(data: SpotifyData): Promise<TrackAnalysis[]> {
  const tracks = data.recentTrackDetails || [];
  if (tracks.length === 0) return [];

  const batches: (typeof tracks)[] = [];
  for (let i = 0; i < tracks.length; i += 25) {
    batches.push(tracks.slice(i, i + 25));
  }

  // All batches run in parallel — each hits the cached system prompt
  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const trackList = batch
        .map((t) => {
          const bpmStr = t.bpm ? `BPM: ${t.bpm}` : "BPM: unknown";
          const genres = t.genres || [];
          const genreStr = genres.length > 0 ? genres.join(", ") : "no genres";
          return `"${t.name}" by ${t.artists.join(", ")} [${genreStr}] [${bpmStr}]`;
        })
        .join("\n");

      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2000,
        system: [{ type: "text", text: TRACK_BATCH_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: `## Songs\n${trackList}` }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      try {
        const parsed = parseJson(text);
        return (parsed.tracks || []) as TrackAnalysis[];
      } catch {
        return [];
      }
    })
  );

  return batchResults.flat();
}
