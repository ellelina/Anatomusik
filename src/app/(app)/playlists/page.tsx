/*
 * Playlist explorer page — lists all playlists as clickable links.
 * Each playlist links to /playlists/[id] for track analysis.
 * Access: /playlists
 */

"use client";

import { useEffect, useState } from "react";
import { SpotifyPlaylist } from "@/lib/types";
import AppNav from "@/components/AppNav";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/playlists")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch playlists");
        return res.json();
      })
      .then((data) => {
        setPlaylists(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <AppNav />

      <h1 className="text-2xl font-bold mb-6">Playlist Explorer</h1>
      <p className="text-neutral-500 text-sm mb-8">Click a playlist to analyze its tracks</p>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin mb-4" />
          <p className="text-neutral-300">Loading your playlists...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-8 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 mb-2">{error}</p>
          <a href="/api/auth/login" className="text-sm text-neutral-400 hover:text-white underline">
            Re-authenticate
          </a>
        </div>
      )}

      {playlists.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {playlists.map((pl) => (
            <a
              key={pl.id}
              href={`/playlists/${pl.id}?name=${encodeURIComponent(pl.name)}`}
              className="text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/[0.07] p-3 transition-all hover:scale-[1.02] block"
            >
              {pl.images?.[0]?.url ? (
                <img
                  src={pl.images[0].url}
                  alt={pl.name}
                  className="w-full aspect-square rounded-lg object-cover mb-2"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-white/10 flex items-center justify-center mb-2">
                  <span className="text-2xl text-neutral-600">♫</span>
                </div>
              )}
              <p className="text-sm font-medium text-white truncate">{pl.name}</p>
              <p className="text-xs text-neutral-500">{pl.tracks?.total ?? "?"} tracks</p>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
