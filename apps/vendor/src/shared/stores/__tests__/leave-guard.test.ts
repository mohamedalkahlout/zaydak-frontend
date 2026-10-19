import { describe, expect, it, vi, beforeEach } from "vitest"
import { navigateGuarded, useLeaveGuardStore } from "../leave-guard"

// The store is the one answer to "may I leave?" for a link click, a push and
// the dialog alike, so what is pinned here is the contract each of them relies
// on: disarmed means go, `allow` means go, anything else is parked as
// `pending`; confirm runs `onLeave` and hands the parked navigation back,
// cancel drops it without touching the edit.

const store = () => useLeaveGuardStore.getState()

beforeEach(() => {
  useLeaveGuardStore.setState({ guard: null, pending: null })
})

describe("request", () => {
  it("lets everything through while disarmed", () => {
    expect(store().request("/store/acme/orders")).toBe(false)
    expect(store().pending).toBeNull()
  })

  it("parks a destination the guard does not allow", () => {
    store().arm({ allow: () => false, onLeave: vi.fn() })
    expect(store().request("/store/acme/orders")).toBe(true)
    expect(store().pending).toEqual({ href: "/store/acme/orders", proceed: undefined })
  })

  it("lets an allowed destination through silently", () => {
    store().arm({ allow: (p) => p.startsWith("/store/acme/settings/general"), onLeave: vi.fn() })
    expect(store().request("/store/acme/settings/general/brand")).toBe(false)
    expect(store().pending).toBeNull()
  })

  it("keeps the exact action that was interrupted, when given one", () => {
    const proceed = vi.fn()
    store().arm({ allow: () => false, onLeave: vi.fn() })
    store().request("/store/beta", proceed)
    expect(store().pending?.proceed).toBe(proceed)
    expect(proceed).not.toHaveBeenCalled()
  })
})

describe("confirm and cancel", () => {
  it("confirm runs onLeave, clears pending and hands the navigation back", () => {
    const onLeave = vi.fn()
    store().arm({ allow: () => false, onLeave })
    store().request("/store/acme/orders")
    const held = store().confirm()
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(held?.href).toBe("/store/acme/orders")
    expect(store().pending).toBeNull()
  })

  it("cancel clears pending without running onLeave", () => {
    const onLeave = vi.fn()
    store().arm({ allow: () => false, onLeave })
    store().request("/store/acme/orders")
    store().cancel()
    expect(onLeave).not.toHaveBeenCalled()
    expect(store().pending).toBeNull()
    // Still armed: staying is not the same as saving.
    expect(store().guard).not.toBeNull()
  })
})

describe("disarm", () => {
  it("clears the guard and anything parked behind it", () => {
    store().arm({ allow: () => false, onLeave: vi.fn() })
    store().request("/x")
    store().disarm()
    expect(store().guard).toBeNull()
    expect(store().pending).toBeNull()
  })

  it("is a no-op for a guard that is no longer the one in place", () => {
    // A screen's unmount cleanup must not disarm the screen that replaced it.
    const old = { allow: () => false, onLeave: vi.fn() }
    const next = { allow: () => false, onLeave: vi.fn() }
    store().arm(old)
    store().arm(next)
    store().disarm(old)
    expect(store().guard).toBe(next)
  })
})

describe("navigateGuarded", () => {
  it("navigates at once while disarmed", () => {
    const navigate = vi.fn()
    navigateGuarded("/store/acme", navigate)
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it("parks the navigation, whole, while armed against it", () => {
    const navigate = vi.fn()
    store().arm({ allow: () => false, onLeave: vi.fn() })
    navigateGuarded("/store/acme", navigate)
    expect(navigate).not.toHaveBeenCalled()
    expect(store().pending).toEqual({ href: "/store/acme", proceed: navigate })
  })
})
