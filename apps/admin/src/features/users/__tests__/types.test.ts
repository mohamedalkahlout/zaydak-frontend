import { describe, expect, it } from "vitest"

import { UserRole } from "@/shared/api/generated/graphql"
import {
  AVAILABLE_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLES,
  accountStatus,
  canManage,
  canSendPasswordReset,
  isPrivilegedRole,
  resetIdentifier,
  selectableUsers,
  statusBadgeVariant,
  usersEligibleFor,
  type UserRow,
} from "../types"

const row = (over: Partial<UserRow> = {}): UserRow => ({
  __typename: "User",
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  phone: null,
  role: UserRole.Customer,
  permissions: [],
  email_verified: false,
  is_active: true,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  ...over,
})

const admin = { id: "admin-1", role: UserRole.Admin }
const superAdmin = { id: "super-1", role: UserRole.SuperAdmin }

describe("ROLES", () => {
  it("covers every value of the back-end enum", () => {
    expect([...ROLES].sort()).toEqual(Object.values(UserRole).sort())
  })
})

describe("AVAILABLE_PERMISSIONS and defaults", () => {
  it("contains all expected granular permissions", () => {
    expect(AVAILABLE_PERMISSIONS).toContain("create_shop")
    expect(AVAILABLE_PERMISSIONS).toContain("manage_users")
    expect(AVAILABLE_PERMISSIONS).toContain("manage_role_permissions")
  })

  it("assigns empty array for customer role by default", () => {
    expect(ROLE_DEFAULT_PERMISSIONS[UserRole.Customer]).toEqual([])
  })

  it("assigns vendor-specific permissions for vendor role by default", () => {
    expect(ROLE_DEFAULT_PERMISSIONS[UserRole.Vendor]).toEqual([
      "create_shop",
      "manage_own_shop",
      "manage_own_orders",
      "manage_own_refunds",
    ])
  })

  it("assigns all permissions for super_admin role", () => {
    expect(ROLE_DEFAULT_PERMISSIONS[UserRole.SuperAdmin]).toEqual(
      AVAILABLE_PERMISSIONS,
    )
  })
})

describe("accountStatus", () => {
  it("reads deleted_at before is_active", () => {
    // The delete path sets both, so reading is_active first would label every
    // deleted account "suspended".
    expect(
      accountStatus(row({ is_active: false, deleted_at: "2026-02-01T00:00:00Z" })),
    ).toBe("deleted")
  })

  it("distinguishes active from suspended", () => {
    expect(accountStatus(row())).toBe("active")
    expect(accountStatus(row({ is_active: false }))).toBe("suspended")
  })

  it("gives each state its own badge variant", () => {
    const variants = (["active", "suspended", "deleted"] as const).map(
      statusBadgeVariant,
    )
    expect(new Set(variants).size).toBe(3)
  })
})

describe("isPrivilegedRole", () => {
  it("covers both administrator roles and neither of the others", () => {
    expect(isPrivilegedRole(UserRole.Admin)).toBe(true)
    expect(isPrivilegedRole(UserRole.SuperAdmin)).toBe(true)
    expect(isPrivilegedRole(UserRole.Vendor)).toBe(false)
    expect(isPrivilegedRole(UserRole.Customer)).toBe(false)
  })
})

describe("canManage", () => {
  it("refuses the caller's own row", () => {
    expect(canManage(row({ id: admin.id }), admin)).toBe(false)
  })

  it("refuses an administrator row for a plain admin", () => {
    expect(canManage(row({ role: UserRole.Admin }), admin)).toBe(false)
    expect(canManage(row({ role: UserRole.SuperAdmin }), admin)).toBe(false)
  })

  it("allows an administrator row for a super admin", () => {
    expect(canManage(row({ role: UserRole.Admin }), superAdmin)).toBe(true)
  })

  it("allows ordinary rows for a plain admin", () => {
    expect(canManage(row({ role: UserRole.Vendor }), admin)).toBe(true)
  })

  it("refuses everything while the caller is still unknown", () => {
    // `me` is in flight on first paint — no identity means no actions offered,
    // ordinary rows included, since the self-check cannot run yet.
    expect(canManage(row({ role: UserRole.Vendor }), { id: null, role: null })).toBe(
      false,
    )
    expect(canManage(row({ role: UserRole.Admin }), { id: null, role: null })).toBe(
      false,
    )
  })
})

describe("resetIdentifier", () => {
  it("prefers the email", () => {
    expect(
      resetIdentifier(row({ email: "a@example.com", phone: "966500000000" })),
    ).toBe("a@example.com")
  })

  it("falls back to the phone", () => {
    expect(resetIdentifier(row({ email: null, phone: "966500000000" }))).toBe(
      "966500000000",
    )
  })

  it("is null when there is nowhere to send", () => {
    expect(resetIdentifier(row({ email: null, phone: null }))).toBeNull()
  })
})

describe("canSendPasswordReset", () => {
  it("refuses the caller's own row", () => {
    expect(canSendPasswordReset(row({ id: admin.id }), admin)).toBe(false)
  })

  it("refuses an administrator row for a plain admin", () => {
    expect(canSendPasswordReset(row({ role: UserRole.Admin }), admin)).toBe(false)
  })

  it("allows an administrator row for a super admin", () => {
    expect(canSendPasswordReset(row({ role: UserRole.Admin }), superAdmin)).toBe(
      true,
    )
  })

  it("refuses a suspended row", () => {
    // `forgetPassword` looks the account up with `is_active: true` and answers
    // `success: true` when nothing matches, so offering this would give the
    // operator a success toast for a code that was never sent.
    expect(canSendPasswordReset(row({ is_active: false }), admin)).toBe(false)
  })

  it("refuses a deleted row, for the same reason", () => {
    expect(
      canSendPasswordReset(
        row({ deleted_at: "2026-02-01T00:00:00.000Z" }),
        admin,
      ),
    ).toBe(false)
  })

  it("refuses a row with neither an email nor a phone", () => {
    expect(
      canSendPasswordReset(row({ email: null, phone: null }), admin),
    ).toBe(false)
  })

  it("allows a phone-only row", () => {
    const phoneOnly = row({ email: null, phone: "966500000000" })
    expect(canSendPasswordReset(phoneOnly, admin)).toBe(true)
    expect(resetIdentifier(phoneOnly)).toBe("966500000000")
  })

  it("refuses everything while the caller is still unknown", () => {
    expect(canSendPasswordReset(row(), { id: null, role: null })).toBe(false)
  })
})

describe("selectableUsers", () => {
  it("excludes the caller's own row and administrator rows for a plain admin", () => {
    const rows = [
      row({ id: admin.id }),
      row({ id: "u-2", role: UserRole.Admin }),
      row({ id: "u-3", role: UserRole.Vendor }),
    ]
    expect(selectableUsers(rows, admin).map((r) => r.id)).toEqual(["u-3"])
  })

  it("lets a super admin select an administrator but still not themselves", () => {
    const rows = [
      row({ id: superAdmin.id, role: UserRole.SuperAdmin }),
      row({ id: "u-2", role: UserRole.Admin }),
    ]
    expect(selectableUsers(rows, superAdmin).map((r) => r.id)).toEqual(["u-2"])
  })

  it("selects nothing while the caller is still unknown", () => {
    expect(selectableUsers([row()], { id: null, role: null })).toEqual([])
  })
})

describe("usersEligibleFor", () => {
  const active = row({ id: "active" })
  const suspended = row({ id: "suspended", is_active: false })
  const deleted = row({
    id: "deleted",
    is_active: false,
    deleted_at: "2026-02-01T00:00:00.000Z",
  })
  const all = [active, suspended, deleted]

  it("suspends only the live accounts", () => {
    expect(usersEligibleFor("suspend", all).map((r) => r.id)).toEqual(["active"])
  })

  it("reactivates only the suspended ones — not the deleted ones", () => {
    // Deleting clears `is_active` too, so a status-blind rule would offer
    // Reactivate on a deleted row and leave it deleted but switched on.
    expect(usersEligibleFor("activate", all).map((r) => r.id)).toEqual([
      "suspended",
    ])
  })

  it("restores only the deleted ones", () => {
    expect(usersEligibleFor("restore", all).map((r) => r.id)).toEqual([
      "deleted",
    ])
  })

  it("deletes anything not already deleted", () => {
    expect(usersEligibleFor("delete", all).map((r) => r.id)).toEqual([
      "active",
      "suspended",
    ])
  })

  it("returns nothing for an empty selection", () => {
    expect(usersEligibleFor("suspend", [])).toEqual([])
  })
})
