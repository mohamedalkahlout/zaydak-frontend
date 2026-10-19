"use client"

import Link from "next/link"

import type { CheckoutFrameProps } from "../checkout-frame"
import s from "./checkout.module.css"

/** Checkout as the bakery's paper slip, under the shutter that opens the shop. */
export function DoughnCheckoutFrame(props: CheckoutFrameProps) {
  const lang = props.lang === "ar" ? "ar" : "en"

  return (
    <div className={s.root} style={props.fontStyle} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className={s.shutter} aria-hidden />
      <header className={s.bar}>
        <Link href={props.homeHref} className={s.wordmark}>
          {props.shopName}
        </Link>
        <Link href={props.backHref} className={s.back}>
          {props.backLabel}
        </Link>
      </header>
      <main className={s.sheet}>
        {props.loading ? (
          <h1 className={s.display}>{props.title}</h1>
        ) : props.empty ? (
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
                    <span className={s.qty}>{line.qty}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className={s.fields}>{props.fields}</div>
            <Money {...props} />
            <Place {...props} />
          </>
        )}
      </main>
    </div>
  )
}

function Money({ moneyRows, totalLabel, total, pending }: CheckoutFrameProps) {
  return (
    <>
      <dl className={s.money}>
        {moneyRows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className={s.total} data-pending={pending ? "true" : "false"}>
        <span>{totalLabel}</span>
        <span>{total}</span>
      </p>
    </>
  )
}

function Place(props: CheckoutFrameProps) {
  return (
    <>
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
  )
}
