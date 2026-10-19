"use client"

import { useEffect, useRef, useState } from "react"
import type { ReactNode, RefObject } from "react"
import {
  easeOut,
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
  type UseScrollOptions,
} from "motion/react"

import { useSafeReducedMotion } from "../hooks/use-hydrated"
import { cn } from "../lib/utils"
import {
  columnWindow,
  IDENTITY_POSE,
  scatterPose,
  scatterWindow,
  windowProgress,
  type RevealEffect,
  type RevealPose,
  type RevealWindow,
} from "./scroll-image-reveal-geometry"

// The geometry module is a `.ts`, and the package only maps `./components/*`
// onto `.tsx` — so this file is the only door consumers have to these names.
export { REVEAL_EFFECTS } from "./scroll-image-reveal-geometry"
export type { RevealEffect } from "./scroll-image-reveal-geometry"

export type RevealImage = {
  src: string
  /** Omit for a purely decorative tile; it is then invisible to assistive tech. */
  alt?: string
}

export type ScrollImageRevealProps = {
  images: RevealImage[]
  /**
   * `"columns"` rises every column into place, the middle one first, so the
   * grid arrives as a V. `"scatter"` starts every tile at its own spot in 3D
   * space — below, behind, and turned — and lands each on its own timing.
   */
  effect?: RevealEffect
  /**
   * Columns in the grid. This is the default for the `--reveal-columns` custom
   * property, so a call site can change it per breakpoint with a class
   * (`[--reveal-columns:3] md:[--reveal-columns:5]`); the effect reads back how
   * many columns CSS actually laid out.
   */
  columns?: number
  /** Space between tiles, any CSS length. */
  gap?: string
  /** A tile's `aspect-ratio`, as CSS accepts it. */
  aspectRatio?: string | number
  /** Depth of field for the 3D effect, in px. Smaller is more dramatic. */
  perspective?: number
  /** Picks the arrangement `"scatter"` draws. Same seed, same gallery. */
  seed?: number
  /**
   * Scroll progress at which the last tile has landed, in `[0, 1]`. Progress
   * runs from the gallery's top edge entering at the bottom of the viewport
   * (`0`) to its bottom edge leaving at the top (`1`), so `0.5` is roughly
   * "in place once it fills the screen".
   */
  settleAt?: number
  /** `"columns"` only: how far below its slot a tile starts, in percent of its own height. */
  rise?: number
  /** `"scatter"` only: furthest a tile starts behind the page, in px. */
  depth?: number
  /** `"scatter"` only: largest rotation a tile starts with, in degrees. */
  tilt?: number
  /**
   * Runs progress through a spring so the tiles trail the scrollbar slightly
   * instead of tracking it exactly. Off by default: exact tracking is what
   * makes the motion feel like the reader's own.
   */
  smooth?: boolean
  /** Which edges of the gallery and viewport bound progress. Motion's `useScroll` offset. */
  offset?: UseScrollOptions["offset"]
  /**
   * The scrollable ancestor driving the effect. Omit when the page scrolls.
   * It must be positioned (`relative` will do): motion measures the gallery's
   * offset against the container's own box, and a static one reads wrong.
   */
  scrollContainerRef?: RefObject<HTMLElement | null>
  /**
   * Replaces the default `<img>` inside a tile — for an app's own image
   * wrapper, a link around the picture, or a caption. The tile itself (its
   * box, radius and clipping) is still the component's.
   */
  renderImage?: (image: RevealImage, index: number) => ReactNode
  className?: string
  /** Merged onto every tile. */
  tileClassName?: string
}

const DEFAULT_OFFSET: UseScrollOptions["offset"] = ["start end", "end start"]

/**
 * Share of the `"columns"` reveal one column's travel takes. The rest is
 * spent waiting for the outer columns to start, which is what makes the V.
 */
const COLUMN_SHARE = 0.6

/** Over what share of a `"scatter"` tile's travel it fades in. */
const SCATTER_FADE = 0.4

/** Trails the scrollbar by a beat; stiff enough never to feel detached from it. */
const SMOOTH_SPRING = { stiffness: 140, damping: 32, mass: 0.5, restDelta: 0.0005 }

const linear = (t: number) => t

/* ------------------------------------------------------------------ */
/* Measuring the grid                                                  */
/* ------------------------------------------------------------------ */

/**
 * How many columns CSS actually laid out.
 *
 * `columns` is only the default for `--reveal-columns`; a call site is
 * expected to override it per breakpoint with a class, and the `"columns"`
 * effect's whole shape depends on knowing which column is the middle one. So
 * rather than trusting the prop, the resolved `grid-template-columns` — which
 * computed style reports as one track size per column — is read back whenever
 * the grid resizes. Under jsdom it reports nothing and the prop stands.
 */
function useLaidOutColumns(
  ref: RefObject<HTMLElement | null>,
  fallback: number,
): number {
  const [measured, setMeasured] = useState<number | null>(null)

  useEffect(() => {
    const grid = ref.current
    if (!grid || typeof ResizeObserver === "undefined") return

    const read = () => {
      const tracks = getComputedStyle(grid).gridTemplateColumns.trim()
      const count = tracks ? tracks.split(/\s+/).length : 0
      setMeasured(count > 0 ? count : null)
    }

    const observer = new ResizeObserver(read)
    observer.observe(grid)
    return () => observer.disconnect()
    // `fallback` is in the list so a changed `columns` prop re-reads even when
    // the grid's box happens to keep its size.
  }, [ref, fallback])

  return measured ?? fallback
}

/* ------------------------------------------------------------------ */
/* One tile                                                            */
/* ------------------------------------------------------------------ */

type TileProps = {
  progress: MotionValue<number>
  window: RevealWindow
  pose: RevealPose
  ease: (t: number) => number
  fade: boolean
  still: boolean
  aspectRatio: string | number
  className?: string
  children: ReactNode
}

function RevealTile({
  progress,
  window: win,
  pose,
  ease,
  fade,
  still,
  aspectRatio,
  className,
  children,
}: TileProps) {
  // Where this tile is along its own travel, 0 at the start pose and 1 settled.
  // Function form rather than a range, so a zero-width window (settleAt 0) lands
  // instead of dividing by zero, and so the window can change between renders.
  const t = useTransform(progress, (p) => ease(windowProgress(p, win)))

  const x = useTransform(t, (v) => `${pose.x * (1 - v)}%`)
  const y = useTransform(t, (v) => `${pose.y * (1 - v)}%`)
  const z = useTransform(t, (v) => pose.z * (1 - v))
  const rotateX = useTransform(t, (v) => pose.rotateX * (1 - v))
  const rotateY = useTransform(t, (v) => pose.rotateY * (1 - v))
  const rotateZ = useTransform(t, (v) => pose.rotateZ * (1 - v))
  const opacity = useTransform(t, (v) =>
    fade ? Math.min(1, v / SCATTER_FADE) : 1,
  )

  const style: MotionStyle = still
    ? { aspectRatio }
    : {
        aspectRatio,
        x,
        y,
        z,
        rotateX,
        rotateY,
        rotateZ,
        opacity,
        willChange: "transform",
      }

  return (
    <motion.div
      data-slot="reveal-tile"
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted",
        className,
      )}
      style={style}
    >
      {children}
    </motion.div>
  )
}

function DefaultImage({ image }: { image: RevealImage }) {
  // Raw `<img>`, not `next/image`: this package has no app config to read, and
  // a gallery's sources are whatever the call site holds — a merchant's
  // catalogue on a host `remotePatterns` never listed is normal input, and the
  // optimizer *throws* on one. A call site that wants optimisation passes its
  // own wrapper through `renderImage`.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      alt={image.alt ?? ""}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="size-full object-cover"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * A grid of images that assembles itself as it scrolls into view — every tile
 * starts somewhere else and travels to the slot CSS grid gave it, scrubbed by
 * scroll position rather than played on a clock. Adapted from Codrops'
 * "Scroll3DGrid" by way of Skiper UI's `skiper32`, without their GSAP and
 * Lenis: `motion` is already here, its `useScroll` is the same scrubbed
 * timeline, and smooth scrolling is a page-level decision, not a tile's.
 *
 * Two things about it are decisions rather than markup:
 *
 * **The grid is CSS; the effect only decorates it.** Tiles are laid out by
 * `grid-template-columns` and every settled pose is the identity, so the
 * gallery at rest is exactly the plain grid — same boxes, same wrapping, same
 * responsive behaviour through `--reveal-columns`. What the effect needs to
 * know about that layout (the column count) it measures rather than assumes.
 *
 * **Nothing is random.** Every pose is hashed from the tile's index and
 * `seed`, so the server and the client render the same transforms, a
 * re-render cannot reshuffle the gallery, and a call site that dislikes an
 * arrangement changes one number. Under `prefers-reduced-motion` the tiles
 * render settled — the grid, with nothing travelling.
 *
 * The root clips on the x axis only. Tiles start well outside their slots and
 * without that clip a page would grow a horizontal scrollbar for the duration;
 * y is left alone so the 3D travel is not cut off at the gallery's edges.
 */
export function ScrollImageReveal({
  images,
  effect = "scatter",
  columns = 5,
  gap = "1rem",
  aspectRatio = "4 / 5",
  perspective = 1200,
  seed = 1,
  settleAt = 0.5,
  rise = 400,
  depth = 1000,
  tilt = 60,
  smooth = false,
  offset = DEFAULT_OFFSET,
  scrollContainerRef,
  renderImage,
  className,
  tileClassName,
}: ScrollImageRevealProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const still = useSafeReducedMotion()
  const laidOut = useLaidOutColumns(gridRef, Math.max(1, Math.floor(columns)))

  const { scrollYProgress } = useScroll({
    target: rootRef,
    container: scrollContainerRef,
    offset,
  })
  // Both exist so `smooth` can flip between renders without re-creating the
  // scroll subscription; an idle spring tracking a value nobody reads is cheap.
  const sprung = useSpring(scrollYProgress, SMOOTH_SPRING)
  const progress = smooth ? sprung : scrollYProgress

  const isColumns = effect === "columns"
  const columnsRise: RevealPose = { ...IDENTITY_POSE, y: rise }

  return (
    <div
      ref={rootRef}
      data-slot="reveal-root"
      className={cn("relative w-full", className)}
      style={{ perspective: `${perspective}px`, overflowX: "clip" }}
    >
      <div
        ref={gridRef}
        data-slot="reveal-grid"
        className="grid w-full"
        style={{
          gridTemplateColumns: `repeat(var(--reveal-columns, ${columns}), minmax(0, 1fr))`,
          gap,
          transformStyle: "preserve-3d",
        }}
      >
        {images.map((image, index) => (
          <RevealTile
            key={`${index}:${image.src}`}
            progress={progress}
            window={
              isColumns
                ? columnWindow(index % laidOut, laidOut, {
                    settleAt,
                    share: COLUMN_SHARE,
                  })
                : scatterWindow(index, seed, { settleAt })
            }
            pose={isColumns ? columnsRise : scatterPose(index, seed, { depth, tilt })}
            ease={isColumns ? linear : easeOut}
            fade={!isColumns}
            still={still}
            aspectRatio={aspectRatio}
            className={tileClassName}
          >
            {renderImage ? renderImage(image, index) : <DefaultImage image={image} />}
          </RevealTile>
        ))}
      </div>
    </div>
  )
}
