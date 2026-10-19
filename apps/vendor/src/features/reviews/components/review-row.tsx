"use client"

import { useState } from "react"
import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ExternalLinkIcon,
  FlagIcon,
  ListFilterIcon,
  MoreHorizontalIcon,
  PackageIcon,
  ThumbsUpIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { cn } from "@repo/ui/lib/utils"
import type {
  ReviewProductFilter,
  ShopReview,
} from "@/features/reviews/types"
import {
  productFilterFromReview,
  productHref,
  ratingToneClass,
} from "@/features/reviews/lib/reviews"
import { formatDate, initials, translatable } from "@/shared/lib/format"
import { RatingStars } from "./rating-stars"
import { ReportReviewDialog } from "./report-review-dialog"

interface ReviewRowProps {
  review: ShopReview
  /** The product the list is narrowed to, so the row does not offer a filter that is already on. */
  activeProductId?: string | null
  /**
   * Narrow the list to this review's product. It sits in the actions menu
   * rather than on the product chip: the chip is already a link, and a second
   * click target inside a link is the nested-interactive trap.
   */
  onFilterProduct?: (product: ReviewProductFilter) => void
}

/**
 * One review in the queue: who wrote it, what they said, which product, and
 * the actions a merchant has on it.
 *
 * A card rather than a table row — the comment is free text of unbounded
 * length and the photos are part of the evidence, neither of which survives a
 * fixed-width cell.
 */
export function ReviewRow({
  review,
  activeProductId = null,
  onFilterProduct,
}: ReviewRowProps) {
  const t = useTranslations("reviews")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const [reportOpen, setReportOpen] = useState(false)

  const productName = translatable(review.product?.name)
  const href = productHref(shopSlug, review.product?.slug)
  const reported = review.abusive_reports_count > 0
  // A hard-deleted product leaves `review.product` null and cannot be picked
  // in the toolbar either, so the row offers nothing for it.
  const filterProduct =
    onFilterProduct && review.product && review.product.id !== activeProductId
      ? review.product
      : null

  return (
    <article className="flex gap-3 px-4 py-4 transition-colors hover:bg-muted/30 sm:gap-4 sm:px-5">
      <Avatar className="size-9 shrink-0">
        {review.customer?.avatar ? (
          <AvatarImage
            src={review.customer.avatar}
            alt=""
            width={36}
            height={36}
          />
        ) : null}
        <AvatarFallback className="text-xs">
          {initials(review.customer?.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Who + when + actions */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-medium">
                {review.customer?.name ?? t("list.unknownCustomer")}
              </span>
              <RatingStars
                rating={review.rating}
                label={t("summary.averageLabel", { rating: review.rating })}
              />
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  ratingToneClass(review.rating),
                )}
              >
                {review.rating}/5
              </span>
              {reported && (
                <Badge variant="destructive" className="gap-1">
                  <FlagIcon className="size-3" />
                  {t("list.reported", { count: review.abusive_reports_count })}
                </Badge>
              )}
            </div>
            {review.customer?.email && (
              <p className="truncate text-xs text-muted-foreground">
                {review.customer.email}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <time
              dateTime={review.created_at}
              className="text-xs text-muted-foreground tabular-nums"
            >
              {formatDate(review.created_at)}
            </time>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(p) => (
                  <Button
                    {...p}
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t("actions.menu")}
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                {href && (
                  <DropdownMenuItem render={<Link href={href} />}>
                    <ExternalLinkIcon className="size-4" />
                    {t("actions.viewProduct")}
                  </DropdownMenuItem>
                )}
                {filterProduct && (
                  <DropdownMenuItem
                    onClick={() =>
                      onFilterProduct?.(productFilterFromReview(filterProduct))
                    }
                  >
                    <ListFilterIcon className="size-4" />
                    {t("actions.showOnlyProduct")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setReportOpen(true)}>
                  <FlagIcon className="size-4" />
                  {t("actions.report")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Body */}
        {review.comment ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {review.comment}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            {t("list.noComment")}
          </p>
        )}

        {/* Photos */}
        {review.photo_urls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {review.photo_urls.map((url) => (
              <span
                key={url}
                className="relative size-16 overflow-hidden rounded-md border border-border bg-muted"
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
              </span>
            ))}
          </div>
        )}

        {/* Product + signals */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {review.product ? (
            <span className="flex min-w-0 items-center gap-1.5">
              {review.product.image ? (
                <Image
                  src={review.product.image}
                  alt=""
                  width={16}
                  height={16}
                  className="size-4 shrink-0 rounded-sm object-cover"
                  unoptimized
                />
              ) : (
                <PackageIcon className="size-3.5 shrink-0" />
              )}
              {href ? (
                <Link href={href} className="truncate hover:underline">
                  {productName || review.product.slug}
                </Link>
              ) : (
                <span className="truncate">
                  {productName || review.product.slug}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <PackageIcon className="size-3.5" />
              {t("list.deletedProduct")}
            </span>
          )}

          {review.positive_feedbacks_count > 0 && (
            <span className="flex items-center gap-1">
              <ThumbsUpIcon className="size-3.5" />
              {t("list.helpful", { count: review.positive_feedbacks_count })}
            </span>
          )}
        </div>
      </div>

      <ReportReviewDialog
        review={review}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </article>
  )
}
