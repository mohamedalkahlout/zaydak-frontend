import { createTranslator } from "next-intl"
import { describe, expect, it } from "vitest"

import { ShopStatusFilter } from "@/shared/api/generated/graphql"
import type { Filter } from "@/shared/components/filter-bar"
import en from "@/shared/messages/en.json"

import {
  SHOP_STATUS_FIELD,
  shopFilterFields,
  toFilters,
  toQuery,
} from "../filters"

// The real `useTranslations("shops")`, minus the React context it needs: the
// field definitions are plain functions, so the translator is all they want.
const t = createTranslator({
  locale: "en",
  messages: en as never,
  namespace: "shops" as never,
}) as Parameters<typeof shopFilterFields>[0]

// The condition is not this screen's own word — it reads the same on every
// list — so the caller resolves it from the shared chrome namespace.
const tFilterBar = createTranslator({
  locale: "en",
  messages: en as never,
  namespace: "filterBar" as never,
})

const chip = (values: string[]): Filter => ({
  id: SHOP_STATUS_FIELD,
  field: SHOP_STATUS_FIELD,
  operator: "is",
  values,
})

describe("shopFilterFields", () => {
  const [status] = shopFilterFields(t, { is: tFilterBar("is") as string })

  it("maps the field id to the query key it fills", () => {
    // The chip `toFilters` emits carries the same id, so a round trip through
    // the query does not hand the bar what looks like a different chip.
    expect(status?.id).toBe(SHOP_STATUS_FIELD)
  })

  it("offers one condition, because the server takes one value", () => {
    // `shops` takes a single `ShopStatusFilter`, not a list — a multi operator
    // would build a chip the query could not carry.
    expect(status?.operators).toHaveLength(1)
    expect(status?.operators[0]?.multi).toBeUndefined()
    // Handed in already localized, because this module cannot call a hook —
    // written here as a literal the chip read "الحالة is معلّق" in Arabic.
    expect(status?.operators[0]?.label).toBe(en.filterBar.is)
  })

  it("offers every status the resolver accepts and no `all`", () => {
    // `all` would drag deleted shops into what reads as the default view; the
    // unfiltered query is having no chip on the bar at all.
    expect(status?.options?.map((option) => option.value)).toEqual([
      ShopStatusFilter.Active,
      ShopStatusFilter.Pending,
      ShopStatusFilter.Suspended,
      ShopStatusFilter.Deleted,
    ])
  })

  it("labels the options with the keys the Status column already uses", () => {
    // A chip reading "Deleted" beside a badge reading something else would be
    // two names for one state.
    expect(status?.label).toBe(en.shops.column.status)
    expect(
      status?.options?.map((option) => option.label),
    ).toEqual([
      en.shops.status.active,
      en.shops.status.pending,
      en.shops.status.suspended,
      en.shops.status.deleted,
    ])
  })
})

describe("toQuery", () => {
  it("omits the status for an empty bar", () => {
    expect(toQuery([])).toEqual({ status: undefined })
  })

  it("omits it for a chip that has no value yet", () => {
    // Adding a chip opens its value menu with nothing chosen; until something
    // is, it narrows nothing — which is the unfiltered query.
    expect(toQuery([chip([])])).toEqual({ status: undefined })
  })

  it("maps a chosen value onto the enum", () => {
    expect(toQuery([chip(["deleted"])])).toEqual({
      status: ShopStatusFilter.Deleted,
    })
  })

  it("drops a value that is not a status", () => {
    // The bar renders an unknown value as its raw id rather than discarding
    // it, so one can reach here; sending it would be a server-side error.
    expect(toQuery([chip(["archived"])])).toEqual({ status: undefined })
  })

  it("ignores a chip belonging to some other field", () => {
    expect(toQuery([{ ...chip(["active"]), field: "owner" }])).toEqual({
      status: undefined,
    })
  })
})

describe("toFilters", () => {
  it("puts nothing on the bar for the unfiltered query", () => {
    expect(toFilters({})).toEqual([])
  })

  it("round-trips a status back to the same query", () => {
    const filters = toFilters({ status: ShopStatusFilter.Suspended })
    expect(filters).toHaveLength(1)
    expect(filters[0]?.id).toBe(SHOP_STATUS_FIELD)
    expect(toQuery(filters)).toEqual({ status: ShopStatusFilter.Suspended })
  })
})
