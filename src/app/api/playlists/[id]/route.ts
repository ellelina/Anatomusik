/*
 * GET /api/playlists/:id
 * Returns tracks with genre and BPM data for a specific playlist.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchPlaylistTracks } from "@/lib/spotify";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const tracks = await fetchPlaylistTracks(id, accessToken);
    return NextResponse.json(tracks);
  } catch (err) {
    console.error("Playlist tracks fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch playlist tracks." },
      { status: 500 }
    );
  }
}
