"use client"

import { useId, useRef } from "react"
import { useTranslations } from "next-intl"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  StarIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"
import AppImage from "@/shared/components/app-image"
import type { StoreImportProduct } from "@/features/products/api"
import {
  droppedImages,
  galleryOrder,
  makeMainInGallery,
  moveInGallery,
  orderedImages,
  placeInGallery,
  primaryImage,
  type ReviewDraft,
} from "@/features/products/lib/store-import-review"

/**
 * The scanned images of one product, each of which the merchant may drop, and
 * the gallery among them in the order it will be imported.
 *
 * **Drop, restore and reorder, never add.** Every thumbnail is one of the URLs
 * the scan found (`StoreImportProduct.images`), and the controls on it take it
 * out of the import, put it back, or move it within the gallery. There is no
 * URL field: adding an image would make the import download whatever a merchant
 * typed, which is a different decision from tidying what was scanned.
 *
 * Staged in the same draft as every typed edit, so Save, Discard, the dirty
 * state and the leave guard cover it with no code of their own. A dropped
 * thumbnail stays on screen, faded and labelled, rather than disappearing —
 * the restore button has to have something to sit on, and a photo that simply
 * vanished reads as a failed load. The "Main" badge follows the server's rule
 * (`primaryImage`): the first GALLERY image, in the merchant's order, that is
 * not dropped is the one the product is imported with. A photo only a variant
 * uses is never promoted and cannot be moved — it sits after the gallery, with
 * its variant — so when the whole gallery is dropped the strip says the
 * product has no main photo even though a variant's photo is still kept.
 *
 * The order controls are "earlier" and "later" rather than left and right:
 * the strip wraps, and under a right-to-left dashboard the earlier photo is
 * the one on the right. The chevrons turn with the direction. A gallery photo
 * that is still being imported can also be dragged onto another; a dropped
 * photo and a variant-only photo stay out of that order.
 */
export function ReviewImageStrip({
  product,
  draft,
  onDrop,
  onOrder,
}: {
  product: StoreImportProduct
  draft: ReviewDraft
  onDrop: (product: StoreImportProduct, url: string, dropped: boolean) => void
  onOrder: (product: StoreImportProduct, order: string[]) => void
}) {
  const t = useTranslations("products.import.review.images")
  const headingId = useId()
  const dragging = useRef<string | null>(null)
  const dropped = new Set(droppedImages(product, draft))
  const primary = primaryImage(product, draft)
  const gallery = galleryOrder(product, draft)
  const ordered = orderedImages(product, draft)
  const total = product.images.length
  const kept = product.images.filter((url) => !dropped.has(url)).length

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <h3 id={headingId} className="text-base font-semibold">
          {t("title")}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("kept", { kept, total })}
        </span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        <ul className="flex flex-wrap gap-2">
          {ordered.map((url, index) => {
            const isDropped = dropped.has(url)
            const position = index + 1
            // Past the gallery sit the photos only a variant uses: shown, and
            // droppable, but not something the product's order can hold.
            const inGallery = index < gallery.length
            const canOrder = inGallery && !isDropped && gallery.length > 1
            return (
              <li
                key={url}
                className="flex w-20 shrink-0 flex-col gap-1"
                draggable={canOrder}
                aria-label={canOrder ? t("drag", { position }) : undefined}
                onDragStart={() => {
                  dragging.current = url
                }}
                onDragEnd={() => {
                  dragging.current = null
                }}
                onDragOver={(event) => {
                  if (canOrder) event.preventDefault()
                }}
                onDrop={(event) => {
                  if (!canOrder) return
                  event.preventDefault()
                  const from = dragging.current
                  dragging.current = null
                  if (!from || from === url) return
                  onOrder(product, placeInGallery(gallery, from, url))
                }}
              >
                <div className="relative size-20">
                  {/* Through the wrapper, never `next/image`: these are the old
                      store's URLs, whose host is not in `remotePatterns`. */}
                  <span
                    className={cn(
                      "relative block size-full overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10",
                      isDropped && "opacity-40 grayscale",
                    )}
                  >
                    <AppImage
                      src={url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </span>
                  {url === primary && (
                    <span className="absolute start-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                      {t("primary")}
                    </span>
                  )}
                  {!inGallery && !isDropped && (
                    <span className="absolute start-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {t("variantOnly")}
                    </span>
                  )}
                  {isDropped && (
                    <span className="absolute inset-x-1 bottom-1 rounded bg-background/90 px-1.5 py-0.5 text-center text-[10px] font-medium text-muted-foreground">
                      {t("dropped")}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    className="absolute end-1 top-1"
                    aria-label={
                      isDropped
                        ? t("restore", { position })
                        : t("drop", { position })
                    }
                    onClick={() => onDrop(product, url, !isDropped)}
                  >
                    {isDropped ? <Undo2Icon /> : <XIcon />}
                  </Button>
                </div>
                {canOrder && (
                  <div className="flex items-center justify-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === 0}
                      aria-label={t("moveEarlier", { position })}
                      onClick={() =>
                        onOrder(product, moveInGallery(gallery, url, -1))
                      }
                    >
                      <ChevronLeftIcon className="rtl:rotate-180" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={url === primary}
                      aria-label={t("makeMain", { position })}
                      onClick={() =>
                        onOrder(product, makeMainInGallery(gallery, url))
                      }
                    >
                      <StarIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === gallery.length - 1}
                      aria-label={t("moveLater", { position })}
                      onClick={() =>
                        onOrder(product, moveInGallery(gallery, url, 1))
                      }
                    >
                      <ChevronRightIcon className="rtl:rotate-180" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {kept === 0 && (
          <p className="text-xs text-muted-foreground">{t("noneKept")}</p>
        )}
        {kept > 0 && primary === null && (
          <p className="text-xs text-muted-foreground">{t("noMain")}</p>
        )}
      </div>
    </section>
  )
}
