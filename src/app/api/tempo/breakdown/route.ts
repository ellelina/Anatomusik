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

const SYSTEM = `You are a music insider talking to a curious listener. Be direct, specific, and conversational. No hyphens used as dashes. No parenthetical explanations. No phrases like "think of it like" or "in other words" or "essentially". Never explain what BPM means. Never define music terms — just use them naturally. Each insight should be 2-3 sentences maximum. Lead with the most interesting observation, not the technical fact. Write like a knowledgeable friend texting you about a song, not a music teacher grading an essay.`;

export async function POST(request: NextRequest) {
  try {
    const body: BreakdownRequest = await request.json();

    const prompt = `${SYSTEM}

Song: "${body.trackName}" by ${body.artists.join(", ")}
Micro-genres: ${body.genres.join(", ")}
BPM: ${body.bpm}
Mood: ${body.mood}
User's dominant tempo zone: ${body.userDominantZone} (${body.userDominantPercentage}% of their library)

Write 4 short sections about this specific track. Each section is 2-3 sentences max. Be specific to THIS song.

{
  "tempoExplained": "What the speed of this track actually feels like and why it works for this song.",
  "grooveFeel": "Whether it feels tight and mechanical or loose and swung, and what that does to the listener.",
  "anchorInstrument": "The instrument or production element carrying the rhythmic weight, and why the body responds to it.",
  "whyYouLikeIt": "One sentence connecting this track to the user's dominant tempo zone (${body.userDominantPercentage}% of their library)."
}

Respond with ONLY that JSON object.`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("Tempo breakdown error:", err);
    return NextResponse.json({ error: "Failed to generate breakdown." }, { status: 500 });
  }
}
