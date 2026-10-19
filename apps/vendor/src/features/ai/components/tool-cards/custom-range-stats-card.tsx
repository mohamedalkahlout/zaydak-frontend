import { useTranslations } from "next-intl"
import { CalendarRangeIcon } from "lucide-react"
import {
  isCustomRangeStatsV2,
  type CustomRangeStatsResult,
  type CustomRangeStatsResultV1,
  type CustomRangeStatsResultV2,
} from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"
import { ChannelBreakdown } from "./channel-breakdown"
import { StatTile } from "./stat-tile"
import {
  formatCalendarDate,
  formatCalendarRange,
  formatMoney,
} from "./stats-format"

interface Props {
  result: CustomRangeStatsResult
  currency: string
  /** Formats the range's dates. */
  locale: "ar" | "en"
}

/**
 * `get_custom_range_stats`, in either shape a conversation can hold. v2
 * (2026-09-29) counts sales on the same basis as `get_shop_stats` v2 and its
 * `end_date` is truly inclusive; v1 counted completed orders only, and its
 * revenue tile says so.
 */
export function CustomRangeStatsCard({ result, currency, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.customRange")
  const range = result.range ?? { start_date: "", end_date: null }

  // Both ends are the shop's calendar dates. An open end means "up to now".
  const label = range.end_date
    ? (formatCalendarRange(range.start_date, range.end_date, locale, true) ??
      t("range", { start: range.start_date, end: range.end_date }))
    : t("since", {
        date:
          formatCalendarDate(range.start_date, locale, true) ??
          range.start_date,
      })

  return (
    <ResultCardShell
      icon={CalendarRangeIcon}
      title={t("title")}
      accent="indigo"
      trailing={<span className="tabular-nums">{label}</span>}
      className="space-y-4 p-4"
    >
      {isCustomRangeStatsV2(result) ? (
        <RangeV2 result={result} currency={currency} />
      ) : (
        <RangeV1 result={result} currency={currency} />
      )}
    </ResultCardShell>
  )
}

function RangeV2({
  result,
  currency: fallbackCurrency,
}: {
  result: CustomRangeStatsResultV2
  currency: string
}) {
  const t = useTranslations("aiChat.toolCards.customRange")
  const s = useTranslations("aiChat.toolCards.salesStats")
  const currency = result.currency || fallbackCurrency
  const money = (amount: number) => formatMoney(amount, currency)

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label={s("sales")}
          value={money(result.total_revenue)}
          hint={
            result.returns > 0
              ? s("afterReturns", { amount: money(Math.abs(result.returns)) })
              : undefined
          }
          emphasis
        />
        <StatTile
          label={s("orders")}
          value={result.sale_orders.toLocaleString()}
          hint={
            result.total_orders !== result.sale_orders
              ? s("placedOf", { placed: result.total_orders.toLocaleString() })
              : undefined
          }
        />
        <StatTile
          label={s("averageOrder")}
          value={money(result.average_order_value)}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["completed", result.completed_orders],
            ["cancelled", result.cancelled_orders],
            ["failed", result.failed_orders],
          ] as const
        ).map(([key, value]) => (
          <div
            key={key}
            className="text-[10px] bg-muted px-2 py-0.5 rounded-full">
            <span className="text-muted-foreground">{t(key)}</span>
            <span className="ms-1 font-semibold">
              {(value ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <ChannelBreakdown slices={result.by_channel ?? []} currency={currency} />

      <p
        className="border-t pt-3 text-[11px] leading-snug text-muted-foreground"
        title={result.sales_basis || undefined}>
        {s("basis")}
      </p>
    </>
  )
}

function RangeV1({
  result,
  currency,
}: {
  result: CustomRangeStatsResultV1
  currency: string
}) {
  const t = useTranslations("aiChat.toolCards.customRange")
  const s = useTranslations("aiChat.toolCards.salesStats")

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label={t("revenue")}
          value={formatMoney(result.total_revenue, currency)}
          emphasis
        />
        <StatTile
          label={t("totalOrders")}
          value={result.total_orders.toLocaleString()}
        />
        <StatTile
          label={t("completed")}
          value={result.completed_orders.toLocaleString()}
        />
        <StatTile
          label={t("cancelled")}
          value={result.cancelled_orders.toLocaleString()}
        />
      </div>
      <p className="border-t pt-3 text-[11px] leading-snug text-muted-foreground">
        {s("legacyNote")}
      </p>
    </>
  )
}
