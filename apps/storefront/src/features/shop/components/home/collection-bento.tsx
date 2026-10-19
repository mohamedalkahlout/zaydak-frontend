"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { ArrowRight } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import { imageRef, text } from "@/shared/lib/multilang"
import { useShop } from "../../shop-context"
import type { HomeCollection } from "./types"

/**
 * The shop's collections, as a bento of photo tiles.
 *
 * **The asymmetry is computed, not authored.** A hand-drawn 2x2 looks composed
 * with exactly four collections and broken with three or five, and a vendor
 * decides how many they have. `spanFor` lays the tiles out in wide/narrow pairs
 * that alternate direction — 4-2, then 2-4 — and gives an odd last tile the
 * full width, so every row is full at any count from one upward. That is the
 * difference between a layout that survives real data and a mockup.
 *
 * Each tile links into the catalogue's existing `?collections=<id>` filter
 * rather than to a route of its own. The catalogue already knows how to render
 * a filtered set, and a second screen doing the same thing is a second screen
 * to keep in step.
 */
export function CollectionBento({
  collections,
}: {
  collections: HomeCollection[]
}) {
  if (collections.length === 0) return null

  return (
    <div className="grid gap-5 sm:gap-6 sm:grid-cols-6">
      {collections.map((collection, index) => (
        <CollectionTile
          key={collection.id}
          collection={collection}
          span={spanFor(index, collections.length)}
        />
      ))}
    </div>
  )
}

/**
 * Column span (out of six) for the tile at `index`.
 *
 * Pairs run wide-then-narrow and flip each row, which is what gives the grid
 * its rhythm; a lone trailing tile takes the whole row rather than leaving a
 * hole beside it.
 */
export function spanFor(index: number, total: number): 2 | 4 | 6 {
  // A tile with no partner takes the row rather than leaving a hole beside it.
  // That covers both the single-collection shop and every odd count above it.
  if (index === total - 1 && index % 2 === 0) return 6

  const first = index % 2 === 0
  // Even rows lead wide, odd rows lead narrow.
  return Math.floor(index / 2) % 2 === 0 ? (first ? 4 : 2) : first ? 2 : 4
}

/**
 * Spans only separate at `lg`. Below it the pairs are even halves and a lone
 * tile is full width — a 2-of-6 column on a phone is a thumbnail, not a tile.
 */
const SPAN_CLASS: Record<number, string> = {
  2: "sm:col-span-3 lg:col-span-2",
  4: "sm:col-span-3 lg:col-span-4",
  6: "sm:col-span-6",
}

function CollectionTile({
  collection,
  span,
}: {
  collection: HomeCollection
  span: number
}) {
  const t = useTranslations("home")
  const locale = useLocale()
  const { base } = useShop()

  const name = text(collection.name, locale, collection.slug)
  const description = text(collection.description, locale, "")
  const image = imageRef(collection.image)

  return (
    <Link
      href={`${base}/products?collections=${collection.id}`}
      className={cn(
        "group relative isolate flex h-64 flex-col justify-end overflow-hidden rounded-2xl ring-1 ring-shop-hairline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:h-80",
        SPAN_CLASS[span],
      )}
    >
      {image ? (
        <Image
          src={image.original}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
          className="-z-10 object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <div
          aria-hidden
          className="-z-10 absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,var(--shop-accent-soft)_0%,var(--background)_70%)]"
        />
      )}

      {/* The scrim exists only where the type sits. A full-tile overlay would
          flatten the photograph the vendor chose; a bottom gradient keeps the
          top two thirds at full contrast and still guarantees the name is
          readable over whatever is underneath it. */}
      <div
        aria-hidden
        className={cn(
          "-z-10 absolute inset-x-0 bottom-0 h-2/3",
          image
            ? "bg-gradient-to-t from-shop-photo-scrim/90 via-shop-photo-scrim/45 to-transparent"
            : "bg-gradient-to-t from-card/90 to-transparent",
        )}
      />

      <div className="p-6 sm:p-8">
        <h3
          className={cn(
            "font-heading text-shop-title font-semibold tracking-tight text-balance",
            image ? "text-shop-photo-ink" : "text-foreground",
          )}
        >
          {name}
        </h3>

        {description && (
          <p
            className={cn(
              "mt-2 line-clamp-2-title max-w-sm text-sm leading-relaxed",
              image ? "text-shop-photo-muted" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        )}

        {/* No item count here on purpose. `CollectionEntry.product_count` is a
            bare `_count.products` with no `where` at all
            (`collections.service.ts:77`), so it counts DRAFT, unpublished and
            soft-deleted rows alongside the buyable ones — a tile promising
            "12 pieces" that opens onto four is worse than a tile that promised
            nothing. There is no per-collection public total in the schema, and
            one `storefrontProducts` query per tile to obtain it is not a price
            worth paying for a subtitle. */}
        <div
          className={cn(
            "mt-5 flex items-center gap-3 text-xs",
            image ? "text-shop-photo-muted" : "text-muted-foreground",
          )}
        >
          <span className="inline-flex items-center gap-1 font-medium">
            {t("browseCollection")}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </div>
      </div>
    </Link>
  )
}
