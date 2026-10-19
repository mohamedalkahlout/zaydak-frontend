"use client"

import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  AlertTriangleIcon,
  PackageIcon,
  PackageXIcon,
  ReceiptIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { centsToMajor } from "@/shared/lib/format"
import { VENDOR_AGENT_BRIEFING } from "@/features/ai/api/queries"

interface BriefingResponse {
  vendorAgentBriefing: {
    time_of_day: "morning" | "afternoon" | "evening" | "night"
    orders_today: number
    revenue_today_cents: number
    revenue_total_cents: number
    low_stock_count: number
    new_customers_today: number
    out_of_stock_count: number
    pending_refunds_count: number
    revenue_change_pct: number | null
    orders_change_pct: number | null
    customers_change_pct: number | null
  } | null
}

interface Props {
  /** The language of the prompts a tile sends to the assistant. The card's
   * own copy comes from next-intl. */
  locale: "ar" | "en"
  vendorName?: string | null
  currency: string
  onSuggest: (prompt: string) => void
}

const TIMES_OF_DAY = ["morning", "afternoon", "evening", "night"] as const

// The tile's own compact presentation ("1,234 SAR"), not the Intl currency
// style the rest of the dashboard uses. Takes integer cents; the scaling
// happens here and nowhere else in this file.
function formatMoneyCents(cents: number, currency: string) {
  return `${centsToMajor(cents).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

function formatPct(pct: number) {
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

export function DailyBriefingCard({
  locale,
  vendorName,
  currency,
  onSuggest,
}: Props) {
  const t = useTranslations("aiChat")
  // Only for the prompts below: each tile sends the vendor's own question to
  // the assistant, and that message is not UI copy.
  const isAr = locale === "ar"
  const { data, loading } = useQuery<BriefingResponse>(VENDOR_AGENT_BRIEFING, {
    fetchPolicy: "cache-and-network",
  })

  if (loading && !data) {
    return (
      <div className="w-full max-w-2xl h-24 rounded-xl border bg-muted/30 animate-pulse" />
    )
  }

  const b = data?.vendorAgentBriefing
  if (!b) return null

  const timeOfDay = TIMES_OF_DAY.includes(b.time_of_day)
    ? b.time_of_day
    : "morning"
  const greeting = t(`briefing.greeting.${timeOfDay}`)
  const name = vendorName?.trim() ?? ""

  // ── Alert ribbon ────────────────────────────────────────
  // Compose 0-2 high-priority items to call out at the top of the card.
  // Order is by urgency: zero stock first (lost sales right now), then
  // pending refunds (customer-facing). Each is a clickable tile that
  // hands a follow-up prompt to the agent.
  type Alert = {
    icon: React.ReactNode
    label: string
    onClick: () => void
    tone: "danger" | "warn"
  }
  const alerts: Alert[] = []
  if (b.out_of_stock_count > 0) {
    alerts.push({
      tone: "danger",
      icon: <PackageXIcon className="size-3.5" />,
      label: t("briefing.outOfStock", { count: b.out_of_stock_count }),
      onClick: () =>
        onSuggest(
          isAr
            ? "وريني المنتجات اللي نفد مخزونها"
            : "Show products that are out of stock",
        ),
    })
  }
  if (b.pending_refunds_count > 0) {
    alerts.push({
      tone: "warn",
      icon: <ReceiptIcon className="size-3.5" />,
      label: t("briefing.pendingRefunds", { count: b.pending_refunds_count }),
      onClick: () =>
        onSuggest(
          isAr
            ? "وريني طلبات الاسترجاع المعلّقة"
            : "Show pending refund requests",
        ),
    })
  }

  // ── Trend chips ─────────────────────────────────────────
  // Each tile gets an optional "↑/↓ ±N%" chip showing today vs
  // yesterday. Null pct means we have no real comparison (yesterday
  // was zero) so we just don't render a chip — beats showing "+∞%".
  const renderTrend = (pct: number | null | undefined) => {
    if (pct === null || pct === undefined) return null
    const up = pct >= 0
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-[10px] font-semibold",
          up ? "text-emerald-600" : "text-destructive",
        )}>
        {up ? (
          <TrendingUpIcon className="size-3" />
        ) : (
          <TrendingDownIcon className="size-3" />
        )}
        {formatPct(pct)}
      </span>
    )
  }

  return (
    <div className="w-full max-w-2xl rounded-xl border bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent p-4 space-y-3">
      <div className="text-start flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">
            {name ? t("greeting.withName", { greeting, name }) : greeting}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("briefing.subtitle")}
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition",
                a.tone === "danger"
                  ? "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/15"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-400 hover:bg-amber-500/15",
              )}>
              {a.icon}
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-start">
        <MetricTile
          icon={<PackageIcon className="size-3.5" />}
          label={t("briefing.ordersToday")}
          value={b.orders_today.toLocaleString()}
          trailing={renderTrend(b.orders_change_pct)}
          onClick={() =>
            onSuggest(
              isAr
                ? "وريني تفاصيل طلبات اليوم"
                : "Show me today's order details",
            )
          }
        />
        <MetricTile
          icon={<TrendingUpIcon className="size-3.5" />}
          label={t("briefing.revenueToday")}
          value={formatMoneyCents(b.revenue_today_cents, currency)}
          trailing={renderTrend(b.revenue_change_pct)}
          onClick={() =>
            onSuggest(
              isAr
                ? "قارن إيرادات اليوم بأمس"
                : "Compare today's revenue vs yesterday",
            )
          }
        />
        <MetricTile
          icon={<AlertTriangleIcon className="size-3.5" />}
          label={t("briefing.lowStock")}
          value={b.low_stock_count.toLocaleString()}
          warn={b.low_stock_count > 0}
          onClick={() =>
            onSuggest(
              isAr
                ? "شو المنتجات اللي مخزونها ناقص؟"
                : "What's running low on stock?",
            )
          }
        />
        <MetricTile
          icon={<UsersIcon className="size-3.5" />}
          label={t("briefing.newCustomers")}
          value={b.new_customers_today.toLocaleString()}
          trailing={renderTrend(b.customers_change_pct)}
          onClick={() =>
            onSuggest(
              isAr
                ? "وريني إحصائيات العملاء الجدد"
                : "Show new customer analytics",
            )
          }
        />
      </div>
    </div>
  )
}

function MetricTile({
  icon,
  label,
  value,
  onClick,
  warn,
  trailing,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onClick: () => void
  warn?: boolean
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border bg-background hover:bg-muted/50 transition p-2.5 text-start">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span
          className={
            warn
              ? "text-base font-semibold text-amber-700 dark:text-amber-400"
              : "text-base font-semibold"
          }>
          {value}
        </span>
        {trailing}
      </div>
    </button>
  )
}
