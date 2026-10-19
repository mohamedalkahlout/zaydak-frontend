import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearGuestWishlist,
  guestWishlistKey,
  pruneGuestWishlist,
  readGuestWishlist,
  writeGuestWishlist,
} from "../guest-wishlist"

/**
 * The signed-out wishlist's storage.
 *
 * Two things worth pinning. It is **per shop**, because nothing else
 * partitions it and signing in at one storefront must not push another's saved
 * items onto the account. And every access is **wrapped**, because
 * `localStorage` throws rather than returning null in a Safari private window
 * and under a browser set to block site data — a saved-items list is not worth
 * an exception during render.
 */

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe("guestWishlistKey", () => {
  it("gives each shop its own key", () => {
    expect(guestWishlistKey("acme")).not.toBe(guestWishlistKey("beta"))
  })

  it("is stable for one shop", () => {
    expect(guestWishlistKey("acme")).toBe(guestWishlistKey("acme"))
  })
})

describe("read/write", () => {
  it("round-trips a list", () => {
    writeGuestWishlist("acme", ["p1", "p2"])
    expect(readGuestWishlist("acme")).toEqual(["p1", "p2"])
  })

  it("keeps one shop's list out of another's", () => {
    writeGuestWishlist("acme", ["p1"])
    expect(readGuestWishlist("beta")).toEqual([])
  })

  it("reads empty when nothing was ever written", () => {
    expect(readGuestWishlist("acme")).toEqual([])
  })

  it("removes the key rather than storing an empty array", () => {
    writeGuestWishlist("acme", ["p1"])
    clearGuestWishlist("acme")
    expect(window.localStorage.getItem(guestWishlistKey("acme"))).toBeNull()
    expect(readGuestWishlist("acme")).toEqual([])
  })

  it("survives a hand-edited value that is not JSON", () => {
    window.localStorage.setItem(guestWishlistKey("acme"), "{not json")
    expect(readGuestWishlist("acme")).toEqual([])
  })

  it("survives a value that parses but is not an array", () => {
    window.localStorage.setItem(guestWishlistKey("acme"), '{"p1":true}')
    expect(readGuestWishlist("acme")).toEqual([])
  })

  it("drops non-string entries rather than passing them to a GraphQL variable", () => {
    window.localStorage.setItem(
      guestWishlistKey("acme"),
      JSON.stringify(["p1", 42, null, "", "p2"]),
    )
    expect(readGuestWishlist("acme")).toEqual(["p1", "p2"])
  })

  it("caps what it returns and what it stores", () => {
    const many = Array.from({ length: 250 }, (_, i) => `p${i}`)
    writeGuestWishlist("acme", many)
    expect(readGuestWishlist("acme")).toHaveLength(200)
  })

  it("reads empty instead of throwing when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError")
    })
    expect(() => readGuestWishlist("acme")).not.toThrow()
    expect(readGuestWishlist("acme")).toEqual([])
  })

  it("swallows a write that storage refuses", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError")
    })
    expect(() => writeGuestWishlist("acme", ["p1"])).not.toThrow()
  })
})

describe("pruneGuestWishlist", () => {
  it("drops the staged ids the storefront no longer returns", () => {
    writeGuestWishlist("acme", ["p1", "p2", "p3"])

    pruneGuestWishlist("acme", new Set(["p1", "p3"]))

    expect(readGuestWishlist("acme")).toEqual(["p1", "p3"])
  })

  it("clears the list when nothing survived", () => {
    writeGuestWishlist("acme", ["p1"])

    pruneGuestWishlist("acme", new Set())

    expect(window.localStorage.getItem(guestWishlistKey("acme"))).toBeNull()
  })

  it("leaves another shop's list alone", () => {
    writeGuestWishlist("acme", ["p1"])
    writeGuestWishlist("beta", ["b1", "b2"])

    pruneGuestWishlist("acme", new Set())

    expect(readGuestWishlist("beta")).toEqual(["b1", "b2"])
  })

  it("is a no-op when nothing is missing", () => {
    writeGuestWishlist("acme", ["p1", "p2"])

    pruneGuestWishlist("acme", new Set(["p1", "p2", "p3"]))

    expect(readGuestWishlist("acme")).toEqual(["p1", "p2"])
  })

  it("is a no-op when the list is already empty", () => {
    expect(() => pruneGuestWishlist("acme", new Set())).not.toThrow()
    expect(readGuestWishlist("acme")).toEqual([])
  })
})
