// LOGISCO_ROUTE_SECURITY_V1

export type AppRole =
  | "Admin"
  | "Coordinator"
  | "Driver"
  | "Mechanic"
  | "Helper";

export const SESSION_KEY = "logisco_user_session";

const ROLE_HOME: Record<AppRole, string> = {
  Admin: "/admindashboard/dashboard",
  Coordinator: "/admindashboard/dashboard",
  Driver: "/crew/dashboard",
  Helper: "/crew/dashboard",
  Mechanic: "/mechanic/fleet-status",
};

const PORTAL_ROLES: ReadonlyArray<{
  prefix: string;
  roles: readonly AppRole[];
}> = [
  {
    prefix: "/admindashboard",
    roles: ["Admin", "Coordinator"],
  },
  {
    prefix: "/crew",
    roles: ["Driver", "Helper"],
  },
  {
    prefix: "/mechanic",
    roles: ["Mechanic"],
  },
];

export function normalizeRole(role: unknown): AppRole | null {
  if (typeof role !== "string") return null;

  const normalized = role.trim().toLowerCase();

  switch (normalized) {
    case "admin":
      return "Admin";
    case "coordinator":
      return "Coordinator";
    case "driver":
      return "Driver";
    case "mechanic":
      return "Mechanic";
    case "helper":
      return "Helper";
    default:
      return null;
  }
}

export function getHomeRoute(role: unknown): string {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? ROLE_HOME[normalizedRole] : "/";
}

export function canAccessRoute(role: unknown, pathname: string): boolean {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;

  const portal = PORTAL_ROLES.find(
    ({ prefix }) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!portal) return false;
  return portal.roles.includes(normalizedRole);
}

export function canManageEmployees(role: unknown): boolean {
  return normalizeRole(role) === "Admin";
}
