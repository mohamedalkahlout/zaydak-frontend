"use client"

import type { Ref } from "react"

import shared from "../doughn.module.css"
import { countdownText, useZonedMinutes } from "../lib/clock"
import { fill } from "../lib/fill"
import type { DoughnContent, DoughnCopy } from "../types"
import s from "./visit-card.module.css"

interface VisitCardProps {
  content: DoughnContent
  copy: DoughnCopy
  onReserve: () => void
  ref?: Ref<HTMLElement>
}

/** Open or shut right now, with a live countdown to the next change, and the facts. */
export function VisitCard({ content, copy, onReserve, ref }: VisitCardProps) {
  const now = useZonedMinutes(content.timeZone)
  const { open, close } = content.hours
  const isOpen = now >= open && now < close
  const until = isOpen ? close - now : now < open ? open - now : 1440 - now + open
  const countdown = <bdi>{countdownText(until)}</bdi>

  return (
    <>
      <section ref={ref} className={s.visit} id="visit" aria-labelledby="doughn-visit-h">
        <div>
          <p className={shared.eyebrow}>{copy.visitEyebrow}</p>
          <h2 className={s.status} id="doughn-visit-h">
            {isOpen ? copy.open : copy.shut}
          </h2>
          <p className={s.line}>{isOpen ? fill(copy.openLine, { left: countdown }) : fill(copy.shutLine, { wait: countdown })}</p>
          <div className={s.mini} data-open={isOpen ? "" : undefined} aria-hidden>
            <i className={s.miniDrum} />
            <i className={s.miniCurtain} />
            <i className={s.miniGlow} />
          </div>
        </div>
        <dl className={s.facts}>
          <div>
            <dt>{copy.whereT}</dt>
            <dd>{copy.whereD}</dd>
          </div>
          <div>
            <dt>{copy.hoursT}</dt>
            <dd>{copy.hoursD}</dd>
          </div>
          <div>
            <dt>{copy.knowT}</dt>
            <dd>{copy.knowD}</dd>
          </div>
        </dl>
        <div className={s.links}>
          <a className={`${shared.btn} ${shared.btnInk}`} href={content.mapUrl} target="_blank" rel="noopener noreferrer">
            {copy.directions}
          </a>
          <button className={`${shared.btn} ${shared.btnGhostInk}`} type="button" onClick={onReserve}>
            {copy.ctaReserve}
          </button>
        </div>
      </section>
      <div className={s.closeRun} aria-hidden />
    </>
  )
}
