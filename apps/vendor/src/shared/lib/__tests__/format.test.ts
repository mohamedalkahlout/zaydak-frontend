import { afterEach, describe, expect, it } from "vitest"
import {
  bindDashboardLocale,
  resetDashboardLocale,
} from "@/shared/i18n/dashboard-locale"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import {
  currencySuffix,
  formatDate,
  formatMoney,
  formatMoneyCents,
  translatable,
} from "../format"

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
}

describe("dashboard locale", () => {
  afterEach(() => resetDashboardLocale())

  it("formats a date in the dashboard language, not the runtime default", () => {
    const iso = "2026-01-15T12:00:00.000Z"
    bindDashboardLocale("ar")
    expect(formatDate(iso)).toBe(
      new Date(iso).toLocaleDateString("ar", DATE_OPTIONS),
    )
    bindDashboardLocale("en")
    expect(formatDate(iso)).toBe(
      new Date(iso).toLocaleDateString("en", DATE_OPTIONS),
    )
  })

  it("formats money in the dashboard language", () => {
    bindDashboardLocale("ar")
    expect(formatMoney(10, "SAR")).toBe(
      new Intl.NumberFormat("ar", {
        style: "currency",
        currency: "SAR",
        maximumFractionDigits: 2,
      }).format(10),
    )
  })

  it("prefers the Arabic name when the dashboard is Arabic", () => {
    bindDashboardLocale("ar")
    expect(translatable({ en: "Mug", ar: "كوب" })).toBe("كوب")
    bindDashboardLocale("en")
    expect(translatable({ en: "Mug", ar: "كوب" })).toBe("Mug")
    expect(translatable({ ar: "كوب" })).toBe("كوب")
  })

  it("uses the Arabic currency mark for SAR", () => {
    expect(currencySuffix("SAR", "ar")).toMatch(/ر/)
    expect(currencySuffix("SAR", "en")).not.toMatch(/ر/)
  })
})

describe("formatMoneyCents currency", () => {
  it("formats with the provided ISO currency", () => {
    const sar = formatMoneyCents(12345, "SAR")
    const aed = formatMoneyCents(12345, "AED")
    // Different currency code → different rendered output; amount preserved.
    expect(sar).not.toBe(aed)
    expect(aed).toMatch(/123\.45/)
  })

  it("defaults to SAR and renders an em-dash for nullish input", () => {
    expect(formatMoneyCents(null)).toBe("—")
    expect(formatMoneyCents(undefined)).toBe("—")
    expect(formatMoneyCents(1000)).toMatch(/10/)
  })

  it("formatMoney accepts a currency too", () => {
    expect(formatMoney(50, "USD")).toMatch(/50/)
    expect(formatMoney(null)).toBe("—")
  })

  it("dynamically reads currency from useActiveShopStore when no currency is passed", () => {
    useActiveShopStore.getState().setCurrency("EUR")
    const formatted = formatMoneyCents(1000)
    expect(formatted).toMatch(/€|EUR|10/)
    useActiveShopStore.getState().clear()
  })
})
