/*
 * POST /api/saved-tracks/profile
 * Body: { tracks: PlaylistTrackDetail[], pageLabel?: string }
 * Returns: { musicPersonality: string, microGenres: MicroGenre[], summary: string }
 *
 * Asks Claude to identify 2-4 micro-genres for a batch of liked songs and
 * generate a short personality + summary for that collection.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL, parseJson } from "@/lib/anthropic";
import { PlaylistTrackDetail, MicroGenre } from "@/lib/types";

const PROFILE_SYSTEM = `You are a music taste analyst. Given a list of liked songs, identify the micro-genre profile of this collection.

Respond with ONLY a JSON object (no markdown):

{
  "musicPersonality": "1-2 sentences describing the taste profile of this specific song collection. Be specific — name genres, moods, or patterns you observe.",
  "microGenres": [
    {
      "name": "Micro-genre name",
      "description": "What this micro-genre sounds like and why it fits",
      "confidence": "high|medium|low",
      "representativeArtists": ["Artist1", "Artist2"]
    }
  ],
  "summary": "1 sentence summarizing the overall vibe of this collection."
}

Rules:
- Identify 2-4 micro-genres (specific sub-genres, not broad labels like "pop")
- Keep personality and summary factual and concise`;

interface RequestBody {
  tracks: PlaylistTrackDetail[];
  pageLabel?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { tracks, pageLabel } = body;

    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ error: "No tracks provided" }, { status: 400 });
    }

    const trackList = tracks
      .slice(0, 50)
      .map((t) => {
        const genreStr = t.genres?.length ? t.genres.join(", ") : "no genres";
        return `"${t.name}" by ${(t.artists || []).join(", ")} [${genreStr}]`;
      })
      .join("\n");

    const userContent = pageLabel
      ? `## Liked Songs — ${pageLabel}\n\n${trackList}`
      : `## Liked Songs\n\n${trackList}`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 650,
      system: [{ type: "text", text: PROFILE_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseJson(text) as {
      musicPersonality: string;
      microGenres: MicroGenre[];
      summary: string;
    };

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[saved-tracks/profile]", err);
    return NextResponse.json({ error: "Profile generation failed" }, { status: 500 });
  }
}
