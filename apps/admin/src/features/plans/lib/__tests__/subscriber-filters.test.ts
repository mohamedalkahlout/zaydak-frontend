import { describe, expect, it } from "vitest"

import { SubscriptionStatus } from "@/shared/api/generated/graphql"
import type { Filter } from "@/shared/components/filter-bar"
import {
  DEFAULT_STATUS,
  LIVE_STATUSES,
  PLAN_FIELD,
  STATUS_FIELD,
  subscriberFilterFields,
  toFilters,
  toQuery,
} from "../subscriber-filters"

const chip = (field: string, values: string[]): Filter => ({
  id: field,
  field,
  operator: "is",
  values,
})

const labels = {
  status: "Status",
  plan: "Plan",
  is: "is",
  statusOption: (key: string) => key,
}

describe("toQuery", () => {
  it("opens on the live statuses, exactly as the select did", () => {
    expect(toQuery(toFilters({ status: DEFAULT_STATUS }))).toEqual({
      statuses: LIVE_STATUSES,
      plan_id: undefined,
    })
  })

  it("keeps past_due inside live", () => {
    // Dunning is still a subscriber. If this ever narrows to ACTIVE the shops
    // an admin most needs to chase disappear from the default view.
    expect(LIVE_STATUSES).toContain(SubscriptionStatus.PastDue)
  })

  it("maps each preset to the statuses it stands for", () => {
    const statusesFor = (key: string) =>
      toQuery([chip(STATUS_FIELD, [key])]).statuses

    expect(statusesFor("active")).toEqual([SubscriptionStatus.Active])
    expect(statusesFor("trialing")).toEqual([SubscriptionStatus.Trialing])
    expect(statusesFor("past_due")).toEqual([SubscriptionStatus.PastDue])
    expect(statusesFor("canceled")).toEqual([SubscriptionStatus.Canceled])
    expect(statusesFor("expired")).toEqual([SubscriptionStatus.Expired])
  })

  it("asks for every status when the chip is gone", () => {
    expect(toQuery([]).statuses).toBeUndefined()
  })

  it("ignores a chip that has been added but not yet given a value", () => {
    // The bar opens the value menu as soon as a filter is added. Sending
    // `statuses: []` in that moment would empty the table under the open menu.
    expect(toQuery([chip(STATUS_FIELD, [])]).statuses).toBeUndefined()
    expect(toQuery([chip(PLAN_FIELD, [])]).plan_id).toBeUndefined()
  })

  it("passes a plan through as the id the server takes", () => {
    expect(toQuery([chip(PLAN_FIELD, ["plan-1"])]).plan_id).toBe("plan-1")
  })
})

describe("toFilters", () => {
  it("round-trips through toQuery", () => {
    const filters = toFilters({ status: "canceled", plan_id: "plan-9" })
    expect(toQuery(filters)).toEqual({
      statuses: [SubscriptionStatus.Canceled],
      plan_id: "plan-9",
    })
  })

  it("gives each chip its field's id, so a round trip does not remount it", () => {
    for (const filter of toFilters({ status: "live", plan_id: "plan-9" })) {
      expect(filter.id).toBe(filter.field)
    }
  })

  it("emits nothing for a state with no filters", () => {
    expect(toFilters({})).toEqual([])
  })
})

describe("subscriberFilterFields", () => {
  it("offers no plan field inside a plan's own screen", () => {
    const fields = subscriberFilterFields({ labels, plans: null })
    expect(fields.map((f) => f.id)).toEqual([STATUS_FIELD])
  })

  it("lists the plans it is handed", () => {
    const fields = subscriberFilterFields({
      labels,
      plans: [{ id: "plan-1", name: "Grow" }],
    })
    const plan = fields.find((f) => f.id === PLAN_FIELD)
    expect(plan?.options).toEqual([{ value: "plan-1", label: "Grow" }])
  })

  it("never offers `all` as a value", () => {
    // "Every status" is what removing the chip says. Offering it as a value as
    // well would put two controls on the same state.
    const status = subscriberFilterFields({ labels, plans: null })[0]
    expect(status?.options?.map((o) => o.value)).not.toContain("all")
  })

  it("carries one operator per field, which the bar draws as plain text", () => {
    for (const field of subscriberFilterFields({ labels, plans: [] })) {
      expect(field.operators).toHaveLength(1)
    }
  })
})
