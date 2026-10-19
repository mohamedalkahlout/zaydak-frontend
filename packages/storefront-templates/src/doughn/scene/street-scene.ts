import type { BreadId } from "../types"
import { setFlag, setStyle } from "../lib/dom"
import { clamp, easeOutCubic, lerp, monotoneCurve, prefersReducedMotion, ramp, smooth } from "../lib/motion"
import {
  CARD_BREAD_MAX_WIDTH,
  BREAD_SIZE,
  CURTAIN,
  CURTAIN_H,
  CURTAIN_W,
  DOOR,
  FOCUS,
  INTERIOR_H,
  INTERIOR_W,
  PLATE_H,
  PLATE_W,
  RACK,
} from "./geometry"
import { loafLayout, slatLayout } from "./layout"

/**
 * The street, as a pure function of one number: story progress p, 0..1.
 *
 * A shop front at 4 a.m. The shutter rolls up, the sun comes up, the camera walks
 * through the door to the bread rack, and each loaf lifts out of its basket and
 * flies into its card on the bake board, which is sliding up over the stage.
 * Scrolling back replays it exactly. `render(p)` runs synchronously on every
 * scroll frame and writes styles straight to the elements React rendered
 * (`data-scene="…"` in street.tsx) — React never re-renders for a frame.
 */

/** Story beats, as values of p. */
export const BEAT = {
  hold: 0.037, // nothing moves yet
  shutterUp: 0.24, // the shutter is all the way up
  dawnFrom: 0.259, // story time starts to run
  dawnTo: 0.5, // 5:52: the sun is up and the door swings open
  walkEnd: 0.72, // through the door
  settleEnd: 0.8, // standing at the rack
} as const

/** Story time, minutes after midnight. */
export function storyMinutes(p: number) {
  if (p < BEAT.hold) return 240
  if (p < BEAT.dawnFrom) return lerp(240, 260, ramp(BEAT.hold, BEAT.dawnFrom, p))
  if (p < BEAT.dawnTo) return lerp(260, 352, smooth(ramp(BEAT.dawnFrom, BEAT.dawnTo, p)))
  return lerp(352, 360, ramp(BEAT.dawnTo, BEAT.walkEnd, p))
}

/*
 * Touch pacing. A swipe is short and flings, so phones get a shorter track
 * (street.module.css) and reach the story through this curve: the opening runs
 * quicker, and from sunrise on (p = 0.36) the street plays at the desktop rate,
 * 1/5.4 of the story per screen. Knots are [share of the track, p].
 */
const STORY_SCREENS = 5.4
const PACE: [number, number][] = [
  [0, 0],
  [0.02807, 0.037],
  [0.1885, 0.24],
  [0.2607, 0.36],
  [1, 1],
]
const DESIGN_RATE = (1 - PACE[3][1]) / (1 - PACE[3][0])
const paced = monotoneCurve(PACE, { 3: DESIGN_RATE, 4: DESIGN_RATE })

export interface SceneFrame {
  p: number
  minutes: number
  /** index of the caption to show, -1 for none */
  caption: number
}

export interface SceneOptions {
  itemIds: BreadId[]
  /** story minute each caption starts at */
  captionTimes: number[]
  board: () => HTMLElement | null
  scrollY: () => number
  scrollTo: (y: number) => void
  onFrame: (frame: SceneFrame) => void
}

export interface StreetScene {
  layout(): void
  render(p: number, settle?: boolean): void
  progressAt(scrollY: number): number
  scrollFor(p: number): number
  measureTargets(): void
  lightSign(): void
  /** pull the shutter up by its bottom bar with the mouse; returns a teardown */
  enableDrag(): () => void
  destroy(): void
  readonly p: number
  readonly lift: number
  /** the p at which the board's top reaches the bottom of the screen */
  readonly handoff: number
  readonly zMax: number
  readonly base: number
}

interface Target {
  x: number
  y: number
  w: number
  h: number
}

const f1 = (v: number) => v.toFixed(1)
const f2 = (v: number) => v.toFixed(2)
const f3 = (v: number) => v.toFixed(3)

export function createStreetScene(hero: HTMLElement, opts: SceneOptions): StreetScene {
  const one = (name: string) => {
    const el = hero.querySelector<HTMLElement>(`[data-scene="${name}"]`)
    if (!el) throw new Error(`doughn: the street is missing [data-scene="${name}"]`)
    return el
  }
  const all = (name: string) => Array.from(hero.querySelectorAll<HTMLElement>(`[data-scene="${name}"]`))

  const stage = one("stage")
  const street = one("street")
  const streetBody = one("street-body")
  const win = one("interior-window")
  const interior = one("interior")
  const interiorBody = one("interior-body")
  const tint = one("interior-tint")
  const fade = one("interior-fade")
  const loavesEl = one("loaves")
  const steam = one("steam")
  const plateNight = one("plate-night")
  const plateDay = one("plate-day")
  const skyDay = one("sky-day")
  const roadDay = one("road-day")
  const doorLeaf = one("door-leaf")
  const doorDay = one("door-day")
  const spill = one("spill")
  const signGlow = one("sign-glow")
  const signDay = one("sign-day")
  const glowLetters = all("glow-letter")
  const cta = one("cta")
  const cue = one("cue")

  const slatSpecs = slatLayout()
  const slats = all("slat").map((el, i) => ({ el, ...slatSpecs[i] }))
  const lastSlat = slats[slats.length - 1].el

  const loafSpecs = loafLayout(opts.itemIds)
  const baskets = all("basket")
  const loaves = loafSpecs.map((spec, i) => {
    const basket = baskets[i]
    return {
      ...spec,
      basket,
      shadow: basket.querySelector<HTMLElement>('[data-scene="basket-shadow"]')!,
      img: basket.querySelector<HTMLElement>('[data-scene="bread"]')!,
    }
  })

  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)")
  const reducedMotion = prefersReducedMotion()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const later = (ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
    return id
  }
  const cancel = (id: ReturnType<typeof setTimeout> | 0) => {
    if (!id) return
    clearTimeout(id)
    timers.delete(id)
  }

  /* ---------- keeping the zooming planes sharp
     A will-change:transform layer is painted once and afterwards only moved and scaled,
     so a plane that grows turns soft, and one drawn smaller than it was painted holds
     texture memory it does not need (phones run out and show holes). Each plane is laid
     out at its smallest on-screen size (CSS zoom on its body) so it only ever scales up;
     when its scale has drifted far enough from the size it was painted at, its hint is
     dropped for two frames so the browser paints it once more at the new size. While
     scrolling that happens at ~1.4x steps; once the page rests, within 5%. */
  const canZoom = typeof CSS !== "undefined" && CSS.supports("zoom", "0.5")
  const paintedAt = new Map<HTMLElement, number | null>()
  let lastRepaint = 0
  let retryTimer: ReturnType<typeof setTimeout> | 0 = 0
  let resting = false

  function keepSharp(plane: HTMLElement, scale: number, mayGrow: boolean, hintMeanwhile: string) {
    const at = paintedAt.get(plane)
    if (at === undefined) {
      paintedAt.set(plane, scale)
      return
    }
    const drift = at ? scale / at : 0 // null after a relayout: repaint now
    const soft = mayGrow && drift > (resting ? 1.05 : 1.4)
    const heavy = drift < (resting ? 0.95 : 0.72)
    if (!soft && !heavy) return
    // one plane at a time: while it repaints, the old and the new texture both exist
    const now = performance.now()
    if (now - lastRepaint < 160) {
      cancel(retryTimer)
      retryTimer = later(170, () => render(current, true))
      return
    }
    lastRepaint = now
    paintedAt.set(plane, scale)
    plane.style.willChange = hintMeanwhile
    requestAnimationFrame(() => requestAnimationFrame(() => (plane.style.willChange = "")))
  }

  /* ---------- layout */
  let vw = 1
  let vh = 1
  let base = 1
  let offX = 0
  let offY = 0
  let zMax = 10
  let coverAt1 = 1
  let streetK = 1
  let interiorK = 1
  let heroTop = 0
  let heroLen = 1
  let handoff = 0.8
  let cueWidth = 0
  let targets: (Target | null)[] = []

  function layout() {
    vw = stage.clientWidth || window.innerWidth
    vh = stage.clientHeight || window.innerHeight
    // the plate covers the width; on tall screens the shop front fills 94% of it instead
    base = Math.max(vw / PLATE_W, Math.min(vh / PLATE_H, (0.94 * vw) / CURTAIN_W))
    offX = clamp(vw / 2 - FOCUS.x * base, vw - PLATE_W * base, 0)
    offY = vh > PLATE_H * base ? (vh - PLATE_H * base) * 0.42 : (vh - PLATE_H * base) / 2
    // at the end of the walk the doorway overfills the screen
    zMax = Math.max(vw / ((DOOR.x1 - DOOR.x0) * base), vh / ((DOOR.y1 - DOOR.y0) * base)) * 1.35
    // interior width that just covers the opening at z = 1 (the photo is 3:2)
    coverAt1 = Math.max(CURTAIN_W * base, CURTAIN_H * base * 1.5) * 1.06
    streetK = canZoom ? base : 1
    interiorK = canZoom ? coverAt1 / INTERIOR_W : 1
    streetBody.style.setProperty("zoom", String(streetK))
    street.style.width = `${PLATE_W * streetK}px`
    street.style.height = `${PLATE_H * streetK}px`
    interiorBody.style.setProperty("zoom", String(interiorK))
    interior.style.width = `${INTERIOR_W * interiorK}px`
    interior.style.height = `${INTERIOR_H * interiorK}px`
    paintedAt.set(street, null)
    paintedAt.set(interior, null)
    heroTop = hero.offsetTop
    heroLen = Math.max(1, hero.offsetHeight - vh)
    handoff = coarse.matches ? 1 - 1 / STORY_SCREENS : clamp(1 - vh / heroLen, 0.5, 0.95)
    cueWidth = cue.offsetWidth
    measureTargets()
  }

  // Where each loaf lands: the visible box of its card's image, in page coordinates.
  // Worked out from the slot and the cut-out's natural size, so it holds before the
  // card images have loaded.
  function measureTargets() {
    const board = opts.board()
    const sy = opts.scrollY()
    targets = opts.itemIds.map((id) => {
      const slot = board?.querySelector<HTMLElement>(`[data-slot="${id}"]`)
      const img = slot?.querySelector<HTMLElement>("[data-bread]")
      if (!slot || !img) return null
      const box = slot.getBoundingClientRect()
      const [nw, nh] = BREAD_SIZE[id]
      const maxH = parseFloat(getComputedStyle(img).maxHeight) || box.height
      const s = Math.min(1, (box.width * CARD_BREAD_MAX_WIDTH) / nw, maxH / nh)
      const w = nw * s
      const h = nh * s
      return { x: box.left + (box.width - w) / 2, y: box.top + sy + (box.height - h) / 2, w, h }
    })
  }

  const progressAt = (scrollY: number) => {
    const s = clamp((scrollY - heroTop) / heroLen)
    return coarse.matches ? paced(s) : s
  }

  const scrollFor = (p: number) => {
    if (!coarse.matches) return heroTop + clamp(p) * heroLen
    let a = 0
    let b = 1
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2
      if (paced(m) < p) a = m
      else b = m
    }
    return heroTop + ((a + b) / 2) * heroLen
  }

  const SHUTTER_START = 0.008

  /* ---------- render */
  let current = 0
  let lastLift = 0
  let signOn = reducedMotion ? 1 : 0
  let idleTimer: ReturnType<typeof setTimeout> | 0 = 0

  function render(p: number, settle = false) {
    current = p
    const minutes = storyMinutes(p)

    // shutter: a rigid curtain rising into the drum; slats fold and darken smoothly at the mouth
    const openT = ramp(SHUTTER_START, BEAT.shutterUp, p)
    const lift = smooth(openT) * (CURTAIN_H + 6)
    lastLift = lift
    for (const s of slats) {
      const top = s.top - lift // the strip's top inside the shutter box
      if (top + s.h < -1) {
        setStyle(s.el, "visibility", "hidden")
        continue
      }
      setStyle(s.el, "visibility", "visible")
      const wind = clamp(1 - top / 10)
      setStyle(s.el, "transform", `translate3d(0,${f2(-lift)}px,0) scaleY(${f3(1 - 0.3 * wind)})`)
      setStyle(s.el, "filter", wind > 0 ? `brightness(${f2(1 - 0.45 * wind)})` : "none")
    }
    setStyle(lastSlat, "--rim", f2(clamp(openT * 6)))
    setStyle(spill, "opacity", f3(smooth(ramp(SHUTTER_START + 0.008, BEAT.shutterUp - 0.04, p))))

    // time of day: the sun comes up between 5:00 and 5:52. A fully clear layer is
    // hidden so it holds no texture; mid-fade the day layers get their own (data-dawning)
    const sun = smooth(ramp(300, 352, minutes))
    const sunShown = sun > 0.001 ? "visible" : "hidden"
    setFlag(streetBody, "data-dawning", sun > 0.001 && sun < 0.999)
    setStyle(plateDay, "opacity", f3(sun))
    setStyle(plateDay, "visibility", sunShown)
    setStyle(plateNight, "visibility", sun < 0.999 ? "visible" : "hidden")
    setStyle(doorDay, "opacity", f3(sun))
    setStyle(skyDay, "opacity", f3(sun))
    setStyle(skyDay, "visibility", sunShown)
    setStyle(roadDay, "opacity", f3(sun))
    setStyle(roadDay, "visibility", sunShown)
    setStyle(signGlow, "opacity", f3(signOn * (1 - smooth(ramp(0.55, 0.92, sun)))))
    setStyle(signDay, "opacity", f3(smooth(ramp(0.4, 1, sun))))
    setStyle(tint, "opacity", f3((1 - sun) * 0.9)) // lamp-lit at 4, sunlit by 6

    // camera: a slow push while time runs, then the walk through the door
    const walk = ramp(BEAT.dawnTo, BEAT.walkEnd, p)
    const z0 =
      lerp(1, 1.06, ramp(BEAT.hold, BEAT.dawnFrom, p)) * lerp(1, 1.3 / 1.06, smooth(ramp(BEAT.dawnFrom, BEAT.dawnTo, p)))
    const z = walk > 0 ? z0 * Math.pow(zMax / z0, Math.pow(walk, 1.55)) : z0
    const depth = Math.log(z) / Math.log(zMax) // 0 on the pavement, 1 through the door
    const S = base * z
    const centring = smooth(clamp(depth * 1.6))
    const fx = lerp(offX + FOCUS.x * base, vw / 2, centring)
    const fy = lerp(offY + FOCUS.y * base, vh / 2, centring)
    const tx = fx - FOCUS.x * S
    const ty = fy - FOCUS.y * S
    setStyle(street, "transform", `translate3d(${f2(tx)}px,${f2(ty)}px,0) scale(${(S / streetK).toFixed(5)})`)
    const facade = 1 - smooth(ramp(0.58, 0.86, depth))
    setStyle(street, "opacity", f3(facade))
    setStyle(street, "visibility", facade < 0.002 ? "hidden" : "visible")
    // sharpen on the way in only while the facade is still solid; always come back down
    keepSharp(street, S / streetK, facade > 0.6, "opacity")
    setStyle(doorLeaf, "transform", `rotateY(${f2(-84 * easeOutCubic(ramp(BEAT.dawnTo, BEAT.dawnTo + 0.09, p)))}deg)`)

    // the interior, behind the glass: deeper than the facade, so it grows slower,
    // but never smaller than the hole it shows through
    const ox0 = tx + CURTAIN.x0 * S
    const oy0 = ty + CURTAIN.y0 * S
    const ox1 = tx + CURTAIN.x1 * S
    const oy1 = ty + CURTAIN.y1 * S
    const vx0 = Math.max(0, ox0)
    const vy0 = Math.max(0, oy0)
    const vx1 = Math.min(vw, ox1)
    const vy1 = Math.min(vh, oy1)
    const minW = Math.max(Math.max(1, vx1 - vx0), Math.max(1, vy1 - vy0) * 1.5) * 1.02
    let w = Math.max(coverAt1 * Math.pow(z, 0.55), minW)
    let cx = clamp((ox0 + ox1) / 2, vx1 - w / 2, vx0 + w / 2)
    let cy = clamp((oy0 + oy1) / 2 + (FOCUS.y - (CURTAIN.y0 + CURTAIN.y1) / 2) * S * 0.2, vy1 - w / 3, vy0 + w / 3)
    // as the facade dissolves, blend into a plain full-screen cover
    const toCover = smooth(ramp(0.3, 0.62, depth))
    w = Math.max(lerp(w, Math.max(vw, vh * 1.5) * 1.02, toCover), minW)
    cx = lerp(cx, vw / 2, toCover)
    cy = lerp(cy, vh / 2, toCover)
    // settle: one small step towards the rack, which comes to the middle of the screen
    const settled = smooth(ramp(BEAT.walkEnd, BEAT.settleEnd, p))
    const step = 1 + 0.08 * settled
    const rackX = (RACK.x / PLATE_W - 0.5) * w
    const rackY = (RACK.y / PLATE_H - 0.5) * (w / 1.5)
    const px = lerp(cx + rackX, vw / 2, settled)
    const py = lerp(cy + rackY, vh * 0.47, settled)
    const left = px - (rackX + w / 2) * step
    const top = py - (rackY + w / 3) * step
    const scale = (w * step) / INTERIOR_W // screen px per interior px
    // while the facade is solid only the glass shows the interior: clip it there
    // (4px under the feathered edge) so the hidden rest of the photo costs nothing
    let kx0 = 0
    let ky0 = 0
    let kx1 = vw
    let ky1 = vh
    if (facade > 0.999) {
      kx0 = Math.max(0, ox0 - 4)
      ky0 = Math.max(0, oy0 - 4)
      kx1 = Math.min(vw, ox1 + 4)
      ky1 = Math.min(vh, oy1 + 4)
    }
    kx0 = Number(f1(kx0))
    ky0 = Number(f1(ky0))
    setStyle(win, "left", `${kx0}px`)
    setStyle(win, "top", `${ky0}px`)
    setStyle(win, "width", `${f1(Math.max(0, kx1 - kx0))}px`)
    setStyle(win, "height", `${f1(Math.max(0, ky1 - ky0))}px`)
    setStyle(interior, "transform", `translate3d(${f2(left - kx0)}px,${f2(top - ky0)}px,0) scale(${(scale / interiorK).toFixed(5)})`)
    keepSharp(interior, scale / interiorK, true, "auto")
    setStyle(steam, "opacity", f3(smooth(ramp(0.05, 0.2, p)) * (1 - smooth(ramp(handoff - 0.04, handoff + 0.02, p)))))

    // hand-off: the photo fades to the page's cream while each loaf lifts out of its
    // basket and flies into its own card on the board
    setStyle(fade, "opacity", f3(smooth(ramp(handoff, handoff + 0.09, p))))
    const landed = p >= 0.999
    const board = opts.board()
    if (board) setFlag(board, "data-landed", landed)
    setStyle(loavesEl, "visibility", landed ? "hidden" : "visible")
    const sy = opts.scrollY()
    loaves.forEach((L, i) => {
      const up = smooth(ramp(handoff - 0.035 + i * 0.006, handoff + 0.04 + i * 0.006, p))
      const fly = smooth(ramp(handoff + 0.035 + i * 0.009, handoff + 0.13 + i * 0.006, p))
      const free = up > 0.6
      setStyle(L.basket, "clip-path", free ? "none" : L.clip)
      setFlag(L.img, "data-flying", free)
      setStyle(L.shadow, "opacity", f3(1 - up))
      let dx = 0
      let dy = -up * L.ry * 1.7
      let k = 1
      let rot = Math.sin(i * 1.9) * 5 * up
      const T = targets[i]
      if (fly > 0 && T) {
        // the card slot in interior px (the interior plane is a translate plus a uniform scale)
        const tcx = (T.x + T.w / 2 - left) / scale
        const tcy = (T.y - sy + T.h / 2 - top) / scale
        dx = lerp(dx, tcx - (L.x + L.w / 2), fly)
        dy = lerp(dy, tcy - (L.y + L.h / 2), fly) - Math.sin(Math.PI * fly) * 90
        k = lerp(1, T.w / scale / L.w, fly)
        rot = lerp(rot, 0, fly)
      }
      // 2D until it flies: a 3D transform would give it a layer inside the basket clip
      setStyle(L.img, "transform", `translate(${f2(dx)}px,${f2(dy)}px) rotate(${f2(rot)}deg) scale(${k.toFixed(4)})`)
    })

    // words: the rising shutter pushes the CTA row away; the cue rides its bottom bar
    const push = smooth(ramp(0.03, 0.11, p))
    setStyle(cta, "transform", `translate3d(0,${f1(push * 260)}px,0)`)
    setStyle(cta, "opacity", f3(1 - push))
    setStyle(cta, "visibility", push > 0.99 ? "hidden" : "visible")
    const barX = tx + ((CURTAIN.x0 + CURTAIN.x1) / 2) * S
    const barY = ty + (CURTAIN.y1 - lift - 12) * S
    const cueShown = 1 - smooth(ramp(0.008, 0.05, p))
    setStyle(cue, "transform", `translate3d(${f1(barX - cueWidth / 2)}px,${f1(barY + 22 * S + 10)}px,0)`)
    setStyle(cue, "opacity", f3(cueShown))
    setStyle(cue, "visibility", cueShown < 0.01 ? "hidden" : "visible")

    // captions follow story time, once the sign is lit
    let caption = -1
    if (signOn && p > 0.04 && p < BEAT.settleEnd) {
      opts.captionTimes.forEach((at, i) => {
        if (minutes >= at) caption = i
      })
    }
    opts.onFrame({ p, minutes, caption })

    // once scrolling rests, bring each plane to its exact size for a sharp still frame
    cancel(idleTimer)
    if (!resting) {
      idleTimer = later(220, () => {
        resting = true
        render(current, true)
        resting = false
      })
    }
  }

  // the sign warms up like a real one: letter by letter, with one that catches late
  const flicker = new Set<ReturnType<typeof setTimeout>>()
  function lightSign() {
    signOn = 1
    render(current, true)
    const allOn = () => {
      flicker.forEach((id) => cancel(id))
      flicker.clear()
      glowLetters.forEach((l) => (l.style.opacity = "1"))
    }
    if (reducedMotion) return allOn()
    const at = (sec: number, el: HTMLElement, v: number) => flicker.add(later(sec * 1000, () => (el.style.opacity = String(v))))
    glowLetters.forEach((l, i) => {
      const s = 0.1 + i * 0.12 + (i === 3 ? 0.25 : 0)
      at(s, l, 1)
      at(s + 0.06, l, 0.25)
      at(s + 0.12, l, 1)
      if (i === 3) {
        at(s + 0.5, l, 0.4)
        at(s + 0.58, l, 1)
      }
    })
    later(2500, allOn)
  }

  function enableDrag() {
    let drag: { y: number; from: number; S: number } | null = null
    // the plate scale when the pointer is on the shutter's bottom bar, else 0
    const onBar = (e: PointerEvent) => {
      const r = street.getBoundingClientRect()
      const S = r.width / PLATE_W
      const inside =
        e.clientY > r.top + (CURTAIN.y1 - lastLift - 40) * S &&
        e.clientY < r.top + (CURTAIN.y1 - lastLift + 30) * S &&
        e.clientX > r.left + CURTAIN.x0 * S &&
        e.clientX < r.left + CURTAIN.x1 * S
      return inside ? S : 0
    }
    const down = (e: PointerEvent) => {
      if (current > BEAT.shutterUp || e.button !== 0 || (e.target as Element).closest("a,button")) return
      const S = onBar(e)
      if (!S) return
      drag = { y: e.clientY, from: opts.scrollY(), S }
      stage.setPointerCapture(e.pointerId)
      stage.style.cursor = "grabbing"
      e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      if (!drag) {
        stage.style.cursor = current < BEAT.shutterUp && onBar(e) ? "grab" : ""
        return
      }
      // shutter units per scroll px: the lift (CURTAIN_H + 6) spans SHUTTER_START..shutterUp of the track
      const perPx = (CURTAIN_H + 6) / ((BEAT.shutterUp - SHUTTER_START) * heroLen)
      opts.scrollTo(drag.from + (drag.y - e.clientY) / drag.S / perPx)
    }
    const end = () => {
      drag = null
      stage.style.cursor = ""
    }
    stage.addEventListener("pointerdown", down)
    stage.addEventListener("pointermove", move)
    stage.addEventListener("pointerup", end)
    stage.addEventListener("pointercancel", end)
    return () => {
      stage.removeEventListener("pointerdown", down)
      stage.removeEventListener("pointermove", move)
      stage.removeEventListener("pointerup", end)
      stage.removeEventListener("pointercancel", end)
    }
  }

  function destroy() {
    timers.forEach((id) => clearTimeout(id))
    timers.clear()
  }

  return {
    layout,
    render,
    progressAt,
    scrollFor,
    measureTargets,
    lightSign,
    enableDrag,
    destroy,
    get p() {
      return current
    },
    get lift() {
      return lastLift
    },
    get handoff() {
      return handoff
    },
    get zMax() {
      return zMax
    },
    get base() {
      return base
    },
  }
}
