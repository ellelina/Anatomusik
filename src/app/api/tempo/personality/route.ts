/*
 * POST /api/tempo/personality
 * Receives BPM distribution data, returns a Claude-generated plain-English paragraph
 * explaining what the user's tempo preferences reveal about them.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL, parseJson } from "@/lib/anthropic";

interface BpmZone {
  zone: string;
  count: number;
  percentage: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: { zones: BpmZone[]; totalTracks: number } = await request.json();

    if (!body.zones || body.zones.length === 0) {
      return NextResponse.json({ error: "No BPM data provided" }, { status: 400 });
    }

    const zoneBreakdown = body.zones
      .map((z) => `${z.zone}: ${z.count} tracks (${z.percentage}%)`)
      .join("\n");

    const prompt = `You are explaining a music listener's tempo preferences to someone with ZERO music theory knowledge. Be warm, conversational, and specific. No jargon.

Here is their BPM (beats per minute — how fast the music moves) distribution across ${body.totalTracks} recently played tracks:

${zoneBreakdown}

Write exactly 3 sentences in plain English:
1. What this distribution says about them emotionally — why they might gravitate to this tempo range
2. What this tempo typically feels like in the body (walking pace, heartbeat, dancing, etc.)
3. What genres and styles of music tend to live in their dominant tempo zone

Rules:
- Every time you mention a BPM number, immediately follow it with a human comparison (walking speed, heartbeat, etc.)
- Never use music theory terms without a one-clause plain definition right after
- Write like a knowledgeable friend, not a textbook
- Be specific to THEIR distribution, not generic

Respond with ONLY a JSON object: { "paragraph": "your 3 sentences here" }`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 350,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("Tempo personality error:", err);
    return NextResponse.json({ error: "Failed to generate personality." }, { status: 500 });
  }
}
