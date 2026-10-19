import { describe, expect, it } from "vitest"
import {
  aovCents,
  cacCents,
  hasNegativeRevenue,
  roasMultiple,
} from "../attribution"

/**
 * A group's revenue is net of refunds settled in the window, and a refund can
 * belong to an order placed before it, so a group can end at zero orders and
 * negative revenue. None of its ratios may then read as NaN, Infinity or a
 * negative return, whether the API nulls them (current) or not (older).
 */
describe("attribution ratios", () => {
  describe("roasMultiple", () => {
    it("reads bps as a multiple of spend", () => {
      expect(roasMultiple({ revenue_cents: 50_000, roas_bps: 25_000 })).toBe(2.5)
    })

    it("is null without spend", () => {
      expect(roasMultiple({ revenue_cents: 50_000, roas_bps: null })).toBeNull()
    })

    it("is null for a group below zero revenue, whatever the API sent", () => {
      expect(roasMultiple({ revenue_cents: -4_500, roas_bps: -1_500 })).toBeNull()
      expect(roasMultiple({ revenue_cents: -4_500, roas_bps: null })).toBeNull()
      expect(roasMultiple({ revenue_cents: -1, roas_bps: 0 })).toBeNull()
    })

    it("reads zero revenue with spend as 0x, as the API does", () => {
      expect(roasMultiple({ revenue_cents: 0, roas_bps: 0 })).toBe(0)
      // Zero revenue and no spend is still no ROAS.
      expect(roasMultiple({ revenue_cents: 0, roas_bps: null })).toBeNull()
    })

    it("refuses a non-finite ratio", () => {
      expect(
        roasMultiple({ revenue_cents: 100, roas_bps: Number.POSITIVE_INFINITY }),
      ).toBeNull()
      expect(roasMultiple({ revenue_cents: 100, roas_bps: Number.NaN })).toBeNull()
    })
  })

  describe("cacCents", () => {
    it("passes a real figure through", () => {
      expect(cacCents({ cac_cents: 1_250 })).toBe(1_250)
    })

    it("is null for a missing, negative or non-finite figure", () => {
      expect(cacCents({ cac_cents: null })).toBeNull()
      expect(cacCents({ cac_cents: -300 })).toBeNull()
      expect(cacCents({ cac_cents: Number.NaN })).toBeNull()
    })
  })

  describe("aovCents", () => {
    it("is the API's figure for a group with orders", () => {
      expect(aovCents({ orders: 3, aov_cents: 7_400 })).toBe(7_400)
    })

    it("is null for a refund-only group, not a zero average", () => {
      expect(aovCents({ orders: 0, aov_cents: 0 })).toBeNull()
    })

    it("is null when refunds outweigh the group's sales", () => {
      expect(aovCents({ orders: 2, aov_cents: -1_000 })).toBeNull()
    })
  })

  it("hasNegativeRevenue spots any group below zero", () => {
    expect(hasNegativeRevenue([{ revenue_cents: 10 }, { revenue_cents: 0 }])).toBe(
      false,
    )
    expect(
      hasNegativeRevenue([{ revenue_cents: 10 }, { revenue_cents: -1 }]),
    ).toBe(true)
  })
})
