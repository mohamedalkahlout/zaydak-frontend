import { describe, expect, it } from "vitest"

import { safeRedirect } from "../redirect"

describe("safeRedirect", () => {
  const fallback = "/acme/account"

  it("honours a same-origin path", () => {
    expect(safeRedirect("/acme/checkout", fallback)).toBe("/acme/checkout")
  })

  it("keeps the query string on the way back", () => {
    expect(safeRedirect("/acme/products?search=mug", fallback)).toBe(
      "/acme/products?search=mug",
    )
  })

  it("falls back when there is nothing to redirect to", () => {
    expect(safeRedirect(null, fallback)).toBe(fallback)
    expect(safeRedirect(undefined, fallback)).toBe(fallback)
    expect(safeRedirect("", fallback)).toBe(fallback)
  })

  it("refuses an absolute URL", () => {
    expect(safeRedirect("https://evil.example", fallback)).toBe(fallback)
  })

  it("refuses a protocol-relative URL", () => {
    // The subtle one: `//evil.example` starts with `/`, so a naive
    // startsWith("/") check sends the customer straight off-site.
    expect(safeRedirect("//evil.example", fallback)).toBe(fallback)
  })

  it("refuses the backslash variant browsers normalise to a slash", () => {
    expect(safeRedirect("/\\evil.example", fallback)).toBe(fallback)
  })

  it("refuses a scheme-only redirect", () => {
    expect(safeRedirect("javascript:alert(1)", fallback)).toBe(fallback)
  })
})
