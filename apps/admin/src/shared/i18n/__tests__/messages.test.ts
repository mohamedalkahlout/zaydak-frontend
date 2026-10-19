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
    const placeholders = (value: unknown) =>
      typeof value === "string"
        ? (value.match(/\{(\w+)\}/g) ?? []).sort()
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
