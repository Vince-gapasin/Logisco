// Whether this deployment can do the things it quietly does.
//
// Most of what this system does in the background is best-effort on purpose:
// a push that cannot be sent, an email that cannot go out, a monthly job that
// is not authorised - none of them may fail the booking that caused them. The
// cost is that a server missing a credential behaves exactly like a working
// one, and says nothing. A phone stayed silent for most of a day because
// FIREBASE_SERVICE_ACCOUNT was not set on the server, while every screen
// reported the notification as sent.
//
// This asks the deployment itself, rather than the machine someone happens to
// be developing on.

import { supabase } from "@/app/lib/supabase";
import { emailIsConfigured, verifyEmail } from "@/services/email/emailService";
import { pushDiagnosis } from "@/services/notifications/pushService";
import { trackingUrl } from "@/services/email/trackingEmail";

export type HealthState = "ok" | "warning" | "failed";

export interface HealthCheck {
  area: string;
  name: string;
  state: HealthState;
  detail: string;
  /** What to set, when something is missing. */
  setting?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / DAY_MS);
}

async function latest(table: string, column: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .order(column, { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as Record<string, string> | null)?.[column] ?? null;
}

async function database(): Promise<HealthCheck> {
  const { count, error } = await supabase.from("Order").select("orderID", { count: "exact", head: true });

  if (error) {
    return { area: "Database", name: "Supabase", state: "failed", detail: error.message, setting: "SUPABASE_URL, SUPABASE_SECRET_KEY" };
  }
  return { area: "Database", name: "Supabase", state: "ok", detail: `Answering. ${count ?? 0} bookings on record.` };
}

async function push(): Promise<HealthCheck> {
  const diagnosis = await pushDiagnosis();
  return {
    area: "Notifications",
    name: "Phone push",
    state: diagnosis.credentialOk ? "ok" : "failed",
    detail: diagnosis.detail,
    setting: diagnosis.credentialOk ? undefined : "FIREBASE_SERVICE_ACCOUNT",
  };
}

async function email(): Promise<HealthCheck> {
  if (!emailIsConfigured()) {
    return {
      area: "Notifications",
      name: "Email",
      state: "failed",
      detail: "No mail server is configured, so tracking links are never sent.",
      setting: "SMTP_HOST, SMTP_USER, SMTP_PASSWORD",
    };
  }

  const result = await verifyEmail();
  return {
    area: "Notifications",
    name: "Email",
    state: result.ok ? "ok" : "failed",
    detail: result.message,
    setting: result.ok ? undefined : "SMTP_USER, SMTP_PASSWORD",
  };
}

function trackingLinks(): HealthCheck {
  const sample = trackingUrl("example-token");
  const local = /localhost|127\.|192\.168\.|10\./.test(sample);

  return {
    area: "Notifications",
    name: "Tracking links",
    state: local ? "warning" : "ok",
    detail: local
      ? `Links would be sent as ${sample.split("/client-view")[0]}, which a client cannot open.`
      : `Clients are sent ${sample.split("/client-view")[0]}`,
    setting: local ? "APP_URL" : undefined,
  };
}

function maps(): HealthCheck {
  const token = (process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "").trim();
  return {
    area: "Fleet",
    name: "Maps and routing",
    state: token ? "ok" : "failed",
    detail: token
      ? "A Mapbox token is set, so addresses can be placed and routes drawn."
      : "No Mapbox token, so stops cannot be geocoded and no map will draw.",
    setting: token ? undefined : "MAPBOX_TOKEN",
  };
}

// Forecasting is somebody else's work in progress. Nothing here touches it -
// these only report whether the things it feeds on are still arriving, since
// all three fill up in the background and would go stale silently.
async function forecastingInputs(): Promise<HealthCheck[]> {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  const checks: HealthCheck[] = [
    {
      area: "Forecasting",
      name: "Monthly snapshot job",
      state: cronSecret ? "ok" : "failed",
      detail: cronSecret
        ? "The scheduled run is authorised. It takes a snapshot on the 2nd of each month."
        : "The scheduled run answers 503 without this, so no monthly snapshot is ever taken.",
      setting: cronSecret ? undefined : "CRON_SECRET",
    },
  ];

  const sources: { name: string; table: string; column: string; stale: number }[] = [
    { name: "Fuel prices", table: "FuelPriceHistory", column: "effectiveDate", stale: 21 },
    { name: "Weather history", table: "WeatherHistory", column: "recordDate", stale: 7 },
    { name: "Forecast snapshots", table: "ForecastSnapshot", column: "snapshotMonth", stale: 62 },
  ];

  for (const source of sources) {
    const newest = await latest(source.table, source.column);
    const age = daysSince(newest);

    checks.push({
      area: "Forecasting",
      name: source.name,
      state: age === null ? "warning" : age > source.stale ? "warning" : "ok",
      detail:
        age === null
          ? "Nothing recorded yet."
          : `Newest entry ${newest}, ${age} day(s) old${age > source.stale ? " - it has stopped arriving." : "."}`,
    });
  }

  return checks;
}

/** Every check, in the order a person would want to read them. */
export async function checkSystem(): Promise<HealthCheck[]> {
  const [db, pushCheck, mail, forecasting] = await Promise.all([
    database(),
    push(),
    email(),
    forecastingInputs(),
  ]);

  return [db, pushCheck, mail, trackingLinks(), maps(), ...forecasting];
}
