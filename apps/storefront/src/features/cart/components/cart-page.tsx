"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Trash2, X } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"

import { formatMoney } from "@/shared/lib/format"
import { imageRef } from "@/shared/lib/multilang"
import { useShop } from "@/features/shop/shop-context"
import { useSignInGate } from "@/features/auth/use-sign-in-gate"
import { useCurrentUser } from "@/features/auth/use-current-user"
import { QuantityStepper } from "@/features/catalog/components/quantity-stepper"
import { CouponTicket } from "./coupon-ticket"
import { NegotiatedOfferBadge } from "./negotiated-offer-badge"
import { unavailableReasonLabel } from "../lib/unavailable-reason"
import { useCart, type CartLine } from "../use-cart"
import { useQuantityQueue } from "../use-quantity-queue"
import { useReminderLinkOpen } from "../use-reminder-link-open"
import { consumeMergeNotice } from "../adopt-guest-cart"

/**
 * The cart.
 *
 * Nothing on this page recomputes money. `summary` is what the server charged
 * itself with computing — subtotal, discount, tax, total — and the page renders
 * those fields verbatim. The one number it derives is a *line* total, which the
 * API also sends (`total_price_cents`), so even that is read rather than
 * multiplied.
 */
export function CartPage() {
  const t = useTranslations("cart")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const { base, currency } = useShop()
  const { isAuthenticated } = useCurrentUser()
  const requireSignIn = useSignInGate()
  const {
    items,
    summary,
    loading,
    mutating,
    updating,
    setQuantity,
    removeItem,
    clear,
  } = useCart()

  // Arriving from a recovery reminder's `?rc=` link: tell the merchant, once,
  // and drop the token from the address bar. See `useReminderLinkOpen`.
  useReminderLinkOpen()

  // A merge armed this before the navigation that landed here (or before the
  // page's `useAdoptRetry` reconciled it). It reads-and-clears so it is shown
  // exactly once, and only on the cart, where the replaced cart is actually on
  // screen. See `adopt-guest-cart.ts`.
  const [mergeNotice, setMergeNotice] = useState(false)
  useEffect(() => {
    if (!consumeMergeNotice()) return
    /* eslint-disable-next-line react-hooks/set-state-in-effect --
     * Restoring persisted state after hydration is the one case an effect is
     * still the answer for. This flag was written to `sessionStorage` by the
     * sign-in before a document load, so it cannot be read in a `useState`
     * initializer (the server-rendered page would never see it, and the two
     * sides would mismatch) and the page OWNS the value, so nothing external
     * emits the change to a `useSyncExternalStore`. Same exception as the
     * vendor's `signup-wizard` and `product-form`.
     */
    setMergeNotice(true)
  }, [])

  // One write per decision rather than per tap — see `useQuantityQueue`. The
  // quantity write is subtracted from the busy flag because the shopper is
  // meant to keep tapping through it.
  const quantity = useQuantityQueue(setQuantity, {
    onError: () => sileo.error({ title: tCommon("somethingWentWrong") }),
  })
  const blocking = mutating && !updating
  const unsettled = mutating || quantity.busy

  // The cart's own currency wins over the shop's: an order is priced in the
  // currency the cart was built in, and those only differ while a shop is
  // mid-migration — exactly when showing the stale one would be wrong.
  const activeCurrency = summary?.currency ?? currency

  if (loading && items.length === 0) return <CartSkeleton />

  if (items.length === 0) {
    return (
      <div className="shop-container py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
          />
          <Image
            src="/empty-cart.png"
            alt=""
            width={512}
            height={512}
            className="relative mx-auto block size-56 select-none object-contain rtl:-scale-x-100"
          />
          <h1 className="relative mt-4 font-heading text-shop-title font-semibold tracking-tight">
            {t("empty")}
          </h1>
          <p className="relative mx-auto mt-3 max-w-md text-shop-body text-muted-foreground">
            {t("emptyBody")}
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              className="rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
              nativeButton={false}
              render={<Link href={`${base}/products`} />}
            >
              {t("startShopping")}
            </Button>
            {!isAuthenticated && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => requireSignIn(`${base}/cart`)}
              >
                {tCommon("signIn")}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const unavailableCount = items.filter(
    (item) => item.status !== "AVAILABLE",
  ).length

  return (
    <div className="shop-container py-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-shop-title font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("item", { count: summary?.total_items ?? 0 })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="hover:text-shop-accent"
          disabled={mutating}
          onClick={async () => {
            try {
              await clear()
              sileo.success({ title: t("cleared") })
            } catch {
              sileo.error({ title: tCommon("somethingWentWrong") })
            }
          }}
        >
          <Trash2 />
          {t("clear")}
        </Button>
      </header>

      {mergeNotice && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-3xl bg-shop-accent-soft px-4 py-3 ring-1 ring-shop-hairline">
          <p className="text-sm leading-relaxed">{t("mergedNotice")}</p>
          <button
            type="button"
            onClick={() => setMergeNotice(false)}
            aria-label={tCommon("close")}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-card hover:text-shop-accent"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <CartLineRow
              key={item.id}
              item={item}
              quantity={quantity.quantityOf(item.id, item.quantity)}
              unsettled={quantity.isPending(item.id) || updating}
              currency={activeCurrency}
              disabled={blocking}
              onQuantity={(next) => quantity.set(item.id, next)}
              onRemove={async () => {
                // A queued write for a line that is leaving would only reprice
                // the cart around an item the shopper has just taken out.
                quantity.cancel(item.id)
                await removeItem(item.id)
                sileo.success({ title: t("removed") })
              }}
            />
          ))}
        </ul>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="shop-panel flex flex-col gap-4 p-6">
            <CouponBox />

            <dl
              aria-busy={unsettled}
              className={`flex flex-col gap-2 text-sm transition-opacity ${
                unsettled ? "opacity-50" : ""
              }`}
            >
              <SummaryRow
                label={t("subtotal")}
                value={formatMoney(
                  summary?.subtotal_price_cents ?? 0,
                  activeCurrency,
                  locale,
                )}
              />
              {(summary?.discount_cents ?? 0) > 0 && (
                <SummaryRow
                  label={t("discount")}
                  value={`− ${formatMoney(summary?.discount_cents ?? 0, activeCurrency, locale)}`}
                  emphasis="discount"
                />
              )}
              {(summary?.total_tax_amount_cents ?? 0) > 0 && (
                <SummaryRow
                  label={t("tax")}
                  value={formatMoney(
                    summary?.total_tax_amount_cents ?? 0,
                    activeCurrency,
                    locale,
                  )}
                />
              )}
              <div className="mt-1 border-t border-shop-hairline pt-3">
                <SummaryRow
                  label={t("total")}
                  value={formatMoney(
                    summary?.total_price_cents ?? 0,
                    activeCurrency,
                    locale,
                  )}
                  emphasis="total"
                />
              </div>
            </dl>

            {unavailableCount > 0 && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t("unavailableNote")}
              </p>
            )}

            <Button
              size="lg"
              className="h-11 w-full rounded-full bg-shop-accent text-base text-shop-accent-foreground hover:bg-shop-accent/90"
              nativeButton={false}
              render={
                <Link
                  href={`${base}/checkout`}
                  onClick={(event) => {
                    // Signed out, the guard would answer this navigation with
                    // the sign-in screen anyway — this asks here, over the
                    // cart, and comes back to checkout with the session.
                    if (requireSignIn(`${base}/checkout`)) event.preventDefault()
                  }}
                />
              }
            >
              {t("checkout")}
            </Button>
            <Link
              href={`${base}/products`}
              className="text-center text-sm text-muted-foreground hover:text-shop-accent"
            >
              {t("continueShopping")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

function CartLineRow({
  item,
  quantity,
  unsettled,
  currency,
  disabled,
  onQuantity,
  onRemove,
}: {
  item: CartLine
  /** The shopper's number, which runs ahead of `item.quantity` while tapping. */
  quantity: number
  /** True while this line's price belongs to a quantity that has moved on. */
  unsettled: boolean
  currency: string | null
  disabled: boolean
  onQuantity: (next: number) => void
  onRemove: () => void
}) {
  const t = useTranslations("cart")
  const locale = useLocale()
  const { base } = useShop()
  const image = imageRef(item.image)
  const unavailable = item.status !== "AVAILABLE"

  return (
    <li
      className={`shop-panel flex gap-4 p-5 ${unavailable ? "opacity-70" : ""}`}
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-shop-hairline sm:size-24">
        {image ? (
          <Image
            src={image.thumbnail ?? image.original}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {item.slug ? (
              <Link
                href={`${base}/products/${item.slug}`}
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
              <p className="mt-1 text-xs font-medium text-destructive">
                {unavailableReasonLabel(item.unavailable_reason, t)}
              </p>
            )}
            {item.is_ai_negotiated && (
              <div className="mt-1.5">
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
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper
            value={quantity}
            onChange={onQuantity}
            disabled={disabled || unavailable}
            className="h-9"
          />
          <span
            aria-busy={unsettled}
            className={`font-heading text-sm font-semibold tabular-nums transition-opacity ${
              unsettled ? "opacity-50" : ""
            }`}
          >
            {formatMoney(item.total_price_cents, currency, locale)}
          </span>
        </div>
      </div>
    </li>
  )
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: "total" | "discount"
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={
          emphasis === "total" ? "font-medium" : "text-muted-foreground"
        }
      >
        {label}
      </dt>
      <dd
        className={`tabular-nums ${
          emphasis === "total"
            ? "font-heading text-lg font-semibold"
            : emphasis === "discount"
              ? "text-shop-in-stock"
              : ""
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Discount code entry.
 *
 * The applied codes come from `summary.coupons`, so removing one is a mutation
 * rather than a local filter — the discount it was worth has to be recomputed
 * by the server, and the same code can be worth different amounts as the cart
 * changes.
 */
function CouponBox() {
  const t = useTranslations("cart")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const { summary, applyCoupon, removeCoupon, mutating } = useCart()
  const [code, setCode] = useState("")

  const coupons = summary?.coupons ?? []

  return (
    <div className="flex flex-col gap-2.5">
      <form
        className="flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault()
          const trimmed = code.trim()
          if (!trimmed) return
          try {
            await applyCoupon(trimmed)
            setCode("")
            sileo.success({ title: t("couponApplied") })
          } catch (error) {
            sileo.error({
              title: tCommon("somethingWentWrong"),
              description: error instanceof Error ? error.message : undefined,
            })
          }
        }}
      >
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t("couponPlaceholder")}
          aria-label={t("couponPlaceholder")}
          className="h-9"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
          disabled={mutating || !code.trim()}
        >
          {t("applyCoupon")}
        </Button>
      </form>

      {coupons.length > 0 && (
        <ul className="flex flex-col gap-2">
          {coupons.map((coupon) => (
            <li key={coupon.id}>
              <CouponTicket
                code={coupon.code}
                amount={formatMoney(
                  coupon.discount_cents,
                  summary?.currency,
                  locale,
                )}
                label={t("couponApplied")}
                removeLabel={t("removeCoupon")}
                disabled={mutating}
                onRemove={async () => {
                  await removeCoupon(coupon.id)
                  sileo.success({ title: t("couponRemoved") })
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CartSkeleton() {
  return (
    <div className="shop-container grid animate-pulse gap-8 py-10 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-28 rounded-3xl bg-muted ring-1 ring-shop-hairline" />
        ))}
      </div>
      <div className="h-64 rounded-3xl bg-muted ring-1 ring-shop-hairline" />
    </div>
  )
}
