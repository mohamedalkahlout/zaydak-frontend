"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { m } from "motion/react"
import { Check, Plus } from "lucide-react"
import { sileo } from "sileo"

import { cn } from "@repo/ui/lib/utils"

import { imageRef, text } from "@/shared/lib/multilang"
import { useCart } from "@/features/cart/use-cart"
import { useAddToCartGesture } from "@/features/cart/use-add-gesture"
import { useShop } from "@/features/shop/shop-context"
import { ProductPrice, SaleBadge } from "@/features/catalog/components/product-price"
import { isPurchasable, priceDisplay } from "@/features/catalog/lib/product"
import type { AssistantProduct } from "../types"

/**
 * One product the assistant surfaced, as a card in the panel.
 *
 * **A different composition from the catalogue tile, on purpose, but not a
 * different product card.** The tile is a photograph with the caption laid over
 * its lower third — it is the page's main event and it is 15rem wide. A panel
 * is 26rem in total, so two tiles fill it and a row of five is unreadable. So
 * this stacks instead: square photo, then name, then price, at roughly half the
 * width.
 *
 * What it does **not** do is re-decide anything about the product. The price
 * goes through `ProductPrice`, which owns the sale colour, the strikethrough
 * and the range a variable product shows before an option is picked. Whether it
 * can be bought is `isPurchasable`, the same predicate the tile uses, reading
 * the same four inventory fields. The markdown badge is the catalogue's
 * `SaleBadge`. Before this, the panel formatted its own price from a string the
 * server had already rendered — with an empty currency, as it turned out — and
 * had no idea what a sale was.
 *
 * ## Adding to the cart from here
 *
 * The tile's `QuickAddButton` is a full-width white pill designed to sit along
 * the bottom edge of a photograph. On a 9rem card it would be the card. So the
 * control is a small round button in the photo's corner — the same *behaviour*,
 * a different size — and it is written out here rather than shared, because
 * what they share is four lines of cart call and what differs is everything
 * about how it looks.
 *
 * Three behaviours are copied deliberately, each for the reason the tile has
 * them:
 *
 * - **The pending flag is local.** `useCart().mutating` is true while any cart
 *   mutation is in flight and every card holds its own copy of the hook, so
 *   reading it here would grey out the whole row because one card was pressed.
 * - **A `VARIABLE` product links out instead of adding.** The mutation wants a
 *   `variation_option_id` and a card cannot honestly pick one; adding the
 *   parent row would put a line in the cart naming a size nobody chose.
 * - **Confirmation does not wait for the round trip.** The badge has already
 *   moved and the photo is already flying, so the tick lands on the click. A
 *   toast covers the case where nothing moved — reduced motion, or no bag on
 *   screen — so the add is never silent.
 */
export function AssistantProductCard({
  product,
}: {
  product: AssistantProduct
}) {
  const locale = useLocale()
  const t = useTranslations("product")
  const tCommon = useTranslations("common")
  const { base, currency } = useShop()
  const { addItem } = useCart()
  const addGesture = useAddToCartGesture({ reveal: false })

  const [pending, setPending] = useState(false)
  const [added, setAdded] = useState(false)

  const name = text(product.name, locale, product.slug)
  const image = imageRef(product.image)
  const price = priceDisplay(product)
  const buyable = isPurchasable(product)
  const variable = product.product_type === "VARIABLE"

  return (
    <div className="group/card w-[9.5rem] shrink-0 sm:w-[10.5rem]">
      <div className="relative">
        <Link
          href={`${base}/products/${product.slug}`}
          className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xl"
        >
          {/*
            `data-flight-source` is what the add-to-cart flight measures, so it
            goes on the frame the shopper sees rather than on the `<img>`, whose
            intrinsic box `object-cover` has already cropped away.
          */}
          <div
            data-flight-source
            className="relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-shop-hairline/60"
          >
            {image ? (
              <Image
                src={image.thumbnail ?? image.original}
                // Decorative: the card is already named by the title below it,
                // and announcing the same name twice helps nobody.
                alt=""
                fill
                sizes="168px"
                className="object-cover transition-transform duration-500 group-hover/card:scale-[1.05]"
              />
            ) : (
              <div
                aria-hidden
                className="grid h-full place-items-center font-heading text-2xl text-muted-foreground/40"
              >
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}

            {!buyable && (
              <span className="absolute inset-x-0 bottom-0 bg-foreground/75 py-0.5 text-center text-[0.625rem] font-medium text-background">
                {t("outOfStock")}
              </span>
            )}
          </div>
        </Link>

        <SaleBadge price={price} className="absolute top-1.5 start-1.5" />

        {buyable && (
          <AddButton
            variable={variable}
            href={`${base}/products/${product.slug}`}
            pending={pending}
            added={added}
            label={variable ? t("addToCart") : t("addToCart")}
            onAdd={async (origin) => {
              setPending(true)
              const flying = addGesture(
                origin,
                image?.thumbnail ?? image?.original ?? null,
              )
              setAdded(true)
              if (!flying) sileo.success({ title: t("addedToCart") })
              try {
                await addItem({ product_id: product.id, quantity: 1 })
              } catch {
                // The tick is rolled back: a card still showing "added" over a
                // cart the item never reached is worse than no feedback at all.
                setAdded(false)
                sileo.error({ title: tCommon("somethingWentWrong") })
              } finally {
                setPending(false)
              }
            }}
          />
        )}
      </div>

      <Link
        href={`${base}/products/${product.slug}`}
        className="mt-2 block outline-none focus-visible:underline"
      >
        <p className="line-clamp-2 text-xs leading-snug font-medium">{name}</p>
      </Link>

      <ProductPrice
        price={price}
        currency={currency}
        size="xs"
        className="mt-0.5"
      />
    </div>
  )
}

/**
 * The round add control in the photo's corner.
 *
 * Always mounted rather than revealed on hover: a panel is used on phones as
 * much as on a desktop, and a control that only exists under a cursor does not
 * exist there at all.
 */
function AddButton({
  variable,
  href,
  pending,
  added,
  label,
  onAdd,
}: {
  variable: boolean
  href: string
  pending: boolean
  added: boolean
  label: string
  onAdd: (origin: HTMLElement) => void
}) {
  const shared =
    "absolute bottom-1.5 end-1.5 grid size-7 place-items-center rounded-full bg-background/95 text-foreground shadow-sm ring-1 ring-shop-hairline backdrop-blur-sm transition-colors hover:bg-foreground hover:text-background focus-visible:ring-3 focus-visible:ring-ring/50"

  // A variable product cannot be added without an option, so the control opens
  // the page where the options live rather than guessing one.
  if (variable) {
    return (
      <Link href={href} aria-label={label} className={shared}>
        <Plus className="size-4" aria-hidden />
      </Link>
    )
  }

  return (
    <m.button
      type="button"
      aria-label={label}
      disabled={pending}
      whileTap={{ scale: 0.88 }}
      className={cn(shared, added && "bg-foreground text-background")}
      onClick={(event) => {
        // Read synchronously: `currentTarget` is only valid for the duration of
        // the dispatch, and the handler awaits.
        onAdd(event.currentTarget)
      }}
    >
      {added ? (
        <Check className="size-4" aria-hidden strokeWidth={3} />
      ) : (
        <Plus className="size-4" aria-hidden />
      )}
    </m.button>
  )
}
