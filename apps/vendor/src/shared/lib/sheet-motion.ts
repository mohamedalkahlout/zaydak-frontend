import type { Variants } from "motion/react"

/**
 * A route-level sheet's entrance and exit, as values rather than as JSX.
 *
 * ONE gesture in four coordinated parts, driven by a single `animate` label on
 * the sheet: the ground dims, the sheet rises and resolves to full size, and
 * the structural rows inside it catch up behind it, with a small badge popping
 * as the first row settles. Everything moves `transform` and `opacity` only.
 *
 * The label vocabulary is `below` / `docked` / `gone`, and **every** variant
 * object here declares all three. Motion propagates a parent's label to any
 * descendant that declares `variants` and no `animate` of its own, so a child
 * missing `gone` would snap back to its `docked` values mid-exit.
 */

/**
 * How long the exit takes.
 *
 * The navigation timer in `use-sheet-gesture` and the `gone` tween below MUST
 * agree: the timer is what actually leaves the page, and a tween longer than it
 * would be cut off, while a shorter one would leave the sheet parked off-screen
 * over a dead dashboard.
 */
export const SHEET_EXIT_MS = 220
const EXIT_S = SHEET_EXIT_MS / 1000

/**
 * The sheet itself. `bounce: 0`, and that is not timidity.
 *
 * Spring overshoot scales with travel, and this travel is the whole band. The
 * sheet is `z-40` and the site header is `z-30`, so any overshoot past `y: 0`
 * paints the sheet's title bar over a header that is still live and still
 * taking clicks; an undershoot at the other end opens a slice of dashboard at
 * the foot of the band. The character comes from the composition — the scrim
 * leading, the scale resolving before the travel, the rows cascading behind —
 * not from letting an 800px rectangle wobble.
 *
 * `scale` finishes FASTER than `y` on purpose: the sheet reaches full size just
 * before it reaches its dock, so the last stretch reads as settling into a slot
 * rather than as two things stopping at once.
 */
export const SHEET: Variants = {
  below: { y: "100%", scale: 0.97 },
  docked: {
    y: 0,
    scale: 1,
    transition: {
      y: { type: "spring", visualDuration: 0.42, bounce: 0 },
      scale: { type: "spring", visualDuration: 0.3, bounce: 0 },
      // The rows begin while the sheet is still a third of the way up, so this
      // reads as one gesture rather than a rise followed by a reveal.
      delayChildren: 0.1,
      staggerChildren: 0.045,
    },
  },
  // The return is its own gesture, not the rise reversed: accelerate out, one
  // beat, no stagger, scale held. Opacity is never touched — a sheet that fades
  // while it slides reads as broken rather than as leaving.
  gone: {
    y: "100%",
    scale: 1,
    transition: { duration: EXIT_S, ease: [0.32, 0, 0.67, 0] },
  },
}

/**
 * The structural rows — title bar, toolbar, the rail-and-pane row.
 *
 * 14px of travel, so a little overshoot IS visible here and is where the
 * gesture gets its life. `gone` holds them still and opaque: on the way out the
 * sheet carries its contents with it rather than shedding them.
 */
export const SHEET_PART: Variants = {
  below: { opacity: 0, y: 14 },
  docked: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", visualDuration: 0.34, bounce: 0.3 },
  },
  gone: { opacity: 1, y: 0, transition: { duration: 0 } },
}

/**
 * The punctuation mark. Nested inside the title bar, so it fires at that row's
 * stagger slot with no hand-tuned delay. A 24px element is the one place on
 * this screen where a real overshoot is both legible and harmless — the sheet's
 * own `overflow-hidden` clips it long before it could reach the header.
 */
export const SHEET_BADGE: Variants = {
  below: { opacity: 0, scale: 0.4 },
  docked: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", visualDuration: 0.36, bounce: 0.5 },
  },
  gone: { opacity: 1, scale: 1, transition: { duration: 0 } },
}

/**
 * The ground dims BEFORE the sheet arrives — 220ms against the rise's 420ms —
 * and that ordering is most of why the whole thing reads as deliberate rather
 * than as a panel appearing.
 */
export const SHEET_SCRIM: Variants = {
  below: { opacity: 0 },
  docked: { opacity: 1, transition: { duration: 0.22, ease: "easeOut" } },
  gone: { opacity: 0, transition: { duration: EXIT_S, ease: "linear" } },
}

/**
 * Reduced motion: the same elements, already landed, in every phase.
 *
 * Not "a faster animation" and not "no elements" — an instant, complete screen.
 * `docked` and `gone` carry identical values on purpose, which is what the
 * invariant test asserts: a reduced-motion exit must not slide either.
 */
export const SHEET_STILL: Variants = {
  below: { y: 0, scale: 1 },
  docked: { y: 0, scale: 1, transition: { duration: 0 } },
  gone: { y: 0, scale: 1, transition: { duration: 0 } },
}
export const SHEET_PART_STILL: Variants = {
  below: { opacity: 1, y: 0 },
  docked: { opacity: 1, y: 0, transition: { duration: 0 } },
  gone: { opacity: 1, y: 0, transition: { duration: 0 } },
}
export const SHEET_BADGE_STILL: Variants = {
  below: { opacity: 1, scale: 1 },
  docked: { opacity: 1, scale: 1, transition: { duration: 0 } },
  gone: { opacity: 1, scale: 1, transition: { duration: 0 } },
}
export const SHEET_SCRIM_STILL: Variants = {
  below: { opacity: 1 },
  docked: { opacity: 1, transition: { duration: 0 } },
  gone: { opacity: 1, transition: { duration: 0 } },
}

/** One switch at the call site, so no screen can mix the two sets. */
export const SHEET_MOTION = {
  sheet: SHEET,
  part: SHEET_PART,
  badge: SHEET_BADGE,
  scrim: SHEET_SCRIM,
} as const

export const SHEET_MOTION_STILL = {
  sheet: SHEET_STILL,
  part: SHEET_PART_STILL,
  badge: SHEET_BADGE_STILL,
  scrim: SHEET_SCRIM_STILL,
} as const

export type SheetMotion = typeof SHEET_MOTION

// PERFORMANCE CONTRACT — the part that rots, so it is written down.
//
// Six elements move, and only `transform` and `opacity` on each: the scrim, the
// sheet, the three structural rows, and the badge nested in the first of them.
// Nothing animates per rail row or per field card: a fifty-row list cascading
// in is fifty animations for one gesture nobody asked to watch.
//
// Do NOT add `will-change` classes. transform/opacity already take the
// accelerated path, and a permanent `will-change: transform` on a
// viewport-sized element containing two scroll containers (the rail's list and
// the pane) costs more than it buys.
