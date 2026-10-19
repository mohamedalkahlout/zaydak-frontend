import { describe, it, expect } from "vitest"

// Indexing the flat taxonomy so the picker can walk it a level at a time.
//
// The whole drill-down rests on this: `systemCategoriesFlat` hands over ~5,600
// nodes with `parent_id`, and everything the browser needs — what is at this
// level, does this row go deeper, where am I — is read from the index built
// once from that list.

import {
  ancestorChain,
  buildCategoryIndex,
} from "@/features/products/lib/form/category-tree"
import type { SystemCategory } from "@/features/products/types"

const node = (
  id: string,
  name: string,
  parent_id: string | null,
  level: number,
): SystemCategory => ({
  id,
  name,
  parent_id,
  level,
  slug: id,
  path: id,
})

//  apparel ─ clothing ─ shirts
//          └ shoes
//  food
const NODES: SystemCategory[] = [
  node("apparel", "Apparel & Accessories", null, 0),
  node("clothing", "Clothing", "apparel", 1),
  node("shirts", "Shirts & Tops", "clothing", 2),
  node("shoes", "Shoes", "apparel", 1),
  node("food", "Food, Beverages & Tobacco", null, 0),
]

describe("buildCategoryIndex", () => {
  it("puts the roots where a null parent asks for them", () => {
    const index = buildCategoryIndex(NODES)

    expect(index.childrenOf(null).map((n) => n.id)).toEqual(["apparel", "food"])
  })

  it("keeps a level in the order the server sent it", () => {
    // That order is the taxonomy's own `sort_order`. Sorting alphabetically
    // here would look tidier and quietly disagree with every other surface
    // rendering the same tree.
    const index = buildCategoryIndex(NODES)

    expect(index.childrenOf("apparel").map((n) => n.name)).toEqual([
      "Clothing",
      "Shoes",
    ])
  })

  it("knows which rows go deeper — the thing a click depends on", () => {
    const index = buildCategoryIndex(NODES)

    // A row with children drills; a leaf selects. Getting this wrong assigns
    // "Clothing" to a product on its way to "Shirts & Tops".
    expect(index.hasChildren("clothing")).toBe(true)
    expect(index.hasChildren("shirts")).toBe(false)
    expect(index.hasChildren("food")).toBe(false)
  })

  it("answers for a node that is not in the taxonomy at all", () => {
    const index = buildCategoryIndex(NODES)

    expect(index.byId("nope")).toBeUndefined()
    expect(index.hasChildren("nope")).toBe(false)
    expect(index.childrenOf("nope")).toEqual([])
  })
})

describe("ancestorChain", () => {
  it("returns the drill path that would have reached the node", () => {
    const index = buildCategoryIndex(NODES)

    expect(ancestorChain(index, "shirts").map((n) => n.id)).toEqual([
      "apparel",
      "clothing",
      "shirts",
    ])
  })

  it("is just the node itself at the top of the tree", () => {
    const index = buildCategoryIndex(NODES)

    expect(ancestorChain(index, "apparel").map((n) => n.id)).toEqual(["apparel"])
  })

  it("is empty for nothing selected, so the picker opens at the roots", () => {
    const index = buildCategoryIndex(NODES)

    expect(ancestorChain(index, undefined)).toEqual([])
    expect(ancestorChain(index, "")).toEqual([])
    expect(ancestorChain(index, "nope")).toEqual([])
  })

  it("does not hang on a cycle", () => {
    // The taxonomy is seeded data, and a bad import could in principle produce
    // one. A hung render is a worse failure than a wrong breadcrumb.
    const index = buildCategoryIndex([
      node("a", "A", "b", 0),
      node("b", "B", "a", 0),
    ])

    expect(ancestorChain(index, "a").map((n) => n.id)).toEqual(["b", "a"])
  })
})
