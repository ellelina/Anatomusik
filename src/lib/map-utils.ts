/*
 * Map overlay utilities — genre resolution, energy mapping, and country lookups.
 * Used by Migration Trail, Radar, and Energy overlay features on /map.
 */

import { SCENE_ENTRIES, SceneEntry } from "./genre-map-data";
import { TrackAnalysis, EnergyRegion } from "./types";

// Keyword map: Spotify genre tags (lowercased substrings) → SCENE_ENTRIES name
const GENRE_TAG_TO_SCENE: Record<string, string> = {
  "uk garage": "UK Garage",
  "grime": "Grime",
  "baile funk": "Baile Funk",
  "funk carioca": "Baile Funk",
  "hyperpop": "Hyperpop",
  "footwork": "Footwork",
  "juke": "Footwork",
  "shoegaze": "Shoegaze Revival",
  "amapiano": "Amapiano",
  "city pop": "City Pop Revival",
  "japanese city pop": "City Pop Revival",
  "midwest emo": "Midwest Emo",
  "emo": "Midwest Emo",
  "uk drill": "UK Drill",
  "afrobeats": "Afrobeats",
  "afropop": "Afrobeats",
  "flamenco": "Flamenco Nuevo",
  "cumbia": "Cumbia Digital",
  "bedroom pop": "Bedroom Pop",
  "phonk": "Phonk",
  "vaporwave": "Vaporwave",
  "french house": "French House",
  "filter house": "French House",
  "bossa nova": "Bossa Nova Eletrônica",
  "k-indie": "K-Indie",
  "korean indie": "K-Indie",
  "melbourne bounce": "Melbourne Bounce",
  "synthwave": "Synthwave",
  "retrowave": "Synthwave",
  "afro house": "Afro-House",
  "afro-house": "Afro-House",
  "emo rap": "Emo Rap",
  "lo-fi": "Lo-fi Hip-Hop",
  "lofi": "Lo-fi Hip-Hop",
  "chillhop": "Lo-fi Hip-Hop",
  "reggaeton": "Reggaeton",
  "latin urban": "Reggaeton",
  "trap": "Trap",
  "atlanta": "Trap",
  "techno": "Techno",
  "berlin": "Techno",
  "dembow": "Dembow",
  "dancehall": "Dancehall",
  "kuduro": "Kuduro",
  "math rock": "Math Rock",
  "drill": "Drill (Chicago)",
  "chicago drill": "Drill (Chicago)",
  "k-pop": "K-Pop",
  "korean pop": "K-Pop",
  "nordic folk": "Nordic Folk",
  "icelandic": "Nordic Folk",
  "indie pop": "Bedroom Pop",
  "dream pop": "Shoegaze Revival",
  "post-punk": "Shoegaze Revival",
  "house": "French House",
  "electronic": "Techno",
  "hip hop": "Trap",
  "rap": "Trap",
  "r&b": "Lo-fi Hip-Hop",
  "pop": "K-Pop",
  "folk": "Nordic Folk",
  "experimental": "Hyperpop",
};

/**
 * Resolve an array of Spotify genre tags to the best-matching SCENE_ENTRY.
 * Scores each scene by how many tags partially match, returns the top scorer.
 */
export function resolveGenresToScene(
  spotifyGenreTags: string[]
): { sceneName: string; coordinates: [number, number]; region: string } | null {
  if (spotifyGenreTags.length === 0) return null;

  const scores = new Map<string, number>();

  for (const tag of spotifyGenreTags) {
    const lower = tag.toLowerCase();

    // Check keyword map (most specific matches first)
    for (const [keyword, sceneName] of Object.entries(GENRE_TAG_TO_SCENE)) {
      if (lower.includes(keyword)) {
        scores.set(sceneName, (scores.get(sceneName) || 0) + 2);
        break;
      }
    }

    // Also check direct scene name substring matches
    for (const scene of SCENE_ENTRIES) {
      if (lower.includes(scene.name.toLowerCase()) || scene.name.toLowerCase().includes(lower)) {
        scores.set(scene.name, (scores.get(scene.name) || 0) + 3);
      }
    }
  }

  if (scores.size === 0) return null;

  // Find highest-scored scene
  let bestScene = "";
  let bestScore = 0;
  scores.forEach((score, name) => {
    if (score > bestScore) {
      bestScore = score;
      bestScene = name;
    }
  });

  const entry = SCENE_ENTRIES.find((s) => s.name === bestScene);
  if (!entry) return null;

  return {
    sceneName: entry.name,
    coordinates: [entry.lng, entry.lat],
    region: entry.region,
  };
}

// Map SCENE_ENTRIES regions to TopoJSON country names (countries-110m.json)
export const REGION_TO_COUNTRIES: Record<string, string[]> = {
  "London, UK": ["United Kingdom"],
  "Manchester, UK": ["United Kingdom"],
  "Rio de Janeiro, Brazil": ["Brazil"],
  "São Paulo, Brazil": ["Brazil"],
  "Los Angeles, US": ["United States of America"],
  "Chicago, US": ["United States of America"],
  "Brooklyn, US": ["United States of America"],
  "Memphis, US": ["United States of America"],
  "Seattle, US": ["United States of America"],
  "Miami, US": ["United States of America"],
  "Atlanta, US": ["United States of America"],
  "New York, US": ["United States of America"],
  "Johannesburg, South Africa": ["South Africa"],
  "Cape Town, South Africa": ["South Africa"],
  "Tokyo, Japan": ["Japan"],
  "Osaka, Japan": ["Japan"],
  "Seoul, South Korea": ["South Korea"],
  "Paris, France": ["France"],
  "Berlin, Germany": ["Germany"],
  "Buenos Aires, Argentina": ["Argentina"],
  "Lagos, Nigeria": ["Nigeria"],
  "Seville, Spain": ["Spain"],
  "Melbourne, Australia": ["Australia"],
  "San Juan, Puerto Rico": ["Puerto Rico"],
  "Santo Domingo, DR": ["Dominican Rep."],
  "Kingston, Jamaica": ["Jamaica"],
  "Luanda, Angola": ["Angola"],
  "Reykjavik, Iceland": ["Iceland"],
};

/**
 * Build energy map from track analyses — groups by region, calculates avg BPM + dominant mood.
 */
export function buildEnergyMap(
  tracks: TrackAnalysis[],
  matchedGenres: string[]
): Map<string, EnergyRegion> {
  // Build genre → region lookup from SCENE_ENTRIES
  const genreToRegion = new Map<string, string>();
  for (const scene of SCENE_ENTRIES) {
    genreToRegion.set(scene.name.toLowerCase(), scene.region);
  }

  // Group tracks by region using their micro-genre labels
  const regionData = new Map<string, { bpms: number[]; moods: string[] }>();

  for (const track of tracks) {
    const trackRegions = new Set<string>();

    for (const genre of track.genres) {
      const lower = genre.toLowerCase();
      // Direct match
      const region = genreToRegion.get(lower);
      if (region) {
        trackRegions.add(region);
        continue;
      }
      // Fuzzy: check if any scene name is a substring
      for (const scene of SCENE_ENTRIES) {
        if (
          lower.includes(scene.name.toLowerCase()) ||
          scene.name.toLowerCase().includes(lower)
        ) {
          trackRegions.add(scene.region);
        }
      }
      // Keyword map fallback
      for (const [keyword, sceneName] of Object.entries(GENRE_TAG_TO_SCENE)) {
        if (lower.includes(keyword)) {
          const entry = SCENE_ENTRIES.find((s) => s.name === sceneName);
          if (entry) trackRegions.add(entry.region);
          break;
        }
      }
    }

    trackRegions.forEach((region) => {
      const data = regionData.get(region) || { bpms: [], moods: [] };
      if (track.estimatedBpm > 0) data.bpms.push(track.estimatedBpm);
      if (track.mood) data.moods.push(track.mood);
      regionData.set(region, data);
    });
  }

  // Calculate averages
  const result = new Map<string, EnergyRegion>();

  regionData.forEach((data, regionName) => {
    if (data.bpms.length === 0) return;

    const avgBpm = Math.round(
      data.bpms.reduce((a, b) => a + b, 0) / data.bpms.length
    );

    // Find dominant mood
    const moodCounts = new Map<string, number>();
    for (const mood of data.moods) {
      const key = mood.toLowerCase().trim();
      moodCounts.set(key, (moodCounts.get(key) || 0) + 1);
    }
    let dominantMood = "unknown";
    let maxCount = 0;
    moodCounts.forEach((count, mood) => {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    });

    result.set(regionName, {
      regionName,
      avgBpm,
      dominantMood,
      trackCount: data.bpms.length,
    });
  });

  return result;
}

/**
 * Returns fill color and opacity for a country based on average BPM.
 */
export function getEnergyColor(avgBpm: number): { fill: string; opacity: number } {
  if (avgBpm > 130) return { fill: "#D85A30", opacity: 0.25 };
  if (avgBpm >= 90) return { fill: "#7F77DD", opacity: 0.2 };
  return { fill: "#3B8BD4", opacity: 0.2 };
}

/**
 * Build a country-level energy map by aggregating region data via REGION_TO_COUNTRIES.
 */
export function buildCountryEnergyMap(
  regionMap: Map<string, EnergyRegion>
): Map<string, EnergyRegion> {
  const countryMap = new Map<string, { totalBpm: number; totalCount: number; moods: string[] }>();

  regionMap.forEach((data, regionName) => {
    const countries = REGION_TO_COUNTRIES[regionName] ?? [];
    for (const country of countries) {
      const existing = countryMap.get(country) || { totalBpm: 0, totalCount: 0, moods: [] };
      existing.totalBpm += data.avgBpm * data.trackCount;
      existing.totalCount += data.trackCount;
      existing.moods.push(data.dominantMood);
      countryMap.set(country, existing);
    }
  });

  const result = new Map<string, EnergyRegion>();
  countryMap.forEach((data, country) => {
    if (data.totalCount === 0) return;
    const avgBpm = Math.round(data.totalBpm / data.totalCount);

    // Pick most common mood
    const moodCounts = new Map<string, number>();
    for (const m of data.moods) moodCounts.set(m, (moodCounts.get(m) || 0) + 1);
    let dominantMood = "unknown";
    let maxC = 0;
    moodCounts.forEach((c, m) => {
      if (c > maxC) { maxC = c; dominantMood = m; }
    });

    result.set(country, {
      regionName: country,
      avgBpm,
      dominantMood,
      trackCount: data.totalCount,
    });
  });

  return result;
}
