import { describe, expect, it } from "vitest"
import { mergePrefill, proposedFromPrefill } from "../merge-prefill"
import {
  COLLECTION_TRANSLATABLE_FIELDS,
  collectionFormDefaults,
} from "@/features/collections/lib/rules"

// The generic half of the per-locale prefill merge, bound by the product and
// collection forms to their own `{ en, ar }` field lists. The product binding
// is pinned in `features/products/lib/__tests__/merge-prefill.test.ts`; this
// pins the generic rule and the collection form's use of it.

const FIELDS = ["name", "description"] as const

const ROW = {
  name: { en: "Summer Sale", ar: "تخفيضات" },
  description: { en: "Hot.", ar: "حر." },
  slug: "summer",
}

describe("mergePrefill", () => {
  it("merges only the named fields per locale", () => {
    const merged = mergePrefill(
      ROW,
      { name: { ar: "تخفيضات الصيف" }, slug: "summer-25" },
      FIELDS,
    )
    expect(merged).toEqual({
      name: { en: "Summer Sale", ar: "تخفيضات الصيف" },
      description: ROW.description,
      slug: "summer-25",
    })
  })

  it("treats a field outside the list as a plain value", () => {
    // Named as translatable: per locale. Not named: replaced whole.
    const change = { description: { ar: "" } }
    expect(mergePrefill(ROW, change, FIELDS).description).toEqual(
      ROW.description,
    )
    expect(mergePrefill(ROW, change, ["name"]).description).toEqual({ ar: "" })
  })

  it("accepts a Set as well as an array", () => {
    expect(
      mergePrefill(ROW, { name: { en: "Sale" } }, new Set(["name"])).name,
    ).toEqual({ en: "Sale", ar: "تخفيضات" })
  })
})

describe("the collection form's binding", () => {
  it("fills a create form's empty pair exactly as the spread did", () => {
    const base = collectionFormDefaults()
    const prefill = {
      name: { ar: "تخفيضات الصيف" },
      slug: "تخفيضات-الصيف",
    }
    expect(mergePrefill(base, prefill, COLLECTION_TRANSLATABLE_FIELDS)).toEqual(
      {
        ...base,
        name: { en: "", ar: "تخفيضات الصيف" },
        slug: "تخفيضات-الصيف",
      },
    )
  })

  it("does not let an older prefill's blank locale blank a value", () => {
    // What create_collection sent before 2026-10-02, still in chat history.
    const base = { ...collectionFormDefaults(), name: { en: "Sale", ar: "" } }
    expect(
      mergePrefill(
        base,
        { name: { en: "", ar: "تخفيضات" } },
        COLLECTION_TRANSLATABLE_FIELDS,
      ).name,
    ).toEqual({ en: "Sale", ar: "تخفيضات" })
  })

  it("proposes the merged pair for the marks", () => {
    const prefill = { name: { ar: "تخفيضات" } }
    const merged = mergePrefill(
      collectionFormDefaults(),
      prefill,
      COLLECTION_TRANSLATABLE_FIELDS,
    )
    expect(
      proposedFromPrefill(merged, prefill, COLLECTION_TRANSLATABLE_FIELDS),
    ).toEqual({ name: { en: "", ar: "تخفيضات" } })
  })
})
