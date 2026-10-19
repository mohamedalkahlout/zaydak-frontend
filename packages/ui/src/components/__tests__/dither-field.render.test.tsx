import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"

import { DitherField, __resetDitherFieldGl } from "../dither-field"

/**
 * jsdom has no WebGL, no `IntersectionObserver`, and no 2D canvas context, so
 * nothing here can assert on pixels. What it *can* pin is the whole reason this
 * wrapper exists rather than the raw `Dithering`:
 *
 * - the canvas is never mounted until the host is actually on screen, and is
 *   released when it leaves — the contract that keeps a decoration from eating
 *   one of the browser's ~16 WebGL contexts on every page;
 * - a design token reaches the shader as a literal colour, because the shader
 *   parses only hex/rgb/hsl and turns everything else into opaque black;
 * - an unresolvable colour is drawn transparent rather than black, and says so
 *   once;
 * - `prefers-reduced-motion` freezes it;
 * - a browser with no WebGL2 takes the field off the page instead of leaving an
 *   unhandled rejection for Next's error overlay.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */

const mocks = vi.hoisted(() => ({
  props: [] as Record<string, unknown>[],
  reducedMotion: false,
}))

vi.mock("@paper-design/shaders-react", () => ({
  Dithering: (props: Record<string, unknown>) => {
    mocks.props.push(props)
    return (
      <div
        data-testid="dithering"
        aria-hidden={props["aria-hidden"] === true ? "true" : undefined}
      />
    )
  },
}))

vi.mock("motion/react", () => ({
  useReducedMotion: () => mocks.reducedMotion,
}))

type ObserverCb = (entries: { isIntersecting: boolean }[]) => void

/** Installs a drivable `IntersectionObserver`; returns the visibility switch. */
function fakeIntersectionObserver() {
  const callbacks: ObserverCb[] = []
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: ObserverCb) {
        callbacks.push(cb)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    },
  )
  return (isIntersecting: boolean) =>
    act(() => {
      callbacks.forEach((cb) => cb([{ isIntersecting }]))
    })
}

/** The prop bag from the most recent shader render. */
const lastProps = () => mocks.props[mocks.props.length - 1]!

beforeEach(() => {
  mocks.props.length = 0
  mocks.reducedMotion = false
  __resetDitherFieldGl()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  document.documentElement.className = ""
})

describe("<DitherField />", () => {
  it("mounts no shader without an IntersectionObserver, and still shows children", () => {
    expect(globalThis.IntersectionObserver).toBeUndefined()

    render(<DitherField colorFront="#ffffff">paper still shows</DitherField>)

    expect(screen.queryByTestId("dithering")).toBeNull()
    expect(screen.getByText("paper still shows")).not.toBeNull()
  })

  it("keeps its own layout while merging className, and adds no overlay with no children", () => {
    const { container } = render(<DitherField colorFront="#ffffff" className="absolute inset-0" />)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain("absolute")
    expect(root.className).toContain("overflow-hidden")
    expect(root.children).toHaveLength(0)
  })

  it("mounts the shader only once on screen, and releases it on the way out", () => {
    vi.useFakeTimers()
    const setVisible = fakeIntersectionObserver()

    render(<DitherField colorFront="#ffffff" />)
    expect(screen.queryByTestId("dithering")).toBeNull()

    setVisible(true)
    expect(screen.getByTestId("dithering")).not.toBeNull()
    // Decoration, so it stays out of the accessibility tree.
    expect(screen.getByTestId("dithering").getAttribute("aria-hidden")).toBe(
      "true",
    )

    // Leaving is delayed, so a scroll that flicks past does not tear it down.
    setVisible(false)
    expect(screen.queryByTestId("dithering")).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(1600)
    })
    expect(screen.queryByTestId("dithering")).toBeNull()

    vi.useRealTimers()
  })

  it("resolves a var(--token) against :root into a colour the shader can parse", () => {
    const setVisible = fakeIntersectionObserver()
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) =>
        name === "--shop-footer-accent" ? " #d4f24a " : "",
    } as unknown as CSSStyleDeclaration)

    render(<DitherField colorFront="var(--shop-footer-accent)" />)
    setVisible(true)

    expect(lastProps().colorFront).toBe("#d4f24a")
  })

  it("falls back through a var() chain, and passes a literal straight through", () => {
    const setVisible = fakeIntersectionObserver()
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "",
    } as unknown as CSSStyleDeclaration)

    render(
      <DitherField
        colorFront="var(--missing, #112233)"
        colorBack="rgb(10, 20, 30)"
      />,
    )
    setVisible(true)

    expect(lastProps().colorFront).toBe("#112233")
    expect(lastProps().colorBack).toBe("rgb(10, 20, 30)")
  })

  it("draws an unresolvable colour transparent, warning once rather than painting black", () => {
    const setVisible = fakeIntersectionObserver()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    // jsdom hands back no 2D context, so the normalising probe cannot run —
    // the same position a browser is in for a colour it does not understand.
    const { rerender } = render(<DitherField colorFront="oklch(0.7 0.1 40)" />)
    setVisible(true)
    rerender(<DitherField colorFront="oklch(0.7 0.1 40)" />)

    expect(lastProps().colorFront).toBe("rgba(0, 0, 0, 0)")
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]![0])).toContain("could not resolve")
  })

  it("defaults the back colour to transparent so the host's own surface shows", () => {
    const setVisible = fakeIntersectionObserver()
    render(<DitherField colorFront="#ffffff" />)
    setVisible(true)

    expect(lastProps().colorBack).toBe("rgba(0, 0, 0, 0)")
  })

  it("freezes the render loop under prefers-reduced-motion", () => {
    const setVisible = fakeIntersectionObserver()
    mocks.reducedMotion = true

    render(<DitherField colorFront="#ffffff" speed={0.8} />)
    setVisible(true)

    expect(lastProps().speed).toBe(0)
  })

  it("re-resolves colours when the document theme changes", async () => {
    const setVisible = fakeIntersectionObserver()
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      () =>
        ({
          getPropertyValue: () =>
            document.documentElement.className.includes("dark")
              ? "#c8e644"
              : "#d4f24a",
        }) as unknown as CSSStyleDeclaration,
    )

    render(<DitherField colorFront="var(--shop-footer-accent)" />)
    setVisible(true)
    expect(lastProps().colorFront).toBe("#d4f24a")

    document.documentElement.className = "dark"
    // The class is watched with a MutationObserver, which delivers on a
    // microtask — hence the await rather than a synchronous assertion.
    await act(async () => {})

    expect(lastProps().colorFront).toBe("#c8e644")
  })

  it("takes the field off the page when the browser has no WebGL2", () => {
    const setVisible = fakeIntersectionObserver()

    render(<DitherField colorFront="#ffffff" />)
    setVisible(true)
    expect(screen.queryByTestId("dithering")).not.toBeNull()

    const event = Object.assign(
      new Event("unhandledrejection", { cancelable: true }),
      {
        reason: new Error(
          "Paper Shaders: WebGL is not supported in this browser",
        ),
      },
    )
    act(() => {
      window.dispatchEvent(event)
    })

    expect(screen.queryByTestId("dithering")).toBeNull()
    // Claimed, so Next's overlay never reports a decoration as a page error.
    expect(event.defaultPrevented).toBe(true)
  })

  it("leaves every other unhandled rejection to whoever owns it", () => {
    const setVisible = fakeIntersectionObserver()

    render(<DitherField colorFront="#ffffff" />)
    setVisible(true)

    const event = Object.assign(
      new Event("unhandledrejection", { cancelable: true }),
      { reason: new Error("something else entirely") },
    )
    act(() => {
      window.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(false)
    expect(screen.queryByTestId("dithering")).not.toBeNull()
  })
})
