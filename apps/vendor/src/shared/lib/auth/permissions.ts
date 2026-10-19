/**
 * Permission gating helpers.
 *
 * The backend attaches `permissions: string[]` to the authenticated user
 * (via `me` or the auth token payload). Gate UI off these strings, not
 * role names — roles map to permission sets server-side and are subject
 * to change.
 */

export type Permission =
  | "create_shop"
  | "manage_own_shop"
  | "manage_own_orders"
  | "manage_own_refunds"
  | "manage_all_shops"
  | "approve_shop"
  | "manage_users"
  | "manage_all_orders"
  | "manage_all_refunds"
  | (string & {})

export function hasPermission(
  user: { permissions?: readonly string[] | null } | null | undefined,
  permission: Permission,
): boolean {
  return !!user?.permissions?.includes(permission)
}

export function hasAny(
  user: { permissions?: readonly string[] | null } | null | undefined,
  permissions: readonly Permission[],
): boolean {
  const owned = user?.permissions
  if (!owned?.length) return false
  return permissions.some((p) => owned.includes(p))
}

export function hasAll(
  user: { permissions?: readonly string[] | null } | null | undefined,
  permissions: readonly Permission[],
): boolean {
  const owned = user?.permissions
  if (!owned?.length) return false
  return permissions.every((p) => owned.includes(p))
}
