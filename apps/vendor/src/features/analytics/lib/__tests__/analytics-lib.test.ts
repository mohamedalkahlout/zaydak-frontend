import { describe, expect, it } from "vitest"
import { computeDelta, formatBps, formatDeltaPct } from "../metrics"
import {
  formatBucketLabel,
  formatRangeLabel,
  previousWindow,
  rangeForCustom,
  rangeForPreset,
} from "../date-ranges"

describe("previousWindow", () => {
  it("returns the immediately-preceding equal-length window", () => {
    const range = { start: new Date(2026, 5, 7), end: new Date(2026, 6, 7) }
    const span = range.end.getTime() - range.start.getTime()
    const prev = previousWindow(range)
    expect(prev.end.getTime()).toBe(range.start.getTime())
    expect(prev.start.getTime()).toBe(range.start.getTime() - span)
  })
})

describe("computeDelta", () => {
  it("returns no delta when previous is null", () => {
    expect(computeDelta(100, null)).toEqual({ pct: null, direction: "flat" })
  })

  it("computes an upward percentage change", () => {
    const d = computeDelta(150, 100)
    expect(d.direction).toBe("up")
    expect(d.pct).toBeCloseTo(50)
  })

  it("computes a downward percentage change", () => {
    const d = computeDelta(80, 100)
    expect(d.direction).toBe("down")
    expect(d.pct).toBeCloseTo(-20)
  })

  it("treats a tiny change as flat", () => {
    expect(computeDelta(100, 100).direction).toBe("flat")
  })

  it("handles a zero baseline with non-zero current (direction only)", () => {
    const d = computeDelta(50, 0)
    expect(d.pct).toBeNull()
    expect(d.direction).toBe("up")
  })

  it("zero to zero is flat at 0%", () => {
    expect(computeDelta(0, 0)).toEqual({ pct: 0, direction: "flat" })
  })
})

describe("formatBps / formatDeltaPct", () => {
  it("formats basis points as a percentage", () => {
    expect(formatBps(5000)).toBe("50.0%")
    expect(formatBps(null)).toBe("—")
  })

  it("formats a signed delta", () => {
    expect(formatDeltaPct(12.34)).toBe("+12.3%")
    expect(formatDeltaPct(-4)).toBe("-4.0%")
  })
})

describe("rangeForPreset", () => {
  const now = new Date(2026, 5, 15, 14, 30) // Jun 15 2026, local

  it("today starts at local midnight", () => {
    const { start, end } = rangeForPreset("today", now)
    expect(start.getHours()).toBe(0)
    expect(start.getDate()).toBe(15)
    expect(end).toBe(now)
  })

  it("last_7_days spans 7 calendar days inclusive of today", () => {
    const { start } = rangeForPreset("last_7_days", now)
    expect(start.getDate()).toBe(9) // Jun 15 − 6 days
  })

  it("this_month starts on the 1st", () => {
    const { start } = rangeForPreset("this_month", now)
    expect(start.getMonth()).toBe(5)
    expect(start.getDate()).toBe(1)
  })

  it("this_year starts on Jan 1", () => {
    const { start } = rangeForPreset("this_year", now)
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(1)
  })

  it("yesterday is a single day ending at today's midnight", () => {
    const { start, end } = rangeForPreset("yesterday", now)
    expect(start.getDate()).toBe(14)
    expect(end.getDate()).toBe(15) // exclusive — today's midnight
    expect(end.getHours()).toBe(0)
  })

  it("last_month spans the previous calendar month (half-open)", () => {
    const { start, end } = rangeForPreset("last_month", now)
    expect(start.getMonth()).toBe(4) // May
    expect(start.getDate()).toBe(1)
    expect(end.getMonth()).toBe(5) // exclusive — Jun 1
    expect(end.getDate()).toBe(1)
  })
})

describe("rangeForCustom", () => {
  const now = new Date(2026, 6, 6, 14, 30) // Jul 6 2026, local

  it("snaps a past pair to whole days, end exclusive", () => {
    const { start, end } = rangeForCustom(
      { start: new Date(2026, 5, 1, 9, 15), end: new Date(2026, 5, 4, 18, 0) },
      now,
    )
    expect(start).toEqual(new Date(2026, 5, 1))
    expect(end).toEqual(new Date(2026, 5, 5)) // Jun 4 included → Jun 5 excluded
  })

  it("treats a single-day pick as one whole day", () => {
    const { start, end } = rangeForCustom(
      { start: new Date(2026, 5, 10), end: new Date(2026, 5, 10) },
      now,
    )
    expect(start).toEqual(new Date(2026, 5, 10))
    expect(end).toEqual(new Date(2026, 5, 11))
  })

  it("caps a range ending today at now (in-progress window)", () => {
    const { start, end } = rangeForCustom(
      { start: new Date(2026, 6, 1), end: new Date(2026, 6, 6) },
      now,
    )
    expect(start).toEqual(new Date(2026, 6, 1))
    expect(end).toBe(now)
  })

  it("swaps a reversed pair instead of producing an inverted window", () => {
    const { start, end } = rangeForCustom(
      { start: new Date(2026, 5, 20), end: new Date(2026, 5, 3) },
      now,
    )
    expect(start).toEqual(new Date(2026, 5, 3))
    expect(end).toEqual(new Date(2026, 5, 21))
  })

  it("clamps a fully-future pick to an empty window at now", () => {
    const { start, end } = rangeForCustom(
      { start: new Date(2026, 7, 1), end: new Date(2026, 7, 5) },
      now,
    )
    expect(start).toBe(now)
    expect(end).toBe(now)
  })
})

describe("formatRangeLabel", () => {
  it("labels a multi-day window by its inclusive last day", () => {
    const label = formatRangeLabel({
      start: new Date(2026, 5, 1),
      end: new Date(2026, 5, 5), // exclusive → last included day is Jun 4
    })
    expect(label).toMatch(/1/)
    expect(label).toMatch(/4/)
    expect(label).toMatch(/2026/)
  })

  it("labels a single-day window with one date", () => {
    const label = formatRangeLabel({
      start: new Date(2026, 5, 10),
      end: new Date(2026, 5, 11),
    })
    expect(label).not.toMatch(/–/)
    expect(label).toMatch(/10/)
  })
})

describe("formatBucketLabel", () => {
  it("formats a day bucket", () => {
    // Uses UTC; exact locale text varies, but it should not echo the raw key.
    expect(formatBucketLabel("2026-06-01", "day")).not.toBe("2026-06-01")
  })

  it("formats a month bucket and includes the year", () => {
    const label = formatBucketLabel("2026-06", "month")
    expect(label).toMatch(/2026/)
  })

  it("falls back to the raw value on an unparseable date", () => {
    expect(formatBucketLabel("not-a-date", "day")).toBe("not-a-date")
  })

  it("names the month in the dashboard's language, not the browser's", () => {
    expect(formatBucketLabel("2026-09-01", "day", "en")).toBe("Sep 1")
    expect(formatBucketLabel("2026-09-01", "day", "ar")).toContain("سبتمبر")
  })

  it("names a week bucket by the Monday it starts on", () => {
    expect(formatBucketLabel("2026-09-07", "week", "en")).toBe("Sep 7")
    expect(formatBucketLabel("2026-09-07", "week", "ar")).toContain("سبتمبر")
  })
})
