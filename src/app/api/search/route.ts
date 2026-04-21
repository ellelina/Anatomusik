/*
 * GET /api/search?q=track+name+artist
 * Searches Spotify for tracks and returns enriched results with album art, genres, etc.
 * Returns up to 10 results + top-level spotifyUrl/uri/id for backward compat with RecommendPanel.
 */

import { NextRequest, NextResponse } from "next/server";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Search failed." }, { status: 500 });
    }

    const data = await res.json();
    const items = data.tracks?.items || [];

    if (items.length === 0) {
      return NextResponse.json({ tracks: [], spotifyUrl: null, uri: null, id: null });
    }

    // Collect unique artist IDs for genre enrichment
    const artistIds = new Set<string>();
    for (const track of items) {
      for (const artist of track.artists || []) {
        artistIds.add(artist.id);
      }
    }

    // Batch-fetch artist genres (up to 50 per request)
    const artistGenreMap = new Map<string, string[]>();
    const idArray = Array.from(artistIds);
    for (let i = 0; i < idArray.length; i += 50) {
      const batch = idArray.slice(i, i + 50).join(",");
      try {
        const artistRes = await fetch(
          `${SPOTIFY_API_BASE}/artists?ids=${batch}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (artistRes.ok) {
          const artistData = await artistRes.json();
          for (const artist of artistData.artists || []) {
            if (artist?.id && Array.isArray(artist.genres)) {
              artistGenreMap.set(artist.id, artist.genres);
            }
          }
        }
      } catch {
        // Continue without genre data for this batch
      }
    }

    // Build enriched results
    const tracks = items.map((track: Record<string, unknown>) => {
      const artists = (track.artists as { id: string; name: string }[]) || [];
      const album = track.album as { name: string; images: { url: string }[] } | undefined;
      const externalUrls = track.external_urls as { spotify: string } | undefined;

      const trackGenres = new Set<string>();
      for (const artist of artists) {
        const genres = artistGenreMap.get(artist.id) || [];
        for (const g of genres) trackGenres.add(g);
      }

      return {
        id: track.id as string,
        name: track.name as string,
        artists: artists.map((a) => a.name),
        artistIds: artists.map((a) => a.id),
        albumName: album?.name || "",
        albumImage: album?.images?.[0]?.url || "",
        genres: Array.from(trackGenres),
        spotifyUrl: externalUrls?.spotify || null,
        uri: (track.uri as string) || null,
      };
    });

    // Backward compat: top-level fields from first result (used by RecommendPanel)
    const first = tracks[0];
    return NextResponse.json({
      tracks,
      spotifyUrl: first?.spotifyUrl || null,
      uri: first?.uri || null,
      id: first?.id || null,
    });
  } catch {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
