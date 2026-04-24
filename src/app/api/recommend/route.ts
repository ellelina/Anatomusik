/*
 * POST /api/recommend
 * Claude Haiku suggests similar artists + representative tracks.
 * Each suggested artist is verified against Spotify's artist search (type=artist),
 * the only endpoint available in dev-mode. Links go to the verified artist page.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL } from "@/lib/anthropic";

const SPOTIFY = "https://api.spotify.com/v1";

interface RecommendRequest {
  trackName: string;
  artists: string[];
  genres: string[];
  spotifyGenres?: string[];
  bpm: number;
  mood: string;
}

interface Recommendation {
  trackName: string;
  artists: string[];
  genres: string[];
  estimatedBpm: number | null;
  whyMatch: string;
  spotifyUrl: string;
  albumImage: string;
}

interface SpotifyArtistRaw {
  id: string;
  name: string;
  genres: string[];
  images: { url: string }[];
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
    const body: RecommendRequest = await request.json();

    if (!body.trackName || !body.artists?.length) {
      return NextResponse.json({ error: "Missing track data." }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json({ recommendations: [], _reason: "no_token" });
    }

    const headers = { Authorization: `Bearer ${accessToken}` };
    const primaryArtist = body.artists[0] ?? "";
    const allGenres = Array.from(new Set([
      ...(body.genres ?? []),
      ...(body.spotifyGenres ?? []),
    ])).filter(Boolean).slice(0, 4);

    // Step 1 — Claude suggests 8 similar artists
    const claudeRes = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `You are a music recommendation engine. Suggest 8 real artists similar to ${primaryArtist} (genres: ${allGenres.join(", ")}, ~${body.bpm} BPM, ${body.mood} mood).

For each artist, write one short sentence explaining the specific sonic quality that connects them to "${body.trackName}" by ${primaryArtist}.

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
    } catch { /* fall through to empty */ }

    if (suggestions.length === 0) {
      return NextResponse.json({ recommendations: [], _reason: "no_suggestions" });
    }

    // Step 2 — verify each artist against Spotify in parallel
    const normPrimary = norm(primaryArtist);
    const verifyResults = await Promise.all(
      suggestions.slice(0, 8).map(async (s) => {
        if (norm(s.artist) === normPrimary) return null;
        const found = await verifyArtist(s.artist, headers);
        if (!found) return null;
        return { suggestion: s, artist: found };
      })
    );

    const verified = verifyResults.filter(
      (r): r is NonNullable<typeof r> => r !== null
    );

    if (verified.length === 0) {
      return NextResponse.json({ recommendations: [], _reason: "no_verified_artists" });
    }

    const recommendations: Recommendation[] = verified.slice(0, 5).map(({ suggestion, artist }) => ({
      trackName: "",
      artists: [artist.name],
      genres: (artist.genres ?? []).slice(0, 2),
      estimatedBpm: null,
      whyMatch: suggestion.whyMatch,
      spotifyUrl: `https://open.spotify.com/artist/${artist.id}`,
      albumImage: artist.images?.[0]?.url ?? "",
    }));

    return NextResponse.json({ recommendations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Recommendation error:", msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
