import type { AdminUsersQuery } from "@/shared/api/generated/graphql"
import { UserRole } from "@/shared/api/generated/graphql"

/** One row of the `users` list. */
export type UserRow = NonNullable<AdminUsersQuery["users"]["data"]>[number]

/** Filter and form option order — least privileged first, the way it reads. */
export const ROLES = [
  UserRole.Customer,
  UserRole.Vendor,
  UserRole.Admin,
  UserRole.SuperAdmin,
] as const

export const AVAILABLE_PERMISSIONS = [
  // Shop
  "create_shop",
  "manage_own_shop",
  "manage_all_shops",
  "approve_shop",
  // Users
  "manage_users",
  // Orders
  "manage_own_orders",
  "manage_all_orders",
  // Refunds
  "manage_own_refunds",
  "manage_all_refunds",
  // Plans & Integrations
  "manage_plans",
  "manage_integrations",
  // System
  "manage_role_permissions",
] as const

export type PermissionKey = (typeof AVAILABLE_PERMISSIONS)[number]

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, readonly PermissionKey[]> = {
  [UserRole.Customer]: [],
  [UserRole.Vendor]: [
    "create_shop",
    "manage_own_shop",
    "manage_own_orders",
    "manage_own_refunds",
  ],
  [UserRole.Admin]: [
    "manage_all_shops",
    "approve_shop",
    "manage_users",
    "manage_all_orders",
    "manage_all_refunds",
    "manage_plans",
    "manage_integrations",
  ],
  [UserRole.SuperAdmin]: [...AVAILABLE_PERMISSIONS],
}

/**
 * The roles only a `super_admin` may hand out or act on.
 *
 * `UsersService.assertMayAssignRole` / `assertMayTarget` are the enforcement;
 * this list only decides what the console offers, so the rule is visible before
 * the request rather than as a 403 after it.
 */
const PRIVILEGED: readonly string[] = [UserRole.Admin, UserRole.SuperAdmin]

export function isPrivilegedRole(role: string): boolean {
  return PRIVILEGED.includes(role)
}

/**
 * Whether the signed-in admin may act on this row.
 *
 * Two rules, both mirrored from the service: nobody acts on their own account,
 * and only a `super_admin` acts on an administrator.
 */
export function canManage(
  row: Pick<UserRow, "id" | "role">,
  actor: { id?: string | null; role?: string | null },
): boolean {
  // `me` is still in flight on first paint. Without an identity the self-check
  // below cannot run, so nothing is offered rather than offering the caller
  // their own suspend button for one render.
  if (!actor.id) return false
  if (row.id === actor.id) return false
  if (isPrivilegedRole(row.role) && actor.role !== UserRole.SuperAdmin)
    return false
  return true
}

export type AccountStatus = "active" | "suspended" | "deleted"

/**
 * Suspension and deletion are separate columns, and `deleted_at` wins: the
 * delete path sets `is_active: false` as well, so reading `is_active` first
 * would label every deleted account "suspended".
 */
export function accountStatus(row: UserRow): AccountStatus {
  if (row.deleted_at) return "deleted"
  return row.is_active ? "active" : "suspended"
}

export function statusBadgeVariant(
  status: AccountStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "secondary"
    case "suspended":
      return "outline"
    case "deleted":
      return "destructive"
  }
}

/**
 * Where a password-reset code would actually go.
 *
 * `forgetPassword` takes one `identifier` and accepts either form, so the
 * console picks the email when there is one and falls back to the phone. Null
 * means the account has neither and there is nowhere to send — which the row
 * action has to know before it offers itself, since the mutation would answer
 * `success: true` regardless.
 */
export function resetIdentifier(
  row: Pick<UserRow, "email" | "phone">,
): string | null {
  return row.email ?? row.phone ?? null
}

/**
 * Whether "Send password reset" may be offered on this row.
 *
 * The active check is the load-bearing part. `AuthService.forgetPassword` looks
 * the account up with `is_active: true` plus the soft-delete filter and returns
 * `{ success: true }` when nothing matches — deliberate anti-enumeration on a
 * public mutation, but from this console it means firing at a suspended or
 * deleted account gives the operator a success toast and sends nothing at all.
 * So the action is gated here rather than trusted afterwards.
 */
export function canSendPasswordReset(
  row: UserRow,
  actor: { id?: string | null; role?: string | null },
): boolean {
  return (
    canManage(row, actor) &&
    accountStatus(row) === "active" &&
    resetIdentifier(row) !== null
  )
}

/** The bulk actions the selection bar offers. `edit` is single-row by nature. */
export type BulkKind = "suspend" | "activate" | "delete" | "restore"

/**
 * The rows a header checkbox may tick — the same `canManage` rule the row menu
 * uses, so "select all" cannot hand the bar the caller's own account or an
 * administrator a plain admin may not touch.
 */
export function selectableUsers(
  rows: readonly UserRow[],
  actor: { id?: string | null; role?: string | null },
): UserRow[] {
  return rows.filter((row) => canManage(row, actor))
}

/**
 * Of a selection, the rows one bulk action would actually change.
 *
 * Each button names this count rather than the selection's, because the states
 * are mixed by construction: an admin filtering by nothing sees active and
 * suspended rows together, and Suspend on a suspended account is a no-op the
 * server would happily perform. Restore is the mirror — only deleted rows have
 * anything to restore — and Delete refuses rows that are already gone.
 */
export function usersEligibleFor(
  kind: BulkKind,
  rows: readonly UserRow[],
): UserRow[] {
  return rows.filter((row) => {
    const state = accountStatus(row)
    switch (kind) {
      case "suspend":
        return state === "active"
      case "activate":
        return state === "suspended"
      case "restore":
        return state === "deleted"
      case "delete":
        return state !== "deleted"
    }
  })
}
