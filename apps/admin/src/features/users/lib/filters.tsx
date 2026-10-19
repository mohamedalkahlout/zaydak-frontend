import type { useTranslations } from "next-intl"
import { CircleDotIcon, ShieldIcon } from "lucide-react"

import { UserRole, UserStatusFilter } from "@/shared/api/generated/graphql"
import type { Filter, FilterFieldDef } from "@/shared/components/filter-bar"

import { ROLES } from "../types"

type Translate = ReturnType<typeof useTranslations<"users">>

/**
 * The two arguments of the `users` query the filter bar drives.
 *
 * Both are single-valued on the server — `role: UserRole`, `status:
 * UserStatusFilter`, neither a list — which is why every field below carries
 * one non-`multi` operator. A multi operator would let the bar hold three roles
 * the query has no way to ask for.
 */
export interface UsersFilterQuery {
  role?: UserRole
  status?: UserStatusFilter
}

/**
 * What an empty bar means, and it is not "everything": with no `status` the
 * `users` query returns active and suspended accounts and hides the deleted
 * ones. That is the same default the removed `ANY` sentinel stood for, so
 * dropping the last chip lands exactly where the old "Active and suspended"
 * option did.
 */
export const NO_USERS_FILTER: UsersFilterQuery = {}

/**
 * Field ids are the query argument names, so a chip maps to its variable by
 * name rather than through a lookup table that could drift from it. They are
 * also the chip ids `toFilters` emits — one chip per field is the model here,
 * and a stable id keeps a round trip through `toQuery`/`toFilters` from
 * remounting the chip the operator is still working in.
 */
export const ROLE_FIELD = "role"
export const STATUS_FIELD = "status"

const IS = "is"

/**
 * The operator word, already localized by the caller.
 *
 * It is the one string on this bar that is not the screen's own: the condition
 * reads the same on every list, so it lives under `filterBar` with the rest of
 * the chrome rather than under `users`. This module renders outside React and
 * cannot call a hook, so the screen resolves it and passes it down.
 */
export interface UsersFilterOperators {
  /** The lone condition, read as "Role is Vendor". */
  is: string
}

/**
 * Deliberately not `UserStatusFilter.All`. The old `Select` offered these three
 * and nothing else, and `All` would surface deleted accounts alongside live
 * ones in a list whose row actions branch on exactly that distinction.
 */
const STATUSES = [
  UserStatusFilter.Active,
  UserStatusFilter.Suspended,
  UserStatusFilter.Deleted,
] as const

/** Narrowed rather than cast: a chip can outlive the option that produced it. */
const asRole = (value: string) => ROLES.find((role) => role === value)
const asStatus = (value: string) => STATUSES.find((status) => status === value)

/**
 * Labels come from the keys the screen already renders in its own cells, and
 * the operator from the shared `filterBar` namespace the caller reads for us.
 */
export function usersFilterFields(
  t: Translate,
  operators: UsersFilterOperators,
): FilterFieldDef[] {
  const is = [{ value: IS, label: operators.is }]

  return [
    {
      id: ROLE_FIELD,
      label: t("column.role"),
      icon: <ShieldIcon className="size-3.5" />,
      operators: is,
      options: ROLES.map((role) => ({
        value: role,
        label: t(`role.${role}`),
      })),
    },
    {
      id: STATUS_FIELD,
      label: t("column.status"),
      icon: <CircleDotIcon className="size-3.5" />,
      operators: is,
      options: STATUSES.map((status) => ({
        value: status,
        label: t(`status.${status}`),
      })),
    },
  ]
}

/**
 * The chips the query is built from. A chip that has just been added has no
 * value yet — the bar opens its menu in that state — and narrows nothing, so it
 * is skipped rather than sent as an empty argument the server would reject.
 */
export function toQuery(filters: Filter[]): UsersFilterQuery {
  const query: UsersFilterQuery = {}

  for (const filter of filters) {
    const value = filter.values[0]
    if (!value) continue
    if (filter.field === ROLE_FIELD) query.role = asRole(value)
    else if (filter.field === STATUS_FIELD) query.status = asStatus(value)
  }

  return query
}

/** The inverse, for seeding the bar from a filter state that already exists. */
export function toFilters(query: UsersFilterQuery): Filter[] {
  const filters: Filter[] = []

  if (query.role)
    filters.push({
      id: ROLE_FIELD,
      field: ROLE_FIELD,
      operator: IS,
      values: [query.role],
    })

  if (query.status)
    filters.push({
      id: STATUS_FIELD,
      field: STATUS_FIELD,
      operator: IS,
      values: [query.status],
    })

  return filters
}
