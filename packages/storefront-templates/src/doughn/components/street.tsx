"use client"

/* eslint-disable @next/next/no-img-element -- the scene's layers are art placed in plate
   units inside zoomed, transformed planes; next/image's sizing and wrappers would fight that.
   All of it is bundled locally, so there is no remote host for the optimizer to protect. */

import { useLayoutEffect, useMemo, useRef, type CSSProperties, type RefObject } from "react"

import { ART, BREAD_ART } from "../art"
import shared from "../doughn.module.css"
import type { StoryStore } from "../lib/stores"
import { loafLayout, slatLayout } from "../scene/layout"
import { createStreetScene, type SceneFrame, type StreetScene } from "../scene/street-scene"
import type { BreadId, DoughnCopy, DoughnSceneImages } from "../types"
import { Captions } from "./captions"
import s from "./street.module.css"

const SLATS = slatLayout()

/** A merchant URL is safe to drop into a CSS `url()` only when it cannot escape the quotes. */
function shutterStyle(url: string | undefined): CSSProperties | undefined {
  if (!url || !/^https?:\/\//i.test(url) || /["'()\\\s]/.test(url)) return undefined
  return { "--doughn-shutter": `url("${url}")` } as CSSProperties
}

interface StreetProps {
  brand: string
  copy: DoughnCopy
  itemIds: BreadId[]
  /** Per-basket photo. Missing ids keep the bundled cut-out. */
  images?: Partial<Record<BreadId, string>>
  /** Shop photos. Missing fields keep the bundled plates, frame, doors, shutter and interior. */
  scene?: DoughnSceneImages
  story: StoryStore
  /** filled with the running scene for the template root */
  sceneRef: RefObject<StreetScene | null>
  boardRef: RefObject<HTMLElement | null>
  scrollY: () => number
  scrollTo: (y: number) => void
  onFrame: (frame: SceneFrame) => void
  onReserve: () => void
}

/**
 * The hero: the street at 4 a.m. Renders the scene's layers once and hands them to
 * the scroll engine (scene/street-scene.ts), which finds them by `data-scene` and
 * moves them on every scroll frame. Nothing here re-renders while scrolling.
 */
export function Street({ brand, copy, itemIds, images, scene, story, sceneRef, boardRef, scrollY, scrollTo, onFrame, onReserve }: StreetProps) {
  const heroRef = useRef<HTMLElement>(null)
  const loaves = useMemo(() => loafLayout(itemIds), [itemIds])
  const itemKey = itemIds.join(",")
  const captionKey = copy.caps.map(([at]) => at).join(",")

  // the engine is built once per set of breads; it reads the latest callback through a ref
  const onFrameRef = useRef(onFrame)
  useLayoutEffect(() => {
    onFrameRef.current = onFrame
  })

  useLayoutEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const scene = createStreetScene(hero, {
      itemIds: itemKey.split(",") as BreadId[],
      captionTimes: captionKey.split(",").map(Number),
      board: () => boardRef.current,
      scrollY,
      scrollTo,
      onFrame: (frame) => onFrameRef.current(frame),
    })
    sceneRef.current = scene
    // a mouse can also pull the shutter up by its bottom bar
    const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches
    const undrag = touch ? null : scene.enableDrag()
    return () => {
      undrag?.()
      scene.destroy()
      sceneRef.current = null
    }
  }, [itemKey, captionKey, boardRef, sceneRef, scrollY, scrollTo])

  return (
    <section ref={heroRef} className={s.hero} id="top" aria-label={copy.streetAria}>
      <h1 className={shared.srOnly}>{copy.h1}</h1>
      <div className={s.stage} data-scene="stage">
        <div className={s.interiorWindow} data-scene="interior-window">
          <div className={s.interior} data-scene="interior" aria-hidden>
            <div className={s.interiorBody} data-scene="interior-body">
              <img className={s.interiorPhoto} src={scene?.interior || ART.interior} alt="" width={2304} height={1536} />
              <i className={s.interiorTint} data-scene="interior-tint" />
              <i className={s.interiorFade} data-scene="interior-fade" />
              <div className={s.loaves} data-scene="loaves">
                {loaves.map((loaf) => (
                  <div
                    key={loaf.id}
                    className={s.basket}
                    data-scene="basket"
                    style={{ left: loaf.box.left, width: loaf.box.width, height: loaf.box.height }}
                  >
                    <i
                      className={s.basketShadow}
                      data-scene="basket-shadow"
                      style={{ left: loaf.shadow.left, width: loaf.shadow.width, top: loaf.shadow.top }}
                    />
                    <img
                      className={s.bread}
                      data-scene="bread"
                      src={images?.[loaf.id] || BREAD_ART[loaf.id]}
                      alt=""
                      style={{ left: loaf.img.left, top: loaf.img.top, width: loaf.img.width, height: loaf.img.height }}
                    />
                  </div>
                ))}
              </div>
              <div className={s.steam} data-scene="steam">
                <img className={`${s.puff} ${s.puff1}`} src={ART.steam} alt="" />
                <img className={`${s.puff} ${s.puff2}`} src={ART.steam} alt="" />
                <img className={`${s.puff} ${s.puff3}`} src={ART.steam} alt="" />
              </div>
            </div>
          </div>
        </div>

        <div className={s.street} data-scene="street" aria-hidden>
          <div className={s.streetBody} data-scene="street-body">
            <div className={`${s.ext} ${s.extSky}`}>
              <i className={s.extDay} data-scene="sky-day" />
            </div>
            <div className={`${s.ext} ${s.extRoad}`}>
              <i className={s.extDay} data-scene="road-day" />
            </div>
            <img className={s.plate} data-scene="plate-night" src={scene?.hero || ART.plateNight} alt="" width={2304} height={1536} fetchPriority="high" />
            <img className={s.frame} src={scene?.frame || ART.openNight} alt="" />
            <div className={s.door}>
              <div className={s.doorLeaf} data-scene="door-leaf">
                <img src={scene?.door || ART.doorNight} alt="" />
                <img className={s.doorDay} data-scene="door-day" src={scene?.doorDay || ART.doorSun} alt="" />
              </div>
            </div>
            <img className={s.spill} data-scene="spill" src={ART.spill} alt="" />
            <div className={s.shutter} style={shutterStyle(scene?.shutter)}>
              {SLATS.map((slat) => (
                <div
                  key={slat.y0}
                  className={slat.last ? `${s.slat} ${s.slatLast}` : s.slat}
                  data-scene="slat"
                  style={{ top: slat.top, height: slat.h, backgroundPosition: `0 ${-slat.y0}px` }}
                >
                  <div className={s.paint} style={{ top: -slat.y0 }}>
                    <div className={s.paintBig}>
                      {copy.paint.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                    <div className={s.paintSmall}>{copy.paintSmall}</div>
                  </div>
                </div>
              ))}
            </div>
            <img className={`${s.plate} ${s.plateDay}`} data-scene="plate-day" src={scene?.daylight || ART.plateSun} alt="" width={2304} height={1536} />
            <div className={s.sign}>
              <span className={`${s.signGlow} ${shared.wordmark}`} data-scene="sign-glow">
                {[...brand].map((letter, i) => (
                  <i key={i} data-scene="glow-letter">
                    {letter}
                  </i>
                ))}
              </span>
              <span className={`${s.signFace} ${shared.wordmark}`}>{brand}</span>
              <span className={`${s.signDay} ${shared.wordmark}`} data-scene="sign-day">
                {brand}
              </span>
            </div>
          </div>
        </div>

        <div className={s.heroUi}>
          <div className={s.heroCta} data-scene="cta">
            <p className={s.heroSub}>{copy.heroSub}</p>
            <div className={s.heroBtns}>
              <a className={`${shared.btn} ${shared.btnEmber}`} href="#board">
                {copy.ctaBoard}
              </a>
              <button className={`${shared.btn} ${shared.btnGhost}`} type="button" onClick={onReserve}>
                {copy.ctaReserve}
              </button>
            </div>
          </div>
          <Captions story={story} caps={copy.caps} />
          <div className={s.cue} data-scene="cue">
            <span className={s.cueArrow} aria-hidden />
            <span>{copy.cue}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
