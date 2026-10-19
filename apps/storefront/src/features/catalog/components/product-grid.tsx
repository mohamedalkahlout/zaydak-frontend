"use client"

import { useTranslations } from "next-intl"
import { PackageOpen } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import type { ProductCard as ProductCardData } from "../lib/product"
import { PRODUCT_CARD_FRAME, ProductCard } from "./product-card"

/**
 * The catalogue grid, plus its two non-product states.
 *
 * The skeleton renders the same tile geometry as a real card — the same
 * frame (`PRODUCT_CARD_FRAME`, imported rather than retyped), with the ghost
 * of a caption and a pill along its bottom edge — so the layout does not jump
 * when data lands. That is the whole reason it is hand-drawn here rather than
 * a generic `Skeleton`: the shape is the point.
 */
export function ProductGrid({
  products,
  loading,
  skeletonCount = 8,
  className,
  emptyTitle,
  emptyBody,
}: {
  products: ProductCardData[]
  loading?: boolean
  skeletonCount?: number
  className?: string
  emptyTitle?: string
  emptyBody?: string
}) {
  const t = useTranslations("catalog")

  const gridClass = cn(
    "grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4 md:grid-cols-3",
    className,
  )

  if (loading && products.length === 0) {
    return (
      <div className={gridClass} aria-busy="true">
        {Array.from({ length: skeletonCount }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    const body = emptyBody ?? t("emptyBody")
    return (
      <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
        />
        <span
          aria-hidden
          className="relative mx-auto grid size-12 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
        >
          <PackageOpen className="size-5" strokeWidth={1.5} />
        </span>
        <h3 className="relative mt-5 font-heading text-shop-title font-semibold tracking-tight">
          {emptyTitle ?? t("emptyTitle")}
        </h3>
        {/* An explicit empty string means "the title says it all" — rendering
            the default here would contradict the caller. */}
        {body && (
          <p className="relative mx-auto mt-2.5 max-w-sm text-shop-body leading-relaxed text-muted-foreground">
            {body}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={gridClass}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div
      className={cn(
        "relative animate-pulse overflow-hidden bg-muted ring-1 ring-shop-hairline",
        PRODUCT_CARD_FRAME,
      )}
    >
      <div className="absolute inset-x-3.5 bottom-3.5 flex flex-col gap-2 sm:inset-x-4 sm:bottom-4">
        <div className="flex items-end justify-between gap-2">
          <div className="h-4 w-1/2 rounded bg-foreground/10" />
          <div className="h-6 w-14 rounded-full bg-foreground/10" />
        </div>
        <div className="h-3 w-full rounded bg-foreground/10" />
        <div className="h-3 w-3/4 rounded bg-foreground/10" />
        <div className="mt-1 h-10 w-full rounded-full bg-foreground/10" />
      </div>
    </div>
  )
}
