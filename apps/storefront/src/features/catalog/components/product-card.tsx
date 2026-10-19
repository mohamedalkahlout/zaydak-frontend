"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import { cn } from "@repo/ui/lib/utils"

import { imageRef, imageRefs, text, type ImageRef } from "@/shared/lib/multilang"
import { useShop } from "@/features/shop/shop-context"
import { WishlistButton } from "@/features/wishlist/components/wishlist-button"
import {
  cardExcerpt,
  cardTint,
  priceDisplay,
  stockState,
  type ProductCard as ProductCardData,
} from "../lib/product"
import { CardPhotos } from "./card-photos"
import { ProductPrice, SaleBadge } from "./product-price"
import { QuickAddButton } from "./quick-add-button"

/**
 * A product tile: the photograph *is* the card.
 *
 * The photo fills the whole tile and the caption — name, a tag and a stock
 * note, then the price beside a white pill button — sits over its lower part
 * on a scrim of warm ink. There is no white panel under any of it; the shape
 * the eye reads is the picture. Two lines of description wait under the name
 * and open when the tile is hovered.
 *
 * Six structural decisions worth keeping:
 *
 * **The frame is a fixed aspect** (`PRODUCT_CARD_FRAME`): tall on a phone,
 * where a tile is barely wider than the reference's, and 3:4 from `sm` up.
 * Catalogue imagery arrives at whatever aspect the vendor uploaded, and
 * letting each tile size itself is what turns a grid into a ragged staircase.
 * The skeleton reuses the same constant, so a placeholder and the tile it
 * stands in for can never differ by a line.
 *
 * **The title is the link, and the link covers the card.** Its `::after` is
 * stretched over the whole tile (the article is the positioned ancestor), so
 * a click anywhere on the picture opens the product, while a screen reader
 * gets one link named by the product rather than a link whose name is the
 * title, the price, the description and two chips run together. The heart, the
 * add button and the gallery dots sit *above* that overlay (`z-10`) and
 * outside it in the DOM, because an interactive control cannot live inside an
 * anchor.
 *
 * **The scrim belongs to the caption, not to the frame.** It used to be a
 * fixed three-quarters of the tile, which meant a product with no description
 * carried the same wall of ink as one with four lines and lost the picture
 * underneath for nothing. Painting the ramp on the caption box makes its
 * height the caption's height: the less there is to say, the more photo shows.
 *
 * **Which is also what animates.** The excerpt is closed to a zero-height grid
 * row at rest and opens on hover, and because the tile is `justify-end` the
 * caption can only grow upward — so the gradient it carries floods up the
 * photo with it, with no second scrim layer to keep in step. At rest the grid
 * is a wall of names and prices over pictures; the ink and the sentence arrive
 * together on the one tile being read. Touch and keyboard get the excerpt
 * unconditionally, since neither of them hovers.
 *
 * **Everything on the photo is coloured against the photo**, through the
 * `--shop-photo-*` tokens, which have no dark-mode counterpart: a picture is
 * the same in both themes, so a caption that flipped with the page would go
 * wrong in exactly one of them. The same is true of the price
 * (`ProductPrice tone="photoBare"`) and the button (`QuickAddButton`).
 *
 * **A product with no photo gets a colour, not a void** (`cardTint`), and a
 * sold-out one keeps its own. The photo used to be desaturated when the
 * product was unbuyable, which made a whole imported catalogue — every row of
 * it out of stock until a vendor enters quantities — read as a broken image
 * grid rather than as a shop. Sold out is said in words instead: the chip on
 * the photo and the disabled add button, both of which survive being the only
 * state on the tile. `cardTint` lives in `CardPhotos`, which also owns the
 * small hover gallery; `data-flight-source` rides on its frame, because that
 * frame is the picture the add-to-cart flight should launch from.
 */

/** The tile's outer shape. Shared with `ProductCardSkeleton`. */
export const PRODUCT_CARD_FRAME = "aspect-[5/8] rounded-2xl sm:aspect-[3/4]"

/** A translucent chip on the photo: a tag, or a stock note. */
const CHIP =
  "rounded-full bg-shop-photo-chip px-2 py-0.5 text-[0.6875rem] leading-4 font-medium text-shop-photo-ink ring-1 ring-shop-photo-chip-edge ring-inset"

export function ProductCard({
  product,
  className,
}: {
  product: ProductCardData
  className?: string
}) {
  const locale = useLocale()
  const t = useTranslations("product")
  const { base, currency } = useShop()

  const name = text(product.name, locale, product.slug)
  const price = priceDisplay(product)
  const stock = stockState(product)
  const description = cardExcerpt(product.description, locale)

  // The main image first, then the gallery. Deduplicated because a vendor who
  // uploads the cover again as the first gallery shot is common, and it would
  // otherwise buy a dot that changes nothing.
  const main = imageRef(product.image)
  const photos: ImageRef[] = []
  for (const photo of [main, ...imageRefs(product.gallery)]) {
    if (photo && !photos.some((seen) => seen.original === photo.original)) {
      photos.push(photo)
    }
  }

  // One tag, the vendor's first. A tile has one chip row and it is shared
  // with the stock note, so "the first" is the honest cut rather than "as
  // many as fit", which would be a different number on every card.
  const firstTag = product.tags?.[0]
  const tag = firstTag ? text(firstTag.name, locale, firstTag.slug) : null

  const soldOut = stock === "out_of_stock"

  const stockNote =
    stock === "low_stock"
      ? t("lowStock", { count: product.quantity })
      : stock === "backorder"
        ? t("backorder")
        : null

  return (
    <article
      className={cn(
        "group @container relative isolate flex flex-col justify-end overflow-hidden text-shop-photo-ink transition-[box-shadow] duration-200",
        PRODUCT_CARD_FRAME,
        "hover:shadow-[0_18px_36px_-20px_rgba(17,24,39,0.35)]",
        // The ring lives on the card because the link's own box is the title:
        // a ring around two words on a photo is not where the focus is.
        "has-[.product-card-link:focus-visible]:ring-3 has-[.product-card-link:focus-visible]:ring-ring/60",
        className,
      )}
    >
      <CardPhotos
        photos={photos}
        fallback={name.slice(0, 1).toUpperCase()}
        groundClassName={photos.length === 0 ? cardTint(product.id) : undefined}
      />

      <div className="absolute top-3 start-3 z-10 flex flex-col items-start gap-1">
        <SaleBadge price={price} />
        {soldOut && (
          <span className={cn(CHIP, "bg-shop-photo-scrim/60")}>
            {t("outOfStock")}
          </span>
        )}
      </div>

      {/*
        The caption, and the scrim it carries. `pt-12` is the ramp: it gives
        the gradient room to fade into the picture above the first line of
        type, so the block has an edge you cannot find rather than a seam.

        **The scrim rises on hover because the caption grows, not because a
        second layer fades in over the photo.** The tile is `justify-end`, so
        every pixel the caption gains — the excerpt opening below, and four
        more of ramp — pushes its top edge up and drags the gradient with it.
        One box to animate, and the ink can never disagree with the type
        standing on it, which is what a separate scrim layer arriving a frame
        late would look like.

        **There is no `gap` here any more.** A collapsed reveal is still a flex
        item, so a gap above *and* below it held a 10px hole open on every tile
        whose excerpt was closed — which is most of them. Each row carries its
        own `mt-2.5` instead, and the reveal's lives inside its clipped box,
        where it collapses along with the text.
      */}
      <div
        className={cn(
          "flex flex-col bg-gradient-to-t from-shop-photo-scrim/92 via-shop-photo-scrim/72 via-70% to-transparent px-4 pt-12 pb-4 sm:px-5 sm:pb-5",
          "transition-[padding-top] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:pt-16",
          "motion-reduce:transition-none",
        )}
      >
        {/*
          The title takes the whole width, and the price is on the last line
          rather than beside it. That is the point of the arrangement: a price
          sharing this row takes the width out of the name, and a five-figure
          one breaks a two-word product onto two lines.
        */}
        <h3 className="line-clamp-2-title font-heading text-[0.9375rem] leading-snug font-semibold sm:text-base">
          <Link
            href={`${base}/products/${product.slug}`}
            className="product-card-link outline-none after:absolute after:inset-0 after:content-['']"
          >
            {name}
          </Link>
        </h3>

        {/*
          The excerpt, closed until the tile is asked about.

          `grid-rows-[0fr]` -> `[1fr]` rather than a `max-height` guess: the
          row resolves to the paragraph's own height, so a one-line excerpt and
          a two-line one each open to exactly themselves, and neither stops
          short nor lands on empty space. The clipping is on the inner box
          because the row is the thing with a height — `line-clamp`'s own
          `overflow: hidden` rides on a `-webkit-box`, which is not a display
          to hand a grid item.

          **Three ways in, because hover is only one of them.**
          `group-focus-within` opens it for a keyboard tabbing onto the title
          link, and `(hover: none)` leaves it open on touch — where
          `group-hover` never fires and the excerpt would otherwise be a field
          only desktop ever sees. Nothing leaves the DOM in any state, so the
          server-rendered grid still carries it for a crawler.
        */}
        {description && (
          <div
            className={cn(
              "grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
              "group-focus-within:grid-rows-[1fr] group-hover:grid-rows-[1fr]",
              "[@media(hover:none)]:grid-rows-[1fr]",
              "motion-reduce:transition-none",
            )}
          >
            <div className="overflow-hidden">
              <p
                className={cn(
                  "line-clamp-2 pt-2.5 text-xs leading-snug text-shop-photo-muted sm:text-[0.8125rem]",
                  "translate-y-1 opacity-0 transition-[opacity,transform] delay-75 duration-300",
                  "group-focus-within:translate-y-0 group-focus-within:opacity-100",
                  "group-hover:translate-y-0 group-hover:opacity-100",
                  "[@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100",
                  "motion-reduce:translate-y-0 motion-reduce:transition-none",
                )}
              >
                {description}
              </p>
            </div>
          </div>
        )}

        {(tag || stockNote) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tag && <span className={CHIP}>{tag}</span>}
            {stockNote && <span className={CHIP}>{stockNote}</span>}
          </div>
        )}

        {/*
          The last line: the price on the leading edge, the button on the
          trailing one. Above the stretched link, so a press adds rather than
          navigates.

          **It stacks when the tile is too narrow to hold both**, and the
          threshold is a *container* query rather than a screen one because the
          two places this tile is used are different widths at the same
          viewport: the catalogue grid gives it half a phone screen while the
          home rail gives it a fixed 15rem. A viewport breakpoint would have to
          be wrong for one of them. Below the threshold the price takes its own
          line above a full-width button, which is the arrangement a phone
          wants anyway.

          The price never gives way (`shrink-0`): a truncated price is a wrong
          price. The button does, and truncates its label rather than pushing
          the row wider than the card.
        */}
        <div className="relative z-10 mt-2.5 flex flex-col gap-2 pt-1 @[15rem]:flex-row @[15rem]:items-center @[15rem]:gap-3">
          <ProductPrice
            price={price}
            currency={currency}
            size="sm"
            tone="photoBare"
            className="shrink-0"
          />
          <QuickAddButton
            product={product}
            className="min-w-0 @[15rem]:ms-auto @[15rem]:w-auto @[15rem]:px-4"
          />
        </div>
      </div>

      <WishlistButton
        productId={product.id}
        className="absolute top-3 end-3 z-10"
      />
    </article>
  )
}
