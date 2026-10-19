"use client"

/* eslint-disable @next/next/no-img-element -- the scoop is a cut-out the counter drops in */

import Link from "next/link"

import type { CheckoutFrameProps } from "../checkout-frame"
import { dripArt } from "./art"
import s from "./checkout.module.css"

/** Checkout as the counter: the total lands like a scoop, the order sits on cream paper. */
export function DripCheckoutFrame(props: CheckoutFrameProps) {
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
      <div className={s.stage}>
        <img src={dripArt("scoop-pistachio.webp")} alt="" width={180} height={173} className={s.scoop} />
        <p className={s.giant} data-pending={props.pending ? "true" : "false"}>
          {props.loading ? props.title : props.total}
        </p>
      </div>
      <main className={s.ticket}>
        {props.empty ? (
          <div className={s.empty}>
            <p>{props.empty.title}</p>
            <Link href={props.empty.href}>{props.empty.action}</Link>
          </div>
        ) : props.loading ? null : (
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
            <div className={s.fields}>{props.fields}</div>
            <dl className={s.money}>
              {props.moneyRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
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
