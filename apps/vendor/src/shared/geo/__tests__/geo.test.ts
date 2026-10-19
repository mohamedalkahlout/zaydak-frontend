import { describe, expect, it } from "vitest"
import {
  COUNTRIES,
  SA_REGIONS,
  countryByCode,
  foldSearch,
  geoLabel,
  isValidPostalCode,
  loadSaCities,
  loadSaDistricts,
  resolveCountry,
} from "../data"

describe("the bundled tables", () => {
  it("carries 250 countries and Saudi Arabia's 13 regions", () => {
    expect(COUNTRIES).toHaveLength(250)
    expect(SA_REGIONS).toHaveLength(13)
  })

  it("loads 15,513 Saudi cities lazily", async () => {
    const cities = await loadSaCities()
    expect(cities).toHaveLength(15513)
    const riyadh = cities.find((c) => c.ar === "الرياض")
    expect(riyadh).toBeDefined()
    expect(riyadh?.region).toBe(1)
  })

  it("loads 21,235 Saudi districts lazily", async () => {
    const districts = await loadSaDistricts()
    expect(districts).toHaveLength(21235)
    expect(districts[0]).toHaveProperty("city")
    expect(districts[0]).toHaveProperty("region")
  })

  it("keeps the English names shops have already stored", async () => {
    // The English name is the stored value and the carrier's origin city, so
    // the MOMRAH switch pinned the old spellings instead of taking the
    // dataset's ("Aldammam", "Tbwk", "Makkah Al Mukarramah"). A regeneration
    // that drops the pins fails here rather than orphaning saved addresses.
    expect(SA_REGIONS.map((r) => r.en)).toEqual(
      expect.arrayContaining(["Makkah", "Eastern Province", "Qassim", "Madinah"]),
    )
    const cities = await loadSaCities()
    const en = (ar: string, region: number) =>
      cities.find((c) => c.ar === ar && c.region === region)?.en
    expect(en("الدمام", 5)).toBe("Dammam")
    expect(en("تبوك", 7)).toBe("Tabuk")
    expect(en("الطائف", 2)).toBe("At Taif")
    expect(en("مكة المكرمة", 2)).toBe("Makkah")
  })

  it("has an Arabic name for every country", () => {
    // The whole reason this dataset was chosen over the other free ones.
    expect(COUNTRIES.every((c) => c.ar.trim().length > 0)).toBe(true)
  })
})

describe("resolveCountry", () => {
  it("resolves an ISO2 code, case-insensitively", () => {
    expect(resolveCountry("sa")?.en).toBe("Saudi Arabia")
    expect(countryByCode("SA")?.currency).toBe("SAR")
  })

  it("resolves a display name, so rows written before the picker still light up", () => {
    expect(resolveCountry("Saudi Arabia")?.code).toBe("SA")
    expect(resolveCountry("المملكة العربية السعودية")?.code).toBe("SA")
  })

  it("returns undefined for nothing and for nonsense", () => {
    expect(resolveCountry("")).toBeUndefined()
    expect(resolveCountry(null)).toBeUndefined()
    expect(resolveCountry("Atlantis")).toBeUndefined()
  })
})

describe("isValidPostalCode", () => {
  it("accepts a Saudi five-digit code and flags anything else", () => {
    expect(isValidPostalCode("SA", "12345")).toBe(true)
    expect(isValidPostalCode("SA", "1234")).toBe(false)
    expect(isValidPostalCode("SA", "ABCDE")).toBe(false)
  })

  it("treats an empty code as fine — the field is optional", () => {
    expect(isValidPostalCode("SA", "")).toBe(true)
    expect(isValidPostalCode("SA", "   ")).toBe(true)
  })

  it("passes anything for a country the table has no pattern for", () => {
    // 61 of 250 have none. Refusing an address because our table is thin
    // would be worse than a wrong postal code.
    const noPattern = COUNTRIES.find((c) => !c.postal)
    expect(noPattern).toBeDefined()
    expect(isValidPostalCode(noPattern!.code, "whatever")).toBe(true)
  })

  it("passes when the country itself is unknown or unset", () => {
    expect(isValidPostalCode("", "12345")).toBe(true)
    expect(isValidPostalCode("Atlantis", "12345")).toBe(true)
  })
})

describe("foldSearch", () => {
  it("folds the Arabic spellings that all mean one place", () => {
    expect(foldSearch("أبها")).toBe(foldSearch("ابها"))
    expect(foldSearch("مكة")).toBe(foldSearch("مكه"))
    expect(foldSearch("نعمى")).toBe(foldSearch("نعمي"))
  })

  it("flattens the transliteration diacritics in the Latin column", () => {
    expect(foldSearch("Ţubarjal")).toBe(foldSearch("tubarjal"))
    expect(foldSearch("Al-'Ula")).toBe(foldSearch("al ula"))
  })
})

describe("geoLabel", () => {
  it("switches on the locale and falls back to English", () => {
    const sa = countryByCode("SA")!
    expect(geoLabel(sa, "ar")).toBe(sa.ar)
    expect(geoLabel(sa, "en")).toBe(sa.en)
    expect(geoLabel(sa, "fr")).toBe(sa.en)
  })

  it("overrides PS Arabic to فلسطين without touching English or the source row", () => {
    const ps = countryByCode("PS")!
    expect(ps.ar).toBe("احتلت الأراضي الفلسطينية")
    expect(geoLabel(ps, "ar")).toBe("فلسطين")
    expect(geoLabel(ps, "en")).toBe(ps.en)
  })

  it("replaces the source's machine-translation errors in Arabic only", () => {
    const tr = countryByCode("TR")!
    // The source column calls Turkey the bird; that is what this guards.
    expect(tr.ar).toBe("ديك رومى")
    expect(geoLabel(tr, "ar")).toBe("تركيا")
    expect(geoLabel(tr, "en")).toBe(tr.en)
    expect(geoLabel(countryByCode("RE")!, "ar")).toBe("روينيون")
    // Cameroon's Arabic column fell back to English at generation.
    expect(geoLabel(countryByCode("CM")!, "ar")).toBe("الكاميرون")
  })
})
