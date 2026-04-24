/*
 * POST /api/tempo/instruments
 * Receives user's top micro-genres, returns Claude-generated plain-English
 * explanations of the 4-5 most characteristic instruments/production elements.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL, parseJson } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  try {
    const body: { genres: string[] } = await request.json();

    if (!body.genres || body.genres.length === 0) {
      return NextResponse.json({ error: "No genres provided" }, { status: 400 });
    }

    const prompt = `You are a music educator writing for complete beginners — people who have never read about music theory or production. Your job is to explain what instruments and sounds shape the music they listen to.

The user's top micro-genres are: ${body.genres.join(", ")}

Identify the 4-5 most characteristic instruments or production elements across these genres. For each one, write ONE paragraph (3-4 sentences) in plain English explaining:
- What it sounds like (use sensory comparisons — "deep and woody", "bright and shimmering")
- What it does rhythmically or melodically in the music
- Why it creates the emotional feeling it does
- Which of the user's genres it appears in most

Rules:
- NO technical terminology without an immediate plain-English definition in the same sentence
- Write like a knowledgeable friend explaining something they love
- Be specific — don't say "adds energy", say exactly what kind of energy and how
- Every instrument should feel like a revelation: "oh, THAT'S what that sound is"

Respond with ONLY a JSON object:
{
  "instruments": [
    {
      "instrument": "Name of instrument or production element",
      "description": "Your plain-English paragraph",
      "genres": ["which of the user's genres this appears in"]
    }
  ]
}`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("Tempo instruments error:", err);
    return NextResponse.json({ error: "Failed to generate instruments." }, { status: 500 });
  }
}
