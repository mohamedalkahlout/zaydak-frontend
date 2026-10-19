"use client"

/* eslint-disable @next/next/no-img-element -- the scene clones these nodes and flies them
   into the order pill. next/image's wrapper would break that, and every file is bundled locally. */

import { useEffect, useRef, type CSSProperties } from "react"

import {
  mountHullo,
  type HulloCheckoutLine,
  type HulloShopCart,
} from "./behavior"
import {
  cardStyle,
  type HulloItem,
  HULLO_ART,
  HULLO_BASES,
  HULLO_FILTERS,
  HULLO_ICES,
  HULLO_MARQUEE,
  HULLO_MENU,
  HULLO_MILKS,
  HULLO_SIZES,
  HULLO_SNAPS,
  HULLO_STICKERS,
  HULLO_SWEETS,
  HULLO_VIBES,
} from "./content"
import { Icon } from "./icons"

import "./hullo.css"

const WORD = ["h", "u", "l", "l", "o"] as const

export type HulloCheckout = (lines: HulloCheckoutLine[]) => Promise<boolean>
export type { HulloShopCart }

/**
 * hullo: a walk-up coffee window. Scrolling lands the sign on the wall and walks
 * through the window; below that, a menu, a cup you build, a camera roll and a
 * hanging hours sign. The markup is React. `behavior.js` is the demo's motion,
 * writing styles straight to these elements, the same way doughn's scene does.
 * It owns the window scroll, so it renders as a whole page.
 * A shop menu replaces the sample cards. Absent, the preview keeps `content.ts`.
 */
export function HulloTemplate({
  menu,
  filters,
  currency = "SAR",
  getCheckout,
  shopCart,
  fonts,
}: {
  /** The shop's products. Absent, the sample menu stays. */
  menu?: HulloItem[]
  filters?: readonly { id: string; label: string }[]
  currency?: string
  /** Shop checkout. Absent on the theme preview, which prints the demo ticket. */
  getCheckout?: () => HulloCheckout | null
  /**
   * Shop cart. Present, the tray is that cart: adds and quantity go through
   * it, and checkout opens it instead of copying the lines again. The theme
   * preview omits this and keeps the demo list.
   */
  shopCart?: HulloShopCart | null
  /** Variable classes from the app's `next/font` load. The package does not call next/font. */
  fonts: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const checkoutRef = useRef(getCheckout)
  checkoutRef.current = getCheckout
  const cartRef = useRef(shopCart)
  cartRef.current = shopCart
  const items = menu && menu.length > 0 ? menu : HULLO_MENU
  const usingShop = items !== HULLO_MENU
  const stickerIds = usingShop
    ? items.slice(0, 4).map((item) => item.id)
    : HULLO_STICKERS
  const filterRows = usingShop
    ? filters && filters.length > 0
      ? filters
      : [{ id: "all", label: "all" }]
    : HULLO_FILTERS
  const menuKey = items.map((item) => item.id).join("|")
  const wired = Boolean(getCheckout) || Boolean(shopCart)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const live = cartRef.current
    return mountHullo(root, {
      ...(getCheckout
        ? { getCheckout: () => checkoutRef.current?.() ?? null }
        : {}),
      ...(live
        ? {
            shopCart: {
              addProduct: (productId) =>
                cartRef.current?.addProduct(productId) ?? Promise.resolve(false),
              setQuantity: (itemId, quantity) =>
                cartRef.current?.setQuantity(itemId, quantity) ??
                Promise.resolve(false),
              removeLine: (itemId) =>
                cartRef.current?.removeLine(itemId) ?? Promise.resolve(false),
              goCheckout: () =>
                cartRef.current?.goCheckout() ?? Promise.resolve(false),
              formatCents: (cents) => cartRef.current?.formatCents(cents) ?? "",
            },
          }
        : {}),
    })
    // The handlers live on a ref so a new callback does not restart the scene.
    // A new menu does: the cards are read once into the tray's catalogue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuKey, wired])

  return (
    <div
      ref={rootRef}
      className={`hullo-tpl js ${fonts}`}
      lang="en"
      data-currency={currency}
    >
      <Loader />
      <div className="grain" aria-hidden="true" />

      <header className="nav" id="nav">
        <a className="nav-mark" href="#top" data-go="#top" aria-label="hullo, back to the top">
          hullo
        </a>
        <div className="nav-right">
          <button className="pill pill-ghost pill-icon lights" type="button" aria-pressed="false" aria-label="Turn the lights off">
            <span className="pour" aria-hidden="true" />
            <Icon name="moon" className="ico-moon" />
            <Icon name="sun" className="ico-sun" />
          </button>
          <button className="pill pill-dark order-pill" type="button" aria-haspopup="dialog" aria-controls="tray">
            <span className="pour" aria-hidden="true" />
            <span className="pill-label">order</span>
            <span className="count" aria-live="polite">
              <span className="sr-only">items: </span>
              <b>0</b>
            </span>
          </button>
          <button className="pill pill-ghost pill-icon burger" type="button" aria-expanded="false" aria-controls="shutter" aria-label="Open the menu">
            <span className="burger-lines" aria-hidden="true">
              <i />
              <i />
            </span>
          </button>
        </div>
      </header>

      <div className="shutter" id="shutter" aria-hidden="true" inert>
        <div className="shutter-slats" aria-hidden="true" />
        <nav className="shutter-links" aria-label="Sections">
          <a href="#menu" data-go="#menu">the menu</a>
          <a href="#build" data-go="#build">build a cup</a>
          <a href="#roll" data-go="#roll">camera roll</a>
          <a href="#visit" data-go="#visit">come say hullo</a>
        </nav>
        <p className="shutter-foot">the window opens at 7. the shutter goes up when you close this.</p>
        <span className="shutter-handle" aria-hidden="true" />
      </div>

      <main>
        <Hero items={items} stickerIds={stickerIds} />
        <Menu items={items} filters={filterRows} currency={currency} />
        <Build />
        <div className="mq-wrap" aria-hidden="true">
          <div className="marquee">
            <div className="mq-track">
              {HULLO_MARQUEE.map((line) => (
                <span key={line} style={{ display: "contents" }}>
                  <span>{line}</span>
                  <Icon name="asterisk" />
                </span>
              ))}
            </div>
          </div>
        </div>
        <Roll />
        <Visit />
      </main>

      <footer className="foot">
        <p className="foot-mark" aria-label="hullo">
          {WORD.map((letter, index) => (
            <span key={index}>{letter}</span>
          ))}
        </p>
        <div className="foot-row">
          <nav className="foot-links" aria-label="Footer">
            <a href="#menu" data-go="#menu">menu</a>
            <a href="#build" data-go="#build">build a cup</a>
            <a href="#roll" data-go="#roll">camera roll</a>
            <a href="#visit" data-go="#visit">visit</a>
          </nav>
          <p className="foot-small">&copy; 2026 hullo. a coffee window, not a cafe.</p>
        </div>
      </footer>

      <Tray currency={currency} shopCheckout={wired} />
      <div className="flyer-layer" aria-hidden="true" />
    </div>
  )
}

function Loader() {
  return (
    <div className="loader" id="loader" aria-hidden="true">
      <div className="ld-center">
        <svg className="ld-cup" viewBox="0 0 200 260" aria-hidden="true">
          <defs>
            <clipPath id="ldClip">
              <path d="M34 44 L166 44 L150 238 Q149 248 139 248 L61 248 Q51 248 50 238 Z" />
            </clipPath>
          </defs>
          <g clipPath="url(#ldClip)">
            <rect className="ld-milk" x="0" y="248" width="200" height="260" />
            <path className="ld-liquid" d="M0 248 Q50 240 100 248 T200 248 L200 520 L0 520 Z" />
            <g className="ld-ice">
              <rect x="66" y="130" width="30" height="30" rx="7" transform="rotate(-12 81 145)" />
              <rect x="104" y="112" width="28" height="28" rx="7" transform="rotate(14 118 126)" />
              <rect x="84" y="170" width="26" height="26" rx="7" transform="rotate(4 97 183)" />
            </g>
          </g>
          <path className="ld-outline" d="M34 44 L166 44 L150 238 Q149 248 139 248 L61 248 Q51 248 50 238 Z" />
          <rect className="ld-lid" x="26" y="32" width="148" height="14" rx="7" />
          <g className="ld-straw">
            <rect x="112" y="-40" width="12" height="190" rx="6" transform="rotate(12 118 55)" />
          </g>
        </svg>
        <p className="ld-count">
          <span className="ld-n">0</span>
          <span className="ld-pc">%</span>
        </p>
        <p className="ld-status">grinding the beans</p>
      </div>
      <div className="ld-flood">
        <svg className="ld-wave ld-wave-top" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 60 L0 30 Q75 0 150 30 T300 30 T450 30 T600 30 T750 30 T900 30 T1050 30 T1200 30 L1200 60 Z" />
        </svg>
        <div className="ld-body" />
        <svg className="ld-wave ld-wave-bot" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 0 L0 30 Q75 60 150 30 T300 30 T450 30 T600 30 T750 30 T900 30 T1050 30 T1200 30 L1200 0 Z" />
        </svg>
      </div>
    </div>
  )
}

function Hero({
  items,
  stickerIds,
}: {
  items: readonly HulloItem[]
  stickerIds: readonly string[]
}) {
  return (
    <section className="scene" id="top" aria-label="hullo, a coffee window">
      <div className="stage">
        <div className="haze" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="frame" aria-hidden="true">
          <div className="interior">
            <div className="zin">
              <img src={HULLO_ART.interior.src} alt="" width={HULLO_ART.interior.width} height={HULLO_ART.interior.height} />
            </div>
          </div>
          <div className="world">
            <div className="zin">
              <div className="win-shade" />
              <img className="wall" src={HULLO_ART.storefront.src} alt="" width={HULLO_ART.storefront.width} height={HULLO_ART.storefront.height} />
              <div className="win-glow" />
            </div>
            <div className="sign-ghost">
              {WORD.map((letter, index) => (
                <span key={index}>{letter}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="hero-copy">
          <h1 className="wordmark" aria-label="hullo">
            {WORD.map((letter, index) => (
              <span className="wm-l" data-i={index} key={index}>
                <span className="wm-i">{letter}</span>
              </span>
            ))}
          </h1>
          <div className="hero-side">
            <p className="blurb">a tiny coffee window in a big cream wall. iced everything, oat by default, pastries until they run out.</p>
            <div className="cta-row">
              <a className="pill pill-dark pill-lg" href="#menu" data-go="#menu">
                <span className="pour" aria-hidden="true" />
                <span className="pill-label">see the menu</span>
              </a>
              <a className="pill pill-ghost pill-lg" href="#build" data-go="#build">
                <span className="pour" aria-hidden="true" />
                <span className="pill-label">build a cup</span>
              </a>
            </div>
          </div>
          <div className="badge" aria-live="polite">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <path id="hullo-ring" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
              </defs>
              <text>
                <textPath href="#hullo-ring">say hullo through the window . say hullo through the window .</textPath>
              </text>
            </svg>
            <span className="badge-state">open</span>
          </div>
        </div>
        <div className="stickers">
          {stickerIds.map((id) => {
            const item = items.find((row) => row.id === id)
            if (!item) return null
            return (
              <button key={id} className="stk" type="button" data-item={id} style={{ "--bg": item.bg } as CSSProperties}>
                <img src={item.image.src} alt="" draggable={false} />
                <span>{item.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Menu({
  items,
  filters,
  currency,
}: {
  items: readonly HulloItem[]
  filters: readonly { id: string; label: string }[]
  currency: string
}) {
  return (
    <section className="menu" id="menu" aria-labelledby="menu-h">
      <div className="menu-head">
        <h2 id="menu-h" className="hand-h menu-h">
          <span>ok.</span> <span>what are we</span> <span>sipping?</span>
        </h2>
        <div className="filters" role="group" aria-label="Filter the menu">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={filter.id === "all" ? "chip is-on" : "chip"}
              type="button"
              data-f={filter.id}
              aria-pressed={filter.id === "all"}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p className="menu-note">oat milk costs nothing extra. ever.</p>
      </div>
      <ul className="cards" id="cards">
        {items.map((item) => (
          <li
            key={item.id}
            className="card"
            data-id={item.id}
            data-price={item.price}
            data-tags={item.tags}
            data-stock={item.inStock === false ? "0" : "1"}
            style={cardStyle(item)}
          >
            <div className="card-in">
              <figure className="card-ph">
                <img src={item.image.src} alt={item.alt} width={item.image.width} height={item.image.height} loading="lazy" decoding="async" />
              </figure>
              <div className="card-b">
                <h3>{item.name}</h3>
                <p>{item.blurb}</p>
                <div className="card-f">
                  <span className="price">
                    {item.price} <small>{currency}</small>
                  </span>
                  <button className="add" type="button" aria-label={`Add ${item.name} to your order`}>
                    <Icon name="plus" />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Chip({ id, label, on }: { id: string; label: string; on: boolean }) {
  return (
    <button type="button" className="chip" role="radio" data-v={id} aria-checked={on} tabIndex={on ? 0 : -1}>
      {label}
    </button>
  )
}

function Build() {
  return (
    <section className="build" id="build" aria-labelledby="build-h">
      <div className="build-cup">
        <svg className="cup" viewBox="0 0 320 460" role="img" aria-labelledby="cup-name">
          <defs>
            <clipPath id="hullo-cup-clip">
              <path d="M58 92 L262 92 L238 420 Q236 440 216 440 L104 440 Q84 440 82 420 Z" />
            </clipPath>
            <filter id="hullo-soft" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="0 5" />
            </filter>
            <linearGradient id="hullo-glass" x1="0" x2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".55" />
              <stop offset=".18" stopColor="#fff" stopOpacity=".05" />
              <stop offset=".8" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#fff" stopOpacity=".35" />
            </linearGradient>
          </defs>
          <ellipse className="cup-shadow" cx="160" cy="448" rx="120" ry="12" />
          <g clipPath="url(#hullo-cup-clip)">
            <g filter="url(#hullo-soft)" className="layers">
              <rect className="ly ly-syrup" x="40" y="440" width="240" height="0" />
              <rect className="ly ly-milk" x="40" y="440" width="240" height="0" />
              <path className="ly ly-top" d="" />
            </g>
            <rect className="pour-stream" x="152" y="-40" width="16" height="0" rx="8" />
            <g className="ice" />
            <path className="foam" d="" />
            <rect x="40" y="80" width="240" height="380" fill="url(#hullo-glass)" />
          </g>
          <path className="cup-body" d="M58 92 L262 92 L238 420 Q236 440 216 440 L104 440 Q84 440 82 420 Z" />
          <path className="cup-lid" d="M44 94 Q44 78 60 78 L260 78 Q276 78 276 94 Z" />
          <path className="cup-dome" d="M52 80 Q160 -6 268 80 Z" />
          <rect className="cup-straw" x="182" y="-30" width="18" height="260" rx="9" transform="rotate(11 191 100)" />
        </svg>
        <div className="cup-tag" aria-live="polite">
          <p className="cup-name" id="cup-name">
            iced oat latte
          </p>
          <p className="cup-cap">focus mode, but make it creamy.</p>
        </div>
      </div>
      <div className="build-panel">
        <h2 id="build-h" className="hand-h">
          build a cup.
        </h2>
        <p className="build-sub">tap until it looks right. we name it, you drink it.</p>
        <div className="ctl">
          <p className="ctl-l" id="l-vibe">
            vibe check
          </p>
          <div className="chips chips-vibe" role="group" aria-labelledby="l-vibe" data-group="vibe">
            {HULLO_VIBES.map((vibe) => (
              <button key={vibe.id} type="button" className={vibe.id === "locked" ? "chip is-on" : "chip"} data-v={vibe.id}>
                {vibe.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ctl">
          <p className="ctl-l" id="l-base">
            base
          </p>
          <div className="chips" role="radiogroup" aria-labelledby="l-base" data-group="base">
            {HULLO_BASES.map((base) => (
              <Chip key={base.id} id={base.id} label={base.label} on={base.id === "espresso"} />
            ))}
          </div>
        </div>
        <div className="ctl">
          <p className="ctl-l" id="l-milk">
            milk
          </p>
          <div className="chips" role="radiogroup" aria-labelledby="l-milk" data-group="milk">
            {HULLO_MILKS.map((milk) => (
              <Chip key={milk.id} id={milk.id} label={milk.label} on={milk.id === "oat"} />
            ))}
          </div>
        </div>
        <div className="ctl">
          <p className="ctl-l" id="l-sweet">
            sweet
          </p>
          <div className="chips" role="radiogroup" aria-labelledby="l-sweet" data-group="sweet">
            {HULLO_SWEETS.map((sweet) => (
              <Chip key={sweet.id} id={sweet.id} label={sweet.label} on={sweet.id === "none"} />
            ))}
          </div>
        </div>
        <div className="ctl ctl-row">
          <div>
            <p className="ctl-l" id="l-ice">
              ice
            </p>
            <div className="chips" role="radiogroup" aria-labelledby="l-ice" data-group="ice">
              {HULLO_ICES.map((ice) => (
                <Chip key={ice.id} id={ice.id} label={ice.label} on={ice.id === "2"} />
              ))}
            </div>
          </div>
          <div>
            <p className="ctl-l" id="l-size">
              size
            </p>
            <div className="chips" role="radiogroup" aria-labelledby="l-size" data-group="size">
              {HULLO_SIZES.map((size) => (
                <Chip key={size.id} id={size.id} label={size.label} on={size.id === "m"} />
              ))}
            </div>
          </div>
        </div>
        <div className="ctl">
          <button type="button" className="switch" role="switch" aria-checked="false" data-group="foam">
            <span className="switch-knob" aria-hidden="true" />
            cold foam on top
          </button>
        </div>
        <div className="build-foot">
          <p className="build-price">
            <span className="bp-n">17</span> <small>SAR</small>
          </p>
          <button type="button" className="pill pill-dark pill-lg add-cup">
            <span className="pour" aria-hidden="true" />
            <span className="pill-label">add to order</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function Roll() {
  return (
    <section className="roll" id="roll" aria-labelledby="roll-h">
      <div className="roll-head">
        <h2 id="roll-h" className="hand-h">
          from the camera roll.
        </h2>
        <p className="roll-sub">shot on a cheap flash camera. move them around, tap one to take it again.</p>
      </div>
      <div className="roll-table">
        {HULLO_SNAPS.map((snap) => (
          <figure key={snap.caption} className="snap" style={{ "--r": snap.r, "--x": snap.x, "--y": snap.y } as CSSProperties}>
            <div className="snap-img">
              <img src={snap.src.src} alt={snap.alt} width={snap.src.width} height={snap.src.height} draggable={false} loading="lazy" decoding="async" />
              <span className="snap-flash" />
            </div>
            <figcaption>{snap.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

function Visit() {
  return (
    <section className="visit" id="visit" aria-labelledby="visit-h">
      <div className="hang">
        <span className="hang-nail" aria-hidden="true" />
        <button className="hang-sign" type="button" aria-label="Flip the sign to see the hours">
          <svg className="hang-strings" viewBox="0 0 300 90" aria-hidden="true">
            <path d="M150 4 L40 88 M150 4 L260 88" />
          </svg>
          <span className="hang-board">
            <span className="hang-face hang-front">
              <b className="hang-state">open</b>
              <small className="hang-sub">come up to the window</small>
            </span>
            <span className="hang-face hang-back">
              <b>hours</b>
              <small>
                sat to thu, 7am to 11pm
                <br />
                fri, 2pm to 1am
              </small>
            </span>
          </span>
        </button>
      </div>
      <div className="visit-copy">
        <h2 id="visit-h" className="hand-h">
          come say hullo.
        </h2>
        <p>we&apos;re a window in a wall in riyadh. look for the yellow tiles. walk-up only, no seats, the pavement is the lounge.</p>
        <ul className="hours">
          <li>
            <span>sat to thu</span>
            <b>7am to 11pm</b>
          </li>
          <li>
            <span>friday</span>
            <b>2pm to 1am</b>
          </li>
        </ul>
        <p className="now" aria-live="polite" />
      </div>
    </section>
  )
}

function Tray({
  currency,
  shopCheckout,
}: {
  currency: string
  shopCheckout: boolean
}) {
  return (
    <>
      <div className="tray-scrim" hidden />
      <aside className="tray" id="tray" role="dialog" aria-modal="true" aria-labelledby="tray-h" aria-hidden="true" inert>
        <div className="receipt">
          <div className="rc-head">
            <p className="rc-mark" id="tray-h">
              hullo
            </p>
            <p className="rc-mono">your order</p>
            <button className="rc-close" type="button" aria-label="Close your order">
              <Icon name="x" />
            </button>
          </div>
          <div className="rc-body">
            <ul className="rc-items" />
            <p className="rc-empty">nothing here yet. the menu is right there.</p>
            <div className="rc-total">
              <span>total</span>
              <b>
                <span className="rc-sum">0</span> {currency}
              </b>
            </div>
            <form className="rc-form" method="post" noValidate onSubmit={(event) => event.preventDefault()}>
              {shopCheckout ? null : (
                <>
                  <label htmlFor="pickup">name for the cup</label>
                  <input id="pickup" name="pickup" type="text" autoComplete="off" maxLength={18} placeholder="e.g. noor" />
                </>
              )}
              <p className="rc-err" role="alert" />
              <button className="pill pill-dark pill-lg rc-send" type="submit">
                <span className="pour" aria-hidden="true" />
                <span className="pill-label">send to the window</span>
              </button>
            </form>
          </div>
          <div className="rc-ticket" hidden>
            <p className="rc-mono">pickup ticket</p>
            <p className="rc-num">#000</p>
            <p className="rc-for" />
            <p className="rc-mono rc-note">demo site. nothing was charged and nobody is making this. we&apos;re sorry too.</p>
            <button className="pill pill-ghost pill-lg rc-again" type="button">
              <span className="pour" aria-hidden="true" />
              <span className="pill-label">start over</span>
            </button>
          </div>
          <div className="rc-tear" aria-hidden="true" />
        </div>
      </aside>
    </>
  )
}
