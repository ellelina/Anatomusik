/*
 * POST /api/discover
 * Claude suggests artists matching the user's micro-genre profile.
 * Each suggestion is verified via Spotify artist search (type=artist — the only
 * endpoint available in dev mode). Returns artist page links, not track links.
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

interface SpotifyArtistRaw {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
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

async function verifyArtist(
  name: string,
  headers: Record<string, string>
): Promise<SpotifyArtistRaw | null> {
  try {
    const res = await fetch(
      `${SPOTIFY}/search?q=${encodeURIComponent(name)}&type=artist&limit=3`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: SpotifyArtistRaw[] = data.artists?.items ?? [];
    const normName = norm(name);
    return items.find((a) => norm(a.name) === normName) ?? items[0] ?? null;
  } catch {
    return null;
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
      return NextResponse.json(
        { error: "Spotify session expired. Log in again." },
        { status: 401 }
      );
    }

    const headers = { Authorization: `Bearer ${accessToken}` };
    const knownArtistNorms = new Set((body.knownArtists ?? []).map(norm));
    const genreContext = body.microGenres.map((g) => g.name).join(", ");
    const knownList = (body.knownArtists ?? []).slice(0, 10).join(", ");

    // Step 1 — Claude suggests 15 artists the user doesn't already know
    const claudeRes = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1400,
      messages: [
        {
          role: "user",
          content: `You are a music recommendation engine. This listener's micro-genre profile: ${genreContext}.
Their personality: ${body.musicPersonality}

Artists they already know (do NOT suggest these): ${knownList || "none listed"}

Suggest 15 real artists that fit this profile and would genuinely surprise and delight this listener. For each, write one sentence explaining the specific sonic quality that connects them to this profile.

Respond with ONLY a JSON array (no markdown):
[{"artist": "Artist Name", "whyMatch": "sentence"}, ...]`,
        },
      ],
    });

    const claudeText =
      claudeRes.content[0].type === "text" ? claudeRes.content[0].text : "[]";
    let suggestions: { artist: string; whyMatch: string }[] = [];
    try {
      const arrayMatch = claudeText.match(/\[[\s\S]*\]/);
      if (arrayMatch) suggestions = JSON.parse(arrayMatch[0]);
    } catch { /* fall through */ }

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: "Couldn't generate suggestions. Try again." },
        { status: 500 }
      );
    }

    // Step 2 — verify each artist against Spotify in parallel
    const verifyResults = await Promise.all(
      suggestions.slice(0, 15).map(async (s) => {
        const found = await verifyArtist(s.artist, headers);
        if (!found) return null;
        return { suggestion: s, artist: found };
      })
    );

    const verified = verifyResults.filter(
      (r): r is NonNullable<typeof r> => r !== null
    );

    if (verified.length === 0) {
      return NextResponse.json(
        { error: "Couldn't verify any suggested artists on Spotify. Try again." },
        { status: 500 }
      );
    }

    const playlist: DiscoveredTrack[] = verified.slice(0, 15).map(({ suggestion, artist }) => ({
      trackName: "",
      artists: [artist.name],
      genres: (artist.genres ?? []).slice(0, 2),
      estimatedBpm: null,
      whyMatch: suggestion.whyMatch,
      spotifyUrl: `https://open.spotify.com/artist/${artist.id}`,
      albumImage: artist.images?.[0]?.url ?? "",
    }));

    return NextResponse.json({ playlist });
  } catch (err) {
    console.error("Discover error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
