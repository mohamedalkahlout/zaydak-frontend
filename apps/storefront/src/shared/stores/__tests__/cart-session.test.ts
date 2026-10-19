import { beforeEach, describe, expect, it } from "vitest"

import { CART_SESSION_COOKIE } from "@/shared/auth/cookie-names"
import { useCartSessionStore } from "../cart-session"

/**
 * The anonymous cart identity is shared state now, and the two properties that
 * makes it worth a store are what these cover.
 *
 * **Idempotent.** A catalogue page mounts one `useCart` per tile, and each one
 * calls `adopt()` on mount. If that minted a fresh id per caller, a grid of
 * products would hand the visitor a different cart per tile.
 *
 * **Adopting, not replacing.** A returning visitor already has a cookie with a
 * cart behind it. Minting over the top of it silently empties their cart on
 * every reload — the bug `peek`-before-`getOrCreate` exists to prevent.
 */

function clearCookie() {
  document.cookie = `${CART_SESSION_COOKIE}=; path=/; max-age=0`
}

describe("useCartSessionStore", () => {
  beforeEach(() => {
    clearCookie()
    useCartSessionStore.setState({ sessionId: null })
  })

  it("mints an id on first adopt and writes it to the cookie", () => {
    const id = useCartSessionStore.getState().adopt()

    expect(id).toBeTruthy()
    expect(useCartSessionStore.getState().sessionId).toBe(id)
    expect(document.cookie).toContain(`${CART_SESSION_COOKIE}=${id}`)
  })

  it("returns the same id however many callers adopt", () => {
    const first = useCartSessionStore.getState().adopt()
    const second = useCartSessionStore.getState().adopt()
    const third = useCartSessionStore.getState().adopt()

    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it("adopts an existing cookie rather than replacing it", () => {
    document.cookie = `${CART_SESSION_COOKIE}=returning-visitor; path=/`

    expect(useCartSessionStore.getState().adopt()).toBe("returning-visitor")
  })

  it("mints an id that is not guessable from the previous one", () => {
    const first = useCartSessionStore.getState().adopt()
    clearCookie()
    useCartSessionStore.setState({ sessionId: null })
    const second = useCartSessionStore.getState().adopt()

    expect(second).not.toBe(first)
    expect(second!.length).toBeGreaterThanOrEqual(32)
  })
})
