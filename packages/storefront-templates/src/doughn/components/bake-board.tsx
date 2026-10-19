"use client"

/* eslint-disable @next/next/no-img-element -- bread cut-outs bundled with the template; the
   street works out where each loaf lands from their natural size (scene/street-scene.ts). */

import { useState, type Ref } from "react"

import { ART, BREAD_ART } from "../art"
import shared from "../doughn.module.css"
import { bakeStatus, clockText, useZonedMinutes } from "../lib/clock"
import { fillText } from "../lib/fill"
import { clamp } from "../lib/motion"
import { BREAD_SIZE } from "../scene/geometry"
import type { DoughnContent, DoughnCopy, Lang } from "../types"
import s from "./bake-board.module.css"

interface BakeBoardProps {
  content: DoughnContent
  copy: DoughnCopy
  lang: Lang
  bag: Record<string, number>
  onAdd: (id: string, from: HTMLImageElement | null) => void
  ref?: Ref<HTMLElement>
}

/**
 * What comes out of the oven, and when: one card per bread with a live status chip
 * (in the oven, warm, fresh, later, tomorrow) read from the shop's clock, and a
 * slider to peek at another hour. Each card's image is where its loaf lands.
 */
export function BakeBoard({ content, copy, lang, bag, onAdd, ref }: BakeBoardProps) {
  const now = useZonedMinutes(content.timeZone)
  const [peekAt, setPeekAt] = useState<number | null>(null)
  const { open } = content.hours
  const minute = peekAt ?? now
  const other: Lang = lang === "en" ? "ar" : "en"
  const sliderValue = peekAt === null ? clamp(Math.round((now - open) / 5) * 5, 0, 540) : peekAt - open

  return (
    <section ref={ref} className={s.board} id="board" aria-labelledby="doughn-board-h">
      <div className={s.head}>
        <p className={`${shared.eyebrow} ${s.eyebrowRow}`}>{copy.boardEyebrow}</p>
        <h2 className={s.title} id="doughn-board-h">
          {copy.boardH}
        </h2>
        <div className={s.peek} data-peeking={peekAt === null ? undefined : ""}>
          <div className={s.peekNow}>
            <span className={s.peekLabel}>{peekAt === null ? copy.nowIn : copy.peeking}</span>{" "}
            <bdi className={s.peekTime} id="doughn-peek-time">
              {clockText(minute)}
            </bdi>
          </div>
          <label className={s.peekCtl}>
            <span>{copy.peek}</span>
            <input
              className={s.range}
              type="range"
              min={0}
              max={780}
              step={5}
              value={sliderValue}
              aria-describedby="doughn-peek-time"
              onChange={(e) => setPeekAt(open + Number(e.target.value))}
            />
          </label>
          <button className={s.peekReset} type="button" onClick={() => setPeekAt(null)}>
            {copy.peekReset}
          </button>
        </div>
      </div>

      <ol className={s.cards}>
        {content.items.map((item) => {
          const [status, at] = bakeStatus(item.times, minute, content.hours)
          const chip = copy.chip[status]
          const [w, h] = BREAD_SIZE[item.id]
          const inBag = (bag[item.id] ?? 0) > 0
          return (
            <li key={item.id} className={s.card} data-s={status}>
              <div className={s.slot} data-slot={item.id}>
                <img className={s.cBread} data-bread src={item.image || BREAD_ART[item.id]} alt={item.name[lang]} width={w} height={h} decoding="async" />
                <img className={s.cSteam} src={ART.steam} alt="" />
                <img className={`${s.cSteam} ${s.cSteam2}`} src={ART.steam} alt="" />
              </div>
              <div className={s.cTop}>
                <bdi className={s.cTime}>{clockText(item.times[0])}</bdi>
                <span className={s.chip}>{fillText(chip, { at: clockText(at) })}</span>
              </div>
              {item.href ? (
                <a className={s.cName} href={item.href}>
                  {item.name[lang]}
                  <span className={s.cAlt} lang={other}>
                    {item.name[other]}
                  </span>
                </a>
              ) : (
                <h3 className={s.cName}>
                  {item.name[lang]}
                  <span className={s.cAlt} lang={other}>
                    {item.name[other]}
                  </span>
                </h3>
              )}
              {item.note[lang] ? <p className={s.cNote}>{item.note[lang]}</p> : null}
              {item.times.length > 1 && (
                <span className={s.cAgain}>{fillText(copy.again, { list: item.times.slice(1).map(clockText).join(", ") })}</span>
              )}
              <div className={s.cBuy}>
                <bdi className={s.cPrice}>
                  {item.price} {copy.currency}
                </bdi>
                <button
                  className={s.add}
                  type="button"
                  data-in-bag={inBag ? "" : undefined}
                  onClick={(e) => onAdd(item.id, e.currentTarget.closest("li")?.querySelector<HTMLImageElement>("img[data-bread]") ?? null)}
                >
                  {inBag ? copy.added : copy.add}
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <p className={s.foot}>{copy.boardFoot}</p>
    </section>
  )
}
