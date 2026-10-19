import { countryByCode, geoLabel } from "@/shared/geo"
import { regionName } from "@/shared/lib/country-name"

export interface Country {
  code: string
  flag: string
}

/**
 * ISO-3166-1 alpha-2 codes only. A country's name is not data here: it comes
 * from `Intl.DisplayNames` in the active locale (see `countryLabel`), so the
 * Arabic dashboard reads «تركيا» where a hand-kept English list could only
 * ever read "Türkiye".
 *
 * MENA/GCC pinned first, in this order (primary market for this storefront).
 */
const PINNED_CODES = [
  "SA", "AE", "EG", "KW", "QA", "BH", "OM", "JO", "LB", "IQ",
  "YE", "MA", "TN", "DZ", "LY", "SD", "PS", "SY", "TR",
]

/** Everything else; ordered by its name in the active locale (`countriesFor`). */
const REST_CODES = [
  "AF", "AL", "AD", "AO", "AR", "AM", "AU", "AT", "AZ", "BS",
  "BD", "BB", "BY", "BE", "BZ", "BJ", "BT", "BO", "BA", "BW",
  "BR", "BN", "BG", "BF", "BI", "KH", "CM", "CA", "CV", "CF",
  "TD", "CL", "CN", "CO", "KM", "CG", "CD", "CR", "CI", "HR",
  "CU", "CY", "CZ", "DK", "DJ", "DO", "EC", "SV", "GQ", "ER",
  "EE", "SZ", "ET", "FJ", "FI", "FR", "GA", "GM", "GE", "DE",
  "GH", "GR", "GT", "GN", "GW", "GY", "HT", "HN", "HU", "IS",
  "IN", "ID", "IR", "IE", "IL", "IT", "JM", "JP", "KZ", "KE",
  "KI", "KG", "LA", "LV", "LS", "LR", "LI", "LT", "LU", "MG",
  "MW", "MY", "MV", "ML", "MT", "MR", "MU", "MX", "MD", "MC",
  "MN", "ME", "MZ", "MM", "NA", "NP", "NL", "NZ", "NI", "NE",
  "NG", "KP", "MK", "NO", "PK", "PA", "PG", "PY", "PE", "PH",
  "PL", "PT", "RO", "RU", "RW", "WS", "SM", "ST", "SN", "RS",
  "SC", "SL", "SG", "SK", "SI", "SB", "SO", "ZA", "KR", "SS",
  "ES", "LK", "SR", "SE", "CH", "TW", "TJ", "TZ", "TH", "TL",
  "TG", "TO", "TT", "TM", "UG", "UA", "GB", "US", "UY", "UZ",
  "VU", "VA", "VE", "VN", "ZM", "ZW",
]

/** Flags are the Unicode regional indicator pair derived from the code. */
function flagFor(code: string): string {
  const A = 0x1f1e6
  const a = "A".charCodeAt(0)
  if (code.length !== 2) return ""
  return String.fromCodePoint(
    A + (code.charCodeAt(0) - a),
    A + (code.charCodeAt(1) - a),
  )
}

const toCountry = (code: string): Country => ({ code, flag: flagFor(code) })

const PINNED: Country[] = PINNED_CODES.map(toCountry)
const REST: Country[] = REST_CODES.map(toCountry)

/**
 * The country's name in `locale`, from `Intl.DisplayNames`. Falls back to the
 * bundled bilingual table (`@/shared/geo`) for a runtime without the API, and
 * to the code itself for a value neither knows.
 */
export function countryLabel(code: string, locale = "en"): string {
  const normalized = code.trim().toUpperCase()
  const name = regionName(normalized, locale)
  if (name) return name
  const geo = countryByCode(normalized)
  if (geo) return geoLabel(geo, locale)
  return code
}

const ORDERED = new Map<string, Country[]>()

/**
 * Every pickable country for `locale`: the pinned MENA/GCC block first, then
 * the rest alphabetically by their name in that locale — the order a person
 * scanning the Arabic list expects, which an English sort would not give.
 */
export function countriesFor(locale: string): Country[] {
  let ordered = ORDERED.get(locale)
  if (!ordered) {
    let compare: (a: string, b: string) => number
    try {
      compare = new Intl.Collator(locale).compare
    } catch {
      compare = (a, b) => a.localeCompare(b)
    }
    const rest = [...REST].sort((a, b) =>
      compare(countryLabel(a.code, locale), countryLabel(b.code, locale)),
    )
    ordered = [...PINNED, ...rest]
    ORDERED.set(locale, ordered)
  }
  return ordered
}
