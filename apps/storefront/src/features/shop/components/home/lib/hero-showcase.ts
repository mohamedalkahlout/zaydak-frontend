import { imageRef, text } from "@/shared/lib/multilang"
import { isPurchasable, type ProductCard } from "@/features/catalog/lib/product"
import { markdownPercent } from "./deals"

/**
 * One frame in the home hero's product marquee.
 *
 * `href` is null when the frame is a stand-in (shop cover or the bundled
 * fallback) rather than a real product — those still fill the band so a shop
 * with no photographed catalogue does not open on an empty strip, but they
 * are not links, because a link to nowhere is worse than decoration.
 */
export type HeroShowcaseItem = {
  id: string
  src: string
  alt: string
  href: string | null
}

const HERO_FALLBACK =
  "/45b237f74721b70d9940b4344f52a4c070c019968dffd575b1cdf3700b9975fc.jpg"

/** How many unique frames the marquee wants before it looks like a loop. */
const SHOWCASE_TARGET = 8

/**
 * How many places earlier a buyable markdown is ranked than where its rail put
 * it. Light on purpose: it lets a sale item from the newest rail reach the
 * band, but never lets a page of markdowns push the shop's most-viewed
 * products out of it.
 */
const SALE_BOOST = 4

/**
 * The candidates in the order the marquee should take them: a stable re-rank
 * of the popular-then-newest list it was given.
 *
 * Two rules, and nothing else moves:
 *
 *  - **Buyable before sold out.** The band is the shop's face and every frame
 *    is a link; leading with a product nobody can buy is the wrong first
 *    impression. A sold-out product is not dropped — it still beats the cover
 *    pad for a shop with few photographs — it goes last. Buyable is
 *    `isPurchasable`, so a backorder counts.
 *  - **A light boost for markdowns.** A buyable product carrying a markdown
 *    (`markdownPercent`, the same rule as the deals row and the `-N%` badge)
 *    is ranked as if it stood `SALE_BOOST` places earlier, behind whatever
 *    already stands there.
 *
 * Ties fall back to the original index, so the order within the markdowns,
 * within the rest and within the sold-out group is exactly the input's. A shop
 * whose products are all buyable at full price gets the list unchanged.
 * Deterministic by construction — the server render and the hydration pass
 * must draw the same band.
 */
export function rankShowcaseCandidates(products: ProductCard[]): ProductCard[] {
  return products
    .map((product, index) => {
      const buyable = isPurchasable(product)
      const boosted = buyable && markdownPercent(product) !== null
      return {
        product,
        index,
        tier: buyable ? 0 : 1,
        score: boosted ? index - SALE_BOOST : index,
      }
    })
    .sort((a, b) => a.tier - b.tier || a.score - b.score || a.index - b.index)
    .map((entry) => entry.product)
}

/**
 * Build the hero marquee from products the home page already fetched.
 *
 * Popular first, then newest: the band is the shop's "face", and what people
 * already open is a better face than what landed yesterday. That order is then
 * re-ranked by `rankShowcaseCandidates` — buyable before sold out, a light
 * boost for markdowns. Deduped by image URL so a vendor who re-uses one photo
 * across SKUs does not get a stuttering loop of the same picture.
 *
 * Below three real product frames the band is padded with the shop's cover
 * (or the bundled fallback), because a two-card marquee reads as a glitch
 * rather than a showcase.
 */
export function buildHeroShowcase(
  products: ProductCard[],
  {
    base,
    locale,
    cover,
  }: {
    base: string
    locale: string
    cover: string | null
  },
): HeroShowcaseItem[] {
  const seen = new Set<string>()
  const items: HeroShowcaseItem[] = []

  for (const product of rankShowcaseCandidates(products)) {
    if (items.length >= SHOWCASE_TARGET) break
    const photo = imageRef(product.image)
    if (!photo) continue
    if (seen.has(photo.original)) continue
    seen.add(photo.original)

    const name = text(product.name, locale, product.slug)
    items.push({
      id: product.id,
      src: photo.thumbnail ?? photo.original,
      alt: name,
      href: `${base}/products/${product.slug}`,
    })
  }

  if (items.length >= 3) return items

  const padSrc = cover ?? HERO_FALLBACK
  const padsNeeded = Math.max(3, SHOWCASE_TARGET - items.length)
  for (let i = 0; i < padsNeeded; i++) {
    items.push({
      id: `pad-${i}`,
      src: padSrc,
      alt: "",
      href: null,
    })
  }
  return items
}

export { HERO_FALLBACK }
