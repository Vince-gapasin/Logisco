// LOGISCO_SESSION_SECURITY_V2

import { supabaseBrowser } from "@/app/lib/supabase-browser";
import { normalizeRole, type AppRole } from "@/app/lib/routeAccess";

export interface AuthResponse {
  email: string;
  role: AppRole;
  token: string;
  id: string;
  employeeName: string;
  route: string;
  accessTokenExpiresAt: number | null;
}

export interface ValidatedSession {
  employee: {
    employeeID: string;
    employeeName: string;
    role: AppRole;
  };
  homeRoute: string;
}

type LoginApiResponse = {
  email?: string;
  role?: string;
  token?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number | null;
  employeeId?: string;
  employeeName?: string;
  route?: string;
};

export const authenticateUser = async (
  emailInput: string,
  passwordInput: string,
): Promise<AuthResponse | null> => {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailInput,
        password: passwordInput,
      }),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as LoginApiResponse;
    const role = normalizeRole(data.role);

    if (
      !data.email ||
      !role ||
      !data.token ||
      !data.refreshToken ||
      !data.employeeId ||
      !data.employeeName ||
      !data.route
    ) {
      console.error("Login response is missing required session information");
      return null;
    }

    const { data: browserAuthData, error: browserAuthError } =
      await supabaseBrowser.auth.setSession({
        access_token: data.token,
        refresh_token: data.refreshToken,
      });

    if (browserAuthError || !browserAuthData.session) {
      console.error("Failed to establish browser session:", browserAuthError);
      return null;
    }

    return {
      email: data.email,
      role,
      token: browserAuthData.session.access_token,
      id: data.employeeId,
      employeeName: data.employeeName,
      route: data.route,
      accessTokenExpiresAt:
        browserAuthData.session.expires_at ??
        data.accessTokenExpiresAt ??
        null,
    };
  } catch (error) {
    console.error("Auth Service Error:", error);
    return null;
  }
};

export const validateSession = async (
  token: string,
): Promise<ValidatedSession | null> => {
  try {
    const response = await fetch("/api/auth/validate", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      valid?: boolean;
      employee?: {
        employeeID?: string;
        employeeName?: string;
        role?: string;
      };
      homeRoute?: string;
    };

    const role = normalizeRole(data.employee?.role);

    if (
      data.valid !== true ||
      !data.employee?.employeeID ||
      !data.employee.employeeName ||
      !role ||
      !data.homeRoute
    ) {
      return null;
    }

    return {
      employee: {
        employeeID: data.employee.employeeID,
        employeeName: data.employee.employeeName,
        role,
      },
      homeRoute: data.homeRoute,
    };
  } catch (error) {
    console.error("Token validation failed:", error);
    return null;
  }
};

// Kept for pages that currently need only a boolean validation result.
export const validateToken = async (token: string): Promise<boolean> =>
  Boolean(await validateSession(token));

export const signOutBrowserSession = async (): Promise<void> => {
  const { error } = await supabaseBrowser.auth.signOut({ scope: "local" });
  if (error) console.error("Browser sign-out failed:", error);
};
