/*
 * POST /api/playlists/profile
 * Given a set of playlist tracks, returns a micro-genre profile for that collection.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL, parseJson } from "@/lib/anthropic";
import { PlaylistTrackDetail } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body: { tracks: PlaylistTrackDetail[]; playlistName?: string } = await request.json();

    if (!body.tracks?.length) {
      return NextResponse.json({ error: "No tracks provided." }, { status: 400 });
    }

    const trackList = body.tracks
      .slice(0, 50)
      .map((t) => `"${t.name}" by ${t.artists.join(", ")} [${t.genres.slice(0, 3).join(", ") || "no genres"}]`)
      .join("\n");

    const label = body.playlistName ? `the playlist "${body.playlistName}"` : "this playlist";

    const prompt = `Analyze ${label} and identify its sonic identity. Here are the tracks:

${trackList}

Return ONLY a JSON object:
{
  "musicPersonality": "1-2 sentences describing the mood, energy, and sonic character of this collection. Be specific and evocative.",
  "microGenres": [
    { "name": "genre name", "description": "1 sentence", "confidence": "high|medium|low", "representativeArtists": ["Artist"] }
  ],
  "summary": "One sentence capturing what makes this playlist distinctive."
}

Rules:
- 2-4 micro-genres max
- Reference actual artists from the track list
- Be specific, not generic ("euphoric techno at 130+ BPM" not just "electronic")`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 650,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("Playlist profile error:", err);
    return NextResponse.json({ error: "Failed to generate playlist profile." }, { status: 500 });
  }
}
