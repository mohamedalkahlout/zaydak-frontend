"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { formatMoney } from "@/shared/lib/format"
import {
  convertCurrencyCents,
  getCurrencyPreset,
  MULTI_CURRENCY_ENABLED,
  SUPPORTED_CURRENCIES,
  SUPPORTED_CURRENCY_CODES,
  type CurrencyPreset,
} from "./currency-presets"

const STORAGE_KEY = "zaydak_display_currency"

export interface CurrencyContextValue {
  /** The currency code currently selected for price display. */
  displayCurrency: string
  /** The shop's authoritative base currency used at checkout. */
  baseCurrency: string
  /** Updates the display currency preference. */
  setDisplayCurrency: (code: string) => void
  /** Resets display currency back to the shop's base currency. */
  resetToBaseCurrency: () => void
  /** True when the display currency differs from the shop base currency. */
  isConverted: boolean
  /** Active preset for the display currency (symbol, flag, etc). */
  preset: CurrencyPreset
  /** All available presets. */
  supportedCurrencies: readonly CurrencyPreset[]
  /**
   * Formats an amount in base-currency cents into the display currency.
   */
  formatDisplayPrice: (
    baseCents: number,
    locale: string,
    options?: { narrow?: boolean },
  ) => string
  /**
   * Converts base cents to display currency cents.
   */
  convertPrice: (baseCents: number) => number
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({
  baseCurrency = "SAR",
  children,
}: {
  baseCurrency?: string | null
  children: ReactNode
}) {
  const normalizedBase = (baseCurrency || "SAR").toUpperCase()
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null)

  // Hydrate user preference from localStorage after initial render to avoid SSR mismatch
  useEffect(() => {
    // Single-currency mode: a preference parked before the switcher was hidden
    // must not outlive it, or a returning visitor browses in a currency with no
    // control left on the page to leave.
    if (!MULTI_CURRENCY_ENABLED) return

    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && SUPPORTED_CURRENCY_CODES.has(stored.toUpperCase())) {
        /* eslint-disable-next-line react-hooks/set-state-in-effect --
         * Restoring persisted state after hydration is the one case an effect
         * is still the answer for. A `useState` initializer cannot do it: this
         * provider wraps server-rendered pages and localStorage does not exist
         * there, so reading it in the initializer produces markup the server
         * could never have sent — every price on the page formatted in the
         * visitor's saved currency — and React throws out the whole tree on a
         * hydration mismatch. Nor is it a `useSyncExternalStore` — this
         * provider OWNS the value and writes it back (`setDisplayCurrency` /
         * `resetToBaseCurrency`); storage is where the preference is parked
         * between visits, not a store it observes.
         */
        setSelectedCurrency(stored.toUpperCase())
      }
    } catch {
      // Ignore localStorage access errors (e.g. incognito / restricted storage)
    }
  }, [])

  const displayCurrency = selectedCurrency || normalizedBase
  const isConverted = displayCurrency !== normalizedBase

  const setDisplayCurrency = useCallback((code: string) => {
    if (!MULTI_CURRENCY_ENABLED) return

    const normalized = code.toUpperCase()
    setSelectedCurrency(normalized)
    try {
      localStorage.setItem(STORAGE_KEY, normalized)
    } catch {
      // Ignore
    }
  }, [])

  const resetToBaseCurrency = useCallback(() => {
    setSelectedCurrency(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore
    }
  }, [])

  const preset = useMemo(
    () => getCurrencyPreset(displayCurrency),
    [displayCurrency],
  )

  const supportedCurrencies = useMemo(
    () =>
      MULTI_CURRENCY_ENABLED
        ? SUPPORTED_CURRENCIES
        : [getCurrencyPreset(normalizedBase)],
    [normalizedBase],
  )

  const convertPrice = useCallback(
    (baseCents: number) => {
      return convertCurrencyCents(baseCents, normalizedBase, displayCurrency)
    },
    [normalizedBase, displayCurrency],
  )

  const formatDisplayPrice = useCallback(
    (baseCents: number, locale: string, options?: { narrow?: boolean }) => {
      const convertedCents = convertCurrencyCents(
        baseCents,
        normalizedBase,
        displayCurrency,
      )
      return formatMoney(convertedCents, displayCurrency, locale, options)
    },
    [normalizedBase, displayCurrency],
  )

  const value: CurrencyContextValue = useMemo(
    () => ({
      displayCurrency,
      baseCurrency: normalizedBase,
      setDisplayCurrency,
      resetToBaseCurrency,
      isConverted,
      preset,
      supportedCurrencies,
      formatDisplayPrice,
      convertPrice,
    }),
    [
      displayCurrency,
      normalizedBase,
      setDisplayCurrency,
      resetToBaseCurrency,
      isConverted,
      preset,
      supportedCurrencies,
      formatDisplayPrice,
      convertPrice,
    ],
  )

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

/**
 * Accesses the active display currency and converter.
 * Falls back gracefully if rendered outside CurrencyProvider.
 */
export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext)
  if (context) return context

  const fallbackBase = "SAR"
  return {
    displayCurrency: fallbackBase,
    baseCurrency: fallbackBase,
    setDisplayCurrency: () => {},
    resetToBaseCurrency: () => {},
    isConverted: false,
    preset: getCurrencyPreset(fallbackBase),
    supportedCurrencies: MULTI_CURRENCY_ENABLED
      ? SUPPORTED_CURRENCIES
      : [getCurrencyPreset(fallbackBase)],
    formatDisplayPrice: (cents: number, locale: string, options?: { narrow?: boolean }) =>
      formatMoney(cents, fallbackBase, locale, options),
    convertPrice: (cents: number) => cents,
  }
}
