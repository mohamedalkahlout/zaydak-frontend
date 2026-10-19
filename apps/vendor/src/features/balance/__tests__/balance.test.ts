import { describe, it, expect } from "vitest"
import {
  bpsToPercent,
  centsToMajor,
  formatMoneyCents,
  majorToCents,
} from "@/shared/lib/format"

describe("Balance & Payout Helpers", () => {
  it("converts basis points to readable percentage", () => {
    expect(bpsToPercent(0)).toBe(0)
    expect(bpsToPercent(250)).toBe(2.5)
    expect(bpsToPercent(1500)).toBe(15)
    expect(bpsToPercent(10000)).toBe(100)
    expect(bpsToPercent(null)).toBe(0)
    expect(bpsToPercent(undefined)).toBe(0)
  })

  it("converts major currency units to integer cents", () => {
    expect(majorToCents(0)).toBe(0)
    expect(majorToCents(10)).toBe(1000)
    expect(majorToCents(99.95)).toBe(9995)
    expect(majorToCents(1234.56)).toBe(123456)
  })

  it("converts integer cents to major currency units", () => {
    expect(centsToMajor(0)).toBe(0)
    expect(centsToMajor(1000)).toBe(10)
    expect(centsToMajor(9995)).toBe(99.95)
  })

  it("formats integer cents into localized currency strings", () => {
    const formattedSAR = formatMoneyCents(50000, "SAR")
    expect(formattedSAR).toContain("500")

    const formattedZero = formatMoneyCents(0, "SAR")
    expect(formattedZero).toContain("0")

    expect(formatMoneyCents(null)).toBe("—")
    expect(formatMoneyCents(undefined)).toBe("—")
  })

  it("validates payout request amounts against available balance headroom", () => {
    const availableCents = 100000 // 1,000 SAR

    // Valid requests
    expect(majorToCents(100) <= availableCents && majorToCents(100) > 0).toBe(true)
    expect(majorToCents(1000) <= availableCents && majorToCents(1000) > 0).toBe(true)

    // Over-draw request
    expect(majorToCents(1000.01) <= availableCents).toBe(false)
    expect(majorToCents(5000) <= availableCents).toBe(false)

    // Invalid non-positive requests
    expect(majorToCents(0) > 0).toBe(false)
    expect(majorToCents(-50) > 0).toBe(false)
  })
})
