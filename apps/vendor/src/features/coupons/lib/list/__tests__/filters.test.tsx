import { describe, expect, it } from "vitest"
import type { Filter } from "@/shared/components/filter-bar"
import {
  type CouponFilterQuery,
  couponFilterFields,
  couponFilterSignature,
  toCouponFilterQuery,
  toCouponFilters,
} from "../filters"
import messages from "@/shared/messages/en"

/**
 * Built from `messages/en` rather than from a stub that echoes its key: a
 * field or a status whose message was never written would otherwise pass here
 * and render as `coupons.filter.statuses` on the merchant's screen.
 */
const t = ((key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages.coupons,
    )) as unknown as Parameters<typeof couponFilterFields>[0]

const FIELDS = couponFilterFields(t, { isAnyOf: "is any of" })

// The chips are what a person edits; the URL is what the query runs on. These
// pin the trip between the two — in particular the cases where a chip carries
// something the URL parser would refuse, and the empty chip that exists only
// while a value is being picked.

const chip = (field: string, values: string[]): Filter => ({
  id: field,
  field,
  operator: "in",
  values,
})

describe("toCouponFilterQuery", () => {
  it("always names every key, so a cleared field is written as cleared", () => {
    expect(toCouponFilterQuery([])).toEqual({
      statuses: undefined,
      types: undefined,
      scopes: undefined,
    })
    expect(Object.keys(toCouponFilterQuery([]))).toEqual([
      "statuses",
      "types",
      "scopes",
    ])
  })

  it("collapses a chip with no values to undefined rather than an empty array", () => {
    expect(toCouponFilterQuery([chip("statuses", [])]).statuses).toBeUndefined()
  })

  it("keeps the values a field allows and drops the rest", () => {
    const query = toCouponFilterQuery([
      chip("statuses", ["active", "not-a-status", "expired"]),
      chip("types", ["free_shipping"]),
      chip("scopes", ["scoped"]),
    ])

    expect(query).toEqual({
      statuses: ["active", "expired"],
      types: ["free_shipping"],
      scopes: ["scoped"],
    })
  })

  it("unions two chips on the same field and de-duplicates them", () => {
    expect(
      toCouponFilterQuery([
        chip("statuses", ["active", "scheduled"]),
        chip("statuses", ["scheduled", "expired"]),
      ]).statuses,
    ).toEqual(["active", "scheduled", "expired"])
  })
})

describe("toCouponFilters", () => {
  it("emits one chip per populated field, keyed by the field id", () => {
    const filters = toCouponFilters({
      statuses: ["active"],
      scopes: ["general"],
    })

    expect(filters).toEqual([
      { id: "statuses", field: "statuses", operator: "in", values: ["active"] },
      { id: "scopes", field: "scopes", operator: "in", values: ["general"] },
    ])
  })

  it("round-trips a query unchanged", () => {
    const query: CouponFilterQuery = {
      statuses: ["expired"],
      types: ["buy_x_get_y"],
      scopes: undefined,
    }

    expect(toCouponFilterQuery(toCouponFilters(query))).toEqual(query)
  })

  it("uses an operator each field actually offers", () => {
    for (const filter of toCouponFilters({ statuses: ["active"] })) {
      const field = FIELDS.find((f) => f.id === filter.field)
      expect(field?.operators.map((o) => o.value)).toContain(filter.operator)
    }
  })
})

describe("couponFilterSignature", () => {
  it("ignores an empty chip, which writes nothing to the URL", () => {
    expect(couponFilterSignature(toCouponFilterQuery([chip("types", [])]))).toBe(
      couponFilterSignature({}),
    )
  })

  it("separates fields, so the same values under another field differ", () => {
    expect(couponFilterSignature({ statuses: ["active"] })).not.toBe(
      couponFilterSignature({ scopes: ["general"] }),
    )
  })
})
