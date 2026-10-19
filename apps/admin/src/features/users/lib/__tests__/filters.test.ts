import { describe, expect, it } from "vitest"
import { createTranslator } from "next-intl"

import en from "@/shared/messages/en.json"
import { UserRole, UserStatusFilter } from "@/shared/api/generated/graphql"
import type { Filter } from "@/shared/components/filter-bar"

import {
  NO_USERS_FILTER,
  ROLE_FIELD,
  STATUS_FIELD,
  toFilters,
  toQuery,
  usersFilterFields,
} from "../filters"

const t = createTranslator({
  locale: "en",
  messages: en as never,
  namespace: "users",
})

// The operator is the screen's job to resolve, not this module's — it reads
// the same on every list, so it lives with the rest of the bar's chrome.
const tFilterBar = createTranslator({
  locale: "en",
  messages: en as never,
  namespace: "filterBar",
})

const chip = (field: string, values: string[]): Filter => ({
  id: field,
  field,
  operator: "is",
  values,
})

describe("usersFilterFields", () => {
  const fields = usersFilterFields(t, { is: tFilterBar("is") })

  it("ids the fields after the query arguments they set", () => {
    expect(fields.map((field) => field.id)).toEqual([ROLE_FIELD, STATUS_FIELD])
  })

  it("labels fields and options from the keys the table already renders", () => {
    expect(fields.map((field) => field.label)).toEqual(["Role", "Status"])
    expect(fields[0]!.options?.map((o) => o.label)).toEqual([
      "Customer",
      "Vendor",
      "Admin",
      "Super admin",
    ])
    expect(fields[1]!.options?.map((o) => o.label)).toEqual([
      "Active",
      "Suspended",
      "Deleted",
    ])
  })

  it("gives every field one non-multi operator, because the query takes one enum", () => {
    for (const field of fields) {
      expect(field.operators).toHaveLength(1)
      expect(field.operators[0]!.multi).toBeUndefined()
      // Passed in rather than written here: under Arabic the chip read
      // "الدور is مورد", one English word inside a translated sentence.
      expect(field.operators[0]!.label).toBe(en.filterBar.is)
    }
  })

  it("does not offer the `all` status, which would surface deleted rows", () => {
    expect(fields[1]!.options?.map((o) => o.value)).not.toContain(
      UserStatusFilter.All,
    )
  })
})

describe("toQuery", () => {
  it("sends nothing for an empty bar, the query's own active-and-suspended default", () => {
    expect(toQuery([])).toEqual(NO_USERS_FILTER)
  })

  it("maps each chip onto its argument", () => {
    expect(
      toQuery([
        chip(ROLE_FIELD, [UserRole.Vendor]),
        chip(STATUS_FIELD, [UserStatusFilter.Deleted]),
      ]),
    ).toEqual({ role: UserRole.Vendor, status: UserStatusFilter.Deleted })
  })

  it("skips a chip that has not been given a value yet", () => {
    expect(toQuery([chip(ROLE_FIELD, [])])).toEqual({})
  })

  it("drops a value that is no longer one of the options", () => {
    expect(toQuery([chip(ROLE_FIELD, ["moderator"])])).toEqual({
      role: undefined,
    })
  })
})

describe("toFilters", () => {
  it("round-trips through toQuery without changing the chip ids", () => {
    const query = { role: UserRole.Admin, status: UserStatusFilter.Active }
    const filters = toFilters(query)

    expect(filters.map((f) => f.id)).toEqual([ROLE_FIELD, STATUS_FIELD])
    expect(toQuery(filters)).toEqual(query)
  })

  it("seeds an empty bar from the screen's default", () => {
    expect(toFilters(NO_USERS_FILTER)).toEqual([])
  })
})
