/**
 * The geometry behind `<PixelScrollTransition />`, kept apart from the component
 * so the part with all the arithmetic in it can be tested without a canvas —
 * jsdom has no 2D context, so anything left inside the `.tsx` is unreachable
 * from a test. Same split as the `camera-angle-*` files.
 *
 * The whole effect is one idea: every cell in the grid gets a **threshold** in
 * `[0, 1]`, and a cell flips from `colorA` to `colorB` once scroll progress
 * passes its threshold. `direction` sets the broad order of those thresholds,
 * `pattern` is a texture mixed into them, and `patternIntensity` is the blend.
 * Nothing here animates; it only decides who goes when.
 */

export const PIXEL_DIRECTIONS = [
  "top-bottom",
  "bottom-top",
  "left-right",
  "right-left",
  "center-out",
  "center-in",
] as const

export const PIXEL_PATTERNS = [
  "random",
  "checker",
  "diagonal",
  "wave",
  "spiral",
  "radial",
] as const

export const PIXEL_EASINGS = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "expo-out",
] as const

export type PixelDirection = (typeof PIXEL_DIRECTIONS)[number]
export type PixelPattern = (typeof PIXEL_PATTERNS)[number]
export type PixelEasing = (typeof PIXEL_EASINGS)[number]

/* ------------------------------------------------------------------ */
/* Scalar helpers                                                      */
/* ------------------------------------------------------------------ */

/** `<= 0` rather than `< 0` so a negative zero cannot leak out as progress. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  return value > 1 ? 1 : value
}

const fract = (value: number) => value - Math.floor(value)

const TAU = Math.PI * 2

/**
 * Deterministic per-cell noise. `Math.random()` cannot be used: the grid is
 * rebuilt on every resize and on every `pixelSize` change, and a fresh random
 * draw each time would make the pattern jump under the reader mid-scroll.
 */
export function hash2d(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^
    Math.imul(y | 0, 0x165667b1) ^
    Math.imul(seed | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const PATTERN_SEED = 0x5eed
const ACCENT_PICK_SEED = 0xacce
const ACCENT_COLOR_SEED = 0xc010

export const EASINGS: Record<PixelEasing, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  "expo-out": (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
}

/* ------------------------------------------------------------------ */
/* Threshold sources                                                   */
/* ------------------------------------------------------------------ */

/**
 * Where a cell sits along the reveal axis, `0` = first, `1` = last.
 *
 * `u` and `v` are the cell's normalised column/row, so the shape of a direction
 * does not change when `pixelSize` does — a `center-out` wipe looks the same at
 * 12px cells as at 48px ones.
 */
export function directionValue(
  col: number,
  row: number,
  cols: number,
  rows: number,
  direction: PixelDirection,
): number {
  const u = cols > 1 ? col / (cols - 1) : 0
  const v = rows > 1 ? row / (rows - 1) : 0

  switch (direction) {
    case "top-bottom":
      return v
    case "bottom-top":
      return 1 - v
    case "left-right":
      return u
    case "right-left":
      return 1 - u
    case "center-out":
      return clamp01(Math.hypot(u * 2 - 1, v * 2 - 1) / Math.SQRT2)
    case "center-in":
      return 1 - clamp01(Math.hypot(u * 2 - 1, v * 2 - 1) / Math.SQRT2)
  }
}

/**
 * The texture mixed into the direction. `radial` is deliberately concentric
 * *rings* rather than plain distance-from-centre — distance is already what the
 * `center-out` direction gives, and a pattern identical to a direction blends
 * into nothing.
 */
export function patternValue(
  col: number,
  row: number,
  cols: number,
  rows: number,
  pattern: PixelPattern,
): number {
  const u = cols > 1 ? col / (cols - 1) : 0
  const v = rows > 1 ? row / (rows - 1) : 0
  const nx = u * 2 - 1
  const ny = v * 2 - 1

  switch (pattern) {
    case "random":
      return hash2d(col, row, PATTERN_SEED)
    // A pure 0/1 checker would quantise the blend into two bands, so a quarter
    // of the range stays noise and keeps the edge from looking stamped.
    case "checker":
      return ((col + row) % 2) * 0.75 + hash2d(col, row, PATTERN_SEED) * 0.25
    case "diagonal":
      return (col + row) / Math.max(1, cols + rows - 2)
    case "wave":
      return 0.5 + 0.5 * Math.sin(u * TAU * 2 + v * TAU * 0.5)
    case "spiral":
      return fract(
        (Math.atan2(ny, nx) / TAU + 1) + (Math.hypot(nx, ny) / Math.SQRT2) * 3,
      )
    case "radial":
      return fract((Math.hypot(nx, ny) / Math.SQRT2) * 3.5)
  }
}

/* ------------------------------------------------------------------ */
/* Grid                                                                */
/* ------------------------------------------------------------------ */

export type PixelGrid = {
  cols: number
  rows: number
  /** Distance from one cell's origin to the next, i.e. `size + gap`. */
  step: number
  /** Painted size of a cell, in CSS px. */
  size: number
  /** `cols * rows` thresholds in `[0, 1]`, row-major. */
  thresholds: Float32Array
  /** Accent colour index per cell, or `-1` for "never accented". */
  accents: Int8Array
}

export type BuildGridOptions = {
  width: number
  height: number
  pixelSize: number
  gap: number
  direction: PixelDirection
  pattern: PixelPattern
  patternIntensity: number
  accentShare: number
  accentCount: number
}

/** `Int8Array` holds the accent index, so the palette cannot exceed this. */
export const MAX_ACCENT_COLORS = 127

export function buildGrid({
  width,
  height,
  pixelSize,
  gap,
  direction,
  pattern,
  patternIntensity,
  accentShare,
  accentCount,
}: BuildGridOptions): PixelGrid {
  const size = Math.max(1, pixelSize)
  const step = size + Math.max(0, gap)
  const cols = Math.max(1, Math.ceil(Math.max(0, width) / step))
  const rows = Math.max(1, Math.ceil(Math.max(0, height) / step))

  const blend = clamp01(patternIntensity)
  const share = clamp01(accentShare)
  const palette = Math.min(Math.max(0, Math.floor(accentCount)), MAX_ACCENT_COLORS)

  const count = cols * rows
  const thresholds = new Float32Array(count)
  const accents = new Int8Array(count)
  accents.fill(-1)

  let min = Infinity
  let max = -Infinity

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      const d = directionValue(col, row, cols, rows, direction)
      const q = patternValue(col, row, cols, rows, pattern)
      const t = d * (1 - blend) + q * blend

      thresholds[i] = t
      if (t < min) min = t
      if (t > max) max = t

      if (palette > 0 && hash2d(col, row, ACCENT_PICK_SEED) < share) {
        accents[i] = Math.min(
          palette - 1,
          Math.floor(hash2d(col, row, ACCENT_COLOR_SEED) * palette),
        )
      }
    }
  }

  // Stretch the mix back onto the full [0, 1] range. Without this a blend can
  // bottom out at, say, 0.2 — and then a fifth of the scroll distance would
  // pass with nothing on screen changing.
  const span = max - min
  if (span > 1e-6) {
    for (let i = 0; i < count; i++) {
      thresholds[i] = (thresholds[i]! - min) / span
    }
  } else {
    thresholds.fill(0)
  }

  return { cols, rows, step, size, thresholds, accents }
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export type ProgressShape = {
  endAt: number
  scrollInfluence: number
  easing: PixelEasing
}

/**
 * Raw scroll fraction -> the value the grid is drawn at.
 *
 * `endAt` finishes the wipe early, `scrollInfluence` bends the curve while
 * pinning both ends (`0` stays `0`, `1` stays `1`), and `easing` is applied
 * last so the named curve is the one actually seen.
 */
export function shapeProgress(
  raw: number,
  { endAt, scrollInfluence, easing }: ProgressShape,
): number {
  const capped = clamp01(raw / Math.max(1e-3, endAt))
  const influence = Math.max(1e-3, scrollInfluence)
  const bent = influence === 1 ? capped : Math.pow(capped, influence)
  return clamp01((EASINGS[easing] ?? EASINGS.linear)(bent))
}

/**
 * How far the element has travelled, before shaping.
 *
 * `elementTop` is the element's top edge relative to the top of whatever is
 * scrolling — the window, or `scrollContainerRef`.
 */
export function scrollProgress(
  mode: "sticky" | "inline",
  elementTop: number,
  elementHeight: number,
  viewportHeight: number,
): number {
  if (mode === "sticky") {
    // The element is taller than the frame pinned inside it; the difference is
    // the whole travel. A root no taller than the viewport has no travel at
    // all, so it reads as done once its top reaches the top.
    const range = elementHeight - viewportHeight
    if (range <= 0) return elementTop <= 0 ? 1 : 0
    return clamp01(-elementTop / range)
  }

  // Inline: `0` as the element enters from the bottom, `1` as it leaves past
  // the top.
  const range = viewportHeight + elementHeight
  if (range <= 0) return 0
  return clamp01((viewportHeight - elementTop) / range)
}

/* ------------------------------------------------------------------ */
/* Cell state                                                          */
/* ------------------------------------------------------------------ */

/** Not revealed yet — still `colorA`. */
export const CELL_BASE = -2
/** Revealed and settled — `colorB`. */
export const CELL_TARGET = -1

/** How far behind the wavefront a cell can still be showing an accent. */
export const ACCENT_BAND = 0.14

/**
 * The accent band narrows to nothing as the wipe completes, so the finished
 * state is flat `colorB` and never a frozen scatter of colour.
 */
export function accentBandWidth(progress: number, maxBand = ACCENT_BAND): number {
  if (maxBand <= 0) return 0
  return Math.max(0, Math.min(maxBand, 1 - progress))
}

/**
 * `CELL_BASE`, `CELL_TARGET`, or an index into the accent palette.
 *
 * The `progress >= 1` short-circuit matters: thresholds are normalised so the
 * last cell sits at exactly `1`, and a plain `threshold < progress` would leave
 * that cell unrevealed forever.
 */
export function classifyCell(
  threshold: number,
  accentIndex: number,
  progress: number,
  band: number,
): number {
  if (!(progress >= 1 || threshold < progress)) return CELL_BASE
  if (accentIndex >= 0 && band > 0 && progress - threshold < band) {
    return accentIndex
  }
  return CELL_TARGET
}
