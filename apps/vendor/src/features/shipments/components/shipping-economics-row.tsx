"use client"

import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { InfoIcon } from "lucide-react"

import { cn } from "@/shared/lib/utils"
import { formatMoneyCents } from "@/shared/lib/format"
import { GET_ORDER_SHIPPING_ECONOMICS } from "../api"
import type { OrderShippingEconomicsResponse } from "../types"

/**
 * What the shopper paid to have this order delivered, what the carriers billed,
 * and the gap.
 *
 * Three separate numbers on purpose. The charge is the shop's own decision
 * (zones and rates); the cost is a fact from the carrier; the subsidy is the
 * difference the shop absorbed. Showing one "shipping" figure would hide
 * exactly the thing a merchant needs to see.
 */
export function ShippingEconomicsRow({ orderId }: { orderId: string }) {
  const t = useTranslations("shipments.economics")

  const { data, error } = useQuery<OrderShippingEconomicsResponse>(
    GET_ORDER_SHIPPING_ECONOMICS,
    { variables: { order_id: orderId }, fetchPolicy: "cache-and-network" },
  )

  // Staff-only on the server. A caller without the permission is refused, and
  // rendering nothing is the right answer — this strip is not for them.
  if (error) return null

  const e = data?.orderShippingEconomics?.data
  if (!e) return null

  const knownCost = typeof e.actual_cost_cents === "number"
  const subsidy = e.merchant_subsidy_cents ?? 0
  const margin = e.merchant_margin_cents ?? 0

  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Figure label={t("charged")} value={formatMoneyCents(e.customer_charge_cents)} />
        <Figure
          label={t("cost")}
          // Never rendered as zero when unknown: a missing invoice is not a
          // free delivery, and showing 0 here would report the whole fee as
          // margin.
          value={knownCost ? formatMoneyCents(e.actual_cost_cents!) : t("unknown")}
          muted={!knownCost}
        />
        {knownCost && (
          <Figure
            label={subsidy > 0 ? t("subsidy") : t("margin")}
            value={formatMoneyCents(subsidy > 0 ? subsidy : margin)}
            className={subsidy > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}
          />
        )}
      </div>

      {/*
        A figure computed from only some of the order's shipments looks
        entirely finished. This is the only thing that says otherwise.
      */}
      {knownCost && !e.is_complete && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <InfoIcon className="mt-0.5 size-3 shrink-0" />
          {t("partial")}
        </p>
      )}
    </div>
  )
}

function Figure({
  label,
  value,
  muted,
  className,
}: {
  label: string
  value: string
  muted?: boolean
  className?: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-medium",
          muted && "text-muted-foreground",
          className,
        )}
      >
        {value}
      </p>
    </div>
  )
}
