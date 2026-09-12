// LOGISCO_CLIENT_SESSION_SECURITY_V1

import type { AppRole } from "@/app/lib/routeAccess";

export const SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

export interface StoredUserSession {
  email: string;
  role: AppRole;
  token: string;
  id: string;
  employeeName: string;
  route: string;
  sessionStartedAt: number;
  sessionExpiresAt: number;
  accessTokenExpiresAt: number | null;
}

type SessionPatch = Partial<StoredUserSession>;
type BrowserStorage = "local" | "session";

const SESSION_KEY = "logisco_user_session";

function getStorage(type: BrowserStorage): Storage {
  return type === "local" ? window.localStorage : window.sessionStorage;
}

function findStoredSession(): {
  storage: BrowserStorage;
  raw: string;
} | null {
  if (typeof window === "undefined") return null;

  const localSession = window.localStorage.getItem(SESSION_KEY);
  if (localSession) return { storage: "local", raw: localSession };

  const tabSession = window.sessionStorage.getItem(SESSION_KEY);
  if (tabSession) return { storage: "session", raw: tabSession };

  return null;
}

export function readStoredSession(): StoredUserSession | null {
  const stored = findStoredSession();
  if (!stored) return null;

  try {
    const session = JSON.parse(stored.raw) as Partial<StoredUserSession>;

    if (
      !session.email ||
      !session.role ||
      !session.token ||
      !session.id ||
      !session.employeeName ||
      !session.route ||
      typeof session.sessionStartedAt !== "number" ||
      typeof session.sessionExpiresAt !== "number"
    ) {
      return null;
    }

    return session as StoredUserSession;
  } catch {
    return null;
  }
}

export function saveStoredSession(
  session: StoredUserSession,
  rememberMe: boolean,
): void {
  if (typeof window === "undefined") return;

  clearStoredSession();
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function updateStoredSession(patch: SessionPatch): void {
  const stored = findStoredSession();
  if (!stored) return;

  const current = readStoredSession();
  if (!current) {
    clearStoredSession();
    return;
  }

  getStorage(stored.storage).setItem(
    SESSION_KEY,
    JSON.stringify({ ...current, ...patch }),
  );
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function isStoredSessionExpired(
  session: StoredUserSession,
  now = Date.now(),
): boolean {
  return now >= session.sessionExpiresAt;
}

export function createStoredSession(input: {
  email: string;
  role: AppRole;
  token: string;
  id: string;
  employeeName: string;
  route: string;
  accessTokenExpiresAt: number | null;
}): StoredUserSession {
  const sessionStartedAt = Date.now();

  return {
    ...input,
    sessionStartedAt,
    sessionExpiresAt: sessionStartedAt + SESSION_DURATION_MS,
  };
}
