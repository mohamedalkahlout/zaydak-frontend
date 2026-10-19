"use client"

import { useLayoutEffect, useRef, useSyncExternalStore } from "react"

import { clockText } from "../lib/clock"
import { ease, lerp, tween, type Tween } from "../lib/motion"
import type { StoryStore } from "../lib/stores"
import s from "./street.module.css"

interface CaptionEl extends HTMLLIElement {
  motion?: Tween
  y?: number
  o?: number
}

/**
 * The time-stamped line at the bottom of the street. A caption rises in as story
 * time reaches it and the previous one drifts up and away. The list is written
 * imperatively — React renders an empty <ol> and never reconciles its children —
 * so a caption that is still leaving can overlap the one arriving.
 */
export function Captions({ story, caps }: { story: StoryStore; caps: [number, string][] }) {
  const index = useSyncExternalStore(story.subscribe, () => story.get().caption, () => -1)
  const listRef = useRef<HTMLOListElement>(null)
  const entry = index >= 0 ? caps[index] : undefined
  const time = entry ? clockText(entry[0]) : ""
  const line = entry ? entry[1] : ""

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const leaving = list.querySelector<CaptionEl>("li[data-on]")
    if (leaving) {
      leaving.removeAttribute("data-on")
      leaving.motion?.cancel()
      const y0 = leaving.y ?? 0
      const o0 = leaving.o ?? 1
      tween(
        0.5,
        ease.expoOut,
        (k) => {
          leaving.style.transform = `translateY(${lerp(y0, -46, k).toFixed(1)}px)`
          leaving.style.opacity = lerp(o0, 0, k).toFixed(3)
        },
        () => leaving.remove(),
      )
    }
    if (!line) return
    const li: CaptionEl = document.createElement("li")
    li.className = s.cap
    li.setAttribute("data-on", "")
    const t = document.createElement("span")
    t.className = s.capTime
    t.textContent = time
    const x = document.createElement("span")
    x.className = s.capLine
    x.textContent = line
    li.append(t, x)
    list.appendChild(li)
    li.motion = tween(0.7, ease.expoOut, (k) => {
      li.y = 40 * (1 - k)
      li.o = k
      li.style.transform = `translateY(${li.y.toFixed(1)}px)`
      li.style.opacity = k.toFixed(3)
    })
  }, [time, line])

  return <ol ref={listRef} className={s.captions} aria-live="polite" />
}
