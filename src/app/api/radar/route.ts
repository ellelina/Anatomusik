/*
 * POST /api/radar
 * Takes user's matched micro-genre names, asks Claude for adjacent discovery suggestions.
 * Returns { suggestions: RadarSuggestion[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL, parseJson } from "@/lib/anthropic";
import { SCENE_ENTRIES } from "@/lib/genre-map-data";

export async function POST(request: NextRequest) {
  try {
    const body: { matchedGenres: string[] } = await request.json();

    if (!body.matchedGenres || body.matchedGenres.length === 0) {
      return NextResponse.json(
        { error: "No matched genres provided" },
        { status: 400 }
      );
    }

    const allScenes = SCENE_ENTRIES.map(
      (s) => `${s.name} (${s.region}, lat:${s.lat}, lng:${s.lng}, category:${s.category})`
    ).join("\n");

    const prompt = `Given these micro-genres a user listens to: ${body.matchedGenres.join(", ")}.

Here are all available music scenes on our map:
${allScenes}

Identify 4-5 adjacent micro-genres they likely haven't discovered yet, prioritizing geographic and sonic proximity. Only suggest scenes from the list above that are NOT in the user's matched genres.

Return only JSON: { "suggestions": [{ "name": "exact scene name from list", "region": "exact region from list", "lat": number, "lng": number, "reason": "one sentence explaining sonic/geographic proximity" }] }`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseJson(text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Radar error:", err);
    return NextResponse.json(
      { error: "Failed to generate radar suggestions." },
      { status: 500 }
    );
  }
}
