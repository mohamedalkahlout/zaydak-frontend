"use client"

import type { RefObject } from "react"

import shared from "../doughn.module.css"
import { clockText, useZonedMinutes } from "../lib/clock"
import { useStory, type StoryStore } from "../lib/stores"
import type { DoughnCopy, Lang } from "../types"
import s from "./template-nav.module.css"

interface TemplateNavProps {
  brand: string
  copy: DoughnCopy
  lang: Lang
  timeZone: string
  story: StoryStore
  bagCount: number
  menuOpen: boolean
  onToggleLang: () => void
  onBag: () => void
  onMenu: () => void
  /** the clock digits, which the loader's 4:00 flies into */
  timeRef: RefObject<HTMLElement | null>
  /** the bag pill, which added loaves fly into */
  bagRef: RefObject<HTMLButtonElement | null>
}

/**
 * The top bar. On the street its clock tells story time ("am"); past the street it
 * tells the real time in the shop's city.
 */
export function TemplateNav({ brand, copy, lang, timeZone, story, bagCount, menuOpen, onToggleLang, onBag, onMenu, timeRef, bagRef }: TemplateNavProps) {
  const { minute, live, mark, light } = useStory(story)
  const now = useZonedMinutes(timeZone)

  return (
    <header className={s.nav} data-mark={mark ? "" : undefined} data-light={light ? "" : undefined}>
      <a className={`${s.mark} ${shared.wordmark}`} href="#top" aria-label={brand}>
        {brand}
      </a>
      <div className={s.clock}>
        <span className={s.dot} aria-hidden />
        <bdi ref={timeRef} className={s.time}>
          {clockText(live ? now : minute)}
        </bdi>
        <span className={s.sub}>{live ? copy.city : copy.am}</span>
      </div>
      <div className={s.actions}>
        <button
          className={`${shared.pill} ${s.navPill} ${s.langPill}`}
          type="button"
          lang={lang === "ar" ? "en" : "ar"}
          onClick={onToggleLang}
        >
          {copy.switchTo}
        </button>
        <button ref={bagRef} className={`${shared.pill} ${s.navPill} ${s.bagPill}`} type="button" aria-label={copy.bagAria} onClick={onBag}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 8Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          <span className={s.count}>{bagCount}</span>
        </button>
        <button
          className={`${shared.pill} ${s.navPill}`}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="doughn-menu"
          onClick={onMenu}
        >
          {copy.menu}
        </button>
      </div>
    </header>
  )
}
