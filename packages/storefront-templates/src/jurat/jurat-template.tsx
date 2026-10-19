"use client"

/* eslint-disable @next/next/no-img-element -- the workshop engine reads these image nodes. */

import { useEffect, useRef, type CSSProperties } from "react"

import { juratArt } from "./art"
import { mountJurat } from "./behavior"

import "./jurat.css"

/**
 * JURAT / جرعة فن. An oud workshop: the wall where they hang, the bench where
 * one is built rib by rib, the wall again. Markup is React; behavior.js is the
 * demo's scroll, canvas, and sound.
 */
export function JuratTemplate({ fonts }: { fonts: string }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return mountJurat(root)
  }, [])

  const surfaces = {
    ["--jr-strings" as string]: `url(${juratArt("strings-plate.webp")})`,
    ["--jr-strings-m" as string]: `url(${juratArt("strings-plate-m.webp")})`,
    ["--jr-bench" as string]: `url(${juratArt("bench.webp")})`,
    ["--jr-bench-m" as string]: `url(${juratArt("bench-m.webp")})`,
    ["--jr-face" as string]: `url(${juratArt("face-cedar.webp")})`,
  } as CSSProperties

  return (
    <div
      ref={rootRef}
      className={`jurat-tpl js is-loading ${fonts}`}
      lang="ar"
      dir="rtl"
      style={surfaces}
    >
<div className="loader" id="loader" aria-hidden="true">
  <div className="mark" id="mark">
    <img className="mark__word" src={juratArt("logo-word-night.webp")} alt="" width="934" height="412" />
    <img className="mark__n mark__n1" src={juratArt("logo-n1-night.webp")} alt="" width="934" height="412" />
    <img className="mark__n mark__n2" src={juratArt("logo-n2-night.webp")} alt="" width="934" height="412" />
    <img className="mark__n mark__n3" src={juratArt("logo-n3-night.webp")} alt="" width="934" height="412" />
    <img className="mark__n mark__n4" src={juratArt("logo-n4-night.webp")} alt="" width="934" height="412" />
  </div>
  <p className="loader__count"><span id="count">0</span><span className="loader__label" data-i18n="loading">يُجهَّز العود</span></p>
</div>

<header className="nav" id="nav">
  <a className="nav__logo" href="#top" aria-label="جرعة فن" data-i18n-aria="brand">
    <img className="nav__day" src={juratArt("logo.webp")} alt="" width="934" height="412" />
    <img className="nav__night" src={juratArt("logo-night.webp")} alt="" width="934" height="412" />
  </a>
  <nav className="nav__links" aria-label="الأقسام" data-i18n-aria="sections">
    <a href="#shop" data-i18n="nav_oud">الأعواد</a>
    <a href="#strings" data-i18n="nav_strings">الأوتار</a>
    <a href="#bench" data-i18n="nav_bench">الإكسسوارات</a>
    <a href="#repair" data-i18n="nav_repair">الصيانة</a>
  </nav>
  <div className="nav__tools">
    <button className="tool" id="soundBtn" type="button" aria-pressed="false" aria-label="تشغيل الصوت" data-i18n-aria="sound_on_aria">
      <svg className="i i--on" viewBox="0 0 256 256" aria-hidden="true"><path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Zm54-106.08a40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.58,24,24,0,0,0,0-31.72,8,8,0,0,1,12-10.58ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z"/></svg>
      <svg className="i i--off" viewBox="0 0 256 256" aria-hidden="true"><path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L73.55,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V175.09l42.08,46.29a8,8,0,1,0,11.84-10.76ZM32,96H72v64H32ZM144,207.64,88,164.09V95.89l56,61.6Zm42-63.77a24,24,0,0,0,0-31.72,8,8,0,1,1,12-10.57,40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.59Zm-80.16-76a8,8,0,0,1,1.4-11.23l39.85-31A8,8,0,0,1,160,32v74.83a8,8,0,0,1-16,0V48.36l-26.94,21A8,8,0,0,1,105.84,67.91ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z"/></svg>
    </button>
    <button className="tool tool--lang" id="langBtn" type="button" lang="en" aria-label="English">EN</button>
    <a className="pill pill--nav" href="https://musicaldose88.mlsoon.sa/ar" data-href-lang target="_blank" rel="noopener">
      <svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M232,96a7.89,7.89,0,0,0-.3-2.2L217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.8A7.89,7.89,0,0,0,24,96h0v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96ZM54,48H202l11.42,40H42.61Zm50,56h48v8a24,24,0,0,1-48,0Zm-16,0v8a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm4.93-75.8a8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48v8A24,24,0,0,1,204.93,132.2Z"/></svg>
      <span data-i18n="store">المتجر</span>
    </a>
  </div>
</header>

<main id="main">

  <section className="story" id="top" data-pace aria-labelledby="heroH">
    <div className="pin" id="pin">

      
      <div className="scene scene--wall" id="wall">
        <div className="cam" id="wallCam">
          <img className="plate" id="wallPlate" src={juratArt("wall.webp")} alt="" width="1536" height="1024" />
          <div className="lamp" id="wallLamp" aria-hidden="true"></div>
          <div className="sign" id="sign" aria-hidden="true">
            <img className="mark__word" src={juratArt("logo-word-night.webp")} alt="" width="934" height="412" />
            <img className="mark__n mark__n1" src={juratArt("logo-n1-night.webp")} alt="" width="934" height="412" />
            <img className="mark__n mark__n2" src={juratArt("logo-n2-night.webp")} alt="" width="934" height="412" />
            <img className="mark__n mark__n3" src={juratArt("logo-n3-night.webp")} alt="" width="934" height="412" />
            <img className="mark__n mark__n4" src={juratArt("logo-n4-night.webp")} alt="" width="934" height="412" />
          </div>
          <div className="hooks" id="hooks"></div>
        </div>
      </div>

      
      <div className="scene scene--bench" id="benchTop" aria-hidden="true"><img className="plate" id="benchPlate" src={juratArt("bench.webp")} alt="" width="1536" height="1024" loading="lazy" /></div>

      <canvas className="fan" id="fan" aria-hidden="true"></canvas>
      <div className="stage" id="stage"><canvas id="oud" role="img" aria-label="رزين، بلاك لامبا وبادوق"></canvas><div className="flyers" id="flyers" aria-hidden="true"></div></div>

      <div className="hero" id="hero">
        <h1 className="sr" id="heroH" data-i18n="title">جرعة فن | أعواد تقنيات العود في الرياض</h1>
        <p className="eyebrow ln"><span data-i18n="eyebrow">أعواد تقنيات العود في الرياض</span></p>
        <p className="display ln"><span data-i18n="hero_line">كل عود يبدأ بضلع.</span></p>
        <div className="ctas ln"><span>
          <a className="pill pill--brass" href="#shop"><span data-i18n="hero_cta">اختر عودك</span><svg className="i i--dir" viewBox="0 0 256 256" aria-hidden="true"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg></a>
          <a className="link" href="#repair" data-i18n="hero_link">احجز صيانة</a>
        </span></div>
      </div>
      <p className="hint" id="hint"><span className="hint__rib" aria-hidden="true"></span><span data-i18n="hint">مرّر، ونبنيه أمامك ضلعًا ضلعًا</span></p>

      <div className="build" id="build" aria-hidden="true">
        <p className="bw bw--1"><span data-i18n="build_w1">ضلع</span></p>
        <p className="bw bw--2"><span data-i18n="build_w2">ضلع.</span></p>
        <p className="bsub"><span data-i18n="build_sub">على القالب، والوسط أولًا.</span></p>
      </div>

      <div className="shop" id="shop" aria-live="polite">
        <p className="count ln"><span><bdi id="cNum">01</bdi> <span data-i18n="of">من</span> <bdi>05</bdi></span></p>
        <h2 className="pname ln"><span className="drum" id="pName"></span></h2>
        <div className="ln"><ul className="woods" id="pWoods"></ul></div>
        <p className="pnote ln"><span className="drum" id="pNote"></span></p>
        <div className="ln lnSpecs"><dl className="specs" id="pSpecs"></dl></div>
        <div className="price ln"><span>
          <span className="odo" id="pPrice" aria-hidden="true"></span><span className="sr" id="pPriceSr"></span>
          <span className="cur" data-i18n="sar">ر.س</span>
          <s className="was" id="pWas"></s>
          <span className="tag" id="pNego" data-i18n="nego">السعر قابل للتفاوض</span>
        </span></div>
        <div className="actions ln"><span>
          <a className="pill pill--brass" id="pBuy" href="#" target="_blank" rel="noopener"><span data-i18n="buy">اطلبه من المتجر</span><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/></svg></a>
          <button className="turn" id="pTurn" type="button" aria-pressed="false"><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg><span id="pTurnL" data-i18n="turn_back">اقلبه وشوف الخشب</span></button>
        </span></div>
      </div>

      <div className="rail" id="rail" role="tablist" aria-label="الأعواد على الجدار" data-i18n-aria="rail_aria"></div>

      
      <div className="scene scene--strings" id="strings" aria-labelledby="stringsH">
        <div className="strings__band" id="sBand"><canvas id="sCanvas" aria-hidden="true"></canvas></div>
        <div className="strings__head">
          <h2 className="h2" id="stringsH"><span data-i18n="strings_h">اختر صوته.</span></h2>
          <p className="lead" data-i18n="strings_p">أطقم أوتار تقنيات العود وأرورا.</p>
        </div>
        <div className="strings__ui">
          <p className="strings__hint" id="sHint" data-i18n="strings_hint_mouse">مرّر المؤشر على الأوتار.</p>
          <div className="swatches" id="sets" role="radiogroup" aria-label="اختر طقم الأوتار" data-i18n-aria="sets_aria"></div>
          <div className="setnow">
            <p className="setnow__n"><span className="drum" id="setName"></span></p>
            <p className="setnow__p"><bdi id="setPrice"></bdi> <span data-i18n="sar">ر.س</span></p>
            <a className="pill pill--ink" id="setBuy" href="#" target="_blank" rel="noopener"><span data-i18n="strings_buy">في المتجر</span><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/></svg></a>
          </div>
          <p className="fine" data-i18n="strings_note">الصوت تسجيل عود حقيقي واحد، للتجربة فقط.</p>
        </div>
      </div>

      <canvas className="cover" id="cover" aria-hidden="true"></canvas>
    </div>
  </section>

  <section className="wood wood--a bench" id="bench" aria-labelledby="benchH">
    <div className="wood__plate" aria-hidden="true"></div>
    <div className="wrap">
      <div className="head rv">
        <h2 className="h2" id="benchH"><span className="ln"><span data-i18n="bench_h">وعلى الطاولة أيضًا.</span></span></h2>
        <p className="lead ln"><span data-i18n="bench_p">الريش، والشنطة، واللاقط، وقاعدة القدم.</span></p>
      </div>
      <div className="lay rv" id="lay"></div>
    </div>
  </section>

  <section className="wood wood--b repair" id="repair" aria-labelledby="repairH">
    <div className="wood__plate" aria-hidden="true"></div>
    <div className="wrap repair__in">
      <div className="repair__stage"><canvas id="rCanvas" role="img" aria-label="صيانة العود"></canvas></div>
      <div className="repair__words">
        <div className="head rv">
          <h2 className="h2" id="repairH"><span className="ln"><span data-i18n="repair_h">وإذا تعب عودك؟</span></span></h2>
        </div>
        <div className="paper ticket rv">
          <p className="paper__k" data-i18n="ticket">تذكرة صيانة</p>
          <p className="ticket__p" data-i18n="repair_p">يرجع إلى الطاولة.</p>
          <div className="price"><span>
            <span className="pitem" data-i18n="repair_item">صيانة العود</span>
            <span className="odo odo--sm" id="rPrice" aria-hidden="true"></span><span className="sr">140</span>
            <span className="cur" data-i18n="sar">ر.س</span>
            <s className="was"><span data-i18n="was">بدل</span> <bdi>150</bdi></s>
          </span></div>
          <div className="actions"><span>
            <a className="pill pill--ink" data-shop="syanh-alalat-mwsyqyh" href="#" target="_blank" rel="noopener"><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z"/></svg><span data-i18n="repair_cta">احجز الصيانة</span></a>
            <button className="turn turn--ink" id="rAgain" type="button"><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg><span data-i18n="repair_again">أعدها</span></button>
          </span></div>
          <p className="care"><span data-i18n="care">ومع عود تقنيات العود الجديد: حماية لمدة 12 شهرًا.</span> <a data-shop="oud-tech-care-ud-koruma-hizmeti" href="#" target="_blank" rel="noopener" data-i18n="care_link">تفاصيل الحماية</a></p>
        </div>
      </div>
    </div>
  </section>

  <section className="wood wood--a name" id="name" aria-labelledby="nameH">
    <div className="wood__plate" aria-hidden="true"></div>
    <div className="wrap name__in">
      <div className="name__face rv">
        <div className="face" id="face"><canvas id="rosette" width="512" height="512" aria-hidden="true"></canvas></div>
      </div>
      <div className="name__words">
        <div className="head rv">
          <h2 className="h2" id="nameH"><span className="ln"><span data-i18n="name_h">اسمك في الشمسية.</span></span></h2>
          <p className="lead ln"><span data-i18n="name_p">اكتب الاسم وشاهده يُحفر.</span></p>
        </div>
        <form className="paper carve rv" id="carve" autoComplete="off">
          <label htmlFor="nameIn" data-i18n="name_label">الاسم</label>
          <div className="carve__row">
            <input id="nameIn" name="name" type="text" maxLength={16} placeholder="مثلًا: فيصل" data-i18n-ph="name_ph" enterKeyHint="done" />
            <a className="pill pill--ink" id="waBtn" href="https://wa.me/966570999788" target="_blank" rel="noopener"><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M187.58,144.84l-32-16a8,8,0,0,0-8,.5l-14.69,9.8a40.55,40.55,0,0,1-16-16l9.8-14.69a8,8,0,0,0,.5-8l-16-32A8,8,0,0,0,104,64a40,40,0,0,0-40,40,88.1,88.1,0,0,0,88,88,40,40,0,0,0,40-40A8,8,0,0,0,187.58,144.84ZM152,176a72.08,72.08,0,0,1-72-72A24,24,0,0,1,99.29,80.46l11.48,23L101,118a8,8,0,0,0-.73,7.51,56.47,56.47,0,0,0,30.15,30.15A8,8,0,0,0,138,155l14.61-9.74,23,11.48A24,24,0,0,1,152,176ZM128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg><span data-i18n="name_cta">اطلبها عبر واتساب</span></a>
          </div>
          <p className="fine" data-i18n="name_note">ما تراه هنا تصوّر للفكرة.</p>
        </form>
      </div>
    </div>
  </section>

</main>

<footer className="close" id="foot">
  <div className="close__pin">
    <div className="close__cam" id="closeCam">
      <img className="plate" id="closePlate" src={juratArt("wall.webp")} alt="" width="1536" height="1024" loading="lazy" />
      <div className="hooks hooks--close" id="closeHooks" aria-hidden="true"></div>
      <div className="lamp lamp--close" id="closeLamp" aria-hidden="true"></div>
    </div>
    <div className="sign sign--foot" id="footMark" aria-hidden="true">
        <img className="mark__word" src={juratArt("logo-word-night.webp")} alt="" width="934" height="412" loading="lazy" />
        <img className="mark__n mark__n1" src={juratArt("logo-n1-night.webp")} alt="" width="934" height="412" loading="lazy" />
        <img className="mark__n mark__n2" src={juratArt("logo-n2-night.webp")} alt="" width="934" height="412" loading="lazy" />
        <img className="mark__n mark__n3" src={juratArt("logo-n3-night.webp")} alt="" width="934" height="412" loading="lazy" />
        <img className="mark__n mark__n4" src={juratArt("logo-n4-night.webp")} alt="" width="934" height="412" loading="lazy" />
      </div>
    <div className="close__in" id="closeIn">

      <p className="close__h" data-i18n="foot_h">عودك القادم في جرعة فن.</p>
      <ul className="foot__links">
        <li><a href="https://musicaldose88.mlsoon.sa/ar" data-href-lang target="_blank" rel="noopener"><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M232,96a7.89,7.89,0,0,0-.3-2.2L217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.8A7.89,7.89,0,0,0,24,96h0v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96ZM54,48H202l11.42,40H42.61Zm50,56h48v8a24,24,0,0,1-48,0Zm-16,0v8a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8ZM200,208H56V151.2a40.57,40.57,0,0,0,8,.8,40,40,0,0,0,32-16,40,40,0,0,0,64,0,40,40,0,0,0,32,16,40.57,40.57,0,0,0,8-.8Zm4.93-75.8a8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48v8A24,24,0,0,1,204.93,132.2Z"/></svg><span data-i18n="store">المتجر</span></a></li>
        <li><a href="https://instagram.com/musicaldose88" target="_blank" rel="noopener"><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160ZM176,24H80A56.06,56.06,0,0,0,24,80v96a56.06,56.06,0,0,0,56,56h96a56.06,56.06,0,0,0,56-56V80A56.06,56.06,0,0,0,176,24Zm40,152a40,40,0,0,1-40,40H80a40,40,0,0,1-40-40V80A40,40,0,0,1,80,40h96a40,40,0,0,1,40,40ZM192,76a12,12,0,1,1-12-12A12,12,0,0,1,192,76Z"/></svg><bdi>@musicaldose88</bdi></a></li>
        <li><a href="tel:+966565581869"><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M222.37,158.46l-47.11-21.11-.13-.06a16,16,0,0,0-15.17,1.4,8.12,8.12,0,0,0-.75.56L134.87,160c-15.42-7.49-31.34-23.29-38.83-38.51l20.78-24.71c.2-.25.39-.5.57-.77a16,16,0,0,0,1.32-15.06l0-.12L97.54,33.64a16,16,0,0,0-16.62-9.52A56.26,56.26,0,0,0,32,80c0,79.4,64.6,144,144,144a56.26,56.26,0,0,0,55.88-48.92A16,16,0,0,0,222.37,158.46ZM176,208A128.14,128.14,0,0,1,48,80,40.2,40.2,0,0,1,82.87,40a.61.61,0,0,0,0,.12l21,47L83.2,111.86a6.13,6.13,0,0,0-.57.77,16,16,0,0,0-1,15.7c9.06,18.53,27.73,37.06,46.46,46.11a16,16,0,0,0,15.75-1.14,8.44,8.44,0,0,0,.74-.56L168.89,152l47,21.05h0s.08,0,.11,0A40.21,40.21,0,0,1,176,208Z"/></svg><bdi dir="ltr">+966 56 558 1869</bdi></a></li>
        <li><a href="https://wa.me/966570999788" target="_blank" rel="noopener"><svg className="i" viewBox="0 0 256 256" aria-hidden="true"><path d="M187.58,144.84l-32-16a8,8,0,0,0-8,.5l-14.69,9.8a40.55,40.55,0,0,1-16-16l9.8-14.69a8,8,0,0,0,.5-8l-16-32A8,8,0,0,0,104,64a40,40,0,0,0-40,40,88.1,88.1,0,0,0,88,88,40,40,0,0,0,40-40A8,8,0,0,0,187.58,144.84ZM152,176a72.08,72.08,0,0,1-72-72A24,24,0,0,1,99.29,80.46l11.48,23L101,118a8,8,0,0,0-.73,7.51,56.47,56.47,0,0,0,30.15,30.15A8,8,0,0,0,138,155l14.61-9.74,23,11.48A24,24,0,0,1,152,176ZM128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z"/></svg><span data-i18n="wa">واتساب</span></a></li>
      </ul>
      <p className="foot__where" data-i18n="foot_where">جرعة فن، الرياض.</p>
      <p className="foot__credit" data-i18n="credit">الأصوات تسجيلات عود حقيقية.</p>
      <p className="foot__credit" data-i18n="demo">تصميم مقترح من Genesis Works. الطلب والدفع في متجر جرعة فن.</p>
    </div>
  </div>
</footer>
    </div>
  )
}
