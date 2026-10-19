"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Receipt } from "lucide-react"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { formatDate, formatMoney } from "@/shared/lib/format"
import { imageRef, text } from "@/shared/lib/multilang"
import { useShop } from "@/features/shop/shop-context"
import { MY_ORDERS } from "../api"
import {
  STATUS_CHIP_CLASS,
  STATUS_LABEL_KEY,
  displayStatus,
  moneyRefunded,
} from "../lib/status"
import type { StorefrontMyOrdersQuery } from "@/shared/api/generated/graphql"

type OrderRow = StorefrontMyOrdersQuery["orders"]["data"][number]

/**
 * Order history.
 *
 * `as_customer: true` is the whole scope and it is not optional. Without it the
 * back-end answers "orders my shops received", which is the right question for
 * the vendor dashboard and the wrong one here — a vendor shopping in someone
 * else's storefront got their own sales, or nothing at all. With it the scope
 * is the caller's id off the token, so no `customer_id` filter is sent (it
 * would be both redundant and an argument inviting someone to try another id).
 * `shop_id` is not sent either: `X-SHOP` is already on the request from the
 * Apollo link and the back-end scopes the buyer list to it, which is what keeps
 * a shop's order page about that shop.
 */
export function OrdersPage() {
  const t = useTranslations("orders")
  const { base } = useShop()

  const { data, loading } = useQuery(MY_ORDERS, {
    variables: { filters: { as_customer: true, page: 1, limit: 20 } },
    fetchPolicy: "cache-and-network",
  })

  const orders = data?.orders.data ?? []

  if (loading && orders.length === 0) {
    return (
      <div className="shop-container flex animate-pulse flex-col gap-3 py-10">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-28 rounded-3xl bg-muted ring-1 ring-shop-hairline"
          />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="shop-container py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
          />
          <span
            aria-hidden
            className="relative mx-auto grid size-14 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
          >
            <Receipt className="size-6" strokeWidth={1.5} />
          </span>
          <h1 className="relative mt-6 font-heading text-shop-title font-semibold tracking-tight">
            {t("empty")}
          </h1>
          <p className="relative mx-auto mt-3 max-w-md text-shop-body leading-relaxed text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Button
            className="relative mt-8 rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
            nativeButton={false}
            render={<Link href={`${base}/products`} />}
          >
            {t("viewDetails")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="shop-container py-10">
      <h1 className="mb-8 font-heading text-shop-title font-semibold tracking-tight">
        {t("title")}
      </h1>
      <ul className="flex flex-col gap-3">
        {orders.map((order) => (
          <OrderRowCard key={order.id} order={order} />
        ))}
      </ul>
    </div>
  )
}

function OrderRowCard({ order }: { order: OrderRow }) {
  const t = useTranslations("orders")
  const locale = useLocale()
  const { base } = useShop()

  const status = displayStatus(order)
  const itemCount = order.products.reduce(
    (total, line) => total + line.order_quantity,
    0,
  )

  return (
    <li className="shop-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {t("order", { tracking: order.tracking_number })}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("placedOn", { date: formatDate(order.created_at, locale) })} ·{" "}
            {t("items", { count: itemCount })}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              STATUS_CHIP_CLASS[status],
            )}
          >
            {t(STATUS_LABEL_KEY[status])}
          </span>
          {/* Cancelled outranks refunded in `displayStatus`, so a cancelled
              order whose money came back — a card payment that arrived after
              it closed, say — read "Cancelled" and nothing else here. The
              quieter chip says what the shopper most wants to know. */}
          {status === "cancelled" && moneyRefunded(order) && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {t("paymentRefunded")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {order.products.slice(0, 5).map((line) => {
          const image = imageRef(line.image)
          return (
            <div
              key={line.id}
              className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-shop-hairline"
              title={text(line.name, locale)}
            >
              {image ? (
                <Image
                  src={image.thumbnail ?? image.original}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : null}
            </div>
          )
        })}
        {order.products.length > 5 && (
          <span className="text-xs text-muted-foreground">
            +{order.products.length - 5}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-shop-hairline pt-4">
        <span className="text-sm">
          <span className="text-muted-foreground">{t("total")}: </span>
          <span className="font-heading font-semibold tabular-nums">
            {formatMoney(order.pricing.total_cents, order.currency, locale)}
          </span>
        </span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
          nativeButton={false}
          render={<Link href={`${base}/account/orders/${order.id}`} />}
        >
          {t("viewDetails")}
        </Button>
      </div>
    </li>
  )
}
