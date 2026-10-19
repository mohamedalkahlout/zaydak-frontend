import type { ColumnFiltersState } from "@tanstack/react-table"
import type { useTranslations } from "next-intl"
import {
  CalendarIcon,
  CircleDashedIcon,
  CreditCardIcon,
  RadioTowerIcon,
} from "lucide-react"

import type {
  Filter,
  FilterFieldDef,
  FilterOperatorDef,
} from "@/shared/components/filter-bar"
import { toFilterOptions } from "@/shared/components/filter-bar"
import {
  CHANNEL_OPTIONS,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from "@/features/orders/lib/list/constants"
import {
  orderStatusKey,
  paymentStatusKey,
} from "@/features/orders/lib/list/status-labels"
import type { SalesChannel } from "@/shared/lib/sales-channels"
import {
  RANGE_PRESETS,
  formatRangeLabel,
  rangeForCustom,
  rangeForPreset,
  type RangePreset,
} from "@/features/analytics/lib/date-ranges"
import type { OrderFilters } from "@/features/orders/types"

/**
 * The four fields the orders list filters by, and the projection that carries
 * them across the boundary between the bar and TanStack.
 *
 * The list is server-filtered (`manualFiltering`), so `columnFilters` is not a
 * row model here — it is the intermediate shape `orders-table` already maps
 * into `OrderFilters`, comma-joining each field's values. Keeping that shape
 * means the mapping to the API is untouched by the bar: only where the values
 * come from changed. It goes one way only: the chips are the state, and the
 * column filters are derived from them on every render.
 */

type Translate = ReturnType<typeof useTranslations<"orders">>

/**
 * The words this bar borrows from outside the `orders` namespace, already
 * localized by the caller.
 *
 * The operator reads the same on every list in the app, so it lives under
 * `filterBar` with the rest of the chrome; a channel's name is the one the
 * analytics page and Sidekick use (`salesChannels.names`), so the chip and
 * the channel card cannot call one channel two things. This module renders
 * outside React and cannot call a hook, so the toolbar resolves both and
 * passes them down, the same way the admin console's filter modules take
 * theirs.
 */
export interface OrderFilterOperators {
  /** The lone condition, read as "Status is any of Pending, Failed". */
  isAnyOf: string
  /** A sales channel's name, from `salesChannels.names.<channel>`. */
  channelName: (channel: SalesChannel) => string
  /** The single-value condition, read as "Date is Last 30 days". */
  is: string
  /** A date window's name, from `analytics.ranges.<preset>`. */
  rangeName: (preset: RangePreset) => string
}

/**
 * Status, Payment and Channel hold several values at once — that is what the
 * comma-joined `order_status=a,b` the API takes means — so each carries one
 * multi operator and the bar draws it as plain text rather than a menu with
 * one row in it. An "is" operator beside it would have to narrow to a single
 * value, which the API supports but the screen has never offered.
 */
const IS_ANY_OF = "is_any_of"

/**
 * The date field's lone operator. A list is read over one window at a time, so
 * this one is single-valued: picking another window replaces the first.
 */
const IS = "is"

/** The date field's id, which `orders-table` maps to the created window. */
export const CREATED_FIELD = "created"

/** A hand-picked window, as the chip stores it: `custom:YYYY-MM-DD:YYYY-MM-DD`. */
const CUSTOM_RANGE = /^custom:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/

function ymd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function parseYmd(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

/** Inclusive local days, or null when the chip is a preset or a bad token. */
export function parseCustomRange(
  value: string | undefined,
): { start: Date; end: Date } | null {
  const match = value ? CUSTOM_RANGE.exec(value) : null
  if (!match) return null
  const start = parseYmd(match[1])
  const end = parseYmd(match[2])
  if (!start || !end) return null
  return { start, end }
}

/** The chip value for two inclusive local days. */
export function encodeCustomRange(start: Date, end: Date): string {
  return `custom:${ymd(start)}:${ymd(end)}`
}

/**
 * Whether a Today chip's anchor is a previous local day. The window is cut
 * from that anchor, so a list left open past midnight would keep yesterday's
 * start until some other filter moved.
 */
export function todayAnchorStale(anchor: Date, now: Date): boolean {
  return (
    anchor.getFullYear() !== now.getFullYear() ||
    anchor.getMonth() !== now.getMonth() ||
    anchor.getDate() !== now.getDate()
  )
}

/** Milliseconds from `now` until the next local midnight, at least zero. */
export function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(0, next.getTime() - now.getTime())
}

/**
 * The fields as the bar draws them. A function rather than a constant because
 * every word on a chip — the field, the condition and each value — comes out of
 * `messages/{en,ar}.json`, and a module evaluated at import time has no locale.
 */
export function orderFilterFields(
  t: Translate,
  operators: OrderFilterOperators,
  extras?: {
    /** Dashboard locale, for a custom window's chip label. */
    locale?: string
    /** Calendar under the preset list. Omitted where the field is not drawn. */
    valueExtra?: FilterFieldDef["valueExtra"]
  },
): FilterFieldDef[] {
  const isAnyOf: FilterOperatorDef[] = [
    { value: IS_ANY_OF, label: operators.isAnyOf, multi: true },
  ]

  return [
    {
      // The id is the `columnFilters` id, which is in turn the `OrderFilters`
      // key — one name the whole way down, so nothing has to be translated
      // between the chip and the query. The *label* is the only part that is.
      id: "order_status",
      label: t("filter.order_status"),
      icon: <CircleDashedIcon className="size-3.5" />,
      operators: isAnyOf,
      // Resolved through the same key `OrderStatusBadge` reads, so the menu
      // and the cell it filters to cannot say two different things.
      options: toFilterOptions(ORDER_STATUS_OPTIONS, (value) =>
        t(orderStatusKey(value)),
      ),
    },
    {
      id: "payment_status",
      label: t("filter.payment_status"),
      icon: <CreditCardIcon className="size-3.5" />,
      operators: isAnyOf,
      options: toFilterOptions(PAYMENT_STATUS_OPTIONS, (value) =>
        t(paymentStatusKey(value)),
      ),
    },
    {
      // Where the order was placed. The API derives it exactly as the sales-by-
      // channel report does, so an order sits in the same channel here as on
      // the analytics page.
      id: "channel",
      label: t("filter.channel"),
      icon: <RadioTowerIcon className="size-3.5" />,
      operators: isAnyOf,
      options: toFilterOptions(CHANNEL_OPTIONS, operators.channelName),
    },
    {
      // When the order was placed: one of the analytics page's own windows,
      // named as that page names them, so the list can be asked about the
      // period a report card shows.
      id: CREATED_FIELD,
      label: t("filter.created"),
      icon: <CalendarIcon className="size-3.5" />,
      operators: [{ value: IS, label: operators.is }],
      options: RANGE_PRESETS.map((preset) => ({
        value: preset,
        label: operators.rangeName(preset),
      })),
      labelForValue: (value) => {
        const picked = parseCustomRange(value)
        if (!picked) return undefined
        // The label names the inclusive days. `rangeForCustom` would cap an
        // end of today at `now`, which the chip does not need in order to
        // say which days were picked.
        const last = new Date(picked.end)
        last.setDate(last.getDate() + 1)
        return formatRangeLabel({ start: picked.start, end: last }, extras?.locale)
      },
      valueExtra: extras?.valueExtra,
    },
  ]
}

/**
 * The chips as the query reads them.
 *
 * A chip that has just been added has no values yet and narrows nothing, so it
 * is left out of the query while staying on the bar — the bar's array is the
 * source of truth and this is only a projection of it.
 *
 * One chip per field is the intended model, but the bar cannot stop somebody
 * adding a second Status chip. Two entries with the same id would reach
 * `orders-table`'s mapping loop and the later one would overwrite the earlier,
 * silently dropping a filter the merchant can still see; merging their values
 * instead sends what the bar is showing.
 */
export function toQuery(filters: Filter[]): ColumnFiltersState {
  const byField = new Map<string, string[]>()

  for (const filter of filters) {
    if (filter.values.length === 0) continue
    const merged = byField.get(filter.field)
    if (merged) {
      for (const value of filter.values) {
        if (!merged.includes(value)) merged.push(value)
      }
    } else {
      byField.set(filter.field, [...filter.values])
    }
  }

  return Array.from(byField, ([id, value]) => ({ id, value }))
}

/**
 * A date chip's window as the API takes it, cut on the browser's clock the way
 * the analytics page cuts it (`rangeForPreset`), so "Last 30 days" names the
 * same orders on both screens.
 *
 * `created_to` is sent only for a window that has closed (Yesterday, Last
 * month). One that runs up to now is left open at that end: `now` is the
 * moment the chip was picked, and a closed end there would hide every order
 * placed while the list stayed on screen.
 *
 * `now` is passed in, never read here. The caller anchors it in state, so the
 * query's variables keep their identity from one render to the next.
 */
export function createdWindow(
  preset: string | undefined,
  now: Date,
): Pick<OrderFilters, "created_from" | "created_to"> {
  const custom = parseCustomRange(preset)
  const window = custom
    ? rangeForCustom(custom, now)
    : preset && (RANGE_PRESETS as readonly string[]).includes(preset)
      ? rangeForPreset(preset as RangePreset, now)
      : null
  if (!window) return {}
  const { start, end } = window
  return {
    created_from: start.toISOString(),
    ...(end.getTime() < now.getTime() ? { created_to: end.toISOString() } : {}),
  }
}

/**
 * The list's filters as the export takes them: everything that decides which
 * orders are listed and in what order, without the page being looked at.
 */
export function exportFilters(filters: OrderFilters): OrderFilters {
  const rest = { ...filters }
  delete rest.page
  delete rest.limit
  return rest
}
