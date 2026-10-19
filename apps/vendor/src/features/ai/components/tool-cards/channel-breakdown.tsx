import { useTranslations } from "next-intl"
import { CircleDashedIcon, type LucideIcon } from "lucide-react"
import type { SalesChannelSlice } from "@/features/ai/lib/types"
import {
  isSalesChannel,
  SALES_CHANNEL_META,
  type SalesChannel,
} from "@/shared/lib/sales-channels"
import { cn } from "@/shared/lib/utils"
import { formatMoney, formatShare } from "./stats-format"

interface Props {
  slices: SalesChannelSlice[]
  currency: string
}

/** A channel the dashboard does not know yet (a persisted turn can outlive
 * the enum): neutral, and named as the server spelled it. */
const UNKNOWN: { icon: LucideIcon; color: string; tone: string } = {
  icon: CircleDashedIcon,
  color: "#64748b",
  tone: "bg-muted text-muted-foreground",
}

/**
 * Where a period's sales were placed: one thin stacked bar, then a legend row
 * per channel in the tool's own order (sales, descending). Identity — icon,
 * colour, name — comes from `@/shared/lib/sales-channels` and the
 * `salesChannels` namespace, so Telegram is the same sky blue here as on the
 * analytics page and the orders list.
 *
 * The bar is weighted by sales. A channel's sales can be negative (a refund
 * settled in the window against an older order), so a segment is never drawn
 * below zero; when nothing has a positive value the bar falls back to order
 * counts, and when there are none of those either it is left out.
 */
export function ChannelBreakdown({ slices, currency }: Props) {
  const t = useTranslations("aiChat.toolCards.salesStats")
  const names = useTranslations("salesChannels")

  if (slices.length === 0) return null

  const salesTotal = slices.reduce((sum, s) => sum + Math.max(0, s.sales), 0)
  const ordersTotal = slices.reduce((sum, s) => sum + Math.max(0, s.orders), 0)
  const weight = (s: SalesChannelSlice) =>
    salesTotal > 0
      ? Math.max(0, s.sales) / salesTotal
      : ordersTotal > 0
        ? Math.max(0, s.orders) / ordersTotal
        : 0

  const rows = slices.map((slice) => {
    const channel = slice.channel
    const known = isSalesChannel(channel)
    const meta = known ? SALES_CHANNEL_META[channel as SalesChannel] : UNKNOWN
    const key = `names.${channel}`
    const name =
      known && names.has(key)
        ? names(key)
        : channel.toLowerCase().replace(/_/g, " ")
    return { slice, meta, name, weight: weight(slice) }
  })

  const drawBar = rows.some((r) => r.weight > 0)

  return (
    <div data-testid="channel-breakdown">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        {t("byChannel")}
      </div>
      {drawBar && (
        <div
          className="mb-2.5 flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted"
          aria-hidden>
          {rows
            .filter((r) => r.weight > 0)
            .map((r) => (
              <div
                key={r.slice.channel}
                data-channel={r.slice.channel}
                className="h-full first:rounded-s-full last:rounded-e-full"
                style={{
                  width: `${r.weight * 100}%`,
                  backgroundColor: r.meta.color,
                }}
              />
            ))}
        </div>
      )}
      <ul className="space-y-1.5">
        {rows.map(({ slice, meta, name }) => {
          const Icon = meta.icon
          return (
            <li
              key={slice.channel}
              className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md",
                  meta.tone,
                )}>
                <Icon className="size-3" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{name}</span>
                <span className="ms-1.5 text-muted-foreground">
                  {t("channelOrders", { count: slice.orders })}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatMoney(slice.sales, currency)}
              </span>
              <span className="w-12 shrink-0 text-end tabular-nums text-muted-foreground">
                {t("share", { value: formatShare(slice.share_pct) })}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
