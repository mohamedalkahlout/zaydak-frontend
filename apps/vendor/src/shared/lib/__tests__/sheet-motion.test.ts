import { describe, it, expect } from "vitest"
import {
  SHEET_EXIT_MS,
  SHEET_MOTION,
  SHEET_MOTION_STILL,
} from "../sheet-motion"

/**
 * The three things about this gesture that cannot be seen by looking at it,
 * and that a later tweak would quietly break.
 */
describe("the review sheet's gesture", () => {
  it("never overshoots its dock", () => {
    // The sheet is `z-40` and the site header is `z-30`. Any bounce past
    // `y: 0` paints the sheet's title bar over a header that is still live and
    // still taking clicks, and overshoot scales with travel — which here is
    // the whole viewport. The badge is the one element allowed to bounce: it
    // is 24px and the sheet's own `overflow-hidden` clips it.
    const docked = SHEET_MOTION.sheet.docked as {
      y: number
      transition: { y: { bounce: number }; scale: { bounce: number } }
    }
    expect(docked.y).toBe(0)
    expect(docked.transition.y.bounce).toBe(0)
    expect(docked.transition.scale.bounce).toBe(0)
  })

  it("declares every phase on every part", () => {
    // Motion propagates the parent's label to any child declaring `variants`
    // and no `animate`. A part missing `gone` snaps back to its docked values
    // halfway through the exit, which reads as the sheet shedding its contents.
    for (const [name, variants] of Object.entries(SHEET_MOTION)) {
      expect(Object.keys(variants).sort(), name).toEqual([
        "below",
        "docked",
        "gone",
      ])
    }
  })

  it("keeps the exit tween and the navigation timer on one number", () => {
    // `use-sheet-gesture` pushes after `SHEET_EXIT_MS`. A longer tween would be
    // cut off mid-slide; a shorter one parks the sheet off-screen over a dead
    // dashboard while the timer runs out.
    const gone = SHEET_MOTION.sheet.gone as {
      transition: { duration: number }
    }
    expect(gone.transition.duration).toBe(SHEET_EXIT_MS / 1000)
    const scrimGone = SHEET_MOTION.scrim.gone as {
      transition: { duration: number }
    }
    expect(scrimGone.transition.duration).toBe(SHEET_EXIT_MS / 1000)
  })

  it("renders a complete, settled screen under reduced motion", () => {
    // Not "a faster animation" and not "fewer elements": every phase has to
    // describe the finished screen, including the exit — which must not slide
    // either, or the preference is honoured on the way in and ignored on the
    // way out.
    expect(SHEET_MOTION_STILL.sheet.below).toEqual({ y: 0, scale: 1 })
    expect(SHEET_MOTION_STILL.part.below).toEqual({ opacity: 1, y: 0 })
    expect(SHEET_MOTION_STILL.badge.below).toEqual({ opacity: 1, scale: 1 })
    expect(SHEET_MOTION_STILL.scrim.below).toEqual({ opacity: 1 })

    for (const [name, variants] of Object.entries(SHEET_MOTION_STILL)) {
      const { transition: _docked, ...docked } = variants.docked as Record<
        string,
        unknown
      >
      const { transition: _gone, ...gone } = variants.gone as Record<
        string,
        unknown
      >
      expect(docked, name).toEqual(gone)
    }
  })
})
