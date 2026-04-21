/*
 * POST /api/analyze
 * Receives aggregated Spotify data and sends it to Claude for micro-genre analysis.
 * Returns structured AnalysisResult JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeListeningHistory } from "@/lib/anthropic";
import { SpotifyData } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const data: SpotifyData = await request.json();

    if (!data.allGenres || !data.uniqueArtists) {
      return NextResponse.json(
        { error: "Invalid Spotify data format" },
        { status: 400 }
      );
    }

    const analysis = await analyzeListeningHistory(data);
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze listening data. Please try again." },
      { status: 500 }
    );
  }
}
