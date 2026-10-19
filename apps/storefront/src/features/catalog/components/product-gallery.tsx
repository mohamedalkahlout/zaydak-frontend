"use client"

import Image from "@/shared/components/app-image"
import { useState } from "react"

import { cn } from "@repo/ui/lib/utils"

import type { ImageRef } from "@/shared/lib/multilang"

/**
 * The PDP image viewer — a mosaic, not a hero with a filmstrip.
 *
 * One big frame with three smaller ones beside it, so the shopper sees four
 * views of the thing at once instead of one view and three stamps. Clicking a
 * tile *promotes* it: it takes the big frame and the outgoing photo drops back
 * into the tile it came from, which keeps the set stable — nothing enters or
 * leaves, so the grid never reflows under the cursor.
 *
 * `activeId` rather than an index: the gallery is re-keyed when a variation
 * with its own image is chosen, and an index would silently point at a
 * different photo after the list changes length. Falling back to the first
 * image when the id is gone keeps that safe.
 *
 * The mosaic is a 4×2 grid so it can collapse honestly at every count: one
 * photo fills it, two split it, three give the big frame two stacked
 * companions, and only four or more produce the reference layout. Anything
 * beyond four is reachable through the strip underneath, which appears only
 * then — a row of thumbnails under a complete mosaic is chrome for nothing.
 */
export function ProductGallery({
  images,
  alt,
  activeId,
  badge,
  onSelect,
}: {
  images: ImageRef[]
  alt: string
  /** Controlled selection, used when a variation carries its own image. */
  activeId?: string | null
  /** Collection or tag name, shown as a chip over the main frame. */
  badge?: string | null
  onSelect?: (id: string) => void
}) {
  const [internalId, setInternalId] = useState<string | null>(null)

  const selectedId = activeId ?? internalId
  const active =
    images.find((image) => image.id && image.id === selectedId) ?? images[0]

  function select(image: ImageRef) {
    if (!image.id) return
    setInternalId(image.id)
    onSelect?.(image.id)
  }

  if (!active) {
    return (
      <div
        aria-hidden
        className="grid aspect-[16/10] place-items-center rounded-2xl bg-shop-accent-soft font-heading text-6xl text-shop-accent/40 ring-1 ring-shop-hairline"
      >
        {alt.slice(0, 1).toUpperCase()}
      </div>
    )
  }

  const rest = images.filter((image) => image !== active)
  const tiles = rest.slice(0, 3)
  const overflow = rest.length - tiles.length

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:grid-rows-2 sm:aspect-[2.2/1]">
        {/* The photo an add-to-cart flight launches from; see `cart-flight.ts`. */}
        <figure
          data-flight-source
          className={cn(
            "relative overflow-hidden rounded-2xl bg-secondary ring-1 ring-shop-hairline",
            MAIN_SPAN[Math.min(tiles.length, 3)],
          )}
        >
          <Image
            key={active.original}
            src={active.original}
            alt={alt}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
          {badge && (
            <figcaption className="absolute end-3 top-3 rounded-full bg-card px-3 py-1 text-xs font-medium ring-1 ring-shop-hairline">
              {badge}
            </figcaption>
          )}
        </figure>

        {tiles.map((image, index) => {
          const isLast = index === tiles.length - 1
          return (
            <button
              key={image.id ?? `${image.original}-${index}`}
              type="button"
              onClick={() => select(image)}
              // Numbered by where the photo sits in the set, not by where it
              // sits in the row: promotion reorders what the tiles hold, so a
              // positional label would rename every photo on each click.
              aria-label={`${alt} — ${images.indexOf(image) + 1}`}
              className={cn(
                "group relative overflow-hidden rounded-2xl bg-secondary outline-none ring-1 ring-shop-hairline transition-shadow",
                "hover:ring-shop-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                TILE_SPAN[tiles.length]?.[index],
              )}
            >
              <Image
                // A mosaic tile is up to half the viewport wide, so it wants the
                // original for the same reason a catalogue tile does — see
                // `card-photos.tsx`. The 64px strip below is the one place the
                // stored 368x232 derivative is genuinely big enough.
                src={image.original}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              {isLast && overflow > 0 && (
                <span className="absolute inset-0 grid place-items-center bg-foreground/45 text-sm font-medium text-background">
                  +{overflow}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {images.length > 4 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => {
            const isActive = image === active
            return (
              <button
                key={image.id ?? `${image.original}-${index}`}
                type="button"
                onClick={() => select(image)}
                aria-label={`${alt} — ${index + 1}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative size-16 shrink-0 overflow-hidden rounded-xl bg-secondary outline-none transition-shadow",
                  isActive
                    ? "ring-2 ring-shop-accent"
                    : "ring-1 ring-shop-hairline hover:ring-shop-accent",
                )}
              >
                <Image
                  src={image.thumbnail ?? image.original}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * How wide the main frame runs, by how many tiles sit beside it — and the
 * aspect it holds before the grid takes over at `sm`.
 *
 * Each entry carries its own mobile ratio rather than inheriting a base one:
 * two unprefixed `aspect-*` utilities in one class string are a coin toss over
 * which lands last in the stylesheet, and the wide tile genuinely wants a
 * different shape from the square ones.
 */
const MAIN_SPAN = [
  "col-span-2 aspect-[16/10] sm:col-span-4 sm:row-span-2 sm:aspect-auto",
  "col-span-2 aspect-square sm:col-span-2 sm:row-span-2 sm:aspect-auto",
  "col-span-2 aspect-square sm:col-span-2 sm:row-span-2 sm:aspect-auto",
  "col-span-2 aspect-square sm:col-span-2 sm:row-span-2 sm:aspect-auto",
] as const

/** …and where each tile lands, so no cell is ever left empty. */
const TILE_SPAN: Record<number, readonly string[]> = {
  1: ["col-span-2 aspect-[16/10] sm:col-span-2 sm:row-span-2 sm:aspect-auto"],
  2: [
    "col-span-2 aspect-[2/1] sm:col-span-2 sm:aspect-auto",
    "col-span-2 aspect-[2/1] sm:col-span-2 sm:aspect-auto",
  ],
  3: [
    "aspect-square sm:col-span-1 sm:aspect-auto",
    "aspect-square sm:col-span-1 sm:aspect-auto",
    "col-span-2 aspect-[2/1] sm:col-span-2 sm:aspect-auto",
  ],
}
