"use client"

import Link from "next/link"
import { notFound, useParams } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon } from "lucide-react"
import { GET_ORDER_BY_ID } from "@/features/orders/api"
import type { Order, OrderResponse } from "@/features/orders/types"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/features/orders/components/list/order-status-badge"
import { formatDate, formatMoneyCents } from "@/features/orders/lib/list/format"
import {
  financialStatusKey,
  fulfillmentStatusKey,
} from "@/features/orders/lib/detail/fulfillment"
import { PlacedViaMark } from "../list/placed-via-mark"
import { OrderStatusActions } from "./order-status-actions"
import { OrderItemsCard } from "./order-items-card"
import { OrderSummaryCard } from "./order-summary-card"
import { OrderCustomerCard } from "./order-customer-card"
import { OrderAddressesCard } from "./order-addresses-card"
import { OrderCouponsCard } from "./order-coupons-card"
import { OrderRefundsCard } from "./order-refunds-card"
import { OrderUnappliedPaymentsCard } from "./order-unapplied-payments-card"
import { OrderFulfillmentCard } from "./order-fulfillment-card"
import { OrderShipmentsCard } from "@/features/shipments"
import { OrderBankTransfersCard } from "@/features/bank-transfers/components/order-bank-transfers-card"

export function OrderDetailView({ id }: { id: string }) {
  const t = useTranslations("orders")
  const { shopSlug } = useParams<{ shopSlug: string }>()
  const { data } = useSuspenseQuery<OrderResponse>(GET_ORDER_BY_ID, {
    variables: { id },
  })

  const order: Order | undefined = data?.order?.data
  if (!order) notFound()

  const financialKey = financialStatusKey(order.financial_status)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 size-8"
            nativeButton={false}
            render={
              <Link
                href={`/store/${shopSlug}/orders`}
                aria-label={t("detail.backToOrders")}
              />
            }
          >
            <ArrowLeftIcon className="size-4 rtl:rotate-180" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              {t("detail.title", { number: order.tracking_number })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("detail.placed", { date: formatDate(order.created_at) })}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.order_status} />
              <PaymentStatusBadge status={order.payment.status} />
              {/* Orthogonal to the two above: an order can be paid and
                  unfulfilled, or shipped and partially refunded. */}
              <Badge variant="outline">
                {t(fulfillmentStatusKey(order.fulfillment_status))}
              </Badge>
              {financialKey && (
                <Badge variant="outline">{t(financialKey)}</Badge>
              )}
              <PlacedViaMark placedVia={order.placed_via} />
              <span className="text-sm text-muted-foreground">
                {t("detail.total", {
                  amount: formatMoneyCents(order.pricing.total_cents),
                })}
              </span>
            </div>
          </div>
        </div>

        <OrderStatusActions order={order} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {/*
            First, because it is money that is not the shop's: a card payment
            the order never took, waiting to be refunded. It explains the
            "Refund needed" badge above, and renders nothing when there is
            none.
          */}
          <OrderUnappliedPaymentsCard order={order} />
          <OrderItemsCard order={order} />
          <OrderFulfillmentCard order={order} />
          {/*
            Directly under fulfillment, because a shipment executes one: the
            decision of what leaves which warehouse, then the parcel that
            carries it out. Reading them apart would separate two halves of the
            same act.
          */}
          <OrderShipmentsCard order={order} />
          <OrderCouponsCard order={order} />
          <OrderRefundsCard order={order} />
          {/*
            Bank review sits on the order — no separate queue. Placed with the
            payment summary so status and approve/reject stay in one place.
          */}
          {order.payment.gateway === "BANK_TRANSFER" && (
            <OrderBankTransfersCard
              orderId={order.id}
              instructions={order.payment_instructions}
            />
          )}
          <OrderSummaryCard order={order} />
        </div>

        <div className="flex flex-col gap-4">
          <OrderCustomerCard order={order} />
          <OrderAddressesCard order={order} />
        </div>
      </div>
    </div>
  )
}
