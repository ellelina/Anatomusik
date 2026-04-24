/*
 * POST /api/tempo/breakdown
 * Receives a track's analysis data plus the user's BPM distribution,
 * returns a Claude-generated plain-English breakdown of why the song feels the way it does.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL, parseJson } from "@/lib/anthropic";

interface BreakdownRequest {
  trackName: string;
  artists: string[];
  genres: string[];
  bpm: number;
  mood: string;
  userDominantZone: string;
  userDominantPercentage: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: BreakdownRequest = await request.json();

    const prompt = `You are explaining to a complete music beginner why a specific song feels the way it does. No jargon. No assumed knowledge. Write like a warm, knowledgeable friend.

Song: "${body.trackName}" by ${body.artists.join(", ")}
Micro-genres: ${body.genres.join(", ")}
BPM: ${body.bpm}
Mood: ${body.mood}
User's dominant tempo zone: ${body.userDominantZone} (${body.userDominantPercentage}% of their library)

Write exactly 4 sections as a JSON object. Each section should be 2-3 sentences max.

{
  "tempoExplained": "Explain the BPM in human terms — not just the number but what pace it corresponds to (walking, jogging, heartbeat, dancing). What does the brain and body recognize this speed as?",
  "grooveFeel": "Identify whether the track feels straight (even, mechanical, metronomic) or swung (loose, bouncy, slightly behind-the-beat). Explain what that does emotionally in plain English. Why does swing feel relaxed? Why does straight feel driving?",
  "anchorInstrument": "Identify the instrument or production element carrying the rhythmic weight. Explain what it's doing and why it matters — what pattern it creates and why the listener's body responds to it. Use sensory language.",
  "whyYouLikeIt": "One sentence connecting this track's tempo and feel to the user's broader listening habits. Reference their dominant zone percentage. Be specific."
}

Rules:
- Every BPM number must be immediately followed by a human comparison
- Every music term must have a plain-English definition in the same sentence
- Be specific to THIS song, not generic
- "Swung" means beats landing slightly late on purpose; "straight" means perfectly even timing`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("Tempo breakdown error:", err);
    return NextResponse.json({ error: "Failed to generate breakdown." }, { status: 500 });
  }
}
