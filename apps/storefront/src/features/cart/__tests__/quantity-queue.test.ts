import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, renderHook } from "@testing-library/react"

import { QUANTITY_QUIET_MS, useQuantityQueue } from "../use-quantity-queue"

/**
 * "Holding `+` sends one request."
 *
 * Everything below is about the gap between what the shopper does and what the
 * network sees, so the two are asserted separately every time: the number the
 * stepper renders comes from `quantityOf`, and the number the server is told
 * comes from `commit`. A test that only watched one of them could not tell a
 * working debounce from a stepper that had simply stopped responding.
 *
 * Timers are faked because the delay *is* the feature. `deferred()` gives the
 * same control over the mutation — half of what this hook does only happens
 * while a write is in the air, which a resolved promise never is.
 */

/** A promise whose settling is decided by the test, not by a microtask. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  // The rejection path is always claimed; an unhandled one fails the run.
  promise.catch(() => {})
  return { promise, resolve, reject }
}

describe("useQuantityQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("collapses a run of taps into one write carrying the last number", async () => {
    const commit = vi.fn(async () => ({}))
    const { result } = renderHook(() => useQuantityQueue(commit))

    // 1 -> 5 the way a finger does it: faster than the quiet window.
    await act(async () => {
      for (const quantity of [2, 3, 4, 5]) {
        result.current.set("line-1", quantity)
        vi.advanceTimersByTime(80)
      }
    })

    // Every tap is already on screen, and none of them has been sent.
    expect(result.current.quantityOf("line-1", 1)).toBe(5)
    expect(result.current.isPending("line-1")).toBe(true)
    expect(result.current.busy).toBe(true)
    expect(commit).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(QUANTITY_QUIET_MS)
    })

    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith("line-1", 5)
  })

  it("hands the line back to the server once its own write lands", async () => {
    const gate = deferred<unknown>()
    const commit = vi.fn(() => gate.promise)
    const { result } = renderHook(() => useQuantityQueue(commit))

    await act(async () => {
      result.current.set("line-1", 4)
      vi.advanceTimersByTime(QUANTITY_QUIET_MS)
    })

    // Still ahead of the server: the write is in the air, so the local number
    // is the only true one.
    expect(result.current.quantityOf("line-1", 1)).toBe(4)

    await act(async () => {
      gate.resolve({})
    })

    // The envelope has landed, so `item.quantity` is the number now — and this
    // is the assertion that would catch the local value sticking and shadowing
    // a later change from anywhere else.
    expect(result.current.isPending("line-1")).toBe(false)
    expect(result.current.busy).toBe(false)
    expect(result.current.quantityOf("line-1", 4)).toBe(4)
  })

  it("never has two writes for one line in the air at once", async () => {
    const first = deferred<unknown>()
    const second = deferred<unknown>()
    const commit = vi
      .fn<(itemId: string, quantity: number) => Promise<unknown>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const { result } = renderHook(() => useQuantityQueue(commit))

    await act(async () => {
      result.current.set("line-1", 2)
      vi.advanceTimersByTime(QUANTITY_QUIET_MS)
    })
    expect(commit).toHaveBeenNthCalledWith(1, "line-1", 2)

    // A second decision while the first write is still out. Both mutations
    // return the whole cart envelope and Apollo writes whichever lands last,
    // so starting this one now is how the cart ends up one tap out of date.
    await act(async () => {
      result.current.set("line-1", 7)
      vi.advanceTimersByTime(QUANTITY_QUIET_MS)
    })
    expect(commit).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.resolve({})
    })

    // Held, then sent the moment the line was free.
    expect(commit).toHaveBeenCalledTimes(2)
    expect(commit).toHaveBeenNthCalledWith(2, "line-1", 7)

    // The response to the *first* write describes a quantity the shopper has
    // already left, so the line stays local until its own answer arrives.
    expect(result.current.quantityOf("line-1", 2)).toBe(7)

    await act(async () => {
      second.resolve({})
    })

    expect(result.current.isPending("line-1")).toBe(false)
  })

  it("keeps each line on its own timer", async () => {
    const commit = vi.fn(async () => ({}))
    const { result } = renderHook(() => useQuantityQueue(commit))

    await act(async () => {
      result.current.set("line-1", 3)
      vi.advanceTimersByTime(QUANTITY_QUIET_MS)
      result.current.set("line-2", 9)
      vi.advanceTimersByTime(QUANTITY_QUIET_MS)
    })

    expect(commit).toHaveBeenCalledTimes(2)
    expect(commit).toHaveBeenNthCalledWith(1, "line-1", 3)
    expect(commit).toHaveBeenNthCalledWith(2, "line-2", 9)
  })

  it("falls back to the server's number when the write is refused", async () => {
    const gate = deferred<unknown>()
    const commit = vi.fn(() => gate.promise)
    const onError = vi.fn()
    const { result } = renderHook(() => useQuantityQueue(commit, { onError }))

    await act(async () => {
      result.current.set("line-1", 12)
      vi.advanceTimersByTime(QUANTITY_QUIET_MS)
    })

    await act(async () => {
      gate.reject(new Error("Only 8 in stock"))
    })

    // What the shop actually has, not what was typed at it.
    expect(result.current.quantityOf("line-1", 8)).toBe(8)
    expect(result.current.isPending("line-1")).toBe(false)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it("drops a queued write for a line that is being removed", async () => {
    const commit = vi.fn(async () => ({}))
    const { result } = renderHook(() => useQuantityQueue(commit))

    await act(async () => {
      result.current.set("line-1", 6)
      result.current.cancel("line-1")
      vi.advanceTimersByTime(QUANTITY_QUIET_MS * 2)
    })

    expect(commit).not.toHaveBeenCalled()
    expect(result.current.isPending("line-1")).toBe(false)
  })

  it("sends what is queued when the surface goes away", async () => {
    const commit = vi.fn(async () => ({}))
    const { result, unmount } = renderHook(() => useQuantityQueue(commit))

    // Tap and close: the drawer's lines unmount with the panel, and the timer
    // dies with them. Without the flush the shopper watched the number change
    // and the cart never heard about it.
    await act(async () => {
      result.current.set("line-1", 4)
    })
    expect(commit).not.toHaveBeenCalled()

    unmount()

    expect(commit).toHaveBeenCalledWith("line-1", 4)
  })
})
