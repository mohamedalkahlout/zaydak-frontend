"use client"

import { TargetIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@repo/ui/components/card"
import { formatTargetValue, metricUnit } from "../lib/targets"
import { resolvePeriodPreview } from "../lib/period-preview"
import type { TargetMetric, TargetPeriod } from "../types"

// The gauge is always drawn empty (a brand-new target has no progress yet); the
// muted arc + "— %" mirror Shopify's create-target preview.
const EMPTY_COLOR = "#c9cccf"

function moneySymbol(currency: string, locale: string): string {
  try {
    return (
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? ""
    )
  } catch {
    return ""
  }
}

/**
 * Live preview of a target as it is being created — name, Draft status, an
 * empty attainment gauge, and the resolved Current / Target / Time period /
 * Days left. Reads the in-progress form values directly (no server round trip),
 * so it updates as the merchant types.
 */
export function TargetPreviewCard({
  name,
  metric,
  value,
  period,
  start,
  end,
  currency,
}: {
  name: string
  metric: TargetMetric
  value: string
  period: TargetPeriod
  start: string
  end: string
  currency: string
}) {
  const t = useTranslations("targets")
  const locale = useLocale()
  const unit = metricUnit(metric)
  const { label: periodLabel, daysLeft } = resolvePeriodPreview(period, {
    start,
    end,
    locale,
  })

  const numeric = Number(value)
  const hasValue = value.trim() !== "" && Number.isFinite(numeric) && numeric > 0
  const symbol = unit === "money" ? moneySymbol(currency, locale) : ""

  const targetDisplay = hasValue
    ? unit === "money"
      ? formatTargetValue(Math.round(numeric * 100), unit, currency)
      : unit === "rate"
        ? `${numeric}%`
        : numeric.toLocaleString()
    : symbol
      ? `${symbol} —`
      : "—"
  const currentDisplay = symbol ? `${symbol} —` : "—"

  return (
    <Card className="gap-4" glow={false}>
      <div className="flex flex-col gap-4 px-4">
        <div>
          <p className="truncate font-heading text-base font-semibold">
            {name.trim() || t("create.untitled")}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full ring-2 ring-muted-foreground/40" />
            {t("statuses.DRAFT")}
          </p>
        </div>

        <div className="relative mx-auto size-44">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="78%"
              outerRadius="100%"
              data={[{ value: 0, fill: EMPTY_COLOR }]}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={16} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="font-heading text-3xl font-semibold text-muted-foreground tabular-nums">
              — %
            </span>
            <TargetIcon className="size-5 text-muted-foreground" />
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-4">
          <PreviewStat label={t("create.current")} value={currentDisplay} />
          <PreviewStat label={t("create.target")} value={targetDisplay} />
          <PreviewStat label={t("create.timePeriod")} value={periodLabel} />
          <PreviewStat label={t("create.daysLeft")} value={String(daysLeft)} />
        </dl>
      </div>
    </Card>
  )
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
