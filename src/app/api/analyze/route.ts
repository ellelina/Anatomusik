/*
 * GET /api/analyze — Server-Sent Events stream
 * Emits two events so the client can show progress immediately:
 *   1. { type: "spotify", recentTrackDetails } — fired as soon as Spotify fetch finishes (~4s)
 *   2. { type: "analysis", analysis }           — fired when Claude finishes (~8-15s more)
 * Requires a valid spotify_access_token cookie.
 */

import { NextRequest } from "next/server";
import { fetchUserData } from "@/lib/spotify";
import { analyzeListeningHistory } from "@/lib/anthropic";

export async function GET(request: NextRequest) {
  const rawToken = request.cookies.get("spotify_access_token")?.value;
  const accessToken = rawToken ? decodeURIComponent(rawToken) : undefined;

  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: "Not authenticated. Please log in with Spotify." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const spotifyData = await fetchUserData(accessToken);
        // Emit Spotify data immediately — client can start showing the UI
        send({ type: "spotify", recentTrackDetails: spotifyData.recentTrackDetails });

        const analysis = await analyzeListeningHistory(spotifyData);
        send({ type: "analysis", analysis });
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const isBilling = raw.includes("credit balance") || raw.includes("quota");
        send({
          type: "error",
          error: isBilling
            ? "Anthropic API credits exhausted — add credits at console.anthropic.com to use AI features."
            : "Analysis failed. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no", // disable Nginx buffering if behind a proxy
    },
  });
}
