"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  CheckCircle2Icon,
  CircleDotIcon,
  ClockIcon,
  CopyIcon,
  CheckIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  HomeIcon,
  PackageIcon,
  RotateCcwIcon,
  ShoppingBagIcon,
  TruckIcon,
  XCircleIcon,
} from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
import { cn } from "@repo/ui/lib/utils"
import { formatDateTime } from "@/shared/lib/format"
import {
  SHIPMENT_LABEL_KEY,
  STATUS_CHIP_CLASS,
  STATUS_LABEL_KEY,
  displayStatus,
  moneyRefunded,
} from "../lib/status"

export interface OrderTimelineProps {
  order: {
    id: string
    tracking_number: string
    order_status: string
    financial_status: string
    fulfillment_status: string
    created_at: string
    updated_at?: string | null
    payment?: {
      status?: string | null
      gateway?: string | null
    } | null
    shipments?: Array<{
      id: string
      status: string
      carrier_name?: string | null
      tracking_number?: string | null
      tracking_url?: string | null
      shipped_at?: string | null
      delivered_at?: string | null
      created_at: string
    }> | null
  }
}

type StepState = "done" | "active" | "upcoming" | "cancelled" | "refunded"

interface TimelineStep {
  id: string
  title: string
  description: string
  icon: typeof ShoppingBagIcon
  state: StepState
  date?: string | null
}

export function OrderTimeline({ order }: OrderTimelineProps) {
  const t = useTranslations("orders")
  const locale = useLocale()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const status = displayStatus(order)
  const isCancelled = status === "cancelled"
  const isRefunded = status === "refunded"

  const financialStatus = order.financial_status.toLowerCase()
  const paymentStatus = order.payment?.status?.toLowerCase() ?? ""
  const isPaid =
    ["paid", "payment-success"].includes(financialStatus) ||
    paymentStatus === "paid"
  // The money came back — an order refunded in full, or a card payment that
  // could not be applied and was returned. Neither is "awaiting payment",
  // which is what the payment step used to say for both, and on a cancelled
  // order the banner is where the shopper learns their money is not lost.
  const refundedMoney = moneyRefunded(order)
  // Money arrived that did not fit the order, and the shop has been told
  // (`payment-mismatch`). The customer paid, so "awaiting payment" is the one
  // thing this step must not say — the payment line beside it already reads
  // "being checked by the shop".
  const paymentBeingChecked = paymentStatus === "payment-mismatch"
  // Said twice on a cancelled order — the banner, and the box that stands in
  // for a shipment — so it is decided once.
  const cancelledDesc = refundedMoney
    ? t("stepCancelledRefundedDesc")
    : t("stepCancelledDesc")

  const fulfillmentStatus = order.fulfillment_status.toLowerCase()
  const lifecycle = order.order_status.toLowerCase().replace(/^order[-_]/, "")

  const shipments = order.shipments ?? []
  const hasDeliveredShipment = shipments.some(
    (s) => s.status.toLowerCase() === "delivered",
  )
  const hasShippedShipment = shipments.some((s) =>
    ["shipped", "delivered"].includes(s.status.toLowerCase()),
  )

  const isDelivered =
    lifecycle === "delivered" ||
    lifecycle === "completed" ||
    hasDeliveredShipment

  const isShipped =
    isDelivered ||
    fulfillmentStatus === "fulfilled" ||
    fulfillmentStatus === "partial" ||
    lifecycle === "shipped" ||
    hasShippedShipment

  const isProcessing =
    isShipped ||
    lifecycle === "processing" ||
    lifecycle === "confirmed" ||
    isPaid

  const getStepState = (
    stepIndex: number, // 0: Placed, 1: Payment, 2: Processing, 3: Shipped, 4: Delivered
  ): StepState => {
    if (isCancelled) {
      if (stepIndex === 0) return "done"
      if (stepIndex === 1 && isPaid) return "done"
      return "cancelled"
    }

    if (isRefunded) {
      if (stepIndex <= 1) return "done"
      return "refunded"
    }

    if (stepIndex === 0) {
      return "done"
    }

    if (stepIndex === 1) {
      if (isPaid) return "done"
      return "active"
    }

    if (stepIndex === 2) {
      if (isShipped) return "done"
      if (isProcessing && isPaid) return "active"
      return "upcoming"
    }

    if (stepIndex === 3) {
      if (isDelivered) return "done"
      if (isShipped) return "active"
      return "upcoming"
    }

    if (stepIndex === 4) {
      if (isDelivered) return "done"
      return "upcoming"
    }

    return "upcoming"
  }

  const steps: TimelineStep[] = [
    {
      id: "placed",
      title: t("stepPlaced"),
      description: t("stepPlacedDesc"),
      icon: ShoppingBagIcon,
      state: getStepState(0),
      date: order.created_at,
    },
    {
      id: "payment",
      title: t("stepPayment"),
      description: refundedMoney
        ? t("stepPaymentRefunded")
        : paymentBeingChecked
          ? t("stepPaymentChecking")
          : isPaid
            ? t("stepPaymentPaid")
            : t("stepPaymentPending"),
      icon: CreditCardIcon,
      state: getStepState(1),
      date: isPaid ? (order.updated_at ?? order.created_at) : null,
    },
    {
      id: "processing",
      title: t("stepProcessing"),
      description: t("stepProcessingDesc"),
      icon: PackageIcon,
      state: getStepState(2),
    },
    {
      id: "shipped",
      title: t("stepShipped"),
      description: t("stepShippedDesc"),
      icon: TruckIcon,
      state: getStepState(3),
      date: shipments.find((s) => s.shipped_at)?.shipped_at ?? null,
    },
    {
      id: "delivered",
      title: t("stepDelivered"),
      description: t("stepDeliveredDesc"),
      icon: HomeIcon,
      state: getStepState(4),
      date: shipments.find((s) => s.delivered_at)?.delivered_at ?? null,
    },
  ]

  const handleCopyTracking = async (trackingNo: string, id: string) => {
    try {
      await navigator.clipboard.writeText(trackingNo)
      setCopiedId(id)
      sileo.success({ title: t("trackingCopied") })
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      // Fallback
    }
  }

  return (
    <section className="shop-panel overflow-hidden p-5 sm:p-6 mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-shop-hairline">
        <div>
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
            <ClockIcon className="size-5 text-shop-accent" />
            {t("timelineTitle")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("timelineSubtitle")}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            STATUS_CHIP_CLASS[status],
          )}
        >
          {t(STATUS_LABEL_KEY[status])}
        </span>
      </div>

      {/* Exceptional status banner: Cancelled or Refunded */}
      {isCancelled && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
          <XCircleIcon className="size-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-destructive">
              {t("stepCancelled")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {cancelledDesc}
            </p>
          </div>
        </div>
      )}

      {isRefunded && (
        <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <RotateCcwIcon className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
 <h3 className="text-sm font-semibold text-amber-700">
              {t("stepRefunded")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("stepRefundedDesc")}
            </p>
          </div>
        </div>
      )}

      {/* Progress Timeline Tracker */}
      <div className="mt-8 mb-4">
        {/* Horizontal on md+, vertical on mobile */}
        <div className="hidden md:grid md:grid-cols-5 relative">
          {/* Background connector line */}
          <div
            className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-muted z-0"
            aria-hidden
          />
          {steps.map((step, idx) => {
            const Icon = step.icon
            const isDone = step.state === "done"
            const isActive = step.state === "active"
            const isCancelledState = step.state === "cancelled" || step.state === "refunded"

            return (
              <div
                key={step.id}
                className="relative z-10 flex flex-col items-center text-center px-2"
              >
                {/* Node icon circle */}
                <div
                  className={cn(
                    "size-10 rounded-full flex items-center justify-center transition-all shadow-xs",
                    isDone && "bg-shop-in-stock text-white",
                    isActive &&
                      "bg-shop-accent text-white ring-4 ring-shop-accent/20 animate-pulse",
                    isCancelledState && "bg-destructive/10 text-destructive border border-destructive/30",
                    !isDone && !isActive && !isCancelledState && "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <CheckCircle2Icon className="size-5" />
                  ) : isActive ? (
                    <Icon className="size-5" />
                  ) : isCancelledState ? (
                    <XCircleIcon className="size-5" />
                  ) : (
                    <Icon className="size-5 opacity-60" />
                  )}
                </div>

                {/* Step title & info */}
                <span
                  className={cn(
                    "mt-3 text-xs font-semibold",
                    isDone && "text-foreground",
                    isActive && "text-shop-accent font-bold",
                    !isDone && !isActive && "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
                <p className="mt-1 text-[11px] text-muted-foreground max-w-[130px] leading-snug">
                  {step.description}
                </p>
                {step.date && (
                  <span className="mt-1.5 text-[10px] tabular-nums text-muted-foreground/80 font-medium">
                    {formatDateTime(step.date, locale)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Vertical list on small screens */}
        <div className="md:hidden flex flex-col space-y-6 relative pl-4 rtl:pl-0 rtl:pr-4">
          {/* Vertical connecting line */}
          <div
            className="absolute top-3 bottom-3 left-7 rtl:left-auto rtl:right-7 w-0.5 bg-muted -z-0"
            aria-hidden
          />
          {steps.map((step) => {
            const Icon = step.icon
            const isDone = step.state === "done"
            const isActive = step.state === "active"
            const isCancelledState = step.state === "cancelled" || step.state === "refunded"

            return (
              <div key={step.id} className="relative z-10 flex items-start gap-4">
                <div
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center shrink-0 shadow-xs",
                    isDone && "bg-shop-in-stock text-white",
                    isActive &&
                      "bg-shop-accent text-white ring-4 ring-shop-accent/20 animate-pulse",
                    isCancelledState && "bg-destructive/10 text-destructive border border-destructive/30",
                    !isDone && !isActive && !isCancelledState && "bg-muted text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <CheckCircle2Icon className="size-4" />
                  ) : isCancelledState ? (
                    <XCircleIcon className="size-4" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isDone && "text-foreground",
                        isActive && "text-shop-accent font-bold",
                        !isDone && !isActive && "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </span>
                    {step.date && (
                      <span className="text-[10px] tabular-nums text-muted-foreground font-medium">
                        {formatDateTime(step.date, locale)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Shipment details section */}
      <div className="mt-8 pt-6 border-t border-shop-hairline">
        <h3 className="font-heading text-sm font-semibold flex items-center gap-2 mb-3">
          <TruckIcon className="size-4 text-shop-accent" />
          {t("shipmentsTitle")}
        </h3>

        {shipments.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {shipments.map((shipment) => {
              const shipmentStatus = shipment.status.toLowerCase()
              const statusLabel =
                SHIPMENT_LABEL_KEY[shipmentStatus] ?? "shipmentPending"
              const trackingNumber =
                shipment.tracking_number ?? order.tracking_number
              const isCopied = copiedId === shipment.id

              return (
                <div
                  key={shipment.id}
                  className="rounded-xl border border-shop-hairline bg-muted/20 p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <TruckIcon className="size-3.5" />
                        {shipment.carrier_name || t("carrier")}
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {t(statusLabel)}
                      </Badge>
                    </div>

                    {trackingNumber && (
                      <div className="mt-2.5 flex items-center gap-2 bg-background/80 rounded-lg p-2 border border-shop-hairline">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-muted-foreground">
                            {t("trackingNo")}
                          </p>
                          <p className="text-xs font-mono font-semibold truncate select-all">
                            {trackingNumber}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            handleCopyTracking(trackingNumber, shipment.id)
                          }
                          title={t("copyTracking")}
                          aria-label={t("copyTracking")}
                        >
                          {isCopied ? (
                            <CheckIcon className="size-3.5 text-shop-in-stock" />
                          ) : (
                            <CopyIcon className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {shipment.shipped_at && (
                        <p>
                          <span className="font-medium text-foreground">
                            {t("shippedAt")}:{" "}
                          </span>
                          {formatDateTime(shipment.shipped_at, locale)}
                        </p>
                      )}
                      {shipment.delivered_at && (
                        <p>
                          <span className="font-medium text-foreground">
                            {t("deliveredAt")}:{" "}
                          </span>
                          {formatDateTime(shipment.delivered_at, locale)}
                        </p>
                      )}
                    </div>
                  </div>

                  {shipment.tracking_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-xs mt-1"
                      nativeButton={false}
                      render={
                        <a
                          href={shipment.tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <span>{t("trackPackage")}</span>
                      <ExternalLinkIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-shop-hairline bg-muted/10 p-4 text-xs text-muted-foreground flex items-center gap-3">
            <CircleDotIcon className="size-4 text-muted-foreground/60 shrink-0" />
            <p className="leading-relaxed">
              {isCancelled
                ? cancelledDesc
                : isRefunded
                  ? t("stepRefundedDesc")
                  : t("noShipmentsYet")}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
