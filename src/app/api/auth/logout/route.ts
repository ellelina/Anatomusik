/*
 * GET /api/auth/logout
 * Clears the access token cookie and redirects to home.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete("spotify_access_token");
  response.cookies.delete("spotify_auth_state");
  return response;
}
