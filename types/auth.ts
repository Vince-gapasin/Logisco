// ==========================================
// LOGISCO - RBAC & USER TYPES
// ==========================================

export type UserRole = "admin" | "coordinator" | "driver" | "helper" | "mechanic" | "client";

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
    canManageUsers: true, 
    canManageBookings: true,
    canViewFleet: true,
  },
  coordinator: {
    canManageUsers: false,
    canManageBookings: true,
    canViewFleet: true,
  },
  driver: {
    canManageUsers: false,
    canManageBookings: false,
    canViewFleet: false,
  },
  helper: {
    canManageUsers: false,
    canManageBookings: false,
    canViewFleet: false,
  },
  mechanic: {
    canManageUsers: false,
    canManageBookings: false,
    canViewFleet: true,
  },
  client: {
    canManageUsers: false,
    canManageBookings: false, // Clients request bookings, but don't "manage" the master dispatch board
    canViewFleet: false,
  },
};