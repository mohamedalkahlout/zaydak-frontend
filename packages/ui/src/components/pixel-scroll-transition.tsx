"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import type { CSSProperties, ReactNode, RefObject } from "react"

import { useSafeReducedMotion } from "../hooks/use-hydrated"
import { cn } from "../lib/utils"
import {
  accentBandWidth,
  buildGrid,
  CELL_BASE,
  CELL_TARGET,
  classifyCell,
  MAX_ACCENT_COLORS,
  scrollProgress,
  shapeProgress,
  type PixelDirection,
  type PixelEasing,
  type PixelGrid,
  type PixelPattern,
} from "./pixel-scroll-transition-grid"

// The grid module is a `.ts`, and the package only maps `./components/*` onto
// `.tsx` — so this file is the only door consumers have to these names. The
// option lists come along because anything building a picker for these props
// needs them, and hand-copied literals would drift.
export {
  PIXEL_DIRECTIONS,
  PIXEL_EASINGS,
  PIXEL_PATTERNS,
} from "./pixel-scroll-transition-grid"
export type {
  PixelDirection,
  PixelEasing,
  PixelPattern,
} from "./pixel-scroll-transition-grid"

const DEFAULT_COLOR_A = "#252422"
const DEFAULT_COLOR_B = "#fffcf2"

/** Module scope, not a default parameter — a fresh array per render would retrigger every effect. */
const DEFAULT_ACCENT_COLORS = ["#eb5e28", "#00A699", "#FFB400", "#FC642D"]

/**
 * A 3x device pixel ratio triples the fill cost for a grid of flat rectangles
 * that has no detail finer than a cell, so it is capped.
 */
const MAX_DPR = 2

/* ------------------------------------------------------------------ */
/* Colour resolution                                                   */
/* ------------------------------------------------------------------ */

let probeCache: CanvasRenderingContext2D | null | undefined

function safeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d")
  } catch {
    // jsdom has no 2D context. Every caller already handles `null`, so the
    // component renders its markup and simply paints nothing.
    return null
  }
}

function probeContext(): CanvasRenderingContext2D | null {
  if (probeCache === undefined) {
    probeCache =
      typeof document === "undefined"
        ? null
        : safeContext(document.createElement("canvas"))
  }
  return probeCache
}

/**
 * Whether canvas can actually paint this string.
 *
 * Assigning an invalid `fillStyle` is a silent no-op — the previous colour
 * stays. So the value is assigned twice from two different starting colours: if
 * both land on the same result it parsed, and if they land on the two starting
 * colours it did not.
 */
function isPaintable(value: string): boolean {
  const ctx = probeContext()
  if (!ctx || !value) return false
  ctx.fillStyle = "#000000"
  ctx.fillStyle = value
  const fromBlack = ctx.fillStyle
  ctx.fillStyle = "#ffffff"
  ctx.fillStyle = value
  return ctx.fillStyle === fromBlack
}

/**
 * Accepts a plain CSS colour, `var(--token)`, or the bare token name `--token`.
 *
 * Custom properties are read off `<html>` rather than passed through to canvas,
 * which has no cascade of its own and would treat `var(...)` as invalid.
 */
function resolveColor(value: string, fallback: string): string {
  if (typeof document === "undefined") return fallback
  let raw = value.trim()
  if (raw.startsWith("var(")) raw = raw.slice(4, -1).split(",")[0]!.trim()
  if (raw.startsWith("--")) {
    raw = getComputedStyle(document.documentElement).getPropertyValue(raw).trim()
  }
  return raw && isPaintable(raw) ? raw : fallback
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export type PixelScrollTransitionProps = {
  /**
   * `"sticky"` pins the canvas for a viewport-length transition, `"inline"`
   * animates it as the element passes through the viewport.
   */
  mode?: "sticky" | "inline"
  /** Starting colour. CSS colour, `var(--token)`, or a bare `--token`. */
  colorA?: string
  /** Finishing colour. Same forms as `colorA`. */
  colorB?: string
  /** Broad order the cells reveal in. */
  direction?: PixelDirection
  /** Texture mixed into that order. */
  pattern?: PixelPattern
  /** `0` is direction only, `1` is pattern only. */
  patternIntensity?: number
  /** Curve applied to scroll progress before the grid is drawn. */
  easing?: PixelEasing
  /** Cell size in CSS px. */
  pixelSize?: number
  /** Space between cells in CSS px. The gap shows `colorA`. */
  gap?: number
  /** Scroll progress at which the wipe is complete. Lower finishes earlier. */
  endAt?: number
  /** Roughly what share of cells flash an accent colour as the front passes. */
  accentShare?: number
  /** Palette for that flash. Same colour forms as `colorA`. */
  accentColors?: string[]
  /** The scrollable ancestor driving the effect. Omit when the page scrolls. */
  scrollContainerRef?: RefObject<HTMLElement | null>
  /** Bends the curve while pinning both ends. Above `1` slows the early reveal. */
  scrollInfluence?: number
  /** Extra scroll distance in `"sticky"` mode. */
  scrollHeight?: string
  /** Element height in `"inline"` mode. */
  height?: string
  className?: string
  /** Rendered over the canvas, inside the same frame. */
  children?: ReactNode
}

/**
 * A canvas wipe between two colours, driven by scroll position rather than by
 * time: every cell in the grid has a threshold, and it flips once progress
 * passes it. All of that arithmetic lives in `pixel-scroll-transition-grid.ts`;
 * what is here is the plumbing — measuring, resolving colours, and painting.
 *
 * Three things it has to survive that a naive version does not:
 *
 * - **Theme changes.** Token colours are resolved against `<html>`, so a theme
 *   toggle has to be observed and the canvas repainted. Nothing remounts.
 * - **Resizes.** The grid is rebuilt from the frame's box, but the thresholds
 *   are hashed from the *cell index*, so the pattern is stable across rebuilds
 *   instead of reshuffling under the reader mid-scroll.
 * - **No 2D context.** Under jsdom `getContext` yields nothing; the markup
 *   still renders and painting is skipped rather than throwing.
 *
 * Under `prefers-reduced-motion` the accent flash is dropped. The wipe itself
 * stays — it tracks the scrollbar exactly, so it is the reader's own motion.
 */
export function PixelScrollTransition({
  mode = "sticky",
  colorA = DEFAULT_COLOR_A,
  colorB = DEFAULT_COLOR_B,
  direction = "bottom-top",
  pattern = "random",
  patternIntensity = 0.4,
  easing = "ease-out",
  pixelSize = 24,
  gap = 0,
  endAt = 0.85,
  accentShare = 0.15,
  accentColors = DEFAULT_ACCENT_COLORS,
  scrollContainerRef,
  scrollInfluence = 1,
  scrollHeight = "200vh",
  height = "600px",
  className,
  children,
}: PixelScrollTransitionProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const gridRef = useRef<PixelGrid | null>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const colorsRef = useRef({
    base: DEFAULT_COLOR_A,
    target: DEFAULT_COLOR_B,
    accents: [] as string[],
  })
  const bucketsRef = useRef<number[][]>([])
  const progressRef = useRef(0)
  const rafRef = useRef(0)

  const still = useSafeReducedMotion()

  // The joined key *is* the identity of the palette, so the memo is rebuilt from
  // it rather than from the prop — a caller passing an inline array literal
  // would otherwise re-run every effect on every render. No CSS colour contains
  // a pipe, so the round-trip is lossless.
  const accentKey = accentColors.join("|")
  const accents = useMemo(
    () => accentKey.split("|").filter(Boolean).slice(0, MAX_ACCENT_COLORS),
    [accentKey],
  )
  const accentCount = accents.length

  const paint = useCallback(() => {
    const ctx = ctxRef.current
    const grid = gridRef.current
    if (!ctx || !grid) return

    const colors = colorsRef.current
    const { width, height: frameHeight } = sizeRef.current
    const progress = shapeProgress(progressRef.current, {
      endAt,
      scrollInfluence,
      easing,
    })
    const band = still ? 0 : accentBandWidth(progress)

    ctx.fillStyle = colors.base
    ctx.fillRect(0, 0, width, frameHeight)

    if (bucketsRef.current.length !== colors.accents.length) {
      bucketsRef.current = colors.accents.map(() => [])
    }
    const buckets = bucketsRef.current
    for (const bucket of buckets) bucket.length = 0

    // One pass laying down every settled cell with a single `fillStyle`, with
    // the few cells inside the accent band deferred into per-colour buckets.
    // Switching `fillStyle` per cell instead costs a state change per pixel.
    const { cols, rows, step, size, thresholds, accents: cellAccents } = grid
    ctx.fillStyle = colors.target
    for (let row = 0; row < rows; row++) {
      const y = row * step
      const rowOffset = row * cols
      for (let col = 0; col < cols; col++) {
        const state = classifyCell(
          thresholds[rowOffset + col]!,
          cellAccents[rowOffset + col]!,
          progress,
          band,
        )
        if (state === CELL_BASE) continue
        if (state === CELL_TARGET) {
          ctx.fillRect(col * step, y, size, size)
          continue
        }
        buckets[state]?.push(col * step, y)
      }
    }

    for (let k = 0; k < buckets.length; k++) {
      const bucket = buckets[k]!
      if (bucket.length === 0) continue
      ctx.fillStyle = colors.accents[k]!
      for (let j = 0; j < bucket.length; j += 2) {
        ctx.fillRect(bucket[j]!, bucket[j + 1]!, size, size)
      }
    }
  }, [easing, endAt, scrollInfluence, still])

  // Resolve colours now, and again whenever the theme flips `<html>`.
  useEffect(() => {
    const apply = () => {
      colorsRef.current = {
        base: resolveColor(colorA, DEFAULT_COLOR_A),
        target: resolveColor(colorB, DEFAULT_COLOR_B),
        accents: accents.map((color, i) =>
          resolveColor(
            color,
            DEFAULT_ACCENT_COLORS[i % DEFAULT_ACCENT_COLORS.length]!,
          ),
        ),
      }
      paint()
    }
    apply()

    if (typeof MutationObserver === "undefined") return
    const observer = new MutationObserver(apply)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    })
    return () => observer.disconnect()
  }, [accents, colorA, colorB, paint])

  // Size the backing store and rebuild the grid from the frame's box.
  useEffect(() => {
    const frame = frameRef.current
    const canvas = canvasRef.current
    if (!frame || !canvas) return

    const measure = () => {
      // `h-svh` is the window's viewport. When another element is doing the
      // scrolling, the pinned frame has to match *its* height instead.
      const container = scrollContainerRef?.current
      if (mode === "sticky" && container) {
        frame.style.height = `${container.clientHeight}px`
      }

      const width = frame.clientWidth
      const frameHeight = frame.clientHeight
      if (width <= 0 || frameHeight <= 0) return

      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(frameHeight * dpr))

      const ctx = ctxRef.current ?? safeContext(canvas)
      ctxRef.current = ctx
      // Re-applied every resize: setting `canvas.width` resets the transform.
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)

      sizeRef.current = { width, height: frameHeight }
      gridRef.current = buildGrid({
        width,
        height: frameHeight,
        pixelSize,
        gap,
        direction,
        pattern,
        patternIntensity,
        accentShare,
        accentCount,
      })
      paint()
    }

    measure()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure)
      return () => window.removeEventListener("resize", measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [
    accentCount,
    accentShare,
    direction,
    gap,
    mode,
    paint,
    pattern,
    patternIntensity,
    pixelSize,
    scrollContainerRef,
  ])

  // Track scroll. Reads are coalesced onto one animation frame so a burst of
  // scroll events cannot force more than one layout read and one repaint each.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const container = scrollContainerRef?.current ?? null

    const request = () => {
      if (rafRef.current !== 0) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const rect = root.getBoundingClientRect()
        let top = rect.top
        let viewport = window.innerHeight
        if (container) {
          top = rect.top - container.getBoundingClientRect().top
          viewport = container.clientHeight
        }
        progressRef.current = scrollProgress(mode, top, rect.height, viewport)
        paint()
      })
    }

    request()
    window.addEventListener("scroll", request, { passive: true })
    window.addEventListener("resize", request)
    container?.addEventListener("scroll", request, { passive: true })
    return () => {
      window.removeEventListener("scroll", request)
      window.removeEventListener("resize", request)
      container?.removeEventListener("scroll", request)
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [mode, paint, scrollContainerRef])

  const sticky = mode === "sticky"
  const rootStyle: CSSProperties = { height: sticky ? scrollHeight : height }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)} style={rootStyle}>
      <div
        ref={frameRef}
        className={cn(
          "w-full overflow-hidden",
          sticky ? "sticky top-0 h-svh" : "absolute inset-0",
        )}
      >
        <canvas ref={canvasRef} aria-hidden className="block size-full" />
        {children ? (
          <div className="absolute inset-0 z-10">{children}</div>
        ) : null}
      </div>
    </div>
  )
}
