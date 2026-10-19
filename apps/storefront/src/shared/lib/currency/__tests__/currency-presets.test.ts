import { describe, expect, it } from "vitest"
import {
  convertCurrencyCents,
  getCurrencyPreset,
  RATES_PER_SAR,
  SUPPORTED_CURRENCIES,
} from "../currency-presets"

describe("currency-presets", () => {
  it("includes essential GCC and international currencies", () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code)
    expect(codes).toContain("SAR")
    expect(codes).toContain("USD")
    expect(codes).toContain("EUR")
    expect(codes).toContain("AED")
    expect(codes).toContain("KWD")
  })

  it("returns 0 for zero or negative amounts", () => {
    expect(convertCurrencyCents(0, "SAR", "USD")).toBe(0)
    expect(convertCurrencyCents(-500, "SAR", "USD")).toBe(0)
  })

  it("returns unchanged cents when from and to currencies match", () => {
    expect(convertCurrencyCents(12345, "SAR", "SAR")).toBe(12345)
    expect(convertCurrencyCents(5000, "USD", "USD")).toBe(5000)
    expect(convertCurrencyCents(999, "sar", "SAR")).toBe(999)
  })

  it("converts correctly between SAR and USD", () => {
    // 375 SAR = 100 USD -> 37,500 cents SAR = 10,000 cents USD
    const usdCents = convertCurrencyCents(37500, "SAR", "USD")
    expect(usdCents).toBe(10000)

    const sarCents = convertCurrencyCents(10000, "USD", "SAR")
    expect(sarCents).toBe(37500)
  })

  it("converts correctly across cross-currency pairs (USD to EUR)", () => {
    // 100 USD = 375 SAR. 375 SAR in EUR = 375 / 4.1 = 91.46 EUR (9146 cents)
    const eurCents = convertCurrencyCents(10000, "USD", "EUR")
    expect(eurCents).toBe(9146)
  })

  it("falls back safely when encountering an unsupported currency", () => {
    expect(convertCurrencyCents(1000, "XYZ", "USD")).toBe(1000)
    expect(convertCurrencyCents(1000, "SAR", "ABC")).toBe(1000)
  })

  it("resolves presets and falls back gracefully", () => {
    const sar = getCurrencyPreset("SAR")
    expect(sar.symbol).toBe("SAR")
    expect(sar.symbolAr).toBe("ر.س")

    const fallback = getCurrencyPreset("JPY")
    expect(fallback.code).toBe("JPY")
    expect(fallback.flag).toBe("🌐")
  })
})
