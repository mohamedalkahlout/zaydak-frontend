/**
 * Direction-aware geometry for the Enhance Studio before/after wipe.
 *
 * The slider's position is stored **logically**: `pos` is how much of the
 * original is revealed, measured from the *inline-start* edge. So the original
 * sits on the left in English and on the right in Arabic, and the drag gesture
 * reads the same in both — pull toward the original to see more of it.
 *
 * Every conversion between that logical value and a physical axis lives here,
 * for one reason: each of the three is independently invertible, and getting
 * any of them wrong fails *silently*. A wipe built on `left:` and `ArrowLeft`
 * still renders and still drags under RTL — it just moves the wrong way, which
 * no type or lint rule catches. Pure functions make the inversion assertable.
 */

/** Slider bounds, the subset of DOMRect this module needs. */
export interface CompareBox {
  left: number
  width: number
}

const MIN = 0
const MAX = 100

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n))

/**
 * Logical position (0–100 from the inline-start edge) for a pointer at
 * `clientX`. In RTL the inline-start edge is the box's right edge, so the
 * physical ratio is mirrored.
 */
export function logicalPos(
  clientX: number,
  box: CompareBox,
  rtl: boolean,
): number {
  if (box.width <= 0) return MIN
  const ratio = (clientX - box.left) / box.width
  return clamp((rtl ? 1 - ratio : ratio) * MAX)
}

/**
 * `clip-path` that reveals the original from the inline-start edge, clipping
 * away the trailing `100 - pos`%. Which physical side that is depends on
 * direction.
 */
export function revealClip(pos: number, rtl: boolean): string {
  const trailing = MAX - clamp(pos)
  return rtl ? `inset(0 0 0 ${trailing}%)` : `inset(0 ${trailing}% 0 0)`
}

/**
 * Next position for a key press, or `null` when the key is not ours (so the
 * caller knows to leave the event alone rather than swallow it).
 *
 * Arrow keys are physical and `pos` is logical, so RTL flips which arrow grows
 * the value. Home/End are already logical — "start" and "end" — and do not.
 */
export function posForKey(
  key: string,
  pos: number,
  rtl: boolean,
  step = 5,
): number | null {
  const forward = rtl ? -step : step
  switch (key) {
    case "ArrowLeft":
      return clamp(pos - forward)
    case "ArrowRight":
      return clamp(pos + forward)
    case "Home":
      return MIN
    case "End":
      return MAX
    default:
      return null
  }
}
