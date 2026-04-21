/*
 * POST /api/search/analyze
 * Analyzes a single track with Claude to determine micro-genres, BPM, and mood.
 * Body: { id, name, artists, genres }
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeTrack } from "@/lib/anthropic";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export async function POST(request: NextRequest) {
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, artists, genres } = body;

  if (!name || !artists) {
    return NextResponse.json({ error: "Missing track data." }, { status: 400 });
  }

  // Try to fetch BPM from audio features (silent fail)
  let bpm: number | null = null;
  if (id) {
    try {
      const res = await fetch(
        `${SPOTIFY_API_BASE}/audio-features?ids=${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const feature = data.audio_features?.[0];
        if (feature?.tempo) {
          bpm = Math.round(feature.tempo);
        }
      }
    } catch {
      // Audio features may be restricted
    }
  }

  try {
    const track = await analyzeTrack(name, artists, genres || [], bpm);
    return NextResponse.json({ track });
  } catch {
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}
