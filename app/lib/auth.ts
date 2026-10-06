import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
// TOKEN AND SESSION CHECK
// ==========================================
// The project signs tokens with ES256, so getClaims checks a bearer token's
// signature and expiry here, on this server, with no network call. (It used
// to be getUser on every request: a call to Supabase Auth, cached for 30
// seconds per server instance - and an instance often starts with an empty
// cache.)
//
// A token checked that way says who it was issued to, not whether it has since
// been signed out. So the Employee lookup every request makes anyway also asks
// whether the token's session still exists, in one database call
// (auth_session_employee, migration 20261007000000). Changing a password signs
// the other devices out, and they are refused on their next request.
//
// The Employee row is read on every request too, so deactivating an employee
// or changing their role takes effect on their very next request.

export interface AuthUser {
  id: string;
  /**
   * As it was when the token was issued, so up to an hour old after an email
   * change. Read the auth user itself where the current address matters.
   */
  email?: string;
}

interface AuthEmployee {
  employeeID: string;
  employeeName: string;
  role: string;
  isActive: boolean | null;
}

type AuthFailure = { error: string; status: number };

const NOT_FOUND: AuthFailure = { error: "Employee account not found", status: 404 };

// Before the migration is applied: the old network check, which a signed-out
// session fails too.
async function lookUpWithoutSessionCheck(
  token: string,
  user: AuthUser,
): Promise<AuthFailure | { employee: AuthEmployee }> {
  const {
    data: { user: verifiedUser },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !verifiedUser || verifiedUser.id !== user.id) {
    return { error: "Invalid or expired token", status: 401 };
  }

  const { data: employee, error } = await supabase
    .from("Employee")
    .select(`
      employeeID,
      employeeName,
      role,
      isActive
    `)
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error || !employee) return NOT_FOUND;
  return { employee: employee as AuthEmployee };
}

export async function requireAuth(
  request: Request,
): Promise<AuthFailure | { user: AuthUser; employee: AuthEmployee }> {
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

  const { data: verified, error: tokenError } =
    await supabaseAuth.auth.getClaims(token);
  const claims = verified?.claims;

  if (tokenError || !claims?.sub || !claims.session_id) {
    return {
      error: "Invalid or expired token",
      status: 401,
    };
  }

  const user: AuthUser = { id: claims.sub, email: claims.email };

  const { data: found, error: lookupError } = await supabase.rpc(
    "auth_session_employee",
    { p_auth_id: claims.sub, p_session_id: claims.session_id },
  );

  let employee: AuthEmployee | null;

  if (lookupError?.code === "PGRST202") {
    // The function is not there yet.
    const fallback = await lookUpWithoutSessionCheck(token, user);
    if ("error" in fallback) return fallback;
    employee = fallback.employee;
  } else {
    if (lookupError) return NOT_FOUND;

    const result = found as { sessionActive: boolean; employee: AuthEmployee | null } | null;
    if (!result?.sessionActive) {
      return {
        error: "Invalid or expired token",
        status: 401,
      };
    }
    employee = result.employee;
  }

  if (!employee) return NOT_FOUND;

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

/**
 * The account's email as it is now. The token's copy is from when it was
 * issued, so for up to an hour after a change it names the old address, and a
 * password checked against that would be refused.
 */
export async function currentEmailOf(user: AuthUser): Promise<string | undefined> {
  const { data, error } = await supabase.auth.admin.getUserById(user.id);
  if (error || !data.user) return user.email;
  return data.user.email ?? undefined;
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
