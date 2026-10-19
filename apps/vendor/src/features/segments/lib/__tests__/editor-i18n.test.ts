/**
 * The ShopifyQL editor's own words — lint diagnostics and autocomplete
 * descriptions — come from the message catalogue, while the engine that
 * produces them stays byte-for-byte identical to the back-end copy (English
 * messages, no keys). These pin the seam between the two: every message the
 * engine throws is recognised and worded in Arabic, the English wording is
 * exactly what the engine wrote, and every description key exists.
 */

import { describe, expect, it } from "vitest"
import { createTranslator } from "next-intl"
import ar from "@/shared/messages/ar"
import { enTranslator } from "@/shared/test/next-intl"
import {
  LexerError,
  ParserError,
  parseShopifyQL,
} from "@/features/segments/lib/shopifyql"
import { describeEngineError } from "../shopifyql/cm-linter"
import { analyzeContext } from "../autocomplete"
import type { FilterCatalogEntry } from "../../types"

function arTranslator(namespace: string) {
  return createTranslator({
    locale: "ar",
    messages: ar as Parameters<typeof createTranslator>[0]["messages"],
    namespace: namespace as never,
  }) as unknown as (key: string, values?: Record<string, unknown>) => string
}

function engineError(source: string): ParserError | LexerError {
  try {
    parseShopifyQL(source)
  } catch (err) {
    if (err instanceof ParserError || err instanceof LexerError) return err
    throw err
  }
  throw new Error(`expected "${source}" not to parse`)
}

const ARABIC = /[؀-ۿ]/

// One input per message the engine can reach.
const BROKEN_QUERIES = [
  "a > 1 garbage",
  "(a > 1",
  "> 1",
  "a IS 1",
  "a BETWEEN 1 2",
  "a NOT 1",
  "amount_spent",
  "a = )",
  "a = (1, 2",
  "a IN 1",
  "a IN (1, 2",
  "a MATCHES 1",
  "a MATCHES (count > 1",
  "a MATCHES (1)",
  "a ! 1",
  "a = #",
  "a = 'unterminated",
]

describe("lint diagnostics", () => {
  const en = enTranslator("segments.diagnostics")
  const arT = arTranslator("segments.diagnostics")

  it.each(BROKEN_QUERIES)("reads %s exactly as the engine wrote it in English", (source) => {
    const err = engineError(source)
    expect(describeEngineError(err, en)).toBe(err.message)
  })

  it.each(BROKEN_QUERIES)("words %s in Arabic, keeping the column and token", (source) => {
    const err = engineError(source)
    const message = describeEngineError(err, arT)
    expect(message).not.toBe(err.message)
    expect(message).toMatch(ARABIC)
    expect(message).toContain(String(err.column))
  })

  it("carries the offending token into the Arabic message", () => {
    const err = engineError("a = #")
    expect(describeEngineError(err, arT)).toContain("'#'")
  })

  it("falls back to the engine's text for a message it does not know", () => {
    const err = new ParserError("something new", 3)
    expect(describeEngineError(err, arT)).toBe(err.message)
  })
})

describe("autocomplete description keys", () => {
  const CATALOG: FilterCatalogEntry[] = [
    {
      field: "orders_count",
      description: "Orders",
      valueKind: "number",
      allowedOperators: [],
      enumValues: [],
      cost: "low",
    },
  ]

  it("names a message for every operator and for AND / OR", () => {
    const en = enTranslator("segments.autocomplete")
    const arT = arTranslator("segments.autocomplete")
    // A field the catalogue does not describe gets every operator.
    const operators = analyzeContext("unknown_field ", 14, CATALOG).suggestions
    const logic = analyzeContext("orders_count > 1 ", 17, CATALOG).suggestions
    const keyed = [...operators, ...logic]

    expect(operators.length).toBe(15)
    expect(logic.map((s) => s.label)).toEqual(["AND", "OR"])
    for (const s of keyed) {
      expect(s.descriptionKey, s.label).toBeTruthy()
      expect(en(s.descriptionKey!)).not.toContain("segments.autocomplete")
      expect(arT(s.descriptionKey!)).toMatch(ARABIC)
    }
    expect(en("operators.gte")).toBe("Greater or equal")
    expect(en("logic.and")).toBe("All conditions must match")
  })
})
