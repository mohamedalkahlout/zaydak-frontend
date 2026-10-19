import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { PixelScrollTransition } from "../pixel-scroll-transition"

/**
 * jsdom has neither a 2D context nor a `ResizeObserver`, and every box it
 * reports is zero-sized — so nothing here can assert on pixels. What it *can*
 * pin is that the component degrades to inert markup instead of throwing, and
 * that the two layout modes build the boxes the effect depends on: a sticky
 * frame needs a taller-than-viewport root to travel through, and an inline one
 * needs the canvas filling its own height.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
describe("<PixelScrollTransition />", () => {
  const boxes = (container: HTMLElement) => {
    const root = container.firstElementChild as HTMLElement
    return { root, frame: root.firstElementChild as HTMLElement }
  }

  it("renders without a 2D context or a ResizeObserver", () => {
    expect(globalThis.ResizeObserver).toBeUndefined()
    expect(() => render(<PixelScrollTransition />)).not.toThrow()
    expect(document.querySelector("canvas")).not.toBeNull()
  })

  it("gives sticky mode a scroll-length root and a pinned frame", () => {
    const { container } = render(
      <PixelScrollTransition mode="sticky" scrollHeight="180vh" />,
    )
    const { root, frame } = boxes(container)
    expect(root.style.height).toBe("180vh")
    expect(frame.className).toContain("sticky")
    expect(frame.className).toContain("h-svh")
  })

  it("gives inline mode its own height and fills it with the frame", () => {
    const { container } = render(
      <PixelScrollTransition mode="inline" height="900px" />,
    )
    const { root, frame } = boxes(container)
    expect(root.style.height).toBe("900px")
    expect(frame.className).not.toContain("sticky")
    expect(frame.className).toContain("absolute")
    expect(frame.className).toContain("inset-0")
  })

  it("keeps the canvas out of the accessibility tree", () => {
    render(<PixelScrollTransition>overlaid copy</PixelScrollTransition>)
    expect(document.querySelector("canvas")!.getAttribute("aria-hidden")).toBe(
      "true",
    )
    // Children are decoration's *content*, so they stay readable.
    expect(screen.getByText("overlaid copy")).not.toBeNull()
  })

  it("renders children over the canvas, inside the same frame", () => {
    const { container } = render(
      <PixelScrollTransition>
        <h2>Welcome</h2>
      </PixelScrollTransition>,
    )
    const { frame } = boxes(container)
    const overlay = frame.lastElementChild as HTMLElement
    expect(frame.firstElementChild!.tagName).toBe("CANVAS")
    expect(overlay.contains(screen.getByText("Welcome"))).toBe(true)
    expect(overlay.className).toContain("z-10")
  })

  it("adds no overlay when there are no children", () => {
    const { container } = render(<PixelScrollTransition />)
    expect(boxes(container).frame.children).toHaveLength(1)
  })

  it("merges className onto the root without dropping its own layout", () => {
    const { container } = render(<PixelScrollTransition className="my-24" />)
    const { root } = boxes(container)
    expect(root.className).toContain("my-24")
    expect(root.className).toContain("relative")
  })

  it("releases its scroll listeners and pending frame on unmount", () => {
    const add = vi.spyOn(window, "addEventListener")
    const remove = vi.spyOn(window, "removeEventListener")
    const cancel = vi.spyOn(globalThis, "cancelAnimationFrame")

    const { unmount } = render(<PixelScrollTransition />)
    expect(add.mock.calls.some(([type]) => type === "scroll")).toBe(true)

    unmount()
    expect(remove.mock.calls.some(([type]) => type === "scroll")).toBe(true)
    expect(remove.mock.calls.some(([type]) => type === "resize")).toBe(true)
    // The very first draw is still queued at this point.
    expect(cancel).toHaveBeenCalled()

    add.mockRestore()
    remove.mockRestore()
    cancel.mockRestore()
  })

  it("watches <html> so a theme change repaints without a remount", () => {
    const observe = vi.spyOn(MutationObserver.prototype, "observe")
    const { unmount } = render(<PixelScrollTransition colorA="--background" />)

    const call = observe.mock.calls.find(
      ([target]) => target === document.documentElement,
    )
    expect(call).toBeDefined()
    expect(call![1]!.attributeFilter).toEqual(["class", "style"])

    unmount()
    observe.mockRestore()
  })
})
