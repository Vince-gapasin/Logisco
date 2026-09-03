import { supabase } from "@/app/lib/supabase";
import { supabaseAuth } from "@/app/lib/supabaseAuth";

export type UserRole =
  | "Admin"
  | "Coordinator"
  | "Driver"
  | "Mechanic"
  | "Helper";

// ==========================================
// NORMAL AUTHENTICATION
// ==========================================

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

  return {
    user,
    employee,
  };
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
  if (
    !allowedRoles.includes(
      role as UserRole
    )
  ) {
    return {
      error: "Forbidden",
      status: 403,
    };
  }

  return null;
}