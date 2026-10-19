"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { Plus, ShoppingBag } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { imageRef } from "@/shared/lib/multilang"
import { useCart } from "@/features/cart/use-cart"
import { useAddToCartGesture } from "@/features/cart/use-add-gesture"
import { useShop } from "@/features/shop/shop-context"
import { isPurchasable, type ProductCard } from "../lib/product"

/**
 * Add-to-cart straight from a tile.
 *
 * A `VARIABLE` product cannot be added from here — the back-end wants a
 * `variation_option_id` and there is no honest way for a grid to pick one, so
 * the button becomes a link to the product page where the options live. Adding
 * the parent row instead would put a line in the cart that names a size nobody
 * chose.
 *
 * Nothing here refetches or refreshes on success: `addToCart` returns the whole
 * `CartEnvelope`, so the Apollo cache updates and the header badge repaints on
 * its own.
 *
 * **It is a white pill, whatever it is doing.** The tile lays it along the
 * bottom of a photograph, and every branch — live, pending, sold out, or the
 * link a variable product turns into — has to read as the same control in the
 * same place, or a grid of tiles becomes a grid of differently coloured bars.
 * The colours are the `--shop-photo-*` set, fixed rather than themed, because
 * the picture under the pill is the same in both themes.
 *
 * Two details that only matter because this component is rendered *per tile*:
 *
 * **The pending flag is local.** `useCart().mutating` is true whenever any cart
 * mutation is in flight, and every tile in the grid holds its own copy of the
 * hook — so using it here disabled all twenty-four buttons because one of them
 * was clicked. Only the tile that was actually pressed should go quiet.
 *
 * **Confirmation never waits for the round trip, and it is not the drawer.**
 * The badge has already moved (`addToCart` is optimistic about the count) and
 * the tile's photo is already flying towards it, so the shopper is answered on
 * the click rather than after the pricing engine has finished. The panel stays
 * shut (`reveal: false`): a grid is where a basket gets filled several tiles at
 * a time, and a drawer over the page after each one has to be dismissed before
 * the next tile can be reached. A toast covers the case where nothing moved —
 * reduced motion, or no bag mounted to fly to — so the add is never silent.
 */

const PILL =
  "h-10 w-full truncate rounded-full border-transparent bg-shop-photo-pill text-sm font-semibold text-shop-photo-pill-ink hover:bg-shop-photo-pill-hover hover:text-shop-photo-pill-ink focus-visible:ring-shop-accent/50"

export function QuickAddButton({
  product,
  className,
}: {
  product: ProductCard
  className?: string
}) {
  const t = useTranslations("product")
  const tCommon = useTranslations("common")
  const { base } = useShop()
  const { addItem } = useCart()
  const addGesture = useAddToCartGesture({ reveal: false })
  const [pending, setPending] = useState(false)
  const image = imageRef(product.image)

  if (!isPurchasable(product)) {
    return (
      <Button
        variant="secondary"
        size="lg"
        disabled
        // Its own opacity rather than the default `disabled:opacity-50`: a
        // half-transparent white pill over a photo takes the label down to
        // half-strength ink on whatever the picture is, which is not readable.
        className={cn(
          PILL,
          "bg-shop-photo-pill/75 text-shop-photo-pill-ink/60 disabled:opacity-100",
          className,
        )}
      >
        {t("outOfStock")}
      </Button>
    )
  }

  if (product.product_type === "VARIABLE") {
    return (
      <Button
        variant="secondary"
        size="lg"
        className={cn(PILL, className)}
        nativeButton={false}
        render={<Link href={`${base}/products/${product.slug}`} />}
      >
        <ShoppingBag />
        {t("addToCart")}
      </Button>
    )
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      className={cn(PILL, className)}
      disabled={pending}
      onClick={async (event) => {
        setPending(true)
        // Read synchronously: `currentTarget` is only valid for the duration of
        // the dispatch, and everything below this line is awaited.
        const flying = addGesture(
          event.currentTarget,
          image?.thumbnail ?? image?.original ?? null,
        )
        if (!flying) sileo.success({ title: t("addedToCart") })
        try {
          await addItem({ product_id: product.id, quantity: 1 })
        } catch {
          sileo.error({ title: tCommon("somethingWentWrong") })
        } finally {
          setPending(false)
        }
      }}
    >
      <Plus />
      {pending ? t("adding") : t("addToCart")}
    </Button>
  )
}
