import { describe, expect, it } from "vitest"
import type { NegotiationOutcomeFigures } from "../../types"
import {
  formatRate,
  formatRounds,
  ROLLUP_PRODUCT_LIMIT,
  STRATEGIES,
  trendChartPoints,
  trendHasData,
} from "../outcomes"

const figures = (
  overrides: Partial<NegotiationOutcomeFigures> = {},
): NegotiationOutcomeFigures => ({
  sessions: 0,
  accepted: 0,
  redeemed: 0,
  acceptance_bps: 0,
  conversion_bps: 0,
  revenue_cents: 0,
  discount_cents: 0,
  avg_discount_bps: null,
  margin_cents: null,
  margin_bps: null,
  redeemed_without_cost: 0,
  floor_reached: 0,
  floor_reached_bps: null,
  avg_rounds_to_close: null,
  ...overrides,
})

describe("formatRate", () => {
  it("reads basis points as a percentage to one decimal", () => {
    expect(formatRate(1333, "en")).toBe("13.3%")
    expect(formatRate(1500, "en")).toBe("15%")
    expect(formatRate(10000, "en")).toBe("100%")
    expect(formatRate(-250, "en")).toBe("-2.5%")
  })

  it("says nothing — not 0% — for a rate with no base", () => {
    expect(formatRate(null, "en")).toBe("—")
    expect(formatRate(undefined, "en")).toBe("—")
    expect(formatRate(0, "en")).toBe("0%")
  })

  it("follows the dashboard's language", () => {
    expect(formatRate(1333, "ar")).toBe(
      new Intl.NumberFormat("ar", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(0.1333),
    )
  })
})

describe("formatRounds", () => {
  it("shows one decimal, and a dash when no deal closed", () => {
    expect(formatRounds(2.4, "en")).toBe("2.4")
    expect(formatRounds(3, "en")).toBe("3")
    expect(formatRounds(null, "en")).toBe("—")
  })
})

describe("trendChartPoints", () => {
  it("flattens each bucket's counts and money for the chart", () => {
    const points = trendChartPoints([
      {
        date: "2026-09-01",
        figures: figures({
          sessions: 3,
          accepted: 2,
          redeemed: 1,
          revenue_cents: 8500,
          discount_cents: 1500,
          avg_discount_bps: 1500,
        }),
      },
    ])
    expect(points).toEqual([
      {
        date: "2026-09-01",
        sessions: 3,
        accepted: 2,
        redeemed: 1,
        revenue_cents: 8500,
        discount_cents: 1500,
      },
    ])
  })

  it("has data only when some bucket had a negotiation", () => {
    const empty = trendChartPoints([
      { date: "2026-09-01", figures: figures() },
      { date: "2026-09-02", figures: figures() },
    ])
    expect(trendHasData(empty)).toBe(false)
    expect(trendHasData([])).toBe(false)
    expect(
      trendHasData(
        trendChartPoints([
          { date: "2026-09-01", figures: figures({ sessions: 1 }) },
        ]),
      ),
    ).toBe(true)
  })
})

describe("rollup constants", () => {
  it("lists the strategies firmest first and asks for ten products", () => {
    expect(STRATEGIES).toEqual(["conservative", "balanced", "aggressive"])
    expect(ROLLUP_PRODUCT_LIMIT).toBe(10)
  })
})
