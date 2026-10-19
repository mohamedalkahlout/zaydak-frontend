"use client"

import { useTranslations } from "next-intl"

import { cn } from "@/shared/lib/utils"
import type { OrderStatus } from "@/features/orders/types"
import {
  orderStatusKey,
  paymentStatusKey,
} from "@/features/orders/lib/list/status-labels"

// Shopify-style soft pills: tinted bg + darker foreground, no visible border.
const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  "order-pending": "bg-amber-100 text-amber-900",
  "order-processing": "bg-sky-100 text-sky-900",
  "order-at-local-facility": "bg-indigo-100 text-indigo-900",
  "order-out-for-delivery": "bg-violet-100 text-violet-900",
  "order-completed": "bg-emerald-100 text-emerald-900",
  "order-cancelled": "bg-zinc-100 text-zinc-700",
  "order-refunded": "bg-orange-100 text-orange-900",
  "order-failed": "bg-rose-100 text-rose-900",
}

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  "payment-pending": "bg-amber-100 text-amber-900",
  "payment-processing": "bg-sky-100 text-sky-900",
  "payment-success": "bg-emerald-100 text-emerald-900",
  "payment-completed": "bg-emerald-100 text-emerald-900",
  "payment-failed": "bg-rose-100 text-rose-900",
  "payment-reversal": "bg-orange-100 text-orange-900",
  "payment-refunded": "bg-orange-100 text-orange-900",
  "payment-cash-on-delivery": "bg-zinc-100 text-zinc-700",
  "payment-cash": "bg-zinc-100 text-zinc-700",
  "payment-wallet": "bg-indigo-100 text-indigo-900",
  "payment-awaiting-for-approval": "bg-amber-100 text-amber-900",
  "payment-mismatch": "bg-rose-100 text-rose-900",
}

function StatusPill({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Only the tints live here now. The words come from the same message key the
 * filter menu offering that status reads, so a badge and the chip that filtered
 * to it cannot disagree — which they did, in English, for every payment state
 * the two maps spelled differently.
 */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("orders")
  const key = orderStatusKey(status)
  // A status the server invents has no message and no tint; rendering the raw
  // id is what the English maps did, and it beats a missing-message path.
  const label = t.has(key) ? t(key) : status
  const style = ORDER_STATUS_STYLE[status] ?? "bg-zinc-100 text-zinc-700"
  return <StatusPill className={style}>{label}</StatusPill>
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const t = useTranslations("orders")
  const key = paymentStatusKey(status)
  const label = t.has(key) ? t(key) : status
  const style = PAYMENT_STATUS_STYLE[status] ?? "bg-zinc-100 text-zinc-700"
  return <StatusPill className={style}>{label}</StatusPill>
}
