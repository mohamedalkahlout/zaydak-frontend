import { describe, expect, it } from "vitest"

import { headerState, keepVisible, toggleId } from "../selection"

describe("toggleId", () => {
  it("adds an id that is not selected", () => {
    expect(toggleId(["a"], "b")).toEqual(["a", "b"])
  })

  it("removes an id that is", () => {
    expect(toggleId(["a", "b"], "a")).toEqual(["b"])
  })

  it("does not mutate the array it was given", () => {
    const before = ["a"]
    toggleId(before, "b")
    expect(before).toEqual(["a"])
  })
})

describe("headerState", () => {
  it("is none when nothing eligible is selected", () => {
    expect(headerState([], ["a", "b"])).toBe("none")
  })

  it("is some when part of the eligible set is selected", () => {
    expect(headerState(["a"], ["a", "b"])).toBe("some")
  })

  it("is all when the whole eligible set is selected", () => {
    expect(headerState(["a", "b"], ["a", "b"])).toBe("all")
  })

  it("is none when nothing on the page is eligible at all", () => {
    // Otherwise an empty eligible set would satisfy "every one of them is
    // selected" and draw the header box as ticked over nothing.
    expect(headerState([], [])).toBe("none")
    expect(headerState(["a"], [])).toBe("none")
  })

  it("ignores selected ids that are not eligible", () => {
    expect(headerState(["a", "x"], ["a"])).toBe("all")
  })
})

describe("keepVisible", () => {
  it("drops ids that left the page", () => {
    // A refetch or a filter change can replace every row while the selection
    // still holds the old ids; the bar must not act on rows nobody can see.
    expect(keepVisible(["a", "b"], ["b", "c"])).toEqual(["b"])
  })

  it("keeps the surviving ids in their selection order", () => {
    expect(keepVisible(["c", "a"], ["a", "b", "c"])).toEqual(["c", "a"])
  })

  it("empties the selection when the page has no rows", () => {
    expect(keepVisible(["a"], [])).toEqual([])
  })
})
