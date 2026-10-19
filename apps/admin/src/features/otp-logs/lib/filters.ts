import { OtpLogStatus, OtpPurpose } from "@/shared/api/generated/graphql"
import type { Filter, FilterFieldDef } from "@/shared/components/filter-bar"

import { OTP_LOG_STATUSES, OTP_PURPOSES } from "../types"

/**
 * The two enum filters the segmented bar draws, and the round trip between a
 * chip and the `otpLogs` variables.
 *
 * It is shaped like `export.ts` rather than reaching for the translator: the
 * option labels are computed key paths over wire values (`purpose.LOGIN`), so
 * the screen passes the lookups in and this file stays free of `next-intl`.
 * The values themselves come from `types.ts`, which is what keeps a purpose
 * added to the enum from appearing in the export and being missing here.
 */

/**
 * The only operator either field carries.
 *
 * `otpLogs` takes one `OtpPurpose` and one `OtpLogStatus`, not lists, so there
 * is nothing an "is any of" could send. A field with a single operator renders
 * it as plain text rather than as a menu with one row in it.
 */
const IS = "is"

/** What the bar contributes to the `otpLogs` variables — nothing else. */
export interface OtpLogFilterQuery {
  purpose: OtpPurpose | undefined
  status: OtpLogStatus | undefined
}

/** Already-localized strings, in the shape the screen already builds for CSV. */
export interface OtpLogFilterLabels {
  /** Field names. The table's own column headers, so a chip names its column. */
  field: { purpose: string; status: string }
  /** The lone operator. */
  is: string
  purpose: (purpose: string) => string
  status: (status: string) => string
}

/**
 * Each field's `id` is the query variable it maps to, so a chip and a filter
 * are the same word in both directions and `toOtpLogFilters` can emit a stable
 * id that survives a round trip without remounting the chip.
 */
export function otpLogFilterFields(
  labels: OtpLogFilterLabels,
): FilterFieldDef[] {
  const operators = [{ value: IS, label: labels.is }]
  return [
    {
      id: "purpose",
      label: labels.field.purpose,
      operators,
      options: OTP_PURPOSES.map((purpose) => ({
        value: purpose,
        label: labels.purpose(purpose),
      })),
    },
    {
      id: "status",
      label: labels.field.status,
      operators,
      options: OTP_LOG_STATUSES.map((status) => ({
        value: status,
        label: labels.status(status),
      })),
    },
  ]
}

/**
 * The first value of the chip for `field`, but only if it is one of the
 * enum's own members.
 *
 * A `Filter` holds plain strings, which loses the generated enum the two
 * `<Select>`s used to guarantee. Checking membership here puts that guarantee
 * back: an id the server would reject cannot leave this screen, whatever a
 * stale chip or a hand-edited link is holding.
 */
function pickEnum<T extends string>(
  filters: Filter[],
  field: string,
  allowed: readonly T[],
): T | undefined {
  const value = filters.find((filter) => filter.field === field)?.values[0]
  if (!value) return undefined
  return (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined
}

/**
 * The chips as query variables.
 *
 * A chip that has been added but not answered yet holds no values, and the
 * absent key is what "no filter" means on the wire — the same `undefined` the
 * `ANY` sentinel used to produce.
 */
export function toOtpLogQuery(filters: Filter[]): OtpLogFilterQuery {
  return {
    purpose: pickEnum(filters, "purpose", OTP_PURPOSES),
    status: pickEnum(filters, "status", OTP_LOG_STATUSES),
  }
}

/** The other direction: the chips that stand for an already-applied query. */
export function toOtpLogFilters(query: OtpLogFilterQuery): Filter[] {
  const filters: Filter[] = []
  if (query.purpose)
    filters.push({
      id: "purpose",
      field: "purpose",
      operator: IS,
      values: [query.purpose],
    })
  if (query.status)
    filters.push({
      id: "status",
      field: "status",
      operator: IS,
      values: [query.status],
    })
  return filters
}

/**
 * One chip per field, the newest winning.
 *
 * The bar does not stop a field being chosen twice, and a second Purpose chip
 * would be a lie: only one `purpose` can go on the wire, so the loser would sit
 * on the toolbar naming a filter the server was never asked for. Dropping it
 * makes picking a field again read as editing that field's filter, which is the
 * only thing a person can mean by it.
 */
export function oneChipPerField(filters: Filter[]): Filter[] {
  const seen = new Set<string>()
  const kept: Filter[] = []
  for (let i = filters.length - 1; i >= 0; i--) {
    const filter = filters[i]
    if (!filter || seen.has(filter.field)) continue
    seen.add(filter.field)
    kept.unshift(filter)
  }
  return kept
}
