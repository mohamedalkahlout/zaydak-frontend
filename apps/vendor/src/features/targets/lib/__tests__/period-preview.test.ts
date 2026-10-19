import { describe, expect, it } from "vitest"
import { resolvePeriodPreview } from "../period-preview"

// A fixed "now" so labels and days-left are deterministic: Tue Jul 7, 2026.
const NOW = new Date(2026, 6, 7, 14, 0, 0)
const EN = "en-US"

describe("resolvePeriodPreview", () => {
  it("resolves the current month with days-left excluding today", () => {
    const p = resolvePeriodPreview("MONTH", { now: NOW, locale: EN })
    expect(p.label).toBe("July 2026")
    expect(p.start).toEqual(new Date(2026, 6, 1))
    expect(p.end).toEqual(new Date(2026, 7, 1))
    // Jul 8..Jul 31 inclusive = 24 whole days remaining.
    expect(p.daysLeft).toBe(24)
  })

  it("resolves the current quarter", () => {
    const p = resolvePeriodPreview("QUARTER", { now: NOW, locale: EN })
    expect(p.label).toBe("Q3 2026")
    expect(p.start).toEqual(new Date(2026, 6, 1))
    expect(p.end).toEqual(new Date(2026, 9, 1))
  })

  it("resolves the current year", () => {
    const p = resolvePeriodPreview("YEAR", { now: NOW, locale: EN })
    expect(p.label).toBe("2026")
    expect(p.start).toEqual(new Date(2026, 0, 1))
    expect(p.end).toEqual(new Date(2027, 0, 1))
  })

  it("resolves the current week starting Sunday", () => {
    const p = resolvePeriodPreview("WEEK", { now: NOW, locale: EN })
    // Jul 7 2026 is a Tuesday → week starts Sun Jul 5, ends (exclusive) Jul 12.
    expect(p.start).toEqual(new Date(2026, 6, 5))
    expect(p.end).toEqual(new Date(2026, 6, 12))
    expect(p.daysLeft).toBe(4) // Jul 8..Jul 11
  })

  it("resolves a custom range from yyyy-mm-dd inputs", () => {
    const p = resolvePeriodPreview("CUSTOM", {
      now: NOW,
      locale: EN,
      start: "2026-07-01",
      end: "2026-07-20",
    })
    expect(p.start).toEqual(new Date(2026, 6, 1))
    expect(p.end).toEqual(new Date(2026, 6, 21)) // end inclusive → exclusive
    expect(p.daysLeft).toBe(13) // Jul 8..Jul 20
  })

  it("falls back to a dash label for an incomplete custom range", () => {
    const p = resolvePeriodPreview("CUSTOM", { now: NOW, locale: EN })
    expect(p.label).toBe("—")
    expect(p.daysLeft).toBe(0)
  })
})
