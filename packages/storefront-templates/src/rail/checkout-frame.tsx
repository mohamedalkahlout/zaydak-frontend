"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

import type { CheckoutFrameProps } from "../checkout-frame"
import { springStep } from "./motion"
import s from "./checkout.module.css"

/** Checkout under the clothing rail. The order hangs, then settles with the rail's spring. */
export function RailCheckoutFrame(props: CheckoutFrameProps) {
  const hangRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = hangRef.current
    if (!el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = "none"
      return
    }
    let position = 56
    let velocity = 0
    let last = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const next = springStep(position, velocity, 0, now - last)
      position = next.position
      velocity = next.velocity
      last = now
      el.style.transform = `translate3d(${position}px, 0, 0)`
      if (Math.abs(position) > 0.04 || Math.abs(velocity) > 0.04) {
        frame = requestAnimationFrame(tick)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [props.lines.length])

  return (
    <div className={s.root}>
      <header className={s.bar}>
        <Link href={props.backHref} className={s.back}>
          {props.backLabel}
        </Link>
        <Link href={props.homeHref} className={s.wordmark}>
          <i />
          {props.shopName}
        </Link>
        <p className={s.count}>{String(props.lines.length).padStart(2, "0")}</p>
      </header>
      <div className={s.rack}>
        <div className={s.rail} aria-hidden>
          <i />
          <i />
        </div>
        <div className={s.hang} ref={hangRef}>
          {props.lines.map((line) => (
            <article key={line.id} className={s.tag}>
              <p>{line.name}</p>
              <span>{line.qty}</span>
            </article>
          ))}
        </div>
      </div>
      <main className={s.bench}>
        {props.empty ? (
          <div className={s.empty}>
            <p>{props.empty.title}</p>
            <Link href={props.empty.href}>{props.empty.action}</Link>
          </div>
        ) : props.loading ? (
          <h1 className={s.display}>{props.title}</h1>
        ) : (
          <>
            <h1 className={s.display}>{props.title}</h1>
            <div className={s.fields}>{props.fields}</div>
            <dl className={s.money}>
              {props.moneyRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className={s.count} data-pending={props.pending ? "true" : "false"}>
              {props.totalLabel} {props.total}
            </p>
            <button
              type="button"
              className={s.place}
              disabled={!props.canPlace || props.placing}
              onClick={props.onPlace}
            >
              {props.placing ? props.placingLabel : props.placeLabel}
            </button>
            {props.notice ? <p className={s.notice}>{props.notice}</p> : null}
          </>
        )}
      </main>
    </div>
  )
}
