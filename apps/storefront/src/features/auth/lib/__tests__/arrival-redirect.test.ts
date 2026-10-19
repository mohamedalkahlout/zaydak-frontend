import { describe, expect, it } from "vitest"

import { arrivalRedirect } from "../arrival-redirect"

const origin = "http://localhost:3003"

describe("arrivalRedirect", () => {
  it("returns the shop page a client navigation just left", () => {
    expect(
      arrivalRedirect(
        "http://localhost:3003/acme/products/mug",
        origin,
        "/acme/login",
      ),
    ).toBe("/acme/products/mug")
  })

  it("keeps the query the shopper had", () => {
    expect(
      arrivalRedirect(
        "http://localhost:3003/acme/cart?rc=1",
        origin,
        "/acme/login",
      ),
    ).toBe("/acme/cart?rc=1")
  })

  it("is empty for a cold load, another site, or the sign-in page itself", () => {
    expect(arrivalRedirect("", origin, "/acme/login")).toBeNull()
    expect(
      arrivalRedirect("https://example.com/acme", origin, "/acme/login"),
    ).toBeNull()
    expect(
      arrivalRedirect(
        "http://localhost:3003/acme/login",
        origin,
        "/acme/login",
      ),
    ).toBeNull()
    expect(arrivalRedirect("not a url", origin, "/acme/login")).toBeNull()
  })
})