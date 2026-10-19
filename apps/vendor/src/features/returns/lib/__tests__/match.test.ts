import { describe, expect, it } from "vitest"
import type { ReturnEntry } from "@/features/returns/types"
import { matchReturn } from "../match"

const entry = (over: Partial<ReturnEntry> = {}): ReturnEntry => ({
  id: "aaaaaaaa-bbbb-cccc-dddd-1234567890ab",
  order_id: "order-99",
  customer_id: "cust",
  shop_id: "shop",
  status: "requested",
  reason: "Too small",
  note: "Left at the door",
  restocking_fee_cents: 0,
  line_items: [],
  requested_at: "2026-09-01T00:00:00.000Z",
  created_at: "2026-09-01T00:00:00.000Z",
  ...over,
})

describe("matchReturn", () => {
  it("filters by status view", () => {
    expect(matchReturn(entry(), "", "requested")).toBe(true)
    expect(matchReturn(entry(), "", "approved")).toBe(false)
  })

  it("matches the short id, reason, note, or order id", () => {
    expect(matchReturn(entry(), "90ab", "all")).toBe(true)
    expect(matchReturn(entry(), "small", "all")).toBe(true)
    expect(matchReturn(entry(), "door", "all")).toBe(true)
    expect(matchReturn(entry(), "order-99", "all")).toBe(true)
    expect(matchReturn(entry(), "nope", "all")).toBe(false)
  })
})
