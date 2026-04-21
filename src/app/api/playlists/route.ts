/*
 * GET /api/playlists
 * Returns the authenticated user's Spotify playlists.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchPlaylists } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const playlists = await fetchPlaylists(accessToken);
    return NextResponse.json(playlists);
  } catch (err) {
    console.error("Playlists fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch playlists." },
      { status: 500 }
    );
  }
}
