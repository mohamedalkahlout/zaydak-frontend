"use client"

import Lenis from "lenis"
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type Ref } from "react"

import { openingArt } from "./art"
import { AlarmLoader } from "./components/alarm-loader"
import { BagSheet } from "./components/bag-sheet"
import { BakeBoard } from "./components/bake-board"
import { ClosingShutter, type ClosingHandle } from "./components/closing-shutter"
import { MenuRoll } from "./components/menu-roll"
import { Street } from "./components/street"
import { TemplateNav } from "./components/template-nav"
import { VisitCard } from "./components/visit-card"
import { DOUGHN_CONTENT } from "./content"
import s from "./doughn.module.css"
import { setFakeMinutes } from "./lib/clock"
import { clamp, ease, prefersReducedMotion, tween } from "./lib/motion"
import { createStoryStore, useMediaQuery, useTemplateLang } from "./lib/stores"
import type { SceneFrame, StreetScene } from "./scene/street-scene"
import type { DoughnContent, Lang } from "./types"

/** Drives the template to exact states, for screenshot scripts and tests. */
export interface DoughnTemplateHandle {
  setP(p: number): void
  setScroll(share: number): void
  state(): { p: number; lift: number; lang: Lang; bag: Record<string, number>; revealed: boolean; zmax: number; b: number }
  openMenu(): void
  closeMenu(): void
  openBag(): void
  closeBag(): void
  addItem(id: string): void
  setLang(lang: Lang): void
  /** "hh:mm" in shop time, or null to follow the real clock */
  setNow(hhmm: string | null): void
  reveal(): void
}

interface DoughnTemplateProps {
  content?: DoughnContent
  /** Family names from the app's `next/font` load. The package does not call next/font. */
  fonts: CSSProperties
  ref?: Ref<DoughnTemplateHandle>
}

/**
 * doughn: a one-page bakery storefront that opens like a shop at 4 a.m.
 *
 * The page scroll drives a scene (the shutter rolls up, the sun rises, the camera
 * walks in and the loaves fly to the bake board), then the board, a visit card and a
 * closing shutter. It owns the window's scroll (Lenis on desktop, native on touch),
 * so it renders as a whole page, never inside a scroll container.
 */
export function DoughnTemplate({ content = DOUGHN_CONTENT, fonts, ref }: DoughnTemplateProps) {
  const [lang, setLang] = useTemplateLang(content.defaultLang)
  const copy = content.copy[lang]
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [story] = useState(createStoryStore)
  const [revealed, setRevealed] = useState(false)
  const [bag, setBag] = useState<Record<string, number>>({})
  const [menu, setMenu] = useState({ open: false, instant: false })
  const [bagOpen, setBagOpen] = useState(false)

  const sceneRef = useRef<StreetScene | null>(null)
  const boardRef = useRef<HTMLElement>(null)
  const visitRef = useRef<HTMLElement>(null)
  const closingRef = useRef<ClosingHandle>(null)
  const navTimeRef = useRef<HTMLElement>(null)
  const bagPillRef = useRef<HTMLButtonElement>(null)
  const flyersRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const page = useRef({ docMax: 1, vh: 0, relayout: () => {} })

  /* ---------- scrolling */
  const scrollY = useCallback(() => lenisRef.current?.scroll ?? window.scrollY, [])
  const jump = useCallback((y: number) => {
    const lenis = lenisRef.current
    const to = clamp(y, 0, page.current.docMax)
    if (lenis) lenis.scrollTo(to, { immediate: true, force: true })
    else window.scrollTo(0, to)
  }, [])
  const glide = useCallback((y: number, duration = 1.6) => {
    const lenis = lenisRef.current
    if (lenis) lenis.scrollTo(y, { duration, force: true, immediate: prefersReducedMotion() })
    else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? "auto" : "smooth" })
  }, [])

  // the scene reports story time and the caption on every frame; only changes reach React
  const onFrame = useCallback(
    ({ p, minutes, caption }: SceneFrame) => {
      const handoff = sceneRef.current?.handoff ?? 0.8
      story.set({ minute: Math.round(minutes), mark: p > 0.5, caption, live: p >= handoff })
    },
    [story],
  )

  useLayoutEffect(() => {
    const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches
    const rm = prefersReducedMotion()
    const pageState = page.current

    // read on every call: the street rebuilds its scene when the breads change
    let closingQ = -1
    const onScroll = () => {
      const scene = sceneRef.current
      if (!scene) return
      const y = scrollY()
      const p = rm ? 0.3 : scene.progressAt(y)
      scene.render(p)
      // the closing shutter: the last screen of the page pulls it down
      let q = clamp(1 - (pageState.docMax - y) / (pageState.vh * 0.95))
      if (rm) q = q > 0.6 ? 1 : 0
      if (q !== closingQ) {
        closingQ = q
        closingRef.current?.set(q)
      }
      // dark nav type over the light sections
      const overLight = rm ? (visitRef.current?.getBoundingClientRect().top ?? 1e9) < 40 : p > scene.handoff + 0.07
      story.set({ light: overLight && q < 0.5 })
    }

    const relayout = () => {
      pageState.vh = window.innerHeight
      sceneRef.current?.layout()
      pageState.docMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      onScroll()
    }
    pageState.relayout = relayout

    // smooth wheel scrolling on desktop; touch keeps the platform's own
    const lenis = touch || rm ? null : new Lenis({ lerp: 0.14, wheelMultiplier: 1.1 })
    lenisRef.current = lenis
    let raf = 0
    if (lenis) {
      lenis.on("scroll", onScroll)
      lenis.stop() // until the alarm has rung
      const loop = (time: number) => {
        lenis.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }
    const onNativeScroll = () => {
      if (!lenis) onScroll()
    }
    window.addEventListener("scroll", onNativeScroll, { passive: true })

    let lastW = 0
    let lastH = 0
    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (touch && w === lastW && Math.abs(h - lastH) < 2) return // only the URL bar sliding
      lastW = w
      lastH = h
      relayout()
    }
    window.addEventListener("resize", onResize)
    const grown = new ResizeObserver(() => {
      if (Math.max(1, document.documentElement.scrollHeight - window.innerHeight) !== pageState.docMax) relayout()
    })
    grown.observe(document.body)
    let fontsAlive = true
    document.fonts?.ready.then(() => fontsAlive && relayout())

    const restoration = history.scrollRestoration
    history.scrollRestoration = "manual"
    window.scrollTo(0, 0)
    relayout()

    return () => {
      fontsAlive = false
      cancelAnimationFrame(raf)
      lenis?.destroy()
      lenisRef.current = null
      window.removeEventListener("scroll", onNativeScroll)
      window.removeEventListener("resize", onResize)
      grown.disconnect()
      history.scrollRestoration = restoration
      pageState.relayout = () => {}
    }
  }, [scrollY, story])

  // the words change size with the language (and the content): measure again once laid out
  useLayoutEffect(() => {
    page.current.relayout()
    const id = requestAnimationFrame(() => page.current.relayout())
    return () => cancelAnimationFrame(id)
  }, [lang, content])

  // the page holds still under the alarm and under an open sheet
  const locked = !revealed || menu.open || bagOpen
  useEffect(() => {
    const lenis = lenisRef.current
    if (locked) lenis?.stop()
    else lenis?.start()
  }, [locked])

  useEffect(() => {
    if (revealed) return
    const html = document.documentElement
    const before = [html.style.overflow, document.body.style.overflow]
    html.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      html.style.overflow = before[0]
      document.body.style.overflow = before[1]
    }
  }, [revealed])

  useEffect(() => {
    if (revealed) sceneRef.current?.lightSign()
  }, [revealed])

  /* ---------- the bag and the menu */
  const openMenu = useCallback(() => setMenu({ open: true, instant: false }), [])
  const closeMenu = useCallback((instant = false) => setMenu((m) => (m.open ? { open: false, instant } : m)), [])
  const openBag = useCallback(() => {
    setMenu((m) => (m.open ? { open: false, instant: true } : m))
    setBagOpen(true)
  }, [])
  const closeBag = useCallback(() => setBagOpen(false), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      closeMenu()
      closeBag()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [closeMenu, closeBag])

  const addToBag = useCallback(
    (id: string, from: HTMLImageElement | null) => {
      const pill = bagPillRef.current
      const commit = () => {
        setBag((b) => ({ ...b, [id]: (b[id] ?? 0) + 1 }))
        if (pill) {
          pill.removeAttribute("data-bump")
          void pill.offsetWidth // restart the animation
          pill.setAttribute("data-bump", "")
        }
      }
      const layer = flyersRef.current
      if (!from || !pill || !layer || prefersReducedMotion()) return commit()
      // the loaf leaves its card and drops into the bag: x eases in and out while y
      // swings up a little and then falls, so it travels in an arc
      const a = from.getBoundingClientRect()
      const b = pill.getBoundingClientRect()
      const flyer = from.cloneNode() as HTMLImageElement
      flyer.removeAttribute("data-bread")
      flyer.className = s.flyer
      flyer.style.width = `${a.width}px`
      flyer.style.height = `${a.height}px`
      layer.appendChild(flyer)
      const dx = b.left + b.width / 2 - (a.left + a.width / 2)
      const dy = b.top + b.height / 2 - (a.top + a.height / 2)
      const spin = lang === "ar" ? -28 : 28
      const alongY = ease.backIn(1.6)
      const move = tween(
        0.8,
        ease.linear,
        (k) => {
          const shrink = ease.cubicIn(k)
          flyer.style.transform = `translate(${(a.left + dx * ease.quadInOut(k)).toFixed(1)}px,${(a.top + dy * alongY(k)).toFixed(1)}px) rotate(${(spin * shrink).toFixed(2)}deg) scale(${(1 - 0.84 * shrink).toFixed(3)})`
        },
        () => {
          flyer.remove()
          commit()
        },
      )
      setTimeout(move.finish, 1600) // rAF sleeps in background tabs
    },
    [lang],
  )

  const changeQty = useCallback((id: string, delta: number) => {
    setBag((b) => {
      const next = { ...b, [id]: (b[id] ?? 0) + delta }
      if (next[id] <= 0) delete next[id]
      return next
    })
  }, [])
  const clearBag = useCallback(() => setBag({}), [])

  const toggleLang = useCallback(() => setLang(lang === "ar" ? "en" : "ar"), [lang, setLang])

  // in-page links glide instead of jumping
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const link = (e.target as Element).closest('a[href^="#"]')
    if (!link) return
    e.preventDefault()
    const id = link.getAttribute("href")!.slice(1)
    closeMenu(true)
    requestAnimationFrame(() => {
      const target = id === "top" ? null : document.getElementById(id)
      glide(target ? target.getBoundingClientRect().top + scrollY() : 0)
    })
  }

  const handle: DoughnTemplateHandle = {
    setP: (p) => {
      const scene = sceneRef.current
      if (!scene) return
      jump(scene.scrollFor(clamp(p)))
      page.current.relayout()
    },
    setScroll: (share) => {
      jump(clamp(share) * page.current.docMax)
      page.current.relayout()
    },
    state: () => ({
      p: sceneRef.current?.p ?? 0,
      lift: sceneRef.current?.lift ?? 0,
      lang,
      bag,
      revealed,
      zmax: sceneRef.current?.zMax ?? 0,
      b: sceneRef.current?.base ?? 0,
    }),
    openMenu,
    closeMenu: () => closeMenu(true),
    openBag,
    closeBag,
    addItem: (id) => addToBag(id, null),
    setLang,
    setNow: (hhmm) => {
      if (hhmm === null) return setFakeMinutes(null)
      const [h, m] = hhmm.split(":").map(Number)
      setFakeMinutes(h * 60 + m)
    },
    reveal: () => setRevealed(true),
  }
  useImperativeHandle(ref, () => handle)

  // outside production the handle is also on window, for the screenshot scripts
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as { __site?: DoughnTemplateHandle }
    w.__site = handle
    return () => {
      if (w.__site === handle) delete w.__site
    }
  })

  return (
    <div
      className={s.root}
      style={fonts}
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      data-rm={reducedMotion ? "" : undefined}
      onClick={onClick}
    >
      <AlarmLoader
        note={copy.loader}
        art={openingArt(content.images)}
        targetRef={navTimeRef}
        gone={revealed}
        onDone={() => setRevealed(true)}
      />
      <TemplateNav
        brand={content.brand}
        copy={copy}
        lang={lang}
        timeZone={content.timeZone}
        story={story}
        bagCount={Object.values(bag).reduce((n, q) => n + q, 0)}
        menuOpen={menu.open}
        onToggleLang={toggleLang}
        onBag={openBag}
        onMenu={() => (menu.open ? closeMenu() : openMenu())}
        timeRef={navTimeRef}
        bagRef={bagPillRef}
      />
      <main>
        <Street
          brand={content.brand}
          copy={copy}
          itemIds={content.items.map((item) => item.id)}
          images={Object.fromEntries(content.items.filter((item) => item.image).map((item) => [item.id, item.image]))}
          scene={content.images}
          story={story}
          sceneRef={sceneRef}
          boardRef={boardRef}
          scrollY={scrollY}
          scrollTo={jump}
          onFrame={onFrame}
          onReserve={openBag}
        />
        <BakeBoard ref={boardRef} content={content} copy={copy} lang={lang} bag={bag} onAdd={addToBag} />
        <VisitCard ref={visitRef} content={content} copy={copy} onReserve={openBag} />
      </main>
      <ClosingShutter ref={closingRef} content={content} copy={copy} onOpenAgain={() => glide(0, 3.2)} />
      <MenuRoll open={menu.open} instant={menu.instant} copy={copy} onClose={() => closeMenu()} onReserve={openBag} />
      <BagSheet open={bagOpen} content={content} copy={copy} lang={lang} bag={bag} onClose={closeBag} onQty={changeQty} onClear={clearBag} />
      <div ref={flyersRef} className={s.flyers} aria-hidden />
    </div>
  )
}
