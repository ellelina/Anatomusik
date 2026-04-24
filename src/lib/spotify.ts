/*
 * Spotify API helper functions.
 * Handles OAuth URL generation, token exchange, and data fetching.
 */

import {
  SpotifyArtist, SpotifyTrack, SpotifyData, RecentTrackDetail,
  SpotifyPlaylist, PlaylistTrackDetail, TasteTimelineEntry,
} from "./types";
import { resolveGenresToScene } from "./map-utils";

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

// Try to fetch audio features (BPM/tempo). Returns empty map if API is restricted.
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

    if (!res.ok) return bpmMap;

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

// Batch-fetch genres for a set of artist IDs (50 per request)
async function fetchArtistGenres(
  artistIds: string[],
  accessToken: string
): Promise<Map<string, string[]>> {
  const genreMap = new Map<string, string[]>();
  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50).join(",");
    try {
      const res = await spotifyFetch<{ artists: SpotifyArtist[] }>(
        `/artists?ids=${batch}`,
        accessToken
      );
      for (const artist of res.artists) {
        if (artist?.id && Array.isArray(artist.genres)) {
          genreMap.set(artist.id, artist.genres);
        }
      }
    } catch {
      // Non-critical, continue without this batch
    }
  }
  return genreMap;
}

// Collect all genres for a track's artists from a pre-built genre map
function trackGenres(
  artists: { id: string }[],
  genreMap: Map<string, string[]>
): string[] {
  const genres = new Set<string>();
  for (const artist of artists) {
    for (const g of genreMap.get(artist.id) || []) genres.add(g);
  }
  return Array.from(genres);
}

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

export async function fetchUserData(accessToken: string): Promise<SpotifyData> {
  const [
    topArtistsShortRes,
    topArtistsMediumRes,
    topArtistsLongRes,
    topTracksShortRes,
    topTracksMediumRes,
    recentlyPlayedRes,
  ] = await Promise.all([
    spotifyFetch<{ items: SpotifyArtist[] }>("/me/top/artists?time_range=short_term&limit=50", accessToken),
    spotifyFetch<{ items: SpotifyArtist[] }>("/me/top/artists?time_range=medium_term&limit=50", accessToken),
    spotifyFetch<{ items: SpotifyArtist[] }>("/me/top/artists?time_range=long_term&limit=50", accessToken),
    spotifyFetch<{ items: SpotifyTrack[] }>("/me/top/tracks?time_range=short_term&limit=50", accessToken),
    spotifyFetch<{ items: SpotifyTrack[] }>("/me/top/tracks?time_range=medium_term&limit=50", accessToken),
    spotifyFetch<{ items: { track: SpotifyTrack; played_at: string }[] }>("/me/player/recently-played?limit=50", accessToken),
  ]);

  const recentItems = recentlyPlayedRes.items;
  const recentTracks = recentItems.map((item) => item.track);

  // Build artist ID -> genres lookup from top artists (all three time ranges)
  const artistGenreMap = new Map<string, string[]>();
  for (const artist of [...topArtistsShortRes.items, ...topArtistsMediumRes.items, ...topArtistsLongRes.items]) {
    artistGenreMap.set(artist.id, artist.genres);
  }

  // Fetch genres for recent track artists not already in our top artists
  const missingArtistIds = new Set<string>();
  for (const track of recentTracks) {
    for (const artist of track.artists) {
      if (!artistGenreMap.has(artist.id)) missingArtistIds.add(artist.id);
    }
  }

  if (missingArtistIds.size > 0) {
    const extra = await fetchArtistGenres(Array.from(missingArtistIds), accessToken);
    extra.forEach((genres, id) => artistGenreMap.set(id, genres));
  }

  const bpmMap = await fetchAudioFeatures(recentTracks.map((t) => t.id), accessToken);

  const recentTrackDetails: RecentTrackDetail[] = recentTracks.map((track, i) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => a.name),
    albumName: track.album.name,
    albumImage: track.album.images?.[0]?.url || "",
    genres: trackGenres(track.artists, artistGenreMap),
    bpm: bpmMap.get(track.id) || null,
    estimatedBpm: null,
    playedAt: recentItems[i]?.played_at,
    previewUrl: track.preview_url ?? null,
  }));

  const allGenresSet = new Set<string>();
  artistGenreMap.forEach((genres) => {
    if (Array.isArray(genres)) genres.forEach((g) => allGenresSet.add(g));
  });

  // Resolve taste timeline scenes at fetch time so map page doesn't re-process
  const longTopGenres = extractTopGenres(topArtistsLongRes.items);
  const mediumTopGenres = extractTopGenres(topArtistsMediumRes.items);
  const shortTopGenres = extractTopGenres(topArtistsShortRes.items);

  const longScene = resolveGenresToScene(longTopGenres);
  const mediumScene = resolveGenresToScene(mediumTopGenres);
  const shortScene = resolveGenresToScene(shortTopGenres);

  const tasteTimeline: TasteTimelineEntry[] = [
    {
      period: "long_term",
      label: "All time",
      topGenres: longTopGenres,
      resolvedScene: longScene?.sceneName ?? null,
      coordinates: longScene?.coordinates ?? null,
    },
    {
      period: "medium_term",
      label: "Last 6 months",
      topGenres: mediumTopGenres,
      resolvedScene: mediumScene?.sceneName ?? null,
      coordinates: mediumScene?.coordinates ?? null,
    },
    {
      period: "short_term",
      label: "Last 4 weeks",
      topGenres: shortTopGenres,
      resolvedScene: shortScene?.sceneName ?? null,
      coordinates: shortScene?.coordinates ?? null,
    },
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
    tasteTimeline,
  };
}

export async function fetchPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
  const playlists: SpotifyPlaylist[] = [];
  let url = "/me/playlists?limit=50";

  while (url) {
    const res = await spotifyFetch<{ items: SpotifyPlaylist[]; next: string | null }>(url, accessToken);
    for (const pl of res.items) {
      if (pl && pl.id) playlists.push(pl);
    }
    url = res.next ? res.next.replace(SPOTIFY_API_BASE, "") : "";
  }

  return playlists;
}

export async function fetchPlaylistTracks(
  playlistId: string,
  accessToken: string
): Promise<PlaylistTrackDetail[]> {
  const allTracks: SpotifyTrack[] = [];
  let nextUrl: string | null = null;

  try {
    const playlist = await spotifyFetch<Record<string, unknown>>(
      `/playlists/${playlistId}`,
      accessToken
    );

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
  } catch {
    // Fall through to direct tracks endpoint
  }

  if (allTracks.length === 0 && !nextUrl) {
    try {
      const res = await fetch(
        `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        for (const item of data.items || []) {
          if (item.track && item.track.id) allTracks.push(item.track);
        }
        nextUrl = data.next;
      }
    } catch {
      // Non-critical
    }
  }

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
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

  const artistIds = Array.from(new Set(allTracks.flatMap((t) => t.artists.map((a) => a.id))));
  const artistGenreMap = await fetchArtistGenres(artistIds, accessToken);

  const bpmMap = new Map<string, number>();
  for (let i = 0; i < allTracks.length; i += 100) {
    const batch = allTracks.slice(i, i + 100).map((t) => t.id);
    const batchResult = await fetchAudioFeatures(batch, accessToken);
    batchResult.forEach((bpm, id) => bpmMap.set(id, bpm));
  }

  return allTracks.map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => a.name),
    artistIds: track.artists.map((a) => a.id),
    albumName: track.album?.name || "",
    albumImage: track.album?.images?.[0]?.url || "",
    genres: trackGenres(track.artists, artistGenreMap),
    bpm: bpmMap.get(track.id) || null,
    previewUrl: track.preview_url ?? null,
  }));
}

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

  const artistIds = Array.from(new Set(rawTracks.flatMap((t) => t.artists.map((a) => a.id))));
  const artistGenreMap = await fetchArtistGenres(artistIds, accessToken);
  const bpmMap = await fetchAudioFeatures(rawTracks.map((t) => t.id), accessToken);

  const tracks: PlaylistTrackDetail[] = rawTracks.map((track) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((a) => a.name),
    artistIds: track.artists.map((a) => a.id),
    albumName: track.album?.name || "",
    albumImage: track.album?.images?.[0]?.url || "",
    genres: trackGenres(track.artists, artistGenreMap),
    bpm: bpmMap.get(track.id) || null,
    previewUrl: track.preview_url ?? null,
  }));

  return { tracks, total: res.total };
}
