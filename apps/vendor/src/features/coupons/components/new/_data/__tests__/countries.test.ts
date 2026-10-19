import { describe, expect, it } from "vitest"
import { countriesFor, countryLabel } from "../countries"

/**
 * The picker's country list carries codes only; every name comes from
 * `Intl.DisplayNames` in the active locale. Shipping zones read the same
 * `countryLabel`, so this is what both screens show.
 */
describe("countryLabel", () => {
  it("names a country in the active locale", () => {
    expect(countryLabel("SA", "en")).toBe("Saudi Arabia")
    expect(countryLabel("SA", "ar")).toBe("المملكة العربية السعودية")
    // The bundled table's Arabic for TR is the bird; the platform's is right.
    expect(countryLabel("TR", "ar")).toBe("تركيا")
  })

  it("tolerates casing and whitespace, and falls back to the code it was given", () => {
    expect(countryLabel(" ae ", "en")).toBe("United Arab Emirates")
    expect(countryLabel("not-a-code", "en")).toBe("not-a-code")
  })
})

describe("countriesFor", () => {
  it("pins the MENA/GCC block first, in its fixed order", () => {
    const codes = countriesFor("en").map((c) => c.code)
    expect(codes.slice(0, 3)).toEqual(["SA", "AE", "EG"])
    expect(codes).toHaveLength(new Set(codes).size)
  })

  it("orders the rest by name in the active locale", () => {
    const pinned = 19
    const rest = countriesFor("ar").slice(pinned)
    const names = rest.map((c) => countryLabel(c.code, "ar"))
    const sorted = [...names].sort(new Intl.Collator("ar").compare)
    expect(names).toEqual(sorted)
  })

  it("derives each flag from its code", () => {
    const sa = countriesFor("en").find((c) => c.code === "SA")
    expect(sa?.flag).toBe("🇸🇦")
  })
})
