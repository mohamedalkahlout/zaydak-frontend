import { discountPercent } from "@/shared/lib/format"
import {
  isPurchasable,
  priceDisplay,
  type ProductCard,
} from "@/features/catalog/lib/product"

/**
 * The markdown strip's selection, done on the client — because the API cannot
 * do it.
 *
 * `ProductFilterInput` has no "on sale" predicate. Its `sale_types` field looks
 * like one and is not: it filters the sale *mechanism* (`FIXED_PRICE` /
 * `NEGOTIABLE` / `AUCTION`), not whether a price has been cut. So the only
 * honest way to build a deals row without adding a back-end is to ask for a
 * page of products and keep the ones carrying a genuine markdown.
 *
 * That is a real limitation and worth stating plainly: this finds the markdowns
 * **inside the page it was given**, not across the whole catalogue. The caller
 * asks for a wide page (24) precisely so the sample is worth drawing from, and
 * the section hides itself below `MIN_DEALS` rather than showing a lonely one
 * or two and implying the shop has nothing on offer.
 *
 * `discountPercent` is the same helper the badge uses, so a product appears
 * here exactly when it would render a `-N%` chip — a row that included items
 * whose badge said nothing would look like a bug.
 */

/** Fewer than this and the row is not worth a section of its own. */
export const MIN_DEALS = 3

/**
 * The markdown a product's badge would show, or null when it carries none.
 *
 * A range has no single "was" to compare against, so a VARIABLE product with
 * mixed variation prices is not a markdown we can honestly label. Shared with
 * the hero marquee's re-rank, so "on sale" means the same thing in both.
 */
export function markdownPercent(product: ProductCard): number | null {
  const price = priceDisplay(product)
  if (price.kind !== "single") return null
  return discountPercent(price.compareAtCents, price.sellingCents)
}

export function markdowns(products: ProductCard[], limit: number): ProductCard[] {
  const discounted: { product: ProductCard; off: number }[] = []

  for (const product of products) {
    // A sold-out item is not an offer. It still belongs in the catalogue and in
    // "new arrivals", where the badge tells the truth about it — but a row
    // headed "Marked down" is a row of things to buy, and leading it with one
    // that cannot be bought is the cheapest way to lose a shopper's trust in
    // the rest of the row.
    if (!isPurchasable(product)) continue

    const off = markdownPercent(product)
    if (off === null) continue

    discounted.push({ product, off })
  }

  // Deepest cut first — the row is a ranking, which is also why it is rendered
  // as a rail rather than as a grid that wraps.
  discounted.sort((a, b) => b.off - a.off)

  return discounted.slice(0, limit).map((entry) => entry.product)
}
