"use client";

// Who is signed in, for the screens that show it.
//
// Three sidebars and the header all needed the same answer and each had its own
// copy of "parse the session out of storage" - two of them reaching past
// readStoredSession and its validation to JSON.parse the raw string themselves.
// So the sidebars showed a person who does not work here: JOANNE PATERNO on the
// office portal, JUAN DELA CRUZ on the mechanic's, CREW PORTAL on the crew's,
// each beside an avatar seeded from a name in the markup.
//
// Read through useSyncExternalStore rather than an effect. The session lives
// outside React, in browser storage, and this is what that hook is for: the
// server and the first client render agree on "not known yet", so there is no
// hydration mismatch and no setState in an effect to silence a lint rule over.
//
// It also follows a change. Logging out in one tab clears storage and fires a
// storage event, so the other tab's sidebar stops naming somebody who has left.

import { useSyncExternalStore } from "react";

import { readStoredSession, SESSION_DURATION_MS } from "@/app/lib/clientSession";
import { SESSION_KEY, type AppRole } from "@/app/lib/routeAccess";

export interface SessionUser {
  name: string;
  role: AppRole;
  email: string;
}

// The snapshot has to be the same object while nothing has changed, or
// useSyncExternalStore re-renders for ever. The raw string is the cheap way to
// tell: it changes exactly when the stored session does.
let cachedRaw: string | null = null;
let cachedUser: SessionUser | null = null;

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    // Storage throws in a private window. Nobody is named, which is the honest
    // answer, and the screen still draws.
    return null;
  }
}

function getSnapshot(): SessionUser | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedUser;

  cachedRaw = raw;
  const session = readStoredSession();
  cachedUser = session
    ? { name: session.employeeName, role: session.role, email: session.email }
    : null;
  return cachedUser;
}

/** Nobody is signed in as far as the server is concerned, and it cannot be. */
function getServerSnapshot(): SessionUser | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  // Fired by other tabs, which is where a logout usually happens.
  window.addEventListener("storage", onChange);

  // Nothing fires in this tab when this tab writes, and a session also simply
  // runs out. A slow poll covers both without the sidebar having to be told.
  const timer = setInterval(onChange, 60_000);

  return () => {
    window.removeEventListener("storage", onChange);
    clearInterval(timer);
  };
}

/**
 * The signed-in user, or null until the browser has been read.
 *
 * Null on the server and on the first client render, so a screen showing this
 * needs a resting state for it - a blank where the name goes is better than a
 * name that belongs to nobody.
 */
export function useSessionUser(): SessionUser | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The role as a sidebar prints it: ADMINISTRATOR, DELIVERY CREW, MECHANIC. */
export function describeRole(role: AppRole): string {
  switch (role) {
    case "Admin":
      return "Administrator";
    case "Coordinator":
      return "Coordinator";
    case "Driver":
      return "Driver";
    case "Helper":
      return "Helper";
    case "Mechanic":
      return "Mechanic";
  }
}

export { SESSION_DURATION_MS };
