import { describe, it, expect } from "vitest"
import {
  canonicalPlanPath,
  canonicalStorePath,
  resolveCanonicalSlug,
} from "../canonical-path"

/**
 * The redirect is a tidy-up, not a rescue: the back-end already resolves a
 * retired handle, so every case these two functions are unsure about has to
 * end in "leave the URL alone". The loop guard is the one worth staring at —
 * `redirect()` re-enters the same layout, so a canonical slug the vendor does
 * not actually hold would bounce forever.
 */

const OWNED = [
  { id: "s1", slug: "acme" },
  { id: "s2", slug: "beta" },
]

describe("canonicalStorePath", () => {
  it("keeps the page that was asked for", () => {
    expect(canonicalStorePath("/store/old/products/mug", "old", "new")).toBe(
      "/store/new/products/mug",
    )
  })

  it("handles the shop home itself", () => {
    expect(canonicalStorePath("/store/old", "old", "new")).toBe("/store/new")
  })

  it("falls back to the dashboard home when there is no pathname", () => {
    expect(canonicalStorePath(null, "old", "new")).toBe("/store/new")
    expect(canonicalStorePath(undefined, "old", "new")).toBe("/store/new")
  })

  it("only matches a whole segment", () => {
    // `/store/older-shop` is not `/store/old` plus a tail.
    expect(canonicalStorePath("/store/older-shop/orders", "old", "new")).toBe(
      "/store/new",
    )
  })

  it("falls back for a path that is not under the old handle at all", () => {
    expect(canonicalStorePath("/plan/old/usage", "old", "new")).toBe("/store/new")
  })
})

describe("canonicalPlanPath", () => {
  it("keeps the subpage under plan that was asked for", () => {
    expect(canonicalPlanPath("/plan/old/billing", "old", "new")).toBe(
      "/plan/new/billing",
    )
    expect(canonicalPlanPath("/plan/old/usage", "old", "new")).toBe(
      "/plan/new/usage",
    )
  })

  it("handles the plan root itself", () => {
    expect(canonicalPlanPath("/plan/old", "old", "new")).toBe("/plan/new")
  })

  it("falls back to the plan home when pathname is null or undefined", () => {
    expect(canonicalPlanPath(null, "old", "new")).toBe("/plan/new")
    expect(canonicalPlanPath(undefined, "old", "new")).toBe("/plan/new")
  })

  it("only matches a whole segment boundary", () => {
    expect(canonicalPlanPath("/plan/older-shop/billing", "old", "new")).toBe(
      "/plan/new",
    )
  })
})

describe("resolveCanonicalSlug", () => {
  it("returns the current handle for a retired one", () => {
    expect(
      resolveCanonicalSlug({
        shopSlug: "acme-old",
        myShops: OWNED,
        resolved: { id: "s1", slug: "acme" },
      }),
    ).toBe("acme")
  })

  it("returns null when the URL already names a current handle", () => {
    expect(
      resolveCanonicalSlug({
        shopSlug: "acme",
        myShops: OWNED,
        resolved: { id: "s1", slug: "acme" },
      }),
    ).toBeNull()
  })

  it("returns null when nothing resolved the handle", () => {
    expect(
      resolveCanonicalSlug({
        shopSlug: "acme-old",
        myShops: OWNED,
        resolved: null,
      }),
    ).toBeNull()
  })

  it("returns null when the resolved shop is not the vendor's", () => {
    expect(
      resolveCanonicalSlug({
        shopSlug: "someone-else",
        myShops: OWNED,
        resolved: { id: "s9", slug: "someone-else-now" },
      }),
    ).toBeNull()
  })

  it("returns null when the canonical slug is not itself current (loop guard)", () => {
    expect(
      resolveCanonicalSlug({
        shopSlug: "acme-old",
        myShops: OWNED,
        resolved: { id: "s1", slug: "acme-older" },
      }),
    ).toBeNull()
  })

  it("returns null when the resolved slug equals the one in the URL", () => {
    expect(
      resolveCanonicalSlug({
        shopSlug: "gamma",
        myShops: [...OWNED, { id: "s3", slug: "gamma" }],
        resolved: { id: "s3", slug: "gamma" },
      }),
    ).toBeNull()
  })
})
