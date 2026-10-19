import { describe, expect, it } from "vitest"
import {
  collectionToForm,
  formToInput,
  formToRules,
  newSource,
  rulesToForm,
  slugify,
} from "@/features/collections/lib/rules"
import type { CollectionRules, ShopCollection } from "@/features/collections/types"
import type { SourceInput } from "@/features/collections/validations/shop-collection"

const source = (over: Partial<SourceInput> = {}): SourceInput => ({
  ...newSource("source-1"),
  ...over,
})

describe("rulesToForm", () => {
  it("lifts a legacy single-source rule set", () => {
    const legacy = {
      version: 2,
      sources: [
        {
          id: "source-1",
          kind: "PRODUCTS",
          match: "ANY",
          conditions: [
            { field: "brand", operator: "EQ", values: ["Apple"] },
          ],
          collection_ids: [],
          exclude: {
            match: "ANY",
            conditions: [],
            product_ids: [],
            collection_ids: [],
          },
        },
      ],
    } as unknown as CollectionRules

    const [first] = rulesToForm(legacy)
    expect(first.match).toBe("ANY")
    expect(first.conditions[0]).toMatchObject({
      field: "brand",
      operator: "EQ",
      values: ["Apple"],
    })
  })

  it("folds IN into the multi-value spelling of EQ", () => {
    const rules = {
      version: 2,
      sources: [
        {
          id: "s",
          kind: "PRODUCTS",
          match: "ALL",
          conditions: [
            { field: "status", operator: "IN", values: [["DRAFT", "PUBLISH"]] },
          ],
          collection_ids: [],
          exclude: {
            match: "ANY",
            conditions: [],
            product_ids: [],
            collection_ids: [],
          },
        },
      ],
    } as unknown as CollectionRules

    const [first] = rulesToForm(rules)
    expect(first.conditions[0].operator).toBe("EQ")
    expect(first.conditions[0].values).toEqual(["DRAFT", "PUBLISH"])
  })

  it("shows money in major units, not the stored cents", () => {
    const rules = {
      version: 2,
      sources: [
        {
          id: "s",
          kind: "PRODUCTS",
          match: "ALL",
          conditions: [
            { field: "price_cents", operator: "LTE", values: [12500] },
          ],
          collection_ids: [],
          exclude: {
            match: "ANY",
            conditions: [],
            product_ids: [],
            collection_ids: [],
          },
        },
      ],
    } as unknown as CollectionRules

    expect(rulesToForm(rules)[0].conditions[0].values).toEqual(["125"])
  })

  it("gives an empty rule set one editable source", () => {
    expect(rulesToForm(null)).toHaveLength(1)
    expect(rulesToForm(null)[0].conditions).toEqual([])
  })
})

describe("formToRules", () => {
  it("scales money back to cents", () => {
    const rules = formToRules([
      source({
        conditions: [
          {
            field: "price_cents",
            operator: "LTE",
            values: ["125"],
            attribute_key: "",
          },
        ],
      }),
    ])

    expect(rules.sources[0].conditions[0].values).toEqual([12500])
  })

  it("drops a condition with nothing typed into it", () => {
    const rules = formToRules([
      source({
        conditions: [
          { field: "brand", operator: "EQ", values: ["  "], attribute_key: "" },
        ],
      }),
    ])

    expect(rules.sources[0].conditions).toEqual([])
  })

  it("keeps a presence condition, which has no operand by design", () => {
    const rules = formToRules([
      source({
        conditions: [
          {
            field: "sale_price_cents",
            operator: "IS_SET",
            values: [],
            attribute_key: "",
          },
        ],
      }),
    ])

    expect(rules.sources[0].conditions[0]).toMatchObject({
      operator: "IS_SET",
      values: [],
    })
  })

  it("sends BETWEEN as one [min, max] entry", () => {
    const rules = formToRules([
      source({
        conditions: [
          {
            field: "inventory_quantity",
            operator: "BETWEEN",
            values: ["2", "9"],
            attribute_key: "",
          },
        ],
      }),
    ])

    expect(rules.sources[0].conditions[0].values).toEqual([[2, 9]])
  })

  it("never sends conditions on a COLLECTIONS source", () => {
    const rules = formToRules([
      source({
        kind: "COLLECTIONS",
        collection_ids: ["col-1"],
        conditions: [
          { field: "brand", operator: "EQ", values: ["x"], attribute_key: "" },
        ],
      }),
    ])

    expect(rules.sources[0].conditions).toEqual([])
    expect(rules.sources[0].collection_ids).toEqual(["col-1"])
  })

  it("carries the exclusions through", () => {
    const rules = formToRules([
      source({
        exclude: {
          match: "ANY",
          conditions: [
            { field: "tag", operator: "CONTAINS", values: ["clearance"], attribute_key: "" },
          ],
          product_ids: ["p-1"],
          collection_ids: ["col-9"],
        },
      }),
    ])

    expect(rules.sources[0].exclude.product_ids).toEqual(["p-1"])
    expect(rules.sources[0].exclude.collection_ids).toEqual(["col-9"])
    expect(rules.sources[0].exclude.conditions[0].values).toEqual(["clearance"])
  })
})

describe("formToInput", () => {
  const base = {
    name: { en: " Summer ", ar: "" },
    description: { en: "", ar: "" },
    seo_title: { en: "", ar: "" },
    seo_description: { en: "", ar: "" },
    slug: "",
    sort: "MOST_RELEVANT" as const,
    sort_order: 0,
    is_published: true,
    image_url: "",
    image_alt: "",
    sources: [source()],
    product_ids: [] as string[],
  }

  it("trims the name and drops the locales left empty", () => {
    expect(formToInput(base).name).toEqual({ en: "Summer" })
  })

  it("omits the handle so the API can transliterate one", () => {
    expect("slug" in formToInput(base)).toBe(false)
    expect(formToInput({ ...base, slug: " summer-sale " }).slug).toBe(
      "summer-sale",
    )
  })

  it("omits the image entirely when no url is set", () => {
    expect("image" in formToInput(base)).toBe(false)
    expect(
      formToInput({ ...base, image_url: "https://cdn/x.jpg", image_alt: "x" })
        .image,
    ).toEqual({ url: "https://cdn/x.jpg", alt: "x" })
  })

  it("always sends the hand-picked set, since it is a whole-set replace", () => {
    expect(formToInput({ ...base, product_ids: ["p-1"] }).product_ids).toEqual([
      "p-1",
    ])
  })
})

describe("collectionToForm", () => {
  it("reads a saved collection back into the editor", () => {
    const collection = {
      id: "col-1",
      shop_id: "shop-1",
      type: "AUTOMATED",
      name: { en: "Summer" },
      slug: "summer",
      image: { url: "https://cdn/x.jpg", alt: "cover" },
      description: { en: "Hot" },
      seo_title: null,
      seo_description: null,
      sort_order: 2,
      sort: "PRICE_ASC",
      is_published: false,
      rules: null,
      rules_version: 3,
      product_count: 4,
      created_at: "2026-08-19T00:00:00.000Z",
      updated_at: "2026-08-19T00:00:00.000Z",
    } as unknown as ShopCollection

    const form = collectionToForm(collection, ["p-1", "p-2"])

    expect(form).toMatchObject({
      slug: "summer",
      sort: "PRICE_ASC",
      is_published: false,
      image_url: "https://cdn/x.jpg",
      image_alt: "cover",
      product_ids: ["p-1", "p-2"],
    })
    // A collection with no rules still gets one empty source to edit.
    expect(form.sources).toHaveLength(1)
  })
})

describe("slugify", () => {
  it("makes a handle out of a latin title", () => {
    expect(slugify("  Summer Sale 2026! ")).toBe("summer-sale-2026")
  })

  it("returns nothing for a title with no latin characters", () => {
    // Deliberate: the API transliterates the name in exactly this case, and a
    // handle of "-" would be worse than none.
    expect(slugify("تخفيضات الصيف")).toBe("")
  })
})
