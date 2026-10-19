import { describe, it, expect } from "vitest"
import type { StoreImportField } from "@/features/products/api"
import {
  bulkFillBlocker,
  bulkFillValues,
  bulkFillableFields,
} from "../store-import-bulk-fill"

const field = (
  key: string,
  kind: StoreImportField["kind"],
  bulk_fillable?: boolean,
): StoreImportField => ({
  key,
  kind,
  group: "inventory",
  never_scanned: true,
  blocks_sale: false,
  bulk_fillable,
})

const FIELDS: StoreImportField[] = [
  field("name_en", "text", false),
  field("quantity", "integer", true),
  field("cost_per_item_cents", "money_cents"),
  field("system_category_id", "category", true),
]

describe("bulkFillableFields", () => {
  it("offers only what the server marks, in the server's order", () => {
    // Not a list of its own: a field the server does not declare would be a
    // field the fill then refuses.
    expect(bulkFillableFields(FIELDS).map((f) => f.key)).toEqual([
      "quantity",
      "system_category_id",
    ])
  })

  it("offers nothing to a server that has not declared the flag", () => {
    expect(
      bulkFillableFields(
        FIELDS.map((f) => ({ ...f, bulk_fillable: undefined })),
      ),
    ).toEqual([])
  })
})

describe("bulkFillValues", () => {
  const fillable = bulkFillableFields(FIELDS)

  it("sends only the values the merchant gave, trimmed", () => {
    expect(
      bulkFillValues({ quantity: " 20 ", system_category_id: "" }, fillable),
    ).toEqual({ quantity: "20" })
  })

  it("never turns a blank input into a bulk clear", () => {
    expect(bulkFillValues({ quantity: "   " }, fillable)).toBeNull()
    expect(bulkFillValues({}, fillable)).toBeNull()
  })

  it("drops a key the server did not offer", () => {
    expect(
      bulkFillValues({ quantity: "5", name_en: "Everything" }, fillable),
    ).toEqual({ quantity: "5" })
  })
})

describe("bulkFillBlocker", () => {
  it("holds the fill while there is an unsaved draft", () => {
    expect(bulkFillBlocker({ dirty: true, loading: false, total: 40 })).toBe(
      "dirty",
    )
  })

  it("holds it while the count on screen belongs to a filter being replaced", () => {
    expect(bulkFillBlocker({ dirty: false, loading: true, total: 40 })).toBe(
      "loading",
    )
  })

  it("holds it over an empty view", () => {
    expect(bulkFillBlocker({ dirty: false, loading: false, total: 0 })).toBe(
      "empty",
    )
  })

  it("lets it through otherwise", () => {
    expect(
      bulkFillBlocker({ dirty: false, loading: false, total: 40 }),
    ).toBeNull()
  })
})
