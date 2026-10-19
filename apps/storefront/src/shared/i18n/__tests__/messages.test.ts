import { describe, expect, it } from "vitest"

import ar from "../../messages/ar.json"
import en from "../../messages/en.json"

type Catalog = Record<string, unknown>

/** Flattens `{a: {b: 1}}` to `["a.b"]` so the two catalogs compare key-for-key. */
function flatten(node: Catalog, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? flatten(value as Catalog, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

describe("i18n catalogs", () => {
  const enKeys = flatten(en).sort()
  const arKeys = flatten(ar).sort()

  it("English and Arabic define exactly the same keys", () => {
    expect(arKeys).toEqual(enKeys)
  })

  it("has no empty strings — a blank value renders as a blank UI label", () => {
    const empty = (catalog: Catalog, locale: string) =>
      JSON.stringify(catalog).includes('""') ? locale : null

    expect([empty(en, "en"), empty(ar, "ar")].filter(Boolean)).toEqual([])
  })

  it("keeps every ICU placeholder identical across locales", () => {
    /**
     * ICU *argument* names, which is not the same thing as "every `{word}` in
     * the string".
     *
     * A plural branch body is also brace-wrapped — `{count, plural, one
     * {product} other {products}}` contains three pairs of braces and exactly
     * one argument. Matching `\{(\w+)\}` counted `{product}` as a placeholder,
     * which made an English branch of a single bare word look like an argument
     * Arabic had failed to translate, while a genuine mismatch *inside* a
     * plural went unnoticed because `{count, plural,` never matched at all.
     *
     * So: take `{name}` and `{name, ...}`, and exclude any brace that follows a
     * plural/select selector. Capturing the name rather than the whole match is
     * what lets `{count}` and `{count, plural, ...}` compare equal — the
     * question is which values a string interpolates, not how it formats them.
     */
    // The word boundary guards only the keyword alternatives: `=0` is preceded
    // by a space, and a space-to-`=` transition is not a `\b`, so a leading
    // `\b` would silently stop `=0 {Empty}` being recognised as a branch.
    const ARGUMENT =
      /(?<!(?:\b(?:zero|one|two|few|many|other)|=\d+)\s)\{\s*(\w+)\s*[,}]/g

    const placeholders = (value: unknown) =>
      typeof value === "string"
        ? [...value.matchAll(ARGUMENT)].map((match) => match[1]).sort()
        : []

    const walk = (node: Catalog, prefix = ""): Array<[string, string[]]> =>
      Object.entries(node).flatMap(([key, value]) =>
        value !== null && typeof value === "object"
          ? walk(value as Catalog, `${prefix}${key}.`)
          : [[`${prefix}${key}`, placeholders(value)] as [string, string[]]],
      )

    const enPlaceholders = new Map(walk(en))
    for (const [key, arValue] of walk(ar)) {
      expect({ key, placeholders: arValue }).toEqual({
        key,
        placeholders: enPlaceholders.get(key),
      })
    }
  })
})
