/**
 * Tests for the undo/redo history hook.
 *
 * Uses React Testing Library's renderHook to drive state transitions.
 * Run: `npx vitest src/features/segments/lib/__tests__/use-query-history.test.ts`
 *
 * Requires `npm install -D @testing-library/react jsdom` and a `jsdom`
 * test environment override per-file (Vitest's per-file `// @vitest-environment`).
 */

// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useQueryHistory } from "../use-query-history"

vi.useFakeTimers()

const flushDebounce = (ms = 500) => {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe("useQueryHistory", () => {
  it("starts at the initial value with no undo available", () => {
    const { result } = renderHook(() => useQueryHistory("initial"))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it("debounces pushes — multiple pushes within 400ms collapse", () => {
    const { result } = renderHook(() => useQueryHistory(""))

    act(() => {
      result.current.push("a")
      result.current.push("ab")
      result.current.push("abc")
    })
    // Before the debounce fires, no new entry is registered.
    expect(result.current.canUndo).toBe(false)

    flushDebounce()
    // After the debounce, only the *last* value gets pushed.
    expect(result.current.canUndo).toBe(true)
    expect(result.current.undo()).toBe("")
  })

  it("undo walks back to the previous snapshot", () => {
    const { result } = renderHook(() => useQueryHistory("v1"))

    act(() => result.current.push("v2"))
    flushDebounce()
    act(() => result.current.push("v3"))
    flushDebounce()

    expect(result.current.canUndo).toBe(true)
    expect(result.current.undo()).toBe("v2")
    expect(result.current.undo()).toBe("v1")
    expect(result.current.canUndo).toBe(false)
  })

  it("redo walks forward after an undo", () => {
    const { result } = renderHook(() => useQueryHistory("v1"))

    act(() => result.current.push("v2"))
    flushDebounce()

    act(() => {
      result.current.undo()
    })
    expect(result.current.canRedo).toBe(true)
    expect(result.current.redo()).toBe("v2")
    expect(result.current.canRedo).toBe(false)
  })

  it("new edit after undo drops the redo tail", () => {
    const { result } = renderHook(() => useQueryHistory("v1"))

    act(() => result.current.push("v2"))
    flushDebounce()
    act(() => result.current.push("v3"))
    flushDebounce()
    // Stack is v1 → v2 → v3 with index at v3
    act(() => {
      result.current.undo() // index → v2
    })
    // New edit at v2 should drop v3.
    act(() => result.current.push("v2-fork"))
    flushDebounce()
    expect(result.current.canRedo).toBe(false)
    expect(result.current.undo()).toBe("v2")
  })

  it("reset clears history to a single entry", () => {
    const { result } = renderHook(() => useQueryHistory("v1"))

    act(() => result.current.push("v2"))
    flushDebounce()
    act(() => result.current.push("v3"))
    flushDebounce()

    act(() => result.current.reset("fresh"))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it("caps the stack at 50 entries", () => {
    const { result } = renderHook(() => useQueryHistory("v0"))

    for (let i = 1; i <= 60; i++) {
      act(() => result.current.push(`v${i}`))
      flushDebounce()
    }

    // After 60 pushes, oldest entries should be dropped — but we can still
    // undo to *something*; we can't assert the exact dropped count without
    // exposing internals, so smoke-check that undo/redo still works.
    let undos = 0
    while (result.current.canUndo) {
      result.current.undo()
      undos++
      if (undos > 100) break // safety net
    }
    expect(undos).toBeLessThanOrEqual(50)
    expect(undos).toBeGreaterThan(0)
  })
})
