import { useTranslations } from "next-intl"
import { BarChart3Icon } from "lucide-react"
import {
  isShopStatsV2,
  type OrdersByStatus,
  type ShopStatsResult,
  type ShopStatsResultV1,
  type ShopStatsResultV2,
} from "@/features/ai/lib/types"
import { useOrderStatusLabel } from "./labels"
import { ResultCardShell } from "./result-card-shell"
import { ChannelBreakdown } from "./channel-breakdown"
import { StatTile } from "./stat-tile"
import { formatCalendarRange, formatMoney } from "./stats-format"

interface Props {
  result: ShopStatsResult
  currency: string
  /** Formats the window's dates. */
  locale: "ar" | "en"
}

/**
 * `get_shop_stats`, in either of the two shapes a conversation can hold.
 *
 * v2 (2026-09-29) scopes every figure to one shop-local window, so the period
 * sits in the header with the dates it covers. v1 — still in every thread
 * persisted before then — scoped only the status chips: its revenue and order
 * count were lifetime and its new customers a fixed 30 days. Putting the
 * period over those tiles is exactly how "this week's sales" was read off a
 * lifetime total, so a v1 card names each tile's real scope instead and
 * carries the period on the chips alone.
 */
export function ShopStatsCard({ result, currency, locale }: Props) {
  return isShopStatsV2(result) ? (
    <ShopStatsV2 result={result} currency={currency} locale={locale} />
  ) : (
    <ShopStatsV1 result={result} currency={currency} />
  )
}

function usePeriodLabel() {
  const t = useTranslations("aiChat.toolCards.shopStats.period")
  return (period: string) => (t.has(period) ? t(period) : null)
}

function ShopStatsV2({
  result,
  currency: fallbackCurrency,
  locale,
}: {
  result: ShopStatsResultV2
  currency: string
  locale: "ar" | "en"
}) {
  const t = useTranslations("aiChat.toolCards.shopStats")
  const s = useTranslations("aiChat.toolCards.salesStats")
  const periodLabel = usePeriodLabel()
  // The payload names the currency its amounts are in; the shop's cached
  // currency is only the fallback (the shared view has none).
  const currency = result.currency || fallbackCurrency
  const money = (amount: number) => formatMoney(amount, currency)

  const { revenue, orders } = result
  const dates = formatCalendarRange(
    result.window?.from_date,
    result.window?.to_date,
    locale,
  )
  const period = periodLabel(result.period)

  return (
    <ResultCardShell
      icon={BarChart3Icon}
      title={t("title")}
      trailing={
        period || dates ? (
          <span className="flex items-center gap-1.5">
            {period && (
              <span className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground ring-1 ring-border">
                {period}
              </span>
            )}
            {dates && <span className="tabular-nums">{dates}</span>}
          </span>
        ) : undefined
      }
      accent="indigo"
      className="space-y-4 p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label={s("sales")}
          value={money(revenue.period_sales)}
          hint={
            revenue.period_returns > 0
              ? s("afterReturns", {
                  amount: money(Math.abs(revenue.period_returns)),
                })
              : undefined
          }
          emphasis
        />
        <StatTile
          label={s("orders")}
          value={orders.counted_as_sales.toLocaleString()}
          hint={
            orders.placed !== orders.counted_as_sales
              ? s("placedOf", { placed: orders.placed.toLocaleString() })
              : undefined
          }
        />
        <StatTile
          label={s("averageOrder")}
          value={money(revenue.average_order_value)}
        />
        <StatTile
          label={t("newCustomers")}
          value={result.new_customers.toLocaleString()}
        />
      </div>

      <ChannelBreakdown slices={result.by_channel ?? []} currency={currency} />

      <StatusChips byStatus={orders.by_status} />

      <div className="space-y-1 border-t pt-3 text-[11px] leading-snug text-muted-foreground">
        <p className="tabular-nums">
          {t("lifetime", {
            sales: money(revenue.lifetime_sales),
            orders: orders.lifetime_placed,
          })}
        </p>
        {/* Our own translation of the basis. The server's sentence is what
            the model was told, in English only, so it rides as the hover
            title rather than as the copy. */}
        <p title={result.sales_basis || undefined}>{s("basis")}</p>
      </div>
    </ResultCardShell>
  )
}

function ShopStatsV1({
  result,
  currency,
}: {
  result: ShopStatsResultV1
  currency: string
}) {
  const t = useTranslations("aiChat.toolCards.shopStats")
  const s = useTranslations("aiChat.toolCards.salesStats")
  const periodLabel = usePeriodLabel()
  const money = (amount: number) => formatMoney(amount, currency)

  return (
    <ResultCardShell
      icon={BarChart3Icon}
      title={t("title")}
      accent="indigo"
      className="space-y-4 p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label={t("totalRevenue")}
          value={money(result.revenue.total)}
          emphasis
        />
        <StatTile
          label={t("todayRevenue")}
          value={money(result.revenue.today)}
        />
        <StatTile
          label={t("totalOrders")}
          value={result.orders.total.toLocaleString()}
        />
        <StatTile
          label={t("newCustomers30d")}
          value={result.new_customers.toLocaleString()}
        />
      </div>

      <StatusChips
        byStatus={result.orders.by_status}
        period={periodLabel(result.period)}
      />

      <p className="border-t pt-3 text-[11px] leading-snug text-muted-foreground">
        {s("legacyNote")}
      </p>
    </ResultCardShell>
  )
}

/** The chips row, unchanged since v1. `period` is set only on a v1 card,
 * where the chips were the one period-scoped thing on it. */
function StatusChips({
  byStatus,
  period,
}: {
  byStatus: OrdersByStatus | null | undefined
  period?: string | null
}) {
  const t = useTranslations("aiChat.toolCards.shopStats")
  const statusLabel = useOrderStatusLabel()

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span>{t("byStatus")}</span>
        {period && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal">
            {period}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(byStatus ?? {}).map(([k, v]) => (
          <div key={k} className="text-[10px] bg-muted px-2 py-0.5 rounded-full">
            <span className="text-muted-foreground">{statusLabel(k)}</span>
            <span className="ms-1 font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
