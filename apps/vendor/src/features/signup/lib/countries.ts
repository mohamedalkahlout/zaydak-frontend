/**
 * Dial codes for the phone field's country picker.
 *
 * A deliberately short, hand-kept list rather than a full ISO dump: this is a
 * signup form for a regional marketplace, and 200 entries in a dropdown is a
 * worse answer than the fifteen markets that actually sign up. `flag` is the
 * regional-indicator pair, so no image asset is involved.
 */
export interface SignupCountry {
  /** ISO 3166-1 alpha-2, also the value stored on the shop address. */
  code: string
  /** Dial code without the `+`. */
  dial: string
  flag: string
}

export const SIGNUP_COUNTRIES: readonly SignupCountry[] = [
  { code: "SA", dial: "966", flag: "🇸🇦" },
  { code: "AE", dial: "971", flag: "🇦🇪" },
  { code: "KW", dial: "965", flag: "🇰🇼" },
  { code: "QA", dial: "974", flag: "🇶🇦" },
  { code: "BH", dial: "973", flag: "🇧🇭" },
  { code: "OM", dial: "968", flag: "🇴🇲" },
  { code: "JO", dial: "962", flag: "🇯🇴" },
  { code: "PS", dial: "970", flag: "🇵🇸" },
  { code: "EG", dial: "20", flag: "🇪🇬" },
  { code: "IQ", dial: "964", flag: "🇮🇶" },
  { code: "LB", dial: "961", flag: "🇱🇧" },
  { code: "MA", dial: "212", flag: "🇲🇦" },
  { code: "DZ", dial: "213", flag: "🇩🇿" },
  { code: "TN", dial: "216", flag: "🇹🇳" },
  { code: "TR", dial: "90", flag: "🇹🇷" },
  { code: "GB", dial: "44", flag: "🇬🇧" },
  { code: "US", dial: "1", flag: "🇺🇸" },
]

export const DEFAULT_SIGNUP_COUNTRY = SIGNUP_COUNTRIES[0]!

export function findCountryByCode(code: string): SignupCountry {
  return SIGNUP_COUNTRIES.find((c) => c.code === code) ?? DEFAULT_SIGNUP_COUNTRY
}
