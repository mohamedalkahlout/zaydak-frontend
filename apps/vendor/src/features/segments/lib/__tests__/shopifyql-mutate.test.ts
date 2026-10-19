/**
 * Mutation-helpers suite — Phase 10A engine.
 *
 * These helpers are the bridge between the chip overlay and the AST.
 * We cover: flat addressing, replace/remove preserving
 * structure, hoisting a single survivor, top-logic flip, append into
 * different starting shapes.
 */

import { describe, it, expect } from "vitest"
import {
  parseShopifyQL,
  serializeShopifyQL,
  appendCondition,
  condition,
  field,
  flattenConditions,
  getTopLogic,
  num,
  removeConditionAt,
  replaceConditionAt,
  setTopLogic,
  str,
  canRenderAsChipStrip,
  isAnd,
  isCondition,
} from "@/features/segments/lib/shopifyql"

describe("flattenConditions", () => {
  it("returns one entry for a single condition", () => {
    const ast = parseShopifyQL("a > 1")
    const flat = flattenConditions(ast)
    expect(flat).toHaveLength(1)
    expect(flat[0].index).toBe(0)
  })

  it("enumerates left-to-right across an AND chain", () => {
    const ast = parseShopifyQL("a > 1 AND b > 2 AND c > 3")
    const flat = flattenConditions(ast)
    expect(flat.map((f) => f.condition.field.name)).toEqual(["a", "b", "c"])
  })

  it("flattens nested groups in source order", () => {
    const ast = parseShopifyQL(
      "(a > 1 OR b > 2) AND c > 3",
    )
    const flat = flattenConditions(ast)
    expect(flat.map((f) => f.condition.field.name)).toEqual(["a", "b", "c"])
  })
})

describe("replaceConditionAt", () => {
  it("swaps the middle condition leaving siblings intact", () => {
    const ast = parseShopifyQL("a > 1 AND b > 2 AND c > 3")
    const next = replaceConditionAt(
      ast,
      1,
      condition(field("b"), ">=", num(99)),
    )
    expect(serializeShopifyQL(next)).toBe("a > 1 AND b >= 99 AND c > 3")
  })

  it("swaps a nested condition without changing the group", () => {
    const ast = parseShopifyQL("(a > 1 OR b > 2) AND c > 3")
    const next = replaceConditionAt(
      ast,
      0,
      condition(field("a"), "=", num(99)),
    )
    expect(serializeShopifyQL(next)).toBe(
      "(a = 99 OR b > 2) AND c > 3",
    )
  })
})

describe("removeConditionAt", () => {
  it("hoists the survivor when removing one of two AND children", () => {
    const ast = parseShopifyQL("a > 1 AND b > 2")
    const next = removeConditionAt(ast, 0)
    expect(next).not.toBeNull()
    expect(isCondition(next!)).toBe(true)
    expect(serializeShopifyQL(next!)).toBe("b > 2")
  })

  it("preserves the AND when removing one of three children", () => {
    const ast = parseShopifyQL("a > 1 AND b > 2 AND c > 3")
    const next = removeConditionAt(ast, 1)!
    expect(isAnd(next)).toBe(true)
    expect(serializeShopifyQL(next)).toBe("a > 1 AND c > 3")
  })

  it("returns null when the last condition is removed", () => {
    const ast = parseShopifyQL("a > 1")
    expect(removeConditionAt(ast, 0)).toBeNull()
  })
})

describe("appendCondition", () => {
  it("returns the condition itself when the AST is null", () => {
    const next = appendCondition(null, condition(field("a"), ">", num(1)))
    expect(serializeShopifyQL(next)).toBe("a > 1")
  })

  it("wraps a single condition into AND when appending", () => {
    const ast = parseShopifyQL("a > 1")
    const next = appendCondition(
      ast,
      condition(field("b"), ">", num(2)),
    )
    expect(serializeShopifyQL(next)).toBe("a > 1 AND b > 2")
  })

  it("appends into an existing AND group flatly", () => {
    const ast = parseShopifyQL("a > 1 AND b > 2")
    const next = appendCondition(
      ast,
      condition(field("c"), ">", num(3)),
    )
    expect(serializeShopifyQL(next)).toBe("a > 1 AND b > 2 AND c > 3")
  })

  it("wraps into a new OR group when logic differs", () => {
    const ast = parseShopifyQL("a > 1 AND b > 2")
    const next = appendCondition(
      ast,
      condition(field("c"), ">", num(3)),
      "OR",
    )
    // The existing AND becomes one side of the new OR.
    expect(serializeShopifyQL(next)).toBe(
      "a > 1 AND b > 2 OR c > 3",
    )
  })
})

describe("setTopLogic", () => {
  it("flips AND to OR while preserving children", () => {
    const ast = parseShopifyQL("a > 1 AND b > 2")
    const next = setTopLogic(ast, "OR")
    expect(getTopLogic(next)).toBe("OR")
    expect(serializeShopifyQL(next)).toBe("a > 1 OR b > 2")
  })

  it("is a no-op on a single condition", () => {
    const ast = parseShopifyQL("a > 1")
    expect(setTopLogic(ast, "OR")).toBe(ast)
  })
})

describe("canRenderAsChipStrip", () => {
  it("accepts a single condition", () => {
    expect(canRenderAsChipStrip(parseShopifyQL("a > 1"))).toBe(true)
  })

  it("accepts a flat AND group", () => {
    expect(canRenderAsChipStrip(parseShopifyQL("a > 1 AND b > 2"))).toBe(true)
  })

  it("rejects a mixed AND-of-ORs group", () => {
    expect(
      canRenderAsChipStrip(parseShopifyQL("(a > 1 OR b > 2) AND c > 3")),
    ).toBe(false)
  })
})

describe("end-to-end edit scenarios", () => {
  it("rename → operator-swap → remove flow", () => {
    let ast = parseShopifyQL("amount_spent > 100 AND number_of_orders >= 5")
    // Swap the first condition's operator
    ast = replaceConditionAt(
      ast,
      0,
      condition(field("amount_spent"), ">=", num(100)),
    )
    expect(serializeShopifyQL(ast)).toBe(
      "amount_spent >= 100 AND number_of_orders >= 5",
    )
    // Remove the second condition — survivor is hoisted to a leaf
    const removed = removeConditionAt(ast, 1)!
    expect(serializeShopifyQL(removed)).toBe("amount_spent >= 100")
    // Append a new condition under OR
    const appended = appendCondition(
      removed,
      condition(field("customer_tags"), "CONTAINS", str("VIP")),
      "OR",
    )
    expect(serializeShopifyQL(appended)).toBe(
      "amount_spent >= 100 OR customer_tags CONTAINS 'VIP'",
    )
  })
})
