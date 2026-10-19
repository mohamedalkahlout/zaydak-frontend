/**
 * The drip cone speaks in sample indexes. The shop cart speaks in product
 * ids. These slugs are the catalogue written for that template.
 */
export const DRIP_BUILDER_SLUG = "drip-gelato"

export const DRIP_FLAVOUR_SLUGS = [
  "drip-pistachio",
  "drip-stracciatella",
  "drip-fondente",
  "drip-fragola",
  "drip-saffron",
  "drip-date",
] as const

export const DRIP_CROWN_SLUGS: Record<string, string> = {
  pistachio: "drip-crown-pistachio",
  cocoa: "drip-crown-cocoa",
  rose: "drip-crown-rose",
}

/** Bundled topping sheets. A catalogue photo of one of these is the sprite, not a single bit. */
const CROWN_ATLAS_BY_SLUG: Record<string, string> = {
  "drip-crown-pistachio": "bits-pistachio",
  "drip-crown-cocoa": "bits-cocoa",
  "drip-crown-rose": "bits-rose",
}

const CROWN_ATLAS_BY_NAME: Record<string, string> = {
  "pistachio crumble": "bits-pistachio",
  "فتات فستق": "bits-pistachio",
  "chocolate shards": "bits-cocoa",
  "قطع شوكولاتة": "bits-cocoa",
  "rose petals": "bits-rose",
  "بتلات ورد": "bits-rose",
}

export type DripOrderLine = {
  scoops: number[]
  crowns: string[]
  quantity: number
  vessel: "cone" | "cup"
}

/** Group keys and part ids from `storefrontProductComposition`. */
export type DripCompositionBinding = {
  flavourKey: string
  flavourIds: readonly string[]
  crownKey: string | null
}

type CompositionPart = {
  product_id: string
  addon_cents: number
  cutout_url?: string | null
  image_url?: string | null
  name?: unknown
}

type CompositionGroup = {
  key: string
  priced_by_ladder: boolean
  addon_cents: number
  parts: CompositionPart[]
}

export type StorefrontComposition = {
  min_count: number
  max_count: number
  vessel_cap: number
  price_ladder_cents: number[]
  groups: CompositionGroup[]
}

const SCOOP_COLORS = [
  { bg: "#D5E0B5", deep: "#A9B56B", ink: "#1F2B16" },
  { bg: "#EFE8DA", deep: "#CDBFA6", ink: "#24160E" },
  { bg: "#D9B495", deep: "#6B3F2A", ink: "#24120A" },
  { bg: "#F5C8CE", deep: "#DC6E7E", ink: "#36101A" },
  { bg: "#F6D98C", deep: "#E3A91F", ink: "#332006" },
  { bg: "#E6CEAE", deep: "#9A6A40", ink: "#2B190B" },
]

function partName(name: unknown, lang: "en" | "ar"): string {
  if (typeof name === "string") return name
  if (!name || typeof name !== "object") return ""
  const row = name as Record<string, unknown>
  const value = row[lang] ?? row.en ?? row.ar
  return typeof value === "string" ? value.trim() : ""
}

function major(cents: number): number {
  return Math.round(cents / 100)
}

/**
 * Known drip toppings ship as sprite sheets. Painting that sheet as one
 * thumbnail hides the bits. A merchant cut-out is a single piece and stays
 * a photo. `bySlug` is slug → product id, the same map checkout already holds.
 */
function crownAtlas(
  part: CompositionPart,
  en: string,
  ar: string,
  bySlug?: ReadonlyMap<string, string>,
): string | undefined {
  if (part.cutout_url) return undefined
  if (bySlug) {
    for (const [slug, id] of bySlug) {
      if (id !== part.product_id) continue
      const fromSlug = CROWN_ATLAS_BY_SLUG[slug]
      if (fromSlug) return fromSlug
    }
  }
  return CROWN_ATLAS_BY_NAME[en.trim().toLowerCase()] ?? CROWN_ATLAS_BY_NAME[ar.trim()]
}

/**
 * The cone's flavours, crowns and prices from one assembled product.
 * A flavour cut-out wins over its catalogue photo. A known topping whose
 * photo is the sprite sheet is named as that atlas, so the cone scatters
 * bits instead of shrinking the whole sheet into one chip. Null when there
 * is nothing to stack.
 */
export function dripCatalogueFromComposition(
  row: StorefrontComposition | null | undefined,
  bySlug?: ReadonlyMap<string, string>,
) {
  if (!row || row.groups.length === 0) return null
  const ladder = row.groups.find((group) => group.priced_by_ladder) ?? row.groups[0]
  if (!ladder || ladder.parts.length === 0) return null
  const crowns = row.groups.filter((group) => group !== ladder)
  const crownGroup = crowns[0] ?? null
  const flavours = ladder.parts.map((part, index) => {
    const color = SCOOP_COLORS[index % SCOOP_COLORS.length]!
    const en = partName(part.name, "en") || part.product_id
    const ar = partName(part.name, "ar") || en
    const photo = part.cutout_url || part.image_url || ""
    return {
      id: part.product_id,
      img: photo,
      cutout: photo || undefined,
      ratio: 1,
      ...color,
      en: { name: en, word: en.toUpperCase(), note: "", tags: [] as string[] },
      ar: { name: ar, word: ar, note: "", tags: [] as string[] },
    }
  })
  const crownParts = crownGroup?.parts ?? []
  const crownById: Record<string, number> = {}
  const crownRows = crownParts.map((part) => {
    const cents = part.addon_cents > 0 ? part.addon_cents : (crownGroup?.addon_cents ?? 0)
    crownById[part.product_id] = major(cents)
    const en = partName(part.name, "en") || part.product_id
    const ar = partName(part.name, "ar") || en
    const photo = part.cutout_url || part.image_url || ""
    const atlas = crownAtlas(part, en, ar, bySlug)
    return {
      id: part.product_id,
      ...(atlas ? { atlas } : { src: photo || undefined }),
      en,
      ar,
    }
  })
  const scoops = row.price_ladder_cents.map(major)
  while (scoops.length < row.max_count + 1) scoops.push(scoops[scoops.length - 1] ?? 0)
  const binding: DripCompositionBinding = {
    flavourKey: ladder.key,
    flavourIds: flavours.map((flavour) => flavour.id),
    crownKey: crownGroup?.key ?? null,
  }
  return {
    catalogue: {
      flavours,
      crowns: crownRows,
      price: {
        scoops,
        crown: crownRows[0] ? crownById[crownRows[0].id] ?? 0 : 0,
        crownById,
      },
      vesselCap: row.vessel_cap,
      maxCount: row.max_count,
    },
    binding,
  }
}

/**
 * One bag line as the composition the cart prices. Flavour order is kept.
 * Crowns are sorted, the same way the server canonicalises an add-on group.
 * A missing product is null so the caller does not send a half-built cone.
 */
export function dripComposition(
  line: DripOrderLine,
  bySlug: ReadonlyMap<string, string>,
  binding?: DripCompositionBinding | null,
): { parts: Record<string, string[]>; vessel: "cone" | "cup" } | null {
  if (!line.scoops.length || line.quantity < 1) return null
  const flavourKey = binding?.flavourKey ?? "flavour"
  const crownKey = binding?.crownKey ?? "crown"
  const flavour: string[] = []
  for (const index of line.scoops) {
    const id = binding
      ? binding.flavourIds[index]
      : DRIP_FLAVOUR_SLUGS[index]
        ? bySlug.get(DRIP_FLAVOUR_SLUGS[index])
        : undefined
    if (!id) return null
    flavour.push(id)
  }
  const crown: string[] = []
  for (const key of line.crowns) {
    const id = binding ? key : DRIP_CROWN_SLUGS[key] ? bySlug.get(DRIP_CROWN_SLUGS[key]) : undefined
    if (!id) return null
    crown.push(id)
  }
  crown.sort()
  const parts: Record<string, string[]> = { [flavourKey]: flavour }
  if (crown.length && crownKey) parts[crownKey] = crown
  return {
    parts,
    vessel: line.vessel === "cup" ? "cup" : "cone",
  }
}

/** A cart row the bag can draw. `composition` is the JSON the server stored. */
export type DripCartLineSource = {
  id: string
  product_id: string
  quantity: number
  total_price_cents: number
  composition?: unknown
}

/** One server line, in the indexes the cone already uses. */
export type DripServerBagLine = {
  id: string
  scoops: number[]
  crowns: string[]
  quantity: number
  vessel: "cone" | "cup"
  totalCents: number
}

function compositionRecord(
  raw: unknown,
): { parts: Record<string, string[]>; vessel: "cone" | "cup" } | null {
  let value = raw
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const partsRaw = row.parts
  if (!partsRaw || typeof partsRaw !== "object" || Array.isArray(partsRaw)) return null
  const parts: Record<string, string[]> = {}
  for (const [key, list] of Object.entries(partsRaw)) {
    if (!Array.isArray(list)) continue
    const ids = list.filter((id): id is string => typeof id === "string" && id.length > 0)
    if (ids.length > 0) parts[key] = ids
  }
  return { parts, vessel: row.vessel === "cup" ? "cup" : "cone" }
}

/**
 * Cart rows for the builder, as bag lines. Flavour order is the stored
 * order. A part id the assembly no longer has is left out of the drawing;
 * the row stays, so checkout and the bag still name the same line.
 * Anything that is not the builder product is not a cone and is skipped.
 */
export function dripBagLinesFromCart(
  items: readonly DripCartLineSource[],
  builderId: string,
  binding: DripCompositionBinding,
): DripServerBagLine[] {
  const lines: DripServerBagLine[] = []
  for (const item of items) {
    if (item.product_id !== builderId || item.quantity < 1) continue
    const composition = compositionRecord(item.composition)
    const flavourIds = composition?.parts[binding.flavourKey] ?? []
    const scoops: number[] = []
    for (const id of flavourIds) {
      const index = binding.flavourIds.indexOf(id)
      if (index >= 0) scoops.push(index)
    }
    const crownIds = binding.crownKey ? (composition?.parts[binding.crownKey] ?? []) : []
    lines.push({
      id: item.id,
      scoops,
      crowns: [...crownIds].sort(),
      quantity: item.quantity,
      vessel: composition?.vessel === "cup" ? "cup" : "cone",
      totalCents: item.total_price_cents,
    })
  }
  return lines
}
