/**
 * Tests for the context-aware autocomplete analyzer.
 *
 * The analyzer is a pure function — no React, no Apollo — so it can be
 * exercised with plain inputs and asserted on the returned context.
 *
 * Run: `npx vitest src/features/segments/lib/__tests__/autocomplete.test.ts`
 */

import { describe, expect, it } from "vitest"
import { analyzeContext } from "../autocomplete"
import type { FilterCatalogEntry } from "../../types"

const CATALOG: FilterCatalogEntry[] = [
  {
    field: "amount_spent",
    description: "Lifetime spend",
    valueKind: "number",
    allowedOperators: ["=", "!=", ">", ">=", "<", "<=", "BETWEEN"],
    enumValues: [],
    cost: "low",
  },
  {
    field: "predicted_spend_tier",
    description: "Predicted lifetime spend tier",
    valueKind: "string",
    allowedOperators: ["=", "!=", "IN", "NOT IN", "IS NULL", "IS NOT NULL"],
    enumValues: ["HIGH", "MEDIUM", "LOW"],
    cost: "low",
  },
  {
    field: "customer_tags",
    description: "Tags",
    valueKind: "string",
    allowedOperators: ["CONTAINS", "NOT CONTAINS", "IS NULL", "IS NOT NULL"],
    enumValues: [],
    cost: "low",
  },
  {
    field: "orders_placed",
    description: "Orders aggregation",
    valueKind: "function",
    allowedOperators: ["MATCHES", "NOT MATCHES"],
    enumValues: [],
    cost: "high",
  },
]

describe("analyzeContext", () => {
  // ─── empty / new-condition cases ─────────────────────────────────

  it("returns field suggestions for empty input", () => {
    const ctx = analyzeContext("", 0, CATALOG)
    expect(ctx.kind).toBe("field")
    expect(ctx.suggestions.map((s) => s.label)).toEqual(
      expect.arrayContaining(["amount_spent", "predicted_spend_tier"]),
    )
  })

  it("returns field suggestions after AND", () => {
    const text = "amount_spent > 100 AND "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("field")
  })

  it("returns field suggestions after OR", () => {
    const text = "amount_spent > 100 OR "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("field")
  })

  it("filters field suggestions by partial prefix", () => {
    const text = "predict"
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("field")
    expect(ctx.suggestions[0].label).toBe("predicted_spend_tier")
  })

  // ─── operator slot ───────────────────────────────────────────────

  it("returns operator suggestions after a field name", () => {
    const text = "predicted_spend_tier "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("operator")
    expect(ctx.fieldName).toBe("predicted_spend_tier")
    expect(ctx.suggestions.map((s) => s.label)).toEqual(
      expect.arrayContaining(["=", "!=", "IN", "IS NULL"]),
    )
  })

  it("excludes operators not allowed for the field", () => {
    const text = "customer_tags "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("operator")
    const labels = ctx.suggestions.map((s) => s.label)
    expect(labels).toEqual(expect.arrayContaining(["CONTAINS", "NOT CONTAINS"]))
    expect(labels).not.toContain(">")
    expect(labels).not.toContain("BETWEEN")
  })

  // ─── value slot ──────────────────────────────────────────────────

  it("returns enum values after =' for enum field", () => {
    const text = "predicted_spend_tier = "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("value")
    expect(ctx.suggestions.map((s) => s.label)).toEqual(["HIGH", "LOW", "MEDIUM"])
    // Insertion wraps with quotes since we're not inside a string
    expect(ctx.suggestions[0].insert).toBe("'HIGH'")
    expect(ctx.needsQuoting).toBe(true)
  })

  it("returns enum values inside an opened string literal", () => {
    const text = "predicted_spend_tier = '"
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("value")
    expect(ctx.needsQuoting).toBe(false)
    // Inside a string, we insert just the value (the user already has '
    // open).
    expect(ctx.suggestions[0].insert).toBe("HIGH")
  })

  it("filters enum values by partial prefix mid-string", () => {
    const text = "predicted_spend_tier = 'HI"
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("value")
    expect(ctx.suggestions.map((s) => s.label)).toEqual(["HIGH"])
  })

  it("returns enum values inside IN (...) list", () => {
    const text = "predicted_spend_tier IN ("
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("value")
    expect(ctx.suggestions.map((s) => s.label)).toEqual(["HIGH", "LOW", "MEDIUM"])
  })

  it("returns no enum suggestions for non-enum field value position", () => {
    const text = "amount_spent > "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("value")
    expect(ctx.suggestions).toHaveLength(0)
  })

  // ─── logic slot (AND/OR) ─────────────────────────────────────────

  it("returns AND/OR after a complete condition", () => {
    const text = "amount_spent > 100 "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("logic")
    expect(ctx.suggestions.map((s) => s.label)).toEqual(["AND", "OR"])
  })

  it("returns AND/OR after IS NULL (no value needed)", () => {
    const text = "predicted_spend_tier IS NULL "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("logic")
  })

  it("returns AND/OR after a complete string value", () => {
    const text = "customer_tags CONTAINS 'VIP' "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("logic")
  })

  // ─── multi-word operator handling ────────────────────────────────

  it("detects NOT IN as one operator", () => {
    const text = "predicted_spend_tier NOT IN ("
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("value")
    expect(ctx.operator).toBe("NOT IN")
  })

  it("detects IS NOT NULL as one operator", () => {
    const text = "predicted_spend_tier IS NOT NULL "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("logic")
  })

  // ─── function-style filters (MATCHES) ────────────────────────────

  it("returns function-arg keys inside MATCHES (...)", () => {
    const text = "orders_placed MATCHES ("
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("value")
    expect(ctx.suggestions.map((s) => s.label)).toEqual(
      expect.arrayContaining(["count", "sum_amount", "date"]),
    )
  })

  // ─── click-to-replace (cursor inside a token) ────────────────────

  it("exposes tokenStart/tokenEnd so caller can replace full token", () => {
    // Cursor inside "MATCHES"
    const text = "orders_placed MATCHES (count >= 3)"
    const cursor = "orders_placed MAT".length // cursor in the middle of MATCHES
    const ctx = analyzeContext(text, cursor, CATALOG)
    expect(ctx.kind).toBe("operator")
    expect(ctx.tokenStart).toBe("orders_placed ".length)
    expect(ctx.tokenEnd).toBe("orders_placed MATCHES".length)
    expect(ctx.prefix).toBe("MAT")
  })

  it("click inside an enum string token sees its enum prefix", () => {
    const text = "predicted_spend_tier = 'MEDIUM'"
    const cursor = "predicted_spend_tier = 'MED".length
    const ctx = analyzeContext(text, cursor, CATALOG)
    expect(ctx.kind).toBe("value")
    expect(ctx.prefix).toBe("MED")
    expect(ctx.suggestions.map((s) => s.label)).toEqual(["MEDIUM"])
  })

  // ─── precedence + grouping ───────────────────────────────────────

  it("returns AND/OR even after nested condition closes its paren", () => {
    const text = "(amount_spent > 100 OR amount_spent < 50) "
    const ctx = analyzeContext(text, text.length, CATALOG)
    expect(ctx.kind).toBe("logic")
  })
})
