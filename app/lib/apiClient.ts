// Browser-side helpers for calling the app's own API routes with the
// signed-in employee's bearer token.

import { clearStoredSession, readStoredSession } from "@/app/lib/clientSession";

export function getAccessToken(): string | null {
  return readStoredSession()?.token ?? null;
}

// Drop-in replacement for fetch() that attaches the Authorization header.
// Returns the raw Response so existing response handling keeps working.
export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();

  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, { ...options, headers });
}

// JSON helper: attaches the token, sets Content-Type for bodies, parses the
// response and throws an Error carrying the server's message on failure.
// ==========================================
// GET CACHE
// ==========================================
// Screens refetch on every mount, so navigating back to a page previously
// started from blank. GET responses are reused for a short window and
// concurrent requests for the same URL share one network call.
//
// Any write clears the cache, so a change is always reflected immediately.
// Pass { cache: "no-store" } to bypass it (used by the polling screens).

const GET_CACHE_TTL_MS = 60_000;

const getCache = new Map<string, { data: unknown; storedAt: number }>();
const inFlight = new Map<string, Promise<unknown>>();

/** Drops cached GETs. With a prefix, only matching URLs are dropped. */
export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    getCache.clear();
    return;
  }

  for (const key of getCache.keys()) {
    if (key.startsWith(prefix)) getCache.delete(key);
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Authentication session not found. Please log in again.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });

  let result: unknown = null;
  if (response.headers.get("content-type")?.includes("application/json")) {
    result = await response.json();
  }

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "message" in result
        ? String((result as { message: unknown }).message)
        : `Request failed with status ${response.status}`;

    if (response.status === 401) clearStoredSession();
    throw new Error(message);
  }

  return result as T;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();

  // Writes go straight through, and invalidate everything cached.
  if (method !== "GET") {
    const result = await requestJson<T>(url, options);
    invalidateApiCache();
    return result;
  }

  if (options.cache === "no-store") {
    return requestJson<T>(url, options);
  }

  const cached = getCache.get(url);
  if (cached && Date.now() - cached.storedAt < GET_CACHE_TTL_MS) {
    return cached.data as T;
  }

  // Share one request between callers asking for the same URL at once.
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;

  const request = requestJson<T>(url, options)
    .then((data) => {
      getCache.set(url, { data, storedAt: Date.now() });
      return data;
    })
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, request);
  return request;
}
