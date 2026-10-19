import type { StorefrontProductQuery } from "@/shared/api/generated/graphql"

export type ProductDetail = NonNullable<
  StorefrontProductQuery["storefrontProduct"]["data"]
>
export type Variation = NonNullable<ProductDetail["variation_options"]>[number]

/**
 * Matching an option selection to a variation.
 *
 * `PublicVariation.options` is a JSON blob the vendor's product form writes;
 * across the seeds and the admin it appears in two shapes — an object
 * (`{ Colour: "Red" }`) and an array of `{ name, value }` pairs. Both are live
 * in the database, so normalising here rather than picking one is not
 * defensiveness, it is the actual contract.
 *
 * Comparison is case-insensitive on the *value* and on the option *name*: the
 * option definition and the variation row are written by two different code
 * paths and only agree on spelling by convention.
 */
export type OptionSelection = Record<string, string>

function normalizeOptions(raw: unknown): OptionSelection {
  if (Array.isArray(raw)) {
    const entries: OptionSelection = {}
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue
      const record = item as Record<string, unknown>
      const name = record.name ?? record.key
      const value = record.value ?? record.label
      if (typeof name === "string" && typeof value === "string") {
        entries[name.toLowerCase()] = value.toLowerCase()
      }
    }
    return entries
  }

  if (typeof raw === "object" && raw !== null) {
    const entries: OptionSelection = {}
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") entries[name.toLowerCase()] = value.toLowerCase()
    }
    return entries
  }

  return {}
}

/** The variation whose options are exactly the given selection, or null. */
export function findVariation(
  variations: readonly Variation[],
  selection: OptionSelection,
): Variation | null {
  const wanted = Object.entries(selection).map(
    ([name, value]) => [name.toLowerCase(), value.toLowerCase()] as const,
  )
  if (wanted.length === 0) return null

  return (
    variations.find((variation) => {
      const options = normalizeOptions(variation.options)
      return wanted.every(([name, value]) => options[name] === value)
    }) ?? null
  )
}

/**
 * Which values of one option can still be reached, given what is already chosen.
 *
 * This is what greys out "XL" once "Red" is picked and the shop never made a red
 * XL. Without it the shopper picks a combination, gets no variation back and is
 * told nothing about why — the single most common way a variant picker feels
 * broken.
 */
export function reachableValues(
  variations: readonly Variation[],
  optionName: string,
  selection: OptionSelection,
): Set<string> {
  const key = optionName.toLowerCase()
  const others = Object.entries(selection)
    .filter(([name]) => name.toLowerCase() !== key)
    .map(([name, value]) => [name.toLowerCase(), value.toLowerCase()] as const)

  const reachable = new Set<string>()
  for (const variation of variations) {
    if (variation.is_disable) continue
    const options = normalizeOptions(variation.options)
    if (!others.every(([name, value]) => options[name] === value)) continue
    const own = options[key]
    if (own) reachable.add(own)
  }
  return reachable
}

/**
 * The variation a picker should start on.
 *
 * The first in-stock, enabled one by vendor `position` — so a product whose
 * first colour sold out opens on one the shopper can actually buy, and the
 * price on screen at first paint is a price that exists.
 */
export function defaultVariation(
  variations: readonly Variation[],
): Variation | null {
  const ordered = [...variations].sort((a, b) => a.position - b.position)
  return (
    ordered.find((v) => !v.is_disable && v.quantity > 0) ??
    ordered.find((v) => !v.is_disable) ??
    ordered[0] ??
    null
  )
}

/** The option map a variation represents, for seeding the picker from it. */
export function selectionOf(variation: Variation): OptionSelection {
  return normalizeOptions(variation.options)
}
