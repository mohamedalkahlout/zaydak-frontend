import { beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { AppleSwitch } from "../apple-switch"

/**
 * `AppleSwitch` can be dragged as well as clicked, and the drag is the one
 * piece of it CSS cannot mirror: pointer deltas are viewport pixels, so a
 * rightward drag reads the same in both scripts while the track it is dragging
 * across has been flipped. Left unhandled, an RTL user drags *away* from "on"
 * to switch it on.
 *
 * The track's mirroring itself (`rtl:-scale-x-100`) is a class and is asserted
 * as one — jsdom lays nothing out, so the visual half of this belongs in a
 * browser. The gesture is real behaviour and is exercised here.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */

const TRAVEL_PX = 40 // comfortably past the md preset's track travel

beforeAll(() => {
  // jsdom has no pointer capture, and the component captures on every press.
  Element.prototype.setPointerCapture = function setPointerCapture() {}
  Element.prototype.releasePointerCapture = function releasePointerCapture() {}
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
})

function drag(el: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(el, { clientX: from, button: 0, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: to, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: to, pointerId: 1 })
}

function mount(dir: "ltr" | "rtl", onCheckedChange: (v: boolean) => void) {
  return render(
    <div dir={dir}>
      <AppleSwitch checked={false} onCheckedChange={onCheckedChange} label="الشحن" />
    </div>,
  )
}

describe("AppleSwitch drag direction", () => {
  it("turns on when dragged toward the end of the line — rightward in LTR", () => {
    const onCheckedChange = vi.fn()
    mount("ltr", onCheckedChange)
    const sw = screen.getByRole("switch")

    drag(sw, 100, 100 + TRAVEL_PX)
    expect(onCheckedChange).toHaveBeenCalledWith(true)

    cleanup()

    const backwards = vi.fn()
    mount("ltr", backwards)
    drag(screen.getByRole("switch"), 100, 100 - TRAVEL_PX)
    expect(backwards).not.toHaveBeenCalled()
  })

  it("turns on when dragged leftward under RTL, where the end of the line is", () => {
    const onCheckedChange = vi.fn()
    mount("rtl", onCheckedChange)
    const sw = screen.getByRole("switch")

    drag(sw, 100, 100 - TRAVEL_PX)
    expect(onCheckedChange).toHaveBeenCalledWith(true)

    cleanup()

    // And the same rightward drag that switched it on in LTR must not here:
    // it is a drag back toward "off".
    const backwards = vi.fn()
    mount("rtl", backwards)
    drag(screen.getByRole("switch"), 100, 100 + TRAVEL_PX)
    expect(backwards).not.toHaveBeenCalled()
  })

  it("mirrors the track so the thumb travels with the script", () => {
    mount("rtl", () => {})
    expect(screen.getByRole("switch").className).toContain("rtl:-scale-x-100")
  })
})
