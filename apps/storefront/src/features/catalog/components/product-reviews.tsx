"use client"

import Image from "@/shared/components/app-image"
import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Star, User } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import { formatDate } from "@/shared/lib/format"
import { imageRefs } from "@/shared/lib/multilang"
import { PRODUCT_REVIEWS } from "../api"

const REVIEWS_PER_PAGE = 4

/**
 * Reviews for one product, as the card beside the buy bar.
 *
 * The rating figure comes from `meta.average_rating` — the mean over every
 * review, computed by the back-end — so it does not move when "See more" grows
 * the list. That field exists because this page needed it: the public `reviews`
 * query returned only a page, and `shopReviewsSummary` (which has the same
 * number) is ownership-gated to the vendor.
 *
 * **There is no reviewer name here, and that is the API, not an omission.**
 * `ReviewEntry` exposes `user_id` and nothing else about the author; the shape
 * carrying a customer is `ShopReviewEntry`, which only the shop's own console
 * can read. Inventing an initial out of a cuid would be decoration pretending
 * to be identity, so the row leads with the rating instead.
 */
export function ProductReviews({ productId }: { productId: string }) {
  const t = useTranslations("reviews")
  const locale = useLocale()
  const [limit, setLimit] = useState(REVIEWS_PER_PAGE)

  const { data, loading } = useQuery(PRODUCT_REVIEWS, {
    variables: { product_id: productId, page: 1, limit },
  })

  const reviews = data?.reviews.data ?? []
  const total = data?.reviews.meta.total ?? 0

  if (loading && reviews.length === 0) {
    return (
      <section className="shop-panel animate-pulse p-6 sm:p-8">
        <div className="h-5 w-32 rounded-full bg-muted" />
        <div className="mt-5 h-16 w-full rounded-2xl bg-muted ring-1 ring-shop-hairline" />
        <div className="mt-3 h-16 w-full rounded-2xl bg-muted ring-1 ring-shop-hairline" />
      </section>
    )
  }

  return (
    <section className="shop-panel p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-shop-title font-semibold tracking-tight">
          {t("title")}{" "}
          <span className="text-muted-foreground tabular-nums">({total})</span>
        </h2>
        {total > reviews.length && (
          <button
            type="button"
            onClick={() => setLimit((current) => current + REVIEWS_PER_PAGE)}
            disabled={loading}
            className="rounded-full bg-card px-3 py-1 text-sm ring-1 ring-shop-hairline outline-none transition-colors hover:text-shop-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {t("seeMore")}
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="py-8 text-center text-shop-body text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {reviews.map((review) => {
            const photos = imageRefs(review.photos)
            return (
              <li
                key={review.id}
                className="border-t border-shop-hairline pt-4 first:border-0 first:pt-0"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
                  >
                    <User className="size-4" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t("customer")}</p>
                    <time className="text-xs text-muted-foreground">
                      {formatDate(review.created_at, locale)}
                    </time>
                  </div>
                  <Stars rating={review.rating} />
                </div>

                <p className="mt-3 text-shop-body leading-relaxed whitespace-pre-line text-muted-foreground">
                  {review.comment}
                </p>

                {photos.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {photos.map((photo, index) => (
                      <div
                        key={photo.id ?? `${photo.original}-${index}`}
                        className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-shop-hairline"
                      >
                        <Image
                          src={photo.thumbnail ?? photo.original}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * The one-line rating beside the product title.
 *
 * Runs the same query as the list at the same starting variables, so Apollo
 * serves it from the cache and the page still makes one review request. A
 * single star rather than five: the average is a decimal, and five icons can
 * only round it — the number next to one star is the honest rendering.
 */
export function ProductRating({ productId }: { productId: string }) {
  const t = useTranslations("reviews")
  const locale = useLocale()

  const { data } = useQuery(PRODUCT_REVIEWS, {
    variables: { product_id: productId, page: 1, limit: REVIEWS_PER_PAGE },
  })

  const total = data?.reviews.meta.total ?? 0
  const average = data?.reviews.meta.average_rating ?? 0

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("count", { count: 0 })}</p>
    )
  }

  return (
    <p className="flex items-center gap-2 text-sm">
      <Star aria-hidden className="size-4 fill-shop-low-stock text-shop-low-stock" />
      <span className="font-medium tabular-nums">
        {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
          average,
        )}
      </span>
      <span className="text-muted-foreground">{t("count", { count: total })}</span>
      <span className="sr-only">{t("averageLabel", { rating: average })}</span>
    </p>
  )
}

function Stars({ rating }: { rating: number }) {
  const t = useTranslations("reviews")

  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={t("ratingStars", { count: rating })}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          aria-hidden
          className={cn(
            "size-3.5",
            step <= rating
              ? "fill-shop-low-stock text-shop-low-stock"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  )
}
