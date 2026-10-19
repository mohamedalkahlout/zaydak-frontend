"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Bones } from "@/shared/components/bones"
import { cn } from "@/shared/lib/utils"
import { bpsToPercent, formatMoneyCents } from "@/shared/lib/format"
import type { SalesBreakdown } from "../types"

type NumericKey = {
  [K in keyof SalesBreakdown]: SalesBreakdown[K] extends number ? K : never
}[keyof SalesBreakdown]

interface RowDef {
  key: NumericKey
  /** Render the value as a subtraction (Discounts, Returns, COGS, Fees). */
  negative?: boolean
  /** Bold subtotal / total rows. */
  emphasis?: boolean
  /** Draw a top divider above the row (groups net / total / profit). */
  divider?: boolean
}

const ROWS: RowDef[] = [
  { key: "gross_sales_cents" },
  { key: "discounts_cents", negative: true },
  { key: "returns_cents", negative: true },
  { key: "net_sales_cents", emphasis: true, divider: true },
  { key: "shipping_cents" },
  { key: "taxes_cents" },
  { key: "total_sales_cents", emphasis: true, divider: true },
  // Profit block (Phase 1).
  { key: "cogs_cents", negative: true, divider: true },
  { key: "gross_profit_cents", emphasis: true },
  { key: "fees_cents", negative: true },
  { key: "net_profit_cents", emphasis: true, divider: true },
]

function formatValue(
  cents: number,
  currency: string,
  negative?: boolean,
): string {
  if (negative && cents > 0) return `-${formatMoneyCents(cents, currency)}`
  return formatMoneyCents(cents, currency)
}

export function SalesBreakdownCard({
  breakdown,
  loading,
  currency = "SAR",
}: {
  breakdown: SalesBreakdown | undefined
  loading?: boolean
  currency?: string
}) {
  const t = useTranslations("analytics")

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t("breakdown.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* One capture for the whole breakdown rather than a bone per value:
            the divider rows, the emphasised totals and the conditional margin /
            return-fee lines are all part of the shape worth reproducing. The
            inner conditions test `breakdown` alone — `loading` is now the
            wrapper's job, and it hides this subtree while the bones show. */}
        <Bones name="analytics-breakdown" loading={loading || !breakdown}>
          <div className="flex flex-col gap-1">
            {ROWS.map((row) => (
              <div
                key={row.key}
                className={cn(
                  "flex items-center justify-between py-1.5 text-sm",
                  row.divider && "mt-1 border-t border-border pt-2.5",
                )}
              >
                <span
                  className={cn(
                    "text-muted-foreground",
                    row.emphasis && "font-medium text-foreground",
                  )}
                >
                  {t(`breakdown.${row.key}`)}
                </span>
                <span
                  className={cn("tabular-nums", row.emphasis && "font-semibold")}
                >
                  {breakdown
                    ? formatValue(breakdown[row.key], currency, row.negative)
                    : null}
                </span>
              </div>
            ))}

            {breakdown ? (
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("breakdown.margin")}</span>
                <span className="tabular-nums">
                  {bpsToPercent(breakdown.margin_bps).toFixed(1)}%
                </span>
              </div>
            ) : null}

            {/* Informational: restocking fees kept on returns. returns_cents above
                is already net of these, so this line does not enter the sums. */}
            {breakdown && breakdown.return_fees_cents > 0 ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("breakdown.return_fees_cents")}</span>
                <span className="tabular-nums">
                  {formatMoneyCents(breakdown.return_fees_cents, currency)}
                </span>
              </div>
            ) : null}

            {breakdown &&
            (breakdown.is_estimated || breakdown.cost_coverage_bps < 10000) ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {t("breakdown.estimatedNote", {
                  count: breakdown.units_missing_cost,
                })}
              </p>
            ) : null}
          </div>
        </Bones>
      </CardContent>
    </Card>
  )
}
