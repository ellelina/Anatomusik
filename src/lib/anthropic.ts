/*
 * Anthropic API helper.
 * Uses two separate Claude calls:
 *   1. Overall taste profile (micro-genres, personality, niche score)
 *   2. Per-song analysis for recently played (genres, BPM, mood)
 */

import Anthropic from "@anthropic-ai/sdk";
import { SpotifyData, AnalysisResult, TrackAnalysis } from "./types";
import { SCENE_ENTRIES } from "./genre-map-data";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseJson(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse JSON from Claude response");
  return JSON.parse(jsonMatch[0]);
}

export async function analyzeListeningHistory(
  data: SpotifyData
): Promise<AnalysisResult> {
  // Run both calls in parallel
  const [profile, tracks] = await Promise.all([
    analyzeProfile(data),
    analyzeRecentTracks(data),
  ]);

  return { ...profile, trackAnalyses: tracks };
}

// Call 1: Overall taste profile
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

  const mapGenreNames = SCENE_ENTRIES.map(e => e.name).join(", ");

  const prompt = `You are a music taste analyst specializing in micro-genres and niche listening patterns.

## Top Artists (Medium-term, ~6 months)
${artistSummaries}

## Recent Top Artists (Short-term, ~4 weeks)
${recentArtistSummaries}

## Top Tracks (Medium-term)
${topTrackNames}

## All Spotify Genre Tags
${data.allGenres.join(", ")}

---

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
- nicheScore 1-100 (100 = extremely niche)
- 3-5 unique insights
- Be specific and creative with micro-genre names
- Reference actual artists from their data
- matchedMapGenres: From this exact list of global music scenes: ${mapGenreNames}
  Pick 0-6 scene names that best match this listener's taste. Only use names from this list verbatim.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJson(text);
}

// Single-track analysis for search feature
export async function analyzeTrack(
  name: string,
  artists: string[],
  genres: string[],
  bpm: number | null
): Promise<TrackAnalysis> {
  const bpmStr = bpm ? `BPM: ${bpm}` : "BPM: unknown";
  const genreStr = genres.length > 0 ? genres.join(", ") : "no genres listed";

  const prompt = `Analyze this single song. Respond with ONLY a JSON object (no markdown):

"${name}" by ${artists.join(", ")} [${genreStr}] [${bpmStr}]

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

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return parseJson(text);
}

// Call 2: Per-song analysis for recently played
async function analyzeRecentTracks(data: SpotifyData): Promise<TrackAnalysis[]> {
  const tracks = data.recentTrackDetails || [];
  if (tracks.length === 0) return [];

  // Process in batches of 25
  const allAnalyses: TrackAnalysis[] = [];
  for (let i = 0; i < tracks.length; i += 25) {
    const batch = tracks.slice(i, i + 25);

    const trackList = batch
      .map((t) => {
        const bpmStr = t.bpm ? `BPM: ${t.bpm}` : "BPM: unknown";
        const genres = t.genres || [];
        const genreStr = genres.length > 0 ? genres.join(", ") : "no genres";
        return `"${t.name}" by ${t.artists.join(", ")} [${genreStr}] [${bpmStr}]`;
      })
      .join("\n");

    const prompt = `Analyze each song. Respond with ONLY a JSON object (no markdown):

## Songs
${trackList}

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
- Include ALL songs listed above in order
- 1-3 specific micro-genres per track (not "pop" — say "bedroom pop", "trap soul", etc.)
- If BPM unknown, estimate it. If known, use that value.
- Mood: evocative, specific (e.g. "melancholic night drive", "euphoric rush")`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const parsed = parseJson(text);
      allAnalyses.push(...(parsed.tracks || []));
    } catch {
      // Skip this batch if parsing fails
    }
  }

  return allAnalyses;
}
