/** Matches the back-end `ShopReviewSort` enum. */
export type ShopReviewSort = "NEWEST" | "OLDEST" | "HIGHEST" | "LOWEST"

/** Ratings are always 1–5; the back-end validates the range. */
export type ReviewRating = 1 | 2 | 3 | 4 | 5

export interface ShopReviewProduct {
  id: string
  /** Multilang blob — run it through `translatable()` before rendering. */
  name: { en?: string; ar?: string } | string | null
  slug: string
  image: string | null
}

export interface ShopReviewCustomer {
  id: string
  name: string
  email: string | null
  avatar: string | null
}

export interface ShopReview {
  id: string
  product_id: string
  customer_id: string
  order_id: string | null
  comment: string
  rating: number
  photo_urls: string[]
  positive_feedbacks_count: number
  negative_feedbacks_count: number
  abusive_reports_count: number
  created_at: string
  updated_at: string
  product: ShopReviewProduct | null
  customer: ShopReviewCustomer | null
}

export interface ReviewRatingBucket {
  rating: number
  count: number
}

export interface ShopReviewsSummary {
  total: number
  average_rating: number
  /** Five buckets, 5 down to 1, zero-filled by the back-end. */
  distribution: ReviewRatingBucket[]
  with_photos: number
  last_30_days: number
  reported: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface ShopReviewsResponse {
  shopReviews: {
    success: boolean
    data: ShopReview[]
    meta: PaginationMeta
  }
}

export interface ShopReviewsSummaryResponse {
  shopReviewsSummary: {
    success: boolean
    data: ShopReviewsSummary | null
  }
}

export interface ReportReviewResponse {
  createAbusiveReport: {
    success: boolean
    message: string | null
  }
}

/**
 * The product the list is narrowed to. Carries the already-translated label
 * and the thumbnail so the toolbar chip renders without a second lookup —
 * the list query only ever sends `id`.
 */
export interface ReviewProductFilter {
  id: string
  label: string
  image: string | null
}

/** Everything the list query is filtered by. Also the screen's URL-free state. */
export interface ReviewFilters {
  search: string
  rating: ReviewRating | null
  product_id: string | null
  sort: ShopReviewSort
  page: number
}
