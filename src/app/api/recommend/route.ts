/*
 * POST /api/recommend
 * Seeds from Spotify's related-artists API → real top tracks from those artists.
 * Falls back to genre-based artist search if related-artists is unavailable.
 * Claude only writes the whyMatch sentence — it never selects track titles.
 * Every returned track is guaranteed to exist on Spotify.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, HAIKU_MODEL } from "@/lib/anthropic";

const SPOTIFY = "https://api.spotify.com/v1";

interface RecommendRequest {
  trackName: string;
  artists: string[];
  genres: string[];
  bpm: number;
  mood: string;
}

interface SpotifyTrackRaw {
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  external_urls: { spotify: string };
}

interface SpotifyArtistRaw {
  id: string;
  name: string;
  genres: string[];
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

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function getTopTrack(
  artist: SpotifyArtistRaw,
  headers: Record<string, string>
): Promise<{ trackName: string; artists: string[]; genres: string[]; spotifyUrl: string; albumImage: string } | null> {
  try {
    const res = await fetch(
      `${SPOTIFY}/artists/${artist.id}/top-tracks?market=US`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tracks: SpotifyTrackRaw[] = data.tracks ?? [];
    // Prefer the 3rd track — less obvious than the #1 hit
    const track = tracks[2] ?? tracks[1] ?? tracks[0];
    if (!track || !track.external_urls?.spotify) return null;
    return {
      trackName: track.name,
      artists: track.artists.map((a) => a.name),
      genres: artist.genres.slice(0, 2),
      spotifyUrl: track.external_urls.spotify,
      albumImage: track.album?.images?.[0]?.url ?? "",
    };
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
      return NextResponse.json({ recommendations: [] });
    }

    const headers = { Authorization: `Bearer ${accessToken}` };
    const primaryArtistName = body.artists[0] ?? "";
    const normPrimary = norm(primaryArtistName);

    // Step 1 — find the source artist on Spotify
    const artistSearchRes = await fetch(
      `${SPOTIFY}/search?q=artist:"${encodeURIComponent(primaryArtistName)}"&type=artist&limit=5`,
      { headers }
    );
    if (!artistSearchRes.ok) return NextResponse.json({ recommendations: [] });

    const artistSearchData = await artistSearchRes.json();
    const artistItems: SpotifyArtistRaw[] = artistSearchData.artists?.items ?? [];
    const sourceArtist =
      artistItems.find((a) => norm(a.name) === normPrimary) ?? artistItems[0];

    if (!sourceArtist) return NextResponse.json({ recommendations: [] });

    // Step 2 — try related-artists; fall back to genre-based search if unavailable
    let candidateArtists: SpotifyArtistRaw[] = [];

    const relatedRes = await fetch(
      `${SPOTIFY}/artists/${sourceArtist.id}/related-artists`,
      { headers }
    );

    if (relatedRes.ok) {
      const relatedData = await relatedRes.json();
      candidateArtists = (relatedData.artists ?? []).filter(
        (a: SpotifyArtistRaw) => norm(a.name) !== normPrimary
      );
    }

    // Fallback: search for artists in the source artist's Spotify genre tags
    if (candidateArtists.length < 3 && sourceArtist.genres?.length) {
      const genre = sourceArtist.genres[0];
      const genreRes = await fetch(
        `${SPOTIFY}/search?q=genre:"${encodeURIComponent(genre)}"&type=artist&limit=20`,
        { headers }
      );
      if (genreRes.ok) {
        const genreData = await genreRes.json();
        const genreArtists: SpotifyArtistRaw[] = genreData.artists?.items ?? [];
        const existingIds = new Set(candidateArtists.map((a) => a.id));
        for (const a of genreArtists) {
          if (!existingIds.has(a.id) && norm(a.name) !== normPrimary) {
            candidateArtists.push(a);
            existingIds.add(a.id);
          }
        }
      }
    }

    if (candidateArtists.length === 0) return NextResponse.json({ recommendations: [] });

    // Step 3 — fetch one real track per candidate artist in parallel
    const trackResults = await Promise.all(
      candidateArtists.slice(0, 8).map((artist) => getTopTrack(artist, headers))
    );

    const spotifyTracks = trackResults
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .slice(0, 5);

    if (spotifyTracks.length === 0) return NextResponse.json({ recommendations: [] });

    // Step 4 — Claude (Haiku) writes whyMatch copy only — no track selection
    const trackList = spotifyTracks
      .map((t) => `"${t.trackName}" by ${t.artists.join(", ")}`)
      .join("\n");

    const claudeRes = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `For each track below, write one short sentence explaining the specific sonic quality that connects it to "${body.trackName}" by ${body.artists.join(", ")} (${body.genres.join(", ")}, ~${body.bpm} BPM, ${body.mood}).

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
    } catch { /* use fallback below */ }

    const recommendations: Recommendation[] = spotifyTracks.map((track, i) => ({
      trackName: track.trackName,
      artists: track.artists,
      genres: track.genres,
      estimatedBpm: null,
      whyMatch:
        explanations[i]?.whyMatch ??
        `Sonically related to ${primaryArtistName}'s style`,
      spotifyUrl: track.spotifyUrl,
      albumImage: track.albumImage,
    }));

    return NextResponse.json({ recommendations });
  } catch (err) {
    console.error("Recommendation error:", err);
    return NextResponse.json(
      { error: "Failed to generate recommendations." },
      { status: 500 }
    );
  }
}
