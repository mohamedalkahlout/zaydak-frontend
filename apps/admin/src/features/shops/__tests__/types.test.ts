import { describe, expect, it } from "vitest"

import { ShopStatusFilter } from "@/shared/api/generated/graphql"
import {
  SHOP_STATUSES,
  shopStatus,
  shopsEligibleFor,
  statusBadgeVariant,
  type ShopRow,
} from "../types"

const row = (over: Partial<ShopRow> = {}): ShopRow => ({
  __typename: "Shop",
  id: "shop-1",
  name: "Test Shop",
  slug: "test-shop",
  is_active: true,
  is_approved: true,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  products_count: 0,
  orders_count: 0,
  owner: null,
  ...over,
})

describe("SHOP_STATUSES", () => {
  it("offers every filter value except `all`", () => {
    // `all` is not an option: the console's "no filter" choice omits `status`,
    // which returns active, suspended and pending but not deleted.
    expect([...SHOP_STATUSES].sort()).toEqual(
      Object.values(ShopStatusFilter)
        .filter((value) => value !== ShopStatusFilter.All)
        .sort(),
    )
  })
})

describe("shopStatus", () => {
  it("reads deleted_at before is_active", () => {
    // The soft delete clears is_active too, so reading is_active first would
    // label every deleted shop "suspended".
    expect(
      shopStatus(
        row({ is_active: false, deleted_at: "2026-02-01T00:00:00.000Z" }),
      ),
    ).toBe("deleted")
  })

  it("reads deleted_at before is_approved", () => {
    expect(
      shopStatus(
        row({ is_approved: false, deleted_at: "2026-02-01T00:00:00.000Z" }),
      ),
    ).toBe("deleted")
  })

  it("reads is_approved before is_active", () => {
    // A shop awaiting review has never been live — calling it "suspended"
    // would suggest somebody took it down.
    expect(shopStatus(row({ is_approved: false, is_active: false }))).toBe(
      "pending",
    )
    expect(shopStatus(row({ is_approved: false, is_active: true }))).toBe(
      "pending",
    )
  })

  it("distinguishes active from suspended once approved and alive", () => {
    expect(shopStatus(row())).toBe("active")
    expect(shopStatus(row({ is_active: false }))).toBe("suspended")
  })
})

describe("statusBadgeVariant", () => {
  it("marks the live state and the archived one apart from the rest", () => {
    expect(statusBadgeVariant("active")).toBe("secondary")
    expect(statusBadgeVariant("deleted")).toBe("destructive")
  })

  it("leaves pending and suspended as the quiet, reversible pair", () => {
    expect(statusBadgeVariant("pending")).toBe("outline")
    expect(statusBadgeVariant("suspended")).toBe("outline")
  })
})

describe("shopsEligibleFor", () => {
  const live = row({ id: "live" })
  const suspended = row({ id: "suspended", is_active: false })
  const pendingOn = row({ id: "pending-on", is_approved: false })
  const pendingOff = row({
    id: "pending-off",
    is_approved: false,
    is_active: false,
  })
  const deleted = row({
    id: "deleted",
    is_active: false,
    deleted_at: "2026-02-01T00:00:00.000Z",
  })
  const all = [live, suspended, pendingOn, pendingOff, deleted]

  it("reads is_active, not the status label", () => {
    // A shop awaiting review reads "pending" whichever way its switch is set,
    // so the label cannot answer suspend-or-activate — the same reason the row
    // menu reads `is_active` directly.
    expect(shopsEligibleFor("suspend", all).map((r) => r.id)).toEqual([
      "live",
      "pending-on",
    ])
    expect(shopsEligibleFor("activate", all).map((r) => r.id)).toEqual([
      "suspended",
      "pending-off",
    ])
  })

  it("never offers suspend or activate on a deleted shop", () => {
    // Deleting clears `is_active`, so a switch-only rule would offer Reactivate
    // on a deleted row and leave it deleted but switched on.
    expect(shopsEligibleFor("activate", [deleted])).toEqual([])
    expect(shopsEligibleFor("suspend", [deleted])).toEqual([])
  })

  it("restores only the deleted ones", () => {
    expect(shopsEligibleFor("restore", all).map((r) => r.id)).toEqual([
      "deleted",
    ])
  })

  it("returns nothing for an empty selection", () => {
    expect(shopsEligibleFor("suspend", [])).toEqual([])
  })
})
