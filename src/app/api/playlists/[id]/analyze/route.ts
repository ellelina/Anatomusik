/*
 * POST /api/playlists/:id/analyze
 * Sends playlist tracks to Claude (Haiku) for per-song genre/BPM analysis.
 * Batches of 25 run in parallel for maximum speed.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL, parseJson } from "@/lib/anthropic";
import { PlaylistTrackDetail, TrackAnalysis } from "@/lib/types";

const SYSTEM = `Analyze each song listed. Respond with ONLY a JSON object (no markdown):

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

async function analyzeBatch(tracks: PlaylistTrackDetail[]): Promise<TrackAnalysis[]> {
  const trackList = tracks
    .map((t) => {
      const bpmStr = t.bpm ? `BPM: ${t.bpm}` : "BPM: unknown";
      const genreStr = t.genres?.length ? t.genres.join(", ") : "no genres";
      return `"${t.name}" by ${t.artists.join(", ")} [${genreStr}] [${bpmStr}]`;
    })
    .join("\n");

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `## Songs\n${trackList}` }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    const parsed = parseJson(text);
    return parsed.tracks || [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tracks } = await request.json() as { tracks: PlaylistTrackDetail[]; playlistName: string };

    if (!tracks?.length) {
      return NextResponse.json({ error: "No tracks provided" }, { status: 400 });
    }

    const batches: PlaylistTrackDetail[][] = [];
    for (let i = 0; i < tracks.length; i += 25) batches.push(tracks.slice(i, i + 25));

    const results = await Promise.all(batches.map(analyzeBatch));
    return NextResponse.json({ tracks: results.flat() });
  } catch (err) {
    console.error("Playlist analysis error:", err);
    return NextResponse.json({ error: "Failed to analyze playlist." }, { status: 500 });
  }
}
