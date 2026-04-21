/*
 * GET /api/saved-tracks?offset=0&limit=50
 * Returns the user's saved/liked tracks with genre and BPM data.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchSavedTracks } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

  try {
    const data = await fetchSavedTracks(accessToken, offset, limit);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Saved tracks fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch saved tracks." },
      { status: 500 }
    );
  }
}
