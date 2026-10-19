"use client"

import { useTranslations } from "next-intl"
import { Heart } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { useWishlistToggle } from "../use-wishlist"

/**
 * The heart.
 *
 * **It saves for a signed-out visitor, with no detour and no prompt.** It used
 * to send them to the sign-in screen and back, because a locally-staged
 * wishlist would have been lost the moment they signed in — a real objection
 * while nothing carried the list over. `adoptGuestWishlist` carries it over, so
 * what is left of that argument is an interruption in the middle of browsing,
 * placed exactly where the cart has never put one.
 *
 * Nothing here branches on the session any more: `useWishlistToggle` answers
 * for both, and the toast is the same sentence either way, because from the
 * shopper's side the same thing happened.
 */
export function WishlistButton({
  productId,
  variationOptionId,
  variant = "icon",
  className,
}: {
  productId: string
  variationOptionId?: string | null
  /** `icon` for the tile overlay, `labeled` for the PDP's own row. */
  variant?: "icon" | "labeled"
  className?: string
}) {
  const t = useTranslations("product")
  const { saved, toggling, toggle } = useWishlistToggle(productId)

  async function onToggle(event: React.MouseEvent) {
    // The tile wraps the whole card in a link to the PDP; saving must not also
    // navigate there.
    event.preventDefault()
    event.stopPropagation()

    const next = await toggle(variationOptionId)
    if (next === null) return
    sileo.success({
      title: next ? t("addedToWishlist") : t("removedFromWishlist"),
    })
  }

  const label = saved ? t("saved") : t("saveForLater")

  if (variant === "labeled") {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={toggling}
        onClick={onToggle}
        aria-pressed={saved}
        className={cn(
          "h-11 rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent",
          className,
        )}
      >
        <Heart
          className={cn(saved && "fill-shop-accent text-shop-accent")}
        />
        {label}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={toggling}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm ring-1 ring-shop-hairline backdrop-blur transition-colors hover:text-shop-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        className,
      )}
    >
      <Heart
        className={cn("size-4", saved && "fill-shop-accent text-shop-accent")}
      />
    </button>
  )
}
