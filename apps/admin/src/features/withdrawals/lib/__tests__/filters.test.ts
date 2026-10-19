import { describe, expect, it } from "vitest"

import { WithdrawalStatus } from "@/shared/api/generated/graphql"
import type { Filter } from "@/shared/components/filter-bar"
import { WITHDRAWAL_STATUSES } from "../../status"
import {
  STATUS_FIELD,
  toFilters,
  toQuery,
  withdrawalFilterFields,
} from "../filters"

const fields = withdrawalFilterFields({
  field: "Status",
  // A sentinel rather than the English word: the point of the argument is that
  // the module holds no operator of its own, and "is" would pass either way.
  is: "operator:is",
  status: (status) => `label:${status}`,
})

const chip = (values: string[]): Filter => ({
  id: STATUS_FIELD,
  field: STATUS_FIELD,
  operator: "is",
  values,
})

describe("withdrawalFilterFields", () => {
  it("offers one field, keyed by the query argument it maps to", () => {
    expect(fields).toHaveLength(1)
    expect(fields[0]?.id).toBe(STATUS_FIELD)
  })

  it("offers every status the list can be narrowed by", () => {
    expect(fields[0]?.options?.map((o) => o.value)).toEqual([
      ...WITHDRAWAL_STATUSES,
    ])
  })

  it("carries a single operator, which the bar draws as plain text", () => {
    expect(fields[0]?.operators).toHaveLength(1)
    expect(fields[0]?.operators[0]?.multi).toBeUndefined()
    // Localized by the screen, like every other word on the chip.
    expect(fields[0]?.operators[0]?.label).toBe("operator:is")
  })
})

describe("toQuery", () => {
  it("sends no status at all when nothing is filtered", () => {
    expect(toQuery([])).toEqual({ status: undefined })
  })

  it("sends no status for a chip that has not been given a value yet", () => {
    expect(toQuery([chip([])])).toEqual({ status: undefined })
  })

  it("sends the picked status", () => {
    expect(toQuery([chip([WithdrawalStatus.Pending])])).toEqual({
      status: WithdrawalStatus.Pending,
    })
  })

  it("refuses a value that is not a status rather than failing the query", () => {
    expect(toQuery([chip(["NOT_A_STATUS"])])).toEqual({ status: undefined })
  })
})

describe("toFilters", () => {
  it("wears no chip for an unfiltered query", () => {
    expect(toFilters({})).toEqual([])
  })

  it("round-trips a narrowed query through the bar unchanged", () => {
    for (const status of WITHDRAWAL_STATUSES) {
      expect(toQuery(toFilters({ status }))).toEqual({ status })
    }
  })

  it("keeps the field id as the chip id, so a round trip does not remount it", () => {
    expect(toFilters({ status: WithdrawalStatus.Approved })[0]?.id).toBe(
      STATUS_FIELD,
    )
  })
})
