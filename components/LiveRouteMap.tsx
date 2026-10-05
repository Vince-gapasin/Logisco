"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Marker,
  Popup,
  Source,
  type MapRef,
} from "react-map-gl/mapbox";
import type { GeoJSONSource } from "mapbox-gl";
import { LocateFixed, MapPin, Maximize, Minimize, Minus, Package, Plus, ScanSearch, TrafficCone, Truck } from "lucide-react";
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
  /** A stop's place in the run, drawn on its pin: 1, 2, 3. */
  order?: number;
  /** Whether a stop is collected from or delivered to. Pickups are square pins. */
  stopKind?: "pickup" | "delivery";
  /** When a truck last sent its position. Long enough ago and it is greyed out. */
  lastSeen?: string | null;
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
  /**
   * Fly to this point and open its label. `at` goes up with every request, so
   * asking for the same truck twice still moves the map.
   */
  focus?: { id: string; at: number } | null;
  /** Trucks close together become one numbered bubble. For the fleet map. */
  cluster?: boolean;
  /** Offers the live traffic layer. */
  trafficToggle?: boolean;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Metro Manila, used only until the first real position arrives.
const FALLBACK_CENTER = { latitude: 14.5995, longitude: 120.9842, zoom: 10 };

// A parked truck still sends its position every three minutes (the crew app's
// heartbeat), so silence past five means the signal is gone, not that the truck
// has stopped. Grey, rather than the blue of a truck we can see.
const STALE_AFTER_MS = 5 * 60_000;

// Further than this between two fixes is not driving: the first fix, or a
// phone that was off. The truck is moved there at once rather than slid
// across the city.
const JUMP_KM = 3;
const GLIDE_MS = 1200;

const FIT_PADDING = 64;

// Trucks closer than this on screen share a bubble, up to the zoom where a
// street's worth of trucks can be told apart.
const CLUSTER_RADIUS_PX = 48;
const CLUSTER_MAX_ZOOM = 14;
const CLUSTER_SOURCE = "truck-clusters";

// Mapbox's live traffic. Only slow and worse is drawn: free-flowing roads in
// green would paint the whole city and bury the route.
const TRAFFIC_COLOURS = { moderate: "#f59e0b", heavy: "#ef4444", severe: "#991b1b" } as const;
const TRAFFIC_KEY = "logisco.map.traffic";

interface Bubble {
  clusterID: number;
  count: number;
  latitude: number;
  longitude: number;
}

function Placeholder({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 px-6 text-center">
      <p className="text-sm text-slate-600 max-w-sm">{message}</p>
    </div>
  );
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function boundsOf(points: { latitude: number; longitude: number }[]): [[number, number], [number, number]] {
  const longitudes = points.map((p) => p.longitude);
  const latitudes = points.map((p) => p.latitude);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

function silentFor(lastSeen: string | null | undefined, now: number): number | null {
  if (!lastSeen) return null;
  const at = new Date(lastSeen).getTime();
  return Number.isNaN(at) ? null : now - at;
}

function lastSeenLabel(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `Last seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Last seen ${hours} h ago` : `Last seen ${Math.floor(hours / 24)} d ago`;
}

/**
 * A position that slides to each new fix instead of jumping, so a truck
 * reporting every few seconds reads as driving rather than teleporting.
 */
function useGlide(latitude: number, longitude: number) {
  const [shown, setShown] = useState({ latitude, longitude });
  const shownRef = useRef(shown);

  useEffect(() => {
    const from = shownRef.current;
    const to = { latitude, longitude };
    if (from.latitude === to.latitude && from.longitude === to.longitude) return;

    const set = (next: { latitude: number; longitude: number }) => {
      shownRef.current = next;
      setShown(next);
    };

    if (distanceKm(from, to) > JUMP_KM) {
      set(to);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const step = (time: number) => {
      const t = Math.min(1, (time - start) / GLIDE_MS);
      const ease = 1 - (1 - t) ** 3;
      set({
        latitude: from.latitude + (to.latitude - from.latitude) * ease,
        longitude: from.longitude + (to.longitude - from.longitude) * ease,
      });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [latitude, longitude]);

  return shown;
}

function PointMarker({
  point,
  now,
  onSelect,
}: {
  point: MapPoint;
  now: number;
  onSelect: (point: MapPoint) => void;
}) {
  const position = useGlide(point.latitude, point.longitude);
  const isTruck = point.kind === "truck";
  const silence = isTruck ? silentFor(point.lastSeen, now) : null;
  const stale = silence !== null && silence > STALE_AFTER_MS;
  const pickup = point.stopKind === "pickup";

  const colour = isTruck
    ? stale
      ? "bg-slate-400 text-white"
      : "bg-blue-600 text-white"
    : point.done
      ? "bg-emerald-500 text-white"
      : point.problem
        ? "bg-red-600 text-white"
        : pickup
          ? "bg-amber-600 text-white"
          : "bg-slate-700 text-white";

  return (
    <Marker
      latitude={position.latitude}
      longitude={position.longitude}
      anchor="bottom"
      // Trucks over stops: the thing being followed should never be hidden.
      style={{ zIndex: isTruck ? 2 : 1 }}
      onClick={(event) => {
        event.originalEvent.stopPropagation();
        onSelect(point);
      }}
    >
      <div className="relative flex flex-col items-center">
        <button
          type="button"
          aria-label={point.order ? `${point.label}, stop ${point.order}` : point.label}
          className={`flex h-7 min-w-7 items-center justify-center border-2 border-white px-1 text-xs font-bold shadow-md transition-transform hover:scale-110 ${
            pickup ? "rounded-md" : "rounded-full"
          } ${colour}`}
        >
          {isTruck ? (
            <Truck className="h-4 w-4" />
          ) : point.order ? (
            point.order
          ) : pickup ? (
            <Package className="h-4 w-4" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </button>
        {stale && silence !== null && (
          <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
            {lastSeenLabel(silence)}
          </span>
        )}
      </div>
    </Marker>
  );
}

function ControlButton({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={`flex h-9 w-9 items-center justify-center first:rounded-t-lg last:rounded-b-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
        active ? "text-blue-600" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function LiveRouteMap({
  points,
  trail = [],
  plannedRoute = [],
  heightClass = "h-96",
  emptyMessage = "No GPS positions to show yet.",
  focus = null,
  cluster = false,
  trafficToggle = false,
}: LiveRouteMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  // "native": the browser's full screen. "page": the map covering the page,
  // for an iPhone, which does not let a page take over the screen.
  const [fullScreen, setFullScreen] = useState<"native" | "page" | null>(null);

  const trucks = useMemo(() => points.filter((p) => p.kind === "truck"), [points]);
  const soleTruck = trucks.length === 1 ? trucks[0] : null;

  // With one truck on the map, the map keeps it in view as it moves. Dragging
  // the map stops that - somebody looking at a stop does not want to be pulled
  // back - and the Re-center button starts it again.
  const [following, setFollowingState] = useState(true);
  const followingRef = useRef(true);
  const setFollowing = useCallback((on: boolean) => {
    followingRef.current = on;
    setFollowingState(on);
  }, []);

  // Remembered per browser: a coordinator who wants traffic on wants it on
  // every time they open the board.
  const [traffic, setTraffic] = useState(() => {
    if (!trafficToggle || typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(TRAFFIC_KEY) === "on";
    } catch {
      return false;
    }
  });
  // The route line it is slid beneath, when switched on over a map that
  // already has one.
  const [trafficBelow, setTrafficBelow] = useState<string | undefined>(undefined);
  const toggleTraffic = useCallback(() => {
    const map = mapRef.current?.getMap();
    setTrafficBelow(["route-trail-line", "route-planned-casing"].find((id) => map?.getLayer(id)));
    setTraffic((on) => {
      try {
        window.localStorage.setItem(TRAFFIC_KEY, on ? "off" : "on");
      } catch {
        // Private browsing: it simply is not remembered.
      }
      return !on;
    });
  }, []);

  // Grouping. Mapbox works out the groups from the trucks' positions; the
  // bubbles and the trucks left over are drawn here as ordinary markers, so
  // they look like every other pin. Worked out again whenever the map settles.
  const clustering = cluster && trucks.length > 1;
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [grouped, setGrouped] = useState<Set<string>>(() => new Set());

  const clusterData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: trucks.map((truck) => ({
        type: "Feature" as const,
        properties: { id: truck.id },
        geometry: { type: "Point" as const, coordinates: [truck.longitude, truck.latitude] },
      })),
    }),
    [trucks],
  );

  const regroup = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !clustering) return;
    if (!map.getSource(CLUSTER_SOURCE) || !map.isSourceLoaded(CLUSTER_SOURCE)) return;

    const next = new globalThis.Map<number, Bubble>();
    const single = new Set<string>();
    for (const feature of map.querySourceFeatures(CLUSTER_SOURCE)) {
      const props = feature.properties ?? {};
      if (props.cluster) {
        const [longitude, latitude] = (feature.geometry as GeoJSON.Point).coordinates;
        next.set(props.cluster_id as number, {
          clusterID: props.cluster_id as number,
          count: props.point_count as number,
          latitude,
          longitude,
        });
      } else if (typeof props.id === "string") {
        single.add(props.id);
      }
    }

    // A truck in view that Mapbox did not hand back on its own is inside a
    // bubble. One out of view is left alone: it is not drawn either way.
    const bounds = map.getBounds();
    const hidden = new Set(
      trucks
        .filter((t) => !single.has(t.id) && bounds?.contains([t.longitude, t.latitude]))
        .map((t) => t.id),
    );
    const list = [...next.values()];
    const key = (b: Bubble[]) => b.map((x) => `${x.clusterID}:${x.count}`).join();

    // Only when something changed: setting state on every settle would
    // re-render, and the map settles again.
    setBubbles((current) => (key(current) === key(list) ? current : list));
    setGrouped((current) =>
      current.size === hidden.size && [...hidden].every((id) => current.has(id)) ? current : hidden,
    );
  }, [clustering, trucks]);

  const openBubble = useCallback(
    (bubble: Bubble) => {
      const map = mapRef.current?.getMap();
      const source = map?.getSource(CLUSTER_SOURCE) as GeoJSONSource | undefined;
      source?.getClusterExpansionZoom(bubble.clusterID, (error, zoom) => {
        if (error || zoom == null) return;
        setFollowing(false);
        map?.easeTo({ center: [bubble.longitude, bubble.latitude], zoom: zoom + 0.5, duration: 500 });
      });
    },
    [setFollowing],
  );

  // Ticks so a truck goes grey when it falls silent, without a new fix.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  // Framed from the start: the map is not ready yet when the effects below
  // first run, so fitting it there left it zoomed in on the first truck with
  // the rest of the fleet, or the stops, out of view.
  const initialViewState = useMemo(() => {
    if (points.length === 0) return FALLBACK_CENTER;
    if (points.length === 1) return { latitude: points[0].latitude, longitude: points[0].longitude, zoom: 14 };
    return { bounds: boundsOf(points), fitBoundsOptions: { padding: FIT_PADDING, maxZoom: 15 } };
    // Only read on the map's first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fit = useCallback((targets: { latitude: number; longitude: number }[]) => {
    const map = mapRef.current;
    if (!map || targets.length === 0) return;
    if (targets.length === 1) {
      map.easeTo({ center: [targets[0].longitude, targets[0].latitude], zoom: Math.max(map.getZoom(), 14), duration: 600 });
      return;
    }
    map.fitBounds(boundsOf(targets), { padding: FIT_PADDING, duration: 600, maxZoom: 15 });
  }, []);

  /** Everything on the map: the truck and every stop. */
  const showAll = useCallback(() => {
    setFollowing(false);
    fit(points);
  }, [fit, points, setFollowing]);

  /** Back to the truck, following it again; or to every truck on a fleet map. */
  const recenter = useCallback(() => {
    setFollowing(true);
    fit(trucks.length > 0 ? trucks : points);
  }, [fit, trucks, points, setFollowing]);

  // Asked to look at one point, from a list beside the map.
  const focusAt = focus?.at;
  useEffect(() => {
    if (!focus) return;
    const point = points.find((p) => p.id === focus.id);
    const map = mapRef.current;
    if (!point || !map) return;
    setFollowing(false);
    setSelected(point);
    // Past the zoom where trucks are grouped, so it is not inside a bubble.
    map.easeTo({ center: [point.longitude, point.latitude], zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM + 1), duration: 700 });
    // Only when asked again, not whenever the truck reports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAt]);

  useEffect(() => {
    if (points.length === 0) return;
    fit(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey]);

  // Following: keep the truck in the middle as it moves, at whatever zoom the
  // user has chosen. Only on a move - the first fix is framed with the stops
  // above, and Re-center does its own framing.
  const truckLat = soleTruck?.latitude;
  const truckLng = soleTruck?.longitude;
  const lastTruck = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (truckLat === undefined || truckLng === undefined) return;
    const key = `${truckLat},${truckLng}`;
    const moved = lastTruck.current !== null && lastTruck.current !== key;
    lastTruck.current = key;
    if (!map || !moved || !followingRef.current) return;
    map.easeTo({ center: [truckLng, truckLat], duration: GLIDE_MS });
  }, [truckLat, truckLng]);

  const toggleFullScreen = useCallback(() => {
    const frame = frameRef.current;
    if (fullScreen === "native") void document.exitFullscreen();
    else if (fullScreen === "page") setFullScreen(null);
    else if (frame?.requestFullscreen && document.fullscreenEnabled) {
      frame.requestFullscreen().catch(() => setFullScreen("page"));
    } else setFullScreen("page");
  }, [fullScreen]);

  useEffect(() => {
    const onChange = () => setFullScreen(document.fullscreenElement === frameRef.current ? "native" : null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    // The canvas has to be told its box changed size.
    const timer = window.setTimeout(() => mapRef.current?.resize(), 50);
    if (fullScreen !== "page") return () => window.clearTimeout(timer);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullScreen(null);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullScreen]);

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

  const hasPickups = points.some((p) => p.kind === "stop" && p.stopKind === "pickup");
  const hasDeliveries = points.some((p) => p.kind === "stop" && p.stopKind !== "pickup");
  const showLegend = plannedRoute.length > 1 || trail.length > 1 || (hasPickups && hasDeliveries) || traffic;

  return (
    <div
      ref={frameRef}
      className={`${fullScreen === "page" ? "fixed inset-0 z-90 h-dvh" : `relative ${fullScreen === "native" ? "h-full" : heightClass}`} w-full overflow-hidden bg-slate-100`}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        // Only a drag by a person stops following; the map's own moves do not.
        onDragStart={() => setFollowing(false)}
        onIdle={clustering ? regroup : undefined}
      >
        {/*
          Live traffic, under the routes so the road ahead stays readable on
          top of it. Listed first, so on a fresh map it is added first; switched
          on later, it is slid beneath whichever route line is already there.
        */}
        {traffic && (
          <Source id="traffic" type="vector" url="mapbox://mapbox.mapbox-traffic-v1">
            <Layer
              id="traffic-line"
              type="line"
              source-layer="traffic"
              beforeId={trafficBelow}
              filter={["in", ["get", "congestion"], ["literal", Object.keys(TRAFFIC_COLOURS)]]}
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": [
                  "match",
                  ["get", "congestion"],
                  "moderate",
                  TRAFFIC_COLOURS.moderate,
                  "heavy",
                  TRAFFIC_COLOURS.heavy,
                  TRAFFIC_COLOURS.severe,
                ],
                "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 16, 4],
                "line-opacity": 0.85,
              }}
            />
          </Source>
        )}

        {/*
          The trucks again, for Mapbox to group. Drawn invisibly: a source with
          no layer is never loaded, and the pins people see are the markers
          below.
        */}
        {clustering && (
          <Source
            id={CLUSTER_SOURCE}
            type="geojson"
            data={clusterData}
            cluster
            clusterRadius={CLUSTER_RADIUS_PX}
            clusterMaxZoom={CLUSTER_MAX_ZOOM}
          >
            <Layer id="truck-clusters-probe" type="circle" paint={{ "circle-radius": 1, "circle-opacity": 0 }} />
          </Source>
        )}

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

        {points
          .filter((point) => !(clustering && grouped.has(point.id)))
          .map((point) => (
            <PointMarker key={point.id} point={point} now={now} onSelect={setSelected} />
          ))}

        {clustering &&
          bubbles.map((bubble) => (
            <Marker
              key={bubble.clusterID}
              latitude={bubble.latitude}
              longitude={bubble.longitude}
              anchor="center"
              style={{ zIndex: 3 }}
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                openBubble(bubble);
              }}
            >
              <button
                type="button"
                aria-label={`${bubble.count} trucks here - zoom in`}
                className="flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border-[3px] border-white bg-blue-600 px-2 text-sm font-bold text-white shadow-lg ring-4 ring-blue-600/25 transition-transform hover:scale-110"
              >
                <Truck className="h-3.5 w-3.5" />
                {bubble.count}
              </button>
            </Marker>
          ))}

        {selected && (
          <Popup
            // The live point, so a truck's popup goes with the truck.
            latitude={(points.find((p) => p.id === selected.id) ?? selected).latitude}
            longitude={(points.find((p) => p.id === selected.id) ?? selected).longitude}
            anchor="top"
            onClose={() => setSelected(null)}
            closeButton
            closeOnClick={false}
          >
            <div className="px-1 py-0.5">
              <p className="text-xs font-bold text-slate-900">
                {selected.order ? `${selected.stopKind === "pickup" ? "Pickup" : "Stop"} ${selected.order} - ` : ""}
                {selected.label}
              </p>
              {selected.detail && <p className="mt-0.5 text-xs sm:text-[11px] text-slate-600">{selected.detail}</p>}
            </div>
          </Popup>
        )}
      </Map>

      {/* Zoom, back to the truck, everything, full screen. */}
      <div className="absolute right-3 top-3 flex flex-col divide-y divide-slate-200 rounded-lg bg-white shadow-md ring-1 ring-slate-200">
        <ControlButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus className="h-4 w-4" />
        </ControlButton>
        <ControlButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus className="h-4 w-4" />
        </ControlButton>
        <ControlButton
          label={trucks.length > 1 ? "Show all trucks" : trucks.length === 1 ? "Re-center on truck" : "Re-center"}
          onClick={recenter}
          active={Boolean(soleTruck) && following}
        >
          <LocateFixed className="h-4 w-4" />
        </ControlButton>
        {trucks.length > 0 && points.length > trucks.length && (
          <ControlButton label="Show truck and all stops" onClick={showAll}>
            <ScanSearch className="h-4 w-4" />
          </ControlButton>
        )}
        {trafficToggle && (
          <ControlButton label={traffic ? "Hide traffic" : "Show traffic"} onClick={toggleTraffic} active={traffic}>
            <TrafficCone className="h-4 w-4" />
          </ControlButton>
        )}
        <ControlButton label={fullScreen ? "Exit full screen" : "Full screen"} onClick={toggleFullScreen}>
          {fullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </ControlButton>
      </div>

      {/* Said plainly once following has stopped, where a thumb can reach it. */}
      {soleTruck && !following && (
        <button
          type="button"
          onClick={recenter}
          className="absolute bottom-3 right-3 inline-flex min-h-tap items-center gap-1.5 rounded-full bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 md:pointer-fine:min-h-9"
        >
          <LocateFixed className="h-4 w-4" /> Re-center
        </button>
      )}

      {showLegend && (
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
            {traffic && (
              <>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-6 rounded-full" style={{ background: TRAFFIC_COLOURS.moderate }} />
                  <span className="text-xs font-medium text-slate-700">Slow traffic</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-6 rounded-full" style={{ background: TRAFFIC_COLOURS.heavy }} />
                  <span className="text-xs font-medium text-slate-700">Heavy traffic</span>
                </li>
              </>
            )}
            {hasPickups && hasDeliveries && (
              <>
                <li className="flex items-center gap-2">
                  <span className="mx-1.5 h-3 w-3 rounded-sm bg-amber-600" />
                  <span className="text-xs font-medium text-slate-700">Pickup</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="mx-1.5 h-3 w-3 rounded-full bg-slate-700" />
                  <span className="text-xs font-medium text-slate-700">Delivery</span>
                </li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
