import { describe, expect, it, vi } from "vitest"
import {
  barShare,
  formatCompactCents,
  formatCount,
  isoDaysAgo,
  monthLabels,
  selectableYears,
  translatedName,
} from "../analytics"

describe("analytics lib helpers", () => {
  describe("barShare", () => {
    it("returns 0 for zero or negative values or non-positive max", () => {
      expect(barShare(0, 100)).toBe(0)
      expect(barShare(-5, 100)).toBe(0)
      expect(barShare(50, 0)).toBe(0)
      expect(barShare(50, -10)).toBe(0)
    })

    it("floors at 2% for tiny non-zero values so they stay visible", () => {
      // 0.5% mathematically, but floored at 2%
      expect(barShare(1, 200)).toBe(2)
      expect(barShare(0.01, 1000)).toBe(2)
    })

    it("computes exact proportion when above 2%", () => {
      expect(barShare(50, 100)).toBe(50)
      expect(barShare(100, 100)).toBe(100)
      expect(barShare(25, 100)).toBe(25)
    })
  })

  describe("translatedName", () => {
    it("returns dash for falsy or empty values", () => {
      expect(translatedName(null, "en")).toBe("—")
      expect(translatedName(undefined, "en")).toBe("—")
      expect(translatedName("", "en")).toBe("—")
    })

    it("returns a plain string as is", () => {
      expect(translatedName("Plain Name", "en")).toBe("Plain Name")
    })

    it("prefers the active locale when available", () => {
      const obj = { en: "English Name", ar: "الاسم بالعربية" }
      expect(translatedName(obj, "ar")).toBe("الاسم بالعربية")
      expect(translatedName(obj, "en")).toBe("English Name")
    })

    it("falls back to en or ar if requested locale is missing", () => {
      expect(translatedName({ en: "Fallback EN" }, "fr")).toBe("Fallback EN")
      expect(translatedName({ ar: "بديل عربي" }, "fr")).toBe("بديل عربي")
    })

    it("returns dash if object has no valid en/ar strings", () => {
      expect(translatedName({}, "en")).toBe("—")
      expect(translatedName({ de: "German" }, "fr")).toBe("—")
    })
  })

  describe("formatCount", () => {
    it("formats counts with grouping for locale", () => {
      expect(formatCount(1234567, "en")).toBe("1,234,567")
    })
  })

  describe("formatCompactCents", () => {
    // Inputs are integer cents; the thresholds below are still major units.
    it("formats amounts below 1000 without decimals", () => {
      expect(formatCompactCents(50_000, "en")).toBe("500")
      expect(formatCompactCents(-50_000, "en")).toBe("-500")
    })

    it("formats amounts >= 1000 with compact notation", () => {
      expect(formatCompactCents(1_234_567, "en")).toMatch(/12(\.3)?K/)
      expect(formatCompactCents(100_000_000, "en")).toMatch(/1M/)
    })

    // The whole point of the rename: a cent count must not be read as a major
    // amount. 1234567 cents is 12.3K, not 1.2M.
    it("scales cents before the compact threshold is applied", () => {
      expect(formatCompactCents(99_900, "en")).toBe("999")
      expect(formatCompactCents(100_000, "en")).toMatch(/1K/)
    })
  })

  describe("selectableYears", () => {
    it("returns current year and three preceding years", () => {
      expect(selectableYears(2026)).toEqual([2026, 2025, 2024, 2023])
    })
  })

  describe("monthLabels", () => {
    it("returns 12 localized month names", () => {
      const enMonths = monthLabels("en")
      expect(enMonths).toHaveLength(12)
      expect(enMonths[0]).toBe("Jan")
      expect(enMonths[11]).toBe("Dec")
    })
  })

  describe("isoDaysAgo", () => {
    it("returns an ISO date string roughly N days ago", () => {
      const now = new Date("2026-09-08T12:00:00Z").getTime()
      vi.spyOn(Date, "now").mockReturnValue(now)

      const result = isoDaysAgo(7)
      expect(result).toBe("2026-09-01T12:00:00.000Z")

      vi.restoreAllMocks()
    })
  })
})
