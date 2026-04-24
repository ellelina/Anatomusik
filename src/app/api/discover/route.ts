/*
 * POST /api/discover
 * Seeds from the user's representative artists → Spotify related-artists API →
 * real top tracks from those artists. Claude never selects track titles;
 * it only writes the whyMatch copy. Every returned track is guaranteed to exist.
 * Body: { microGenres, musicPersonality, knownArtists, knownTracks }
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL } from "@/lib/anthropic";
import { MicroGenre } from "@/lib/types";

const SPOTIFY = "https://api.spotify.com/v1";

interface DiscoverRequest {
  microGenres: MicroGenre[];
  musicPersonality: string;
  knownArtists?: string[];
  knownTracks?: string[];
}

interface SpotifyTrackRaw {
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  external_urls: { spotify: string };
  popularity: number;
}

interface DiscoveredTrack {
  trackName: string;
  artists: string[];
  genres: string[];
  estimatedBpm: number | null;
  whyMatch: string;
  spotifyUrl: string;
  albumImage: string;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function searchArtist(
  name: string,
  headers: Record<string, string>
): Promise<{ id: string; name: string; genres: string[] } | null> {
  try {
    const res = await fetch(
      `${SPOTIFY}/search?q=artist:"${encodeURIComponent(name)}"&type=artist&limit=5`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: { id: string; name: string; genres: string[] }[] =
      data.artists?.items ?? [];
    const normName = norm(name);
    return items.find((a) => norm(a.name) === normName) ?? items[0] ?? null;
  } catch {
    return null;
  }
}

async function getRelatedTracks(
  artistId: string,
  headers: Record<string, string>,
  knownArtistNorms: Set<string>
): Promise<{ id: string; name: string; genres: string[]; track: SpotifyTrackRaw | null }[]> {
  try {
    const relatedRes = await fetch(
      `${SPOTIFY}/artists/${artistId}/related-artists`,
      { headers }
    );
    if (!relatedRes.ok) return [];
    const relatedData = await relatedRes.json();
    const artists: { id: string; name: string; genres: string[] }[] =
      relatedData.artists ?? [];

    // Exclude artists the user already knows
    const fresh = artists.filter((a) => !knownArtistNorms.has(norm(a.name)));

    // Get one track per artist in parallel
    const withTracks = await Promise.all(
      fresh.slice(0, 6).map(async (artist) => {
        try {
          const topRes = await fetch(
            `${SPOTIFY}/artists/${artist.id}/top-tracks?market=US`,
            { headers }
          );
          if (!topRes.ok) return { ...artist, track: null };
          const topData = await topRes.json();
          const tracks: SpotifyTrackRaw[] = topData.tracks ?? [];
          // Prefer tracks that aren't the most-streamed (lower popularity = deeper cut)
          const sorted = [...tracks].sort((a, b) => a.popularity - b.popularity);
          const track = sorted.find((t) => t.popularity < 60) ?? tracks[2] ?? tracks[1] ?? tracks[0] ?? null;
          return { ...artist, track };
        } catch {
          return { ...artist, track: null };
        }
      })
    );

    return withTracks;
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  try {
    const body: DiscoverRequest = await request.json();

    if (!body.microGenres?.length) {
      return NextResponse.json({ error: "Missing micro-genre data." }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json({ playlist: [] });
    }

    const headers = { Authorization: `Bearer ${accessToken}` };
    const knownArtistNorms = new Set(
      (body.knownArtists ?? []).map((a) => norm(a))
    );

    // Collect representative artists from micro-genres as seeds
    const seedNames = Array.from(
      new Set(body.microGenres.flatMap((g) => g.representativeArtists))
    ).slice(0, 5);

    if (seedNames.length === 0) {
      return NextResponse.json({ playlist: [] });
    }

    // Step 1 — resolve seed artists to Spotify IDs in parallel
    const seedArtists = (
      await Promise.all(seedNames.map((name) => searchArtist(name, headers)))
    ).filter((a): a is NonNullable<typeof a> => a !== null);

    if (seedArtists.length === 0) {
      return NextResponse.json({ playlist: [] });
    }

    // Step 2 — get related artists + tracks for each seed (in parallel)
    const allResults = await Promise.all(
      seedArtists.map((a) => getRelatedTracks(a.id, headers, knownArtistNorms))
    );

    // Flatten, deduplicate by artist name, keep only tracks with a URL
    const seenArtists = new Set<string>();
    const tracks: DiscoveredTrack[] = [];

    for (const group of allResults) {
      for (const entry of group) {
        const artistKey = norm(entry.name);
        if (seenArtists.has(artistKey) || knownArtistNorms.has(artistKey)) continue;
        if (!entry.track?.external_urls?.spotify) continue;
        seenArtists.add(artistKey);
        tracks.push({
          trackName: entry.track.name,
          artists: entry.track.artists.map((a) => a.name),
          genres: entry.genres.slice(0, 2),
          estimatedBpm: null,
          whyMatch: "", // filled in by Claude below
          spotifyUrl: entry.track.external_urls.spotify,
          albumImage: entry.track.album?.images?.[0]?.url ?? "",
        });
        if (tracks.length >= 15) break;
      }
      if (tracks.length >= 15) break;
    }

    if (tracks.length === 0) {
      return NextResponse.json({ playlist: [] });
    }

    // Step 3 — ask Claude (Haiku) for whyMatch copy only
    const genreContext = body.microGenres.map((g) => g.name).join(", ");
    const trackList = tracks
      .map((t) => `"${t.trackName}" by ${t.artists.join(", ")}`)
      .join("\n");

    const claudeRes = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `This listener's micro-genres: ${genreContext}
Profile: ${body.musicPersonality}

For each track below, write one short sentence explaining the specific sonic quality that connects it to this listener's taste.

Tracks:
${trackList}

Respond with ONLY a JSON array in the same order (no markdown):
[{"whyMatch": "sentence"}, ...]`,
        },
      ],
    });

    const claudeText =
      claudeRes.content[0].type === "text" ? claudeRes.content[0].text : "[]";
    let explanations: { whyMatch: string }[] = [];
    try {
      const arrayMatch = claudeText.match(/\[[\s\S]*\]/);
      if (arrayMatch) explanations = JSON.parse(arrayMatch[0]);
    } catch { /* use fallbacks */ }

    const playlist = tracks.map((track, i) => ({
      ...track,
      whyMatch:
        explanations[i]?.whyMatch ??
        `Shares sonic DNA with your ${genreContext} taste`,
    }));

    return NextResponse.json({ playlist });
  } catch (err) {
    console.error("Discover error:", err);
    const raw = err instanceof Error ? err.message : String(err);
    const isBilling = raw.includes("credit balance") || raw.includes("quota");
    return NextResponse.json(
      {
        error: isBilling
          ? "Anthropic API credits exhausted. Add credits at console.anthropic.com."
          : "Failed to generate discovery playlist.",
      },
      { status: 500 }
    );
  }
}
