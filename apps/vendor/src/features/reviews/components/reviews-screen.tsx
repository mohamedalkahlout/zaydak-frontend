"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { GET_PRODUCTS } from "@/features/products/api"
import type { Product, ProductsResponse } from "@/features/products/types"
import {
  GET_SHOP_REVIEWS,
  GET_SHOP_REVIEWS_SUMMARY,
} from "@/features/reviews/api"
import type {
  ReviewProductFilter,
  ReviewRating,
  ShopReview,
  ShopReviewSort,
  ShopReviewsResponse,
  ShopReviewsSummaryResponse,
} from "@/features/reviews/types"
import {
  PAGE_SIZE,
  productFilterFromProduct,
  productFilterFromReview,
} from "@/features/reviews/lib/reviews"
import { useThrottledCallback } from "@/shared/hooks/use-throttled-callback"
import { ReviewRow } from "./review-row"
import { ReviewsEmpty } from "./reviews-empty"
import { ReviewsSummary } from "./reviews-summary"
import { ReviewsToolbar } from "./reviews-toolbar"

/**
 * The chip the toolbar draws for the active product filter.
 *
 * `product` state is what the *merchant* chose and stays single-writer: a bare
 * `{ id, label: "" }` when the screen was deep linked with `?product=`, a full
 * chip when they picked one in the toolbar or from a row. Only the missing
 * label is filled in, and it is filled in here — derived on the way to the
 * toolbar rather than written back into state from an effect. The id the query
 * runs on is identical either way, so nothing about the request changes, and
 * there is no cascading render and no frame showing a stale label.
 *
 * Whichever source answers first supplies the label: `products` is fetched only
 * for the deep-linked id, and with a product filter active every review on the
 * page belongs to that product, so the list is reliable once it loads.
 */
function resolveProductChip(
  product: ReviewProductFilter | null,
  fetched: Product | undefined,
  reviews: ShopReview[],
): ReviewProductFilter | null {
  if (!product || product.label) return product
  if (fetched && fetched.id === product.id) {
    return productFilterFromProduct(fetched)
  }
  const match = reviews.find((r) => r.product?.id === product.id)
  if (match?.product) return productFilterFromReview(match.product)
  return product
}

/**
 * The vendor review screen.
 *
 * Server-paginated rather than TanStack-paginated: a busy shop's reviews are
 * unbounded and the filters (`rating`, `product_id`, `search`, `sort`) are all
 * evaluated by `shopReviews`, so there is no client row model to drive. That is also why the
 * list keeps `previousData` on screen while a filter change is in flight —
 * without it every keystroke blanks the page.
 *
 * The screen is read-only apart from reporting a review, so it registers
 * nothing with the contextual save bar.
 */
export function ReviewsScreen() {
  const t = useTranslations("reviews")
  const searchParams = useSearchParams()
  const initialProductId = searchParams?.get("product") ?? null

  // `searchInput` is what the box shows; `search` is what the query ran with.
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [rating, setRating] = useState<ReviewRating | null>(null)
  // The whole chip, not a bare id: the query sends `product.id`, and the
  // toolbar shows `product.label` without asking the server who that is.
  const [product, setProduct] = useState<ReviewProductFilter | null>(() =>
    initialProductId ? { id: initialProductId, label: "", image: null } : null,
  )
  const [sort, setSort] = useState<ShopReviewSort>("NEWEST")
  const [page, setPage] = useState(1)

  const { data: productData } = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: {
      filters: {
        ids: initialProductId ? [initialProductId] : [],
      },
    },
    skip: !initialProductId,
  })

  const commitSearch = useThrottledCallback(
    (value: string) => {
      setSearch(value)
      setPage(1)
    },
    400,
    [],
  )

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    commitSearch(value)
  }

  const handleRatingChange = (next: ReviewRating | null) => {
    setRating(next)
    setPage(1)
  }

  const handleProductChange = (next: ReviewProductFilter | null) => {
    setProduct(next)
    setPage(1)
  }

  const handleSortChange = (next: ShopReviewSort) => {
    setSort(next)
    setPage(1)
  }

  const handleClear = () => {
    commitSearch.cancel()
    setSearchInput("")
    setSearch("")
    setRating(null)
    setProduct(null)
    setPage(1)
  }

  const { data, previousData, loading, error, refetch } =
    useQuery<ShopReviewsResponse>(GET_SHOP_REVIEWS, {
      variables: {
        page,
        limit: PAGE_SIZE,
        rating,
        product_id: product?.id ?? null,
        search: search.trim() || null,
        sort,
      },
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    })

  const { data: summaryData, loading: summaryLoading } =
    useQuery<ShopReviewsSummaryResponse>(GET_SHOP_REVIEWS_SUMMARY, {
      fetchPolicy: "cache-and-network",
    })

  const shown = (data ?? previousData)?.shopReviews
  const reviews = shown?.data ?? []
  const meta = shown?.meta
  const summary = summaryData?.shopReviewsSummary?.data ?? null

  const resolvedProduct = resolveProductChip(
    product,
    productData?.products?.data?.[0],
    reviews,
  )

  const hasFilters =
    search.trim() !== "" || rating !== null || product !== null
  const firstLoad = loading && !shown
  const totalPages = meta?.total_pages ?? 1
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <ReviewsSummary
        summary={summary}
        loading={summaryLoading}
        activeRating={rating}
        onSelectRating={handleRatingChange}
      />

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <ReviewsToolbar
          search={searchInput}
          onSearchChange={handleSearchChange}
          rating={rating}
          onRatingChange={handleRatingChange}
          product={resolvedProduct}
          onProductChange={handleProductChange}
          sort={sort}
          onSortChange={handleSortChange}
          hasFilters={hasFilters}
          onClear={handleClear}
        />

        {error && !shown ? (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
            <h2 className="text-lg font-semibold">{t("error.title")}</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              {error.message}
            </p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t("error.retry")}
            </Button>
          </div>
        ) : firstLoad ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-5 py-4">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <ReviewsEmpty filtered={hasFilters} />
        ) : (
          <div
            // Dim rather than unmount while a new page is in flight — the
            // merchant keeps their place instead of watching the list blink.
            className={
              loading ? "divide-y divide-border opacity-60 transition-opacity" : "divide-y divide-border"
            }
          >
            {reviews.map((review) => (
              <ReviewRow
                key={review.id}
                review={review}
                activeProductId={product?.id ?? null}
                onFilterProduct={handleProductChange}
              />
            ))}
          </div>
        )}

        {meta && meta.total > 0 && totalPages > 1 && (
          <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t("pagination.showing", { from, to, total: meta.total })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon className="size-4 rtl:rotate-180" />
                {t("pagination.previous")}
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("pagination.page", { page: meta.page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("pagination.next")}
                <ChevronRightIcon className="size-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
