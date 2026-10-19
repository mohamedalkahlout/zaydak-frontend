"use client"

import Link from "next/link"

import type { CheckoutFrameProps } from "../checkout-frame"

import s from "./checkout.module.css"

/** Checkout on the fitting card. The order sits on paper; the button is ink. */
export function PersonneCheckoutFrame(props: CheckoutFrameProps) {
  const dir = props.lang === "ar" ? "rtl" : "ltr"
  return (
    <div className={`${s.root} ${props.fontClass ?? ""}`} lang={props.lang ?? "en"} dir={dir} style={props.fontStyle}>
      <header className={s.bar}>
        <Link href={props.backHref} className={s.back}>
          {props.backLabel}
        </Link>
        <Link href={props.homeHref} className={s.mark}>
          {props.shopName}
        </Link>
      </header>
      <main className={s.card}>
        {props.empty ? (
          <div className={s.empty}>
            <p>{props.empty.title}</p>
            <Link href={props.empty.href}>{props.empty.action}</Link>
          </div>
        ) : (
          <>
            <p className={s.eye}>{props.loading ? "" : props.title}</p>
            <h1 className={s.display}>{props.shopName}</h1>
            <ul className={s.lines}>
              {props.lines.map((line) => (
                <li key={line.id}>
                  <span>{line.name}</span>
                  <span>{line.qty}</span>
                </li>
              ))}
            </ul>
            <div className={s.fields}>{props.fields}</div>
            <dl className={s.money}>
              {props.moneyRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className={s.total}>
              <span>{props.totalLabel}</span>
              <span>{props.total}</span>
            </p>
            {props.notice ? <p className={s.note}>{props.notice}</p> : null}
            <button type="button" className={s.place} disabled={!props.canPlace || props.placing} onClick={props.onPlace}>
              {props.placing ? props.placingLabel : props.placeLabel}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
