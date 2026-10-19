/**
 * Geometry for the AI Studio free canvas — the node graph where the source
 * image sits as a node and every generated shot hangs off it on an arrow.
 *
 * Everything here is pure and framework-free so the layout can be reasoned
 * about (and tested) without a DOM: the component owns state and rendering,
 * this module owns arithmetic. That split is the house rule for
 * direction-sensitive maths — see `compare-geometry.ts`, whose inversions this
 * module deliberately does *not* copy.
 *
 * **Two coordinate spaces.** `world` is the graph's own space, fixed and
 * unbounded — a node's position never changes because the viewport moved.
 * `screen` is the pixels the vendor points at, measured from the stage's
 * top-left. The viewport ({@link Viewport}) is the only bridge, and every
 * gesture converts at that boundary rather than mutating world positions, so
 * panning can never drift the graph apart.
 *
 * **The flow axis is content, not chrome — so it never mirrors.** `x` grows
 * right and `y` grows down in Arabic exactly as in English, the same call the
 * light-direction picker makes for where the key light falls and the analytics
 * charts make for the time axis. Two consequences the canvas must honour: the
 * viewport subtree is pinned `dir="ltr"` so the app's global `dir="rtl"` cannot
 * leak in, and nodes are positioned with physical `left`/`top`, never
 * `insetInlineStart` — feeding a physical coordinate to a logical property
 * inverts silently under RTL, which no type or lint rule catches.
 */

/** A node's box in world space. */
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Pan + zoom. A world point `p` maps to screen `p * scale + t`. */
export interface Viewport {
  scale: number
  tx: number
  ty: number
}

export const SOURCE_SIZE = 268
export const SHOT_SIZE = 208
/** World gap between the source column and the shot column. */
export const COLUMN_GAP = 176
/** World gap between stacked shots. */
export const ROW_GAP = 30

export const MIN_SCALE = 0.25
export const MAX_SCALE = 3
/** One notch of the zoom buttons / one wheel detent. */
export const ZOOM_STEP = 1.2
/** World pixels an arrow-key nudge moves the selected node. */
export const NUDGE_STEP = 16

export const clampScale = (s: number) =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

/**
 * Place the source node and one node per shot.
 *
 * The source sits at the world origin and the shots stack in a single column
 * to its right, centred on the source's midline — so a lone shot points
 * straight across and a pair splits evenly above and below. A column rather
 * than a radial fan keeps arrows from crossing at any count and keeps the graph
 * about as wide as it is tall, which is the shape that fits the editor's
 * landscape stage.
 */
export function layoutGraph(shotCount: number) {
  const source: Box = {
    x: -SOURCE_SIZE / 2,
    y: -SOURCE_SIZE / 2,
    w: SOURCE_SIZE,
    h: SOURCE_SIZE,
  }
  if (shotCount <= 0) return { source, shots: [] as Box[] }

  const columnH = shotCount * SHOT_SIZE + (shotCount - 1) * ROW_GAP
  const x = SOURCE_SIZE / 2 + COLUMN_GAP
  const shots = Array.from({ length: shotCount }, (_, i) => ({
    x,
    y: -columnH / 2 + i * (SHOT_SIZE + ROW_GAP),
    w: SHOT_SIZE,
    h: SHOT_SIZE,
  }))
  return { source, shots }
}

/** Add a node's accumulated drag offset to its laid-out box. */
export const withOffset = (box: Box, dx = 0, dy = 0): Box => ({
  ...box,
  x: box.x + dx,
  y: box.y + dy,
})

/** World gap between stacked source clusters. */
export const CLUSTER_GAP = 96

/** One source and the shots that branch off it. */
export interface Cluster {
  source: Box
  shots: Box[]
}

/**
 * Lay out one cluster per source, stacked vertically and centred on the origin.
 *
 * A batch run enhances N images with one set of settings, and the review has to
 * show which output came from which source — so the graph grows *down*, one
 * self-contained row per source, rather than pouring every output into one fan.
 * Stacking is what keeps an arrow's meaning unambiguous at twenty sources: it
 * never crosses a neighbouring cluster, so "this came from that" is readable
 * without following a line across the canvas.
 *
 * Composed from {@link layoutGraph} rather than reimplementing it, so a single
 * source lays out **byte-identically** to before this existed — the one-image
 * case is not a special case, it is `layoutClusters([n])`.
 */
export function layoutClusters(shotCounts: number[]): Cluster[] {
  if (!shotCounts.length) return []

  const bases = shotCounts.map((n) => layoutGraph(Math.max(0, n)))
  // A cluster is as tall as its taller column: with one shot the source is
  // taller, with three the shot column is. Measuring rather than assuming keeps
  // the gap between clusters constant instead of varying with shot count.
  const extents = bases.map((b) => {
    const boxes = [b.source, ...b.shots]
    const top = Math.min(...boxes.map((x) => x.y))
    const bottom = Math.max(...boxes.map((x) => x.y + x.h))
    return { top, height: bottom - top }
  })

  const total =
    extents.reduce((sum, e) => sum + e.height, 0) +
    CLUSTER_GAP * (extents.length - 1)

  let y = -total / 2
  return bases.map((b, i) => {
    const { top, height } = extents[i]!
    const dy = y - top
    y += height + CLUSTER_GAP
    return {
      source: withOffset(b.source, 0, dy),
      shots: b.shots.map((s) => withOffset(s, 0, dy)),
    }
  })
}

/**
 * Cubic bezier from the source's right edge to one shot's left edge, in world
 * space.
 *
 * Control points are pulled horizontally out of each anchor, so every arrow
 * leaves the source and arrives at the shot travelling along the flow axis —
 * that is what makes a fan of three read as three branches of one thing rather
 * than three unrelated diagonals. The pull scales with the horizontal run so a
 * node dragged far away keeps a proportionate curve instead of a flat wire, and
 * has a floor so a node dragged *behind* the source still bows out visibly
 * instead of collapsing onto the straight line between them.
 */
export function edgePath(source: Box, shot: Box): string {
  const ax = source.x + source.w
  const ay = source.y + source.h / 2
  const bx = shot.x
  const by = shot.y + shot.h / 2
  const pull = Math.max(56, Math.abs(bx - ax) * 0.5)
  return `M ${ax} ${ay} C ${ax + pull} ${ay}, ${bx - pull} ${by}, ${bx} ${by}`
}

/** Smallest world box containing every given box. */
export function boundsOf(boxes: Box[]): Box {
  const first = boxes[0]
  if (!first) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = first.x
  let minY = first.y
  let maxX = first.x + first.w
  let maxY = first.y + first.h
  for (const b of boxes) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * Viewport that centres `content` inside a `viewW × viewH` stage with `pad`
 * screen pixels of breathing room.
 *
 * Never zooms past 1:1. A graph that already fits should render at its natural
 * size rather than being blown up to fill the stage, which would only magnify
 * the JPEG artefacts the vendor is here to judge.
 */
export function fitViewport(
  content: Box,
  viewW: number,
  viewH: number,
  pad = 64,
): Viewport {
  if (content.w <= 0 || content.h <= 0 || viewW <= 0 || viewH <= 0) {
    return { scale: 1, tx: viewW / 2, ty: viewH / 2 }
  }
  const scale = clampScale(
    Math.min(1, (viewW - pad * 2) / content.w, (viewH - pad * 2) / content.h),
  )
  return {
    scale,
    tx: viewW / 2 - (content.x + content.w / 2) * scale,
    ty: viewH / 2 - (content.y + content.h / 2) * scale,
  }
}

/** Screen point (relative to the stage) → world point. */
export function toWorld(v: Viewport, sx: number, sy: number) {
  return { x: (sx - v.tx) / v.scale, y: (sy - v.ty) / v.scale }
}

/**
 * Zoom by `factor` while pinning the world point under the cursor in place —
 * the behaviour every canvas tool has, and the reason this takes a focal point
 * rather than just a scale. Clamping first makes a zoom at the limit a no-op
 * instead of silently turning into a pan.
 */
export function zoomAt(
  v: Viewport,
  factor: number,
  sx: number,
  sy: number,
): Viewport {
  const scale = clampScale(v.scale * factor)
  if (scale === v.scale) return v
  const w = toWorld(v, sx, sy)
  return { scale, tx: sx - w.x * scale, ty: sy - w.y * scale }
}

/**
 * Arrow-key nudge for a focused node, in world pixels.
 *
 * **Physical, and identical in both locales.** ArrowRight is `+x` under Arabic
 * too, because it moves a node along the content axis rather than stepping
 * through a logical sequence — the mirror image of `posForKey`, which inverts
 * arrows precisely because the value it drives *is* logical. Returns `null` for
 * keys the canvas does not own, so the handler can leave them to the browser.
 */
export function nudgeForKey(key: string): { dx: number; dy: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { dx: -NUDGE_STEP, dy: 0 }
    case "ArrowRight":
      return { dx: NUDGE_STEP, dy: 0 }
    case "ArrowUp":
      return { dx: 0, dy: -NUDGE_STEP }
    case "ArrowDown":
      return { dx: 0, dy: NUDGE_STEP }
    default:
      return null
  }
}
