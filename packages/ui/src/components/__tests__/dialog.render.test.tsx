import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { Dialog, DialogContent, DialogTitle } from "../dialog"

/**
 * `scroll` decides what moves when a dialog is taller than the window, and the
 * two modes are pinned apart because the difference is invisible until a
 * short screen meets a long panel.
 *
 * The default pins the popup to the centre of the viewport, so a caller that
 * overflows caps its own height and scrolls inside itself — right for a
 * confirm or a form with sticky actions. `viewport` puts it in a full-window
 * scroller instead, so the bar is the window's own and the whole card travels
 * with it. The class that makes that work is `fixed` versus `relative` on the
 * popup: a `fixed` popup inside a scroll container sits still while its
 * container moves, which is a dialog whose content cannot be reached.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
describe("<DialogContent scroll />", () => {
  const open = (props: { scroll?: "popup" | "viewport" }) =>
    render(
      <Dialog open>
        <DialogContent {...props}>
          <DialogTitle>Sign in</DialogTitle>
        </DialogContent>
      </Dialog>,
    )

  it("pins the popup to the viewport centre by default", () => {
    open({})

    const popup = document.querySelector("[data-slot=dialog-content]")!
    expect(document.querySelector("[data-slot=dialog-viewport]")).toBe(null)
    expect(popup.className).toContain("fixed")
    expect(popup.className).not.toContain("relative")
  })

  it("hands the scroll to the window when asked", () => {
    open({ scroll: "viewport" })

    const scroller = document.querySelector("[data-slot=dialog-viewport]")!
    const popup = document.querySelector("[data-slot=dialog-content]")!

    expect(scroller.className).toContain("overflow-y-auto")
    // The popup is inside the scroller and moves with it.
    expect(scroller.contains(popup)).toBe(true)
    expect(popup.className).toContain("relative")
    expect(popup.className).not.toContain("fixed")
    // Short content stays centred: the row grows past the window only once the
    // card does.
    expect(popup.parentElement!.className).toContain("min-h-full")

    expect(screen.getByText("Sign in")).toBeTruthy()
  })

  it("keeps the card behind mounted and marked when one stacks on it", () => {
    render(
      <Dialog open>
        <DialogContent scroll="viewport">
          <DialogTitle>Sign in</DialogTitle>
          <Dialog open>
            <DialogContent scroll="viewport">
              <DialogTitle>Create your account</DialogTitle>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>,
    )

    const cards = Array.from(
      document.querySelectorAll("[data-slot=dialog-content]"),
    )
    expect(cards).toHaveLength(2)

    const [behind, front] = cards
    expect(behind.hasAttribute("data-nested-dialog-open")).toBe(true)
    expect(front.hasAttribute("data-nested")).toBe(true)
    // One wash over the page however deep the stack goes.
    expect(document.querySelectorAll("[data-slot=dialog-overlay]")).toHaveLength(
      1,
    )
    // Both cards leave the centre for the top of their scroller, which is the
    // only way two cards of different heights can be compared at all.
    expect(behind.className).toContain("self-start")
    expect(front.className).toContain("self-start")
  })
})
