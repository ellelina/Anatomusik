/*
 * POST /api/playlists/:id/analyze
 * Sends playlist tracks to Claude for per-song genre/BPM analysis.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PlaylistTrackDetail, TrackAnalysis } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { tracks, playlistName } = await request.json() as {
      tracks: PlaylistTrackDetail[];
      playlistName: string;
    };

    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ error: "No tracks provided" }, { status: 400 });
    }

    // Process in batches of 30 to stay within token limits
    const allAnalyses: TrackAnalysis[] = [];
    const batchSize = 30;

    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      const analyses = await analyzeBatch(batch, playlistName);
      allAnalyses.push(...analyses);
    }

    return NextResponse.json({ tracks: allAnalyses });
  } catch (err) {
    console.error("Playlist analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze playlist." },
      { status: 500 }
    );
  }
}

async function analyzeBatch(
  tracks: PlaylistTrackDetail[],
  playlistName: string
): Promise<TrackAnalysis[]> {
  const trackList = tracks
    .map((t) => {
      const bpmStr = t.bpm ? `BPM: ${t.bpm}` : "BPM: unknown";
      const genres = t.genres || [];
      const genreStr = genres.length > 0 ? genres.join(", ") : "no genres listed";
      return `"${t.name}" by ${t.artists.join(", ")} [${genreStr}] [${bpmStr}]`;
    })
    .join("\n");

  const prompt = `You are a music analyst. Analyze each song from the playlist "${playlistName}".

## Tracks
${trackList}

Respond with ONLY a JSON object (no markdown):

{
  "tracks": [
    {
      "trackName": "Exact song name",
      "artists": ["Artist1"],
      "genres": ["specific micro-genre 1", "specific micro-genre 2"],
      "estimatedBpm": 120,
      "mood": "2-4 word mood descriptor"
    }
  ]
}

Guidelines:
- Include ALL tracks listed above, in the same order
- Identify 1-3 specific micro-genres per track (not just "pop" — be specific like "bedroom pop", "trap soul", "post-punk revival")
- If BPM is "unknown", estimate based on your knowledge of the song
- If BPM is already known, use that exact value for estimatedBpm
- Keep mood descriptors evocative and specific`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.tracks || [];
}
