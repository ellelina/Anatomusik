/*
 * POST /api/anatomy/analyze
 * Fetches real Spotify audio features for the track, then sends confirmed
 * measurements to Claude for plain-English sound layer explanation.
 * Falls back gracefully if audio features are unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, parseJson } from "@/lib/anthropic";
import type { AnatomyResult } from "@/lib/types";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// Spotify key integer → note name
const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

interface AnatomyRequest {
  id: string;
  trackName: string;
  artists: string[];
  genres: string[];
  bpm: number;
  mood: string;
}

interface SpotifyAudioFeatures {
  tempo: number;
  key: number;
  mode: number;
  energy: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  valence: number;
  loudness: number;
  time_signature: number;
}

function convertKey(key: number, mode: number): string {
  if (key < 0 || key > 11) return "Unknown";
  return `${KEY_NAMES[key]} ${mode === 1 ? "major" : "minor"}`;
}

function deriveDynamicRange(loudness: number): "narrow" | "medium" | "wide" {
  if (loudness > -6) return "narrow";
  if (loudness > -12) return "medium";
  return "wide";
}

function deriveTexture(instrumentalness: number, acousticness: number): "sparse" | "layered" | "dense" {
  if (instrumentalness > 0.5 && acousticness > 0.5) return "sparse";
  if (instrumentalness < 0.2) return "dense";
  return "layered";
}

export async function POST(request: NextRequest) {
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  try {
    const body: AnatomyRequest = await request.json();

    if (!body.trackName || !body.artists) {
      return NextResponse.json({ error: "Missing track data." }, { status: 400 });
    }

    // Step 1: Try to fetch real audio features from Spotify
    let audioFeatures: SpotifyAudioFeatures | null = null;
    let hasRealData = false;

    if (body.id && accessToken) {
      try {
        const res = await fetch(
          `${SPOTIFY_API_BASE}/audio-features/${body.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.tempo) {
            audioFeatures = data;
            hasRealData = true;
          }
        }
      } catch {
        // Audio features API may be restricted — fall back to Claude estimation
      }
    }

    // Step 2: Build the prompt with real data or estimation disclaimer
    const realBpm = hasRealData && audioFeatures ? Math.round(audioFeatures.tempo) : body.bpm;
    const realKey = hasRealData && audioFeatures ? convertKey(audioFeatures.key, audioFeatures.mode) : null;
    const energy = hasRealData && audioFeatures ? Math.round(audioFeatures.energy * 100) : null;
    const acousticness = hasRealData && audioFeatures ? Math.round(audioFeatures.acousticness * 100) : null;
    const danceability = hasRealData && audioFeatures ? Math.round(audioFeatures.danceability * 100) : null;
    const instrumentalness = hasRealData && audioFeatures ? Math.round(audioFeatures.instrumentalness * 100) : null;
    const loudness = hasRealData && audioFeatures ? audioFeatures.loudness : null;

    let dataSection: string;
    if (hasRealData) {
      dataSection = `The following values are confirmed measurements from Spotify's audio analysis. Treat them as ground truth — do not estimate or contradict them:

BPM: ${realBpm}
Key: ${realKey}
Energy level: ${energy}%
Acousticness: ${acousticness}%
Danceability: ${danceability}%
Instrumentalness: ${instrumentalness}%

Using these confirmed values, identify the sound layers and explain them in plain English for a beginner.`;
    } else {
      dataSection = `Audio features are unavailable for this track. You must estimate BPM, key, and sonic characteristics based on the track name, artist, and genre. Make clear in your keyFeel field that these are estimates, not measurements.

Estimated BPM: ~${body.bpm}`;
    }

    const prompt = `You are a music anatomy expert writing for someone who knows nothing about music theory. Analyze this track and break it down into its individual sound layers. For each layer explain what it is, what job it does in this specific song, and why that job creates the emotional feeling it creates. Use warm, plain language — translate every technical term immediately. Never use jargon without explaining it in the same sentence.

Track: "${body.trackName}" by ${body.artists.join(", ")}
Micro-genres: ${body.genres.join(", ")}
Mood: ${body.mood}

${dataSection}

Return ONLY a JSON object:
{
  "layers": [
    {
      "name": "string",
      "type": "melodic | harmonic | spatial | dynamic",
      "shortDescription": "string (max 8 words)",
      "presencePercent": "number (10-100)",
      "explanation": "string (2-4 plain-English sentences)",
      "questionTags": ["string", "string"]
    }
  ],
  "grooveFeel": {
    "type": "straight | swung | syncopated | free",
    "explanation": "string (2-3 plain-English sentences)",
    "beatPattern": [2, 1, 1, 1, 2, 1, 1, 1]
  },
  "key": "string (e.g. C major)",
  "keyFeel": "string (e.g. bright, resolved)",
  "dynamicRange": "narrow | medium | wide",
  "dynamicExplanation": "string (one sentence)",
  "texture": "sparse | layered | dense",
  "textureExplanation": "string (one sentence)"
}

Rules:
- 3-6 layers per track
- Layers must reflect the actual instrumentation of THIS specific song — not generic
- Plain English always — every technical term gets an immediate one-clause definition
- questionTags should be genuine beginner curiosity questions, not technical prompts
- beatPattern must be exactly 8 values, each 0 (rest/silence), 1 (weak beat), or 2 (strong beat)
- presencePercent reflects how prominent/loud that layer is in the overall mix
- type must be exactly one of: melodic, harmonic, spatial, dynamic
${hasRealData ? "- For key, you MUST use the confirmed key value provided above" : "- Since these are estimates, prefix keyFeel with 'estimated — '"}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1600,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const claudeResult: AnatomyResult = parseJson(text);

    // Step 3: Override Claude values with Spotify ground truth where available
    if (hasRealData && audioFeatures) {
      const confirmedKey = convertKey(audioFeatures.key, audioFeatures.mode);
      claudeResult.spotifyData = {
        tempo: Math.round(audioFeatures.tempo),
        key: confirmedKey,
        energy: Math.round(audioFeatures.energy * 100),
        acousticness: Math.round(audioFeatures.acousticness * 100),
        danceability: Math.round(audioFeatures.danceability * 100),
        instrumentalness: Math.round(audioFeatures.instrumentalness * 100),
        loudness: Math.round(audioFeatures.loudness * 10) / 10,
        valence: Math.round(audioFeatures.valence * 100),
      };
      claudeResult.key = confirmedKey;
      claudeResult.dynamicRange = deriveDynamicRange(audioFeatures.loudness);
      claudeResult.texture = deriveTexture(audioFeatures.instrumentalness, audioFeatures.acousticness);
    }

    claudeResult.hasRealData = hasRealData;
    claudeResult.confirmedBpm = hasRealData ? realBpm : null;

    return NextResponse.json(claudeResult);
  } catch (err) {
    console.error("Anatomy analyze error:", err);
    return NextResponse.json({ error: "Failed to analyze track anatomy." }, { status: 500 });
  }
}
