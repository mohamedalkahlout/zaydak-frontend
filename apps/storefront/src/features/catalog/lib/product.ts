import type { StorefrontProductsQuery } from "@/shared/api/generated/graphql"
import { text } from "@/shared/lib/multilang"

export type ProductCard = StorefrontProductsQuery["storefrontProducts"]["data"][number]

/**
 * How a product's price is *displayed*, resolved once so no component re-derives
 * it.
 *
 * The back-end sends four price fields and they do not all mean the same thing:
 *
 *  - `selling_price_cents` — what the customer pays. Already resolves the sale.
 *  - `compare_at_price_cents` — the strikethrough "was", non-null only when a
 *    sale is genuinely active.
 *  - `min_price_cents` / `max_price_cents` — the span across a VARIABLE
 *    product's variations, which is the only honest thing to show before an
 *    option is chosen.
 *
 * A `VARIABLE` product therefore renders as a *range*, and a card that showed
 * its `price_cents` instead would be quoting the parent row's price, which is
 * not a price anyone can buy at.
 */
export type PriceDisplay =
  | { kind: "single"; sellingCents: number; compareAtCents: number | null }
  | { kind: "range"; minCents: number; maxCents: number }
  | { kind: "unpriced" }

export function priceDisplay(product: {
  product_type: string
  price_cents?: number | null
  selling_price_cents?: number | null
  compare_at_price_cents?: number | null
  min_price_cents?: number | null
  max_price_cents?: number | null
}): PriceDisplay {
  const min = product.min_price_cents
  const max = product.max_price_cents

  // A range is only worth showing when the ends actually differ — a variable
  // product whose variations are all the same price reads better as one price.
  if (
    product.product_type === "VARIABLE" &&
    typeof min === "number" &&
    typeof max === "number" &&
    max > min
  ) {
    return { kind: "range", minCents: min, maxCents: max }
  }

  const selling =
    product.selling_price_cents ??
    (product.product_type === "VARIABLE" ? min : null) ??
    product.price_cents

  if (typeof selling !== "number") return { kind: "unpriced" }

  return {
    kind: "single",
    sellingCents: selling,
    compareAtCents: product.compare_at_price_cents ?? null,
  }
}

export type StockState = "in_stock" | "low_stock" | "out_of_stock" | "backorder"

/**
 * The stock state a customer should be told about.
 *
 * `in_stock` from the API is the authority on whether a *tracked* product is
 * buyable, but it collapses two cases the shopper needs kept apart: genuinely
 * on the shelf, and out of stock but sellable anyway because the vendor set
 * `continue_selling_when_out_of_stock`. Calling the second one "in stock" is a
 * promise about delivery time the shop has not made. An untracked product
 * ignores the flag: turning tracking off does not clear it.
 *
 * `LOW_STOCK_THRESHOLD` matches the back-end's `lowStockProducts` default of
 * 10, so the storefront's "only N left" and the vendor's low-stock report agree
 * about what low means.
 *
 * **`quantity` here is what can be bought, not what is on the shelf.** The
 * public mapper subtracts `reserved_quantity` before the field leaves the API,
 * because it did not always: a product with five in stock and four held in
 * other carts rendered "Only 5 left" beside a live Add-to-cart, and the fifth
 * shopper to believe it found out at checkout. Nothing here needs to subtract
 * anything, and nothing here should start.
 */
export const LOW_STOCK_THRESHOLD = 10

export function stockState(product: {
  in_stock: boolean
  quantity: number
  track_quantity: boolean
  continue_selling_when_out_of_stock: boolean
}): StockState {
  // Not tracking means the quantity is not a reason to refuse the sale.
  // `in_stock` is left as it was the last time tracking was on, so a product
  // that sat at zero and then had tracking turned off still carries `false`.
  // Reading that flag first labelled every such product "Out of stock".
  if (!product.track_quantity) return "in_stock"
  if (!product.in_stock) return "out_of_stock"
  if (product.quantity <= 0) {
    return product.continue_selling_when_out_of_stock ? "backorder" : "out_of_stock"
  }
  if (product.quantity <= LOW_STOCK_THRESHOLD) return "low_stock"
  return "in_stock"
}

/** Whether an Add-to-cart button should be live. */
export function isPurchasable(product: {
  in_stock: boolean
  quantity: number
  track_quantity: boolean
  continue_selling_when_out_of_stock: boolean
}): boolean {
  return stockState(product) !== "out_of_stock"
}

/**
 * The cap on a quantity stepper.
 *
 * `null` means uncapped — either the vendor is not tracking quantity or they
 * accept backorders, and in both cases the server is the only thing entitled to
 * say no. Guessing a cap here would refuse a sale the shop wanted to make.
 */
export function maxOrderableQuantity(product: {
  quantity: number
  track_quantity: boolean
  continue_selling_when_out_of_stock: boolean
}): number | null {
  if (!product.track_quantity) return null
  if (product.continue_selling_when_out_of_stock) return null
  return Math.max(product.quantity, 0)
}

/**
 * A description flattened for a tile's two-line clamp.
 *
 * The product page renders the description with `whitespace-pre-line`, so a
 * vendor's paragraph breaks survive there. A tile has room for two lines and
 * clamps them, and a leading blank line or a break after the first sentence
 * would spend one of those two on nothing — so every run of whitespace
 * collapses to a single space first.
 */
export function cardExcerpt(description: unknown, locale: string): string {
  return text(description, locale).replace(/\s+/g, " ").trim()
}

/**
 * The ground an image-less product is drawn on.
 *
 * A vendor who has not photographed a product still has a product, and a
 * catalogue of them rendered as identical dark slabs reads as a broken page
 * rather than an unphotographed one. Each tile instead gets one of the three
 * `--shop-tile-*` pairs the collection bento already uses, so a grid of them
 * looks composed instead of empty.
 *
 * **The choice is derived from the id, not random.** The same product is the
 * same colour on the home page, in the catalogue and after a re-render, which
 * is the whole difference between a design and a flicker. The hash is a small
 * FNV-1a over the id: it only has to spread three ways, and a cryptographic
 * one would be a strange thing to pay for on every tile.
 */
export const CARD_TINTS = [
  "bg-shop-tile-1 text-shop-tile-1-ink",
  "bg-shop-tile-2 text-shop-tile-2-ink",
  "bg-shop-tile-3 text-shop-tile-3-ink",
] as const

export function cardTint(id: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return CARD_TINTS[Math.abs(hash) % CARD_TINTS.length]!
}
