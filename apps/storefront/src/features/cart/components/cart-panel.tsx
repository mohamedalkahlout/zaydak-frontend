"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { formatMoney } from "@/shared/lib/format"
import { resolveLocale } from "@/shared/i18n/config"
import { useCartDrawerStore } from "@/shared/stores/cart-drawer"
import { useShop } from "@/features/shop/shop-context"
import { useSignInGate } from "@/features/auth/use-sign-in-gate"
import { useCart } from "../use-cart"
import { useQuantityQueue } from "../use-quantity-queue"
import { CartMiniLine } from "./cart-mini-line"

/**
 * The bag, hanging off the header button that opened it.
 *
 * The other half of `CartDrawer` rather than a replacement for it: same store,
 * same `useCart`, same rules about unsettled money, and the same two ways out
 * (the cart page for editing, checkout for buying). What differs is where it
 * comes from — a sheet arrives from the page edge and covers the shop, this one
 * is pinned to the bag and leaves the page in view — so which one a shop wears
 * is one field on the store (`surface`) and nothing else.
 *
 * **It shows the first few lines and counts the rest.** A popover is anchored
 * to a fixed header, so its height is bounded by the viewport rather than by
 * how much is in the cart; scrolling twelve lines inside a panel that is itself
 * floating over the page is worse than saying how many are not shown and
 * handing over the page that lists them all. The drawer, which owns the whole
 * edge, keeps scrolling all of them.
 */

/** Lines drawn before the rest are counted instead. */
const PANEL_LINES = 4

export function CartPanel() {
  const t = useTranslations("cart")
  const tCommon = useTranslations("common")
  const locale = resolveLocale(useLocale())
  const { base, currency } = useShop()
  const requireSignIn = useSignInGate()

  const setOpen = useCartDrawerStore((s) => s.setOpen)
  const close = () => setOpen(false)

  const { items, summary, loading, mutating, updating, setQuantity, removeItem } =
    useCart()

  const quantity = useQuantityQueue(setQuantity, {
    onError: () => sileo.error({ title: tCommon("somethingWentWrong") }),
  })

  // Same two flags the drawer reads, and for the same reasons: a quantity write
  // is the one mutation the shopper keeps interacting with, and the money is
  // stale from the first tap rather than from the request.
  const blocking = mutating && !updating
  const unsettled = mutating || quantity.busy

  const activeCurrency = summary?.currency ?? currency
  const shown = items.slice(0, PANEL_LINES)
  const hidden = items.length - shown.length

  return (
    <div className="flex flex-col">
      <p className="px-4 pt-3.5 pb-2 font-mono text-[0.6875rem] font-medium tracking-widest text-shop-accent uppercase">
        {t("title")}
      </p>

      {loading && items.length === 0 ? (
        <PanelSkeleton />
      ) : items.length === 0 ? (
        <PanelEmpty onNavigate={close} />
      ) : (
        <>
          <ul className="flex max-h-[60vh] flex-col gap-3.5 overflow-y-auto px-4 pb-1">
            {shown.map((item) => (
              <CartMiniLine
                key={item.id}
                dense
                item={item}
                quantity={quantity.quantityOf(item.id, item.quantity)}
                unsettled={quantity.isPending(item.id) || updating}
                currency={activeCurrency}
                disabled={blocking}
                onNavigate={close}
                onQuantity={(next) => quantity.set(item.id, next)}
                onRemove={async () => {
                  try {
                    // Nothing queued for a line matters once the line is going:
                    // sending it would reprice a cart around an item the shopper
                    // has just taken out.
                    quantity.cancel(item.id)
                    await removeItem(item.id)
                    sileo.success({ title: t("removed") })
                  } catch {
                    sileo.error({ title: tCommon("somethingWentWrong") })
                  }
                }}
              />
            ))}
          </ul>

          {hidden > 0 && (
            <Link
              href={`${base}/cart`}
              onClick={close}
              className="px-4 pt-2 text-xs text-muted-foreground hover:text-shop-accent hover:underline"
            >
              {t("andMore", { count: hidden })}
            </Link>
          )}

          <div className="mt-3 border-t border-shop-hairline px-4 py-3.5">
            <div
              aria-busy={unsettled}
              aria-live="polite"
              className={cn(
                "flex items-baseline justify-between gap-4 transition-opacity",
                unsettled && "opacity-50",
              )}
            >
              <span className="text-sm font-medium">
                {unsettled ? t("updating") : t("subtotal")}
              </span>
              <span className="font-heading text-lg font-semibold tabular-nums">
                  {formatMoney(
                    summary?.subtotal_price_cents ?? 0,
                    activeCurrency,
                    locale,
                  )}
                </span>
              </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 w-full rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
                nativeButton={false}
                render={<Link href={`${base}/cart`} onClick={close} />}
              >
                {t("viewCart")}
              </Button>
              <Button
                className="h-10 w-full rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
                nativeButton={false}
                render={
                  <Link
                    href={`${base}/checkout`}
                    onClick={(event) => {
                      // The bag closes either way: the popup replaces it, and
                      // a cart panel left open behind a dialog is two overlays
                      // arguing over the same corner.
                      if (requireSignIn(`${base}/checkout`))
                        event.preventDefault()
                      close()
                    }}
                  />
                }
              >
                {t("checkout")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PanelEmpty({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("cart")
  const { base } = useShop()

  return (
    <div className="flex flex-col items-center px-6 pt-2 pb-6 text-center">
      <p className="font-heading font-semibold tracking-tight">{t("empty")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("emptyBody")}</p>
      <Button
        size="sm"
        className="mt-4 rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
        nativeButton={false}
        render={<Link href={`${base}/products`} onClick={onNavigate} />}
      >
        {t("startShopping")}
      </Button>
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3.5 px-4 pb-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-3">
          <div className="size-14 shrink-0 rounded-xl bg-muted ring-1 ring-shop-hairline" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <div className="h-3.5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
