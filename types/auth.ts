// ==========================================
// LOGISCO - RBAC & USER TYPES
// ==========================================

export type UserRole = "admin" | "coordinator" | "crew" | "mechanic";

export interface UserProfile {
  id: string;
  email: string;
  password?: string; // Optional for mock reference
  role: UserRole;
  route: string;
  label: string;
}

export interface RolePermissions {
  canManageUsers: boolean; // Admin only capability
  canManageBookings: boolean;
  canViewFleet: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canManageUsers: true, // Only Admin can create, edit, disable, or delete user accounts
    canManageBookings: true,
    canViewFleet: true,
  },
  coordinator: {
    canManageUsers: false,
    canManageBookings: true,
    canViewFleet: true,
  },
  crew: {
    canManageUsers: false,
    canManageBookings: false,
    canViewFleet: false,
  },
  mechanic: {
    canManageUsers: false,
    canManageBookings: false,
    canViewFleet: true,
  },
};
