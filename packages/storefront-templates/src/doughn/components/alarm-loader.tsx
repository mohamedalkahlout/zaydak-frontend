"use client"

import { useEffect, useRef, useState, type RefObject } from "react"

import { clamp, ease, prefersReducedMotion, tween, type Tween } from "../lib/motion"
import s from "./alarm-loader.module.css"

interface AlarmLoaderProps {
  note: string
  /** images to decode before the street opens */
  art: string[]
  /** the nav clock the digits fly into */
  targetRef: RefObject<HTMLElement | null>
  gone: boolean
  onDone: () => void
}

/** Part of the clock face, like the digits: it reads "am" in both languages. */
const CLOCK_SUFFIX = "am"

const decode = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new Image()
    img.onload = img.onerror = () => {
      if (img.decode) img.decode().then(() => resolve(), () => resolve())
      else resolve()
    }
    img.src = src
  })

/**
 * The loader is an alarm clock. Its count from 3:00 to 4:00 follows real loading
 * (the first frames' images and the fonts) but never faster than readable; then it
 * rings, and the 4:00 flies up into the nav clock while the street fades in.
 */
export function AlarmLoader({ note, art, targetRef, gone, onDone }: AlarmLoaderProps) {
  const [shown, setShown] = useState(0)
  const [ringing, setRinging] = useState(false)
  const screenRef = useRef<HTMLDivElement>(null)
  const faceRef = useRef<HTMLDivElement>(null)
  const digitsRef = useRef<HTMLSpanElement>(null)
  const amRef = useRef<HTMLSpanElement>(null)
  const noteRef = useRef<HTMLParagraphElement>(null)
  const artKey = art.join("|")

  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    let alive = true
    let finished = false
    let flight: Tween | null = null
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const after = (ms: number, fn: () => void) => {
      const id = setTimeout(() => {
        timers.delete(id)
        if (alive) fn()
      }, ms)
      timers.add(id)
    }
    const done = () => {
      if (finished || !alive) return
      finished = true
      onDoneRef.current()
    }

    const jobs: Promise<unknown>[] = artKey.split("|").map(decode)
    jobs.push(document.fonts ? document.fonts.ready : Promise.resolve())
    let loaded = 0
    jobs.forEach((job) => job.then(() => loaded++))
    const t0 = performance.now()
    let count = 0
    const counter = setInterval(() => {
      count = Math.min(loaded / jobs.length, (performance.now() - t0) / 1500, count + 0.06)
      setShown(count)
    }, 50)

    const fly = () => {
      const digits = digitsRef.current
      const target = targetRef.current
      const face = faceRef.current
      const screen = screenRef.current
      if (!digits || !target || !face || !screen) return done()
      const a = digits.getBoundingClientRect()
      const n = target.getBoundingClientRect()
      const toX = n.left + n.width / 2 - (a.left + a.width / 2)
      const toY = n.top + n.height / 2 - (a.top + a.height / 2)
      const toScale = (n.height / a.height) * 1.1
      const words = [amRef.current, noteRef.current]
      // one second, several things on their own clocks
      flight = tween(
        1,
        ease.linear,
        (k) => {
          const f = ease.expoInOut(clamp(k / 0.9))
          digits.style.transform = `translate(${(toX * f).toFixed(1)}px,${(toY * f).toFixed(1)}px) scale(${(1 + (toScale - 1) * f).toFixed(4)})`
          digits.style.opacity = (1 - clamp((k - 0.85) / 0.2)).toFixed(3)
          const caseOff = clamp(k / 0.4)
          face.style.backgroundColor = `rgba(11,13,18,${(1 - caseOff).toFixed(3)})`
          face.style.boxShadow =
            caseOff >= 1 ? "none" : `inset 0 0 0 2px rgba(27,30,38,${(1 - caseOff).toFixed(3)}), 0 30px 80px rgba(0,0,0,${(0.6 * (1 - caseOff)).toFixed(3)})`
          for (const w of words) if (w) w.style.opacity = (1 - clamp(k / 0.3)).toFixed(3)
          screen.style.backgroundColor = `rgba(5,7,12,${(1 - ease.cubicInOut(clamp((k - 0.35) / 1.1))).toFixed(3)})`
        },
        done,
      )
      after(2500, () => flight?.finish()) // rAF sleeps in background tabs
    }

    Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 6500))]).then(() => {
      after(Math.max(0, 1600 - (performance.now() - t0)), () => {
        clearInterval(counter)
        if (prefersReducedMotion()) return done()
        setRinging(true)
        after(700, fly)
      })
    })
    // whatever happens, the street opens
    after(11000, () => {
      clearInterval(counter)
      done()
    })

    return () => {
      alive = false
      clearInterval(counter)
      timers.forEach(clearTimeout)
      flight?.cancel()
    }
  }, [artKey, targetRef])

  const digits = ringing ? "4:00" : `3:${String(Math.min(59, Math.floor(shown * 60))).padStart(2, "0")}`

  return (
    <div ref={screenRef} className={[s.screen, ringing && s.ringing, gone && s.gone].filter(Boolean).join(" ")} aria-hidden>
      <div className={s.alarm}>
        <div ref={faceRef} className={s.face}>
          <span ref={digitsRef} className={s.digits}>
            {digits}
          </span>
          <span ref={amRef} className={s.am}>
            {CLOCK_SUFFIX}
          </span>
        </div>
        <p ref={noteRef} className={s.note}>
          {note}
        </p>
      </div>
    </div>
  )
}
