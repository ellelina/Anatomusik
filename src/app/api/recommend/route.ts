/*
 * POST /api/recommend
 * Takes a song's genres, BPM, mood and returns similar song recommendations from Claude.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RecommendRequest {
  trackName: string;
  artists: string[];
  genres: string[];
  bpm: number;
  mood: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendRequest = await request.json();

    const prompt = `You are a music recommendation engine. A user just clicked on this song:

Song: "${body.trackName}" by ${body.artists.join(", ")}
Micro-genres: ${body.genres.join(", ")}
BPM: ~${body.bpm}
Mood: ${body.mood}

Recommend 10 songs that are the best possible match for this track's micro-genres, BPM, and sonic feel — while also introducing the user to artists they likely haven't heard of.

Respond with ONLY a JSON object (no markdown):

{
  "recommendations": [
    {
      "trackName": "Song Name",
      "artists": ["Artist"],
      "genres": ["micro-genre1"],
      "estimatedBpm": 120,
      "whyMatch": "One sentence explaining the specific sonic or genre similarity"
    }
  ]
}

Rules:
- All 10 songs must be real tracks that exist on Spotify
- Stay within ±15 BPM of ${body.bpm}
- Match the micro-genre feel precisely — not just broad genre. If the song is "vapor soul", don't recommend generic R&B
- Prioritize lesser-known and niche artists. Avoid mainstream/top-40 artists. Dig deep — the more obscure and fitting, the better
- Every recommendation should be a different artist (no repeats)
- Do NOT include the original song or its artist
- Order from most sonically similar to most adventurous (but still matching)
- whyMatch must reference a specific sonic quality, production style, or micro-genre overlap`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse recommendations" }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Recommendation error:", err);
    return NextResponse.json(
      { error: "Failed to generate recommendations." },
      { status: 500 }
    );
  }
}
