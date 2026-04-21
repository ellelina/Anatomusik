"use client";

import { useEffect, useState, useCallback } from "react";
import { TrackAnalysis } from "@/lib/types";

interface Recommendation {
  trackName: string;
  artists: string[];
  genres: string[];
  estimatedBpm: number;
  whyMatch: string;
}

interface Props {
  track: TrackAnalysis;
}

export default function RecommendPanel({ track }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    setRecommendations([]);

    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackName: track.trackName,
        artists: track.artists || [],
        genres: track.genres || [],
        bpm: track.estimatedBpm,
        mood: track.mood,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to get recommendations");
        return res.json();
      })
      .then((data) => {
        setRecommendations(data.recommendations || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [track.trackName, track.artists, track.genres, track.estimatedBpm, track.mood]);

  const openInSpotify = useCallback(async (rec: Recommendation, key: string) => {
    setOpening(key);
    try {
      const query = `${rec.trackName} ${(rec.artists || []).join(" ")}`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();

      if (data.uri) {
        window.location.href = data.uri;
        setTimeout(() => {
          if (data.spotifyUrl) {
            window.open(data.spotifyUrl, "_blank");
          }
        }, 1500);
      } else if (data.spotifyUrl) {
        window.open(data.spotifyUrl, "_blank");
      } else {
        window.open(
          `https://open.spotify.com/search/${encodeURIComponent(query)}`,
          "_blank"
        );
      }
    } catch {
      const query = `${rec.trackName} ${(rec.artists || []).join(" ")}`;
      window.open(
        `https://open.spotify.com/search/${encodeURIComponent(query)}`,
        "_blank"
      );
    }
    setOpening(null);
  }, []);

  return (
    <div className="ml-4 mr-1 mt-1 mb-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-emerald-400 text-sm font-semibold">Similar Songs</span>
        <span className="text-[11px] text-neutral-500">
          matching {(track.genres || []).join(" + ")} @ ~{track.estimatedBpm} BPM
        </span>
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
          <span className="text-sm text-neutral-400">Finding similar tracks...</span>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm py-2">{error}</p>
      )}

      {!loading && recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map((rec, i) => (
            <RecCard
              key={`rec-${i}`}
              rec={rec}
              index={i}
              cardKey={`rec-${i}`}
              opening={opening}
              onOpen={openInSpotify}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RecCard({
  rec,
  index,
  cardKey,
  opening,
  onOpen,
}: {
  rec: { trackName: string; artists: string[]; genres: string[]; estimatedBpm: number; whyMatch: string };
  index: number;
  cardKey: string;
  opening: string | null;
  onOpen: (rec: { trackName: string; artists: string[]; genres: string[]; estimatedBpm: number; whyMatch: string }, key: string) => void;
}) {
  return (
    <button
      onClick={() => onOpen(rec, cardKey)}
      disabled={opening === cardKey}
      className="w-full text-left flex items-start gap-3 p-3 rounded-lg bg-black/20 hover:bg-black/30 transition-colors group"
    >
      <span className="text-neutral-600 text-xs font-mono w-5 flex-shrink-0 pt-0.5 text-right">
        {opening === cardKey ? (
          <span className="inline-block w-3 h-3 border border-white/20 border-t-emerald-400 rounded-full animate-spin" />
        ) : (
          index + 1
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate group-hover:text-emerald-300 transition-colors">
              {rec.trackName}
              <span className="ml-2 text-[10px] text-emerald-500/0 group-hover:text-emerald-500 transition-colors">
                Play on Spotify ↗
              </span>
            </p>
            <p className="text-neutral-500 text-xs truncate">
              {(rec.artists || []).join(", ")}
            </p>
          </div>
          <span className="flex-shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">
            {rec.estimatedBpm}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {(rec.genres || []).map((g) => (
            <span
              key={g}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300"
            >
              {g}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
          {rec.whyMatch}
        </p>
      </div>
    </button>
  );
}
