import type { BreadId } from "../types"

/**
 * Where things sit in the art, measured by hand.
 *
 * Plate units: the street photos are laid out on a 1536 x 1024 grid (the files
 * are 1.5x that, 2304 x 1536). The interior photo uses the same grid for its own
 * coordinates. Every number here changes only when an image does.
 */

export const PLATE_W = 1536
export const PLATE_H = 1024

/** The interior photo's size in px, and px per interior unit. */
export const INTERIOR_W = 2304
export const INTERIOR_H = 1536
export const INTERIOR_K = INTERIOR_W / PLATE_W

/** The shutter opening: x0, y0, x1, y1. */
export const CURTAIN = { x0: 409, y0: 402, x1: 1125, y1: 767 } as const
export const CURTAIN_W = CURTAIN.x1 - CURTAIN.x0
export const CURTAIN_H = CURTAIN.y1 - CURTAIN.y0

/** Top of the shutter box, where the slats roll into the drum. */
export const SHUTTER_MOUTH = 401

/** The door leaf. */
export const DOOR = { x0: 683, y0: 410, x1: 835, y1: 765 } as const

/** Slat seams down the curtain, measured from its top. The shutter breaks into strips on them. */
export const SEAMS = [3, 15, 31, 47, 63, 80, 96, 113, 130, 147, 164, 180, 197, 214, 231, 248, 265, 281, 297, 314, 330, 342]

/** The point the camera walks towards: the middle of the door. */
export const FOCUS = { x: 759, y: 587.5 } as const

/** The middle of the basket rack, interior units. */
export const RACK = { x: 765, y: 495 } as const

/** Each basket opening on the interior photo: centre x, centre y, radius x, radius y. Top row, then bottom row. */
export const BASKETS: [number, number, number, number][] = [
  [404, 385.5, 103, 68.5],
  [644, 386, 103, 69],
  [888, 385.5, 103, 68.5],
  [1127, 387, 103, 69],
  [389.5, 596, 108.5, 77],
  [639.5, 596, 107.5, 77],
  [891.5, 596.5, 107.5, 76.5],
  [1141.5, 596.5, 108.5, 76.5],
]

/** Natural size of each bread cut-out. */
export const BREAD_SIZE: Record<BreadId, [number, number]> = {
  tamees: [760, 282],
  samoon: [760, 360],
  kaak: [760, 467],
  sourdough: [760, 708],
  croissant: [760, 486],
  cardamom: [760, 714],
  zaatar: [760, 591],
  date: [760, 714],
}

/** How much of its basket's width each bread fills. */
export const BREAD_FILL: Record<BreadId, number> = {
  tamees: 0.92,
  kaak: 0.74,
  samoon: 0.8,
  zaatar: 0.74,
  sourdough: 0.62,
  croissant: 0.8,
  date: 0.6,
  cardamom: 0.6,
}

/**
 * The card image's largest share of its slot's width. Mirrored by `.cBread`'s
 * `max-width` in bake-board.module.css: the scene works out where each loaf lands
 * from it, before the card images have loaded.
 */
export const CARD_BREAD_MAX_WIDTH = 0.88
