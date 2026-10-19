import { describe, expect, it } from "vitest"

import { ADMIN_ROLES, isAdminRole } from "../roles"

describe("isAdminRole", () => {
  it.each(ADMIN_ROLES)("admits %s", (role) => {
    expect(isAdminRole(role)).toBe(true)
  })

  it.each(["vendor", "customer", "", "root", "administrator"])(
    "rejects %j",
    (role) => {
      expect(isAdminRole(role)).toBe(false)
    },
  )

  it("rejects null and undefined", () => {
    expect(isAdminRole(null)).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
  })

  it("is case-sensitive — the back-end emits lowercase roles", () => {
    expect(isAdminRole("ADMIN")).toBe(false)
    expect(isAdminRole("Super_Admin")).toBe(false)
  })
})
