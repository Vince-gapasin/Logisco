// LOGISCO_PROTECTED_PORTAL_SECURITY_V2
// Shows an access-denied notice before redirecting unauthorized roles.

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
import { canAccessRoute } from "@/app/lib/routeAccess";
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
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  useEffect(() => {
    let isActive = true;
    let expiryTimer: ReturnType<typeof setTimeout> | null = null;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const redirectToLogin = async () => {
      clearStoredSession();
      await signOutBrowserSession();
      if (isActive) router.replace("/login");
    };

    const verifyAndAuthorize = async (accessToken?: string) => {
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

      updateStoredSession({
        token,
        role: verifiedSession.employee.role,
        id: verifiedSession.employee.employeeID,
        employeeName: verifiedSession.employee.employeeName,
        route: verifiedSession.homeRoute,
      });

      if (!canAccessRoute(verifiedSession.employee.role, pathname)) {
        if (isActive) {
          setIsAuthorized(false);
          setIsAccessDenied(true);

          if (redirectTimer) clearTimeout(redirectTimer);
          redirectTimer = setTimeout(() => {
            if (isActive) router.replace(verifiedSession.homeRoute);
          }, 2000);
        }
        return;
      }

      if (isActive) {
        setIsAccessDenied(false);
        setIsAuthorized(true);
      }

      if (expiryTimer) clearTimeout(expiryTimer);
      const remainingTime = storedSession.sessionExpiresAt - Date.now();
      expiryTimer = setTimeout(() => {
        void redirectToLogin();
      }, Math.max(0, remainingTime));
    };

    const initializeGuard = async () => {
      setIsAuthorized(false);
      setIsAccessDenied(false);

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

      await verifyAndAuthorize(browserSession.access_token);
    };

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        clearStoredSession();
        if (isActive) router.replace("/login");
        return;
      }

      updateStoredSession({
        token: session.access_token,
        accessTokenExpiresAt: session.expires_at ?? null,
      });

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        void verifyAndAuthorize(session.access_token);
      }
    });

    void initializeGuard();

    return () => {
      isActive = false;
      subscription.unsubscribe();
      if (expiryTimer) clearTimeout(expiryTimer);
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [pathname, router]);

  if (isAccessDenied) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
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

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
