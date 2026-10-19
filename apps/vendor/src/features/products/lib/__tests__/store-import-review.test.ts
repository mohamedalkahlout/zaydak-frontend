import { describe, it, expect } from "vitest"
import type {
  StoreImportField,
  StoreImportProduct,
} from "@/features/products/api"
import en from "@/shared/messages/en"
import ar from "@/shared/messages/ar"
import {
  FIELD_GROUPS,
  editedDisplay,
  fieldsByGroup,
  referenceDisplay,
  droppedImages,
  importedDisplay,
  importedText,
  isCleared,
  isDirty,
  isExcluded,
  primaryImage,
  productTitle,
  rowRuns,
  scannedDisplay,
  stageClear,
  stageExcluded,
  stageField,
  stageImageDropped,
  stageImageOrder,
  galleryOrder,
  orderedImages,
  moveInGallery,
  placeInGallery,
  makeMainInGallery,
  stageRevert,
  toPatches,
  type ReviewDraft,
} from "../store-import-review"

/**
 * The review screen stages edits locally and saves once from the contextual bar
 * (`apps/vendor/AGENTS.md`), so almost everything interesting about it is the
 * arithmetic of "what the server last said" versus "what the merchant has typed
 * since". These are the cases that decide whether the save bar appears, what it
 * sends, and whether a merchant can tell their own value from the scan's.
 */

/** The field specs the screen is handed by the server. */
const F = {
  name_en: { key: "name_en", kind: "text" },
  quantity: { key: "quantity", kind: "integer" },
  price_cents: { key: "price_cents", kind: "money_cents" },
} as const

const product = (
  over: Partial<StoreImportProduct> = {},
): StoreImportProduct => ({
  handle: "mug",
  position: 0,
  scanned: {
    name_en: "A mug, as the old store called it",
    price_cents: "1000",
  },
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

describe("what a cell shows", () => {
  it("shows nothing until the merchant types, even when the scan found a value", () => {
    // The whole point of two columns: an input pre-filled with the scanned text
    // reads as the merchant's own answer the moment it appears.
    expect(editedDisplay(product(), {}, F.name_en)).toBe("")
  })

  it("shows the saved override, then anything staged over it", () => {
    const saved = product({ edited: { name_en: "Saved earlier" } })

    expect(editedDisplay(saved, {}, F.name_en)).toBe("Saved earlier")
    expect(
      editedDisplay(
        saved,
        { mug: { fields: { name_en: "Typed now" } } },
        F.name_en,
      ),
    ).toBe("Typed now")
  })

  it("renders a staged revert as an empty cell", () => {
    const saved = product({ edited: { name_en: "Saved earlier" } })
    const draft: ReviewDraft = { mug: { fields: { name_en: null } } }

    expect(editedDisplay(saved, draft, F.name_en)).toBe("")
  })
})

describe("money, which is stored in cents and read in major units", () => {
  it("shows a scanned price the way a person reads it", () => {
    // Raw, this cell says `1000` — which a merchant reads as a thousand and
    // "corrects" to a price that was already right.
    expect(scannedDisplay(F.price_cents, product().scanned)).toBe("10.00")
  })

  it("shows a saved override in major units too", () => {
    const saved = product({ edited: { price_cents: "375" } })

    expect(editedDisplay(saved, {}, F.price_cents)).toBe("3.75")
  })

  it("leaves what is being typed exactly as typed", () => {
    // Formatting mid-keystroke turns `2.` into `2.00` before the merchant has
    // finished, which makes the field impossible to type into.
    const typing = { mug: { fields: { price_cents: "2." } } }

    expect(editedDisplay(product(), typing, F.price_cents)).toBe("2.")
  })

  it("collapses when a typed price matches the saved one in the same unit", () => {
    const saved = product({ edited: { price_cents: "375" } })
    const retyped = stageField({}, saved, F.price_cents, "3.75")

    // Compared as displayed, not as stored: `3.75` against `375` would leave
    // the save bar up for a change nobody made.
    expect(isDirty(retyped)).toBe(false)
  })
})

describe("staging an edit", () => {
  it("collapses when the merchant types a change and takes it back", () => {
    // Value-based dirty, per the save-bar contract: otherwise a merchant is
    // left with a Save button for a change that no longer exists.
    const typed = stageField({}, product(), F.name_en, "Something")
    expect(isDirty(typed)).toBe(true)

    const reverted = stageField(typed, product(), F.name_en, "")
    expect(isDirty(reverted)).toBe(false)
  })

  it("collapses back to a value that was already saved", () => {
    const saved = product({ edited: { name_en: "Saved" } })
    const changed = stageField({}, saved, F.name_en, "Different")
    const back = stageField(changed, saved, F.name_en, "Saved")

    expect(isDirty(back)).toBe(false)
  })

  it("stages a clear as an explicit revert, not as an untouched field", () => {
    const saved = product({ edited: { name_en: "Saved" } })
    const cleared = stageField({}, saved, F.name_en, "")

    // `null` is the wire's "put the scan's value back". An absent key would
    // mean "leave my override alone", which is the opposite.
    expect(cleared.mug.fields).toEqual({ name_en: null })
    expect(isDirty(cleared)).toBe(true)
  })

  it("keeps edits to other fields of the same product", () => {
    const first = stageField({}, product(), F.name_en, "New title")
    const second = stageField(first, product(), F.quantity, "12")

    expect(second.mug.fields).toEqual({ name_en: "New title", quantity: "12" })
  })
})

describe("excluding a product", () => {
  it("stages and collapses like any other change", () => {
    const excluded = stageExcluded({}, product(), true)
    expect(isExcluded(product(), excluded)).toBe(true)
    expect(isDirty(excluded)).toBe(true)

    const back = stageExcluded(excluded, product(), false)
    expect(isDirty(back)).toBe(false)
  })

  it("does not lose the field edits staged beside it", () => {
    const edited = stageField({}, product(), F.quantity, "7")
    const both = stageExcluded(edited, product(), true)

    expect(both.mug.fields).toEqual({ quantity: "7" })
    expect(both.mug.excluded).toBe(true)
  })

  it("reads an already-saved exclusion when nothing is staged", () => {
    expect(isExcluded(product({ excluded: true }), {})).toBe(true)
  })
})

describe("the save payload", () => {
  it("sends only what was touched", () => {
    const draft = stageField({}, product(), F.quantity, "3")

    // The server merges field by field, so sending a whole product would be
    // the thing that drops an edit made a minute earlier on another field.
    expect(toPatches(draft)).toEqual([
      { handle: "mug", fields: { quantity: "3" } },
    ])
  })

  it("omits the exclude flag when it was never touched", () => {
    const draft = stageField({}, product(), F.quantity, "3")

    expect(toPatches(draft)[0]).not.toHaveProperty("excluded")
  })
})

describe("the rail's title", () => {
  it("prefers what the merchant typed, then the scan, then the handle", () => {
    expect(productTitle(product(), {})).toBe(
      "A mug, as the old store called it",
    )
    expect(
      productTitle(product(), { mug: { fields: { name_en: "Mine" } } }),
    ).toBe("Mine")
    expect(productTitle(product({ scanned: {} }), {})).toBe("mug")
  })
})

describe("what the reference cell shows", () => {
  const FIELDS: StoreImportField[] = [
    {
      key: "name_en",
      kind: "text",
      group: "product",
      never_scanned: false,
      blocks_sale: false,
    },
    {
      key: "name_ar",
      kind: "text",
      group: "translation",
      never_scanned: false,
      blocks_sale: false,
      reference_key: "name_en",
    },
  ]

  it("shows a translation's English source, the merchant's own title first", () => {
    // The Arabic has to match what will actually be imported in English, so
    // a title the merchant retyped is the reference, not the scanned one.
    expect(referenceDisplay(product(), {}, FIELDS[1]!, FIELDS)).toBe(
      "A mug, as the old store called it",
    )
    expect(
      referenceDisplay(
        product(),
        { mug: { fields: { name_en: "My mug" } } },
        FIELDS[1]!,
        FIELDS,
      ),
    ).toBe("My mug")
  })

  it("is the scanned value for every field without a reference", () => {
    expect(referenceDisplay(product(), {}, FIELDS[0]!, FIELDS)).toBe(
      "A mug, as the old store called it",
    )
  })
})

/**
 * A clear is the merchant's answer "import nothing here". The server keeps it
 * as the key holding `''` — not the key being absent (untouched), and not a
 * save's `null` (revert). The cell is empty in all three cases, so none of
 * this can be read off the text in it.
 */
describe("a cleared cell", () => {
  const BRAND = { key: "brand", kind: "text" } as const
  const CATEGORY = { key: "system_category_id", kind: "category" } as const
  const scan = (over: Partial<StoreImportProduct> = {}) =>
    product({
      scanned: {
        name_en: "Mug",
        brand: "Old Co",
        price_cents: "1000",
        system_category_id: "123",
      },
      ...over,
    })

  it("reads a saved clear as a clear, and nothing else as one", () => {
    const cleared = scan({ edited: { brand: "" } })

    expect(isCleared(cleared, {}, "brand")).toBe(true)
    expect(isCleared(scan(), {}, "brand")).toBe(false)
    expect(isCleared(scan({ edited: { brand: "Mine" } }), {}, "brand")).toBe(
      false,
    )
    // The cell itself is empty either way, which is why it has to be asked.
    expect(editedDisplay(cleared, {}, BRAND)).toBe("")
  })

  it("stages a clear as the wire's empty string, never as a revert", () => {
    const draft = stageClear({}, scan(), BRAND)

    expect(isDirty(draft)).toBe(true)
    expect(isCleared(scan(), draft, "brand")).toBe(true)
    // `""` stores a clear; `null` would put the scan's value back.
    expect(toPatches(draft)).toEqual([{ handle: "mug", fields: { brand: "" } }])
  })

  it("stages nothing when the same clear is already saved", () => {
    expect(stageClear({}, scan({ edited: { brand: "" } }), BRAND)).toEqual({})
  })

  it("undoes a saved clear with a revert the server can act on", () => {
    const saved = scan({ edited: { system_category_id: "" } })
    // Erasing the text cannot do it: the cell is already empty, so it matches
    // what is saved and stages nothing.
    expect(stageField({}, saved, CATEGORY, "")).toEqual({})

    const reverted = stageRevert({}, saved, CATEGORY)
    expect(toPatches(reverted)).toEqual([
      { handle: "mug", fields: { system_category_id: null } },
    ])
    expect(isCleared(saved, reverted, "system_category_id")).toBe(false)
    expect(importedDisplay(saved, reverted, CATEGORY)).toBe("123")
  })

  it("reverts a saved value and collapses a staged one, as erasing does", () => {
    expect(stageRevert({}, scan({ edited: { brand: "Mine" } }), BRAND)).toEqual(
      { mug: { fields: { brand: null } } },
    )
    expect(stageRevert({}, scan(), BRAND)).toEqual({})

    const typed = stageField({}, scan(), BRAND, "New Co")
    expect(stageRevert(typed, scan(), BRAND)).toEqual({})
  })

  it("comes back to a saved clear when a value typed over it is erased", () => {
    const saved = scan({ edited: { brand: "" } })
    const typed = stageField({}, saved, BRAND, "New Co")
    expect(isCleared(saved, typed, "brand")).toBe(false)

    const erased = stageField(typed, saved, BRAND, "")
    expect(isDirty(erased)).toBe(false)
    expect(isCleared(saved, erased, "brand")).toBe(true)
  })

  it("imports nothing for a cleared column, and never the scan in its place", () => {
    const FIELDS: StoreImportField[] = [
      {
        key: "name_en",
        kind: "text",
        group: "product",
        never_scanned: false,
        blocks_sale: false,
      },
      {
        key: "brand",
        kind: "text",
        group: "product",
        never_scanned: false,
        blocks_sale: false,
      },
      {
        key: "name_ar",
        kind: "text",
        group: "translation",
        never_scanned: false,
        blocks_sale: false,
        reference_key: "name_en",
      },
    ]

    // The Arabic has to match the English that will be imported — none.
    const staged = stageClear({}, scan(), FIELDS[0]!)
    expect(referenceDisplay(scan(), staged, FIELDS[2]!, FIELDS)).toBe("")
    const saved = scan({ edited: { name_en: "", brand: "", price_cents: "" } })
    expect(referenceDisplay(saved, {}, FIELDS[2]!, FIELDS)).toBe("")

    // A model asked about the product is not handed the old store's brand.
    expect(importedText(saved, {}, FIELDS, "brand")).toBe("")
    expect(importedText(scan(), {}, FIELDS, "brand")).toBe("Old Co")

    expect(importedDisplay(saved, {}, F.price_cents)).toBe("")
    expect(importedDisplay(scan(), {}, F.price_cents)).toBe("10.00")
  })

  it("reads a staged value of only spaces as the clear the server will store", () => {
    // `normalizeValue` trims, and stores what is left — nothing — as a clear.
    const draft = stageField({}, scan(), BRAND, "   ")

    expect(isCleared(scan(), draft, "brand")).toBe(true)
    expect(importedDisplay(scan(), draft, BRAND)).toBe("")
  })
})

describe("the SEO card", () => {
  // What the server sends for the quartet (`review/field-catalog.ts`).
  const SEO: StoreImportField[] = [
    {
      key: "seo_title_en",
      kind: "text",
      group: "seo",
      never_scanned: true,
      blocks_sale: false,
      max_length: 255,
    },
    {
      key: "seo_description_en",
      kind: "multiline",
      group: "seo",
      never_scanned: true,
      blocks_sale: false,
    },
    {
      key: "seo_title_ar",
      kind: "text",
      group: "seo",
      never_scanned: true,
      blocks_sale: false,
      max_length: 255,
      reference_key: "seo_title_en",
    },
    {
      key: "seo_description_ar",
      kind: "multiline",
      group: "seo",
      never_scanned: true,
      blocks_sale: false,
      reference_key: "seo_description_en",
    },
  ]

  it("is a card the editor renders, last", () => {
    // A group missing from FIELD_GROUPS is a card that never renders: the
    // server would offer the four fields and the screen would show none.
    expect(FIELD_GROUPS.at(-1)).toBe("seo")
    expect(fieldsByGroup(SEO, "seo").map((f) => f.key)).toEqual([
      "seo_title_en",
      "seo_description_en",
      "seo_title_ar",
      "seo_description_ar",
    ])
  })

  // The card holds both kinds of row, and the two name their columns
  // differently: under one "What we read" header the Arabic rows' English
  // reference read as something the scan had found for the Arabic.
  it("puts the English rows and their Arabic under headers of their own", () => {
    const runs = rowRuns(fieldsByGroup(SEO, "seo"))
    expect(
      runs.map((run) => [run.translation, run.fields.map((f) => f.key)]),
    ).toEqual([
      [false, ["seo_title_en", "seo_description_en"]],
      [true, ["seo_title_ar", "seo_description_ar"]],
    ])
  })

  it("keeps one header on a card of one kind of row", () => {
    expect(rowRuns([SEO[0]!, SEO[1]!])).toHaveLength(1)
    expect(rowRuns([SEO[2]!, SEO[3]!])).toEqual([
      { translation: true, fields: [SEO[2], SEO[3]] },
    ])
    expect(rowRuns([])).toEqual([])
  })

  it("shows the English page title beside its Arabic, edits included", () => {
    const withSeo = product({ scanned: { seo_title_en: "Mug | Old store" } })
    expect(referenceDisplay(withSeo, {}, SEO[2]!, SEO)).toBe("Mug | Old store")
    expect(
      referenceDisplay(
        withSeo,
        { mug: { fields: { seo_title_en: "The mug" } } },
        SEO[2]!,
        SEO,
      ),
    ).toBe("The mug")
  })

  it("has a card title and a label for every field, in both languages", () => {
    for (const messages of [en, ar as typeof en]) {
      const review = messages.products.import.review as {
        groups: Record<string, string>
        fields: Record<string, { label: string }>
      }
      for (const group of FIELD_GROUPS) {
        expect(review.groups[group]).toBeTruthy()
      }
      for (const field of SEO) {
        expect(review.fields[field.key]?.label).toBeTruthy()
      }
    }
  })
})

describe("dropping a scanned image", () => {
  const FRONT = "https://old.example.com/front.jpg"
  const BACK = "https://old.example.com/back.jpg"
  const SIDE = "https://old.example.com/side.jpg"
  const withImages = (over: Partial<StoreImportProduct> = {}) =>
    product({
      image_url: FRONT,
      images: [FRONT, BACK, SIDE],
      gallery_count: 3,
      ...over,
    })

  it("stages a drop, arms Save, and sends the whole set", () => {
    const draft = stageImageDropped({}, withImages(), BACK, true)

    expect(isDirty(draft)).toBe(true)
    expect(droppedImages(withImages(), draft)).toEqual([BACK])
    // The server replaces the stored set with this, so it is the set, not a
    // delta — and nothing else about the product rides along.
    expect(toPatches(draft)).toEqual([{ handle: "mug", dropped_images: [BACK] }])
  })

  it("collapses when the photo is restored again", () => {
    const dropped = stageImageDropped({}, withImages(), BACK, true)
    const restored = stageImageDropped(dropped, withImages(), BACK, false)

    // Value-based, like a typed cell: no Save for a change that is gone.
    expect(isDirty(restored)).toBe(false)
  })

  it("collapses back to a set that was already saved", () => {
    const saved = withImages({ dropped_images: [SIDE] })
    const restored = stageImageDropped({}, saved, SIDE, false)
    expect(toPatches(restored)).toEqual([{ handle: "mug", dropped_images: [] }])

    const back = stageImageDropped(restored, saved, SIDE, true)
    expect(isDirty(back)).toBe(false)
  })

  it("keeps the scan's order whatever order the merchant clicked in", () => {
    const first = stageImageDropped({}, withImages(), SIDE, true)
    const both = stageImageDropped(first, withImages(), FRONT, true)

    expect(both.mug.dropped_images).toEqual([FRONT, SIDE])
  })

  it("never stages a URL the scan did not find", () => {
    // Drop-only: there is no path from here to a URL the import would fetch.
    const draft = stageImageDropped(
      {},
      withImages(),
      "https://elsewhere.example.com/x.jpg",
      true,
    )
    expect(draft).toEqual({})
  })

  it("is not lost when a field on the same product is typed back", () => {
    const typed = stageField({}, withImages(), F.name_en, "Mine")
    const dropped = stageImageDropped(typed, withImages(), BACK, true)
    const untyped = stageField(dropped, withImages(), F.name_en, "")

    // The field's entry collapsed; the drop beside it must survive that.
    expect(untyped).toEqual({ mug: { dropped_images: [BACK] } })
  })

  it("shows the next photo as the main one when the main one is dropped", () => {
    expect(primaryImage(withImages(), {})).toBe(FRONT)

    const draft = stageImageDropped({}, withImages(), FRONT, true)
    expect(primaryImage(withImages(), draft)).toBe(BACK)
    expect(primaryImage(withImages({ dropped_images: [FRONT, BACK] }), {})).toBe(
      SIDE,
    )
  })

  it("shows no photo once every one is dropped", () => {
    const all = withImages({ dropped_images: [FRONT, BACK, SIDE] })
    expect(primaryImage(all, {})).toBeNull()
  })

  it("never promotes a photo only a variant uses — the server does not either", () => {
    // `SIDE` is past the gallery: only a variant points at it. The commit fills
    // the file's image rows from the gallery alone, so with FRONT and BACK
    // dropped the product imports with NO main image, and the screen must not
    // badge the variant's photo as "Main".
    const variantTail = withImages({ gallery_count: 2 })
    expect(primaryImage(variantTail, {})).toBe(FRONT)

    const draft = stageImageDropped(
      stageImageDropped({}, variantTail, FRONT, true),
      variantTail,
      BACK,
      true,
    )
    expect(droppedImages(variantTail, draft)).toEqual([FRONT, BACK])
    expect(primaryImage(variantTail, draft)).toBeNull()
    expect(
      primaryImage(withImages({ gallery_count: 2, dropped_images: [FRONT] }), {}),
    ).toBe(BACK)
  })

  it("shows no main photo for a product whose only photos belong to variants", () => {
    expect(primaryImage(withImages({ gallery_count: 0 }), {})).toBeNull()
  })

  it("has copy for the strip in both languages", () => {
    for (const messages of [en, ar as typeof en]) {
      const images = (
        messages.products.import.review as unknown as {
          images: Record<string, string>
        }
      ).images
      for (const key of [
        "title",
        "kept",
        "hint",
        "primary",
        "dropped",
        "drop",
        "restore",
        "noneKept",
        "noMain",
        "makeMain",
        "moveEarlier",
        "moveLater",
        "variantOnly",
      ]) {
        expect(images[key]).toBeTruthy()
      }
    }
  })
})

describe("ordering the gallery", () => {
  const FRONT = "https://old.example.com/front.jpg"
  const BACK = "https://old.example.com/back.jpg"
  const SIDE = "https://old.example.com/side.jpg"
  const RED = "https://old.example.com/red.jpg"
  /** Three gallery photos, then one only a variant uses. */
  const withImages = (over: Partial<StoreImportProduct> = {}) =>
    product({
      image_url: FRONT,
      images: [FRONT, BACK, SIDE, RED],
      gallery_count: 3,
      ...over,
    })

  it("shows the scan's order until the merchant changes it", () => {
    expect(galleryOrder(withImages(), {})).toEqual([FRONT, BACK, SIDE])
    expect(orderedImages(withImages(), {})).toEqual([FRONT, BACK, SIDE, RED])
  })

  it("stages a new main photo, badges it, and sends the whole gallery order", () => {
    const order = makeMainInGallery(galleryOrder(withImages(), {}), SIDE)
    const draft = stageImageOrder({}, withImages(), order)

    expect(isDirty(draft)).toBe(true)
    expect(primaryImage(withImages(), draft)).toBe(SIDE)
    expect(orderedImages(withImages(), draft)).toEqual([SIDE, FRONT, BACK, RED])
    expect(toPatches(draft)).toEqual([
      { handle: "mug", image_order: [SIDE, FRONT, BACK] },
    ])
  })

  it("moves a photo one place, and not past either end", () => {
    const order = [FRONT, BACK, SIDE]
    expect(moveInGallery(order, BACK, -1)).toEqual([BACK, FRONT, SIDE])
    expect(moveInGallery(order, BACK, 1)).toEqual([FRONT, SIDE, BACK])
    expect(moveInGallery(order, FRONT, -1)).toBe(order)
    expect(moveInGallery(order, SIDE, 1)).toBe(order)
    expect(moveInGallery(order, RED, 1)).toBe(order)
  })

  it("places a dragged photo before another, and ignores a drop on itself", () => {
    const order = [FRONT, BACK, SIDE]
    expect(placeInGallery(order, SIDE, FRONT)).toEqual([SIDE, FRONT, BACK])
    expect(placeInGallery(order, FRONT, SIDE)).toEqual([BACK, FRONT, SIDE])
    expect(placeInGallery(order, BACK, BACK)).toBe(order)
    expect(placeInGallery(order, RED, FRONT)).toBe(order)
  })

  it("collapses when the order is moved back to the scan's", () => {
    const moved = stageImageOrder({}, withImages(), [BACK, FRONT, SIDE])
    const back = stageImageOrder(moved, withImages(), [FRONT, BACK, SIDE])
    expect(isDirty(back)).toBe(false)
  })

  it("stages an empty order to restore the scan's over a saved one", () => {
    const saved = withImages({ image_order: [SIDE, FRONT, BACK] })
    expect(galleryOrder(saved, {})).toEqual([SIDE, FRONT, BACK])
    expect(primaryImage(saved, {})).toBe(SIDE)

    const restored = stageImageOrder({}, saved, [FRONT, BACK, SIDE])
    expect(toPatches(restored)).toEqual([{ handle: "mug", image_order: [] }])

    const again = stageImageOrder(restored, saved, [SIDE, FRONT, BACK])
    expect(isDirty(again)).toBe(false)
  })

  it("never stages anything but a permutation of the gallery", () => {
    const p = withImages()
    // A variant's photo, a stranger's URL, a short list, a repeat.
    expect(stageImageOrder({}, p, [RED, FRONT, BACK])).toEqual({})
    expect(
      stageImageOrder({}, p, ["https://x.example.com/x.jpg", FRONT, BACK]),
    ).toEqual({})
    expect(stageImageOrder({}, p, [BACK, FRONT])).toEqual({})
    expect(stageImageOrder({}, p, [BACK, BACK, FRONT])).toEqual({})
  })

  it("keeps the main photo and a drop in step", () => {
    // The merchant makes SIDE main, then drops it: the next in THEIR order is
    // the main photo, exactly as the commit promotes it.
    const ordered = stageImageOrder({}, withImages(), [SIDE, FRONT, BACK])
    const dropped = stageImageDropped(ordered, withImages(), SIDE, true)

    expect(primaryImage(withImages(), dropped)).toBe(FRONT)
    expect(toPatches(dropped)).toEqual([
      {
        handle: "mug",
        dropped_images: [SIDE],
        image_order: [SIDE, FRONT, BACK],
      },
    ])
  })

  it("is not lost when a field on the same product is typed back", () => {
    const typed = stageField({}, withImages(), F.name_en, "Mine")
    const ordered = stageImageOrder(typed, withImages(), [BACK, FRONT, SIDE])
    const untyped = stageField(ordered, withImages(), F.name_en, "")

    expect(untyped).toEqual({ mug: { image_order: [BACK, FRONT, SIDE] } })
  })
})
