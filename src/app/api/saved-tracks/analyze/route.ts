/*
 * POST /api/saved-tracks/analyze
 * Sends saved tracks to Claude for per-song genre/BPM analysis.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PlaylistTrackDetail, TrackAnalysis } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { tracks } = await request.json() as { tracks: PlaylistTrackDetail[] };

    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ error: "No tracks provided" }, { status: 400 });
    }

    const allAnalyses: TrackAnalysis[] = [];

    for (let i = 0; i < tracks.length; i += 25) {
      const batch = tracks.slice(i, i + 25);
      const analyses = await analyzeBatch(batch);
      allAnalyses.push(...analyses);
    }

    return NextResponse.json({ tracks: allAnalyses });
  } catch (err) {
    console.error("Saved tracks analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze tracks." },
      { status: 500 }
    );
  }
}

async function analyzeBatch(tracks: PlaylistTrackDetail[]): Promise<TrackAnalysis[]> {
  const trackList = tracks
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.tracks || [];
  } catch {
    return [];
  }
}
