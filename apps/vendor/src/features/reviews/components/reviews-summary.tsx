"use client"

import { useTranslations } from "next-intl"
import { CameraIcon, FlagIcon, StarIcon, TrendingUpIcon } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"
import { Skeleton } from "@repo/ui/components/skeleton"
import type { ReviewRating, ShopReviewsSummary } from "@/features/reviews/types"
import { RATING_VALUES, sharePercent } from "@/features/reviews/lib/reviews"
import { RatingStars } from "./rating-stars"

interface ReviewsSummaryProps {
  summary: ShopReviewsSummary | null
  loading: boolean
  /** The rating currently filtering the list, so its bar reads as pressed. */
  activeRating: ReviewRating | null
  onSelectRating: (rating: ReviewRating | null) => void
}

/**
 * The headline card: average, the 5→1 distribution, and three counts.
 *
 * The bars are buttons — a merchant who sees "31 one-star reviews" wants to
 * read them, and making the number itself the filter saves the trip to the
 * dropdown. Clicking the active bar clears the filter.
 *
 * Drawn in CSS rather than with recharts: five horizontal bars did not justify
 * pulling a chart library onto a screen that otherwise ships none.
 */
export function ReviewsSummary({
  summary,
  loading,
  activeRating,
  onSelectRating,
}: ReviewsSummaryProps) {
  const t = useTranslations("reviews")

  if (loading && !summary) {
    return (
      <div className="grid gap-4 rounded-xl border border-border bg-card p-5 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  }

  if (!summary) return null

  const total = summary.total

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        {/* Average */}
        <div className="flex flex-col justify-center gap-1.5 lg:border-e lg:border-border lg:pe-6">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums">
              {summary.average_rating.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">/ 5</span>
          </div>
          <RatingStars
            rating={Math.round(summary.average_rating)}
            className="size-4"
            label={t("summary.averageLabel", {
              rating: summary.average_rating.toFixed(1),
            })}
          />
          <p className="text-sm text-muted-foreground">
            {t("summary.total", { count: total })}
          </p>
        </div>

        {/* Distribution */}
        <div className="flex flex-col gap-1.5">
          {RATING_VALUES.map((rating) => {
            const count =
              summary.distribution.find((b) => b.rating === rating)?.count ?? 0
            const percent = sharePercent(count, total)
            const active = activeRating === rating
            return (
              <button
                key={rating}
                type="button"
                aria-pressed={active}
                disabled={count === 0 && !active}
                onClick={() => onSelectRating(active ? null : rating)}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-2 py-1 text-sm transition-colors",
                  "hover:bg-muted/60 disabled:pointer-events-none disabled:opacity-50",
                  active && "bg-muted",
                )}
              >
                <span className="flex w-10 shrink-0 items-center gap-1 text-muted-foreground">
                  <span className="tabular-nums">{rating}</span>
                  <StarIcon
                    aria-hidden
                    className="size-3 fill-amber-400 text-amber-400"
                  />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded-full bg-amber-400 transition-[width]",
                      active && "bg-amber-500",
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-end tabular-nums text-muted-foreground">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-1 divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <SummaryStat
          icon={<TrendingUpIcon className="size-4" />}
          label={t("summary.last30")}
          value={summary.last_30_days}
        />
        <SummaryStat
          icon={<CameraIcon className="size-4" />}
          label={t("summary.withPhotos")}
          value={summary.with_photos}
        />
        <SummaryStat
          icon={<FlagIcon className="size-4" />}
          label={t("summary.reported")}
          value={summary.reported}
          tone={summary.reported > 0 ? "warn" : undefined}
        />
      </div>
    </section>
  )
}

function SummaryStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: "warn"
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground",
          tone === "warn" &&
            "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-none tabular-nums">
          {value}
        </p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
