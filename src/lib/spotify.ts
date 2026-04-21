/*
 * Spotify API helper functions.
 * Handles OAuth URL generation, token exchange, and data fetching.
 */

import {
  SpotifyArtist, SpotifyTrack, SpotifyData, RecentTrackDetail,
  SpotifyPlaylist, PlaylistTrackDetail, TasteTimelineEntry,
} from "./types";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const SCOPES = ["user-top-read", "user-read-recently-played", "playlist-read-private", "playlist-read-collaborative", "user-library-read"];

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SCOPES.join(" "),
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state,
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Spotify token exchange failed: ${error}`);
  }

  return res.json();
}

async function spotifyFetch<T>(endpoint: string, accessToken: string): Promise<T> {
  const res = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Spotify API error (${res.status}): ${error}`);
  }

  return res.json();
}

// Try to fetch audio features (BPM/tempo). Returns null if API is restricted.
async function fetchAudioFeatures(
  trackIds: string[],
  accessToken: string
): Promise<Map<string, number>> {
  const bpmMap = new Map<string, number>();
  if (trackIds.length === 0) return bpmMap;

  try {
    const ids = trackIds.join(",");
    const res = await fetch(`${SPOTIFY_API_BASE}/audio-features?ids=${ids}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return bpmMap; // API restricted, return empty

    const data = await res.json();
    for (const feature of data.audio_features || []) {
      if (feature && feature.id && feature.tempo) {
        bpmMap.set(feature.id, Math.round(feature.tempo));
      }
    }
  } catch {
    // Audio features API may be restricted — fail silently
  }

  return bpmMap;
}

export async function fetchUserData(accessToken: string): Promise<SpotifyData> {
  // Fetch all data in parallel
  const [
    topArtistsShortRes,
    topArtistsMediumRes,
    topArtistsLongRes,
    topTracksShortRes,
    topTracksMediumRes,
    recentlyPlayedRes,
  ] = await Promise.all([
    spotifyFetch<{ items: SpotifyArtist[] }>(
      "/me/top/artists?time_range=short_term&limit=50",
      accessToken
    ),
    spotifyFetch<{ items: SpotifyArtist[] }>(
      "/me/top/artists?time_range=medium_term&limit=50",
      accessToken
    ),
    spotifyFetch<{ items: SpotifyArtist[] }>(
      "/me/top/artists?time_range=long_term&limit=50",
      accessToken
    ),
    spotifyFetch<{ items: SpotifyTrack[] }>(
      "/me/top/tracks?time_range=short_term&limit=50",
      accessToken
    ),
    spotifyFetch<{ items: SpotifyTrack[] }>(
      "/me/top/tracks?time_range=medium_term&limit=50",
      accessToken
    ),
    spotifyFetch<{ items: { track: SpotifyTrack }[] }>(
      "/me/player/recently-played?limit=50",
      accessToken
    ),
  ]);

  const recentTracks = recentlyPlayedRes.items.map((item) => item.track);

  // Build artist ID -> genres lookup from top artists (all three time ranges)
  const artistGenreMap = new Map<string, string[]>();
  for (const artist of [...topArtistsShortRes.items, ...topArtistsMediumRes.items, ...topArtistsLongRes.items]) {
    artistGenreMap.set(artist.id, artist.genres);
  }

  // Fetch genres for any recent track artists not already in our top artists
  const missingArtistIds = new Set<string>();
  for (const track of recentTracks) {
    for (const artist of track.artists) {
      if (!artistGenreMap.has(artist.id)) {
        missingArtistIds.add(artist.id);
      }
    }
  }

  // Batch fetch missing artists (up to 50 per request)
  if (missingArtistIds.size > 0) {
    const ids = Array.from(missingArtistIds).slice(0, 50).join(",");
    try {
      const artistsRes = await spotifyFetch<{ artists: SpotifyArtist[] }>(
        `/artists?ids=${ids}`,
        accessToken
      );
      for (const artist of artistsRes.artists) {
        if (artist?.id && Array.isArray(artist.genres)) {
          artistGenreMap.set(artist.id, artist.genres);
        }
      }
    } catch {
      // Non-critical, continue without extra genre data
    }
  }

  // Try to get BPM data from audio features
  const recentTrackIds = recentTracks.map((t) => t.id);
  const bpmMap = await fetchAudioFeatures(recentTrackIds, accessToken);

  // Build detailed per-track info for recently played
  const recentTrackDetails: RecentTrackDetail[] = recentTracks.map((track) => {
    const trackGenres = new Set<string>();
    for (const artist of track.artists) {
      const genres = artistGenreMap.get(artist.id) || [];
      for (const g of genres) trackGenres.add(g);
    }

    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => a.name),
      albumName: track.album.name,
      albumImage: track.album.images?.[0]?.url || "",
      genres: Array.from(trackGenres),
      bpm: bpmMap.get(track.id) || null,
      estimatedBpm: null, // filled in by Claude if API BPM unavailable
    };
  });

  // Deduplicate genres and artists
  const allGenresSet = new Set<string>();
  const allArtistsSet = new Set<string>();

  artistGenreMap.forEach((genres) => {
    if (Array.isArray(genres)) {
      for (const genre of genres) allGenresSet.add(genre);
    }
  });

  const allTracks = [
    ...topTracksShortRes.items,
    ...topTracksMediumRes.items,
    ...recentTracks,
  ];

  for (const track of allTracks) {
    for (const artist of track.artists) {
      allArtistsSet.add(artist.name);
    }
  }

  // Build taste timeline from genre frequencies per time period
  function extractTopGenres(artists: SpotifyArtist[]): string[] {
    const genreCounts = new Map<string, number>();
    for (const artist of artists) {
      for (const genre of artist.genres || []) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      }
    }
    return Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre]) => genre);
  }

  const tasteTimeline: TasteTimelineEntry[] = [
    { period: "long_term", label: "All time", topGenres: extractTopGenres(topArtistsLongRes.items), resolvedScene: null, coordinates: null },
    { period: "medium_term", label: "Last 6 months", topGenres: extractTopGenres(topArtistsMediumRes.items), resolvedScene: null, coordinates: null },
    { period: "short_term", label: "Last 4 weeks", topGenres: extractTopGenres(topArtistsShortRes.items), resolvedScene: null, coordinates: null },
  ];

  return {
    topArtistsShort: topArtistsShortRes.items,
    topArtistsMedium: topArtistsMediumRes.items,
    topArtistsLong: topArtistsLongRes.items,
    topTracksShort: topTracksShortRes.items,
    topTracksMedium: topTracksMediumRes.items,
    recentlyPlayed: recentTracks,
    recentTrackDetails,
    allGenres: Array.from(allGenresSet),
    uniqueArtists: Array.from(allArtistsSet),
    tasteTimeline,
  };
}

// Fetch all user playlists
export async function fetchPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url = "/me/playlists?limit=50";

  while (url) {
    const res = await spotifyFetch<{
      items: SpotifyPlaylist[];
      next: string | null;
    }>(url, accessToken);

    for (const pl of res.items) {
      if (pl && pl.id) playlists.push(pl);
    }

    // Handle pagination — next is a full URL, extract the path
    if (res.next) {
      url = res.next.replace(SPOTIFY_API_BASE, "");
    } else {
      url = "";
    }
  }

  return playlists;
}

// Fetch tracks for a specific playlist with genre data
export async function fetchPlaylistTracks(
  playlistId: string,
  accessToken: string
): Promise<PlaylistTrackDetail[]> {
  // Fetch playlist with tracks via the main playlist endpoint
  const allTracks: SpotifyTrack[] = [];

  // Try the full playlist endpoint first, fall back to tracks endpoint
  let nextUrl: string | null = null;

  try {
    const playlist = await spotifyFetch<Record<string, unknown>>(
      `/playlists/${playlistId}`,
      accessToken
    );

    // Log full structure to understand what Spotify returns
    console.log("playlist.tracks type:", typeof playlist.tracks);
    console.log("playlist.items type:", typeof playlist.items);
    if (Array.isArray(playlist.items)) {
      console.log("playlist.items length:", (playlist.items as unknown[]).length);
      console.log("playlist.items[0] keys:", playlist.items[0] ? Object.keys(playlist.items[0] as object) : "empty");
      console.log("playlist.items[0]:", JSON.stringify(playlist.items[0]).slice(0, 500));
    }

    // Try playlist.tracks.items, playlist.items, or playlist.items[].track
    const tracksContainer = playlist.tracks as { items: unknown[]; next: string | null } | undefined;
    const itemsArray = (tracksContainer?.items || playlist.items) as unknown[];

    if (Array.isArray(itemsArray)) {
      for (const item of itemsArray) {
        const obj = item as Record<string, unknown>;
        const track = (obj.track || obj) as SpotifyTrack;
        if (track?.id && track?.name) allTracks.push(track);
      }
      nextUrl = tracksContainer?.next || null;
    }
  } catch (err) {
    console.log("Full playlist endpoint failed, trying tracks endpoint:", err);
  }

  // If we got no tracks from the playlist object, try the direct tracks endpoint
  if (allTracks.length === 0 && !nextUrl) {
    try {
      // Use raw fetch to avoid the spotifyFetch error throwing
      const res = await fetch(
        `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      console.log("Tracks endpoint status:", res.status);

      if (res.ok) {
        const data = await res.json();
        for (const item of data.items || []) {
          if (item.track && item.track.id) allTracks.push(item.track);
        }
        nextUrl = data.next;
      }
    } catch (err) {
      console.log("Tracks endpoint also failed:", err);
    }
  }

  // Paginate remaining tracks
  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) break;

    const data = await res.json();
    for (const item of data.items || []) {
      if (item.track && item.track.id) allTracks.push(item.track);
    }
    nextUrl = data.next;
  }

  if (allTracks.length === 0) {
    throw new Error("Could not fetch playlist tracks. Your Spotify app may need Extended Quota Mode for playlist access.");
  }

  // Collect all unique artist IDs and batch-fetch their genres
  const artistIds = new Set<string>();
  for (const track of allTracks) {
    for (const artist of track.artists) {
      artistIds.add(artist.id);
    }
  }

  const artistGenreMap = new Map<string, string[]>();
  const idArray = Array.from(artistIds);

  // Fetch artists in batches of 50
  for (let i = 0; i < idArray.length; i += 50) {
    const batch = idArray.slice(i, i + 50).join(",");
    try {
      const res = await spotifyFetch<{ artists: SpotifyArtist[] }>(
        `/artists?ids=${batch}`,
        accessToken
      );
      for (const artist of res.artists) {
        if (artist?.id && Array.isArray(artist.genres)) {
          artistGenreMap.set(artist.id, artist.genres);
        }
      }
    } catch {
      // Continue without genre data for this batch
    }
  }

  // Try to get BPM data
  const trackIds = allTracks.map((t) => t.id);
  const bpmMap = new Map<string, number>();

  // Audio features in batches of 100
  for (let i = 0; i < trackIds.length; i += 100) {
    const batch = trackIds.slice(i, i + 100);
    const batchResult = await fetchAudioFeatures(batch, accessToken);
    batchResult.forEach((bpm, id) => {
      bpmMap.set(id, bpm);
    });
  }

  // Build detailed track list
  return allTracks.map((track) => {
    const trackGenres = new Set<string>();
    for (const artist of track.artists) {
      const genres = artistGenreMap.get(artist.id);
      if (Array.isArray(genres)) {
        for (const g of genres) trackGenres.add(g);
      }
    }

    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => a.name),
      artistIds: track.artists.map((a) => a.id),
      albumName: track.album?.name || "",
      albumImage: track.album?.images?.[0]?.url || "",
      genres: Array.from(trackGenres),
      bpm: bpmMap.get(track.id) || null,
    };
  });
}

// Fetch user's saved/liked tracks with genre data (paginated)
export async function fetchSavedTracks(
  accessToken: string,
  offset: number = 0,
  limit: number = 50
): Promise<{ tracks: PlaylistTrackDetail[]; total: number }> {
  const res = await spotifyFetch<{
    items: { track: SpotifyTrack }[];
    total: number;
    next: string | null;
  }>(`/me/tracks?limit=${limit}&offset=${offset}`, accessToken);

  const rawTracks = res.items
    .filter((item) => item.track && item.track.id)
    .map((item) => item.track);

  // Batch-fetch artist genres
  const artistIds = new Set<string>();
  for (const track of rawTracks) {
    for (const artist of track.artists) {
      artistIds.add(artist.id);
    }
  }

  const artistGenreMap = new Map<string, string[]>();
  const idArray = Array.from(artistIds);

  for (let i = 0; i < idArray.length; i += 50) {
    const batch = idArray.slice(i, i + 50).join(",");
    try {
      const artistsRes = await spotifyFetch<{ artists: SpotifyArtist[] }>(
        `/artists?ids=${batch}`,
        accessToken
      );
      for (const artist of artistsRes.artists) {
        if (artist?.id && Array.isArray(artist.genres)) {
          artistGenreMap.set(artist.id, artist.genres);
        }
      }
    } catch {
      // Continue
    }
  }

  // Try BPM data
  const bpmMap = await fetchAudioFeatures(
    rawTracks.map((t) => t.id),
    accessToken
  );

  const tracks: PlaylistTrackDetail[] = rawTracks.map((track) => {
    const trackGenres = new Set<string>();
    for (const artist of track.artists) {
      const genres = artistGenreMap.get(artist.id);
      if (Array.isArray(genres)) {
        for (const g of genres) trackGenres.add(g);
      }
    }

    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => a.name),
      artistIds: track.artists.map((a) => a.id),
      albumName: track.album?.name || "",
      albumImage: track.album?.images?.[0]?.url || "",
      genres: Array.from(trackGenres),
      bpm: bpmMap.get(track.id) || null,
    };
  });

  return { tracks, total: res.total };
}
