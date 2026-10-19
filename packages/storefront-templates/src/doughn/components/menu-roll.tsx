"use client"

import { useLayoutEffect, useRef, useState } from "react"

import shared from "../doughn.module.css"
import { ease, tween } from "../lib/motion"
import type { DoughnCopy } from "../types"
import s from "./menu-roll.module.css"

interface MenuRollProps {
  open: boolean
  /** close without the roll-up (a link was followed) */
  instant: boolean
  copy: DoughnCopy
  onClose: () => void
  onReserve: () => void
}

/**
 * The menu unrolls like kraft paper from a tube that travels down its bottom edge,
 * and rolls back up on close. It stays mounted until the roll-up has finished.
 */
export function MenuRoll({ open, instant, copy, onClose, onReserve }: MenuRollProps) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  if (!open && instant && mounted) setMounted(false)

  const paperRef = useRef<HTMLDivElement>(null)
  const tubeRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const rolled = useRef(0)

  useLayoutEffect(() => {
    const paper = paperRef.current
    const tube = tubeRef.current
    if (!mounted || !paper || !tube) return
    const draw = (v: number) => {
      rolled.current = v
      paper.style.clipPath = `inset(0 0 ${((1 - v) * 100).toFixed(2)}% 0)`
      tube.style.transform = `translate3d(0,${(v * paper.offsetHeight - 18).toFixed(1)}px,0)`
    }
    if (open) {
      const roll = tween(0.9, ease.expoOut, draw)
      const safety = setTimeout(roll.finish, 1300) // rAF sleeps in background tabs
      const focus = setTimeout(() => closeRef.current?.focus(), 30)
      return () => {
        roll.cancel()
        clearTimeout(safety)
        clearTimeout(focus)
      }
    }
    const from = rolled.current
    const roll = tween(0.5, ease.quartIn, (k) => draw(from * (1 - k)), () => setMounted(false))
    const safety = setTimeout(roll.finish, 900)
    return () => {
      roll.cancel()
      clearTimeout(safety)
    }
  }, [open, mounted])

  if (!mounted) return null

  return (
    <div
      className={s.menu}
      id="doughn-menu"
      role="dialog"
      aria-modal="true"
      aria-label={copy.menuAria}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={paperRef} className={s.paper}>
        <nav className={s.links}>
          <a href="#top">{copy.linkStreet}</a>
          <a href="#board">{copy.linkBoard}</a>
          <a href="#visit">{copy.linkVisit}</a>
          <button type="button" onClick={onReserve}>
            {copy.ctaReserve}
          </button>
        </nav>
        <p className={s.note}>{copy.rollNote}</p>
        <button ref={closeRef} className={`${shared.pill} ${s.close}`} type="button" onClick={onClose}>
          {copy.close}
        </button>
      </div>
      <div ref={tubeRef} className={s.tube} aria-hidden />
    </div>
  )
}
