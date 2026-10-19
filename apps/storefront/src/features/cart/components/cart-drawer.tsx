"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet"
import { cn } from "@repo/ui/lib/utils"

import { formatMoney } from "@/shared/lib/format"
import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config"
import { useCartDrawerStore } from "@/shared/stores/cart-drawer"
import { useShop } from "@/features/shop/shop-context"
import { useSignInGate } from "@/features/auth/use-sign-in-gate"
import { useCart } from "../use-cart"
import { useQuantityQueue } from "../use-quantity-queue"
import { CartMiniLine } from "./cart-mini-line"

/**
 * The cart, without leaving the page.
 *
 * It exists because adding something to a cart is not a destination: a shopper
 * mid-catalogue wants to confirm the thing landed and then keep browsing, and
 * navigating them to `/cart` to do that costs a full page transition each way.
 * So this is the *confirmation* surface and `/cart` stays the **editing** one —
 * the drawer deliberately carries no coupon box and no empty-cart button, both
 * of which are decisions worth a page rather than a side panel.
 *
 * Mounted once by `ShopShell` and opened through `useCartDrawerStore`, so a
 * `QuickAddButton` twelve tiles deep can open it without a callback chain.
 *
 * **The money renders as unsettled while a mutation is in flight.** `addToCart`
 * predicts only the item count (see `optimisticAdd`); the subtotal, discount
 * and tax come back from the pricing engine, so showing the previous figures at
 * full strength would present a stale total as a current one. Dimmed, and
 * `aria-busy`, says what is actually true: these numbers are about to move.
 */
export function CartDrawer() {
  const t = useTranslations("cart")
  const tCommon = useTranslations("common")
  const locale = resolveLocale(useLocale())
  const { base, currency } = useShop()
  const requireSignIn = useSignInGate()

  const open = useCartDrawerStore((s) => s.open)
  const setOpen = useCartDrawerStore((s) => s.setOpen)

  const { items, summary, loading, mutating, updating, setQuantity, removeItem } =
    useCart()

  // The `-`/`+` buttons answer on the tap and the write follows once the
  // tapping stops, so walking a line to five is one request rather than five.
  const quantity = useQuantityQueue(setQuantity, {
    onError: () => sileo.error({ title: tCommon("somethingWentWrong") }),
  })

  // A quantity write is subtracted from the busy flag: the shopper is meant to
  // keep tapping through it, and the queue — not a disabled button — is what
  // stops two writes for the same line overlapping.
  const blocking = mutating && !updating

  // Money is stale from the first tap, not from the request: the figures on
  // screen belong to the quantity the shopper has already moved past.
  const unsettled = mutating || quantity.busy

  // `SheetContent` takes physical sides only, and a cart drawer has to arrive
  // from the edge its trigger sits on — which flips with the writing direction.
  const side = LOCALE_DIRECTIONS[locale] === "rtl" ? "left" : "right"

  // The cart's own currency wins over the shop's: an order is priced in the
  // currency the cart was built in, and those only differ while a shop is
  // mid-migration — exactly when showing the stale one would be wrong.
  const activeCurrency = summary?.currency ?? currency
  const count = summary?.total_items ?? 0

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side={side}
        closeLabel={tCommon("close")}
        className={cn(
          "gap-0 p-0",
          // A floating panel, not a wall. Inset from every edge with all four
          // corners rounded, so the shop stays visible around it and the cart
          // reads as something laid *on* the page rather than a second screen
          // that replaced it.
          //
          // Every one of these is side-prefixed on purpose: the shared
          // `SheetContent` sets its geometry through `data-[side=*]:` variants,
          // which carry an attribute selector and therefore outrank a bare
          // utility of ours. Matching the prefix is what lets tailwind-merge
          // drop the base value instead of leaving two rules to fight.
          "data-[side=right]:inset-y-3 data-[side=right]:right-3 data-[side=right]:h-auto",
          "data-[side=left]:inset-y-3 data-[side=left]:left-3 data-[side=left]:h-auto",
          "data-[side=right]:w-[calc(100vw-1.5rem)] data-[side=left]:w-[calc(100vw-1.5rem)]",
          "data-[side=right]:sm:max-w-md data-[side=left]:sm:max-w-md",
          "overflow-hidden rounded-2xl border border-shop-hairline shadow-2xl",
          // The shared panel nudges 2.5rem and fades, which is right for a
          // console's settings sheet. A cart is the shop's other room, so this
          // one travels its whole width — and asymmetrically: 500ms in, 300ms
          // out. Arriving is the moment worth watching; leaving is a dismissal,
          // and a dismissal that takes as long as an arrival feels stuck.
          //
          // The travel is width *plus the inset*: a plain 100% parks the
          // panel's near edge exactly where its own gutter begins, leaving a
          // sliver of it on screen the whole time it is meant to be gone.
          "duration-500 data-ending-style:duration-300",
          "data-[side=right]:data-starting-style:translate-x-[calc(100%+0.75rem)] data-[side=right]:data-ending-style:translate-x-[calc(100%+0.75rem)]",
          "data-[side=left]:data-starting-style:-translate-x-[calc(100%+0.75rem)] data-[side=left]:data-ending-style:-translate-x-[calc(100%+0.75rem)]",
        )}
        // A warm scrim rather than the consoles' flat black wash: the page
        // behind it is paper, and neutral grey over paper reads as a dead
        // screenshot. The accent end is the same hue the buy button uses, so
        // the dimmed page still belongs to the shop.
        overlayClassName={cn(
          "bg-transparent bg-linear-to-tr from-shop-accent/25 to-foreground/25",
          "duration-500 data-ending-style:duration-300",
        )}
      >
        {/*
          `pe-12` clears the sheet's own close button, which is pinned to the
          panel's outer corner over this row.
        */}
        <SheetHeader className="flex-row items-center gap-3 border-b border-shop-hairline px-4 pe-12 py-3.5">
          <div className="min-w-0">
            <SheetTitle className="font-heading font-semibold tracking-tight">
              {t("title")}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs">
              {/*
                Re-keyed on the count so the pill replays its pop every time the
                number moves. Remounting is the only way to restart a CSS
                animation, and the cost here is one span holding a string —
                unlike the header badge, whose rolling digits must survive.
              */}
              <span
                key={count}
                className="inline-flex animate-in rounded-full bg-shop-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-shop-accent duration-300 fade-in zoom-in-95"
              >
                {t("item", { count })}
              </span>
            </SheetDescription>
          </div>
        </SheetHeader>

        {loading && items.length === 0 ? (
          <DrawerSkeleton />
        ) : items.length === 0 ? (
          <DrawerEmpty onNavigate={() => setOpen(false)} />
        ) : (
          <>
            <ul className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              {items.map((item) => (
                <CartMiniLine
                  key={item.id}
                  item={item}
                  quantity={quantity.quantityOf(item.id, item.quantity)}
                  unsettled={quantity.isPending(item.id) || updating}
                  currency={activeCurrency}
                  disabled={blocking}
                  onNavigate={() => setOpen(false)}
                  onQuantity={(next) => quantity.set(item.id, next)}
                  onRemove={async () => {
                    try {
                      // Nothing queued for a line matters once the line is
                      // going: sending it would reprice a cart around an item
                      // the shopper has just taken out.
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

            <SheetFooter className="gap-3 border-t border-shop-hairline p-4">
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
              <p className="-mt-1 text-xs text-muted-foreground">
                {t("totalsAtCheckout")}
              </p>

              <Button
                size="lg"
                className="h-11 w-full rounded-full bg-shop-accent text-base text-shop-accent-foreground hover:bg-shop-accent/90"
                nativeButton={false}
                render={
                  <Link
                    href={`${base}/checkout`}
                    onClick={(event) => {
                      // See `cart-panel`: the drawer closes either way.
                      if (requireSignIn(`${base}/checkout`))
                        event.preventDefault()
                      setOpen(false)
                    }}
                  />
                }
              >
                {t("checkout")}
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
                nativeButton={false}
                render={
                  <Link href={`${base}/cart`} onClick={() => setOpen(false)} />
                }
              >
                {t("viewCart")}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DrawerEmpty({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("cart")
  const { base } = useShop()

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <Image
        src="/empty-cart.png"
        alt=""
        width={512}
        height={512}
        className="size-40 select-none object-contain rtl:-scale-x-100"
      />
      <p className="mt-2 font-heading text-shop-title font-semibold tracking-tight">
        {t("empty")}
      </p>
      <p className="mt-1.5 text-shop-body text-muted-foreground">{t("emptyBody")}</p>
      <Button
        className="mt-5 rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
        nativeButton={false}
        render={<Link href={`${base}/products`} onClick={onNavigate} />}
      >
        {t("startShopping")}
      </Button>
    </div>
  )
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-3 p-4">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-3">
          <div className="size-16 shrink-0 rounded-xl bg-muted ring-1 ring-shop-hairline" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <div className="h-3.5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}
