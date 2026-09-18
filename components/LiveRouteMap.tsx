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
}

export interface TrailPointInput {
  latitude: number;
  longitude: number;
}

interface LiveRouteMapProps {
  points: MapPoint[];
  /** Route already driven, oldest point first. */
  trail?: TrailPointInput[];
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
  heightClass = "h-96",
  emptyMessage = "No GPS positions to show yet.",
}: LiveRouteMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);

  // Refit only when the set of plotted points changes, so the map does not
  // jump away from wherever the user has panned on every refresh.
  const pointKey = points.map((p) => p.id).sort().join("|");

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
    <div className={`${heightClass} w-full overflow-hidden`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {trail.length > 1 && (
          <Source id="route-trail" type="geojson" data={trailGeoJson}>
            <Layer
              id="route-trail-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.7 }}
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
    </div>
  );
}
