import { describe, expect, it } from "vitest"
import type { SalesChannel } from "@/shared/lib/sales-channels"
import type { SalesChannelRow } from "../../types"
import {
  channelHasSeries,
  channelSeries,
  channelShares,
  emptyChannelRow,
  isEmptyChannelReport,
  isIdleChannel,
  niceTicks,
  normalizeChannelRows,
  orderChannelRows,
  pickHeadline,
  segmentEdges,
  sharePercent,
  stackExtent,
  type ChannelPoint,
} from "../channel-mix"
import {
  formatAxisTick,
  formatShare,
} from "../../components/sales-channels/format"

function row(
  channel: SalesChannel,
  overrides: Partial<SalesChannelRow> = {},
): SalesChannelRow {
  return { ...emptyChannelRow(channel), ...overrides }
}

// The shop that prompted this section: most of its sales came through the
// Telegram assistant (entaj, last 30 days, from the API step's example).
const ENTAJ: SalesChannelRow[] = [
  row("ONLINE_STORE", { orders_count: 2, total_sales_cents: 6810 }),
  row("TELEGRAM", { orders_count: 11, total_sales_cents: 101950 }),
  row("WHATSAPP", { connected: false }),
  row("DRAFT_ORDER", { orders_count: 2, total_sales_cents: 11350 }),
]

const channelsOf = (rows: SalesChannelRow[]) => rows.map((r) => r.channel)

describe("normalizeChannelRows", () => {
  it("returns one row per channel in display order", () => {
    const shuffled = [ENTAJ[3], ENTAJ[1], ENTAJ[0], ENTAJ[2]]
    expect(channelsOf(normalizeChannelRows(shuffled))).toEqual([
      "ONLINE_STORE",
      "TELEGRAM",
      "WHATSAPP",
      "DRAFT_ORDER",
    ])
  })

  it("zero-fills a missing channel and drops one it does not know", () => {
    const rows = normalizeChannelRows([
      ENTAJ[1],
      { ...ENTAJ[0], channel: "INSTAGRAM" as SalesChannel },
    ])
    expect(rows).toHaveLength(4)
    expect(rows[1].total_sales_cents).toBe(101950)
    expect(rows[0]).toEqual(emptyChannelRow("ONLINE_STORE"))
  })

  it("keeps the first row when a channel repeats", () => {
    const rows = normalizeChannelRows([
      ENTAJ[1],
      row("TELEGRAM", { total_sales_cents: 1 }),
    ])
    expect(rows[1].total_sales_cents).toBe(101950)
  })

  it("treats a missing list as four empty channels", () => {
    expect(normalizeChannelRows(undefined).every(isIdleChannel)).toBe(true)
  })
})

describe("orderChannelRows", () => {
  it("sorts by sales, largest first, with zero channels last", () => {
    expect(channelsOf(orderChannelRows(ENTAJ, "sales"))).toEqual([
      "TELEGRAM",
      "DRAFT_ORDER",
      "ONLINE_STORE",
      "WHATSAPP",
    ])
  })

  it("breaks ties in display order", () => {
    // Online store and manual orders both have 2 orders.
    expect(channelsOf(orderChannelRows(ENTAJ, "orders"))).toEqual([
      "TELEGRAM",
      "ONLINE_STORE",
      "DRAFT_ORDER",
      "WHATSAPP",
    ])
  })

  it("keeps several zero channels in display order", () => {
    const rows = [
      row("ONLINE_STORE"),
      row("TELEGRAM"),
      row("WHATSAPP", { orders_count: 1, total_sales_cents: 500 }),
      row("DRAFT_ORDER"),
    ]
    expect(channelsOf(orderChannelRows(rows, "sales"))).toEqual([
      "WHATSAPP",
      "ONLINE_STORE",
      "TELEGRAM",
      "DRAFT_ORDER",
    ])
  })

  it("puts a net-negative channel after the positive ones but before zeros", () => {
    const rows = [
      row("ONLINE_STORE", { total_sales_cents: -300, returns_cents: 300 }),
      row("TELEGRAM", { orders_count: 1, total_sales_cents: 1000 }),
      row("WHATSAPP"),
      row("DRAFT_ORDER"),
    ]
    expect(channelsOf(orderChannelRows(rows, "sales"))).toEqual([
      "TELEGRAM",
      "ONLINE_STORE",
      "WHATSAPP",
      "DRAFT_ORDER",
    ])
  })
})

describe("channelShares", () => {
  it("splits the positive total", () => {
    const shares = channelShares(ENTAJ, "sales")
    expect(shares.TELEGRAM).toBeCloseTo(101950 / 120110)
    expect(shares.WHATSAPP).toBe(0)
    const sum = Object.values(shares).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })

  it("gives a net-negative channel no slice instead of a negative one", () => {
    const rows = [
      row("ONLINE_STORE", { total_sales_cents: -2000, returns_cents: 2000 }),
      row("TELEGRAM", { orders_count: 1, total_sales_cents: 6000 }),
      row("WHATSAPP", { orders_count: 1, total_sales_cents: 2000 }),
      row("DRAFT_ORDER"),
    ]
    const shares = channelShares(rows, "sales")
    expect(shares.ONLINE_STORE).toBe(0)
    expect(shares.TELEGRAM).toBeCloseTo(0.75)
    expect(shares.WHATSAPP).toBeCloseTo(0.25)
  })

  it("is all zeros when nothing positive happened", () => {
    const shares = channelShares(normalizeChannelRows([]), "orders")
    expect(Object.values(shares)).toEqual([0, 0, 0, 0])
  })
})

describe("sharePercent", () => {
  it("rounds to a whole percent", () => {
    expect(sharePercent(101950 / 120110)).toEqual({
      kind: "value",
      percent: 85,
    })
    expect(sharePercent(0.005)).toEqual({ kind: "value", percent: 1 })
  })

  it("never shows a real slice as 0%", () => {
    expect(sharePercent(0.004)).toEqual({ kind: "below-one" })
  })

  it("keeps 0 for no slice at all", () => {
    expect(sharePercent(0)).toEqual({ kind: "value", percent: 0 })
    expect(sharePercent(Number.NaN)).toEqual({ kind: "value", percent: 0 })
  })

  it("only says 100% when the channel took everything", () => {
    expect(sharePercent(0.996)).toEqual({ kind: "value", percent: 99 })
    expect(sharePercent(1)).toEqual({ kind: "value", percent: 100 })
  })
})

describe("pickHeadline", () => {
  it("names the leading channel and its share", () => {
    const headline = pickHeadline(ENTAJ, "sales")
    expect(headline.kind).toBe("leader")
    if (headline.kind !== "leader") return
    expect(headline.channel).toBe("TELEGRAM")
    expect(headline.share).toBeCloseTo(101950 / 120110)
  })

  it("follows the measure", () => {
    const headline = pickHeadline(ENTAJ, "orders")
    expect(headline).toEqual({
      kind: "leader",
      channel: "TELEGRAM",
      share: 11 / 15,
    })
  })

  it("says 'all' when one channel took every sale", () => {
    const rows = normalizeChannelRows([
      row("WHATSAPP", { orders_count: 3, total_sales_cents: 9000 }),
    ])
    expect(pickHeadline(rows, "sales")).toEqual({
      kind: "all",
      channel: "WHATSAPP",
    })
  })

  it("says 'all' when the only other channel is net-negative", () => {
    const rows = normalizeChannelRows([
      row("TELEGRAM", { orders_count: 3, total_sales_cents: 9000 }),
      row("ONLINE_STORE", { total_sales_cents: -500, returns_cents: 500 }),
    ])
    expect(pickHeadline(rows, "sales").kind).toBe("all")
  })

  it("says 'none' when nothing positive happened", () => {
    expect(pickHeadline(normalizeChannelRows([]), "sales")).toEqual({
      kind: "none",
    })
    const refundsOnly = normalizeChannelRows([
      row("ONLINE_STORE", { total_sales_cents: -500, returns_cents: 500 }),
    ])
    expect(pickHeadline(refundsOnly, "sales")).toEqual({ kind: "none" })
  })
})

describe("isIdleChannel / isEmptyChannelReport", () => {
  it("counts a refund as activity", () => {
    expect(isIdleChannel(row("TELEGRAM"))).toBe(true)
    expect(isIdleChannel(row("TELEGRAM", { returns_cents: 100 }))).toBe(false)
  })

  it("is empty only when every channel is idle", () => {
    expect(isEmptyChannelReport(normalizeChannelRows([]))).toBe(true)
    expect(isEmptyChannelReport(ENTAJ)).toBe(false)
  })
})

describe("channelSeries", () => {
  const point = (
    date: string,
    total_sales_cents: number,
    orders_count = 1,
  ) => ({
    date,
    total_sales_cents,
    orders_count,
  })

  it("merges every row's buckets, sorted, zero-filling the gaps", () => {
    const rows = normalizeChannelRows([
      row("TELEGRAM", {
        series: [point("2026-09-27", 37510, 3), point("2026-09-26", 11350, 4)],
      }),
      row("DRAFT_ORDER", { series: [point("2026-09-23", 2270)] }),
    ])
    expect(channelSeries(rows, "sales")).toEqual([
      {
        date: "2026-09-23",
        ONLINE_STORE: 0,
        TELEGRAM: 0,
        WHATSAPP: 0,
        DRAFT_ORDER: 2270,
      },
      {
        date: "2026-09-26",
        ONLINE_STORE: 0,
        TELEGRAM: 11350,
        WHATSAPP: 0,
        DRAFT_ORDER: 0,
      },
      {
        date: "2026-09-27",
        ONLINE_STORE: 0,
        TELEGRAM: 37510,
        WHATSAPP: 0,
        DRAFT_ORDER: 0,
      },
    ])
    expect(channelSeries(rows, "orders")[1].TELEGRAM).toBe(4)
  })

  it("sorts month buckets too", () => {
    const rows = normalizeChannelRows([
      row("ONLINE_STORE", {
        series: [point("2026-09", 1), point("2026-07", 2)],
      }),
    ])
    expect(channelSeries(rows, "sales").map((p) => p.date)).toEqual([
      "2026-07",
      "2026-09",
    ])
  })

  it("reports which channels draw anything", () => {
    const points = channelSeries(
      normalizeChannelRows([
        row("TELEGRAM", { series: [point("2026-09-01", 5)] }),
      ]),
      "sales",
    )
    expect(channelHasSeries(points, "TELEGRAM")).toBe(true)
    expect(channelHasSeries(points, "WHATSAPP")).toBe(false)
  })
})

describe("segmentEdges", () => {
  const p: ChannelPoint = {
    date: "2026-09-01",
    ONLINE_STORE: 100,
    TELEGRAM: -40,
    WHATSAPP: 300,
    DRAFT_ORDER: -10,
  }

  it("marks the baseline and the data end of the positive stack", () => {
    expect(segmentEdges(p, "ONLINE_STORE")).toEqual({
      isBase: true,
      isEnd: false,
    })
    expect(segmentEdges(p, "WHATSAPP")).toEqual({ isBase: false, isEnd: true })
  })

  it("does the same for the negative stack, downward", () => {
    expect(segmentEdges(p, "TELEGRAM")).toEqual({ isBase: true, isEnd: false })
    expect(segmentEdges(p, "DRAFT_ORDER")).toEqual({
      isBase: false,
      isEnd: true,
    })
  })

  it("treats a lone segment as both", () => {
    const lone = { ...p, TELEGRAM: 0, WHATSAPP: 0, DRAFT_ORDER: 0 }
    expect(segmentEdges(lone, "ONLINE_STORE")).toEqual({
      isBase: true,
      isEnd: true,
    })
    expect(segmentEdges(lone, "TELEGRAM")).toEqual({
      isBase: false,
      isEnd: false,
    })
  })
})

describe("stackExtent / niceTicks", () => {
  it("measures the tallest positive and deepest negative stack", () => {
    const points: ChannelPoint[] = [
      {
        date: "a",
        ONLINE_STORE: 100,
        TELEGRAM: 200,
        WHATSAPP: 0,
        DRAFT_ORDER: 0,
      },
      {
        date: "b",
        ONLINE_STORE: -420,
        TELEGRAM: 50,
        WHATSAPP: -30,
        DRAFT_ORDER: 0,
      },
    ]
    expect(stackExtent(points)).toEqual({ min: -450, max: 300 })
    expect(stackExtent([])).toEqual({ min: 0, max: 0 })
  })

  it("steps money in clean major units", () => {
    // entaj's busiest day: 530.90 SAR.
    expect(niceTicks(0, 53090, 100)).toEqual([0, 20000, 40000, 60000])
    // A refund day below zero keeps the same clean step.
    expect(niceTicks(-4200, 34500, 100)).toEqual([
      -10000, 0, 10000, 20000, 30000, 40000,
    ])
    // Small amounts never step below 1 SAR.
    expect(niceTicks(0, 150, 100)).toEqual([0, 100, 200])
  })

  it("never shows a fractional order", () => {
    expect(niceTicks(0, 3, 1)).toEqual([0, 1, 2, 3])
    expect(niceTicks(0, 11, 1)).toEqual([0, 5, 10, 15])
  })

  it("still draws an axis for an all-zero window", () => {
    expect(niceTicks(0, 0, 1)).toEqual([0, 1])
    expect(niceTicks(0, 0, 100)).toEqual([0, 100])
  })
})

describe("formatShare / formatAxisTick", () => {
  const below = (share: string) => `under ${share}`

  it("formats a share as a whole percent", () => {
    expect(formatShare(101950 / 120110, "en", below)).toBe("85%")
  })

  it("hands a sub-1% slice to the translated wording", () => {
    expect(formatShare(0.001, "en", below)).toBe("under 1%")
  })

  it("scales money ticks to major units and compacts them", () => {
    expect(formatAxisTick(120000, "sales", "en")).toBe("1.2K")
    expect(formatAxisTick(1500, "orders", "en")).toBe("1.5K")
    expect(formatAxisTick(900, "sales", "en")).toBe("9")
  })
})
