import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabase";
import { supabaseAuth } from "@/app/lib/supabaseAuth";
import { EMPLOYEE_ROLE, type EmployeeRole } from "@/app/lib/enums";

// The role column is the Postgres enum, so the union comes from there.
// It used to also list "Dispatcher", which the enum has never contained:
// every route that allowed it was allowing a role nobody could hold.
export type UserRole = EmployeeRole;

// Roles allowed to view and manage the truck fleet and maintenance logs.
export const FLEET_ROLES: UserRole[] = [
  EMPLOYEE_ROLE.admin,
  EMPLOYEE_ROLE.coordinator,
  EMPLOYEE_ROLE.mechanic,
];

// Roles that work assigned deliveries from the crew app.
export const CREW_ROLES: UserRole[] = [EMPLOYEE_ROLE.driver, EMPLOYEE_ROLE.helper];

// Roles that create and manage bookings from the office.
export const OFFICE_ROLES: UserRole[] = [EMPLOYEE_ROLE.admin, EMPLOYEE_ROLE.coordinator];

// ==========================================
// NORMAL AUTHENTICATION
// ==========================================

// ==========================================
// VERIFIED TOKEN CACHE
// ==========================================
// Verifying a bearer token is a network call to Supabase Auth, repeated on
// every request, including the burst of calls a single page makes. The result
// - which auth user the token belongs to - is cached for a short window, per
// server instance, keyed by the token itself.
//
// The Employee row is NOT cached. It is read on every request, so
// deactivating an employee or changing their role takes effect on their very
// next request. It used to be cached with the token, which left a deactivated
// employee working for up to 30 seconds - on every server instance that had
// seen them, and there was no way to clear it from another instance.
//
// What the window still delays is Supabase noticing a revoked token (a
// sign-out elsewhere); that is bounded by the TTL.

const TOKEN_CACHE_TTL_MS = 30_000;
const TOKEN_CACHE_MAX_ENTRIES = 500;

const verifiedTokens = new Map<string, { user: User; expiresAt: number }>();

function readCachedUser(token: string): User | null {
  const entry = verifiedTokens.get(token);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    verifiedTokens.delete(token);
    return null;
  }

  return entry.user;
}

function cacheUser(token: string, user: User): void {
  // Bound the map so a long-lived instance cannot grow without limit.
  if (verifiedTokens.size >= TOKEN_CACHE_MAX_ENTRIES) {
    for (const [key, entry] of verifiedTokens) {
      if (entry.expiresAt <= Date.now()) verifiedTokens.delete(key);
    }
    if (verifiedTokens.size >= TOKEN_CACHE_MAX_ENTRIES) {
      verifiedTokens.clear();
    }
  }

  verifiedTokens.set(token, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
}

// Drops a token's cached verification on this server instance.
export function invalidateCachedSession(token: string): void {
  verifiedTokens.delete(token);
}

export async function requireAuth(request: Request) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return {
      error: "Unauthorized",
      status: 401,
    };
  }

  const token = authorization.substring(7);

  let user = readCachedUser(token);

  if (!user) {
    const {
      data: { user: verifiedUser },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !verifiedUser) {
      return {
        error: "Invalid or expired token",
        status: 401,
      };
    }

    user = verifiedUser;
    cacheUser(token, user);
  }

  const {
    data: employee,
    error: employeeError,
  } = await supabase
    .from("Employee")
    .select(`
      employeeID,
      employeeName,
      role,
      isActive
    `)
    .eq("auth_id", user.id)
    .maybeSingle();

  if (employeeError || !employee) {
    return {
      error: "Employee account not found",
      status: 404,
    };
  }

  // Normal application routes require
  // the employee account to be active.
  if (employee.isActive === false) {
    return {
      error: "Employee account is inactive",
      status: 403,
    };
  }

  return { user, employee };
}

// ==========================================
// ACTIVATION AUTHENTICATION
// ==========================================
// Used ONLY when an employee is completing
// their initial account activation.
//
// Unlike requireAuth(), this function allows
// isActive = false because that is the expected
// state before activation is completed.
// ==========================================

export async function requireActivationAuth(
  request: Request
) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return {
      error: "Unauthorized",
      status: 401,
    };
  }

  const token = authorization.substring(7);

  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    return {
      error: "Invalid or expired token",
      status: 401,
    };
  }

  const {
    data: employee,
    error: employeeError,
  } = await supabase
    .from("Employee")
    .select(`
      employeeID,
      employeeName,
      role,
      isActive,
      auth_id
    `)
    .eq("auth_id", user.id)
    .maybeSingle();

  if (employeeError) {
    console.error(
      "Activation employee lookup error:",
      employeeError
    );

    return {
      error: "Failed to find employee account",
      status: 500,
    };
  }

  if (!employee) {
    return {
      error: "Employee account not found",
      status: 404,
    };
  }

  // IMPORTANT:
  // Do NOT reject inactive employees here.
  //
  // isActive = false is expected because this
  // endpoint exists specifically to complete
  // the activation process.

  return {
    user,
    employee,
  };
}

// ==========================================
// ROLE AUTHORIZATION
// ==========================================

export function requireRole(
  role: string,
  allowedRoles: UserRole[]
) {
  // Role values in the DB are not consistently cased/trimmed.
  const normalized = (role ?? "").trim().toLowerCase();

  if (
    !allowedRoles.some(
      (allowed) => allowed.toLowerCase() === normalized
    )
  ) {
    return {
      error:
        `This action needs one of these roles: ${allowedRoles.join(", ")}. ` +
        `Your account's role is "${role ?? "none"}".`,
      status: 403,
    };
  }

  return null;
}

// ==========================================
// PASSWORD RE-VERIFICATION
// ==========================================
// Confirms the caller knows the account password before sensitive changes.
// A throwaway client is used so no user session is held in server memory.

export async function verifyCurrentPassword(
  email: string | undefined,
  password: string
): Promise<boolean> {
  if (!email || !password) return false;

  const verifier = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error } = await verifier.auth.signInWithPassword({ email, password });
  return !error;
}

// ==========================================
// ROUTE GUARD
// ==========================================
// Authenticates the caller and optionally checks
// their role. Returns either the auth context or a
// ready-to-return error response.

export async function authorize(
  request: Request,
  allowedRoles?: UserRole[]
) {
  const auth = await requireAuth(request);

  if ("error" in auth) {
    return {
      response: NextResponse.json(
        { message: auth.error },
        { status: auth.status }
      ),
    };
  }

  if (allowedRoles) {
    const roleError = requireRole(auth.employee.role, allowedRoles);
    if (roleError) {
      return {
        response: NextResponse.json(
          { message: roleError.error },
          { status: roleError.status }
        ),
      };
    }
  }

  return { auth };
}
