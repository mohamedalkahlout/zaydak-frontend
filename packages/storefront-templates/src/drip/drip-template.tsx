"use client"

/* eslint-disable @next/next/no-img-element -- scoops, crowns and the loader ball are
   cloned and flown by the behaviour. next/image's wrapper would break that. */

import { useEffect, useRef, type CSSProperties } from "react"

import { dripArt } from "./art"
import {
  mountDrip,
  type DripBagLine,
  type DripCatalogue,
  type DripShopCart,
} from "./behavior"

import "./drip.css"

const photo = (name: string) =>
  `${dripArt(`${name}-s.webp`)} 820w, ${dripArt(`${name}.webp`)} 1536w`

/**
 * DRIP: a gelato bar in Jeddah. The counter drops scoops onto a cone you can
 * wiggle, then a case, a pinned "how it's made" scroll, and a visit card.
 * The markup is React. `behavior.js` is the demo's motion and writes styles
 * straight to these elements. It owns the window scroll, so it renders as a
 * whole page. English and Arabic stay inside the demo's own copy.
 */
export type DripCheckout = (lines: DripBagLine[]) => Promise<boolean>
export type { DripShopCart }

export function DripTemplate({
  fonts,
  getCheckout,
  shopCart,
  catalogue,
  hold = false,
}: {
  fonts: string
  /** Shop checkout. Absent on the theme preview, which keeps the demo receipt. */
  getCheckout?: () => DripCheckout | null
  /**
   * The shop cart. Present, add / quantity / remove / checkout talk to it
   * and the bag is painted from `setBag`. The theme preview omits it.
   */
  shopCart?: DripShopCart | null
  /** The shop's assembled product. Absent, the cone keeps the sample. */
  catalogue?: DripCatalogue | null
  /**
   * Paint the cream loader and wait. The scene boots once this is false,
   * so a catalogue that is still in flight cannot tear the loader down.
   */
  hold?: boolean
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const checkoutRef = useRef(getCheckout)
  checkoutRef.current = getCheckout
  const cartRef = useRef(shopCart)
  cartRef.current = shopCart
  const loaderScoop = catalogue?.flavours[0]?.cutout
  const wired = Boolean(shopCart)

  useEffect(() => {
    if (hold) return
    const root = rootRef.current
    if (!root) return
    const live = cartRef.current
    return mountDrip(root, {
      ...(getCheckout
        ? { getCheckout: () => checkoutRef.current?.() ?? null }
        : {}),
      ...(wired && live
        ? {
            shopCart: {
              persistLine: (line) =>
                cartRef.current?.persistLine(line) ?? Promise.resolve(false),
              setQuantity: (itemId, quantity) =>
                cartRef.current?.setQuantity(itemId, quantity) ??
                Promise.resolve(false),
              removeLine: (itemId) =>
                cartRef.current?.removeLine(itemId) ?? Promise.resolve(false),
              goCheckout: () =>
                cartRef.current?.goCheckout() ?? Promise.resolve(false),
              formatCents: (cents, lang) =>
                cartRef.current?.formatCents(cents, lang) ?? "",
            },
          }
        : {}),
      catalogue: catalogue ?? undefined,
    })
    // The handlers live on a ref so a new callback does not restart the scene.
    // A new catalogue does: the cone is built once from the flavours it mounts with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, wired, hold])

  return (
    <div ref={rootRef} className={`drip-tpl js ${fonts}`} lang="en" dir="ltr">
      <div className="loader" id="loader" aria-hidden="true">
        <div className="loader__sheet" id="loaderSheet">
          <svg className="loader__drips" id="loaderDrips" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
            <path id="loaderDripPath" d="" />
          </svg>
          <span className="loader__mark wordmark" data-latin>DRIP</span>
          <div className="loader__meta">
            <span className="loader__pct" id="loaderPct"><bdi>0</bdi></span>
            <span className="loader__line" data-i18n="loader.line">Rolling your first scoop</span>
          </div>
        </div>
        <div className="loader__ball" id="loaderBall">
          <img src={loaderScoop || dripArt("scoop-pistachio.webp")} alt="" width={900} height={865} />
        </div>
      </div>

      <header className="nav" id="nav">
        <a className="nav__mark wordmark" href="#top" data-latin data-i18n-aria="aria.home" aria-label="DRIP, back to the counter">
          DR
          <span className="nav__i">
            I
            <svg className="nav__drop" viewBox="0 0 10 16" aria-hidden="true">
              <path d="M5 0C5 0 0 7.5 0 10.6A5 5 0 0 0 10 10.6C10 7.5 5 0 5 0Z" />
            </svg>
          </span>
          P
        </a>
        <nav className="nav__links" data-i18n-aria="aria.main" aria-label="Main">
          <a href="#case" data-i18n="nav.flavours">Flavours</a>
          <a href="#cold" data-i18n="nav.how">How it&apos;s made</a>
          <a href="#visit" data-i18n="nav.visit">Visit</a>
        </nav>
        <div className="nav__right">
          <span className="pill" id="openPill"><i className="pill__dot" /><span id="openText">Open now, till 1 AM</span></span>
          <button className="nav__lang" id="langBtn" type="button" lang="ar" data-i18n="nav.lang">عربي</button>
          <button className="bagbtn" id="bagBtn" type="button" aria-haspopup="dialog" aria-controls="bag">
            <svg className="bagbtn__ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
              <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
            </svg>
            <span className="bagbtn__label" data-i18n="nav.bag">Bag</span>
            <span className="bagbtn__n" id="bagCount" aria-live="polite"><bdi>0</bdi></span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero" id="hero" data-i18n-aria="aria.hero" aria-label="Build your cone">
          <div className="hero__word" aria-hidden="true">
            <span className="hero__eyebrow" data-i18n="hero.eyebrow">Stack me a</span>
            <h1 className="hero__giant" id="giant">
              <span className="sr-only">DRIP Gelato Bar, Jeddah. </span>
              <span className="giant__txt" id="giantTxt">PISTACHIO</span>
            </h1>
          </div>

          <div className="stage" id="stage">
            <div className="rig" id="rig" role="img" data-i18n-aria="hero.cone" aria-label="Your cone">
              <div className="rig__inner" id="rigInner">
                <img className="rig__cone" id="coneImg" src={dripArt("cone.webp")} alt="" width={446} height={1100} draggable={false} />
                <div className="rig__stack" id="stack" />
              </div>
            </div>
          </div>

          <div className="panel panel--pick" id="pickPanel">
            <p className="panel__h" data-i18n="hero.pick">Pick a flavour</p>
            <div className="tray" id="tray" role="group" data-i18n-aria="hero.pick" aria-label="Flavours" />
            <p className="panel__hint" data-i18n="hero.hint">Tap a flavour to drop a scoop. Grab the cone and give it a wiggle.</p>
          </div>

          <div className="panel panel--cone" id="conePanel">
            <div className="vessel" id="vessel" role="group" data-i18n-aria="hero.vessel" aria-label="Cone or cup">
              <button className="vessel__btn is-on" type="button" data-vessel="cone" aria-pressed="true" data-i18n="hero.vessel.cone">Cone</button>
              <button className="vessel__btn" type="button" data-vessel="cup" aria-pressed="false" data-i18n="hero.vessel.cup">Cup</button>
            </div>
            <p className="panel__h">
              <span id="vesselTitle" data-i18n="hero.cone">Your cone</span> <span className="panel__count" id="scoopCount">1 scoop</span>
            </p>
            <ol className="tally" id="tally" aria-live="polite" />
            <p className="panel__sub" data-i18n="hero.crown">Crown it</p>
            <div className="crowns" id="crowns" role="group" data-i18n-aria="hero.crown" aria-label="Crown it" />
            <div className="panel__foot">
              <button className="btn btn--ink" id="addBtn" type="button">
                <span data-i18n="hero.add">Add to bag</span>
                <span className="btn__price" id="price"><bdi>16</bdi> <span data-i18n="currency">SAR</span></span>
              </button>
              <button className="btn btn--line" id="resetBtn" type="button" data-i18n="hero.reset">Start over</button>
            </div>
          </div>

          <p className="toast" id="toast" role="status" aria-live="polite" />
        </section>

        <section className="case" id="case" aria-labelledby="caseTitle">
          <header className="sec-head reveal">
            <p className="kicker" data-i18n="case.kicker">In the case today</p>
            <h2 className="sec-title" id="caseTitle" data-i18n="case.title">Six flavours. Made this morning. Gone by midnight.</h2>
          </header>
          <ol className="rows" id="rows" />
          <div className="rows__float" id="rowFloat" aria-hidden="true">
            <img alt="" src={dripArt("scoop-pistachio-m.webp")} />
          </div>
        </section>

        <section className="cold" id="cold" aria-labelledby="coldTitle">
          <div className="cold__pin" id="coldPin">
            <div className="cold__frost" id="frost" aria-hidden="true" />
            <div className="cold__left">
              <p className="kicker" data-i18n="cold.kicker">How it&apos;s made</p>
              <h2 className="sec-title" id="coldTitle" data-i18n="cold.title">Colder is not better.</h2>
              <div className="temp" aria-hidden="true">
                <bdi className="temp__n" id="tempN">+4</bdi>
                <span className="temp__deg">°C</span>
              </div>
              <div className="therm" aria-hidden="true">
                <i className="therm__fill" id="thermFill" />
                <span className="therm__tick" style={{ "--t": 0 } as CSSProperties}>+4</span>
                <span className="therm__tick" style={{ "--t": 0.5333 } as CSSProperties}>−4</span>
                <span className="therm__tick" style={{ "--t": 1 } as CSSProperties}>−11</span>
              </div>
            </div>
            <div className="cold__right">
              <div className="cold__photos" aria-hidden="true">
                <img className="cold__ph is-on" data-step="0" src={dripArt("milk.webp")} srcSet={photo("milk")} sizes="(max-width: 760px) 92vw, 46vw" alt="" loading="lazy" width={1536} height={1024} />
                <img className="cold__ph" data-step="1" src={dripArt("churn.webp")} srcSet={photo("churn")} sizes="(max-width: 760px) 92vw, 46vw" alt="" loading="lazy" width={1536} height={1024} />
                <img className="cold__ph" data-step="2" src={dripArt("case.webp")} srcSet={photo("case")} sizes="(max-width: 760px) 92vw, 46vw" alt="" loading="lazy" width={1536} height={1024} />
              </div>
              <ol className="steps">
                <li className="step is-on" data-step="0">
                  <span className="step__t" data-i18n="cold.s1.t">7:30 AM</span>
                  <h3 data-i18n="cold.s1.h">The milk arrives at dawn.</h3>
                  <p data-i18n="cold.s1.p">Whole and fresh, never powdered. It sits at four degrees until we need it.</p>
                </li>
                <li className="step" data-step="1">
                  <span className="step__t" data-i18n="cold.s2.t">9:00 AM</span>
                  <h3 data-i18n="cold.s2.h">Churned slow.</h3>
                  <p data-i18n="cold.s2.p">Twenty minutes a batch, so less air goes in and more flavour stays. That is why gelato feels dense.</p>
                </li>
                <li className="step" data-step="2">
                  <span className="step__t" data-i18n="cold.s3.t">All day</span>
                  <h3 data-i18n="cold.s3.h">Served at minus eleven.</h3>
                  <p data-i18n="cold.s3.p">Ice cream sits at minus eighteen, cold enough to numb your tongue. Gelato is served warmer, so you taste more of it.</p>
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="visit" id="visit" aria-labelledby="visitTitle">
          <figure className="visit__arch reveal">
            <img
              src={dripArt("shop.webp")}
              srcSet={photo("shop")}
              sizes="(max-width: 760px) 92vw, 48vw"
              alt="The DRIP shopfront at dusk, warm light on a pistachio-green tiled counter"
              loading="lazy"
              width={1536}
              height={1024}
            />
          </figure>
          <div className="visit__info reveal">
            <p className="kicker" data-i18n="visit.kicker">Visit</p>
            <h2 className="sec-title" id="visitTitle" data-i18n="visit.title">Come get sticky.</h2>
            <p className="visit__addr" data-i18n="visit.addr">Prince Mohammed bin Abdulaziz St (Tahlia), Al Andalus, Jeddah</p>
            <div className="visit__hours">
              <p className="visit__h" data-i18n="visit.hours.h">Hours</p>
              <p data-i18n="visit.hours">Saturday to Thursday, 2 PM to 1 AM. Friday, 4 PM to 1 AM.</p>
              <p className="visit__now"><i className="pill__dot" /><span id="openText2">Open now, till 1 AM</span></p>
            </div>
            <div className="visit__cta">
              <a className="btn btn--ink" href="https://www.google.com/maps/search/?api=1&query=Tahlia+Street+Jeddah" target="_blank" rel="noopener" data-i18n="visit.dir">Get directions</a>
              <button className="btn btn--line" type="button" id="orderAhead" data-i18n="visit.order">Order ahead for pickup</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot" id="foot">
        <svg className="foot__word" id="footWord" viewBox="0 0 1000 330" aria-hidden="true">
          <g id="footDrips" />
          <text id="footText" x="500" y="232" textAnchor="middle">DRIP</text>
        </svg>
        <div className="foot__row">
          <p data-i18n="foot.line">Gelato made every morning in Jeddah.</p>
          <p className="foot__demo" data-i18n="foot.demo">A concept site by Genesis Works. DRIP is a fictional brand.</p>
        </div>
      </footer>

      <div className="bag" id="bag" role="dialog" aria-modal="true" aria-labelledby="bagTitle" hidden>
        <div className="bag__scrim" data-close />
        <div className="bag__panel" id="bagPanel">
          <header className="bag__head">
            <h2 id="bagTitle" data-i18n="bag.title">Your bag</h2>
            <button className="bag__x" type="button" data-close data-i18n-aria="bag.close" aria-label="Close bag">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>
          <div className="bag__body" id="bagBody" />
        </div>
      </div>
    </div>
  )
}
