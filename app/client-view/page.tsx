// ==========================================
// LOGISCO - CLIENT TRACKER VIEW PAGE
// ==========================================
// Public page opened from the tracking link handed to a customer:
//   /client-view?token=<Order.orderLinkToken>
//
// Laid out for the one question a customer opens it with - where is my
// delivery, and when will it get here - answered first, in plain words, before
// anything they have to read closely: a headline, the day and time, and how far
// along it is. The map, the crew and the full timeline follow for whoever wants
// the detail.
"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Flag,
  Link2Off,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Truck,
  User,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import type { MapPoint } from "@/components/LiveRouteMap";
import { formatDateTime, formatTime } from "@/app/lib/datetime";
import { usePolling } from "@/app/lib/usePolling";
import DeliveryFeedbackCard, { type FeedbackInvitation } from "@/components/DeliveryFeedbackCard";
import type {
  TrackingStage,
  TrackingStep,
  TrackingStepKind,
} from "@/services/tracking/publicTrackingService";

const LiveRouteMap = dynamic(() => import("@/components/LiveRouteMap"), {
  ssr: false,
  loading: () => <div className="h-64 sm:h-80 w-full animate-pulse bg-slate-100" />,
});

// How often an open page asks whether anything has changed. The question is
// small - a fingerprint, not the delivery - so it can be asked often; the
// delivery itself is only fetched when the answer is yes. It was a full fetch
// every thirty seconds, so a customer could wait half a minute to see the
// crew had arrived.
const CHECK_INTERVAL_MS = 5_000;
// Fetched in full at least this often anyway, so the times the page works out
// from the clock ("arriving around 2:40 PM") never go stale.
const FULL_REFRESH_MS = 60_000;

// What each step is about, so the line can be read without reading it.
const STEP_ICONS: Record<TrackingStepKind, typeof Truck> = {
  booked: ClipboardCheck,
  assigned: Truck,
  confirmed: UserCheck,
  collection: Package,
  departed: Navigation,
  stop: MapPin,
  completed: Flag,
  problem: AlertTriangle,
  // A delay, not a fault. Deliberately not the warning triangle: the crew
  // tapping "held up in traffic" is the system working, and drawing it as a
  // problem would tell the customer something worse than what happened.
  heldup: Clock,
};

// Done, happening, still to come, gone wrong - told apart by shape as much as
// by colour. A hollow ring reads as "not yet" even in greyscale, and about one
// man in twelve cannot rely on the colour alone.
const STAGE_MARKS: Record<TrackingStage, string> = {
  completed: "bg-emerald-500 text-white ring-2 ring-white",
  current: "bg-blue-600 text-white ring-4 ring-blue-100",
  upcoming: "bg-white text-slate-500 ring-2 ring-slate-200",
  problem: "bg-red-600 text-white ring-2 ring-white",
};

const STAGE_TITLES: Record<TrackingStage, string> = {
  completed: "text-slate-900",
  current: "text-blue-700 font-semibold",
  upcoming: "text-slate-500",
  problem: "text-red-700 font-semibold",
};

interface TrackingStop {
  branchID: number;
  branchName: string;
  expectedTime: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  arrivedAt: string | null;
  deliveredAt: string | null;
  receivedBy: string | null;
}

interface TrackingData {
  /** Fingerprint of what this payload shows, compared on each check. */
  version?: string;
  isExpired: boolean;
  orderNumber: string;
  clientName: string | null;
  clientEmail: string | null;
  clientContact: string | null;
  deliveryStatus: string;
  isCompleted: boolean;
  deliveryDate: string | null;
  estimatedArrival: string | null;
  deliveryArrival: string | null;
  liveEta: { minutes: number; distanceKm: number; arrivalTime: string } | null;
  nextStopName: string | null;
  nextStopKind: "collection" | "delivery";
  plateNumber: string | null;
  truckModel: string | null;
  driverName: string | null;
  driverContact: string | null;
  crewHelpers?: string[];
  currentLocation: { latitude: number; longitude: number; updatedAt: string | null } | null;
  trail: { latitude: number; longitude: number }[];
  plannedRoute: [number, number][];
  stops: TrackingStop[];
  steps: TrackingStep[];
  feedback: FeedbackInvitation;
}

type LoadState = "loading" | "ready" | "ended" | "cancelled" | "missing" | "error";

// ------------------------------------------------------------------ helpers

/** "Friday, 5 October" - the day, said the way people say it. */
function formatDeliveryDay(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Manila",
  }).format(date);
}

/** Today, tomorrow, or nothing - the words that save a customer working it out. */
function relativeDay(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(Date.now() + 864e5),
  );
  if (isoDate === today) return "Today";
  if (isoDate === tomorrow) return "Tomorrow";
  return null;
}

/** "just now", "40 sec ago", "3 min ago". */
function ago(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} sec ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

// The five things a customer understands about a delivery, in order. The
// timeline underneath says everything; this says how far along it is.
const MILESTONES = ["Booked", "Crew assigned", "On the road", "At your stop", "Delivered"] as const;

function milestoneIndex(data: TrackingData): number {
  if (data.isCompleted) return 4;
  if (/at your stop/i.test(data.deliveryStatus)) return 3;
  const done = (kind: TrackingStepKind) => data.steps.some((step) => step.kind === kind && step.stage === "completed");
  if (done("departed") || data.liveEta || /in transit/i.test(data.deliveryStatus)) return 2;
  if (done("assigned") || data.driverName) return 1;
  return 0;
}

type Tone = "neutral" | "active" | "good" | "warning";

/** The headline, in the customer's words rather than the system's. */
function describe(data: TrackingData): { headline: string; tone: Tone } {
  const status = data.deliveryStatus;
  if (data.isCompleted) return { headline: "Your delivery is complete", tone: "good" };
  if (/interrupt|delayed/i.test(status)) return { headline: status.replace(/^Delayed:\s*/i, "Delayed - "), tone: "warning" };
  if (/at your stop/i.test(status)) return { headline: "Our crew is at your stop", tone: "active" };
  if (/partner/i.test(status)) return { headline: status, tone: "active" };
  if (data.nextStopKind === "collection" && /in transit/i.test(status)) {
    return { headline: "Picking up your order", tone: "active" };
  }
  if (/in transit/i.test(status)) return { headline: "On the way to you", tone: "active" };
  if (/confirmed/i.test(status)) return { headline: "Your crew is ready", tone: "neutral" };
  if (/crew assigned/i.test(status)) return { headline: "A crew has been assigned", tone: "neutral" };
  return { headline: "Your delivery is booked", tone: "neutral" };
}

// "bar" is the same tint, solid: the slim bar at the top of a phone sits over
// the map and the cards as they scroll under it.
const TONE_STYLES: Record<Tone, { card: string; bar: string; icon: string; Icon: typeof Truck }> = {
  neutral: { card: "bg-white border-slate-200", bar: "bg-white border-slate-200", icon: "bg-slate-100 text-slate-700", Icon: ClipboardCheck },
  active: { card: "bg-blue-50/70 border-blue-200", bar: "bg-blue-50 border-blue-200", icon: "bg-blue-600 text-white", Icon: Truck },
  good: { card: "bg-emerald-50/70 border-emerald-200", bar: "bg-emerald-50 border-emerald-200", icon: "bg-emerald-600 text-white", Icon: CheckCircle2 },
  warning: { card: "bg-amber-50 border-amber-200", bar: "bg-amber-50 border-amber-200", icon: "bg-amber-500 text-white", Icon: AlertTriangle },
};

// ------------------------------------------------------------------ pieces

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-100 pt-[var(--safe-top)] pb-[var(--safe-bottom)] font-sans text-slate-900">
      <div className="w-full max-w-5xl 2xl:max-w-6xl mx-auto px-3 py-4 min-[360px]:px-4 sm:px-6 sm:py-8 flex flex-col gap-4 sm:gap-5">{children}</div>
    </div>
  );
}

function Brand({ orderNumber }: { orderNumber?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-[#000c31] text-white flex items-center justify-center">
          <Truck className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900">Logisco</p>
          <p className="text-xs text-slate-500">Delivery tracking</p>
        </div>
      </div>
      {orderNumber && (
        <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-full px-3 py-1">
          {orderNumber}
        </span>
      )}
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Truck;
  title: string;
  subtitle: string;
}) {
  return (
    <Page>
      <Brand />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-12 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
          <Icon className="h-6 w-6" />
        </div>
        <p className="text-base sm:text-lg font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">{subtitle}</p>
      </div>
    </Page>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  aside,
  className = "",
}: {
  title: string;
  icon: typeof Truck;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-100">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-slate-500" />
          {title}
        </h2>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ view

function ClientTrackerView() {
  const token = useSearchParams().get("token");
  const [data, setData] = useState<TrackingData | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  // When the page last heard from the server, and whether the last try failed.
  // A failed refresh used to replace the whole page with an error, so a phone
  // dropping signal for a moment wiped out what the customer was looking at.
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const hasData = useRef(false);
  const seenVersion = useRef<string | null>(null);
  const fullAt = useRef(0);
  const checking = useRef(false);

  const loadTracking = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/track/${token}`, { cache: "no-store" });

      if (response.status === 404 || response.status === 400) {
        setState("missing");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      if (result.isExpired) {
        setState(result.reason === "cancelled" ? "cancelled" : "ended");
        return;
      }

      setData(result as TrackingData);
      hasData.current = true;
      seenVersion.current = (result as TrackingData).version ?? null;
      fullAt.current = Date.now();
      setUpdatedAt(Date.now());
      setRefreshFailed(false);
      setState("ready");
    } catch {
      // Keep what is on screen and say the refresh failed; only a first load
      // with nothing to show is an error page.
      if (hasData.current) setRefreshFailed(true);
      else setState("error");
    }
  }, [token]);

  useEffect(() => {
    // The delivery lands in a network callback, not in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTracking();
  }, [loadTracking]);

  // Asks whether anything has changed, and fetches the delivery only if it
  // has. One at a time: on a slow connection a check still waiting is not
  // joined by another.
  const checkForUpdates = useCallback(async () => {
    if (!token || checking.current) return;
    checking.current = true;
    try {
      if (Date.now() - fullAt.current >= FULL_REFRESH_MS) {
        await loadTracking();
        return;
      }
      const response = await fetch(`/api/track/${token}/version`, { cache: "no-store" });
      if (!response.ok) {
        // A link that has gone, or a failure: the full fetch knows how to say which.
        await loadTracking();
        return;
      }
      const { version } = (await response.json()) as { version?: string };
      if (!version || version !== seenVersion.current) await loadTracking();
      else {
        setUpdatedAt(Date.now());
        setRefreshFailed(false);
      }
    } catch {
      if (hasData.current) setRefreshFailed(true);
    } finally {
      checking.current = false;
    }
  }, [token, loadTracking]);

  // Keep checking while the delivery is still running, and only while the
  // customer actually has the page open. Coming back to the tab checks at once.
  const live = state === "ready" && !data?.isCompleted;
  usePolling(checkForUpdates, CHECK_INTERVAL_MS, { enabled: live, immediate: false });

  // A phone that loses signal and gets it back checks at once too, rather
  // than waiting out the interval.
  useEffect(() => {
    if (!live) return;
    const onOnline = () => void checkForUpdates();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [live, checkForUpdates]);

  // On a phone the status card scrolls away under the map and the history;
  // once it has, a slim bar takes its place at the top so the answer stays in
  // view. Watched rather than measured, so it follows the card wherever the
  // layout puts it.
  const heroRef = useRef<HTMLElement | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [state]);

  // On a phone the history starts at where things are now; the steps that are
  // long done are a tap away. A wide screen has the room and shows them all.
  const [showAllSteps, setShowAllSteps] = useState(false);

  // The "updated 20 sec ago" line counts on its own between refreshes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!token || state === "missing") {
    return (
      <Notice
        icon={Link2Off}
        title="This tracking link is not valid"
        subtitle="Please check that the whole link was copied, or ask your coordinator to send it again."
      />
    );
  }

  if (state === "loading") {
    return (
      <Page>
        <Brand />
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center gap-3 text-slate-600">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium">Loading your delivery...</p>
        </div>
      </Page>
    );
  }

  if (state === "cancelled") {
    return (
      <Notice
        icon={XCircle}
        title="This delivery was cancelled"
        subtitle="It will not go ahead as booked. Please contact your coordinator if you were not expecting this or want to rebook."
      />
    );
  }

  if (state === "ended") {
    return (
      <Notice
        icon={CheckCircle2}
        title="Tracking for this delivery has ended"
        subtitle="This delivery was completed more than a week ago. Contact your coordinator if you need its details."
      />
    );
  }

  if (state === "error" || !data) {
    return (
      <Notice
        icon={RefreshCw}
        title="We could not load your delivery right now"
        subtitle="This is usually a weak connection. Please refresh the page in a moment."
      />
    );
  }

  // The trip stopped: every stop still waiting is affected, not just one.
  const interrupted = /interrupt/i.test(data.deliveryStatus);
  const { headline, tone } = describe(data);
  const toneStyle = TONE_STYLES[tone];
  const step = milestoneIndex(data);
  const collecting = data.nextStopKind === "collection";
  const day = formatDeliveryDay(data.deliveryDate);
  const dayWord = relativeDay(data.deliveryDate);

  // The one time worth saying under the headline. A live estimate is where the
  // truck actually is; the booked time is what was promised. They used to be
  // worded alike, which invited the reading that somebody had just worked the
  // booked one out. And while the order is still to be collected, the booked
  // time ahead is the collection's - so the customer's own time is said too.
  const timeLine = data.isCompleted
    ? null
    : data.liveEta
      ? `Arriving in about ${data.liveEta.minutes} min - around ${data.liveEta.arrivalTime}`
      : collecting && data.estimatedArrival
        ? `Collection by ${data.estimatedArrival}${data.deliveryArrival ? `, delivery expected by ${data.deliveryArrival}` : ""}`
        : data.estimatedArrival
          ? `Expected by ${data.estimatedArrival}`
          : null;

  const mapPoints: MapPoint[] = [
    ...(data.currentLocation
      ? [
          {
            id: "truck",
            label: data.plateNumber ? `Truck ${data.plateNumber}` : "Delivery truck",
            detail: "Current position",
            latitude: data.currentLocation.latitude,
            longitude: data.currentLocation.longitude,
            kind: "truck" as const,
          },
        ]
      : []),
    ...data.stops
      .filter((stop) => stop.latitude !== null && stop.longitude !== null)
      .map((stop) => ({
        id: `stop-${stop.branchID}`,
        label: stop.branchName,
        detail: stop.status,
        latitude: stop.latitude as number,
        longitude: stop.longitude as number,
        kind: "stop" as const,
        done: /complete|delivered/i.test(stop.status),
        problem: /foul|fail|cancel/i.test(stop.status) || interrupted,
      })),
  ];

  // Where the collapsed history starts: the last finished step, for context,
  // then everything still happening or to come.
  const firstOpen = data.steps.findIndex((s) => s.stage !== "completed");
  const historyFrom = firstOpen <= 0 ? 0 : firstOpen - 1;
  const hiddenSteps = showAllSteps ? 0 : historyFrom;

  // The short form of the time, for the bar that stays at the top on a phone.
  const shortTime = data.isCompleted
    ? null
    : data.liveEta
      ? `~${data.liveEta.minutes} min`
      : data.estimatedArrival
        ? `by ${data.estimatedArrival}`
        : null;

  // The latest thing that happened, said once at the top of the timeline.
  const latest = [...data.steps].reverse().find((s) => s.stage === "problem" || s.stage === "current")
    ?? [...data.steps].reverse().find((s) => s.stage === "completed");

  const helpers = data.crewHelpers ?? [];

  return (
    <Page>
      {/* Phones and tablets: the status, kept at the top once the card above
          has scrolled away. Hidden on a wide screen, where the card stays in
          sight beside everything else. */}
      <div
        aria-hidden={heroVisible}
        className={`lg:hidden fixed inset-x-0 top-0 z-40 pt-[var(--safe-top)] transition-transform duration-200 ${
          heroVisible ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className={`mx-auto max-w-5xl border-b shadow-md px-4 py-2.5 flex items-center gap-3 ${toneStyle.bar}`}>
          <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${toneStyle.icon}`}>
            <toneStyle.Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{headline}</p>
            <p className="text-xs text-slate-600 truncate">
              {[MILESTONES[step], shortTime].filter(Boolean).join(" · ")}
            </p>
          </div>
          {data.driverContact && data.driverName && !data.isCompleted && (
            <a
              href={`tel:${data.driverContact.replace(/[^+\d]/g, "")}`}
              aria-label={`Call ${data.driverName}`}
              className="h-9 w-9 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <Brand orderNumber={data.orderNumber} />

      {/* ---------------------------------------------------- status first */}
      <section ref={heroRef} className={`rounded-2xl border shadow-sm p-4 min-[360px]:p-5 sm:p-6 ${toneStyle.card}`}>
        <div className="flex items-start gap-4">
          {/* The icon gives way on a small phone, so the headline and the
              time have the whole width rather than wrapping a word a line. */}
          <div className={`hidden min-[400px]:flex h-11 w-11 shrink-0 rounded-xl items-center justify-center ${toneStyle.icon}`}>
            <toneStyle.Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-[1.7rem] font-bold tracking-tight text-slate-900">{headline}</h1>

            <div className="mt-2 flex flex-col gap-1 text-sm text-slate-700">
              {day && (
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-500 shrink-0" />
                  <span>
                    {dayWord ? <strong>{dayWord}, </strong> : null}
                    {day}
                  </span>
                </p>
              )}
              {timeLine && (
                <p className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                  <span>{timeLine}</span>
                </p>
              )}
              {!data.isCompleted && data.nextStopName && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-500 shrink-0" />
                  <span>
                    {collecting ? "Collecting from" : step < 2 ? "Delivering to" : "Next stop"}: {data.nextStopName}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* How far along it is, in five steps anyone can read. */}
        <ol className="mt-6 grid grid-cols-5 gap-1" aria-label="Delivery progress">
          {MILESTONES.map((label, index) => {
            const reached = index <= step;
            const isNow = index === step && !data.isCompleted;
            // Amber for a trip that has stopped or is held up, whichever it is.
            const stopped = tone === "warning" && isNow;
            return (
              <li key={label} className="flex flex-col items-center text-center gap-1.5">
                <div className="flex w-full items-center">
                  <div className={`h-1 flex-1 rounded-full ${index === 0 ? "invisible" : reached ? "bg-emerald-500" : "bg-slate-200"}`} />
                  <div
                    className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                      stopped
                        ? "bg-amber-500 text-white"
                        : isNow
                          ? "bg-blue-600 text-white ring-4 ring-blue-100"
                          : reached
                            ? "bg-emerald-500 text-white"
                            : "bg-white text-slate-400 ring-2 ring-slate-200"
                    }`}
                    aria-current={isNow ? "step" : undefined}
                  >
                    {reached && !isNow ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                  </div>
                  <div className={`h-1 flex-1 rounded-full ${index === MILESTONES.length - 1 ? "invisible" : index < step ? "bg-emerald-500" : "bg-slate-200"}`} />
                </div>
                <span className={`text-[11px] sm:text-xs leading-tight ${isNow ? "font-semibold text-slate-900" : reached ? "text-slate-700" : "text-slate-400"}`}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>

        {/* That the page is live, and when it last heard. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          {data.isCompleted ? (
            <span>Final status.</span>
          ) : refreshFailed ? (
            <span className="flex items-center gap-1.5 text-amber-700">
              <RefreshCw className="h-3.5 w-3.5" /> Could not refresh - showing the last update. Trying again...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live - updated {updatedAt ? ago(updatedAt, now) : "just now"}. This page refreshes on its own.
            </span>
          )}
        </div>
      </section>

      {/* Asked only once the delivery is finished, and only once. */}
      {data.feedback?.invited && (
        <DeliveryFeedbackCard token={token} invitation={data.feedback} onSaved={() => void loadTracking()} />
      )}

      {/* Two columns on a wide screen. On a phone the columns dissolve
          (display: contents) so the cards can be ordered by what a customer
          reaches for first: who is coming and when, then the map, then the
          full history - rather than scrolling past the history to find the
          driver's number. */}
      {/* Tablets: the crew and the stops side by side, the map and the
          history full width beneath. */}
      <div className="flex flex-col gap-4 sm:gap-5 md:grid md:grid-cols-2 lg:grid-cols-5 lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:col-span-3 lg:gap-5">
          {/* ------------------------------------------------------- map */}
          <section className="order-3 md:col-span-2 lg:order-none bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-100">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Navigation className="h-4 w-4 text-slate-500" />
                Live map
              </h2>
              {data.currentLocation?.updatedAt && !data.isCompleted && (
                <span className="text-xs text-slate-500">Truck seen {formatTime(data.currentLocation.updatedAt)}</span>
              )}
            </div>
            <LiveRouteMap
              points={mapPoints}
              trail={data.trail ?? []}
              plannedRoute={data.plannedRoute ?? []}
              heightClass="h-60 min-[400px]:h-64 sm:h-80 lg:h-96"
              emptyMessage={
                data.isCompleted
                  ? "This delivery is complete. Live tracking has ended."
                  : "The truck will appear here once the driver starts the trip."
              }
            />
          </section>

          {/* --------------------------------------------------- timeline */}
          <Card title="What has happened so far" icon={Clock} className="order-4 md:col-span-2 lg:order-none">
            {latest && (
              <div
                className={`mb-5 rounded-xl border p-3.5 ${
                  latest.stage === "problem" ? "border-red-200 bg-red-50" : "border-blue-100 bg-blue-50/60"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Latest update</p>
                <p className={`text-sm font-semibold ${latest.stage === "problem" ? "text-red-800" : "text-slate-900"}`}>
                  {latest.title}
                </p>
                <p className="text-xs text-slate-600">
                  {latest.detail}
                  {latest.at ? ` · ${formatDateTime(latest.at)}` : ""}
                </p>
              </div>
            )}

            <ol className="relative flex flex-col gap-4 pl-1">
              <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-slate-200" aria-hidden />
              {hiddenSteps > 0 && (
                <li className="relative flex items-center gap-3.5 lg:hidden">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-emerald-500 text-white ring-2 ring-white flex items-center justify-center">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllSteps(true)}
                    className="min-h-tap text-sm font-semibold text-blue-700 hover:underline"
                  >
                    Show {hiddenSteps} earlier {hiddenSteps === 1 ? "update" : "updates"}
                  </button>
                </li>
              )}
              {data.steps.map((item, index) => {
                // A finished step is ticked; the rest show what they are.
                const Icon = item.stage === "completed" ? Check : STEP_ICONS[item.kind];
                return (
                  <li
                    key={index}
                    className={`relative items-start gap-3.5 ${index < hiddenSteps ? "hidden lg:flex" : "flex"}`}
                  >
                    <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center shadow-xs ${STAGE_MARKS[item.stage]}`}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className={`text-sm font-medium ${STAGE_TITLES[item.stage]}`}>{item.title}</p>
                      <p className={`text-xs mt-0.5 ${item.stage === "current" ? "font-medium text-slate-800" : "text-slate-600"}`}>
                        {item.detail}
                      </p>
                      {item.at && <p className="mt-0.5 text-[11px] text-slate-500">{formatDateTime(item.at)}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        {/* Stays in view on a wide screen while the history beside it is
            scrolled, so the crew and the stops are never a scroll away. */}
        <div className="contents lg:flex lg:flex-col lg:col-span-2 lg:gap-5 lg:sticky lg:top-6">
          {/* --------------------------------------------------- the crew */}
          <Card title="Your delivery team" icon={Users} className="order-1 lg:order-none">
            {data.driverName ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500">Driver</p>
                    <p className="text-sm font-semibold text-slate-900">{data.driverName}</p>
                    {helpers.length > 0 && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        With {helpers.length === 1 ? "helper" : "helpers"} {helpers.join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* The driver is the one to ring, from a page most often opened
                    on a phone - so the number is a button, not text. */}
                {data.driverContact && !data.isCompleted && (
                  <a
                    href={`tel:${data.driverContact.replace(/[^+\d]/g, "")}`}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 transition-colors"
                  >
                    <Phone className="h-4 w-4" /> Call the driver
                  </a>
                )}

                <div className="flex items-start gap-3 border-t border-slate-100 pt-4">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    {/* The plate leads: it is what somebody at the gate matches
                        against the truck in front of them. */}
                    <p className="text-xs font-medium text-slate-500">Truck</p>
                    <p className="text-sm font-semibold text-slate-900">{data.plateNumber ?? "To be confirmed"}</p>
                    {data.plateNumber && data.truckModel && <p className="text-xs text-slate-600">{data.truckModel}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                We are arranging the truck and crew for this delivery. Their names will appear here once they are assigned.
              </p>
            )}
          </Card>

          {/* ------------------------------------------------- your stops */}
          {data.stops.length > 0 && (
            <Card
              title={data.stops.length === 1 ? "Your delivery stop" : `Your delivery stops (${data.stops.length})`}
              icon={Package}
              className="order-2 lg:order-none"
            >
              <ul className="flex flex-col gap-3">
                {data.stops.map((stop) => {
                  const delivered = /complete|delivered/i.test(stop.status);
                  const here = !delivered && Boolean(stop.arrivedAt);
                  const chip = delivered
                    ? { text: "Delivered", style: "bg-emerald-100 text-emerald-800" }
                    : interrupted
                      ? { text: "On hold", style: "bg-amber-100 text-amber-800" }
                      : here
                        ? { text: "Crew here", style: "bg-blue-100 text-blue-800" }
                        : { text: "Coming", style: "bg-slate-100 text-slate-700" };
                  return (
                    <li key={stop.branchID} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 break-words">{stop.branchName}</p>
                        <p className="text-xs text-slate-600">
                          {delivered
                            ? [
                                stop.deliveredAt ? `Delivered ${formatDateTime(stop.deliveredAt)}` : "Delivered",
                                stop.receivedBy ? `received by ${stop.receivedBy}` : null,
                              ]
                                .filter(Boolean)
                                .join(", ")
                            : interrupted
                              ? "Waiting while the trip is sorted out"
                              : here
                                ? `Arrived ${formatTime(stop.arrivedAt as string)}`
                                : stop.expectedTime
                                  ? `Expected by ${formatTime(stop.expectedTime)}`
                                  : "Scheduled"}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${chip.style}`}>{chip.text}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* ------------------------------------------------- booked by */}
          {(data.clientEmail || data.clientContact) && (
            <Card title="Booked by" icon={ClipboardCheck} className="order-5 md:col-span-2 lg:order-none">
              <p className="text-sm font-medium text-slate-900">{data.clientName ?? "-"}</p>
              <p className="text-xs text-slate-600">{[data.clientEmail, data.clientContact].filter(Boolean).join(" · ")}</p>
              <p className="mt-2 text-xs text-slate-500">
                Partly hidden for your privacy. Contact your coordinator if these are not yours.
              </p>
            </Card>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-500 pb-2">
        Questions about this delivery? Contact your Logisco coordinator and mention {data.orderNumber}.
      </p>
    </Page>
  );
}

export default function ClientTrackerPage() {
  return (
    <Suspense
      fallback={
        <Page>
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-600">
            Loading your delivery...
          </div>
        </Page>
      }
    >
      <ClientTrackerView />
    </Suspense>
  );
}
