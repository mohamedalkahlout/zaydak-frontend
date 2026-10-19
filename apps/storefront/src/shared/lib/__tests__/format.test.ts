import { describe, expect, it } from "vitest"

import { discountPercent, formatCount, formatDate, formatMoney } from "../format"

describe("formatMoney", () => {
  it("scales integer cents to major units", () => {
    // The only place in the app that divides by 100.
    expect(formatMoney(12345, "USD", "en-US")).toBe("$123.45")
  })

  it("drops the decimals on a whole amount", () => {
    // `$120.00` on every tile makes a grid noisier without saying anything.
    expect(formatMoney(12000, "USD", "en-US")).toBe("$120")
  })

  it("keeps both decimals on a fractional amount", () => {
    expect(formatMoney(12050, "USD", "en-US")).toBe("$120.50")
  })

  it("renders zero", () => {
    expect(formatMoney(0, "USD", "en-US")).toBe("$0")
  })

  it("falls back to a configured currency rather than throwing", () => {
    // `Intl.NumberFormat` throws on an empty currency code, which would take a
    // whole product grid down over one missing field.
    expect(() => formatMoney(1000, null, "en-US")).not.toThrow()
    expect(() => formatMoney(1000, "", "en-US")).not.toThrow()
  })

  it("honours the shop's currency, not a hard-coded one", () => {
    expect(formatMoney(10000, "EUR", "de-DE")).toContain("€")
  })
})

describe("discountPercent", () => {
  it("computes a straightforward markdown", () => {
    expect(discountPercent(10000, 7500)).toBe(25)
  })

  it("rounds down", () => {
    // 49.6% advertised as 50% is the kind of rounding a customer notices.
    expect(discountPercent(10000, 5040)).toBe(49)
  })

  it("returns null when there is no markdown", () => {
    expect(discountPercent(10000, 10000)).toBeNull()
    expect(discountPercent(7500, 10000)).toBeNull()
  })

  it("returns null rather than a -0% badge on a trivial difference", () => {
    expect(discountPercent(10000, 9999)).toBeNull()
  })

  it("returns null on missing inputs", () => {
    expect(discountPercent(null, 5000)).toBeNull()
    expect(discountPercent(10000, null)).toBeNull()
    expect(discountPercent(undefined, undefined)).toBeNull()
  })
})

describe("formatDate", () => {
  it("renders an em dash for a missing or unparseable value", () => {
    expect(formatDate(null, "en-US")).toBe("—")
    expect(formatDate("not-a-date", "en-US")).toBe("—")
  })

  it("formats a real ISO timestamp", () => {
    expect(formatDate("2026-08-19T10:00:00.000Z", "en-US")).toContain("2026")
  })
})

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(1234, "en-US")).toBe("1,234")
  })
})
