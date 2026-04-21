/*
 * GET /api/spotify/data
 * Fetches the authenticated user's Spotify listening data.
 * Requires a valid spotify_access_token cookie.
 * Returns aggregated SpotifyData JSON.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchUserData } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Not authenticated. Please log in with Spotify." },
      { status: 401 }
    );
  }

  try {
    const data = await fetchUserData(accessToken);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Spotify data fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Spotify data. Your session may have expired." },
      { status: 500 }
    );
  }
}
