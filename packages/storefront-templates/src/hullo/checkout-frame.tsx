"use client"

import Link from "next/link"

import type { CheckoutFrameProps } from "../checkout-frame"
import s from "./checkout.module.css"

/** Checkout as the pickup ticket the window prints. */
export function HulloCheckoutFrame(props: CheckoutFrameProps) {
  const lang = props.lang === "ar" ? "ar" : "en"

  return (
    <div className={`${s.root} ${props.fontClass ?? ""}`} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <header className={s.bar}>
        <Link href={props.homeHref} className={s.wordmark}>
          {props.shopName}
        </Link>
        <Link href={props.backHref} className={s.back}>
          {props.backLabel}
        </Link>
      </header>
      <main className={s.ticket}>
        {props.empty ? (
          <div className={s.empty}>
            <p>{props.empty.title}</p>
            <Link href={props.empty.href}>{props.empty.action}</Link>
          </div>
        ) : (
          <>
            <h1 className={s.display}>{props.title}</h1>
            {props.lines.length > 0 && (
              <ul className={s.lines}>
                {props.lines.map((line) => (
                  <li key={line.id}>
                    <span>{line.name}</span>
                    <span>{line.qty}</span>
                  </li>
                ))}
              </ul>
            )}
            {props.loading ? null : <div className={s.fields}>{props.fields}</div>}
            <dl className={s.money}>
              {props.moneyRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className={s.total} data-pending={props.pending ? "true" : "false"}>
              <span>{props.totalLabel}</span>
              <span>{props.total}</span>
            </p>
            {!props.loading && (
              <button
                type="button"
                className={s.place}
                disabled={!props.canPlace || props.placing}
                onClick={props.onPlace}
              >
                {props.placing ? props.placingLabel : props.placeLabel}
              </button>
            )}
            {props.notice ? <p className={s.notice}>{props.notice}</p> : null}
          </>
        )}
      </main>
    </div>
  )
}
