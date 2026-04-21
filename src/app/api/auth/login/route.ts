/*
 * GET /api/auth/login
 * Redirects user to Spotify OAuth authorization page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const state = crypto.randomUUID();
  const authUrl = getAuthUrl(state);

  // Return redirect with state stored in a cookie
  const url = new URL(authUrl);
  const response = NextResponse.redirect(url);

  response.cookies.set("spotify_auth_state", state, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
