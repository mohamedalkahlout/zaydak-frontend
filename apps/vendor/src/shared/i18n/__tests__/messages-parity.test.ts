import { describe, it, expect } from "vitest"

// next-intl throws `MISSING_MESSAGE` at render for a key the active locale does
// not carry, which means a half-finished translation is invisible until someone
// switches to Arabic and walks onto the exact screen that lost a key. The two
// catalogues are meant to be the same tree with different leaves, so the cheap
// thing to assert is precisely that: same paths, same order, on both sides.

import { readdirSync } from "node:fs"
import { join } from "node:path"

import en from "@/shared/messages/en"
import ar from "@/shared/messages/ar"

// Each locale is a folder of one JSON file per namespace, assembled by its
// `index.ts`. A file written to the folder and never imported by the index is
// the quiet failure of that layout: it type-checks, it lints, and every key in
// it is missing at runtime. So the folder is compared with the index too.
const MESSAGES_DIR = join(__dirname, "..", "..", "messages")
const namespaceFiles = (locale: string) =>
  readdirSync(join(MESSAGES_DIR, locale))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -".json".length))
    .sort()

type Catalog = { [key: string]: string | Catalog }

/**
 * Every leaf path in source order. Order matters as well as membership: the two
 * files are edited side by side, and a key appended to one but slotted into the
 * middle of the other is the diff nobody can read next time.
 */
function leafPaths(node: Catalog, prefix = ""): string[] {
  const out: string[] = []
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === "object") {
      out.push(...leafPaths(value, path))
    } else {
      out.push(path)
    }
  }
  return out
}

const enPaths = leafPaths(en as unknown as Catalog)
const arPaths = leafPaths(ar as unknown as Catalog)

describe("message catalogues", () => {
  it("import every namespace file in the folder, and one file per namespace", () => {
    expect(Object.keys(en).sort()).toEqual(namespaceFiles("en"))
    expect(Object.keys(ar).sort()).toEqual(namespaceFiles("ar"))
  })

  it("carry the same keys in the same order", () => {
    expect(arPaths).toEqual(enPaths)
  })

  it("names the keys either side is missing, rather than a length", () => {
    const inEn = new Set(enPaths)
    const inAr = new Set(arPaths)
    expect(enPaths.filter((p) => !inAr.has(p))).toEqual([])
    expect(arPaths.filter((p) => !inEn.has(p))).toEqual([])
  })

  it("leaves no message empty", () => {
    const blank = (catalog: Catalog, paths: string[]) =>
      paths.filter((path) => {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Catalog)?.[key],
            catalog,
          )
        return typeof value !== "string" || value.trim() === ""
      })

    expect(blank(en as unknown as Catalog, enPaths)).toEqual([])
    expect(blank(ar as unknown as Catalog, arPaths)).toEqual([])
  })
})
