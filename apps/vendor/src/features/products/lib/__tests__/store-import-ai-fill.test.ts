import { describe, expect, it } from "vitest"
import type {
  StoreImportField,
  StoreImportProduct,
} from "@/features/products/api"
import en from "@/shared/messages/en"
import ar from "@/shared/messages/ar"
import {
  AI_REQUESTS_PER_HOUR,
  CATEGORY_FILL_BATCH,
  CATEGORY_FILL_MAX_CALLS,
  categoryFillPicks,
  planCategoryFill,
  stageCategoryPicks,
} from "../store-import-ai-fill"
import {
  isDirty,
  stageClear,
  stageExcluded,
  stageField,
  toPatches,
} from "../store-import-review"

/**
 * "Suggest categories for this page", as rules.
 *
 * Everything here is about one press costing what the merchant was told it
 * would and touching only what it said it would: which products are asked
 * about, how many requests that is, where the hard cap falls, and which
 * answers are allowed into the draft.
 */

const field = (over: Partial<StoreImportField>): StoreImportField => ({
  key: "name_en",
  kind: "text",
  group: "product",
  never_scanned: false,
  blocks_sale: false,
  bulk_fillable: false,
  max_length: null,
  reference_key: null,
  ...over,
})

const CATEGORY = field({
  key: "system_category_id",
  kind: "category",
  group: "organization",
  never_scanned: true,
  blocks_sale: true,
  bulk_fillable: true,
})
const FIELDS: StoreImportField[] = [
  field({ key: "name_en", max_length: 255 }),
  field({ key: "description_en", kind: "multiline" }),
  field({ key: "brand", max_length: 100 }),
  CATEGORY,
]

const product = (
  handle: string,
  over: Partial<StoreImportProduct> = {},
): StoreImportProduct => ({
  handle,
  position: 0,
  scanned: { name_en: `Scanned ${handle}` },
  edited: {},
  excluded: false,
  image_url: null,
  images: [],
  gallery_count: 0,
  dropped_images: [],
  image_order: [],
  variant_count: 0,
  shares_variant_row: false,
  incomplete: true,
  ...over,
})

const page = (count: number): StoreImportProduct[] =>
  Array.from({ length: count }, (_, index) => product(`p-${index + 1}`))

describe("what a run would ask about", () => {
  it("asks about every product with no category, in the server's batches", () => {
    const plan = planCategoryFill(page(30), {}, FIELDS)

    expect(plan.products).toBe(30)
    expect(plan.calls).toBe(2)
    expect(plan.batches.map((batch) => batch.items.length)).toEqual([
      CATEGORY_FILL_BATCH,
      5,
    ])
    expect(plan.skipped).toBe(0)
    expect(plan.overCap).toBe(0)
  })

  it("skips a product that already has a category, wherever it came from", () => {
    const scanned = product("scanned", {
      scanned: { name_en: "A", system_category_id: "cat-1" },
    })
    const saved = product("saved", { edited: { system_category_id: "cat-2" } })
    const staged = product("staged")
    const draft = stageField({}, staged, CATEGORY, "cat-3")

    const plan = planCategoryFill(
      [scanned, saved, staged, product("empty")],
      draft,
      FIELDS,
    )

    expect(plan.products).toBe(1)
    expect(plan.skipped).toBe(3)
    expect(Object.values(plan.batches[0]!.handleByRef)).toEqual(["empty"])
  })

  it("leaves a deliberate clear alone — it is the merchant's answer", () => {
    // Cleared over a scanned category, saved or staged: "no category" was
    // chosen, and a bulk run must not fill it back in.
    const savedClear = product("saved-clear", {
      scanned: { name_en: "A", system_category_id: "cat-1" },
      edited: { system_category_id: "" },
    })
    const stagedClear = product("staged-clear", {
      scanned: { name_en: "B", system_category_id: "cat-1" },
    })
    const draft = stageClear({}, stagedClear, CATEGORY)

    const plan = planCategoryFill([savedClear, stagedClear], draft, FIELDS)

    expect(plan.products).toBe(0)
    expect(plan.calls).toBe(0)
    expect(plan.skipped).toBe(2)
  })

  it("skips a product that is left out, saved or staged", () => {
    const savedOut = product("saved-out", { excluded: true })
    const stagedOut = product("staged-out")
    const draft = stageExcluded({}, stagedOut, true)

    expect(
      planCategoryFill([savedOut, stagedOut], draft, FIELDS).products,
    ).toBe(0)
  })

  it("skips a product with no title: there is nothing to classify", () => {
    const untitled = product("untitled", { scanned: {} })
    expect(planCategoryFill([untitled], {}, FIELDS).products).toBe(0)
  })

  it("has nothing to offer on a job with no category column", () => {
    const plan = planCategoryFill(page(3), {}, FIELDS.slice(0, 3))
    expect(plan.calls).toBe(0)
  })

  it("never sends more than the cap, and says what is left", () => {
    const max = CATEGORY_FILL_BATCH * CATEGORY_FILL_MAX_CALLS
    const plan = planCategoryFill(page(max + 20), {}, FIELDS)

    expect(plan.products).toBe(max)
    expect(plan.calls).toBe(CATEGORY_FILL_MAX_CALLS)
    expect(plan.overCap).toBe(20)
    // The cap leaves most of the hour's allowance for the row buttons.
    expect(CATEGORY_FILL_MAX_CALLS).toBeLessThan(AI_REQUESTS_PER_HOUR / 2)
  })
})

describe("what the model is sent", () => {
  it("sends the title the merchant corrected, not the one the scan read", () => {
    const mug = product("mug", {
      scanned: {
        name_en: "MUG CERAMIC 350ML BLU",
        description_en: "<p>A <b>blue</b> mug.</p>",
        brand: "Acme",
      },
    })
    const draft = stageField({}, mug, FIELDS[0]!, "Blue ceramic mug")

    const [item] = planCategoryFill([mug], draft, FIELDS).batches[0]!.items

    expect(item).toEqual({
      ref: "p0",
      name: "Blue ceramic mug",
      // Plain text: markup only spends the prompt.
      description: "A blue mug.",
      brand: "Acme",
    })
  })

  it("leaves out what the product does not have", () => {
    const [item] = planCategoryFill([product("bare")], {}, FIELDS).batches[0]!
      .items
    expect(item).toEqual({ ref: "p0", name: "Scanned bare" })
  })

  it("keeps every value inside what the server accepts", () => {
    // One over-long field would refuse the whole request of 25.
    const long = product("x".repeat(200), {
      scanned: {
        name_en: "n".repeat(400),
        description_en: "d".repeat(5000),
        brand: "b".repeat(300),
      },
    })
    const [item] = planCategoryFill([long], {}, FIELDS).batches[0]!.items

    expect(item!.ref.length).toBeLessThanOrEqual(120)
    expect(item!.name).toHaveLength(300)
    expect(item!.description).toHaveLength(2000)
    expect(item!.brand).toHaveLength(200)
  })

  it("names products by a run-local ref and maps it back to the handle", () => {
    const plan = planCategoryFill(page(26), {}, FIELDS)

    expect(plan.batches[0]!.handleByRef.p0).toBe("p-1")
    expect(plan.batches[1]!.items[0]!.ref).toBe("p25")
    expect(plan.batches[1]!.handleByRef.p25).toBe("p-26")
  })
})

describe("which answers are allowed into the draft", () => {
  const plan = () => planCategoryFill(page(4), {}, FIELDS)

  it("stages only a decisive answer, and counts the rest", () => {
    const picks = categoryFillPicks(plan().batches[0]!, [
      { ref: "p0", decisive: true, categories: [{ id: "cat-a" }] },
      // More than one place it could go: a person chooses, not the run.
      {
        ref: "p1",
        decisive: false,
        categories: [{ id: "cat-b" }, { id: "cat-c" }],
      },
      { ref: "p2", decisive: true, categories: [] },
      // p3: the model said nothing about it at all.
    ])

    expect(picks.byHandle).toEqual({ "p-1": "cat-a" })
    expect(picks.ambiguous).toBe(1)
    expect(picks.unplaced).toBe(2)
  })

  it("ignores an answer for a product the batch never asked about", () => {
    const picks = categoryFillPicks(plan().batches[0]!, [
      { ref: "p99", decisive: true, categories: [{ id: "cat-z" }] },
    ])
    expect(picks.byHandle).toEqual({})
    expect(picks.unplaced).toBe(4)
  })

  it("stages a pick exactly like a category chosen by hand", () => {
    const products = page(2)
    const draft = stageCategoryPicks({}, products, FIELDS, { "p-1": "cat-a" })

    expect(isDirty(draft)).toBe(true)
    expect(toPatches(draft)).toEqual([
      { handle: "p-1", fields: { system_category_id: "cat-a" } },
    ])
  })

  it("does not write over a cell that gained an answer during the run", () => {
    const products = page(2)
    const typed = stageField({}, products[0]!, CATEGORY, "cat-mine")

    const draft = stageCategoryPicks(typed, products, FIELDS, {
      "p-1": "cat-ai",
      "p-2": "cat-b",
    })

    expect(draft["p-1"]!.fields!.system_category_id).toBe("cat-mine")
    expect(draft["p-2"]!.fields!.system_category_id).toBe("cat-b")
  })

  it("stages nothing for a handle that is not on the page", () => {
    expect(stageCategoryPicks({}, page(1), FIELDS, { ghost: "cat-a" })).toEqual(
      {},
    )
  })
})

describe("the dialog's copy", () => {
  it("exists in both languages", () => {
    const keys = [
      "open",
      "title",
      "intro",
      "estimateProducts",
      "estimateCalls",
      "estimateLimit",
      "estimateFree",
      "skipped",
      "capped",
      "nothing",
      "staged",
      "cancel",
      "confirm",
      "running",
      "stop",
      "stopping",
      "resultFilled",
      "resultAmbiguous",
      "resultUnplaced",
      "resultStopped",
      "resultNotAsked",
      "resultSave",
      "close",
    ]
    for (const messages of [en, ar as typeof en]) {
      const aiFill = (
        messages.products.import.review as unknown as {
          aiFill: Record<string, string>
        }
      ).aiFill
      for (const key of keys) expect(aiFill[key]).toBeTruthy()
    }
  })
})
