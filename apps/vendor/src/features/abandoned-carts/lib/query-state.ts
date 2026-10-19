import {
  PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  REMINDER_STATUS_VALUES,
  SORT_DIRS,
  SORT_FIELDS,
  VALUE_BANDS,
  VIEW_VALUES,
  CREATED_PRESETS,
  type CreatedPreset,
  type ReminderStatusFilter,
  type ValueBandId,
} from "./constants"
import type {
  AbandonedCartSortDir,
  AbandonedCartSortField,
  AbandonedCartsView,
} from "../types"

export type RangePreset =
  | "all_time"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "custom"

export const RANGE_PRESETS: Exclude<RangePreset, "custom">[] = [
  "all_time",
  "this_month",
  "last_7_days",
  "last_30_days",
]

export interface AbandonedCartsQueryState {
  page: number
  limit: number
  search?: string
  reminderStatus?: ReminderStatusFilter
  includeHidden?: boolean
  range: RangePreset
  from?: string
  to?: string
  view: AbandonedCartsView
  valueBand?: ValueBandId
  created?: CreatedPreset
  sortBy: AbandonedCartSortField
  sortDir: AbandonedCartSortDir
}

export interface DateRange {
  start: Date
  end: Date
}

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function firstValue(input: SearchParamsInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined
  const value = input[key]
  return Array.isArray(value) ? value[0] : value
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function parseIsoDate(value: string | undefined): string | undefined {
  return value && ISO_DATE.test(value) ? value : undefined
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function rangeForPreset(
  preset: Exclude<RangePreset, "custom" | "all_time">,
  now = new Date(),
): DateRange {
  const end = now
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (preset === "last_7_days") {
    return { start: addDays(startOfToday, -6), end }
  }
  if (preset === "this_month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end }
  }
  return { start: addDays(startOfToday, -29), end }
}

/** Inclusive calendar days → half-open `[start, end)` window, capped at now. */
export function rangeForCustom(
  from: string,
  to: string,
  now = new Date(),
): DateRange {
  const first = parseLocalDay(from)
  const last = parseLocalDay(to)
  const [startDay, lastDay] = first <= last ? [first, last] : [last, first]
  const dayAfterLast = addDays(lastDay, 1)
  const end = dayAfterLast > now ? now : dayAfterLast
  return { start: startDay > end ? end : startDay, end }
}

export function resolvedRange(
  state: Pick<AbandonedCartsQueryState, "range" | "from" | "to">,
  now = new Date(),
): DateRange | undefined {
  if (state.range === "all_time") return undefined
  if (state.range === "custom" && state.from && state.to) {
    return rangeForCustom(state.from, state.to, now)
  }
  const preset =
    state.range === "custom" ? "last_30_days" : state.range
  return rangeForPreset(preset, now)
}

/**
 * Inclusive label for a half-open window, e.g. "Sep 1 – Sep 17, 2026".
 * Latin digits even in Arabic, matching the merchant date control.
 */
export function formatRangeLabel(range: DateRange, locale?: string): string {
  const lastIncluded = new Date(range.end.getTime() - 1)
  const numberingSystem = "latn" as const
  const month: Intl.DateTimeFormatOptions["month"] =
    locale === "ar" ? "long" : "short"
  const sameDay =
    range.start.getFullYear() === lastIncluded.getFullYear() &&
    range.start.getMonth() === lastIncluded.getMonth() &&
    range.start.getDate() === lastIncluded.getDate()
  const endLabel = lastIncluded.toLocaleDateString(locale, {
    month,
    day: "numeric",
    year: "numeric",
    numberingSystem,
  })
  if (sameDay) return endLabel
  const sameYear = range.start.getFullYear() === lastIncluded.getFullYear()
  const startLabel = range.start.toLocaleDateString(locale, {
    month,
    day: "numeric",
    numberingSystem,
    ...(sameYear ? {} : { year: "numeric" }),
  })
  return `${startLabel} – ${endLabel}`
}

export function parseAbandonedCartsQueryState(
  searchParams: SearchParamsInput,
): AbandonedCartsQueryState {
  const search = firstValue(searchParams, "search")?.trim()
  const status = firstValue(searchParams, "status")
  const range = firstValue(searchParams, "range")
  const from = parseIsoDate(firstValue(searchParams, "from"))
  const to = parseIsoDate(firstValue(searchParams, "to"))
  const custom = range === "custom" && from && to
  const view = firstValue(searchParams, "view")
  const value = firstValue(searchParams, "value")
  const created = firstValue(searchParams, "created")
  const sort = firstValue(searchParams, "sort")
  const dir = firstValue(searchParams, "dir")
  const limit = parsePositiveInt(firstValue(searchParams, "limit"), PAGE_SIZE)
  return {
    page: parsePositiveInt(firstValue(searchParams, "page"), 1),
    limit: (PAGE_SIZE_OPTIONS as readonly number[]).includes(limit)
      ? limit
      : PAGE_SIZE,
    search: search || undefined,
    reminderStatus:
      status && (REMINDER_STATUS_VALUES as readonly string[]).includes(status)
        ? (status as ReminderStatusFilter)
        : undefined,
    includeHidden: firstValue(searchParams, "hidden") === "1",
    range: custom
      ? "custom"
      : range === "last_7_days" ||
          range === "this_month" ||
          range === "last_30_days"
        ? range
        : "all_time",
    from: custom ? from : undefined,
    to: custom ? to : undefined,
    view:
      view && (VIEW_VALUES as readonly string[]).includes(view)
        ? (view as AbandonedCartsView)
        : "customer",
    valueBand:
      value && VALUE_BANDS.some((band) => band.id === value)
        ? (value as ValueBandId)
        : undefined,
    created:
      created && (CREATED_PRESETS as readonly string[]).includes(created)
        ? (created as CreatedPreset)
        : undefined,
    sortBy:
      sort && (SORT_FIELDS as readonly string[]).includes(sort)
        ? (sort as AbandonedCartSortField)
        : "LAST_ACTIVITY",
    sortDir:
      dir && (SORT_DIRS as readonly string[]).includes(dir)
        ? (dir as AbandonedCartSortDir)
        : "DESC",
  }
}

/** Same `[start, end)` chip for the list and the KPI query. Omitted = all time. */
export function toAbandonedCartsSummaryVariables(
  state: Pick<AbandonedCartsQueryState, "range" | "from" | "to">,
  now = new Date(),
) {
  const range = resolvedRange(state, now)
  if (!range) return {}
  return {
    start: range.start.toISOString(),
    end: range.end.toISOString(),
  }
}

/**
 * The list's filter with the status left out — the variables of the status
 * counts. Each count is what the list would show if that status were picked,
 * so the one picked now must not narrow the other four.
 *
 * `now` anchors every rolling window ("last 7 days", a range ending today).
 * A caller that renders must pass one it holds in state: left to the default,
 * each render stamps a new `end`, Apollo reads that as new variables, and the
 * query refetches for ever.
 */
export function toAbandonedCartStatusCountVariables(
  state: AbandonedCartsQueryState,
  now = new Date(),
) {
  const band = VALUE_BANDS.find((row) => row.id === state.valueBand)
  const created = state.created
    ? rangeForPreset(state.created, now)
    : undefined
  return {
    search: state.search,
    include_hidden: state.includeHidden ? true : undefined,
    ...toAbandonedCartsSummaryVariables(state, now),
    created_start: created?.start.toISOString(),
    created_end: created?.end.toISOString(),
    min_total_cents: band?.min,
    max_total_cents: band?.max,
  }
}

/**
 * Which carts the list shows: the search box, every chip and the date range,
 * with no paging and no sort. The list and the select-all id list both send
 * these, and the status counts send the same minus the status, so one cannot
 * be filtered differently from another.
 */
export function toAbandonedCartsFilterVariables(
  state: AbandonedCartsQueryState,
  now = new Date(),
) {
  return {
    ...toAbandonedCartStatusCountVariables(state, now),
    reminder_status: state.reminderStatus,
  }
}

export function toAbandonedCartsVariables(
  state: AbandonedCartsQueryState,
  now = new Date(),
) {
  return {
    page: state.page,
    limit: state.limit,
    ...toAbandonedCartsFilterVariables(state, now),
    sort_by: state.sortBy,
    sort_dir: state.sortDir,
  }
}

/** The list's filter and order with no paging: what select-all asks for. */
export function toAbandonedCartIdsVariables(
  state: AbandonedCartsQueryState,
  now = new Date(),
) {
  return {
    ...toAbandonedCartsFilterVariables(state, now),
    sort_by: state.sortBy,
    sort_dir: state.sortDir,
  }
}

/**
 * What a selection belongs to: the view and every filter, but not the page,
 * the page size or the sort. A selection made under one scope is dropped when
 * the scope changes — ticked carts that the list no longer shows could
 * otherwise still be hidden or reminded.
 */
export function abandonedCartSelectionScope(
  state: AbandonedCartsQueryState,
): string {
  return JSON.stringify([
    state.view,
    state.search ?? "",
    state.reminderStatus ?? "",
    state.includeHidden ? 1 : 0,
    state.range,
    state.from ?? "",
    state.to ?? "",
    state.valueBand ?? "",
    state.created ?? "",
  ])
}

/** URL search params for the marketing list. Defaults are omitted. */
export function toAbandonedCartsSearchParams(
  state: AbandonedCartsQueryState,
): URLSearchParams {
  const params = new URLSearchParams()
  if (state.page > 1) params.set("page", String(state.page))
  if (state.limit !== PAGE_SIZE) params.set("limit", String(state.limit))
  if (state.search) params.set("search", state.search)
  if (state.reminderStatus) params.set("status", state.reminderStatus)
  if (state.includeHidden) params.set("hidden", "1")
  if (state.range === "custom" && state.from && state.to) {
    params.set("range", "custom")
    params.set("from", state.from)
    params.set("to", state.to)
  } else if (state.range !== "all_time") {
    params.set("range", state.range)
  }
  if (state.view === "product") params.set("view", "product")
  if (state.valueBand) params.set("value", state.valueBand)
  if (state.created) params.set("created", state.created)
  if (state.sortBy !== "LAST_ACTIVITY") params.set("sort", state.sortBy)
  if (state.sortDir !== "DESC") params.set("dir", state.sortDir)
  return params
}
