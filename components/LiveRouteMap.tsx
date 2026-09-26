"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import { MapPin, Truck } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapPoint {
  id: string;
  label: string;
  detail?: string;
  latitude: number;
  longitude: number;
  kind: "truck" | "stop";
  done?: boolean;
  /** A stop on a trip that was interrupted, or that failed. */
  problem?: boolean;
}

export interface TrailPointInput {
  latitude: number;
  longitude: number;
}

interface LiveRouteMapProps {
  points: MapPoint[];
  /** Route already driven, oldest point first. */
  trail?: TrailPointInput[];
  /**
   * The road still to be driven, as [longitude, latitude] pairs. Drawn under
   * the trail and dashed, so the two are never mistaken for each other: one
   * is where the truck has been, the other is where it is going.
   */
  plannedRoute?: [number, number][];
  heightClass?: string;
  /** Shown when there is nothing to plot yet. */
  emptyMessage?: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Metro Manila, used only until the first real position arrives.
const FALLBACK_CENTER = { latitude: 14.5995, longitude: 120.9842, zoom: 10 };

function Placeholder({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 px-6 text-center">
      <p className="text-sm text-slate-600 max-w-sm">{message}</p>
    </div>
  );
}

export default function LiveRouteMap({
  points,
  trail = [],
  plannedRoute = [],
  heightClass = "h-96",
  emptyMessage = "No GPS positions to show yet.",
}: LiveRouteMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);

  // Refit only when the set of plotted points changes, so the map does not
  // jump away from wherever the user has panned on every refresh.
  const pointKey = points.map((p) => p.id).sort().join("|");

  const plannedGeoJson = useMemo(
    () =>
      ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: plannedRoute },
      }) as const,
    [plannedRoute],
  );

  // GeoJSON for the driven route; two points are the minimum for a line.
  const trailGeoJson = useMemo(
    () =>
      ({
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: trail.map((point) => [point.longitude, point.latitude]),
        },
      }),
    [trail],
  );

  const initialViewState = useMemo(() => {
    const firstTruck = points.find((p) => p.kind === "truck") ?? points[0];
    if (!firstTruck) return FALLBACK_CENTER;
    return { latitude: firstTruck.latitude, longitude: firstTruck.longitude, zoom: 12 };
  }, [points]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;

    if (points.length === 1) {
      map.easeTo({ center: [points[0].longitude, points[0].latitude], zoom: 13, duration: 600 });
      return;
    }

    const longitudes = points.map((p) => p.longitude);
    const latitudes = points.map((p) => p.latitude);
    map.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { padding: 64, duration: 600, maxZoom: 14 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`${heightClass} w-full overflow-hidden`}>
        <Placeholder message="Map unavailable: NEXT_PUBLIC_MAPBOX_TOKEN is not configured." />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className={`${heightClass} w-full overflow-hidden`}>
        <Placeholder message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className={`${heightClass} relative w-full overflow-hidden`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/*
          Where it has been, underneath and muted. It is raw GPS - it wanders
          off the road between fixes - and it is the less useful of the two to
          anyone looking at the map right now.
        */}
        {trail.length > 1 && (
          <Source id="route-trail" type="geojson" data={trailGeoJson}>
            <Layer
              id="route-trail-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#94a3b8", "line-width": 3, "line-opacity": 0.85 }}
            />
          </Source>
        )}

        {/*
          Where it is going, on top and in blue - the way a driver already
          reads a map, and what a coordinator is checking the truck against.
          A casing underneath keeps it legible over dark roads and parks.
        */}
        {plannedRoute.length > 1 && (
          <Source id="route-planned" type="geojson" data={plannedGeoJson}>
            <Layer
              id="route-planned-casing"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 }}
            />
            <Layer
              id="route-planned-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#2563eb", "line-width": 5, "line-opacity": 0.95 }}
            />
          </Source>
        )}

        {points.map((point) => (
          <Marker
            key={point.id}
            latitude={point.latitude}
            longitude={point.longitude}
            anchor="bottom"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              setSelected(point);
            }}
          >
            <button
              type="button"
              aria-label={point.label}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-110 ${
                point.kind === "truck"
                  ? "bg-blue-600 text-white"
                  : point.done
                    ? "bg-emerald-500 text-white"
                    : point.problem
                      ? "bg-red-600 text-white"
                      : "bg-slate-700 text-white"
              }`}
            >
              {point.kind === "truck" ? (
                <Truck className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </button>
          </Marker>
        ))}

        {selected && (
          <Popup
            latitude={selected.latitude}
            longitude={selected.longitude}
            anchor="top"
            onClose={() => setSelected(null)}
            closeButton
            closeOnClick={false}
          >
            <div className="px-1 py-0.5">
              <p className="text-xs font-bold text-slate-900">{selected.label}</p>
              {selected.detail && <p className="mt-0.5 text-xs sm:text-[11px] text-slate-600">{selected.detail}</p>}
            </div>
          </Popup>
        )}
      </Map>

      {(plannedRoute.length > 1 || trail.length > 1) && (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/95 px-3 py-2 shadow-sm ring-1 ring-slate-200">
          <ul className="space-y-1.5">
            {plannedRoute.length > 1 && (
              <li className="flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-blue-600" />
                <span className="text-xs font-medium text-slate-700">Route ahead</span>
              </li>
            )}
            {trail.length > 1 && (
              <li className="flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-slate-400" />
                <span className="text-xs font-medium text-slate-700">Already travelled</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
