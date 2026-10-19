/**
 * Roles allowed into the admin console.
 *
 * `admin` and `super_admin` share this app — the back-end still enforces the
 * finer distinction per operation through `@RequirePermissions`, so this gate
 * only keeps `vendor` and `customer` accounts out of the console entirely.
 * It is a UX guard, never the security boundary.
 */
export const ADMIN_ROLES = ["admin", "super_admin"] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]

export function isAdminRole(role: string | null | undefined): role is AdminRole {
  return !!role && (ADMIN_ROLES as readonly string[]).includes(role)
}
