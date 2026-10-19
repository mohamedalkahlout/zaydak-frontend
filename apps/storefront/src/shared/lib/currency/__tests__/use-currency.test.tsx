import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import type { ReactNode } from "react"
import { CurrencyProvider, useCurrency } from "../use-currency"
import { MULTI_CURRENCY_ENABLED } from "../currency-presets"

const wrapper = ({ children }: { children: ReactNode }) => (
  <CurrencyProvider baseCurrency="SAR">{children}</CurrencyProvider>
)

describe("useCurrency", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("defaults display currency to base currency", () => {
    const { result } = renderHook(() => useCurrency(), { wrapper })

    expect(result.current.baseCurrency).toBe("SAR")
    expect(result.current.displayCurrency).toBe("SAR")
    expect(result.current.isConverted).toBe(false)
  })

  it("formats base-currency prices untouched", () => {
    const { result } = renderHook(() => useCurrency(), { wrapper })

    expect(result.current.convertPrice(37500)).toBe(37500)
    expect(result.current.formatDisplayPrice(37500, "en-US")).toContain("375")
  })
})

/**
 * The shipped state. A currency parked in storage before the switcher was
 * hidden must not outlive it: there is no control left on the page to undo it
 * with, so a returning visitor would be stuck browsing in dollars.
 */
describe.runIf(!MULTI_CURRENCY_ENABLED)("useCurrency (single currency)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("ignores a display currency persisted by an earlier visit", () => {
    localStorage.setItem("zaydak_display_currency", "USD")

    const { result } = renderHook(() => useCurrency(), { wrapper })

    expect(result.current.displayCurrency).toBe("SAR")
    expect(result.current.isConverted).toBe(false)
  })

  it("refuses to switch away from the shop's base currency", () => {
    const { result } = renderHook(() => useCurrency(), { wrapper })

    act(() => {
      result.current.setDisplayCurrency("USD")
    })

    expect(result.current.displayCurrency).toBe("SAR")
    expect(result.current.isConverted).toBe(false)
    expect(localStorage.getItem("zaydak_display_currency")).toBeNull()
  })

  it("offers the shop's base currency alone", () => {
    const { result } = renderHook(() => useCurrency(), { wrapper })

    expect(result.current.supportedCurrencies.map((c) => c.code)).toEqual(["SAR"])
  })
})

/**
 * Kept, not deleted: the conversion engine is intact and these cover it again
 * the moment `MULTI_CURRENCY_ENABLED` flips.
 */
describe.skipIf(!MULTI_CURRENCY_ENABLED)("useCurrency (multi currency)", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("updates display currency and persists to localStorage", () => {
    const { result } = renderHook(() => useCurrency(), { wrapper })

    act(() => {
      result.current.setDisplayCurrency("USD")
    })

    expect(result.current.displayCurrency).toBe("USD")
    expect(result.current.isConverted).toBe(true)
    expect(localStorage.getItem("zaydak_display_currency")).toBe("USD")
  })

  it("formats display price with conversion", () => {
    const { result } = renderHook(() => useCurrency(), { wrapper })

    act(() => {
      result.current.setDisplayCurrency("USD")
    })

    // 375 SAR cents (37500) = 100 USD (10000 cents) -> $100
    const formatted = result.current.formatDisplayPrice(37500, "en-US")
    expect(formatted).toBe("$100")
  })

  it("resets to base currency", () => {
    const { result } = renderHook(() => useCurrency(), { wrapper })

    act(() => {
      result.current.setDisplayCurrency("EUR")
    })
    expect(result.current.isConverted).toBe(true)

    act(() => {
      result.current.resetToBaseCurrency()
    })
    expect(result.current.displayCurrency).toBe("SAR")
    expect(result.current.isConverted).toBe(false)
    expect(localStorage.getItem("zaydak_display_currency")).toBeNull()
  })
})
