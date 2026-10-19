"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useQuery } from "@apollo/client/react"
import {
  CalendarDaysIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { centsToMajor } from "@/shared/lib/format"
import { VENDOR_AGENT_WEEKLY_INSIGHTS } from "@/features/ai/api/queries"
import { formatCalendarRange } from "@/features/ai/components/tool-cards/stats-format"
import { weeklyAnalyzePrompt } from "@/features/ai/lib/weekly-analyze-prompt"

interface DailyPoint {
  day: string
  /** Integer cents. */
  revenue_cents: number
  orders: number
}

interface Response {
  vendorAgentWeeklyInsights: {
    revenue_7d_cents: number
    revenue_prior_7d_cents: number
    revenue_change_pct: number | null
    orders_7d: number
    orders_prior_7d: number
    orders_change_pct: number | null
    daily: DailyPoint[]
  } | null
}

interface Props {
  /** Formats the day labels, and picks the language of the prompt "Analyze"
   * sends to the assistant. The card's own copy comes from next-intl. */
  locale: "ar" | "en"
  currency: string
  onSuggest: (prompt: string) => void
}

// The card's own compact presentation ("1,234 SAR"), not the Intl currency
// style the rest of the dashboard uses. Takes integer cents; the scaling
// happens here and nowhere else in this file.
function formatMoneyCents(cents: number, currency: string) {
  return `${centsToMajor(cents).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

function formatPct(pct: number) {
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

/**
 * The last 7 complete shop-local days (ending yesterday) against the 7 before
 * them. Today is the daily briefing's, which sits ABOVE this card in the
 * empty state, so a quiet morning never reads as a falling week.
 *
 * Bar shows last 7 days vs prior 7 days side-by-side; the relative
 * height communicates the delta at a glance even before reading the
 * percentage. Hidden entirely when the data is missing/erroring —
 * we don't want a half-broken card cluttering the empty state.
 */
export function WeeklyInsightsCard({ locale, currency, onSuggest }: Props) {
  const t = useTranslations("aiChat.weekly")
  const isAr = locale === "ar"
  const { data, loading } = useQuery<Response>(VENDOR_AGENT_WEEKLY_INSIGHTS, {
    fetchPolicy: "cache-and-network",
  })

  if (loading && !data) {
    return (
      <div className="w-full max-w-2xl h-20 rounded-xl border bg-muted/30 animate-pulse" />
    )
  }

  const w = data?.vendorAgentWeeklyInsights
  if (!w) return null

  // Skip rendering on brand-new shops — both windows zero would be
  // depressing and uninformative on a fresh install.
  if (
    w.revenue_7d_cents === 0 &&
    w.revenue_prior_7d_cents === 0 &&
    w.orders_7d === 0
  ) {
    return null
  }

  // The seven days the headline covers, so "full days" is visibly yesterday
  // backwards rather than today's partial one.
  const span =
    w.daily.length === 14
      ? formatCalendarRange(w.daily[7].day, w.daily[13].day, locale)
      : null

  return (
    <div className="w-full max-w-2xl rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <CalendarDaysIcon className="size-3.5" />
          <span>{t("title")}</span>
          {span && <span className="font-normal tabular-nums">{span}</span>}
        </div>
        <button
          type="button"
          onClick={() => onSuggest(weeklyAnalyzePrompt(w.daily, isAr))}
          className="text-[10px] text-primary hover:underline">
          {t("analyze")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ComparisonRow
          label={t("revenue")}
          current={formatMoneyCents(w.revenue_7d_cents, currency)}
          prior={formatMoneyCents(w.revenue_prior_7d_cents, currency)}
          pct={w.revenue_change_pct}
          series={w.daily.map((d) => d.revenue_cents)}
          days={w.daily.map((d) => d.day)}
          formatValue={(v) => formatMoneyCents(v, currency)}
          locale={locale}
        />
        <ComparisonRow
          label={t("orders")}
          current={w.orders_7d.toLocaleString()}
          prior={w.orders_prior_7d.toLocaleString()}
          pct={w.orders_change_pct}
          series={w.daily.map((d) => d.orders)}
          days={w.daily.map((d) => d.day)}
          formatValue={(v) => t("ordersValue", { count: v })}
          locale={locale}
        />
      </div>
    </div>
  )
}

/**
 * 14-bar sparkline. The first 7 bars are the prior week (muted),
 * the last 7 are the current week (accent). A 1px divider sits at
 * the boundary so the eye latches onto the comparison even before
 * the percentage is read.
 *
 * Hover state surfaces a small tooltip above the bar with the day
 * label + value. Implemented with React state instead of CSS-only
 * because the tooltip needs to render the localized date/number,
 * which a `title` attribute on a div would also do — but keeping
 * everything in the DOM makes the styling consistent with the rest
 * of the card.
 */
function Sparkline({
  series,
  days,
  formatValue,
  locale,
}: {
  series: number[]
  /** Matching length-14 array of YYYY-MM-DD labels from the server. */
  days: string[]
  /** Converts a raw number to display form (money, count, etc.). */
  formatValue: (v: number) => string
  locale: "ar" | "en"
}) {
  const t = useTranslations("aiChat.weekly")
  const peak = Math.max(1, ...series)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  return (
    <div className="relative h-10 mt-2">
      {hoverIndex !== null && (
        <div
          className="absolute -top-1 z-10 -translate-y-full -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[10px] shadow-sm whitespace-nowrap pointer-events-none"
          style={{ left: `${((hoverIndex + 0.5) / 14) * 100}%` }}>
          <div className="font-semibold">{formatValue(series[hoverIndex])}</div>
          <div className="text-muted-foreground">
            {formatDayLabel(days[hoverIndex], locale)}
            {hoverIndex < 7 && (
              <span className="ms-1">{t("priorWeek")}</span>
            )}
          </div>
        </div>
      )}
      <div className="flex items-end gap-px h-6 absolute bottom-0 inset-x-0">
        {series.map((v, i) => {
          const heightPct = (v / peak) * 100
          const isCurrent = i >= 7
          return (
            <div
              key={i}
              className="flex-1 relative flex items-end cursor-default"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}>
              {i === 7 && (
                <div className="absolute -start-px top-0 bottom-0 w-px bg-foreground/20" />
              )}
              <div
                className={cn(
                  "w-full rounded-sm transition",
                  isCurrent
                    ? "bg-emerald-500/70"
                    : "bg-muted-foreground/30",
                  hoverIndex === i &&
                    (isCurrent ? "bg-emerald-500" : "bg-muted-foreground/50"),
                )}
                style={{ height: `${Math.max(heightPct, 4)}%` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Render a YYYY-MM-DD day key as a short locale-aware label like
 * "Mon, Apr 22". Falls back gracefully if the input isn't ISO-shaped.
 */
function formatDayLabel(day: string, locale: "ar" | "en"): string {
  // Construct via local Date — the server emitted shop-local YYYY-MM-DD
  // and we want to render it the same way. UTC parsing would shift on
  // the date line.
  const [y, m, d] = day.split("-").map((s) => parseInt(s, 10))
  if (!y || !m || !d) return day
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(locale === "ar" ? "ar" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function ComparisonRow({
  label,
  current,
  prior,
  pct,
  series,
  days,
  formatValue,
  locale,
}: {
  label: string
  current: string
  prior: string
  pct: number | null | undefined
  series: number[]
  days: string[]
  formatValue: (v: number) => string
  locale: "ar" | "en"
}) {
  const t = useTranslations("aiChat.weekly")
  const hasPct = pct !== null && pct !== undefined
  const up = hasPct && pct >= 0

  return (
    <div className="rounded-lg bg-muted/40 p-3 space-y-1">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium">{label}</span>
        {hasPct && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-semibold",
              up ? "text-emerald-600" : "text-destructive",
            )}>
            {up ? (
              <TrendingUpIcon className="size-3" />
            ) : (
              <TrendingDownIcon className="size-3" />
            )}
            {formatPct(pct)}
          </span>
        )}
      </div>
      <div className="text-base font-semibold">{current}</div>
      <div className="text-[10px] text-muted-foreground">
        {t("prior", { value: prior })}
      </div>
      <Sparkline
        series={series}
        days={days}
        formatValue={formatValue}
        locale={locale}
      />
    </div>
  )
}
