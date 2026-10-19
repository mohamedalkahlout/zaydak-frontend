import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useLeaveGuard } from "../use-leave-guard"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"

// The hook's job is to see a navigation before the router does. What matters
// is which clicks it claims — a plain same-tab, same-origin link — and which
// it leaves to the browser, because a capture listener on `document` that got
// that wrong would swallow ordinary clicks across the whole app.

const store = () => useLeaveGuardStore.getState()

/**
 * Dispatch a click and report whether the guard cancelled it. The probe sits
 * in the bubble phase, after the guard's capture listener, and its own
 * `preventDefault` only keeps jsdom from attempting a navigation it cannot do.
 */
function click(el: Element, init: MouseEventInit = {}) {
  let prevented = false
  const probe = (e: Event) => {
    prevented = e.defaultPrevented
    e.preventDefault()
  }
  document.addEventListener("click", probe)
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }))
  document.removeEventListener("click", probe)
  return prevented
}

function anchor(href: string, attrs: Record<string, string> = {}) {
  const a = document.createElement("a")
  a.setAttribute("href", href)
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v)
  const label = document.createElement("span")
  label.textContent = href
  a.appendChild(label)
  document.body.appendChild(a)
  return { a, label }
}

function fireBeforeUnload() {
  const e = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(e)
  return e.defaultPrevented
}

beforeEach(() => {
  useLeaveGuardStore.setState({ guard: null, pending: null })
})

afterEach(() => {
  document.body.innerHTML = ""
})

describe("useLeaveGuard", () => {
  it("arms the store and cancels an in-app link click while `when` is true", () => {
    const onLeave = vi.fn()
    renderHook(() => useLeaveGuard({ when: true, onLeave }))
    expect(store().guard).not.toBeNull()

    // Clicked on the text inside the link, the way a real click lands.
    const { label } = anchor("/store/acme/orders")
    expect(click(label)).toBe(true)
    expect(store().pending?.href).toBe("/store/acme/orders")
  })

  it("lets a destination `allow` vouches for through untouched", () => {
    renderHook(() =>
      useLeaveGuard({
        when: true,
        allow: (p) => p.startsWith("/store/acme/settings/general"),
        onLeave: vi.fn(),
      }),
    )
    const { a } = anchor("/store/acme/settings/general/brand")
    expect(click(a)).toBe(false)
    expect(store().pending).toBeNull()
  })

  it("leaves clicks that are the browser's alone", () => {
    renderHook(() => useLeaveGuard({ when: true, onLeave: vi.fn() }))

    const { a: plain } = anchor("/store/acme/orders")
    expect(click(plain, { ctrlKey: true })).toBe(false)
    expect(click(plain, { metaKey: true })).toBe(false)
    expect(click(plain, { button: 1 })).toBe(false)

    const { a: newTab } = anchor("/store/acme/products", { target: "_blank" })
    expect(click(newTab)).toBe(false)

    const { a: download } = anchor("/export.csv", { download: "" })
    expect(click(download)).toBe(false)

    const { a: external } = anchor("https://example.com/help")
    expect(click(external)).toBe(false)

    const { a: hash } = anchor("#brand-logo")
    expect(click(hash)).toBe(false)

    expect(store().pending).toBeNull()
  })

  it("ignores a click nothing links from", () => {
    renderHook(() => useLeaveGuard({ when: true, onLeave: vi.fn() }))
    const button = document.createElement("button")
    document.body.appendChild(button)
    expect(click(button)).toBe(false)
    expect(store().pending).toBeNull()
  })

  it("asks the browser to prompt on reload or close", () => {
    renderHook(() => useLeaveGuard({ when: true, onLeave: vi.fn() }))
    expect(fireBeforeUnload()).toBe(true)
  })

  it("reads the latest callbacks without re-arming", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ allow, onLeave }: { allow: (p: string) => boolean; onLeave: () => void }) =>
        useLeaveGuard({ when: true, allow, onLeave }),
      { initialProps: { allow: () => false, onLeave: first } },
    )
    const armed = store().guard

    rerender({ allow: () => true, onLeave: second })
    // Same guard object — a re-arm per render would drop a `pending` mid-prompt.
    expect(store().guard).toBe(armed)

    const { a } = anchor("/store/acme/orders")
    expect(click(a)).toBe(false)

    store().request("/anything-else")
    store().confirm()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it("stands down entirely once `when` turns false", () => {
    const { rerender } = renderHook(
      ({ when }: { when: boolean }) => useLeaveGuard({ when, onLeave: vi.fn() }),
      { initialProps: { when: true } },
    )
    rerender({ when: false })
    expect(store().guard).toBeNull()

    const { a } = anchor("/store/acme/orders")
    expect(click(a)).toBe(false)
    expect(fireBeforeUnload()).toBe(false)
  })

  it("cleans up on unmount", () => {
    const { unmount } = renderHook(() => useLeaveGuard({ when: true, onLeave: vi.fn() }))
    unmount()
    expect(store().guard).toBeNull()
    const { a } = anchor("/store/acme/orders")
    expect(click(a)).toBe(false)
    expect(fireBeforeUnload()).toBe(false)
  })

  it("never arms while `when` is false", () => {
    renderHook(() => useLeaveGuard({ when: false, onLeave: vi.fn() }))
    expect(store().guard).toBeNull()
    const { a } = anchor("/store/acme/orders")
    expect(click(a)).toBe(false)
  })

  it("pushes a sentinel history state when armed and traps popstate (browser back/forward)", () => {
    const onLeave = vi.fn()
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {})

    renderHook(() => useLeaveGuard({ when: true, onLeave }))
    expect(window.history.state?.__leave_guard_sentinel).toBe(true)

    // Simulate browser Back button (popstate event)
    window.dispatchEvent(new PopStateEvent("popstate"))

    expect(store().pending).not.toBeNull()
    expect(store().pending?.proceed).toBeDefined()
    expect(store().pending?.cancel).toBeDefined()

    // When vendor cancels, sentinel is restored
    store().cancel()
    expect(store().pending).toBeNull()
    expect(window.history.state?.__leave_guard_sentinel).toBe(true)

    // Fire popstate again and confirm leaving
    window.dispatchEvent(new PopStateEvent("popstate"))
    expect(store().pending).not.toBeNull()

    const held = store().confirm()
    expect(onLeave).toHaveBeenCalledTimes(1)
    held?.proceed?.()
    expect(backSpy).toHaveBeenCalled()

    backSpy.mockRestore()
  })
})
