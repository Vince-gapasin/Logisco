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
export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
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
