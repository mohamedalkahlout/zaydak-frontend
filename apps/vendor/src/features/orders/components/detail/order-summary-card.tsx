"use client"

import { useTranslations } from "next-intl"
import { gatewayLabel } from "@/features/bank-transfers/lib/gateway-label"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { Separator } from "@repo/ui/components/separator"
import type { Order } from "@/features/orders/types"
import {
  formatDate,
  formatMoneyCents,
} from "@/features/orders/lib/list/format"
import { paymentStatusKey } from "@/features/orders/lib/list/status-labels"
import { orderPaymentDueDate } from "@/features/orders/lib/detail/payment"
import { translatable } from "@/shared/lib/format"
import { OrderMarkPaidAction } from "./order-mark-paid-action"

/**
 * Name the method behind the fee, from the order's frozen snapshot — it
 * survives the shop editing or deleting its zones. A merchant override reads
 * as `customFee` ("Custom fee"): the fee was typed on the draft, not priced by
 * a rate.
 */
function shippingMethodLabel(order: Order, customFee: string): string | null {
  const method = order.shipping_method
  if (!method) return null
  if (method.source === "merchant_override") return customFee
  const name = translatable(
    method.name as { en?: string; ar?: string } | null | undefined,
  )
  return name || null
}

export function OrderSummaryCard({ order }: { order: Order }) {
  const t = useTranslations("bankTransfers")
  // The same key the list's PaymentStatusBadge reads. This card used to hold a
  // third spelling of the payment states, which is how one order could be
  // "Cash on delivery" here and "COD" on the row that led to it.
  const tOrders = useTranslations("orders")
  const tSummary = useTranslations("orders.summary")
  const { pricing, payment } = order
  const paymentKey = paymentStatusKey(payment.status)
  const paymentLabel = tOrders.has(paymentKey)
    ? tOrders(paymentKey)
    : payment.status
  const methodLabel = shippingMethodLabel(order, tSummary("customFee"))
  const tSettle = useTranslations("orders.settle")
  // Only an unpaid INVOICE order shows when its payment falls due; once it is
  // settled the date is history, not something to act on.
  const dueDate =
    payment.status === "payment-pending" ? orderPaymentDueDate(order) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tSummary("heading")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <Row
          label={tSummary("subtotal")}
          value={formatMoneyCents(pricing.subtotal_cents)}
        />
        {pricing.discount_cents != null && pricing.discount_cents > 0 && (
          <Row
            label={tSummary("discounts")}
            value={`- ${formatMoneyCents(pricing.discount_cents)}`}
          />
        )}
        {pricing.tax_cents != null && pricing.tax_cents > 0 && (
          <Row
            label={tSummary("tax")}
            value={formatMoneyCents(pricing.tax_cents)}
          />
        )}
        {pricing.delivery_fee_cents != null && pricing.delivery_fee_cents > 0 && (
          <Row
            label={
              methodLabel
                ? tSummary("shippingVia", { method: methodLabel })
                : tSummary("shipping")
            }
            value={formatMoneyCents(pricing.delivery_fee_cents)}
          />
        )}

        <Separator className="my-1" />
        <Row
          label={
            <span className="font-medium text-foreground">
              {tSummary("total")}
            </span>
          }
          value={
            <span className="font-semibold">
              {formatMoneyCents(pricing.total_cents)}
            </span>
          }
        />
        {pricing.paid_total_cents != null && (
          <Row
            label={tSummary("paid")}
            value={formatMoneyCents(pricing.paid_total_cents)}
          />
        )}

        <Separator className="my-1" />
        <Row
          label={tSummary("paymentMethod")}
          value={gatewayLabel(payment.gateway === "BANK_TRANSFER" ? payment.gateway : payment.altered_gateway || payment.gateway, t)}
        />
        <Row label={tSummary("paymentStatus")} value={paymentLabel} />
        {dueDate ? (
          <Row label={tSettle("dueDate")} value={formatDate(dueDate)} />
        ) : null}
        {/* Renders nothing unless the payment is pending and settleable. */}
        <div className="flex justify-end pt-1 empty:hidden">
          <OrderMarkPaidAction order={order} />
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}
