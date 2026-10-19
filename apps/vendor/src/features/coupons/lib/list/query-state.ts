import type { CouponType } from "@/features/coupons/types"

export const COUPON_STATUS_FILTER_VALUES = [
  "active",
  "expired",
  "scheduled",
] as const

export const COUPON_SCOPE_FILTER_VALUES = ["general", "scoped"] as const

export const COUPON_TYPE_FILTER_VALUES = [
  "amount_off_products",
  "amount_off_order",
  "buy_x_get_y",
  "free_shipping",
] as const

export type CouponStatusFilter = (typeof COUPON_STATUS_FILTER_VALUES)[number]
export type CouponScopeFilter = (typeof COUPON_SCOPE_FILTER_VALUES)[number]

export interface CouponListQueryState {
  page: number
  limit: number
  search?: string
  statuses?: CouponStatusFilter[]
  types?: CouponType[]
  scopes?: CouponScopeFilter[]
}

type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>

function firstValue(
  input: SearchParamsInput,
  key: string,
): string | undefined {
  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined
  }

  const value = input[key]
  return Array.isArray(value) ? value[0] : value
}

function allValues(input: SearchParamsInput, key: string): string[] {
  if (input instanceof URLSearchParams) {
    return input.getAll(key)
  }

  const value = input[key]
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function filterValid<T extends string>(
  values: readonly T[],
  inputs: string[],
): T[] {
  const allowed = new Set<string>(values)
  return inputs.filter((v): v is T => allowed.has(v))
}

/**
 * Parse filter values from search params. Supports three shapes per key:
 * repeated (`?statuses=active&statuses=scheduled`), comma-separated
 * (`?statuses=active,scheduled`), or the deprecated singular
 * (`?status=active`) for backwards compatibility with old links.
 */
function parseMulti<T extends string>(
  searchParams: SearchParamsInput,
  pluralKey: string,
  singularKey: string,
  values: readonly T[],
): T[] | undefined {
  const raw = [
    ...allValues(searchParams, pluralKey),
    ...allValues(searchParams, singularKey),
  ]
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean)

  if (raw.length === 0) return undefined
  const valid = filterValid(values, raw)
  return valid.length > 0 ? Array.from(new Set(valid)) : undefined
}

/**
 * The GraphQL schema uses UPPERCASE enum values (e.g. `SCHEDULED`,
 * `AMOUNT_OFF_PRODUCTS`) while the UI state stores the lowercase form for
 * URL readability. Convert when crossing the wire.
 */
export function toCouponListVariables(state: CouponListQueryState) {
  const upper = <T extends string>(arr?: T[]) =>
    arr && arr.length > 0 ? arr.map((v) => v.toUpperCase()) : undefined

  return {
    page: state.page,
    limit: state.limit,
    search: state.search,
    statuses: upper(state.statuses),
    types: upper(state.types),
    scopes: upper(state.scopes),
  }
}

export function parseCouponListQueryState(
  searchParams: SearchParamsInput,
  defaultLimit: number,
): CouponListQueryState {
  const rawPage = firstValue(searchParams, "page")
  const rawSearch = firstValue(searchParams, "search")?.trim()

  return {
    page: parsePositiveInt(rawPage, 1),
    limit: defaultLimit,
    search: rawSearch ? rawSearch : undefined,
    statuses: parseMulti(
      searchParams,
      "statuses",
      "status",
      COUPON_STATUS_FILTER_VALUES,
    ),
    types: parseMulti(
      searchParams,
      "types",
      "type",
      COUPON_TYPE_FILTER_VALUES,
    ),
    scopes: parseMulti(
      searchParams,
      "scopes",
      "scope",
      COUPON_SCOPE_FILTER_VALUES,
    ),
  }
}
