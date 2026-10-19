/**
 * Currency presets, metadata and conversion rates for the storefront.
 *
 * Provides client-side dynamic display currency conversion for international
 * shoppers while the base store currency remains authoritative for checkouts.
 */

/**
 * Master switch for shopper-facing currency selection.
 *
 * The platform trades in **SAR only** for now, so the storefront shows one
 * currency and offers no way to change it: `CurrencySwitcher` renders nothing
 * and `CurrencyProvider` pins the display currency to the shop's base, ignoring
 * any preference a visitor parked in `localStorage` before this was switched
 * off. Everything below — the presets, the reference rates, the converter — is
 * deliberately kept, because expanding to other markets is a matter of flipping
 * this to `true` (and replacing the fixed rates with live ones), not of
 * rebuilding the engine.
 */
export const MULTI_CURRENCY_ENABLED: boolean = false

export interface CurrencyPreset {
  code: string
  symbol: string
  symbolAr: string
  flag: string
  nameEn: string
  nameAr: string
  decimals: number
}

/**
 * Standard commerce currency presets for GCC, Middle East and global trade.
 */
export const SUPPORTED_CURRENCIES: readonly CurrencyPreset[] = [
  {
    code: "SAR",
    symbol: "SAR",
    symbolAr: "ر.س",
    flag: "🇸🇦",
    nameEn: "Saudi Riyal",
    nameAr: "ريال سعودي",
    decimals: 2,
  },
  {
    code: "USD",
    symbol: "$",
    symbolAr: "$",
    flag: "🇺🇸",
    nameEn: "US Dollar",
    nameAr: "دولار أمريكي",
    decimals: 2,
  },
  {
    code: "EUR",
    symbol: "€",
    symbolAr: "€",
    flag: "🇪🇺",
    nameEn: "Euro",
    nameAr: "يورو",
    decimals: 2,
  },
  {
    code: "AED",
    symbol: "AED",
    symbolAr: "د.إ",
    flag: "🇦🇪",
    nameEn: "UAE Dirham",
    nameAr: "درهم إماراتي",
    decimals: 2,
  },
  {
    code: "KWD",
    symbol: "KWD",
    symbolAr: "د.ك",
    flag: "🇰🇼",
    nameEn: "Kuwaiti Dinar",
    nameAr: "دينار كويتي",
    decimals: 3,
  },
  {
    code: "BHD",
    symbol: "BHD",
    symbolAr: ".د.ب",
    flag: "🇧🇭",
    nameEn: "Bahraini Dinar",
    nameAr: "دينار بحريني",
    decimals: 3,
  },
  {
    code: "QAR",
    symbol: "QAR",
    symbolAr: "ر.ق",
    flag: "🇶🇦",
    nameEn: "Qatari Riyal",
    nameAr: "ريال قطري",
    decimals: 2,
  },
  {
    code: "OMR",
    symbol: "OMR",
    symbolAr: "ر.ع",
    flag: "🇴🇲",
    nameEn: "Omani Rial",
    nameAr: "ريال عماني",
    decimals: 3,
  },
  {
    code: "GBP",
    symbol: "£",
    symbolAr: "£",
    flag: "🇬🇧",
    nameEn: "British Pound",
    nameAr: "جنيه إسترليني",
    decimals: 2,
  },
  {
    code: "EGP",
    symbol: "EGP",
    symbolAr: "ج.م",
    flag: "🇪🇬",
    nameEn: "Egyptian Pound",
    nameAr: "جنيه مصري",
    decimals: 2,
  },
] as const

export const SUPPORTED_CURRENCY_CODES = new Set(
  SUPPORTED_CURRENCIES.map((c) => c.code),
)

/**
 * Standard pegged / reference conversion multipliers relative to 1 SAR.
 * 1 SAR = X Target Units.
 */
export const RATES_PER_SAR: Record<string, number> = {
  SAR: 1.0,
  USD: 1 / 3.75, // ~0.266667
  EUR: 1 / 4.1, // ~0.243902
  AED: 1 / 1.021, // ~0.979432
  KWD: 1 / 12.25, // ~0.081633
  BHD: 1 / 9.95, // ~0.100503
  QAR: 1 / 1.03, // ~0.970874
  OMR: 1 / 9.75, // ~0.102564
  GBP: 1 / 4.85, // ~0.206186
  EGP: 1 / 0.077, // ~12.987013
}

/**
 * Converts money in integer cents from one currency to another using the SAR reference anchor.
 * Returns integer cents rounded to the nearest integer.
 */
export function convertCurrencyCents(
  cents: number,
  fromCurrency: string | null | undefined,
  toCurrency: string | null | undefined,
): number {
  if (!cents || cents <= 0) return 0
  const from = (fromCurrency || "SAR").toUpperCase()
  const to = (toCurrency || "SAR").toUpperCase()

  if (from === to) return cents

  const fromRate = RATES_PER_SAR[from]
  const toRate = RATES_PER_SAR[to]

  // If either rate is unsupported, fall back safely without distortion
  if (typeof fromRate !== "number" || typeof toRate !== "number" || fromRate <= 0) {
    return cents
  }

  // Convert `from` cents to SAR cents, then to `to` cents
  const sarCents = cents / fromRate
  const targetCents = sarCents * toRate

  return Math.round(targetCents)
}

/**
 * Resolves a currency preset definition by ISO-4217 code.
 */
export function getCurrencyPreset(code: string | null | undefined): CurrencyPreset {
  const normalized = (code || "SAR").toUpperCase()
  const match = SUPPORTED_CURRENCIES.find((c) => c.code === normalized)
  if (match) return match

  return {
    code: normalized,
    symbol: normalized,
    symbolAr: normalized,
    flag: "🌐",
    nameEn: normalized,
    nameAr: normalized,
    decimals: 2,
  }
}
