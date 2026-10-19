"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { X } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import { formatMoney } from "@/shared/lib/format"
import { imageRef } from "@/shared/lib/multilang"
import { useShop } from "@/features/shop/shop-context"
import { QuantityStepper } from "@/features/catalog/components/quantity-stepper"
import { NegotiatedOfferBadge } from "./negotiated-offer-badge"
import { unavailableReasonLabel } from "../lib/unavailable-reason"
import type { CartLine } from "../use-cart"

/**
 * One line of the cart, as the two *compact* surfaces draw it.
 *
 * The drawer and the header panel show the *same* row (`/cart` draws its own,
 * wider one — it has a full page of width to spend and is the editing surface) — photo, name, variation,
 * a stepper and the line total — and they have to keep showing the same one:
 * the unavailable notice, the pending-price dimming and the "cancel the queued
 * write before removing" ordering are all rules about a cart line, not about a
 * sheet or a popover. Two copies of them is two places for the next rule to be
 * added to only one.
 *
 * `dense` is the only thing the surfaces disagree on, and it is geometry alone:
 * the panel hangs off a 36px button and cannot spend the drawer's 64px photo.
 */
export function CartMiniLine({
  item,
  quantity,
  unsettled,
  currency,
  disabled,
  dense,
  onQuantity,
  onRemove,
  onNavigate,
}: {
  item: CartLine
  /** The shopper's number, which runs ahead of `item.quantity` while tapping. */
  quantity: number
  /** True while this line's price belongs to a quantity that has moved on. */
  unsettled: boolean
  currency: string | null
  disabled: boolean
  /** Tighter photo and stepper, for the header panel. */
  dense?: boolean
  onQuantity: (next: number) => void
  onRemove: () => void
  onNavigate: () => void
}) {
  const t = useTranslations("cart")
  const locale = useLocale()
  const { base } = useShop()
  const image = imageRef(item.image)
  const unavailable = item.status !== "AVAILABLE"

  return (
    <li className={cn("flex gap-3", unavailable && "opacity-70")}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-shop-hairline",
          dense ? "size-14" : "size-16",
        )}
      >
        {image ? (
          <Image
            src={image.thumbnail ?? image.original}
            alt=""
            fill
            sizes={dense ? "56px" : "64px"}
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {item.slug ? (
              <Link
                href={`${base}/products/${item.slug}`}
                onClick={onNavigate}
                className="line-clamp-2-title text-sm font-medium hover:underline"
              >
                {item.name}
              </Link>
            ) : (
              <p className="line-clamp-2-title text-sm font-medium">{item.name}</p>
            )}
            {item.variation_name && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.variation_name}
              </p>
            )}
            {unavailable && (
              <p className="mt-0.5 text-xs font-medium text-destructive">
                {unavailableReasonLabel(item.unavailable_reason, t)}
              </p>
            )}
            {item.is_ai_negotiated && (
              <div className="mt-1">
                <NegotiatedOfferBadge expiresAt={item.negotiated_expires_at} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={t("remove")}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-shop-accent-soft hover:text-shop-accent disabled:opacity-50"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <QuantityStepper
            value={quantity}
            onChange={onQuantity}
            disabled={disabled || unavailable}
            className="h-8"
          />
          <span
            aria-busy={unsettled}
            className={cn(
              "font-heading text-sm font-semibold tabular-nums transition-opacity",
              unsettled && "opacity-50",
            )}
          >
            {formatMoney(item.total_price_cents, currency, locale)}
          </span>
        </div>
      </div>
    </li>
  )
}
