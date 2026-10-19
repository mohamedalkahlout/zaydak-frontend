"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@repo/ui/components/badge"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import { cn } from "@/shared/lib/utils"
import type { NegotiationOutcome } from "../types"
import { offerStatusClassName } from "../lib/outcomes"

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string

const MONEY_CELL = "text-end tabular-nums whitespace-nowrap"
const MONEY_HEAD = "text-end"

/**
 * Columns for the outcomes table.
 *
 * "Discount from list" and "Margin over cost" sit side by side under their own
 * headings because they are different numbers — the first is what the
 * customer saved, the second what the shop kept — and the one screen that
 * shows both must not let them be read as one.
 */
export function negotiationOutcomeColumns(args: {
  shopSlug: string
  t: Translate
  /** Drill into one product: the report filtered to it. */
  onProduct?: (row: NegotiationOutcome) => void
}): ColumnDef<NegotiationOutcome>[] {
  const { shopSlug, t, onProduct } = args
  return [
    {
      id: "created_at",
      header: t("columns.date"),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "product",
      header: t("columns.product"),
      cell: ({ row }) => (
        <div className="flex min-w-40 flex-col">
          {onProduct ? (
            <button
              type="button"
              title={t("filters.onlyThisProduct")}
              className="text-start font-medium underline-offset-4 hover:underline"
              onClick={() => onProduct(row.original)}
            >
              {row.original.product_title}
            </button>
          ) : (
            <span className="font-medium">{row.original.product_title}</span>
          )}
          {row.original.variation_title ? (
            <span className="text-xs text-muted-foreground">
              {row.original.variation_title}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "customer",
      header: t("columns.customer"),
      cell: ({ row }) => {
        const { customer_label, is_guest } = row.original
        if (!customer_label) {
          return <span className="text-muted-foreground">—</span>
        }
        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {is_guest ? (
              <span className="text-xs text-muted-foreground">{t("guest")}</span>
            ) : null}
            <span dir="ltr" className="font-mono text-xs">
              {customer_label}
            </span>
          </span>
        )
      },
    },
    {
      id: "channel",
      header: t("columns.channel"),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {t(`channel.${row.original.channel}`)}
        </span>
      ),
    },
    {
      id: "rounds",
      header: t("columns.rounds"),
      meta: { headClassName: MONEY_HEAD, cellClassName: MONEY_CELL },
      cell: ({ row }) => `${row.original.rounds}/${row.original.max_rounds}`,
    },
    {
      id: "session_status",
      header: t("columns.status"),
      cell: ({ row }) => (
        <Badge variant="outline">
          {t(`sessionStatus.${row.original.session_status}`)}
        </Badge>
      ),
    },
    {
      id: "list_price",
      header: t("columns.listPrice"),
      meta: { headClassName: MONEY_HEAD, cellClassName: MONEY_CELL },
      cell: ({ row }) =>
        formatMoneyCents(row.original.list_price_cents, row.original.currency),
    },
    {
      id: "final_price",
      header: t("columns.finalPrice"),
      meta: { headClassName: MONEY_HEAD, cellClassName: MONEY_CELL },
      cell: ({ row }) => {
        const { final_price_cents, last_offer_cents, currency } = row.original
        if (final_price_cents != null) {
          return (
            <span className="font-medium">
              {formatMoneyCents(final_price_cents, currency)}
            </span>
          )
        }
        // No deal was struck: say what was on the table rather than print a
        // "final" price nobody agreed to.
        if (last_offer_cents != null) {
          return (
            <span className="text-xs text-muted-foreground">
              {t("lastOffer", {
                price: formatMoneyCents(last_offer_cents, currency),
              })}
            </span>
          )
        }
        return <span className="text-muted-foreground">—</span>
      },
    },
    {
      id: "quantity",
      header: t("columns.quantity"),
      meta: { headClassName: MONEY_HEAD, cellClassName: MONEY_CELL },
      cell: ({ row }) => row.original.quantity ?? "—",
    },
    {
      id: "offer_status",
      header: t("columns.offer"),
      cell: ({ row }) => {
        const status = row.original.offer_status
        // Spent on an order that was since cancelled, failed or refunded: it
        // still reads USED, and reading "Redeemed" would claim a sale that
        // did not stand.
        if (row.original.order_unwound) {
          return (
            <Badge className={offerStatusClassName("CANCELLED")}>
              {t("offerStatus.unwound")}
            </Badge>
          )
        }
        return (
          <Badge className={offerStatusClassName(status)}>
            {t(`offerStatus.${status ?? "none"}`)}
          </Badge>
        )
      },
    },
    {
      id: "discount",
      header: () => (
        <span title={t("columns.discountHint")}>{t("columns.discount")}</span>
      ),
      meta: { headClassName: MONEY_HEAD, cellClassName: MONEY_CELL },
      cell: ({ row }) => (
        <span className={cn(row.original.order_unwound && "line-through opacity-60")}>
          {formatMoneyCents(row.original.discount_cents, row.original.currency)}
        </span>
      ),
    },
    {
      id: "margin",
      header: () => (
        <span title={t("columns.marginHint")}>{t("columns.margin")}</span>
      ),
      meta: { headClassName: MONEY_HEAD, cellClassName: MONEY_CELL },
      cell: ({ row }) => {
        const { margin_cents, currency } = row.original
        return (
          <span
            className={cn(
              margin_cents != null && margin_cents < 0 && "text-destructive",
              // Never kept: the order unwound.
              row.original.order_unwound && "line-through opacity-60",
            )}
          >
            {formatMoneyCents(margin_cents, currency)}
          </span>
        )
      },
    },
    {
      id: "order",
      header: t("columns.order"),
      cell: ({ row }) =>
        row.original.order_id ? (
          <Link
            href={`/store/${shopSlug}/orders/${row.original.order_id}`}
            className="whitespace-nowrap text-primary underline-offset-4 hover:underline"
          >
            {t("viewOrder")}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]
}
