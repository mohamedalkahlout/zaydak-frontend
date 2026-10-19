"use client"

import { useEffect, useRef } from "react"

const CELL_WIDTH = 560
const CELL_HEIGHT = 530
const COLUMNS = 6
const FRAMES = 30
const TURN_MS = 360
const RETURN_MS = 280

const cache = new Map<string, HTMLImageElement>()

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = cache.get(src)
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const image = cached ?? new Image()
    cache.set(src, image)
    const ready = () => {
      if (image.naturalWidth > 0) resolve(image)
      else reject(new Error("image"))
    }
    image.onload = ready
    image.onerror = () => reject(new Error("image"))
    if (!image.src) image.src = src
    else if (image.complete) ready()
  })
}

function smooth(amount: number) {
  return amount * amount * (3 - 2 * amount)
}

function drawStill(context: CanvasRenderingContext2D, image: HTMLImageElement) {
  context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
  context.drawImage(image, 0, 0, CELL_WIDTH, CELL_HEIGHT)
}

function drawTurn(context: CanvasRenderingContext2D, atlas: HTMLImageElement, amount: number) {
  const frame = Math.round(smooth(amount) * (FRAMES - 1))
  const column = frame % COLUMNS
  const row = Math.floor(frame / COLUMNS)
  context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT)
  context.drawImage(
    atlas,
    column * CELL_WIDTH,
    row * CELL_HEIGHT,
    CELL_WIDTH,
    CELL_HEIGHT,
    0,
    0,
    CELL_WIDTH,
    CELL_HEIGHT,
  )
}

/**
 * Paints a hanging cutout. `play` runs the profile-to-front turn: after a
 * mobile swipe settles, or as soon as a desktop hover commits.
 */
export function GarmentCanvas({
  src,
  turnSrc,
  play = false,
  delay = 0,
}: {
  src: string
  turnSrc?: string
  play?: boolean
  /** Wait before the turn starts. Mobile uses this after the slide rests. */
  delay?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const stillRef = useRef<HTMLImageElement | null>(null)
  const atlasRef = useRef<HTMLImageElement | null>(null)
  const progress = useRef(0)
  const playRef = useRef(play)
  const delayRef = useRef(delay)
  playRef.current = play
  delayRef.current = delay

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    let gone = false
    stillRef.current = null
    atlasRef.current = null
    const paint = () => {
      const atlas = atlasRef.current
      if (atlas && (playRef.current || progress.current > 0)) {
        drawTurn(context, atlas, progress.current)
        return
      }
      if (stillRef.current) drawStill(context, stillRef.current)
    }
    void loadImage(src)
      .then((image) => {
        if (gone) return
        stillRef.current = image
        paint()
      })
      .catch(() => {})
    if (turnSrc) {
      void loadImage(turnSrc)
        .then((image) => {
          if (gone) return
          atlasRef.current = image
          paint()
        })
        .catch(() => {})
    }
    return () => {
      gone = true
    }
  }, [src, turnSrc])

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let raf = 0
    let last = 0
    let held = 0
    const paint = () => {
      const atlas = atlasRef.current
      if (atlas && (playRef.current || progress.current > 0)) {
        drawTurn(context, atlas, progress.current)
        return
      }
      if (stillRef.current) drawStill(context, stillRef.current)
    }
    const tick = (now: number) => {
      const dt = last ? Math.min(50, now - last) : 16
      last = now
      const target = playRef.current ? 1 : 0
      if (reduce) {
        progress.current = target
        paint()
        return
      }
      const waiting = playRef.current && progress.current === 0 && held < delayRef.current
      if (waiting) held += dt
      else if (progress.current !== target) {
        const duration = target === 1 ? TURN_MS : RETURN_MS
        const step = dt / duration
        progress.current =
          target === 1 ? Math.min(1, progress.current + step) : Math.max(0, progress.current - step)
        if (progress.current === 0) held = 0
        paint()
      }
      if (progress.current !== target || waiting) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [play, src, turnSrc])

  return <canvas ref={ref} width={CELL_WIDTH} height={CELL_HEIGHT} aria-hidden="true" />
}
