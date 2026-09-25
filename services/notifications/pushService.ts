// Push to the phones running the Android app.
//
// Firebase Cloud Messaging, addressed to the device tokens the app registers
// after signing in. Without FIREBASE_SERVICE_ACCOUNT set this does nothing at
// all, so the rest of the notification system works on its own and push can
// be switched on later by adding the credential.
//
// Best-effort throughout: a phone that cannot be reached must never affect
// what was recorded.

import { createSign } from "node:crypto";
import { supabase } from "@/app/lib/supabase";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushMessage {
  title: string;
  body: string;
  link: string | null;
  notificationID: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      console.error("[Push] FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key.");
      return null;
    }
    // Pasted into an environment variable, the key's line breaks arrive escaped.
    return { ...parsed, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    console.error("[Push] FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
    return null;
  }
}

const base64url = (value: Buffer | string) =>
  Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Google's access tokens last an hour; keep one rather than signing per send.
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(account: ServiceAccount): Promise<string | null> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const issuedAt = Math.floor(Date.now() / 1000);
  const claim = {
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claim))}`;

  let assertion: string;
  try {
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    assertion = `${unsigned}.${base64url(signer.sign(account.private_key))}`;
  } catch (error) {
    console.error("[Push] Could not sign with the service account key:", error instanceof Error ? error.message : error);
    return null;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });

  if (!response.ok) {
    console.error(`[Push] Google refused the credential (${response.status}): ${(await response.text()).slice(0, 200)}`);
    return null;
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) return null;

  cached = { token: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export interface PushDiagnosis {
  /** FIREBASE_SERVICE_ACCOUNT is present and readable. */
  configured: boolean;
  projectID: string | null;
  /** Google accepted the service account and issued a token. */
  credentialOk: boolean;
  detail: string;
}

/**
 * Whether this server can push at all, for a screen that needs to say why a
 * phone is silent. A push that goes nowhere leaves no trace otherwise: it is
 * deliberately best-effort, so a missing credential looks exactly like a
 * working one from the outside. Says nothing about the credential itself.
 */
export async function pushDiagnosis(): Promise<PushDiagnosis> {
  const account = serviceAccount();
  if (!account) {
    return {
      configured: false,
      projectID: null,
      credentialOk: false,
      detail: "FIREBASE_SERVICE_ACCOUNT is not set on this server, or is not valid JSON. No push can be sent.",
    };
  }

  const token = await accessToken(account);
  return {
    configured: true,
    projectID: account.project_id,
    credentialOk: Boolean(token),
    detail: token
      ? "Google accepted the service account; this server can send push."
      : "Google refused the service account. It may be from another project, or its key may have been revoked.",
  };
}

/** Sends to every live device of the given people. Returns how many were reached. */
export async function sendPush(employeeIDs: string[], message: PushMessage): Promise<number> {
  const account = serviceAccount();
  if (!account || employeeIDs.length === 0) return 0;

  try {
    const { data: devices, error } = await supabase
      .from("DeviceToken")
      .select("tokenID, token")
      .in("employeeID", employeeIDs)
      .is("failedAt", null);
    if (error) throw new Error(error.message);
    if (!devices?.length) return 0;

    const token = await accessToken(account);
    if (!token) return 0;

    const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
    const dead: string[] = [];
    let sent = 0;

    await Promise.all(
      devices.map(async (device) => {
        const response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title: message.title, body: message.body },
              // Read by the app when the person taps it.
              data: {
                notificationID: message.notificationID,
                link: message.link ?? "",
              },
              android: {
                priority: "high",
                // A delivery is worth waking the screen for: heads-up while
                // the phone is in use, and readable on the lock screen
                // without unlocking it.
                notification: {
                  channel_id: "logisco",
                  notification_priority: "PRIORITY_MAX",
                  visibility: "PUBLIC",
                  default_sound: true,
                  default_vibrate_timings: true,
                },
                // Worth delivering late, but not a day late: a phone that has
                // been off all night should not wake to yesterday's trips.
                ttl: "43200s",
              },
            },
          }),
        });

        if (response.ok) {
          sent++;
          return;
        }

        const detail = await response.text();
        // The app was uninstalled, or the token was replaced or malformed.
        // A bad token answers 404 UNREGISTERED or 400 INVALID_ARGUMENT; both
        // mean this row will never reach a phone again.
        const gone =
          response.status === 404 ||
          response.status === 403 ||
          (response.status === 400 && /registration token/i.test(detail));
        if (gone) {
          dead.push(device.tokenID as string);
          return;
        }
        console.error(`[Push] FCM refused a message (${response.status}): ${detail.slice(0, 200)}`);
      }),
    );

    if (dead.length) {
      await supabase.from("DeviceToken").update({ failedAt: new Date().toISOString() }).in("tokenID", dead);
    }
    return sent;
  } catch (error) {
    console.error("[Push] Not sent:", error instanceof Error ? error.message : error);
    return 0;
  }
}

/** The app hands over its token after signing in; a shared phone moves to whoever signed in last. */
export async function registerDevice(employeeID: string, token: string, platform: "android" | "ios" | "web") {
  const { error } = await supabase
    .from("DeviceToken")
    .upsert(
      { employeeID, token, platform, lastSeenAt: new Date().toISOString(), failedAt: null },
      { onConflict: "token" },
    );
  if (error) throw new Error(`Failed to register this device: ${error.message}`);
}

export async function forgetDevice(token: string) {
  const { error } = await supabase.from("DeviceToken").delete().eq("token", token);
  if (error) throw new Error(`Failed to remove this device: ${error.message}`);
}
