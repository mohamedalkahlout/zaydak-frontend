"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { formatMoneyCents } from "@/shared/lib/format"
import { channelColor } from "@/features/attribution/lib/attribution"
import { Bones } from "@/shared/components/bones"
import type { AttributionReport } from "@/features/attribution/types"
import { EmptyRow } from "./card-states"

/**
 * Total sales by attribution channel (UTM-based last-touch) — the Shopify
 * "Total sales by channel/referrer" card. The full report (models, CAC/ROAS,
 * ad spend) lives on the attribution page.
 */
export function SalesByChannelCard({
  report,
  loading,
  viewHref,
}: {
  report?: AttributionReport
  loading?: boolean
  viewHref: string
}) {
  const t = useTranslations("analytics")
  const ta = useTranslations("attribution")

  const rows = report?.rows ?? []
  // Bars are shares of the POSITIVE revenue. A group can be negative (a
  // refund settled in the window against an order placed earlier), so the
  // net total would over-scale every other bar, and a negative width is
  // dropped by the browser and drawn as a full track.
  const positiveTotal = rows.reduce(
    (sum, row) => sum + Math.max(0, row.revenue_cents),
    0,
  )
  const currency = report?.currency ?? "SAR"

  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle>{t("channels.title")}</CardTitle>
        <Link
          href={viewHref}
          className="shrink-0 text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
        >
          {t("viewReport")}
        </Link>
      </CardHeader>
      <CardContent>
        <Bones
          name="analytics-sales-by-channel"
          loading={Boolean(loading) && !report}
        >
          <div className="flex flex-col gap-2">
            {rows.length === 0 ? (
              <EmptyRow label={t("empty")} />
            ) : (
              rows.map((row) => {
                const share =
                  positiveTotal > 0
                    ? (Math.max(0, row.revenue_cents) / positiveTotal) * 100
                    : 0
                return (
                  <div
                    key={row.key}
                    data-group={row.key}
                    className="flex flex-col gap-1 py-0.5"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">
                        {row.channel ? ta(`channels.${row.channel}`) : row.key}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatMoneyCents(row.revenue_cents, currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          data-bar
                          style={{
                            width: `${Math.max(0, Math.min(100, share))}%`,
                            backgroundColor: channelColor(row.channel),
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {t("channels.orders", { count: row.orders })}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Bones>
      </CardContent>
    </Card>
  )
}
