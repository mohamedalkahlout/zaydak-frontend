"use client"

/* eslint-disable @next/next/no-img-element -- bread cut-outs bundled with the template */

import { useLayoutEffect, useRef, useState, type FormEvent } from "react"

import { BREAD_ART } from "../art"
import shared from "../doughn.module.css"
import { fill } from "../lib/fill"
import { ease, tween } from "../lib/motion"
import type { BreadId, DoughnContent, DoughnCopy, Lang } from "../types"
import s from "./bag-sheet.module.css"

interface BagSheetProps {
  open: boolean
  content: DoughnContent
  copy: DoughnCopy
  lang: Lang
  bag: Record<string, number>
  onClose: () => void
  onQty: (id: string, delta: number) => void
  onClear: () => void
}

interface Ticket {
  no: string
  slot: string
  name: string
  lines: { id: string; qty: number; name: string }[]
}

/** A pickup number like the ones on the paper roll at the window. Called on submit. */
const nextTicketNumber = () => `A-${10 + Math.floor(Math.random() * 89)}`

/**
 * The bag: quantities, a pickup slot and a name, then a paper ticket. A demo: nothing
 * is charged, sent or stored. Slides in from the reading direction's end.
 */
export function BagSheet({ open, content, copy, lang, bag, onClose, onQty, onClear }: BagSheetProps) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [name, setName] = useState("")
  const [slot, setSlot] = useState(content.slots[0])
  const [invalid, setInvalid] = useState(false)
  // each opening starts on the bag, not on the last ticket
  const [openedFor, setOpenedFor] = useState(open)
  if (open !== openedFor) {
    setOpenedFor(open)
    if (open) setTicket(null)
  }

  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const ticketRef = useRef<HTMLDivElement>(null)
  const offset = useRef(0)
  const returnFocus = useRef<Element | null>(null)
  const langRef = useRef(lang)
  useLayoutEffect(() => {
    langRef.current = lang
  })

  useLayoutEffect(() => {
    const sheet = sheetRef.current
    if (!mounted || !sheet) return
    const away = langRef.current === "ar" ? -104 : 104
    const move = (x: number) => {
      offset.current = x
      sheet.style.transform = x ? `translateX(${x.toFixed(2)}%)` : ""
    }
    if (open) {
      returnFocus.current = document.activeElement
      const slide = tween(0.7, ease.expoOut, (k) => move(away * (1 - k)))
      const focus = setTimeout(() => closeRef.current?.focus(), 30)
      return () => {
        slide.cancel()
        clearTimeout(focus)
      }
    }
    const from = offset.current
    const slide = tween(0.45, ease.quartIn, (k) => move(from + (away - from) * k), () => {
      setMounted(false)
      const back = returnFocus.current
      if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true })
    })
    return () => slide.cancel()
  }, [open, mounted])

  useLayoutEffect(() => {
    const el = ticketRef.current
    if (!ticket || !el) return
    const pop = tween(0.8, ease.expoOut, (k) => {
      el.style.transform = `scaleY(${(0.2 + 0.8 * k).toFixed(3)})`
      el.style.opacity = k.toFixed(3)
    })
    return () => pop.cancel()
  }, [ticket])

  if (!mounted) return null

  const entries = Object.entries(bag).filter(([, q]) => q > 0)
  const itemById = (id: string) => content.items.find((x) => x.id === id)
  const count = entries.reduce((n, [, q]) => n + q, 0)
  const total = entries.reduce((sum, [id, q]) => sum + q * (itemById(id)?.price ?? 0), 0)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const honeypot = e.currentTarget.elements.namedItem("website")
    if (honeypot instanceof HTMLInputElement && honeypot.value) return // filled by a bot
    const who = name.trim().replace(/[<>&"]/g, "")
    if (!who) {
      setInvalid(true)
      nameRef.current?.focus()
      return
    }
    setInvalid(false)
    setTicket({
      no: nextTicketNumber(),
      slot,
      name: who,
      lines: entries.map(([id, qty]) => ({ id, qty, name: itemById(id)?.name[lang] ?? id })),
    })
    setName("")
  }

  return (
    <aside
      className={s.bag}
      aria-label={copy.bagTitle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={sheetRef} className={s.sheet} data-lenis-prevent>
        <div className={s.top}>
          <h2 className={s.title}>{copy.bagH}</h2>
          <button ref={closeRef} className={`${shared.pill} ${s.kraftPill}`} type="button" onClick={onClose}>
            {copy.close}
          </button>
        </div>

        <ul className={s.list}>
          {entries.map(([id, qty]) => {
            const item = itemById(id)
            if (!item) return null
            return (
              <li key={id} className={s.item}>
                <img src={item.image || BREAD_ART[id as BreadId]} alt="" />
                <div>
                  <b>{item.name[lang]}</b>
                  <small>
                    <bdi>
                      {item.price} {copy.currency}
                    </bdi>
                  </small>
                </div>
                <div className={s.qty}>
                  <button type="button" aria-label="-" onClick={() => onQty(id, -1)}>
                    &minus;
                  </button>
                  <bdi>{qty}</bdi>
                  <button type="button" aria-label="+" onClick={() => onQty(id, 1)}>
                    +
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {count === 0 && <p className={s.empty}>{copy.bagEmpty}</p>}

        {count > 0 && !ticket && (
          <form className={s.form} noValidate onSubmit={submit}>
            <label>
              <span>{copy.slotL}</span>
              <select name="slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
                {content.slots.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.nameL}</span>
              <input
                ref={nameRef}
                className={invalid ? s.invalid : undefined}
                name="name"
                autoComplete="given-name"
                maxLength={24}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {/* honeypot: people never see it, form-filling bots do */}
            <label className={shared.srOnly} aria-hidden>
              website
              <input tabIndex={-1} name="website" autoComplete="off" />
            </label>
            <div className={s.total}>
              <span>{copy.total}</span>
              <bdi>
                {total} {copy.currency}
              </bdi>
            </div>
            <button className={`${shared.btn} ${shared.btnEmber} ${shared.btnWide}`} type="submit">
              {copy.reserve}
            </button>
            <p className={s.note}>{copy.bagNote}</p>
          </form>
        )}

        {ticket && (
          <div ref={ticketRef} className={s.ticket}>
            <p className={s.ticketH}>{copy.ticketH}</p>
            <p className={s.ticketNo}>
              <bdi>{ticket.no}</bdi>
            </p>
            <p className={s.ticketLine}>{fill(copy.ticketLine, { slot: <bdi>{ticket.slot}</bdi>, name: ticket.name })}</p>
            <ul className={s.ticketItems}>
              {ticket.lines.map((line) => (
                <li key={line.id}>
                  <bdi>{line.qty} x</bdi> {line.name}
                </li>
              ))}
            </ul>
            <button
              className={`${shared.pill} ${s.kraftPill}`}
              type="button"
              onClick={() => {
                onClear()
                onClose()
              }}
            >
              {copy.done}
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
