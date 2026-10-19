import type { Product } from "@/features/products/types"
import type {
  ReviewProductFilter,
  ReviewRating,
  ShopReviewProduct,
  ShopReviewSort,
} from "@/features/reviews/types"
import { translatable } from "@/shared/lib/format"

/** One page of the vendor queue. Matches the back-end's own default. */
export const PAGE_SIZE = 20

/** Highest first — the order the distribution bars are drawn in. */
export const RATING_VALUES: ReviewRating[] = [5, 4, 3, 2, 1]

export const SORT_VALUES: ShopReviewSort[] = [
  "NEWEST",
  "OLDEST",
  "HIGHEST",
  "LOWEST",
]

/**
 * How a rating reads at a glance. Mirrors the back-end's
 * `ReviewSentimentService.sentimentFromRating` thresholds so the colour on this
 * screen never disagrees with a sentiment label computed elsewhere.
 */
export function ratingTone(rating: number): "positive" | "neutral" | "negative" {
  if (rating >= 4) return "positive"
  if (rating >= 3) return "neutral"
  return "negative"
}

const TONE_CLASS: Record<ReturnType<typeof ratingTone>, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  neutral: "text-amber-600 dark:text-amber-400",
  negative: "text-rose-600 dark:text-rose-400",
}

export function ratingToneClass(rating: number): string {
  return TONE_CLASS[ratingTone(rating)]
}

/** Bar width for one distribution row. 0 total → 0, never NaN. */
export function sharePercent(count: number, total: number): number {
  if (!total) return 0
  return Math.round((count / total) * 100)
}

/** Reviews are read on their own page — link the product, not the review. */
export function productHref(
  shopSlug: string | null,
  productSlug: string | null | undefined,
): string | null {
  if (!shopSlug || !productSlug) return null
  return `/store/${shopSlug}/products/${productSlug}`
}

/**
 * The product filter as seeded from a review's own product — what a row's
 * "show only this product" hands the screen. Same label rule as the row's
 * chip: the translated name, or the slug when the name is empty.
 */
export function productFilterFromReview(
  product: ShopReviewProduct,
): ReviewProductFilter {
  return {
    id: product.id,
    label: translatable(product.name) || product.slug,
    image: product.image,
  }
}

/**
 * The same, from a `products` row picked in the toolbar. Kept beside
 * `productFilterFromReview` so the two entry points can never label the same
 * product two different ways.
 */
export function productFilterFromProduct(product: Product): ReviewProductFilter {
  return {
    id: product.id,
    label: translatable(product.name) || product.slug,
    image: product.image?.thumbnail ?? product.image?.original ?? null,
  }
}
