import { describe, expect, it } from "vitest"

import { suggestFollowUps } from "./suggest-follow-ups"
import type { VendorAgentMessage, VendorAgentToolEvent } from "./types"

function message(events: VendorAgentToolEvent[]): VendorAgentMessage {
  return {
    id: "m1",
    role: "assistant",
    content: "",
    tool_events: events,
    created_at: "2026-09-04T00:00:00.000Z",
  }
}

const ASKED = {
  ok: true,
  needs_location: true,
  count: 2,
  locations: [
    { id: "l1", name: "الرياض", city: "Riyadh", is_default: true, is_active: true, fulfills_online_orders: true },
    { id: "l2", name: "جدة", city: "Jeddah", is_default: false, is_active: true, fulfills_online_orders: true },
  ],
}

describe("suggestFollowUps", () => {
  it("offers the warehouses as the chips when the create stopped to ask", () => {
    // Tapping a name answers the question. "Publish it" would describe a
    // product that does not exist yet.
    const chips = suggestFollowUps(
      message([{ name: "create_product", args: {}, ok: true, result: ASKED }]),
      "ar",
    )
    expect(chips).toEqual(["الرياض", "جدة"])
  })

  it("keeps the usual create follow-ups once a form was drafted", () => {
    const chips = suggestFollowUps(
      message([
        {
          name: "create_product",
          args: {},
          ok: true,
          result: { ok: true, navigate_to_form: { target: "product_create", url: "/x", prefill: {} } },
        },
      ]),
      "en",
    )
    expect(chips).toContain("Publish it")
  })

  it("caps the chips at four warehouses", () => {
    const many = {
      ...ASKED,
      count: 6,
      locations: Array.from({ length: 6 }, (_, i) => ({
        ...ASKED.locations[0],
        id: `l${i}`,
        name: `W${i}`,
      })),
    }
    const chips = suggestFollowUps(
      message([{ name: "create_product", args: {}, ok: true, result: many }]),
      "en",
    )
    expect(chips).toHaveLength(4)
  })

  it("compares shop stats with the window before the one shown, not always last month", () => {
    // A 7-day card offering "Compare vs last month" asked for a range the
    // card never showed. The v2 payload's `period` names the window.
    const weekly = suggestFollowUps(
      message([
        {
          name: "get_shop_stats",
          args: { period: "weekly" },
          ok: true,
          result: { ok: true, version: 2, period: "weekly", revenue: {} },
        },
      ]),
      "en",
    )
    expect(weekly).toContain("Compare with the 7 days before")
    expect(weekly).not.toContain("Compare vs last month")

    // A v1 turn from history carries `period` too.
    const today = suggestFollowUps(
      message([
        {
          name: "get_shop_stats",
          args: {},
          ok: true,
          result: { ok: true, period: "today", revenue: {} },
        },
      ]),
      "ar",
    )
    expect(today).toContain("قارن مع مبارح")
  })

  it("falls back to the call's own period argument, then to a neutral comparison", () => {
    const monthly = suggestFollowUps(
      message([
        { name: "get_shop_stats", args: { period: "monthly" }, ok: true, result: { ok: true } },
      ]),
      "en",
    )
    expect(monthly).toContain("Compare with the 30 days before")

    const unknown = suggestFollowUps(
      message([{ name: "get_shop_stats", args: {}, ok: true, result: null }]),
      "en",
    )
    expect(unknown).toContain("Compare vs prior period")
  })
})
