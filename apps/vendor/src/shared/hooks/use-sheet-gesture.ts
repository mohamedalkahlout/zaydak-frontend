"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useHydrated, useSafeReducedMotion } from "@repo/ui/hooks/use-hydrated"
import { navigateGuarded } from "@/shared/stores/leave-guard"
import {
  SHEET_EXIT_MS,
  SHEET_MOTION,
  SHEET_MOTION_STILL,
} from "@/shared/lib/sheet-motion"

export type SheetPhase = "docked" | "gone"

/**
 * Drive a route-level sheet's entrance and exit.
 *
 * `enter` is false in exactly two cases, both deliberate:
 *
 * 1. **A hard load onto the sheet's own URL.** `useHydrated()` is false only
 *    when a component's first render IS the hydration render, so capturing it
 *    at mount tells the sheet whether anybody was looking at the dashboard
 *    before it arrived. Nothing was covered, so there is no "over" to animate —
 *    and it is what keeps a `translateY(100%)` out of the server markup, where
 *    nothing could undo it until JavaScript lands.
 * 2. **prefers-reduced-motion.** Trustworthy here *because* of (1):
 *    `useSafeReducedMotion()` reports false on the server and on the first
 *    client render by design, and that is the one render where we never animate
 *    anyway.
 *
 * It is captured with a lazy `useState` rather than read live, so a hydration
 * flip cannot start an animation half a second after the screen already looks
 * finished.
 *
 * **The exit exists only because the navigation is delayed.** The sheet
 * unmounts on navigation inside an App Router page, and there is no
 * `AnimatePresence` above a route change to play it out. `requestExit` asks the
 * leave guard first — exactly as the screen's X, its exit button and Escape
 * already did — so a dirty draft still gets its prompt, and the slide starts
 * only once the merchant has said to leave.
 *
 * The push is fired by a **timer** matched to the exit tween rather than by
 * `onAnimationComplete`: requestAnimationFrame is suspended in a backgrounded
 * tab, so a merchant who presses Escape and switches tab would come back to a
 * sheet parked off-screen over a dead dashboard with only the Back button to
 * save them. A timer is throttled there but still fires.
 *
 * `requestExit` is idempotent — one `setState` to a constant — so a second
 * Escape, or a stale closure in a keydown handler, cannot schedule a second
 * navigation.
 */
export function useSheetGesture(href: string) {
  const router = useRouter()
  const hydrated = useHydrated()
  const reduced = useSafeReducedMotion()
  const [enter] = useState(() => hydrated && !reduced)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!closing) return
    const id = window.setTimeout(
      () => router.push(href),
      reduced ? 0 : SHEET_EXIT_MS,
    )
    return () => window.clearTimeout(id)
  }, [closing, reduced, href, router])

  return {
    /** Feed to `initial={enter ? "below" : false}` on the sheet and the scrim. */
    enter,
    /** Feed to `animate={phase}`. */
    phase: (closing ? "gone" : "docked") as SheetPhase,
    /** True while the exit is in flight — the sheet should take no more input. */
    closing,
    /** The four variant sets, already switched for the merchant's preference. */
    motion: reduced ? SHEET_MOTION_STILL : SHEET_MOTION,
    /** Ask to leave: the guard decides, then the sheet slides, then we navigate. */
    requestExit: () => navigateGuarded(href, () => setClosing(true)),
  }
}
