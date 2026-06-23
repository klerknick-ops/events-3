// Role-based permissions. Roles are stored as String on User (SQLite has no enum).

export const ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Full access including user management and configuration.",
  MANAGER: "Configuration, cancel/delete events, view global activity.",
  STAFF: "Day-to-day event planning. No configuration or deletions.",
};

export const PERMISSIONS = [
  "MANAGE_CONFIG", // access the Configuration area + mutate building blocks
  "MANAGE_USERS", // create/edit staff accounts & roles
  "DELETE_EVENT", // permanently delete an event
  "CANCEL_EVENT", // set an event to Cancelled
  "VIEW_GLOBAL_ACTIVITY", // the admin-facing cross-event activity log
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "MANAGE_CONFIG",
    "MANAGE_USERS",
    "DELETE_EVENT",
    "CANCEL_EVENT",
    "VIEW_GLOBAL_ACTIVITY",
  ],
  MANAGER: [
    "MANAGE_CONFIG",
    "DELETE_EVENT",
    "CANCEL_EVENT",
    "VIEW_GLOBAL_ACTIVITY",
  ],
  STAFF: [],
};

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role || !isRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
