"use client"

/* eslint-disable @next/next/no-img-element -- the coat engine reads these image nodes. */

import { useEffect, useRef, type CSSProperties } from "react"

import { personneArt } from "./art"
import { mountPersonne } from "./behavior"

import "./personne.css"

/**
 * PERSONNE. A coat on nobody fills out as you scroll into it. The markup is
 * React. behavior.js is the demo's motion: it measures this tree and draws
 * the coat and the rail. The six pieces are mesh art, so the bag stays in
 * memory for the visit.
 */
export function PersonneTemplate({ fonts }: { fonts: string }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return mountPersonne(root, personneArt)
  }, [])

  const lining = { "--pn-lining": `url(${personneArt("lining.webp")})` } as CSSProperties

  return (
    <div
      ref={rootRef}
      className={`personne-tpl js is-loading ${fonts}`}
      lang="en"
      dir="ltr"
      style={lining}
    >
<a className="skip" href="#collection">Skip to the collection</a>

<header className="nav" id="nav">
  <a className="nav-mark wordmark" href="#top" aria-label="Personne, back to the top">PERSONNE</a>
  <nav className="nav-links" aria-label="Main">
    <a href="#collection">The rail</a>
    <a href="#atelier">Atelier</a>
    <a href="#fitting">Fittings</a>
  </nav>
  <div className="nav-end">
    <button className="nav-bag" id="bagBtn" type="button" aria-controls="bag" aria-expanded="false">
      <span className="nav-bag-label">Bag</span>
      <span className="nav-bag-count" id="bagCount" aria-live="polite"><span>0</span></span>
    </button>
    <button className="nav-burger" id="burger" type="button" aria-controls="menu" aria-expanded="false" aria-label="Open the menu">
      <span></span><span></span>
    </button>
  </div>
</header>

<div className="menu" id="menu" aria-label="Menu" inert>
  <div className="menu-rod" aria-hidden="true"></div>
  <ul className="menu-tags">
    <li><a href="#collection" className="menu-tag"><span className="menu-no">01</span>The rail</a></li>
    <li><a href="#atelier" className="menu-tag"><span className="menu-no">02</span>Atelier</a></li>
    <li><a href="#fitting" className="menu-tag"><span className="menu-no">03</span>Fittings</a></li>
  </ul>
  <p className="menu-def"><em>personne</em>, French. 1. nobody. 2. a person.</p>
</div>

<main>
  <section className="story" id="top" aria-label="Personne">
    <div className="stage" id="stage">
      <div className="giant" id="giant" aria-hidden="true"><span className="g g1">PERS</span><span className="g g2">ONNE</span></div>
      <div className="rod" id="rod" aria-hidden="true"></div>
      <img className="hanger" id="hanger" src={personneArt("hanger.webp")} srcSet={`${personneArt("hanger-480.webp")} 480w, ${personneArt("hanger.webp")} 964w`} sizes="(max-width: 860px) and (min-aspect-ratio: 4/3) 14vw, (max-width: 860px) 40vw, 20vw" width="964" height="656" alt="" aria-hidden="true" fetchPriority="high" />
      <canvas className="coatgl" id="coatgl" aria-hidden="true"></canvas>
      <img className="coat-still" id="coatStill" data-src={personneArt("p01-ghost.webp")} width="816" height="1466" alt="A camel overcoat holding the shape of someone who is not there" />
      <div className="lining-bg" id="liningBg" aria-hidden="true"></div>

      <dl className="def" id="def">
        <dt><span className="def-word">personne</span><span className="def-pos">French, noun</span></dt>
        <dd className="def-1"><span className="def-n">1</span><span className="def-t">nobody</span></dd>
        <dd className="def-2"><span className="def-n">2</span><span className="def-t">a person</span></dd>
      </dl>

      <h1 className="line l1" data-words><span className="sr-only">Personne. </span>Nobody is wearing it.</h1>
      <p className="line l2" data-words>Until you step in.</p>
      <p className="line l3" data-words>Tailoring and outerwear, cut in Paris for one person at a time.</p>

      <div className="inside" id="inside">
        <p className="eyebrow inside-eye">Inside</p>
        <h2 className="inside-h" data-words>Every piece is lined in the same blue.</h2>
        <p className="inside-p">Ultramarine silk twill, woven for us in Como. Turn back a lapel and you will know whose it is.</p>
        <a className="btn btn-chalk" href="#collection">See the rail</a>
      </div>

      <div className="cue" id="cue" aria-hidden="true"><span className="cue-track"><span className="cue-dot"></span></span><span className="cue-label">Step in</span></div>

      <div className="tape" id="tape" aria-hidden="true">
        <div className="tape-case"><span className="tape-read" id="tapeRead">000</span><span className="tape-unit">cm</span></div>
        <div className="tape-band"><div className="tape-strip" id="tapeStrip"></div></div>
        <span className="tape-mark"></span>
      </div>
      <p className="sr-only" id="loadStatus" role="status">Loading</p>
    </div>
  </section>

  <section className="rail-sec" id="collection" aria-labelledby="railTitle">
    <header className="sec-head">
      <p className="eyebrow">Autumn Winter 26</p>
      <h2 id="railTitle" className="sec-title" data-words>Six pieces, waiting.</h2>
      <p className="lede">Drag the rail, or brush past it. Pick one up and it fills out for you.</p>
    </header>
    <div className="rail" id="rail">
      <canvas className="railcv" id="railcv" aria-hidden="true"></canvas>
      <ul className="rail-tags" id="railTags" aria-label="The collection"></ul>
    </div>
    <div className="rail-ctrl">
      <button className="rail-btn" id="railPrev" type="button" aria-label="Push the rail back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
      <span className="rail-count" id="railCount" aria-live="polite">01 / 06</span>
      <button className="rail-btn" id="railNext" type="button" aria-label="Push the rail on"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>
    </div>
  </section>

  <section className="atelier" id="atelier" aria-labelledby="atTitle">
    <svg className="stitch" id="stitch" aria-hidden="true" preserveAspectRatio="none">
      <defs><mask id="stitchMask" maskUnits="userSpaceOnUse"><path id="stitchReveal" className="stitch-reveal" d="" /></mask></defs>
      <path id="stitchPath" className="stitch-path" d="" mask="url(#stitchMask)" />
      <g id="needle" className="needle"><path d="M-26 0 L22 0" /><ellipse cx="17" cy="0" rx="4" ry="1.6" /></g>
    </svg>
    <header className="sec-head at-head">
      <p className="eyebrow">The atelier</p>
      <h2 id="atTitle" className="sec-title" data-words>Made in your absence.</h2>
      <p className="lede">Nobody models for us, so nobody is fitted but you. Every piece is drafted, cut and sewn for one set of measurements, in a workshop in the Marais.</p>
    </header>
    <figure className="at-fig at-table" data-par="0.06">
      <div className="at-img"><img src={personneArt("table.webp")} alt="Brown paper pattern pieces, chalk and shears on a cutting table beside camel cloth" loading="lazy" decoding="async" width="1536" height="1024" /></div>
      <figcaption><span className="at-n">01</span><strong>Cut.</strong> Your pattern is drafted on paper, chalked onto the cloth and cut by hand.</figcaption>
    </figure>
    <div className="at-row">
      <figure className="at-fig at-canvas" data-par="-0.05">
        <div className="at-img"><img src={personneArt("canvas.webp")} srcSet={`${personneArt("canvas-1200.webp")} 1200w, ${personneArt("canvas.webp")} 1536w`} sizes="(max-width: 860px) calc(100vw - 32px), 48vw" alt="Horsehair canvas inside a camel coat, covered in rows of hand pad stitches" loading="lazy" decoding="async" width="1536" height="1024" /></div>
        <figcaption><span className="at-n">02</span><strong>Canvas.</strong> A floating horsehair canvas, pad stitched by hand, so the chest keeps its shape and then takes yours.</figcaption>
      </figure>
      <figure className="at-fig at-hole" data-par="0.09">
        <div className="at-img"><img src={personneArt("buttonhole.webp")} srcSet={`${personneArt("buttonhole-1200.webp")} 1200w, ${personneArt("buttonhole.webp")} 1536w`} sizes="(max-width: 860px) 82vw, 39vw" alt="A hand sewn keyhole buttonhole beside a dark horn button" loading="lazy" decoding="async" width="1536" height="1024" /></div>
        <figcaption><span className="at-n">03</span><strong>Finish.</strong> Buttonholes sewn by hand in matching thread, about twenty minutes each.</figcaption>
      </figure>
    </div>
    <ul className="facts">
      <li><span className="fact-big">3</span><span className="fact-t">fittings, the last one in the finished cloth</span></li>
      <li><span className="fact-big">5</span><span className="fact-t">weeks from first fitting to collection</span></li>
      <li><span className="fact-big">1</span><span className="fact-t">pattern, yours, kept on file for the next piece</span></li>
    </ul>
  </section>

  <section className="fitting" id="fitting" aria-labelledby="fitTitle">
    <div className="fit-copy">
      <p className="eyebrow">Fittings</p>
      <h2 id="fitTitle" className="sec-title" data-words>Finished in your presence.</h2>
      <p className="lede">Book a first fitting at the atelier in Paris, or with a tailor on a video call. We take twenty two measurements. After that the pattern is yours.</p>
    </div>
    <form className="form" id="form" noValidate>
      <div className="field">
        <label htmlFor="fName">Your name</label>
        <input id="fName" name="name" type="text" autoComplete="name" required />
        <p className="field-err" id="fNameErr" aria-live="polite"></p>
      </div>
      <div className="field">
        <label htmlFor="fEmail">Email</label>
        <input id="fEmail" name="email" type="email" autoComplete="email" inputMode="email" required />
        <p className="field-err" id="fEmailErr" aria-live="polite"></p>
      </div>
      <div className="field">
        <label htmlFor="fPiece">The piece</label>
        <div className="select"><select id="fPiece" name="piece"></select></div>
      </div>
      <fieldset className="field field-radio">
        <legend>Where</legend>
        <label className="radio"><input type="radio" name="place" value="atelier" defaultChecked /><span>At the atelier, Paris</span></label>
        <label className="radio"><input type="radio" name="place" value="video" /><span>On a video call</span></label>
      </fieldset>
      <div className="field">
        <label htmlFor="fWeek">Week</label>
        <div className="select"><select id="fWeek" name="week"></select></div>
      </div>
      <div className="hp" aria-hidden="true"><label htmlFor="fWeb">Leave this empty</label><input id="fWeb" name="website" type="text" tabIndex={-1} autoComplete="off" /></div>
      <button className="btn btn-ink form-go" type="submit"><span>Request a fitting</span></button>
    </form>
    <div className="done" id="done" hidden tabIndex={-1}>
      <div className="done-rod" aria-hidden="true"><img className="done-hanger" src={personneArt("hanger.webp")} srcSet={`${personneArt("hanger-480.webp")} 480w, ${personneArt("hanger.webp")} 964w`} sizes="170px" width="964" height="656" alt="" loading="lazy" /></div>
      <p className="eyebrow" id="doneNo">Fitting request</p>
      <h3 className="done-h" id="doneH">A hanger is waiting for you.</h3>
      <p className="done-p" id="doneP"></p>
      <button className="btn btn-line" id="doneAgain" type="button">Request another</button>
    </div>
  </section>
</main>

<footer className="foot">
  <div className="foot-top">
    <div className="foot-rod" id="footRod" aria-hidden="true"><img className="foot-hanger" id="footHanger" src={personneArt("hanger.webp")} srcSet={`${personneArt("hanger-480.webp")} 480w, ${personneArt("hanger.webp")} 964w`} sizes="(max-width: 860px) 170px, 240px" width="964" height="656" alt="" loading="lazy" /></div>
    <p className="foot-line">The hanger stays.<br />The coat goes with you.</p>
  </div>
  <div className="foot-cols">
    <div><p className="foot-k">Atelier</p><p>Rue Charlot, Paris 3e<br />Tuesday to Saturday, 11 till 19</p></div>
    <div><p className="foot-k">Visit</p><p><a href="#fitting">Book a fitting</a><br /><a href="#collection">See the rail</a></p></div>
    <div><p className="foot-k">The word</p><p><em>personne</em>, French.<br />1. nobody. 2. a person.</p></div>
  </div>
  <div className="foot-mark wordmark" aria-hidden="true">PERSONNE</div>
  <p className="legal">© 2026 Personne, Paris. A concept house. No models were used.</p>
</footer>

<aside className="bag" id="bag" aria-label="Your bag" inert>
  <div className="bag-scrim" id="bagScrim"></div>
  <div className="bag-panel" role="dialog" aria-modal="true" aria-labelledby="bagTitle">
    <header className="bag-head"><h2 id="bagTitle">Your bag</h2><button className="x" id="bagClose" type="button" aria-label="Close the bag"><span></span><span></span></button></header>
    <ul className="bag-list" id="bagList"></ul>
    <div className="bag-empty" id="bagEmpty"><img src={personneArt("hanger.webp")} srcSet={`${personneArt("hanger-480.webp")} 480w, ${personneArt("hanger.webp")} 964w`} sizes="150px" width="964" height="656" alt="" loading="lazy" /><p>Nothing on your hanger yet.</p><a className="btn btn-line" href="#collection" id="bagToRail">See the rail</a></div>
    <footer className="bag-foot" id="bagFoot">
      <div className="bag-sum"><span>Subtotal</span><span id="bagTotal">&euro;0</span></div>
      <p className="bag-note">Made to measure. Pay at your first fitting, nothing today.</p>
      <button className="btn btn-ink" id="bagBook" type="button">Book a fitting for these</button>
    </footer>
  </div>
</aside>

<div className="fitroom" id="fitroom" role="dialog" aria-modal="true" aria-labelledby="frName" inert>
  <div className="fr-bg" id="frBg"></div>
  <canvas className="fr-gl" id="frgl" aria-hidden="true"></canvas>
  <img className="fr-still" id="frStill" width="816" height="1466" alt="" />
  <button className="fr-close x" id="frClose" type="button" aria-label="Put it back on the rail"><span></span><span></span></button>
  <div className="fr-panel" id="frPanel">
    <p className="fr-no" id="frNo">No. 01</p>
    <h2 className="fr-name" id="frName">Overcoat</h2>
    <p className="fr-cloth" id="frCloth"></p>
    <p className="fr-price" id="frPrice"></p>
    <p className="fr-desc" id="frDesc"></p>
    <fieldset className="fr-sizes">
      <legend>Size, EU</legend>
      <div className="fr-size-row" id="frSizes"></div>
    </fieldset>
    <button className="btn btn-ink fr-add" id="frAdd" type="button"><span>Add to bag</span></button>
    <p className="fr-msg" id="frMsg" aria-live="polite"></p>
    <dl className="fr-spec" id="frSpec"></dl>
    <div className="fr-nav">
      <button className="rail-btn" id="frPrev" type="button" aria-label="Previous piece"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg></button>
      <span className="fr-idx" id="frIdx">01 / 06</span>
      <button className="rail-btn" id="frNext" type="button" aria-label="Next piece"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button>
    </div>
  </div>
</div>
    </div>
  )
}
