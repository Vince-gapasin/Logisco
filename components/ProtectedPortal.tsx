// LOGISCO_PROTECTED_PORTAL_SECURITY_V4
// Validates once per portal mount and checks later route changes synchronously.

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
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

export default function ProtectedPortal({ children }: ProtectedPortalProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [verifiedRole, setVerifiedRole] = useState<AppRole | null>(null);
  const [homeRoute, setHomeRoute] = useState("/");

  useEffect(() => {
    let isActive = true;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;

    const redirectToLogin = async () => {
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

    void initializeGuard();

    return () => {
      isActive = false;
      subscription.unsubscribe();
      if (expiryTimer) clearTimeout(expiryTimer);
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
  // browser refresh. Internal navigation keeps the verified role in memory.
  if (!verifiedRole) {
    return null;
  }

  return <>{children}</>;
}
