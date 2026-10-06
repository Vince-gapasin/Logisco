// LOGISCO_PROTECTED_PORTAL_SECURITY_V4
// Validates once per portal mount and checks later route changes synchronously.

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import PushRegistration, { releasePushToken } from "@/components/PushNotifications";
import { ShieldAlert } from "lucide-react";

import { supabaseBrowser } from "@/app/lib/supabase-browser";
import {
  clearStoredSession,
  isStoredSessionExpired,
  readStoredSession,
  updateStoredSession,
} from "@/app/lib/clientSession";
import {
  canAccessRoute,
  normalizeRole,
  type AppRole,
} from "@/app/lib/routeAccess";
import {
  signOutBrowserSession,
  validateSession,
} from "@/services/authService";

type ProtectedPortalProps = {
  children: ReactNode;
};

// How often an open portal re-checks that the account still exists and is
// active. Deleting or deactivating a staff member signs them out within this
// window (plus the server's 30-second verification cache).
const RECHECK_INTERVAL_MS = 30_000;

/** Shown on the login page after a forced sign-out. */
export const LOGOUT_REASON_KEY = "logisco_logout_reason";

/*
  "ended": the server refused the session (deleted, deactivated or invalid).
  "unknown": no answer (offline, server error) - never a reason to sign out.
*/
async function checkSessionStillValid(token: string): Promise<"valid" | "ended" | "unknown"> {
  try {
    const response = await fetch("/api/auth/validate", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.ok) return "valid";
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      return "ended";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export default function ProtectedPortal({ children }: ProtectedPortalProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [verifiedRole, setVerifiedRole] = useState<AppRole | null>(null);
  const [homeRoute, setHomeRoute] = useState("/");

  useEffect(() => {
    let isActive = true;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    let recheckTimer: ReturnType<typeof setInterval> | null = null;
    let isEnding = false;

    const redirectToLogin = async () => {
      if (isEnding) return;
      isEnding = true;
      await releasePushToken();
      clearStoredSession();
      await signOutBrowserSession();
      if (isActive) router.replace("/login");
    };

    const scheduleSessionExpiry = (sessionExpiresAt: number) => {
      if (expiryTimer) clearTimeout(expiryTimer);

      expiryTimer = setTimeout(() => {
        void redirectToLogin();
      }, Math.max(0, sessionExpiresAt - Date.now()));
    };

    const verifySession = async (accessToken?: string) => {
      const storedSession = readStoredSession();

      if (!storedSession || isStoredSessionExpired(storedSession)) {
        await redirectToLogin();
        return;
      }

      const token = accessToken ?? storedSession.token;
      const verifiedSession = await validateSession(token);

      if (!verifiedSession) {
        await redirectToLogin();
        return;
      }

      const role = normalizeRole(verifiedSession.employee.role);
      if (!role) {
        await redirectToLogin();
        return;
      }

      updateStoredSession({
        token,
        role,
        id: verifiedSession.employee.employeeID,
        employeeName: verifiedSession.employee.employeeName,
        route: verifiedSession.homeRoute,
      });

      if (isActive) {
        setVerifiedRole(role);
        setHomeRoute(verifiedSession.homeRoute);
        scheduleSessionExpiry(storedSession.sessionExpiresAt);
      }
    };

    const initializeGuard = async () => {
      const storedSession = readStoredSession();

      if (!storedSession || isStoredSessionExpired(storedSession)) {
        await redirectToLogin();
        return;
      }

      const {
        data: { session: browserSession },
        error: browserSessionError,
      } = await supabaseBrowser.auth.getSession();

      if (browserSessionError || !browserSession) {
        await redirectToLogin();
        return;
      }

      updateStoredSession({
        token: browserSession.access_token,
        accessTokenExpiresAt: browserSession.expires_at ?? null,
      });

      // Draw the portal now, on the role this browser signed in with, so the
      // page starts loading its data while the server confirms the account
      // instead of after. Showing it early gives nothing away: every API
      // route checks the token and the Employee row itself. A refused account
      // is still sent to the login page below, and a changed role is
      // corrected when the answer arrives.
      //
      // Not before getSession(): it has just refreshed an expired access
      // token, and a page fetching with the stale one would be refused with
      // a 401, which clears the stored session.
      const storedRole = normalizeRole(storedSession.role);
      if (storedRole && isActive) {
        setVerifiedRole(storedRole);
        setHomeRoute(storedSession.route);
      }

      await verifySession(browserSession.access_token);
    };

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        clearStoredSession();
        if (isActive) {
          setVerifiedRole(null);
          router.replace("/login");
        }
        return;
      }

      updateStoredSession({
        token: session.access_token,
        accessTokenExpiresAt: session.expires_at ?? null,
      });

      // Revalidate only when the authenticated identity or token changes.
      // Normal page navigation does not enter this branch.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void verifySession(session.access_token);
      }
    });

    // Re-check regularly, and whenever the tab or app comes back into view,
    // so a deleted or deactivated account is signed out without a refresh.
    const recheck = async () => {
      if (isEnding || document.visibilityState === "hidden") return;

      if (!readStoredSession()) return;

      // getSession() refreshes an expired access token first, so a token that
      // simply aged out (laptop asleep, app in the background) is never
      // mistaken for a removed account.
      const { data, error } = await supabaseBrowser.auth.getSession();
      if (error) return;
      if (!data.session) {
        await redirectToLogin();
        return;
      }

      if ((await checkSessionStillValid(data.session.access_token)) === "ended") {
        try {
          window.sessionStorage.setItem(
            LOGOUT_REASON_KEY,
            "You have been signed out because your account was removed or deactivated. Please contact your administrator.",
          );
        } catch {
          // Storage unavailable: the sign-out still happens.
        }
        await redirectToLogin();
      }
    };

    const recheckWhenVisible = () => {
      if (document.visibilityState === "visible") void recheck();
    };

    void initializeGuard();
    recheckTimer = setInterval(() => void recheck(), RECHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", recheckWhenVisible);
    window.addEventListener("focus", recheckWhenVisible);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      if (expiryTimer) clearTimeout(expiryTimer);
      if (recheckTimer) clearInterval(recheckTimer);
      document.removeEventListener("visibilitychange", recheckWhenVisible);
      window.removeEventListener("focus", recheckWhenVisible);
    };
  }, [router]);

  const isRouteDenied =
    verifiedRole !== null && !canAccessRoute(verifiedRole, pathname);

  useEffect(() => {
    if (!isRouteDenied) return;

    const redirectTimer = setTimeout(() => {
      router.replace(homeRoute);
    }, 2000);

    return () => clearTimeout(redirectTimer);
  }, [homeRoute, isRouteDenied, router]);

  if (isRouteDenied) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
            <ShieldAlert className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You do not have permission to access this page. You will be
            redirected to your dashboard.
          </p>
        </div>
      </div>
    );
  }

  // This silent wait occurs only when the portal first mounts or after a hard
  // browser refresh, and lasts until the browser has its session (not until
  // the server answers). Internal navigation keeps the role in memory.
  if (!verifiedRole) {
    return null;
  }

  return (
    <>
      {/* Only inside the phone app; on the web it does nothing. */}
      <PushRegistration />
      {children}
    </>
  );
}
