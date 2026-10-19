/**
 * Frontend ShopifyQL parser round-trip suite.
 *
 * The frontend parser is a mirror of the backend's — we test the same
 * canonical inputs as `back-end/.../parser.spec.ts` to lock the
 * round-trip property: `serialize(parse(s)) === canonical(s)`.
 */

import { describe, it, expect } from "vitest"
import {
  parseShopifyQL,
  serializeShopifyQL,
  ParserError,
  LexerError,
  isCondition,
  isAnd,
  isOr,
} from "@/features/segments/lib/shopifyql"
import { DRIFT_CORPUS } from "@/features/segments/lib/shopifyql/__fixtures__/drift-corpus"

describe("parseShopifyQL — round-trip", () => {
  // Every entry in DRIFT_CORPUS is also round-tripped by the backend
  // parser.spec.ts. If one side starts producing different canonical
  // output for any of these inputs, both suites will surface the drift
  // immediately. See `__fixtures__/drift-corpus.ts` for rationale.
  it.each(DRIFT_CORPUS as unknown as Array<[string, string]>)(
    "round-trips: %s",
    (input, expected) => {
      const ast = parseShopifyQL(input)
      expect(serializeShopifyQL(ast)).toBe(expected)
    },
  )

  it("parses a single condition into a leaf node", () => {
    const ast = parseShopifyQL("amount_spent > 100")
    expect(isCondition(ast)).toBe(true)
  })

  it("parses AND chain into a flat and-expr", () => {
    const ast = parseShopifyQL("a > 1 AND b > 2 AND c > 3")
    expect(isAnd(ast)).toBe(true)
    if (isAnd(ast)) expect(ast.children).toHaveLength(3)
  })

  it("parses OR chain into a flat or-expr", () => {
    const ast = parseShopifyQL("a > 1 OR b > 2")
    expect(isOr(ast)).toBe(true)
  })

  it("throws ParserError on an empty operator slot", () => {
    expect(() => parseShopifyQL("amount_spent")).toThrow(ParserError)
  })

  it("throws ParserError on extra trailing input", () => {
    expect(() => parseShopifyQL("a > 1 garbage")).toThrow(ParserError)
  })

  it("throws LexerError on an unterminated string", () => {
    expect(() => parseShopifyQL("a = 'unterminated")).toThrow(LexerError)
  })
})
