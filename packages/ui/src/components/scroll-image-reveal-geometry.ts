/**
 * The arithmetic behind `<ScrollImageReveal />`, kept apart from the component
 * so the part that decides *where every tile starts and when it lands* can be
 * tested without a browser — motion's `useScroll` reads element rects, and
 * jsdom reports every rect as zero. Same split as `pixel-scroll-transition`.
 *
 * Nothing here animates. Scroll progress is a number in `[0, 1]` that the
 * component owns; this module only answers two questions about a tile:
 *
 * - its **window** — the slice of that progress during which it travels, so a
 *   tile with `[0.1, 0.4]` is at its start pose below `0.1`, settled above
 *   `0.4`, and in between exactly as far along as the reader has scrolled;
 * - its **start pose** — the transform it travels *from*. The settled pose is
 *   always the identity, so a tile ends up exactly where CSS grid put it.
 */

export const REVEAL_EFFECTS = ["columns", "scatter"] as const
export type RevealEffect = (typeof REVEAL_EFFECTS)[number]

/** A tile's window on the progress axis, both ends in `[0, 1]`, `start <= end`. */
export type RevealWindow = { start: number; end: number }

/** The transform a tile travels from. `x`/`y` are percent of its own box, `z` is px. */
export type RevealPose = {
  x: number
  y: number
  z: number
  rotateX: number
  rotateY: number
  rotateZ: number
}

export const IDENTITY_POSE: RevealPose = {
  x: 0,
  y: 0,
  z: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
}

/* ------------------------------------------------------------------ */
/* Scalar helpers                                                      */
/* ------------------------------------------------------------------ */

/** `<= 0` rather than `< 0` so a negative zero cannot leak out. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  return value > 1 ? 1 : value
}

/**
 * Deterministic per-tile noise in `[0, 1)`.
 *
 * `Math.random()` cannot be used: the pose is read during render, so a fresh
 * draw would be a render-body impurity, would hand the server and the client
 * different transforms (a hydration mismatch on every tile), and would reshuffle
 * the whole gallery on any unrelated re-render. Hashing `(index, seed, salt)`
 * instead means a tile's pose is a property of its slot, and a caller wanting a
 * different arrangement changes `seed`.
 */
export function hash(index: number, seed: number, salt: number): number {
  let h =
    Math.imul(index | 0, 0x27d4eb2d) ^
    Math.imul(seed | 0, 0x165667b1) ^
    Math.imul(salt | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Maps a unit value onto `[-1, 1]`. */
const signed = (u: number) => u * 2 - 1

/* ------------------------------------------------------------------ */
/* "columns": every column rises into place, the middle one first     */
/* ------------------------------------------------------------------ */

/**
 * How far a column sits from the middle of the grid, `0` for the centre
 * column(s) and `1` for the two outermost. An even column count has no single
 * centre, so the two middle columns share `1 / (cols - 1)` rather than one of
 * them being singled out.
 */
export function columnDistance(column: number, columns: number): number {
  if (columns <= 1) return 0
  const centre = (columns - 1) / 2
  return clamp01(Math.abs(column - centre) / centre)
}

export type ColumnsOptions = {
  /** Progress at which the last column has landed. */
  settleAt: number
  /**
   * Share of the reveal a single column's travel takes, in `(0, 1]`. Lower
   * means more of the reveal is spent *waiting* on the outer columns, so the
   * V between them and the centre is deeper.
   */
  share: number
}

/**
 * The window for a tile in `column` of `columns`.
 *
 * Every column travels for the same length; what differs is when it starts,
 * and that is linear in its distance from the centre. Linear matters: a
 * scrubbed scroll shows the whole grid at one instant, so the columns' offsets
 * at that instant *are* the shape the reader sees, and a linear delay is what
 * draws the clean V from the reference rather than an arch.
 */
export function columnWindow(
  column: number,
  columns: number,
  { settleAt, share }: ColumnsOptions,
): RevealWindow {
  const total = clamp01(settleAt)
  const length = Math.min(1, Math.max(1e-3, share))
  const distance = columnDistance(column, columns)
  const start = distance * (1 - length) * total
  return { start, end: Math.min(total, start + length * total) }
}

/* ------------------------------------------------------------------ */
/* "scatter": every tile arrives from its own place in space           */
/* ------------------------------------------------------------------ */

export type ScatterOptions = {
  /** Progress at which the last tile has landed. */
  settleAt: number
  /** Furthest a tile starts behind the page, in px along `z`. */
  depth: number
  /** Largest rotation a tile starts with, in degrees. */
  tilt: number
}

/** Salts for the independent draws, so no two channels share a value. */
const SALT = {
  x: 1,
  y: 2,
  z: 3,
  rotateX: 4,
  rotateY: 5,
  rotateZ: 6,
  start: 7,
  length: 8,
} as const

/** Earliest a tile may start, as a share of the reveal. */
export const SCATTER_LATEST_START = 0.45
/** Shortest and longest a tile's travel may be, as a share of the reveal. */
export const SCATTER_MIN_LENGTH = 0.4
export const SCATTER_MAX_LENGTH = 0.9

/**
 * The start pose for tile `index`.
 *
 * Every tile begins *below* its slot and *behind* the page — a positive `y`
 * and a negative `z` — because the gallery scrolls up into view, and a tile
 * rising towards the reader as it comes into frame is the whole effect. What
 * is randomised is how far, how deep, and which way it is turned; the sign of
 * `y` and `z` is not.
 */
export function scatterPose(
  index: number,
  seed: number,
  { depth, tilt }: Pick<ScatterOptions, "depth" | "tilt">,
): RevealPose {
  const far = Math.max(0, depth)
  const turn = Math.max(0, tilt)
  return {
    x: signed(hash(index, seed, SALT.x)) * 80,
    y: 120 + hash(index, seed, SALT.y) * 280,
    z: -(0.3 + 0.7 * hash(index, seed, SALT.z)) * far,
    rotateX: (0.4 + 0.6 * hash(index, seed, SALT.rotateX)) * turn,
    rotateY: signed(hash(index, seed, SALT.rotateY)) * turn * 0.75,
    rotateZ: signed(hash(index, seed, SALT.rotateZ)) * turn * 0.4,
  }
}

/**
 * The window for tile `index`: a start drawn from the first part of the reveal
 * and a length long enough that no tile snaps, both scaled onto `[0, settleAt]`
 * and the end capped there, so the slowest tile still lands on time.
 */
export function scatterWindow(
  index: number,
  seed: number,
  { settleAt }: Pick<ScatterOptions, "settleAt">,
): RevealWindow {
  const total = clamp01(settleAt)
  const start = hash(index, seed, SALT.start) * SCATTER_LATEST_START
  const length =
    SCATTER_MIN_LENGTH +
    hash(index, seed, SALT.length) * (SCATTER_MAX_LENGTH - SCATTER_MIN_LENGTH)
  return {
    start: start * total,
    end: Math.min(total, (start + length) * total),
  }
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

/**
 * Where a tile is along its own travel, `0` at the start pose and `1`
 * settled, for a scroll `progress`. A window with no width lands instantly
 * at its `start` rather than dividing by zero.
 */
export function windowProgress(
  progress: number,
  { start, end }: RevealWindow,
): number {
  const span = end - start
  if (span <= 0) return progress >= start ? 1 : 0
  return clamp01((progress - start) / span)
}
