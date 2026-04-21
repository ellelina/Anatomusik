/*
 * GET /callback
 * Handles the Spotify OAuth callback.
 * Exchanges the authorization code for an access token,
 * returns an HTML page that saves the cookie then redirects to dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }

  try {
    const tokenData = await exchangeCodeForToken(code);

    // Return an HTML page instead of a redirect so the Set-Cookie header
    // is processed by the browser before navigating to /dashboard
    const html = `<!DOCTYPE html>
<html><head><meta http-equiv="refresh" content="0;url=/dashboard"></head>
<body><p>Redirecting...</p></body></html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Set-Cookie": `spotify_access_token=${encodeURIComponent(tokenData.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${tokenData.expires_in}`,
      },
    });
  } catch (err) {
    console.error("Token exchange error:", err);
    return NextResponse.redirect(
      new URL("/?error=token_exchange_failed", request.url)
    );
  }
}
