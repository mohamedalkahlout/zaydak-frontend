"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react"

import { RAIL_PIECES, railImageSrc, type RailPiece } from "./catalog"
import { GarmentCanvas } from "./garment-canvas"
import { placeRail, railFocusCenters } from "./layout"
import { handoffOffset, mobileFocus, springStep } from "./motion"

import "./rail.css"

const NARROW_QUERY = "(max-width: 700px)"

function subscribeNarrow(onStoreChange: () => void) {
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener("change", onStoreChange)
  return () => query.removeEventListener("change", onStoreChange)
}

function useNarrow() {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  )
}

function pad(index: number) {
  return String(index + 1).padStart(2, "0")
}

/**
 * A clothing rail. Pieces hang in profile; hovering one turns it to face
 * you and the others step aside. A click opens that piece. On a narrow
 * screen, swipe moves along the rail and the piece in the middle faces you.
 */
export function RailTemplate({ pieces = RAIL_PIECES }: { pieces?: RailPiece[] } = {}) {
  const narrow = useNarrow()
  const rackRef = useRef<HTMLDivElement>(null)
  const garmentsRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDialogElement>(null)
  const menuRef = useRef<HTMLDialogElement>(null)
  const intent = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drag = useRef<{
    x: number
    lastX: number
    lastAt: number
    velocity: number
    moved: boolean
  } | null>(null)
  const placeRef = useRef<() => void>(() => {})
  const suppressClick = useRef(false)
  const focusRef = useRef(0)
  const slide = useRef({ offset: 0, velocity: 0, raf: 0, last: 0 })
  const [active, setActive] = useState(-1)
  const [focus, setFocus] = useState(0)
  const [sliding, setSliding] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [face, setFace] = useState<"front" | "back">("front")
  const [menuOpen, setMenuOpen] = useState(false)
  focusRef.current = focus

  const detail = pieces.find((piece) => piece.id === detailId) ?? null
  const shown = narrow ? focus : active
  const caption = shown >= 0 ? pieces[shown] : null

  useEffect(() => {
    const rack = rackRef.current
    const garments = garmentsRef.current
    if (!rack || !garments) return
    const place = () => {
      const width = garments.getBoundingClientRect().width
      if (width <= 0) return
      const buttons = [...garments.querySelectorAll<HTMLButtonElement>(".garment")]
      const fitted = narrow
        ? null
        : placeRail({
            width,
            count: buttons.length,
            active,
            gap: 18,
            maxHeight: Math.min(455, window.innerHeight * 0.42),
            profileRatio: 0.22,
            frontRatio: 0.72,
          })
      const stride = Math.min(width * 0.62, 220)
      const centers = fitted
        ? fitted.centers
        : railFocusCenters(width, buttons.length, focus, stride, slide.current.offset)
      if (fitted) rack.style.setProperty("--garment-h", `${fitted.height}px`)
      buttons.forEach((button, index) => {
        const center = centers[index]
        if (center == null) return
        button.style.setProperty("--x", `${center}px`)
        button.dataset.cx = String(center)
      })
    }
    placeRef.current = place
    place()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(place)
    observer.observe(garments)
    return () => observer.disconnect()
  }, [active, focus, narrow])

  useEffect(() => {
    const dialog = detailRef.current
    if (!dialog) return
    if (detailId && !dialog.open) dialog.showModal()
    if (!detailId && dialog.open) dialog.close()
  }, [detailId])

  useEffect(() => {
    const dialog = menuRef.current
    if (!dialog) return
    if (menuOpen && !dialog.open) dialog.showModal()
    if (!menuOpen && dialog.open) dialog.close()
  }, [menuOpen])

  useEffect(() => () => cancelAnimationFrame(slide.current.raf), [])

  function clearIntent() {
    if (intent.current != null) clearTimeout(intent.current)
    intent.current = null
  }

  function arm(index: number) {
    if (narrow) return
    clearIntent()
    intent.current = setTimeout(() => setActive(index), 80)
  }

  function openPiece(piece: RailPiece) {
    setFace("front")
    setDetailId(piece.id)
    setActive(-1)
  }

  function onRackMove(event: PointerEvent<HTMLDivElement>) {
    if (narrow || event.pointerType === "touch" || detailId) return
    const garments = garmentsRef.current
    if (!garments) return
    const local = event.clientX - garments.getBoundingClientRect().left
    let best = -1
    let bestDistance = Infinity
    for (const button of garments.querySelectorAll<HTMLButtonElement>(".garment")) {
      const center = Number(button.dataset.cx)
      const index = Number(button.dataset.index)
      const half =
        (index === active ? 0.36 : 0.14) *
        Number.parseFloat(getComputedStyle(rackRef.current!).getPropertyValue("--garment-h"))
      const distance = Math.abs(local - center)
      if (distance <= half + 16 && distance < bestDistance) {
        best = index
        bestDistance = distance
      }
    }
    if (best === active) {
      clearIntent()
      return
    }
    arm(best)
  }

  function strideOf() {
    const width = garmentsRef.current?.getBoundingClientRect().width ?? 0
    return Math.min(width * 0.62, 220)
  }

  function paintMobile(offset: number) {
    const garments = garmentsRef.current
    if (!garments) return
    const width = garments.getBoundingClientRect().width
    const centers = railFocusCenters(width, pieces.length, focusRef.current, strideOf(), offset)
    garments.querySelectorAll<HTMLButtonElement>(".garment").forEach((button, index) => {
      const center = centers[index]
      if (center == null) return
      button.style.setProperty("--x", `${center}px`)
      button.dataset.cx = String(center)
    })
  }

  function glideHome() {
    cancelAnimationFrame(slide.current.raf)
    setSliding(true)
    const tick = (now: number) => {
      const dt = slide.current.last ? now - slide.current.last : 16
      slide.current.last = now
      const next = springStep(slide.current.offset, slide.current.velocity, 0, dt)
      slide.current.offset = next.position
      slide.current.velocity = next.velocity
      paintMobile(next.position)
      if (next.position !== 0 || next.velocity !== 0) {
        slide.current.raf = requestAnimationFrame(tick)
        return
      }
      slide.current.last = 0
      setSliding(false)
    }
    slide.current.last = 0
    slide.current.raf = requestAnimationFrame(tick)
  }

  function land(next: number, delta: number) {
    const from = focusRef.current
    slide.current.offset = handoffOffset(delta, from, next, strideOf())
    slide.current.velocity = 0
    setFocus(next)
    glideHome()
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!narrow || !event.isPrimary) return
    cancelAnimationFrame(slide.current.raf)
    setSliding(true)
    drag.current = {
      x: event.clientX,
      lastX: event.clientX,
      lastAt: event.timeStamp,
      velocity: 0,
      moved: false,
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current) {
      onRackMove(event)
      return
    }
    const delta = event.clientX - current.x
    const elapsed = event.timeStamp - current.lastAt
    if (elapsed > 0) current.velocity = (event.clientX - current.lastX) / elapsed
    current.lastX = event.clientX
    current.lastAt = event.timeStamp
    if (!current.moved) {
      if (Math.abs(delta) < 8) return
      current.moved = true
      rackRef.current?.classList.add("is-dragging")
    }
    const width = garmentsRef.current?.getBoundingClientRect().width ?? 0
    const atStart = focusRef.current === 0 && delta > 0
    const atEnd = focusRef.current === pieces.length - 1 && delta < 0
    const offset =
      atStart || atEnd
        ? Math.sign(delta) * Math.min(Math.abs(delta) * 0.28, width * 0.22)
        : delta
    slide.current.offset = offset
    paintMobile(offset)
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    drag.current = null
    rackRef.current?.classList.remove("is-dragging")
    if (!current?.moved) {
      setSliding(false)
      return
    }
    suppressClick.current = true
    const delta = slide.current.offset
    const velocity = event.timeStamp - current.lastAt < 120 ? current.velocity : 0
    const next = mobileFocus(focusRef.current, pieces.length, delta, velocity, strideOf())
    land(next, delta)
    window.setTimeout(() => {
      suppressClick.current = false
    }, 350)
  }

  function step(direction: -1 | 1) {
    const next = Math.max(0, Math.min(pieces.length - 1, focusRef.current + direction))
    if (next === focusRef.current) return
    land(next, slide.current.offset)
  }

  return (
    <div className="rail-tpl">
      <header className="header">
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen(true)}>
          <i className="hamburger" />
          <span>Menu</span>
        </button>
        <button className="wordmark" type="button" onClick={() => setActive(-1)}>
          <i />
          RAIL
        </button>
        <p className="count-link">
          {shown >= 0
            ? `${pad(shown)} / ${String(pieces.length).padStart(2, "0")}`
            : `${pieces.length} pieces`}
        </p>
      </header>

      <main className="storefront">
        <div className="collection-line">
          <h1>On the rail</h1>
          <span>Molimao / Sarajevo</span>
        </div>
        <div
          ref={rackRef}
          className={narrow ? "rack mobile-rail" : "rack"}
          aria-label="Garment rail"
          onPointerLeave={() => {
            if (narrow) return
            clearIntent()
            setActive(-1)
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="rail" aria-hidden="true">
            <i />
            <i />
          </div>
          <div ref={garmentsRef} className="garments">
            {pieces.map((piece, index) => (
              <button
                key={piece.id}
                className={index === shown ? "garment is-active" : "garment"}
                type="button"
                data-index={index}
                aria-pressed={index === shown}
                aria-haspopup="dialog"
                aria-label={`Open ${piece.name}`}
                onClick={() => {
                  if (suppressClick.current) return
                  if (narrow && index !== focus) {
                    land(index, slide.current.offset)
                    return
                  }
                  openPiece(piece)
                }}
                onFocus={() => {
                  if (!narrow) setActive(index)
                }}
                onBlur={() => {
                  if (!narrow && active === index) setActive(-1)
                }}
              >
                <svg className="hook" viewBox="0 0 28 40" aria-hidden="true">
                  <path d="M14 2v30" fill="none" stroke="#746d63" strokeWidth="1.6" />
                  <path d="M14.4 2v30" fill="none" stroke="#eeebe3" strokeWidth="0.45" />
                </svg>
                <GarmentCanvas
                  src={railImageSrc(piece.side)}
                  turnSrc={
                    !narrow || Math.abs(index - focus) <= 1
                      ? railImageSrc(piece.turn)
                      : undefined
                  }
                  play={narrow ? index === focus && !sliding : index === active}
                  delay={narrow ? 110 : 0}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="rack-caption">
          <p className="active-label">
            {caption ? caption.name : "Turn a piece."}
            {caption ? <span>{caption.type}</span> : null}
          </p>
          <p className="gesture-hint">
            {narrow ? "Swipe to browse. Tap to open." : "Hover to turn. Click to open."}
          </p>
        </div>
        <nav className="rail-navigation" aria-label="Browse pieces" hidden={!narrow}>
          <button type="button" aria-label="Previous piece" disabled={focus === 0} onClick={() => step(-1)}>
            ←
          </button>
          <span className="rail-index">
            {pad(focus)} / {String(pieces.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            aria-label="Next piece"
            disabled={focus === pieces.length - 1}
            onClick={() => step(1)}
          >
            →
          </button>
        </nav>
      </main>

      <footer>
        <div className="brand-strip">
          <span>Turn a piece</span>
          <span>Open it</span>
          <span>On the rail</span>
        </div>
        <p className="study-note">Ten Molimao pieces. Hover turns one toward you.</p>
      </footer>

      <dialog
        ref={detailRef}
        className="detail"
        aria-labelledby="rail-detail-title"
        onClose={() => setDetailId(null)}
        onClick={(event) => {
          if (event.target === detailRef.current) setDetailId(null)
        }}
      >
        {detail ? (
          <>
            <button className="close-detail" type="button" onClick={() => setDetailId(null)}>
              Close <span aria-hidden="true">×</span>
            </button>
            <div className="detail-stage">
              <div className={face === "back" && detail.back ? "detail-card is-back" : "detail-card"}>
                <div className="detail-face">
                  <GarmentCanvas src={railImageSrc(detail.front)} />
                </div>
                {detail.back ? (
                  <div className="detail-face back">
                    <GarmentCanvas src={railImageSrc(detail.back)} />
                  </div>
                ) : null}
              </div>
            </div>
            <div className="detail-meta">
              <p className="detail-index">
                {pad(pieces.indexOf(detail))} / {String(pieces.length).padStart(2, "0")}
              </p>
              <h2 id="rail-detail-title">{detail.name}</h2>
              <p className="product-type">
                {detail.type}
                {detail.colorName ? ` · ${detail.colorName}` : ""}
              </p>
              {detail.href ? (
                <a className="detail-link" href={detail.href}>
                  {detail.name}
                </a>
              ) : null}
              <div className="detail-views" hidden={!detail.back}>
                <button type="button" aria-pressed={face === "front"} onClick={() => setFace("front")}>
                  Front
                </button>
                <button type="button" aria-pressed={face === "back"} onClick={() => setFace("back")}>
                  Back
                </button>
              </div>
            </div>
          </>
        ) : null}
      </dialog>

      <dialog
        ref={menuRef}
        className="menu"
        aria-label="Menu"
        onClose={() => setMenuOpen(false)}
      >
        <button className="menu-close" type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
          ×
        </button>
        <p className="wordmark">
          <i />
          RAIL
        </p>
        <nav>
          {pieces.map((piece, index) => (
            <button
              key={piece.id}
              type="button"
              onClick={() => {
                setMenuOpen(false)
                if (narrow) {
                  land(index, slide.current.offset)
                  return
                }
                setFocus(index)
                setActive(index)
              }}
            >
              {piece.name}
            </button>
          ))}
        </nav>
        <p>Turn a piece on the rail, then open it.</p>
      </dialog>
    </div>
  )
}
