import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "../drawer"

/**
 * A drawer opened from inside another drawer.
 *
 * The thing worth pinning is that the parent **stays**: a flow that asks for
 * one more thing halfway through must not throw away the screen that asked,
 * and the difference between "stacked behind" and "replaced" is invisible in
 * a screenshot of the frontmost panel. Base UI supplies the wiring — the
 * child is marked `data-nested`, the parent `data-nested-dialog-open`, the
 * depth lands in `--nested-dialogs`, and a nested dialog renders no backdrop
 * of its own — and this package supplies only what the step back looks like.
 *
 * The single backdrop is the half most easily lost. Four drawers each washing
 * the page would leave the first one nearly black, which is why the
 * assertion is on the count and not on the frontmost one existing.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */
describe("nested <Drawer />", () => {
  const popups = () =>
    Array.from(document.querySelectorAll("[data-slot=drawer-content]"))

  it("keeps the parent mounted and marks the stack", () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Parent</DrawerTitle>
          <DrawerDescription>The one that asked.</DrawerDescription>
          <Drawer open>
            <DrawerContent>
              <DrawerTitle>Child</DrawerTitle>
              <DrawerDescription>The frontmost one.</DrawerDescription>
            </DrawerContent>
          </Drawer>
        </DrawerContent>
      </Drawer>,
    )

    expect(screen.getByText("Parent")).toBeTruthy()
    expect(screen.getByText("Child")).toBeTruthy()

    const [parent, child] = popups()
    expect(popups()).toHaveLength(2)
    expect(parent.hasAttribute("data-nested-dialog-open")).toBe(true)
    expect(parent.hasAttribute("data-nested")).toBe(false)
    expect(child.hasAttribute("data-nested")).toBe(true)
    // Only the outermost drawer washes the page.
    expect(
      document.querySelectorAll("[data-slot=drawer-overlay]"),
    ).toHaveLength(1)
  })

  /**
   * The step back was keyed only on the parent (`data-nested-dialog-open`);
   * nothing was keyed on `data-nested`, so the drawer in front was styled
   * exactly like a lone one and — a nested dialog having no backdrop — sat
   * flush against the strip of its parent. It now casts a shadow toward its
   * free edge, which is the side that strip is on.
   *
   * jsdom applies no stylesheet, so what can be pinned is the rule itself:
   * that the popup Base UI marks `data-nested` carries a `data-nested:` shadow
   * pointing the right way for its side, beside the parent's own rule.
   */
  it.each([
    ["down", "bottom", /data-nested:shadow-\[0_-12px/],
    ["up", "top", /data-nested:shadow-\[0_12px/],
    ["left", "left", /data-nested:shadow-\[12px_0/],
    ["right", "right", /data-nested:shadow-\[-12px_0/],
  ] as const)(
    "casts the child's shadow onto the parent's strip (%s)",
    (swipeDirection, side, rule) => {
      render(
        <Drawer open swipeDirection={swipeDirection}>
          <DrawerContent>
            <DrawerTitle>Parent</DrawerTitle>
            <Drawer open swipeDirection={swipeDirection}>
              <DrawerContent>
                <DrawerTitle>Child</DrawerTitle>
              </DrawerContent>
            </Drawer>
          </DrawerContent>
        </Drawer>,
      )

      const [parent, child] = popups()
      expect(child.getAttribute("data-side")).toBe(side)
      // The attribute the rule keys on is the child's alone…
      expect(child.hasAttribute("data-nested")).toBe(true)
      expect(parent.hasAttribute("data-nested")).toBe(false)
      // …and the rule points at the free edge for this side.
      expect(child.className).toMatch(rule)
      // The parent's step back is still keyed on its own attribute.
      expect(parent.hasAttribute("data-nested-dialog-open")).toBe(true)
      expect(parent.className).toMatch(/data-nested-dialog-open:\[translate:/)
    },
  )

  it("gives a drawer in the middle of a stack both rules", () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>First</DrawerTitle>
          <Drawer open>
            <DrawerContent>
              <DrawerTitle>Second</DrawerTitle>
              <Drawer open>
                <DrawerContent>
                  <DrawerTitle>Third</DrawerTitle>
                </DrawerContent>
              </Drawer>
            </DrawerContent>
          </Drawer>
        </DrawerContent>
      </Drawer>,
    )

    const [, middle, front] = popups()
    // A child of the first and a parent of the third.
    expect(middle.hasAttribute("data-nested")).toBe(true)
    expect(middle.hasAttribute("data-nested-dialog-open")).toBe(true)
    expect(front.hasAttribute("data-nested")).toBe(true)
    expect(front.hasAttribute("data-nested-dialog-open")).toBe(false)
  })

  it("marks nothing when a drawer is on its own", () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Alone</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    )

    const [only] = popups()
    expect(only.hasAttribute("data-nested-dialog-open")).toBe(false)
    expect(only.hasAttribute("data-nested")).toBe(false)
  })

  it("exposes the axis a call site styles its content against", () => {
    const { rerender } = render(
      <Drawer open swipeDirection="down">
        <DrawerContent>
          <DrawerTitle>Sheet</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    )
    expect(popups()[0].getAttribute("data-swipe-axis")).toBe("y")
    expect(popups()[0].getAttribute("data-side")).toBe("bottom")

    rerender(
      <Drawer open swipeDirection="right">
        <DrawerContent>
          <DrawerTitle>Sheet</DrawerTitle>
        </DrawerContent>
      </Drawer>,
    )
    expect(popups()[0].getAttribute("data-swipe-axis")).toBe("x")
    expect(popups()[0].getAttribute("data-side")).toBe("right")
  })
})
