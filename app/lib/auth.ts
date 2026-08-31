import { supabase } from "@/app/lib/supabase";
import { supabaseAuth } from "@/app/lib/supabaseAuth";

export type UserRole =
  | "Admin"
  | "Coordinator"
  | "Driver"
  | "Mechanic"
  | "Helper";

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


// ROLE AUTHORIZATION
export function requireRole(
  role: string,
  allowedRoles: UserRole[]
) {
  if (!allowedRoles.includes(role as UserRole)) {
    return {
      error: "Forbidden",
      status: 403,
    };
  }

  return null;
}