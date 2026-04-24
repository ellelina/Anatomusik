/*
 * Shared TypeScript types for Spotify data and Claude analysis results.
 * Used across API routes and frontend components.
 */

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images: { url: string; height: number; width: number }[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  popularity: number;
  preview_url?: string | null;
}

export interface RecentTrackDetail {
  id: string;
  name: string;
  artists: string[];
  albumName: string;
  albumImage: string;
  genres: string[];
  bpm: number | null;
  estimatedBpm: number | null;
  playedAt?: string;        // ISO timestamp from Spotify recently-played
  previewUrl?: string | null;
}

export interface SpotifyData {
  topArtistsShort: SpotifyArtist[];
  topArtistsMedium: SpotifyArtist[];
  topArtistsLong: SpotifyArtist[];
  topTracksShort: SpotifyTrack[];
  topTracksMedium: SpotifyTrack[];
  recentlyPlayed: SpotifyTrack[];
  recentTrackDetails: RecentTrackDetail[];
  allGenres: string[];
  tasteTimeline: TasteTimelineEntry[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string; height: number; width: number }[];
  tracks: { total: number };
  owner: { display_name: string };
}

export interface PlaylistTrackDetail {
  id: string;
  name: string;
  artists: string[];
  artistIds: string[];
  albumName: string;
  albumImage: string;
  genres: string[];
  bpm: number | null;
  previewUrl?: string | null;
}

export interface PlaylistAnalysis {
  tracks: TrackAnalysis[];
}

export interface MicroGenre {
  name: string;
  description: string;
  confidence: "high" | "medium" | "low";
  representativeArtists: string[];
}

export interface TrackAnalysis {
  trackName: string;
  artists: string[];
  genres: string[];
  estimatedBpm: number | null;
  mood: string;
}

export interface SoundLayer {
  name: string;
  type: "melodic" | "harmonic" | "spatial" | "dynamic";
  shortDescription: string;
  presencePercent: number;
  explanation: string;
  questionTags: [string, string];
}

export interface AnatomyResult {
  layers: SoundLayer[];
  grooveFeel: {
    type: "straight" | "swung" | "syncopated" | "free";
    explanation: string;
    beatPattern: number[];
  };
  key: string;
  keyFeel: string;
  dynamicRange: "narrow" | "medium" | "wide";
  dynamicExplanation: string;
  texture: "sparse" | "layered" | "dense";
  textureExplanation: string;
  hasRealData: boolean;
  confirmedBpm: number | null;
  spotifyData?: {
    tempo: number;
    key: string;
    energy: number;
    acousticness: number;
    danceability: number;
    instrumentalness: number;
    loudness: number;
    valence: number;
  };
}

export interface SearchTrackResult {
  id: string;
  name: string;
  artists: string[];
  artistIds: string[];
  albumName: string;
  albumImage: string;
  genres: string[];
  spotifyUrl: string | null;
  uri: string | null;
  previewUrl?: string | null;
}

export interface AnalysisResult {
  musicPersonality: string;
  microGenres: MicroGenre[];
  uniqueInsights: string[];
  summary: string;
  trackAnalyses: TrackAnalysis[];
  matchedMapGenres: string[];
  tasteTimeline?: TasteTimelineEntry[];
}

export interface TasteTimelineEntry {
  period: 'long_term' | 'medium_term' | 'short_term';
  label: string;
  topGenres: string[];
  resolvedScene: string | null;
  coordinates: [number, number] | null;
}

export interface RadarSuggestion {
  name: string;
  region: string;
  lat: number;
  lng: number;
  reason: string;
}

export interface EnergyRegion {
  regionName: string;
  avgBpm: number;
  dominantMood: string;
  trackCount: number;
}
