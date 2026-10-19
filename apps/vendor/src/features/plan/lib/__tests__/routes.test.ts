import { describe, expect, it } from "vitest"
import { PLAN_TABS, planTabFromPath, planTabUrl, planUrl } from "../routes"

describe("plan routes", () => {
  it("keeps the overview at the bare plan URL", () => {
    // Stripe's return URL is built from `planUrl` on the back-end. A second
    // segment here would send every completed checkout to a 404.
    expect(planTabUrl("acme", "overview")).toBe(planUrl("acme"))
    expect(planUrl("acme")).toBe("/plan/acme")
  })

  it("gives every other tab a segment of its own", () => {
    expect(planTabUrl("acme", "usage")).toBe("/plan/acme/usage")
    expect(planTabUrl("acme", "billing")).toBe("/plan/acme/billing")
    expect(planTabUrl("acme", "plans")).toBe("/plan/acme/plans")
  })

  it("reads the tab back out of a pathname", () => {
    for (const tab of PLAN_TABS) {
      expect(planTabFromPath(planTabUrl("acme", tab))).toBe(tab)
    }
  })

  it("treats the bare plan URL as the overview", () => {
    expect(planTabFromPath("/plan/acme")).toBe("overview")
    expect(planTabFromPath("/plan/acme/")).toBe("overview")
  })

  it("falls back to the overview for a segment that is not a tab", () => {
    // A stale bookmark must land somewhere real rather than lighting up no tab
    // at all, which is what a bare `includes` check would leave.
    expect(planTabFromPath("/plan/acme/invoices")).toBe("overview")
  })

  it("does not let a shop slug named like a tab select it", () => {
    // The segment is read by position, not by search: a store slugged "usage"
    // would otherwise open on the usage tab from its overview URL.
    expect(planTabFromPath("/plan/usage")).toBe("overview")
  })
})
