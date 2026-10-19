import { describe, expect, it } from "vitest"
import { storefrontStatus } from "../storefront-status"

// The badge used to read `is_active` alone and said "Connected" over a shop the
// platform had not approved — an address customers could not open. Approval
// is checked first because `disapproveShop` clears both flags together: an
// unapproved shop is waiting on the platform, never merely switched off.
describe("storefrontStatus", () => {
  it("is connected only when approved and active", () => {
    expect(storefrontStatus({ is_approved: true, is_active: true })).toBe("connected")
  })

  it("is inactive when approved but switched off", () => {
    expect(storefrontStatus({ is_approved: true, is_active: false })).toBe("inactive")
  })

  it("is pending approval when unapproved, whatever the switch says", () => {
    expect(storefrontStatus({ is_approved: false, is_active: true })).toBe(
      "pendingApproval",
    )
    expect(storefrontStatus({ is_approved: false, is_active: false })).toBe(
      "pendingApproval",
    )
  })
})
