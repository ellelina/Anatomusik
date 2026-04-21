/*
 * SVG world map with genre scene markers using react-simple-maps.
 * Renders TopoJSON geography + three-layer glowing dots for each scene.
 * Supports overlays: Migration Trail, Radar zones, Energy heat map.
 */

"use client";

import { memo, MouseEvent } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
  Line,
} from "react-simple-maps";
import { SceneEntry, SCENE_ENTRIES } from "@/lib/genre-map-data";
import { TasteTimelineEntry, RadarSuggestion, EnergyRegion } from "@/lib/types";
import { getEnergyColor } from "@/lib/map-utils";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Props {
  filteredNames: Set<string>;
  matchedGenres: string[];
  myTasteMode: boolean;
  center: [number, number];
  zoom: number;
  onMoveEnd: (pos: { coordinates: [number, number]; zoom: number }) => void;
  onHover: (scene: SceneEntry | null, e?: MouseEvent) => void;
  onDotClick: (scene: SceneEntry) => void;
  // Migration Trail
  migrationTrail: boolean;
  timeline: TasteTimelineEntry[];
  onTimelineHover: (entry: TasteTimelineEntry | null, e?: MouseEvent) => void;
  // Radar
  radarMode: boolean;
  radarProximityScenes: SceneEntry[];
  radarSuggestions: RadarSuggestion[];
  onRadarClick: (name: string) => void;
  onRadarHover: (suggestion: RadarSuggestion | null, e?: MouseEvent) => void;
  // Energy
  energyOverlay: boolean;
  countryEnergyMap: Map<string, EnergyRegion> | null;
  onEnergyHover: (region: EnergyRegion | null, e?: MouseEvent) => void;
}

function SceneMapCanvas({
  filteredNames,
  matchedGenres,
  myTasteMode,
  center,
  zoom,
  onMoveEnd,
  onHover,
  onDotClick,
  migrationTrail,
  timeline,
  onTimelineHover,
  radarMode,
  radarProximityScenes,
  radarSuggestions,
  onRadarClick,
  onRadarHover,
  energyOverlay,
  countryEnergyMap,
  onEnergyHover,
}: Props) {
  const matchedSet = new Set(matchedGenres);

  // Resolved timeline points (with valid coordinates)
  const resolvedTimeline = migrationTrail
    ? timeline.filter((t) => t.coordinates)
    : [];

  return (
    <ComposableMap
      projectionConfig={{ scale: 160, center: [0, 20] }}
      width={960}
      height={500}
      style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
    >
      <ZoomableGroup
        center={center}
        zoom={zoom}
        minZoom={1}
        maxZoom={8}
        onMoveEnd={onMoveEnd}
      >
        {/* Country fills — supports energy overlay coloring */}
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const countryName = geo.properties.name as string;
              const energyData =
                energyOverlay && countryEnergyMap
                  ? countryEnergyMap.get(countryName)
                  : null;
              const energyColor = energyData
                ? getEnergyColor(energyData.avgBpm)
                : null;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={energyColor ? energyColor.fill : "#1a1a1a"}
                  fillOpacity={energyColor ? energyColor.opacity : 1}
                  stroke="#2a2a2a"
                  strokeWidth={0.5}
                  onMouseEnter={(e: unknown) => {
                    if (energyData) onEnergyHover(energyData, e as MouseEvent);
                  }}
                  onMouseLeave={() => {
                    if (energyData) onEnergyHover(null);
                  }}
                  style={{
                    default: { outline: "none" },
                    hover: {
                      outline: "none",
                      fill: energyColor ? energyColor.fill : "#1e1e1e",
                      fillOpacity: energyColor
                        ? energyColor.opacity + 0.1
                        : 1,
                    },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* Radar: translucent zone circles around matched genres */}
        {radarMode &&
          SCENE_ENTRIES.filter((s) => matchedSet.has(s.name)).map((scene) => (
            <Marker key={`radar-zone-${scene.name}`} coordinates={[scene.lng, scene.lat]}>
              <circle
                r={30}
                fill={scene.color}
                opacity={0.06}
                stroke="none"
              />
            </Marker>
          ))}

        {/* Migration Trail: animated dashed lines between resolved timeline points */}
        {migrationTrail &&
          resolvedTimeline.length >= 2 &&
          resolvedTimeline.slice(0, -1).map((entry, i) => {
            const next = resolvedTimeline[i + 1];
            return (
              <Line
                key={`trail-${entry.period}-${next.period}`}
                from={entry.coordinates as [number, number]}
                to={next.coordinates as [number, number]}
                stroke="white"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeOpacity={0.4}
                className="trail-line-animated"
              />
            );
          })}

        {/* Migration Trail: stop dots */}
        {migrationTrail &&
          resolvedTimeline.map((entry, i) => (
            <Marker
              key={`trail-stop-${entry.period}`}
              coordinates={entry.coordinates as [number, number]}
            >
              <g
                onMouseEnter={(e) =>
                  onTimelineHover(entry, e as unknown as MouseEvent)
                }
                onMouseLeave={() => onTimelineHover(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Outer glow */}
                <circle r={8} fill="#f59e0b" opacity={0.15} />
                {/* Inner dot */}
                <circle
                  r={4}
                  fill={i === resolvedTimeline.length - 1 ? "#f59e0b" : "#f59e0b"}
                  opacity={i === resolvedTimeline.length - 1 ? 1 : 0.5 + i * 0.2}
                  stroke="white"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
              </g>
            </Marker>
          ))}

        {/* Scene dots */}
        {SCENE_ENTRIES.map((scene, i) => {
          const isFiltered = filteredNames.has(scene.name);
          const isMatched = matchedSet.has(scene.name);
          const isHighlighted = myTasteMode && isMatched;

          const baseOpacity = isFiltered ? 0.85 : 0.12;
          const dotOpacity = isHighlighted ? 1 : baseOpacity;
          const glowOpacity = isFiltered ? 0.08 : 0.02;
          const pulseOpacity = isFiltered ? 0.5 : 0.08;

          const delay = (i * 0.37) % 2.4;

          return (
            <Marker
              key={scene.name}
              coordinates={[scene.lng, scene.lat]}
            >
              <g
                onMouseEnter={(e) => onHover(scene, e as unknown as MouseEvent)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onDotClick(scene)}
                style={{ cursor: "pointer" }}
              >
                {/* Layer 1: Outer glow */}
                <circle
                  r={scene.radius * 2.5}
                  fill={scene.color}
                  opacity={glowOpacity}
                />

                {/* Layer 2: Pulse ring */}
                <circle
                  r={scene.radius * 1.6}
                  fill="none"
                  stroke={scene.color}
                  strokeWidth={1}
                  opacity={pulseOpacity}
                  className="scene-pulse-ring"
                  style={{ animationDelay: `${delay}s` }}
                />

                {/* Layer 3: Inner dot */}
                {scene.emerging ? (
                  <>
                    <circle
                      r={scene.radius}
                      fill={scene.color}
                      opacity={dotOpacity * 0.3}
                    />
                    <circle
                      r={scene.radius}
                      fill="none"
                      stroke={scene.color}
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      opacity={dotOpacity}
                    />
                  </>
                ) : (
                  <circle
                    r={scene.radius}
                    fill={scene.color}
                    opacity={dotOpacity}
                  />
                )}

                {/* Personal highlight ring */}
                {isHighlighted && (
                  <circle
                    r={scene.radius * 1.3}
                    fill="none"
                    stroke="white"
                    strokeWidth={1.5}
                    opacity={0.7}
                  />
                )}
              </g>
            </Marker>
          );
        })}

        {/* Radar: proximity discovery dots (unmatched scenes within radius) */}
        {radarMode &&
          radarProximityScenes.map((scene) => (
            <Marker
              key={`radar-prox-${scene.name}`}
              coordinates={[scene.lng, scene.lat]}
            >
              <g
                onClick={() => onRadarClick(scene.name)}
                style={{ cursor: "pointer" }}
              >
                {/* Ping animation */}
                <circle
                  r={8}
                  fill="none"
                  stroke="white"
                  strokeWidth={0.5}
                  opacity={0.3}
                  className="radar-ping-ring"
                />
                {/* Dashed ring */}
                <circle
                  r={5}
                  fill="none"
                  stroke="white"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  opacity={0.6}
                  className="radar-discovery-ring"
                />
                {/* "New?" label */}
                <text
                  y={-10}
                  textAnchor="middle"
                  fill="white"
                  fontSize={6}
                  opacity={0.7}
                  fontFamily="system-ui"
                  fontWeight={600}
                >
                  New?
                </text>
              </g>
            </Marker>
          ))}

        {/* Radar: Claude suggestion dots */}
        {radarMode &&
          radarSuggestions.map((suggestion) => (
            <Marker
              key={`radar-sug-${suggestion.name}`}
              coordinates={[suggestion.lng, suggestion.lat]}
            >
              <g
                onClick={() => onRadarClick(suggestion.name)}
                onMouseEnter={(e) =>
                  onRadarHover(suggestion, e as unknown as MouseEvent)
                }
                onMouseLeave={() => onRadarHover(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Ping animation */}
                <circle
                  r={10}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth={0.5}
                  opacity={0.3}
                  className="radar-ping-ring"
                />
                {/* Dashed ring */}
                <circle
                  r={6}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  opacity={0.7}
                  className="radar-discovery-ring"
                />
                {/* "New?" label */}
                <text
                  y={-12}
                  textAnchor="middle"
                  fill="#34d399"
                  fontSize={6}
                  opacity={0.8}
                  fontFamily="system-ui"
                  fontWeight={600}
                >
                  New?
                </text>
              </g>
            </Marker>
          ))}
      </ZoomableGroup>
    </ComposableMap>
  );
}

export default memo(SceneMapCanvas);
