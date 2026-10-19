import { describe, expect, it } from "vitest"

import {
  filterQueryKey,
  toColumnFilters,
  toFilters,
} from "@/features/customers/lib/filters"
import type { Filter } from "@/shared/components/filter-bar"

/**
 * These pin the seam between the filter bar and the `contacts` query. The list
 * sends `status` as a single string derived from `columnFilters`, so a chip
 * that stopped writing the array shape — or wrote an empty one — would not
 * fail loudly; it would quietly stop filtering, or make an unfiltered list
 * claim it had been filtered to nothing.
 */
const chip = (field: string, values: string[]): Filter => ({
  id: field,
  field,
  operator: "is",
  values,
})

describe("customer filter chips → column filters", () => {
  it("writes the array shape the status variable is read out of", () => {
    expect(toColumnFilters([chip("status", ["active"])])).toEqual([
      { id: "status", value: ["active"] },
    ])
  })

  it("skips a chip with nothing chosen yet, so the list is not counted as filtered", () => {
    expect(toColumnFilters([chip("status", [])])).toEqual([])
  })

  it("merges two chips on one field rather than letting the second be ignored", () => {
    expect(
      toColumnFilters([chip("status", ["active"]), chip("status", ["inactive"])]),
    ).toEqual([{ id: "status", value: ["active", "inactive"] }])
  })

  it("keeps both fields, each under its own column id", () => {
    expect(
      toColumnFilters([
        chip("status", ["active"]),
        chip("subscription", ["subscribed"]),
      ]),
    ).toEqual([
      { id: "status", value: ["active"] },
      { id: "subscription", value: ["subscribed"] },
    ])
  })
})

describe("column filters → customer filter chips", () => {
  it("round trips without changing a chip's id, so nothing remounts", () => {
    const applied = toColumnFilters([chip("status", ["active"])])
    expect(toFilters(applied)).toEqual([chip("status", ["active"])])
  })

  it("reads a single string as one value", () => {
    expect(toFilters([{ id: "status", value: "active" }])).toEqual([
      chip("status", ["active"]),
    ])
  })
})

describe("filterQueryKey", () => {
  it("does not change when a chip with no value is added", () => {
    const before = [chip("status", ["active"])]
    expect(filterQueryKey([...before, chip("subscription", [])])).toBe(
      filterQueryKey(before),
    )
  })

  it("changes when a value is picked", () => {
    expect(filterQueryKey([chip("status", ["active"])])).not.toBe(
      filterQueryKey([chip("status", ["inactive"])]),
    )
  })
})
