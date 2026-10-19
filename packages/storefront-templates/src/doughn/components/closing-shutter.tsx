"use client"

import { useImperativeHandle, useRef, type Ref } from "react"

import shared from "../doughn.module.css"
import { clockText } from "../lib/clock"
import { setFlag, setStyle } from "../lib/dom"
import { clamp, smooth } from "../lib/motion"
import type { DoughnContent, DoughnCopy } from "../types"
import s from "./closing-shutter.module.css"

export interface ClosingHandle {
  /** q: 0 up and out of sight, 1 all the way down */
  set: (q: number) => void
}

interface ClosingShutterProps {
  content: DoughnContent
  copy: DoughnCopy
  onOpenAgain: () => void
  ref?: Ref<ClosingHandle>
}

/** The shop closing: the last screen of scroll pulls a shutter down over the page. */
export function ClosingShutter({ content, copy, onOpenAgain, ref }: ClosingShutterProps) {
  const rootRef = useRef<HTMLElement>(null)
  const drumRef = useRef<HTMLDivElement>(null)
  const curtainRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      set(q) {
        const root = rootRef.current
        const drum = drumRef.current
        const curtain = curtainRef.current
        if (!root || !drum || !curtain) return
        setFlag(root, "data-live", q > 0)
        setFlag(root, "data-down", q > 0.92)
        setStyle(curtain, "transform", `translate3d(0,${((q - 1) * 100).toFixed(2)}%,0)`)
        setStyle(drum, "transform", `translate3d(0,${(-100 + 100 * smooth(clamp(q * 4))).toFixed(2)}%,0)`)
      },
    }),
    [],
  )

  return (
    <footer ref={rootRef} className={s.closing}>
      <div ref={drumRef} className={s.drum} aria-hidden />
      <div ref={curtainRef} className={s.curtain}>
        <div className={s.paint}>
          <p className={`${s.mark} ${shared.wordmark}`}>{content.brand}</p>
          <p className={s.line}>{copy.closing}</p>
          <p className={s.small}>
            <bdi>
              {clockText(content.hours.open)} &rarr; {clockText(content.hours.close)}
            </bdi>{" "}
            <span>{copy.closingSmall}</span>
          </p>
          <button className={`${shared.btn} ${shared.btnPaint}`} type="button" onClick={onOpenAgain}>
            {copy.openAgain}
          </button>
          <p className={s.demo}>{copy.demo}</p>
        </div>
        <div className={s.bar} aria-hidden />
      </div>
    </footer>
  )
}
