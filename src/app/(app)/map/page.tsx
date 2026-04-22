/*
 * Scene Map page — interactive world map of micro-genre scenes.
 * Loads cached analysis from sessionStorage or re-fetches from Spotify + Claude.
 * Supports overlays: Migration Trail, Radar, Energy heat map.
 * Access: /map (requires Spotify auth)
 */

"use client";

import { useEffect, useState, useMemo, useCallback, MouseEvent } from "react";
import {
  AnalysisResult,
  SpotifyData,
  TasteTimelineEntry,
  RadarSuggestion,
  EnergyRegion,
} from "@/lib/types";
import { SceneEntry, SCENE_ENTRIES } from "@/lib/genre-map-data";
import {
  loadAnalysis,
  saveAnalysis,
  loadTimeline,
  saveTimeline,
  loadRadarResults,
  saveRadarResults,
} from "@/lib/analysis-cache";
import { useAnalysis } from "@/lib/AnalysisContext";
import { resolveGenresToScene, buildEnergyMap, buildCountryEnergyMap } from "@/lib/map-utils";
import NavBar from "./NavBar";
import FilterBar, { FilterType } from "./FilterBar";
import ZoomControls from "./ZoomControls";
import OverlayPanel from "./OverlayPanel";
import TooltipCard from "./TooltipCard";
import BottomSheet from "./BottomSheet";
import SceneMapCanvas from "./SceneMapCanvas";
import MigrationLegend from "./MigrationLegend";
import EnergyLegend from "./EnergyLegend";

type Stage = "loading" | "analyzing" | "done" | "error";

export default function MapPage() {
  const { stage: contextStage, result: contextResult } = useAnalysis();
  const [stage, setStage] = useState<Stage>("loading");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");

  // Map state
  const [center, setCenter] = useState<[number, number]>([0, 20]);
  const [zoom, setZoom] = useState(1);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [myTasteMode, setMyTasteMode] = useState(false);

  // Overlay toggles
  const [migrationTrail, setMigrationTrail] = useState(false);
  const [radarMode, setRadarMode] = useState(false);
  const [energyOverlay, setEnergyOverlay] = useState(false);

  // Overlay data
  const [timeline, setTimeline] = useState<TasteTimelineEntry[]>([]);
  const [radarSuggestions, setRadarSuggestions] = useState<RadarSuggestion[]>([]);
  const [radarLoading, setRadarLoading] = useState(false);

  // Tooltip / bottom sheet
  const [hoveredScene, setHoveredScene] = useState<SceneEntry | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipText, setTooltipText] = useState<string | null>(null);
  const [bottomSheetScene, setBottomSheetScene] = useState<SceneEntry | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Derived state
  const matchedGenres = useMemo(
    () => analysisResult?.matchedMapGenres || [],
    [analysisResult]
  );

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Use shared context — no duplicate fetch
  useEffect(() => {
    if (contextStage === "done" && contextResult) {
      setAnalysisResult(contextResult);
      setStage("done");

      const cachedTimeline = loadTimeline();
      if (cachedTimeline) setTimeline(cachedTimeline);
      const cachedRadar = loadRadarResults();
      if (cachedRadar) setRadarSuggestions(cachedRadar);
    } else if (contextStage === "error") {
      setError("Failed to load analysis");
      setStage("error");
    } else if (contextStage === "loading-spotify") {
      setStage("loading");
    } else if (contextStage === "analyzing") {
      setStage("analyzing");
    }
  }, [contextStage, contextResult]);

  // Lazy-fetch radar suggestions when toggle is turned on
  useEffect(() => {
    if (!radarMode || radarSuggestions.length > 0 || radarLoading) return;
    if (matchedGenres.length === 0) return;

    const cached = loadRadarResults();
    if (cached && cached.length > 0) {
      setRadarSuggestions(cached);
      return;
    }

    setRadarLoading(true);
    fetch("/api/radar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchedGenres }),
    })
      .then((res) => res.json())
      .then((data) => {
        const suggestions = data.suggestions || [];
        setRadarSuggestions(suggestions);
        saveRadarResults(suggestions);
      })
      .catch(() => {
        // Radar is non-critical, fail silently
      })
      .finally(() => setRadarLoading(false));
  }, [radarMode, matchedGenres, radarSuggestions.length, radarLoading]);

  // Filter logic
  const filteredNames = useMemo(() => {
    let scenes: SceneEntry[];
    if (activeFilter === "All") scenes = SCENE_ENTRIES;
    else if (activeFilter === "Emerging only")
      scenes = SCENE_ENTRIES.filter((s) => s.emerging);
    else if (activeFilter === "My genres")
      scenes = SCENE_ENTRIES.filter((s) => matchedGenres.includes(s.name));
    else if (activeFilter === "Indie/alt")
      scenes = SCENE_ENTRIES.filter((s) => s.category === "Indie");
    else scenes = SCENE_ENTRIES.filter((s) => s.category === activeFilter);
    return new Set(scenes.map((s) => s.name));
  }, [activeFilter, matchedGenres]);

  // Fly to region when filter changes
  useEffect(() => {
    if (activeFilter === "All") {
      setCenter([0, 20]);
      setZoom(1);
      return;
    }
    const matching = SCENE_ENTRIES.filter((s) => filteredNames.has(s.name));
    if (matching.length === 0) return;
    const avgLat = matching.reduce((a, s) => a + s.lat, 0) / matching.length;
    const avgLng = matching.reduce((a, s) => a + s.lng, 0) / matching.length;
    setCenter([avgLng, avgLat]);
    setZoom(matching.length <= 3 ? 3.5 : 2);
  }, [activeFilter, filteredNames]);

  // Radar proximity scenes — unmatched scenes within radius of matched ones
  const radarProximityScenes = useMemo(() => {
    if (!radarMode) return [];
    const matchedSet = new Set(matchedGenres);
    const matchedEntries = SCENE_ENTRIES.filter((s) => matchedSet.has(s.name));

    // Also exclude Claude suggestions to avoid double-rendering
    const suggestionNames = new Set(radarSuggestions.map((s) => s.name));

    return SCENE_ENTRIES.filter((s) => {
      if (matchedSet.has(s.name)) return false;
      if (suggestionNames.has(s.name)) return false;
      return matchedEntries.some((m) => {
        const dlat = s.lat - m.lat;
        const dlng = s.lng - m.lng;
        return Math.sqrt(dlat * dlat + dlng * dlng) < 18;
      });
    });
  }, [radarMode, matchedGenres, radarSuggestions]);

  // Energy map — compute country-level BPM data
  const countryEnergyMap = useMemo(() => {
    if (!energyOverlay || !analysisResult?.trackAnalyses) return null;
    const regionMap = buildEnergyMap(analysisResult.trackAnalyses, matchedGenres);
    return buildCountryEnergyMap(regionMap);
  }, [energyOverlay, analysisResult, matchedGenres]);

  const handleMoveEnd = useCallback(
    (pos: { coordinates: [number, number]; zoom: number }) => {
      setCenter(pos.coordinates);
      setZoom(pos.zoom);
    },
    []
  );

  const handleHover = useCallback(
    (scene: SceneEntry | null, e?: MouseEvent) => {
      if (isMobile) return;
      setHoveredScene(scene);
      setTooltipText(null);
      if (scene && e) {
        setTooltipPos({ x: e.clientX, y: e.clientY });
      }
    },
    [isMobile]
  );

  const handleDotClick = useCallback(
    (scene: SceneEntry) => {
      setCenter([scene.lng, scene.lat]);
      setZoom(4);
      if (isMobile) {
        setBottomSheetScene(scene);
      }
    },
    [isMobile]
  );

  const handleTimelineHover = useCallback(
    (entry: TasteTimelineEntry | null, e?: MouseEvent) => {
      if (isMobile) return;
      setHoveredScene(null);
      if (entry && entry.resolvedScene && e) {
        const scene = SCENE_ENTRIES.find((s) => s.name === entry.resolvedScene);
        setTooltipText(
          `${entry.label} · ${entry.resolvedScene}${scene ? ` · ${scene.region}` : ""}`
        );
        setTooltipPos({ x: e.clientX, y: e.clientY });
      } else {
        setTooltipText(null);
      }
    },
    [isMobile]
  );

  const handleRadarClick = useCallback((name: string) => {
    window.location.href = `/search?q=${encodeURIComponent(name)}`;
  }, []);

  const handleRadarHover = useCallback(
    (suggestion: RadarSuggestion | null, e?: MouseEvent) => {
      if (isMobile) return;
      setHoveredScene(null);
      if (suggestion && e) {
        setTooltipText(`${suggestion.name} · ${suggestion.region}\n${suggestion.reason}`);
        setTooltipPos({ x: e.clientX, y: e.clientY });
      } else {
        setTooltipText(null);
      }
    },
    [isMobile]
  );

  const handleEnergyHover = useCallback(
    (region: EnergyRegion | null, e?: MouseEvent) => {
      if (isMobile) return;
      setHoveredScene(null);
      if (region && e) {
        setTooltipText(`${region.avgBpm} avg BPM · ${region.dominantMood}`);
        setTooltipPos({ x: e.clientX, y: e.clientY });
      } else {
        setTooltipText(null);
      }
    },
    [isMobile]
  );

  const handleOverlayToggle = useCallback(
    (overlay: "myTaste" | "migration" | "radar" | "energy") => {
      switch (overlay) {
        case "myTaste":
          setMyTasteMode((v) => !v);
          break;
        case "migration":
          setMigrationTrail((v) => !v);
          break;
        case "radar":
          setRadarMode((v) => !v);
          break;
        case "energy":
          setEnergyOverlay((v) => !v);
          break;
      }
    },
    []
  );

  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(z * 1.5, 8)),
    []
  );

  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(z / 1.5, 1)),
    []
  );

  if (stage === "error") {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "radial-gradient(ellipse at 50% 30%, #09071a 0%, #05040f 100%)" }}>
        <div className="text-center">
          <p className="text-red-400 text-lg font-medium mb-2">Something went wrong</p>
          <p className="text-neutral-500 mb-4">{error}</p>
          <a
            href="/api/auth/login"
            className="inline-block bg-white/10 hover:bg-white/15 text-white px-6 py-2 rounded-full text-sm transition-colors"
          >
            Log in again
          </a>
        </div>
      </div>
    );
  }

  // Compute legend bottom offsets so they stack
  const migrationLegendBottom = 16;
  const energyLegendBottom = migrationTrail && timeline.filter((t) => t.resolvedScene).length >= 2
    ? 140
    : 16;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 30%, #09071a 0%, #05040f 100%)" }}>
      <NavBar />
      <FilterBar
        activeFilter={activeFilter}
        onFilter={setActiveFilter}
        hasMatchedGenres={matchedGenres.length > 0}
      />
      <OverlayPanel
        myTasteMode={myTasteMode}
        migrationTrail={migrationTrail}
        radar={radarMode}
        energy={energyOverlay}
        onToggle={handleOverlayToggle}
      />

      {/* Loading overlay */}
      {(stage === "loading" || stage === "analyzing") && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center backdrop-blur-sm rounded-2xl px-8 py-6" style={{ background: "rgba(9,7,26,0.85)", border: "1px solid rgba(180,200,255,0.08)" }}>
            <div className="inline-block w-8 h-8 border-2 border-white/20 border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin mb-3" />
            <p className="text-white text-sm font-medium">
              {stage === "loading"
                ? "Fetching your Spotify data..."
                : "Analyzing your taste..."}
            </p>
            <p className="text-neutral-500 text-xs mt-1">
              The map will light up with your scenes
            </p>
          </div>
        </div>
      )}

      {/* Radar loading indicator */}
      {radarMode && radarLoading && (
        <div className="fixed bottom-4 right-4 z-20 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "rgba(9,7,26,0.9)", border: "1px solid rgba(180,200,255,0.15)" }}>
          <div className="w-3 h-3 border border-[rgba(160,184,255,0.3)] border-t-[rgba(160,184,255,0.9)] rounded-full animate-spin" />
          <span className="text-xs" style={{ color: "rgba(180,200,255,0.7)" }}>Finding discoveries...</span>
        </div>
      )}

      {/* Map canvas */}
      <div className="absolute inset-0 pt-[52px]">
        <SceneMapCanvas
          filteredNames={filteredNames}
          matchedGenres={matchedGenres}
          myTasteMode={myTasteMode}
          center={center}
          zoom={zoom}
          onMoveEnd={handleMoveEnd}
          onHover={handleHover}
          onDotClick={handleDotClick}
          migrationTrail={migrationTrail}
          timeline={timeline}
          onTimelineHover={handleTimelineHover}
          radarMode={radarMode}
          radarProximityScenes={radarProximityScenes}
          radarSuggestions={radarSuggestions}
          onRadarClick={handleRadarClick}
          onRadarHover={handleRadarHover}
          energyOverlay={energyOverlay}
          countryEnergyMap={countryEnergyMap}
          onEnergyHover={handleEnergyHover}
        />
      </div>

      <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

      {/* Desktop tooltip — scene card or text overlay */}
      {!isMobile && hoveredScene && !tooltipText && (
        <TooltipCard scene={hoveredScene} pos={tooltipPos} />
      )}

      {/* Generic text tooltip (for timeline, radar, energy hovers) */}
      {!isMobile && tooltipText && (
        <div
          className="fixed z-30 pointer-events-none rounded-xl px-3 py-2 shadow-2xl animate-fade-in max-w-[260px]"
          style={{ background: "rgba(9,7,26,0.95)", border: "1px solid rgba(180,200,255,0.1)" }}
          style={{
            left: Math.min(tooltipPos.x + 12, window.innerWidth - 280),
            top: Math.min(tooltipPos.y + 12, window.innerHeight - 60),
          }}
        >
          {tooltipText.split("\n").map((line, i) => (
            <p
              key={i}
              className={`text-xs ${i === 0 ? "text-white font-medium" : "text-neutral-400 mt-1"}`}
            >
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Legends */}
      {migrationTrail && (
        <MigrationLegend timeline={timeline} offsetBottom={migrationLegendBottom} />
      )}
      {energyOverlay && <EnergyLegend offsetBottom={energyLegendBottom} />}

      {/* Mobile bottom sheet */}
      {isMobile && bottomSheetScene && (
        <BottomSheet
          scene={bottomSheetScene}
          onClose={() => setBottomSheetScene(null)}
        />
      )}
    </div>
  );
}
