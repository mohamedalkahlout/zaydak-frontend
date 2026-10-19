import { describe, expect, it } from "vitest"
import { productFormDefaults } from "@/features/products/lib/form/form-defaults"
import { mergeProductPrefill, proposedFromPrefill } from "../form/merge-prefill"

// `update_product` renaming only the Arabic title sent
// `name: { en: "", ar: "…" }`, and the form spread its prefill one level
// deep, so the English title on the edit form went blank (the same for the
// description and the SEO pair). The tool now sends only the locale it was
// given; the form merges a translatable per locale, so neither shape blanks
// the other locale.

const ROW = {
  name: { en: "Linen Shirt", ar: "قميص كتان" },
  description: { en: "<p>Breathable.</p>", ar: "<p>خفيف.</p>" },
  seo_title: { en: "Linen", ar: "كتان" },
  price: 150,
  sku: "LS-1",
}

describe("mergeProductPrefill", () => {
  it("keeps the other locale when the prefill carries one", () => {
    const merged = mergeProductPrefill(ROW, {
      name: { ar: "قميص كتان جديد" },
      seo_title: { en: "Linen shirt" },
    })
    expect(merged.name).toEqual({ en: "Linen Shirt", ar: "قميص كتان جديد" })
    expect(merged.seo_title).toEqual({ en: "Linen shirt", ar: "كتان" })
    expect(merged.description).toBe(ROW.description)
  })

  it("does not let a blank locale from an older prefill blank the row's", () => {
    // What update_product sent before 2026-10-01, still in chat history.
    const merged = mergeProductPrefill(ROW, {
      name: { en: "", ar: "قميص كتان جديد" },
      description: { en: "<p>Breathable linen.</p>", ar: "" },
    })
    expect(merged.name).toEqual({ en: "Linen Shirt", ar: "قميص كتان جديد" })
    expect(merged.description).toEqual({
      en: "<p>Breathable linen.</p>",
      ar: "<p>خفيف.</p>",
    })
  })

  it("replaces everything else one level deep, as before", () => {
    const merged = mergeProductPrefill(ROW, { price: 300, sku: "LS-2" })
    expect(merged).toEqual({ ...ROW, price: 300, sku: "LS-2" })
  })

  it("fills a create form's empty pair exactly as the spread did", () => {
    const base = productFormDefaults("SIMPLE")
    const prefill = {
      name: { en: "", ar: "هودي" },
      description: { en: "", ar: "" },
      price: 200,
    }
    expect(mergeProductPrefill(base, prefill)).toEqual({ ...base, ...prefill })
  })

  it("returns the base untouched with no prefill", () => {
    expect(mergeProductPrefill(ROW, undefined)).toBe(ROW)
  })
})

describe("proposedFromPrefill", () => {
  it("proposes the merged pair the form holds for a one-locale change", () => {
    const prefill = { name: { ar: "قميص كتان جديد" }, price: 300 }
    const merged = mergeProductPrefill(ROW, prefill)
    expect(proposedFromPrefill(merged, prefill)).toEqual({
      name: { en: "Linen Shirt", ar: "قميص كتان جديد" },
      price: 300,
    })
  })

  it("leaves a translatable with no text as sent, so it marks nothing", () => {
    const base = productFormDefaults("SIMPLE")
    const prefill = { description: { en: "", ar: "" } }
    expect(
      proposedFromPrefill(mergeProductPrefill(base, prefill), prefill),
    ).toEqual({ description: { en: "", ar: "" } })
  })

  it("is empty with no prefill", () => {
    expect(proposedFromPrefill(ROW, undefined)).toEqual({})
  })
})
