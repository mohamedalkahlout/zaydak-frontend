import { describe, expect, it } from "vitest"

import { shopSlugOfPath } from "../shop-path"

describe("shopSlugOfPath", () => {
  it("reads the handle out of a store or plan path", () => {
    expect(shopSlugOfPath("/store/acme")).toBe("acme")
    expect(shopSlugOfPath("/store/acme/products/mug")).toBe("acme")
    expect(shopSlugOfPath("/plan/acme/billing")).toBe("acme")
  })

  it("stops at a query string or fragment, as a redirect target carries one", () => {
    expect(shopSlugOfPath("/store/acme?tab=orders")).toBe("acme")
    expect(shopSlugOfPath("/store/acme#top")).toBe("acme")
  })

  it("names no shop for a bare prefix, another route, or a static screen", () => {
    expect(shopSlugOfPath("/store")).toBeNull()
    expect(shopSlugOfPath("/store/")).toBeNull()
    expect(shopSlugOfPath("/store/?tab=orders")).toBeNull()
    expect(shopSlugOfPath("/shops")).toBeNull()
    expect(shopSlugOfPath("/storefront/acme")).toBeNull()
    expect(shopSlugOfPath("/store/change-password")).toBeNull()
  })
})
