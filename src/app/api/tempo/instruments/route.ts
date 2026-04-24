/*
 * POST /api/tempo/instruments
 * Receives user's top micro-genres, returns Claude-generated plain-English
 * explanations of the 4-5 most characteristic instruments/production elements.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL, parseJson } from "@/lib/anthropic";

const SYSTEM = `You are a music insider talking to a curious listener. Be direct, specific, and conversational. No hyphens used as dashes. No parenthetical explanations. No phrases like "think of it like" or "in other words" or "essentially". Never explain what BPM means. Never define music terms — just use them naturally. Each insight should be 2-3 sentences maximum. Lead with the most interesting observation, not the technical fact. Write like a knowledgeable friend texting you about a song, not a music teacher grading an essay.`;

export async function POST(request: NextRequest) {
  try {
    const body: { genres: string[] } = await request.json();

    if (!body.genres || body.genres.length === 0) {
      return NextResponse.json({ error: "No genres provided" }, { status: 400 });
    }

    const prompt = `${SYSTEM}

The user's top micro-genres are: ${body.genres.join(", ")}

Identify the 4-5 most characteristic instruments or production elements across these genres. For each one, write 2-3 sentences that make the listener go "oh, THAT'S what that sound is." Lead with the most interesting thing about it, not a textbook definition.

Respond with ONLY a JSON object:
{
  "instruments": [
    {
      "instrument": "Name of instrument or production element",
      "description": "2-3 sentences",
      "genres": ["which of the user's genres this appears in"]
    }
  ]
}`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("Tempo instruments error:", err);
    return NextResponse.json({ error: "Failed to generate instruments." }, { status: 500 });
  }
}
