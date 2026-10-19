import type { BreadId } from "../types"
import {
  BASKETS,
  BREAD_FILL,
  BREAD_SIZE,
  CURTAIN,
  CURTAIN_H,
  INTERIOR_K,
  SEAMS,
  SHUTTER_MOUTH,
} from "./geometry"

/**
 * Static layout of the scene's repeated parts, shared by the markup (street.tsx)
 * and the scroll engine (street-scene.ts) so the two always agree.
 */

export interface SlatSpec {
  /** top edge on the curtain, plate units */
  y0: number
  h: number
  /** CSS top inside the shutter box */
  top: number
  /** rattle phase, so neighbouring strips do not shake in step */
  phase: number
  last: boolean
}

/** The curtain cut into strips on the real slat seams. */
export function slatLayout(): SlatSpec[] {
  const cuts = [0, ...SEAMS.filter((s) => s > 8 && s < CURTAIN_H - 6), CURTAIN_H]
  return cuts.slice(0, -1).map((y0, i) => ({
    y0,
    h: cuts[i + 1] - y0,
    top: y0 + (CURTAIN.y0 - SHUTTER_MOUTH),
    phase: (i * 2.39) % 6.28,
    last: i === cuts.length - 2,
  }))
}

export interface LoafSpec {
  id: BreadId
  /** the basket box: wider than the basket, clipped at its front rim */
  box: { left: number; width: number; height: number }
  /** visible: everything above the line through the opening's centre, plus the front half of the opening */
  clip: string
  shadow: { left: number; width: number; top: number }
  /** the bread inside its box */
  img: { left: number; top: number; width: number; height: number }
  /** the bread in interior px: its top-left and size */
  x: number
  y: number
  w: number
  h: number
  /** the basket opening's vertical radius, px: how far the bread lifts */
  ry: number
}

const f1 = (v: number) => v.toFixed(1)

/** Each bread sitting in its basket on the interior photo (interior px). */
export function loafLayout(ids: BreadId[]): LoafSpec[] {
  return ids.map((id, i) => {
    const [bcx, bcy, brx, bry] = BASKETS[i]
    const [nw, nh] = BREAD_SIZE[id]
    const w = brx * 2 * BREAD_FILL[id] * INTERIOR_K
    const h = (w * nh) / nw
    const boxX = (bcx - brx * 1.35) * INTERIOR_K
    const boxW = brx * 2.7 * INTERIOR_K
    const rimY = bcy * INTERIOR_K
    const rx = brx * INTERIOR_K * 0.985
    const ry = bry * INTERIOR_K * 0.97
    const x = boxW / 2 - w / 2
    const y = rimY + bry * INTERIOR_K * 0.86 - h // its bottom just inside the front rim
    return {
      id,
      box: { left: boxX, width: boxW, height: rimY + ry + 4 },
      clip: `path('M0 0 H${f1(boxW)} V${f1(rimY)} H${f1(boxW / 2 + rx)} A${f1(rx)} ${f1(ry)} 0 0 1 ${f1(boxW / 2 - rx)} ${f1(rimY)} H0 Z')`,
      shadow: { left: boxW / 2 - w * 0.4, width: w * 0.8, top: rimY + bry * INTERIOR_K * 0.62 },
      img: { left: x, top: y, width: w, height: h },
      x: boxX + x,
      y,
      w,
      h,
      ry: bry * INTERIOR_K,
    }
  })
}
