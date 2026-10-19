import { imageRef, text } from "@/shared/lib/multilang"

/**
 * Card poses from the hullo sample, so a shop menu keeps the window's tilt
 * and colour. The index wraps when the catalogue is longer than eight.
 */
const POSES = [
  { bg: "#BCD7EA", rotate: "-2.5deg", dy: "0px" },
  { bg: "#F3DC8C", rotate: "1.8deg", dy: "34px" },
  { bg: "#AEBB9C", rotate: "-1.2deg", dy: "8px" },
  { bg: "#E9C2A0", rotate: "2.6deg", dy: "46px" },
  { bg: "#F2B8B5", rotate: "1.4deg", dy: "-10px" },
  { bg: "#CDBDE6", rotate: "-2.2deg", dy: "26px" },
  { bg: "#E8DCC8", rotate: "2.1deg", dy: "-2px" },
  { bg: "#5A3D30", rotate: "-1.6deg", dy: "30px" },
] as const

export type HulloMenuItem = {
  id: string
  name: string
  blurb: string
  /** Major units, for the template's own receipt. Checkout is priced by the API. */
  price: number
  tags: string
  bg: string
  alt: string
  image: { src: string; width: number; height: number }
  rotate: string
  dy: string
  inStock: boolean
}

export type HulloMenuFilter = { id: string; label: string }

/** A cart row the hullo tray can draw. Money stays in cents. */
export type HulloTrayLine = {
  id: string
  name: string
  detail: string
  quantity: number
  totalCents: number
}

type CartRow = {
  id: string
  name: string
  variation_name?: string | null
  quantity: number
  total_price_cents: number
}

/**
 * Cart rows for the window tray. The quantity hook can still be showing
 * a tap the server has not confirmed; the money stays the server's.
 */
export function hulloLinesFromCart(
  items: readonly CartRow[],
  quantityOf: (id: string, quantity: number) => number = (_id, quantity) => quantity,
): HulloTrayLine[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    detail: item.variation_name?.trim() ?? "",
    quantity: quantityOf(item.id, item.quantity),
    totalCents: item.total_price_cents,
  }))
}

type MenuProduct = {
  id: string
  slug?: string | null
  name?: unknown
  description?: unknown
  image?: unknown
  price_cents?: number | null
  selling_price_cents?: number | null
  in_stock?: boolean | null
  tags?: Array<{ slug?: string | null; name?: unknown }> | null
}

/**
 * The window's cards from `storefrontProducts`. A row with no photo is
 * skipped. The price is the selling price in major units, the same scale
 * the template's tray already adds up. The order itself is priced later
 * by `addToCart`.
 */
export function hulloMenuFromProducts(products: readonly MenuProduct[], locale: string) {
  const filters = new Map<string, string>()
  const items: HulloMenuItem[] = []
  for (const product of products) {
    const photo = imageRef(product.image)?.original
    if (!photo) continue
    const pose = POSES[items.length % POSES.length]!
    const cents = product.selling_price_cents ?? product.price_cents ?? 0
    const slugs: string[] = []
    for (const tag of product.tags ?? []) {
      const slug = tag.slug?.trim()
      if (!slug || slugs.includes(slug)) continue
      slugs.push(slug)
      if (!filters.has(slug)) {
        filters.set(slug, text(tag.name, locale, slug))
      }
    }
    const name = text(product.name, locale) || product.slug || product.id
    items.push({
      id: product.id,
      name,
      blurb: text(product.description, locale),
      price: Math.round(cents / 100),
      tags: slugs.join(" "),
      bg: pose.bg,
      alt: name,
      image: { src: photo, width: 800, height: 800 },
      rotate: pose.rotate,
      dy: pose.dy,
      inStock: product.in_stock !== false,
    })
  }
  return {
    items,
    filters: [
      { id: "all", label: "all" },
      ...[...filters].map(([id, label]) => ({ id, label })),
    ] satisfies HulloMenuFilter[],
  }
}
