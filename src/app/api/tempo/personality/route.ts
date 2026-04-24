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

const SYSTEM = `You are a music insider talking to a curious listener. Be direct, specific, and conversational. No hyphens used as dashes. No parenthetical explanations. No phrases like "think of it like" or "in other words" or "essentially". Never explain what BPM means. Never define music terms — just use them naturally. Each insight should be 2-3 sentences maximum. Lead with the most interesting observation, not the technical fact. Write like a knowledgeable friend texting you about a song, not a music teacher grading an essay.`;

export async function POST(request: NextRequest) {
  try {
    const body: { zones: BpmZone[]; totalTracks: number } = await request.json();

    if (!body.zones || body.zones.length === 0) {
      return NextResponse.json({ error: "No BPM data provided" }, { status: 400 });
    }

    const zoneBreakdown = body.zones
      .map((z) => `${z.zone}: ${z.count} tracks (${z.percentage}%)`)
      .join("\n");

    const prompt = `${SYSTEM}

BPM distribution across ${body.totalTracks} recently played tracks:
${zoneBreakdown}

Write exactly 3 sentences about what this tempo profile says about this listener. Be specific to their actual distribution — don't be generic. Lead with what's most revealing.

Respond with ONLY a JSON object: { "paragraph": "your 3 sentences here" }`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json(parseJson(text));
  } catch (err) {
    console.error("Tempo personality error:", err);
    return NextResponse.json({ error: "Failed to generate personality." }, { status: 500 });
  }
}
