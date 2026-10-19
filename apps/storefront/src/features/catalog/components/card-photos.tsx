"use client"

import Image from "@/shared/components/app-image"
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@repo/ui/lib/utils"

import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config"
import type { ImageRef } from "@/shared/lib/multilang"

/**
 * The picture on a product tile, and the small gallery hiding behind it.
 *
 * A tile used to show one angle of a product, so a shopper who wanted a second
 * one had to open the product page and come back. The listing query already
 * carries `gallery` (it is in `publicProductSelect` and in the public mapper),
 * so showing two or three of them costs a field on the fragment and no round
 * trip at all.
 *
 * **A mouse scrubs, a finger taps.** Moving across the card maps the pointer's
 * horizontal position onto the photo list, so the whole frame is the control
 * and there is nothing to aim at. That is deliberately *not* a timer: an
 * auto-advancing tile changes under a shopper who is reading it, and it can
 * never be driven backwards. Touch has no hover, so the dots are real buttons
 * there rather than a read-only indicator.
 *
 * **Nothing beyond the first photo is fetched until it is asked for.** A grid
 * of twenty-four tiles that eagerly loaded three photos each would triple the
 * catalogue's image traffic to show pictures most visits never look at, and
 * the first row of tiles is usually the page's LCP. `armed` flips on the first
 * hover or dot press, and only then do the rest mount.
 *
 * **The scrub is RTL-aware.** The photo order is a list, not a direction, but
 * the gesture is: under `dir="rtl"` the left edge of the frame is the *end* of
 * the sequence, so the fraction is mirrored. Reading the rect makes this one
 * subtraction rather than a second code path.
 */

/** Past this, a tile is a slideshow. The product page is where a gallery lives. */
const MAX_PHOTOS = 4

export function CardPhotos({
  photos,
  fallback,
  groundClassName,
}: {
  /** First is the product's main image; the rest come from its gallery. */
  photos: ImageRef[]
  /** Drawn when the product has no photo at all: its first letter. */
  fallback: string
  /** The tinted ground behind an image-less product. */
  groundClassName?: string
}) {
  const t = useTranslations("product")
  const rtl = LOCALE_DIRECTIONS[resolveLocale(useLocale())] === "rtl"

  const [index, setIndex] = useState(0)
  const [armed, setArmed] = useState(false)

  const shown = photos.slice(0, MAX_PHOTOS)
  const many = shown.length > 1
  // Until the shopper asks for them, only the first photo exists in the DOM.
  const mounted = armed ? shown : shown.slice(0, 1)

  function scrub(event: React.PointerEvent<HTMLDivElement>) {
    // Touch and pen fire pointermove too, and on those a drag is a scroll, not
    // a scrub. Only a mouse has a hover to read.
    if (event.pointerType !== "mouse" || !many) return

    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return

    const raw = (event.clientX - rect.left) / rect.width
    const fraction = rtl ? 1 - raw : raw
    const next = Math.min(
      shown.length - 1,
      Math.max(0, Math.floor(fraction * shown.length)),
    )

    setArmed(true)
    // React bails out of a re-render when the value is unchanged, so this is
    // safe to call on every move.
    setIndex(next)
  }

  return (
    <>
      <div
        data-flight-source
        onPointerMove={scrub}
        onPointerLeave={() => setIndex(0)}
        className={cn(
          "absolute inset-0 -z-10 overflow-hidden",
          groundClassName ?? "bg-shop-photo-ground",
        )}
      >
        {shown.length > 0 ? (
          mounted.map((photo, position) => (
            <Image
              key={photo.original}
              // **The original, not `thumbnail`.** Our stored derivative is one
              // 368x232 landscape crop built for a media-library row, and this
              // frame is a 3:4 portrait around 480 CSS px wide — `object-cover`
              // takes a 232px-tall band out of that thumb and blows it up past
              // 2.5x, which is what made an imported catalogue look like a wall
              // of compression artefacts. `sizes` below is what keeps this
              // cheap: `/_next/image` serves the width the tile actually needs,
              // and on a host it cannot optimise the two URLs are the same
              // string anyway (`imageRef` falls `thumbnail` back to `original`).
              src={photo.original}
              // Decorative: the tile is already named by its title link, and a
              // second announcement of the same product helps nobody.
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={cn(
                "object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.04]",
                position === index ? "opacity-100" : "opacity-0",
              )}
            />
          ))
        ) : (
          <div
            aria-hidden
            className={cn(
              "grid h-full place-items-center font-heading text-5xl",
              groundClassName ? "text-current/30" : "text-shop-photo-ink/25",
            )}
          >
            {fallback}
          </div>
        )}
      </div>

      {many && (
        <div
          // Above the title link's stretched overlay, so a dot press changes
          // the photo instead of opening the product.
          className="relative z-10 flex justify-center gap-1.5 pb-2"
        >
          {shown.map((photo, position) => (
            <button
              key={photo.original}
              type="button"
              aria-label={t("photoNumber", { number: position + 1 })}
              aria-current={position === index}
              onClick={() => {
                setArmed(true)
                setIndex(position)
              }}
              className={cn(
                "size-1.5 rounded-full transition-[background-color,width] focus-visible:ring-2 focus-visible:ring-shop-photo-ink/70 focus-visible:outline-none",
                position === index
                  ? "w-4 bg-shop-photo-ink"
                  : "bg-shop-photo-ink/45 hover:bg-shop-photo-ink/70",
              )}
            />
          ))}
        </div>
      )}
    </>
  )
}
