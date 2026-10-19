import { describe, it, expect } from "vitest"
import {
  parseProductListQueryState,
  toProductListVariables,
} from "../list/query-state"

// `system_category_id` is the one single-valued filter the URL carries, added
// for the filter bar's Category key. These pin both ends of it: what the URL
// parses to, and that it reaches the GraphQL filters unchanged.

describe("system_category_id in the list query state", () => {
  it("parses the first value, trimmed", () => {
    const state = parseProductListQueryState(
      new URLSearchParams("system_category_id=%20c1%20&system_category_id=c2"),
      6,
    )
    expect(state.system_category_id).toBe("c1")
  })

  it("is undefined when absent or blank", () => {
    expect(
      parseProductListQueryState(new URLSearchParams(""), 6).system_category_id,
    ).toBeUndefined()
    expect(
      parseProductListQueryState(
        new URLSearchParams("system_category_id=%20%20"),
        6,
      ).system_category_id,
    ).toBeUndefined()
    expect(
      parseProductListQueryState({ system_category_id: "" }, 6)
        .system_category_id,
    ).toBeUndefined()
  })

  it("accepts the record shape the server-side params come in", () => {
    expect(
      parseProductListQueryState({ system_category_id: ["c9", "c2"] }, 6)
        .system_category_id,
    ).toBe("c9")
  })

  it("is passed through to the GraphQL filters", () => {
    const state = parseProductListQueryState(
      new URLSearchParams("system_category_id=c1&tag_ids=t1"),
      6,
    )
    const { filters } = toProductListVariables(state)
    expect(filters.system_category_id).toBe("c1")
    expect(filters.tag_ids).toEqual(["t1"])
  })

  it("sends undefined rather than an empty string when unset", () => {
    const { filters } = toProductListVariables(
      parseProductListQueryState(new URLSearchParams(""), 6),
    )
    expect(filters.system_category_id).toBeUndefined()
  })
})
