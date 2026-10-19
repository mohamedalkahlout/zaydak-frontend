import { StrictMode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useVendorAgentHandoff, useVendorAgentPrefill } from "./use-prefill"
import {
  stashPrefill,
  useVendorAgentPrefillStore,
} from "@/features/ai/store-prefill"

/**
 * Reading the handoff ticket from a form, and releasing it when the vendor
 * walks away from that form without saving.
 *
 * The release is deferred by a macrotask on purpose, and these tests are why:
 * React's strict mode mounts, unmounts and remounts in one commit, so a
 * release that fired on the unmount would throw away the ticket of a form the
 * vendor is still looking at — and the save on the other side would then find
 * nothing, losing the queued step and the destination with it. Fake timers
 * make the difference between the two cases observable.
 */

const reset = () => useVendorAgentPrefillStore.setState({ pending: {} })
const live = () => useVendorAgentPrefillStore.getState().pending.product_create

beforeEach(() => {
  reset()
  vi.useFakeTimers()
})

describe("useVendorAgentPrefill", () => {
  it("hands the staged values to the form on the first render", () => {
    stashPrefill({ target: "product_create", values: { price: 200 } })

    const { result } = renderHook(() => useVendorAgentPrefill("product_create"))

    expect(result.current).toEqual({ price: 200 })
  })

  it("is undefined when the vendor opened the form themselves", () => {
    const { result } = renderHook(() => useVendorAgentPrefill("product_create"))

    expect(result.current).toBeUndefined()
  })

  it("does not read a ticket staged for a different entity", () => {
    stashPrefill({
      target: "product_edit",
      entityId: "prod-x",
      values: { price: 120 },
    })

    const { result } = renderHook(() =>
      useVendorAgentPrefill("product_edit", "prod-y"),
    )

    expect(result.current).toBeUndefined()
  })

  it("releases the ticket when the vendor leaves without saving", () => {
    stashPrefill({ target: "product_create", values: { price: 200 } })

    const { unmount } = renderHook(() =>
      useVendorAgentPrefill("product_create"),
    )
    unmount()
    vi.runAllTimers()

    // Without this, the rejected draft came back on the next "Add product"
    // inside the 15-minute TTL, with no chat on screen to explain it.
    expect(live()).toBeUndefined()
  })

  it("survives a strict-mode remount", () => {
    stashPrefill({ target: "product_create", values: { price: 200 } })

    const { result } = renderHook(
      () => useVendorAgentPrefill("product_create"),
      { wrapper: StrictMode },
    )
    vi.runAllTimers()

    expect(live()).toBeDefined()
    expect(result.current).toEqual({ price: 200 })
  })

  it("leaves a newer ticket for the same target alone", () => {
    // The vendor asks for a second product while the first form is still
    // mounted, then that first form unmounts. Its release must not take the
    // ticket the vendor is about to use.
    stashPrefill({ target: "product_create", values: { price: 200 } })
    const { unmount } = renderHook(() =>
      useVendorAgentPrefill("product_create"),
    )

    stashPrefill({ target: "product_create", values: { price: 900 } })
    unmount()
    vi.runAllTimers()

    expect(live()?.values).toEqual({ price: 900 })
  })
})

describe("useVendorAgentHandoff", () => {
  it("hands back the whole ticket, handoff id included", () => {
    // The product form registers as the live form under this id, so a patch
    // from the chat can tell whether the form on screen is the one it is for.
    const handoffId = stashPrefill({
      target: "product_create",
      values: { price: 200 },
      nextStep: "then a coupon",
    })

    const { result } = renderHook(() => useVendorAgentHandoff("product_create"))

    expect(result.current?.handoffId).toBe(handoffId)
    expect(result.current?.values).toEqual({ price: 200 })
    expect(result.current?.nextStep).toBe("then a coupon")
  })

  it("is null when the vendor opened the form themselves", () => {
    const { result } = renderHook(() => useVendorAgentHandoff("product_create"))

    expect(result.current).toBeNull()
  })

  it("releases the ticket on leave exactly as the values hook does", () => {
    stashPrefill({ target: "product_create", values: { price: 200 } })

    const { unmount } = renderHook(() => useVendorAgentHandoff("product_create"))
    unmount()
    vi.runAllTimers()

    expect(live()).toBeUndefined()
  })
})
