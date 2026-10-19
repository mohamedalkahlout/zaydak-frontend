"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { ShoppingBag } from "lucide-react"

import { formatMoneyCents } from "@/shared/lib/format"
import { OrderStatusBadge } from "@/features/orders/components/list/order-status-badge"
import type { OrderStatus } from "@/features/orders/types"

import type { InboxThreadOrder } from "../types"

/**
 * The orders this conversation placed, under the thread's header.
 *
 * A merchant reading "تأكيد الطلب" in a chat used to have to search the
 * orders list for it; each one is now a link to its own page, with its number,
 * total and status. Nothing renders for a thread that never ordered.
 */
export function ThreadOrders({ orders }: { orders?: InboxThreadOrder[] }) {
  // Decided before any hook runs: most threads never ordered, and the strip's
  // own hooks (the route's shop, the locale) are not needed to draw nothing.
  if (!orders || orders.length === 0) return null
  return <OrderStrip orders={orders} />
}

function OrderStrip({ orders }: { orders: InboxThreadOrder[] }) {
  const t = useTranslations("whatsappInbox")
  const locale = useLocale()
  const { shopSlug } = useParams<{ shopSlug: string }>()

  return (
    <section
      aria-label={t("orders.label")}
      className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/20 px-4 py-2"
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ShoppingBag className="size-3.5" aria-hidden />
        {t("orders.label")}
      </span>
      {orders.map((order) => (
        <Link
          key={order.id}
          href={`/store/${shopSlug}/orders/${order.id}`}
          className="inline-flex items-center gap-2 rounded-md bg-card px-2 py-1 text-xs ring-1 ring-foreground/10 transition-colors hover:bg-muted"
        >
          <span dir="ltr" className="font-mono tabular-nums">
            #{order.tracking_number}
          </span>
          <span className="tabular-nums">
            {formatMoneyCents(order.total_cents, order.currency, locale)}
          </span>
          <OrderStatusBadge status={order.order_status as OrderStatus} />
        </Link>
      ))}
    </section>
  )
}
