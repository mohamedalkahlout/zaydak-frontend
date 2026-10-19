import { describe, expect, it } from "vitest"

import { toCents, bpsOf, hasAtMostTwoDecimals, formatAmountCents, formatDate, formatPercent, shortId } from "../format"

describe("formatAmountCents", () => {
  it("scales integer cents to a two-decimal major amount", () => {
    // 123450 cents → 1,234.50. The scaling lives here so no component divides
    // by 100 inline, which is where a rounding bug slips in.
    expect(formatAmountCents(123450, "en")).toBe("1,234.50")
    expect(formatAmountCents(0, "en")).toBe("0.00")
  })

  it("carries no currency symbol — the API sends no currency", () => {
    expect(formatAmountCents(1000, "en")).not.toMatch(/[$£€]|SAR/)
  })
})

describe("formatPercent", () => {
  it("drops trailing zeros but keeps real decimals", () => {
    expect(formatPercent(2.5, "en")).toBe("2.5")
    expect(formatPercent(3, "en")).toBe("3")
    expect(formatPercent(2.55, "en")).toBe("2.55")
  })
})

describe("formatDate", () => {
  it("renders an ISO timestamp", () => {
    expect(formatDate("2026-07-10T12:00:00.000Z", "en")).toContain("2026")
  })

  it("returns an em dash for missing or unparseable input", () => {
    expect(formatDate(null, "en")).toBe("—")
    expect(formatDate(undefined, "en")).toBe("—")
    expect(formatDate("", "en")).toBe("—")
    expect(formatDate("not-a-date", "en")).toBe("—")
  })
})

describe("shortId", () => {
  it("truncates a UUID to its first 8 characters", () => {
    expect(shortId("0f8fad5b-d9cb-469f-a165-70867728950e")).toBe("0f8fad5b…")
  })

  it("leaves an already-short id alone", () => {
    expect(shortId("abc")).toBe("abc")
    expect(shortId("12345678")).toBe("12345678")
  })
})

describe('the write half of the money boundary', () => {
  it('rounds the way the server does, epsilon and all', () => {
    // `1.005 * 100` is `100.49999999999999` in binary floating point, so a bare
    // `Math.round` gives 100 while the back-end's `toCents` — which nudges by
    // ROUNDING_EPSILON first — gives 101. Two answers to one money question.
    expect(toCents(1.005)).toBe(101)
    expect(Math.round(1.005 * 100)).toBe(100)
  })

  it('keeps the ordinary cases exact', () => {
    expect(toCents(2.55)).toBe(255)
    expect(toCents(0)).toBe(0)
    expect(toCents(129)).toBe(12900)
  })

  it('rounds a negative away from zero, like the server', () => {
    expect(toCents(-1.005)).toBe(-101)
  })

  it('answers 0 for a value that is not a number', () => {
    expect(toCents(Number.NaN)).toBe(0)
    expect(toCents(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('converts a percent to basis points on the same rule', () => {
    expect(bpsOf(2.5)).toBe(250)
    expect(bpsOf(1.005)).toBe(101)
  })

  it('rejects a third decimal place before any of that runs', () => {
    // Which is why the epsilon case above is unreachable through a form — the
    // guard is the first thing every money field applies.
    expect(hasAtMostTwoDecimals(1.005)).toBe(false)
    expect(hasAtMostTwoDecimals(2.55)).toBe(true)
  })
})
