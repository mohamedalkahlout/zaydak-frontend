import { describe, expect, it } from "vitest"

import { regionName } from "@/shared/lib/country-name"

describe("regionName", () => {
  it("names a country in the requested language", () => {
    expect(regionName("SA", "en")).toBe("Saudi Arabia")
    expect(regionName("SA", "ar")).toBe("المملكة العربية السعودية")
    expect(regionName("TR", "ar")).toBe("تركيا")
  })

  it("says Palestine, as the country lists always have", () => {
    expect(regionName("PS", "en")).toBe("Palestine")
    expect(regionName("PS", "ar")).toBe("فلسطين")
  })

  it("keeps the long form everywhere else, where the short one abbreviates", () => {
    expect(regionName("US", "en")).toBe("United States")
    expect(regionName("GB", "en")).toBe("United Kingdom")
  })

  it("tolerates casing and returns null for what is not a region code", () => {
    expect(regionName(" ae ", "en")).toBe("United Arab Emirates")
    expect(regionName("Saudi Arabia", "en")).toBeNull()
  })
})
