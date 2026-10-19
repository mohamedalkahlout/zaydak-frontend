import type { useTranslations } from "next-intl"
import {
  CircleDollarSignIcon,
  CircleDotIcon,
  CalendarIcon,
  EyeOffIcon,
  UserIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type {
  Filter,
  FilterFieldDef,
  FilterOperatorDef,
  FilterOption,
} from "@/shared/components/filter-bar"
import { toFilterOptions } from "@/shared/components/filter-bar"
import {
  CREATED_PRESETS,
  REMINDER_STATUS_VALUES,
  VALUE_BANDS,
  type CreatedPreset,
  type ReminderStatusFilter,
  type ValueBandId,
} from "./constants"
import { REMINDER_STATUS_DOT } from "./status"
import type { AbandonedCartsQueryState } from "./query-state"
import type { AbandonedCartStatusCount } from "../types"

type Translate = ReturnType<typeof useTranslations<"abandonedCarts">>

const OPERATOR = "is"

let sequence = 0
function filterId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `abandoned-filter-${(sequence += 1)}`
}

export function upsertAbandonedCartFilter(
  filters: Filter[],
  field: string,
  values: string[],
  operator = OPERATOR,
): Filter[] {
  const existing = filters.find((f) => f.field === field)
  if (existing) {
    return filters.map((f) =>
      f.field === field ? { ...f, values, operator } : f,
    )
  }
  return [...filters, { id: filterId(), field, operator, values }]
}

function statusGlyph(value: ReminderStatusFilter) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 rounded-full", REMINDER_STATUS_DOT[value])}
    />
  )
}

export type AbandonedCartStatusCounts = Partial<
  Record<ReminderStatusFilter, number>
>

/**
 * `abandonedCartStatusCounts` as a lookup the status options can read.
 * Undefined until the query has answered, so the menu draws no numbers
 * rather than a row of zeros that would read as "none".
 */
export function toAbandonedCartStatusCounts(
  byStatus: readonly AbandonedCartStatusCount[] | null | undefined,
): AbandonedCartStatusCounts | undefined {
  if (!byStatus) return undefined
  const counts: AbandonedCartStatusCounts = {}
  for (const row of byStatus) {
    if ((REMINDER_STATUS_VALUES as readonly string[]).includes(row.status)) {
      counts[row.status as ReminderStatusFilter] = row.count
    }
  }
  return counts
}

/**
 * The fields the abandoned-carts chips filter by.
 *
 * `statusCounts` puts a count beside each status option. Each number is the
 * list's own filter with that status picked — the date range, the search and
 * every other chip applied, the status chip itself left out — so it is the
 * total the list shows after the pick, and it needs no footnote. (It used to
 * come from the KPI summary, which knew only the date range, and the field
 * carried a `hintNote` saying the other filters were not applied.)
 */
export function abandonedCartFilterFields(
  t: Translate,
  is: string,
  loadCustomers?: (query: string) => Promise<FilterOption[]>,
  statusCounts?: AbandonedCartStatusCounts,
): FilterFieldDef[] {
  const operators: FilterOperatorDef[] = [{ value: OPERATOR, label: is }]
  const fields: FilterFieldDef[] = [
    ...(loadCustomers
      ? [
          {
            id: "customer",
            label: t("filter.customer"),
            icon: <UserIcon className="size-3.5" />,
            operators,
            loadOptions: loadCustomers,
          } satisfies FilterFieldDef,
        ]
      : []),
    {
      id: "status",
      label: t("filter.status"),
      icon: <CircleDotIcon className="size-3.5" />,
      operators,
      options: toFilterOptions(
        REMINDER_STATUS_VALUES.map((value) => ({ value })),
        (value) => t(`status.${value}`),
      ).map((option) => {
        const count = statusCounts?.[option.value as ReminderStatusFilter]
        return {
          ...option,
          glyph: statusGlyph(option.value as ReminderStatusFilter),
          hint: count == null ? undefined : String(count),
        }
      }),
    },
    {
      id: "value",
      label: t("filter.value"),
      icon: <CircleDollarSignIcon className="size-3.5" />,
      operators,
      options: VALUE_BANDS.map((band) => ({
        value: band.id,
        label: t(`filter.valueBand.${band.id}`),
      })),
    },
    {
      id: "created",
      label: t("filter.created"),
      icon: <CalendarIcon className="size-3.5" />,
      operators,
      options: CREATED_PRESETS.map((value) => ({
        value,
        label: t(`filter.createdPreset.${value}`),
      })),
    },
    {
      id: "hidden",
      label: t("filter.hidden"),
      icon: <EyeOffIcon className="size-3.5" />,
      operators,
      options: [{ value: "1", label: t("filter.showHidden") }],
    },
  ]
  return fields
}

export function toAbandonedCartFilters(
  state: AbandonedCartsQueryState,
): Filter[] {
  const filters: Filter[] = []
  if (state.reminderStatus) {
    filters.push({
      id: "status",
      field: "status",
      operator: OPERATOR,
      values: [state.reminderStatus],
    })
  }
  if (state.valueBand) {
    filters.push({
      id: "value",
      field: "value",
      operator: OPERATOR,
      values: [state.valueBand],
    })
  }
  if (state.created) {
    filters.push({
      id: "created",
      field: "created",
      operator: OPERATOR,
      values: [state.created],
    })
  }
  if (state.includeHidden) {
    filters.push({
      id: "hidden",
      field: "hidden",
      operator: OPERATOR,
      values: ["1"],
    })
  }
  return filters
}

export function toAbandonedCartFilterQuery(filters: Filter[]): {
  reminderStatus?: ReminderStatusFilter
  includeHidden?: boolean
  customer?: string
  valueBand?: ValueBandId
  created?: CreatedPreset
} {
  const statuses = filters
    .filter((f) => f.field === "status")
    .flatMap((f) => f.values)
    .filter((v): v is ReminderStatusFilter =>
      (REMINDER_STATUS_VALUES as readonly string[]).includes(v),
    )
  const hidden = filters.some(
    (f) => f.field === "hidden" && f.values.includes("1"),
  )
  const customer = filters
    .find((f) => f.field === "customer")
    ?.values.find((v) => v.trim().length > 0)
  const value = filters
    .find((f) => f.field === "value")
    ?.values.find((v): v is ValueBandId =>
      VALUE_BANDS.some((band) => band.id === v),
    )
  const created = filters
    .find((f) => f.field === "created")
    ?.values.find((v): v is CreatedPreset =>
      (CREATED_PRESETS as readonly string[]).includes(v),
    )
  return {
    reminderStatus: statuses[0],
    includeHidden: hidden ? true : undefined,
    customer,
    valueBand: value,
    created,
  }
}

export function abandonedCartFilterSignature(query: {
  reminderStatus?: string
  includeHidden?: boolean
  valueBand?: string
  created?: string
}): string {
  return [
    `status:${query.reminderStatus ?? ""}`,
    `hidden:${query.includeHidden ? "1" : ""}`,
    `value:${query.valueBand ?? ""}`,
    `created:${query.created ?? ""}`,
  ].join("|")
}

export const EMPTY_ABANDONED_CART_FILTER_SIGNATURE =
  abandonedCartFilterSignature({})
