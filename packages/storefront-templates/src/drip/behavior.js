/* DRIP behaviour, ported from the Genesis Works demo.
   The React tree owns the markup. This module measures, scrolls and animates it.
   It does not render. Unmount aborts listeners, timers and the physics loop. */
/* eslint-disable */
import gsapRaw from "gsap"
import Lenis from "lenis"
import { dripArt } from "./art"
import { FLAVOURS as SAMPLE_FLAVOURS, CROWNS as SAMPLE_CROWNS, PRICE as SAMPLE_PRICE, T } from "./data"
import metaJson from "./meta.json"

export function mountDrip(host, opts) {
  opts = opts || {};
  const catalogue = opts.catalogue || null
  const shopCart = opts.shopCart || null
  const FLAVOURS = catalogue && catalogue.flavours && catalogue.flavours.length ? catalogue.flavours : SAMPLE_FLAVOURS
  const CROWNS = catalogue && catalogue.crowns ? catalogue.crowns : SAMPLE_CROWNS
  const PRICE = catalogue && catalogue.price && catalogue.price.scoops ? catalogue.price : SAMPLE_PRICE
  let alive = true
  const ac = new AbortController()
  const signal = ac.signal
  const origAdd = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const next = opts == null ? { signal } : typeof opts === "boolean" ? { capture: opts, signal } : { ...opts, signal }
    return origAdd.call(this, type, fn, next)
  }

  const pendingTimers = new Set()
  const intervals = new Set()
  const rafs = new Set()
  const nativeSetTimeout = globalThis.setTimeout
  const nativeClearTimeout = globalThis.clearTimeout
  const nativeSetInterval = globalThis.setInterval
  const nativeClearInterval = globalThis.clearInterval
  const nativeRAF = globalThis.requestAnimationFrame
  const nativeCAF = globalThis.cancelAnimationFrame
  const setTimeout = (fn, ms, ...args) => {
    const id = nativeSetTimeout(() => { pendingTimers.delete(id); if (!alive) return; fn(...args) }, ms)
    pendingTimers.add(id)
    return id
  }
  const clearTimeout = (id) => { pendingTimers.delete(id); nativeClearTimeout(id) }
  const setInterval = (fn, ms, ...args) => {
    const id = nativeSetInterval(() => { if (!alive) return; fn(...args) }, ms)
    intervals.add(id)
    return id
  }
  const clearInterval = (id) => { intervals.delete(id); nativeClearInterval(id) }
  const requestAnimationFrame = (fn) => {
    const id = nativeRAF((t) => { rafs.delete(id); if (!alive) return; fn(t) })
    rafs.add(id)
    return id
  }
  const cancelAnimationFrame = (id) => { rafs.delete(id); nativeCAF(id) }

  const ctx = gsapRaw.context(() => {}, host)
  const gsap = new Proxy(gsapRaw, {
    get(target, prop) {
      const value = target[prop]
      if (prop === "killTweensOf" || prop === "context" || prop === "ticker" || typeof value !== "function") {
        return typeof value === "function" ? value.bind(target) : value
      }
      if (prop === "to" || prop === "from" || prop === "fromTo" || prop === "set" || prop === "timeline") {
        return (...args) => {
          let tween
          ctx.add(() => { tween = value.apply(target, args) })
          return tween
        }
      }
      return value.bind(target)
    },
  })

  if (new URLSearchParams(location.search).has("still")) host.classList.add("still")
  const root = host
  const art = (file) => {
    if (typeof file === "string" && /^(https?:|data:|\/)/.test(file)) return file
    return dripArt(file)
  }
  function scoopSrc(f, kind) {
    const flavour = FLAVOURS[f]
    if (!flavour) return ""
    // A catalogue photo is already the cut-out. Appending -t.webp / -m.webp
    // asks the CDN for a file that 404s.
    const photo = flavour.cutout || flavour.img || ""
    if (/^(https?:|data:|\/)/.test(photo)) return photo
    if (flavour.cutout) return art(flavour.cutout)
    const suffix = kind === "t" ? "-t.webp" : kind === "m" ? "-m.webp" : ".webp"
    return art((flavour.img || "") + suffix)
  }
  const $ = (s, r = root) => r.querySelector(s)
  const $$ = (s, r = root) => [...r.querySelectorAll(s)]
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches
  const STILL = root.classList.contains("still")
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const lerp = (a, b, t) => a + (b - a) * t
  const fontName = (prop) => {
    const first = getComputedStyle(host).getPropertyValue(prop).split(",")[0].trim().replace(/^['"]|['"]$/g, "")
    return first || "sans-serif"
  }
  const previousSite = window.__site

// ---------- geometry (in cone widths) ----------
// The cone stacks on the lip. The regular cup nests a short column. The large
// cup is a cluster: a pair on the floor, a pair nestled above, then a crown.
const VESSELS = {
  cone: { file: 'cone.webp', ratio: 1100 / 446, rim: 0.066, scoop: 1.14, sway: 1, maxDesk: 0.2, maxPhone: 0.4, maxScoops: 3 },
};
// The cup picks its glass from the scoop count. Three or fewer stay in the
// smaller glass at the size that holds three, and a fourth swaps in the
// larger glass, which holds five.
const CUPS = {
  regular: { file: 'cup.webp', glass: true, ratio: 633 / 582, rim: 0.054, floor: 0.02, nest: 0.30, seat: 0.34, scoop: 0.66, sway: 0.42, maxDesk: 0.28, maxPhone: 0.54, maxScoops: 3 },
  large: { file: 'cup-lg.webp', glass: true, ratio: 655 / 588, rim: 0.050, floor: 0.02, scoop: 0.50, sway: 0.36, maxDesk: 0.40, maxPhone: 0.72, maxScoops: 5, pack: 5 },
};
// x is a share of the free width beside a scoop. Signs alternate so each scoop
// tucks against the one under it instead of landing on the same axis.
const CUP_POSE = [
  { x: 0.4, lean: -7, tuck: 0 },
  { x: -0.7, lean: 11, tuck: 0.04 },
  { x: 0.55, lean: -10, tuck: 0.03 },
  { x: -0.45, lean: 8, tuck: 0.04 },
  { x: 0.22, lean: -5, tuck: 0.02 },
];
// y is how many scoop-heights above the floor. x is cup-widths off centre.
const LARGE_CLUSTER = {
  1: [{ x: 0, lean: -4, y: 0, z: 3 }],
  2: [
    { x: -0.06, lean: -8, y: 0, z: 1 },
    { x: 0.04, lean: 8, y: 0.08, z: 2 },
  ],
  3: [
    { x: -0.06, lean: -8, y: 0, z: 1 },
    { x: 0.04, lean: 8, y: 0.08, z: 2 },
    { x: 0.0, lean: -3, y: 0.62, z: 5 },
  ],
  4: [
    { x: -0.06, lean: -8, y: 0, z: 1 },
    { x: 0.04, lean: 8, y: 0.08, z: 2 },
    { x: -0.075, lean: 7, y: 0.64, z: 3 },
    { x: 0.08, lean: -8, y: 0.76, z: 4 },
  ],
  5: [
    { x: -0.055, lean: -7, y: 0, z: 1 },
    { x: 0.05, lean: 8, y: 0.08, z: 2 },
    { x: -0.035, lean: 6, y: 0.48, z: 3 },
    { x: 0.04, lean: -8, y: 0.58, z: 4 },
    { x: 0, lean: 3, y: 1.22, z: 6 },
  ],
};
function cupPlaces(ratios, v) {
  const hs = ratios.map((ratio) => v.scoop * ratio);
  if (v.pack) {
    const floor = v.floor * v.ratio;
    const slots = LARGE_CLUSTER[Math.min(hs.length, 5)] || LARGE_CLUSTER[5];
    return hs.map((h, k) => {
      const s = slots[Math.min(k, slots.length - 1)];
      const bottom = floor + s.y * h;
      return { bottom, top: bottom + h, x: s.x, lean: s.lean, z: s.z };
    });
  }
  const room = Math.min(0.10, Math.max(0.045, (1 - v.scoop) * 0.20));
  let prevTop = v.floor * v.ratio;
  let prevH = 0;
  return hs.map((h, k) => {
    const pose = CUP_POSE[Math.min(k, CUP_POSE.length - 1)];
    const bottom = k === 0 ? prevTop : prevTop - v.nest * prevH - v.seat * h - pose.tuck * h;
    prevTop = bottom + h;
    prevH = h;
    return { bottom, top: prevTop, x: pose.x * room, lean: pose.lean, z: k + 1 };
  });
}
function sizeForCount(n) {
  const cap = catalogue && catalogue.vesselCap ? catalogue.vesselCap : 3
  return n > cap ? 'large' : 'regular'
}
function metrics(id = S.vessel, size = S.cupSize) {
  if (id === 'cup') return size === 'large' ? CUPS.large : CUPS.regular;
  return VESSELS.cone;
}
function scoopCap(id = S.vessel) {
  if (catalogue) {
    if (id === 'cup') return catalogue.maxCount || CUPS.large.maxScoops
    return catalogue.vesselCap || VESSELS.cone.maxScoops || 3
  }
  return id === 'cup' ? CUPS.large.maxScoops : (VESSELS.cone.maxScoops || 3)
}
const SEAT = 0.20;                  // share of a scoop's height that sits below the rim / inside the scoop under it
const NEST = 0.22;                  // share of the lower scoop's height the next scoop sinks into
const heightFor = (n, r = 0.97, id = S.vessel, size = S.cupSize) => {
  const v = metrics(id, size);
  const sh = v.scoop * r;
  if (v.glass) {
    if (v.pack) return v.ratio;
    const places = cupPlaces(Array(Math.max(1, n)).fill(r), v);
    return Math.max(v.ratio, places[places.length - 1].top);
  }
  if (!n) return v.ratio;
  return v.ratio * (1 - v.rim) - SEAT * sh + sh + (n - 1) * (sh - NEST * sh - SEAT * sh);
};

// ---------- state ----------
const S = {
  lang: 'en', vessel: 'cone', cupSize: 'regular', scoops: [], crowns: new Set(), preview: null, held: null, submitting: false, bag: [], bagView: 'list',
  hero: { w: 0, h: 0 }, cw: 150, sw: 171, mobile: false, zoom: 1, zoomT: 1,
  theta: 0, thetaV: 0, thetaT: 0, drag: null, dy: 0, dyV: 0, enterY: 0,
  fly: { x: 0, y: 0, s: 1, r: 0 }, heroVisible: true, t: 0, ready: false,
};
let META = metaJson;
let lenis = null;

// ---------- i18n ----------
const t = (k, vars) => {
  let s = (T[S.lang] && T[S.lang][k]) ?? T.en[k] ?? k;
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace('{' + a + '}', b);
  return s;
};
const nf = (n) => S.lang === 'ar' ? n.toLocaleString('ar-SA') : String(n);
const fl = (i) => FLAVOURS[i][S.lang];

function paintVessel() {
  const v = metrics();
  const img = $('#coneImg');
  if (img && v.file) img.src = art(v.file);
  root.style.setProperty('--vr', (v.glass ? heightFor(Math.max(1, S.scoops.length)) : v.ratio).toFixed(4));
  root.classList.toggle('is-cup', S.vessel === 'cup');
  const title = $('#vesselTitle');
  if (title) title.dataset.i18n = S.vessel === 'cup' ? 'hero.cup' : 'hero.cone';
  const hint = $('.panel__hint');
  if (hint) hint.dataset.i18n = S.vessel === 'cup' ? 'hero.hint.cup' : 'hero.hint';
  const rigEl = $('#rig');
  if (rigEl) rigEl.dataset.i18nAria = S.vessel === 'cup' ? 'hero.cup' : 'hero.cone';
  const inner = $('#rigInner');
  if (inner) inner.style.transformOrigin = S.vessel === 'cup' ? '50% 88%' : '50% 74%';
  $$('#vessel [data-vessel]').forEach((b) => {
    const on = b.dataset.vessel === S.vessel;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.classList.toggle('is-on', on);
  });
}
function syncCupSize() {
  const next = S.vessel === 'cup' ? sizeForCount(S.scoops.length) : 'regular';
  if (next === S.cupSize) return false;
  S.cupSize = next;
  paintVessel();
  return true;
}
function dropInto(prevBottom) {
  S.scoops.forEach((sc) => {
    const was = prevBottom.get(sc);
    if (was != null && was > sc.bottom + 0.5) {
      sc.y += was - sc.bottom;
      sc.vy = 0;
      sc.falling = true;
    }
  });
  request();
}
function reseat(prev) {
  applyLang();
  layout();
  dropInto(new Map(S.scoops.map((sc, k) => [sc, prev[k]])));
}
function trimToCap() {
  const cap = scoopCap();
  if (S.scoops.length <= cap) return false;
  while (S.scoops.length > cap) {
    const sc = S.scoops.pop();
    sc.el.style.pointerEvents = 'none';
    const dir = S.scoops.length % 2 ? 1 : -1;
    if (gsap && !RM) {
      gsap.to(sc.el, { x: dir * S.hero.w * 0.28, y: -80, rotation: dir * 40, opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => sc.el.remove() });
    } else sc.el.remove();
  }
  if (S.crowns.size) moveCrownsToTop(false);
  return true;
}
function setVessel(id) {
  if ((id !== 'cone' && id !== 'cup') || id === S.vessel) return;
  const prev = S.scoops.map((sc) => sc.bottom);
  S.vessel = id;
  try { localStorage.setItem('drip.vessel', id); } catch (e) {}
  const trimmed = trimToCap();
  syncCupSize();
  reseat(prev);
  if (trimmed) toast(t('hero.trim.cone'));
}
function applyLang() {
  root.lang = S.lang; root.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  paintVessel();
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $('#langBtn').lang = S.lang === 'ar' ? 'en' : 'ar';
  buildTray(); buildCrowns(); buildRows(); renderTally(); renderBag(); updateOpen();
  setWord(currentFlavour(), false);
  try { localStorage.setItem('drip.lang', S.lang); } catch (e) {}
}

// ---------- theme ----------
function currentFlavour() {
  if (S.preview != null) return S.preview;
  const top = S.scoops[S.scoops.length - 1];
  if (top) return top.f;
  // The flavour the marquee is still offering, after a hover or a bag.
  if (S.held != null) return S.held;
  return S.lastF ?? 0;
}
function setTheme(i) {
  const f = FLAVOURS[i];
  root.style.setProperty('--bg', f.bg);
  root.style.setProperty('--deep', f.deep);
  root.style.setProperty('--ink', f.ink);
  root.style.setProperty('--word', f.id === 'fondente' ? '#FFF1E2' : f.ink);
  const m = $('meta[name="theme-color"]'); if (m) m.content = f.bg;
}

// ---------- giant word ----------
const giant = $('#giantTxt');
let wordKey = '';
const measureCtx = document.createElement('canvas').getContext('2d');
function fitWord(text) {
  const fam = '"' + (S.lang === 'ar' ? fontName('--drip-lalezar') : fontName('--drip-bagel')) + '"';
  measureCtx.font = `400 100px ${fam}, sans-serif`;
  const w100 = measureCtx.measureText(text).width || 600;
  const maxW = S.hero.w * (S.mobile ? 0.92 : 0.94);
  const maxH = S.hero.h * (S.mobile ? 0.105 : 0.23);
  const gs = Math.min(maxW / w100 * 100, maxH / (S.lang === 'ar' ? 1.05 : 0.8));
  root.style.setProperty('--gs', gs.toFixed(1) + 'px');
}
function setWord(i, animate = true) {
  const text = fl(i).word;
  const key = S.lang + ':' + text;
  fitWord(text);
  setTheme(i);
  if (key === wordKey) return;
  wordKey = key;
  const build = () => {
    giant.textContent = '';
    if (S.lang === 'ar') {
      const s = document.createElement('span'); s.className = 'ch'; s.textContent = text; giant.appendChild(s);
    } else {
      for (const c of text) {
        const s = document.createElement('span');
        if (c === ' ') { s.className = 'sp'; } else { s.className = 'ch'; s.textContent = c; }
        giant.appendChild(s);
      }
    }
    if (!animate || RM || !gsap) return;
    const chs = $$('.ch', giant);
    gsap.set(chs, { transformOrigin: '50% 100%' });
    chs.forEach((ch, k) => {
      gsap.timeline({ delay: k * 0.04 })
        .fromTo(ch, { yPercent: -150, scaleY: 1.25, scaleX: 0.85, opacity: 0 }, { yPercent: 0, scaleY: 1.25, scaleX: 0.85, opacity: 1, duration: 0.34, ease: 'power2.in' })
        .to(ch, { scaleY: 0.72, scaleX: 1.2, duration: 0.07, ease: 'power1.out' })
        .to(ch, { scaleY: 1.08, scaleX: 0.95, duration: 0.14, ease: 'power1.out' })
        .to(ch, { scaleY: 1, scaleX: 1, duration: 0.3, ease: 'elastic.out(1, .45)' });
    });
  };
  const old = $$('.ch', giant);
  if (animate && !RM && gsap && old.length) {
    gsap.killTweensOf(old);
    gsap.to(old, { yPercent: 70, opacity: 0, duration: 0.18, ease: 'power2.in', stagger: 0.012, onComplete: build });
  } else build();
}

// ---------- rig layout ----------
const hero = $('#hero'), rig = $('#rig'), rigInner = $('#rigInner'), stack = $('#stack');
let ghost = null;

function scoopH(f) { return S.sw * FLAVOURS[f].ratio; }
function slotPlaces(list) {
  const v = metrics();
  if (v.glass && list.length) {
    return cupPlaces(list.map((sc) => FLAVOURS[sc.f].ratio), v).map((p) => ({
      bottom: p.bottom * S.cw, x: p.x * S.cw, lean: p.lean, z: p.z,
    }));
  }
  const coneH = S.cw * v.ratio;
  const out = []; let prevTop = 0, prevH = 0;
  list.forEach((sc, k) => {
    const h = scoopH(sc.f);
    const b = k === 0 ? coneH * (1 - v.rim) - SEAT * h : prevTop - NEST * prevH - SEAT * h;
    out.push({ bottom: b, x: 0, lean: 0, z: k + 1 });
    prevTop = b + h; prevH = h;
  });
  return out;
}
function zoomFor(n) {
  const v = metrics();
  const cap = v.maxScoops || 3;
  return clamp(heightFor(cap) / heightFor(Math.max(1, n)), 1, v.glass ? 1.08 : 1.3);
}

function layout() {
  const r = hero.getBoundingClientRect();
  S.hero.w = r.width || window.innerWidth || document.documentElement.clientWidth || 1280;
  S.hero.h = r.height || window.innerHeight || 800;
  S.mobile = S.hero.w <= 760;
  const navH = S.mobile ? 62 : 72;
  let tip;
  if (S.mobile) {
    const bar = $('#conePanel').getBoundingClientRect().height || 56;
    const tray = $('#tray').getBoundingClientRect().height || 90;
    root.style.setProperty('--barh', Math.round(bar + 8) + 'px');
    root.style.setProperty('--trayh', Math.round(tray) + 'px');
    tip = bar + tray + 30;
  } else tip = Math.max(S.hero.h * 0.04, 24);
  // the stack may rise behind the giant word, never over the eyebrow line above it
  const eb = $('.hero__eyebrow').getBoundingClientRect();
  const topLimit = Math.max(navH + 10, (eb.bottom - r.top) + 6 || 0);
  const avail = S.hero.h - tip - topLimit;
  const v = metrics();
  const cap = v.maxScoops || 3;
  let cw = avail / heightFor(cap);
  cw = Math.min(cw, S.hero.w * (S.mobile ? v.maxPhone : v.maxDesk));
  S.cw = cw; S.sw = cw * v.scoop;
  root.style.setProperty('--cw', cw.toFixed(2) + 'px');
  root.style.setProperty('--sw', S.sw.toFixed(2) + 'px');
  root.style.setProperty('--tip', tip.toFixed(1) + 'px');
  placeSlots(false);
  fitWord(fl(currentFlavour()).word);
  sizeDrips();
}

// place every scoop on its slot; if `fall`, scoops keep their screen height and fall into the new slot
function placeSlots(fall) {
  if (metrics().glass) root.style.setProperty('--vr', heightFor(Math.max(1, S.scoops.length)).toFixed(4));
  const places = slotPlaces(S.scoops);
  S.scoops.forEach((sc, k) => {
    const p = places[k];
    if (fall && sc.bottom != null && sc.bottom > p.bottom + 0.5) { sc.y += sc.bottom - p.bottom; sc.vy = Math.min(sc.vy, 0); sc.falling = true; }
    sc.bottom = p.bottom;
    sc.homeX = p.x;
    sc.lean = p.lean;
    if (sc.x == null) sc.x = p.x;
    sc.el.style.bottom = p.bottom.toFixed(2) + 'px';
    sc.el.style.zIndex = String(10 + p.z);
  });
  S.zoomT = zoomFor(S.scoops.length);
  if (ghost) placeGhost();
}

// ---------- scoops ----------
function makeScoopEl(f, cls = 'scoop') {
  const el = document.createElement('div');
  el.className = cls;
  const img = new Image();
  img.src = scoopSrc(f, "");
  img.alt = ''; img.draggable = false; img.width = 900; img.height = Math.round(900 * FLAVOURS[f].ratio);
  el.appendChild(img);
  return el;
}

function addScoop(f, opts = {}) {
  if (S.scoops.length >= scoopCap()) {
    toast(t(S.vessel === 'cup' ? 'hero.max.large' : 'hero.max'));
    S.thetaV += 140 * (Math.random() > 0.5 ? 1 : -1);
    return false;
  }
  S.lastF = f;
  S.held = f;
  const el = makeScoopEl(f);
  el.dataset.f = f;
  el.setAttribute('aria-hidden', 'true');
  stack.appendChild(el);
  const sc = { f, el, y: 0, vy: 0, sy: 1, vsy: 0, tilt: 0, vtilt: 0, falling: false, bits: [] };
  const prevBottom = new Map(S.scoops.map((row) => [row, row.bottom]));
  S.scoops.push(sc);
  const changed = syncCupSize();
  if (changed) layout();
  else placeSlots(false);
  if (changed) dropInto(prevBottom);
  if (!opts.instant && !RM) {
    sc.y = (S.hero.h * 1.05) / S.zoom; sc.vy = -200; sc.falling = true;
  }
  if (opts.hidden) el.style.visibility = 'hidden';
  // crowns always live on the top scoop
  if (S.crowns.size) moveCrownsToTop(!opts.instant);
  S.preview = null;
  setWord(f, !opts.instant);
  renderTally(); updateGhost();
  return sc;
}

function removeScoop(k) {
  const sc = S.scoops[k]; if (!sc) return;
  const wasTop = k === S.scoops.length - 1;
  const prevBottom = new Map(S.scoops.map((row) => [row, row.bottom]));
  S.scoops.splice(k, 1);
  sc.el.style.pointerEvents = 'none';
  const dir = Math.random() > 0.5 ? 1 : -1;
  if (gsap && !RM) {
    const r = sc.el.getBoundingClientRect();
    gsap.to(sc.el, { x: dir * (S.hero.w * 0.3), y: -S.hero.h * 0.12, rotation: dir * 50, opacity: 0, duration: 0.55, ease: 'power2.out', onComplete: () => sc.el.remove() });
    void r;
  } else sc.el.remove();
  const changed = syncCupSize();
  if (changed) { layout(); dropInto(prevBottom); }
  else placeSlots(true);
  if (S.crowns.size && wasTop) moveCrownsToTop(true);
  if (!S.scoops.length) {
    // The shopper took the last scoop off. Do not keep offering it on Add.
    S.held = null;
    S.lastF = null;
    clearBits();
  }
  setWord(currentFlavour(), true);
  renderTally(); updateGhost();
}

function resetCone(silent) {
  const n = S.scoops.length;
  for (let k = n - 1; k >= 0; k--) {
    const sc = S.scoops[k];
    if (silent || !gsap || RM) { sc.el.remove(); continue; }
    const dir = k % 2 ? 1 : -1;
    gsap.to(sc.el, { x: dir * S.hero.w * 0.28, y: -S.hero.h * 0.15, rotation: dir * 60, opacity: 0, duration: 0.5, delay: (n - 1 - k) * 0.08, ease: 'power2.out', onComplete: () => sc.el.remove() });
  }
  S.scoops = [];
  S.crowns.clear();
  S.held = null;
  S.lastF = null;
  buildCrowns();
  if (syncCupSize()) layout();
  else placeSlots(false);
  setWord(currentFlavour(), false);
  renderTally(); updateGhost();
}

// ---------- ghost preview (desktop hover) ----------
function updateGhost() {
  const show = S.preview != null && S.scoops.length < scoopCap() && !S.mobile && !RM;
  if (!show) { if (ghost) { ghost.remove(); ghost = null; } return; }
  if (!ghost || +ghost.dataset.f !== S.preview) {
    if (ghost) ghost.remove();
    ghost = makeScoopEl(S.preview, 'scoop scoop--ghost');
    ghost.dataset.f = S.preview;
    ghost.style.opacity = '0.45'; ghost.style.pointerEvents = 'none';
    stack.appendChild(ghost);
  }
  placeGhost();
}
function placeGhost() {
  if (!ghost) return;
  const list = [...S.scoops, { f: +ghost.dataset.f }];
  const p = slotPlaces(list).at(-1);
  ghost.style.bottom = p.bottom + 'px';
  ghost.style.zIndex = String(10 + p.z);
  ghost._homeX = p.x;
  ghost._lean = p.lean;
}

// ---------- crowns (topping bits) ----------
function clearBits() { S.scoops.forEach((sc) => { sc.bits.forEach((b) => b.el.remove()); sc.bits = []; }); }
function moveCrownsToTop(animate) {
  clearBits();
  const top = S.scoops[S.scoops.length - 1];
  if (!top) return;
  let delay = animate ? 0.35 : 0;
  for (const id of S.crowns) { dropBits(top, id, animate, delay); delay += 0.08; }
}
function dropBits(sc, id, animate, delay = 0) {
  const c = CROWNS.find((x) => x.id === id);
  // A sprite sheet is not a cut-out. `src` on the same crown is the catalogue
  // photo of that sheet; painting it as one thumbnail hides the bits.
  const sheet = c && c.atlas && META && META[c.atlas] ? META[c.atlas] : null;
  if (!sheet && c && c.src) {
    const el = document.createElement("i");
    el.className = "bit";
    el.style.cssText = `left:50%;top:18%;width:calc(var(--sw) * 0.22);height:calc(var(--sw) * 0.22);background-image:url(${art(c.src)});background-size:contain;background-repeat:no-repeat;margin:calc(var(--sw) * -0.11) 0 0 calc(var(--sw) * -0.11)`;
    const bit = { el, y: 0, vy: 0, rot: 0, delay: 0, bounced: false, id };
    sc.el.appendChild(el);
    sc.bits.push(bit);
    return;
  }
  const m = sheet;
  if (!m || !c) return;
  const rects = m.rects.filter((r) => r[2] > 22 && r[3] > 22);
  const N = S.mobile ? 9 : 12;
  for (let i = 0; i < N; i++) {
    const r = rects[(i * 7 + id.length * 3) % rects.length];
    // a point on the visible top of the ball: circle centred at (50%, 50%), radius ~47%
    const yPct = 5 + Math.random() * 24;
    const half = Math.sqrt(Math.max(0, 47 * 47 - (50 - yPct) ** 2));
    const xPct = 50 + (Math.random() * 2 - 1) * half * 0.78;
    const k = ((c.atlas === 'bits-rose' || id === 'rose') ? 0.13 : 0.1) * (0.75 + Math.random() * 0.5); // bit width / scoop width
    const sc_ = k / r[2]; // px per atlas px, in units of --sw
    const el = document.createElement('i');
    el.className = 'bit';
    el.style.cssText = `left:${xPct}%;top:${yPct}%;width:calc(var(--sw) * ${k.toFixed(4)});height:calc(var(--sw) * ${(r[3] * sc_).toFixed(4)});` +
      `background-image:url(${art(c.atlas + '.webp')});background-size:calc(var(--sw) * ${(m.w * sc_).toFixed(4)}) calc(var(--sw) * ${(m.h * sc_).toFixed(4)});` +
      `background-position:calc(var(--sw) * ${(-r[0] * sc_).toFixed(4)}) calc(var(--sw) * ${(-r[1] * sc_).toFixed(4)});margin:calc(var(--sw) * ${(-k / 2).toFixed(4)}) 0 0 calc(var(--sw) * ${(-k / 2).toFixed(4)});`;
    const bit = { el, y: 0, vy: 0, rot: Math.random() * 360, delay: 0, bounced: false, id };
    if (animate && !RM) { bit.y = S.hero.h * 0.5 + Math.random() * 120; bit.vy = 0; bit.delay = delay + i * 0.035; el.style.visibility = 'hidden'; }
    el.style.transform = `translateY(${-bit.y}px) rotate(${bit.rot}deg)`;
    sc.el.appendChild(el);
    sc.bits.push(bit);
  }
}
function toggleCrown(id) {
  if (S.crowns.has(id)) {
    S.crowns.delete(id);
    S.scoops.forEach((sc) => {
      sc.bits = sc.bits.filter((b) => {
        if (b.id !== id) return true;
        if (gsap && !RM) gsap.to(b.el, { y: -40, opacity: 0, duration: 0.3, onComplete: () => b.el.remove() }); else b.el.remove();
        return false;
      });
    });
  } else {
    S.crowns.add(id);
    const top = S.scoops[S.scoops.length - 1];
    if (top) dropBits(top, id, true);
  }
  buildCrowns(); renderTally();
}

// ---------- physics loop ----------
let last = 0, rafOn = false;
function tick(now) {
  rafOn = false;
  const dt = Math.min(0.033, Math.max(0.001, (now - (last || now)) / 1000));
  last = now; S.t += dt;
  step(dt);
  if (S.heroVisible || S.busy) request();
}
function request() { if (!rafOn) { rafOn = true; requestAnimationFrame(tick); } }

function step(dt) {
  // rig sway: idle breathing, or follow the hand
  const sway = metrics().sway;
  const idle = RM ? 0 : Math.sin(S.t * 0.9) * 1.3 * sway;
  const target = S.drag ? S.thetaT : idle;
  const k = S.drag ? 220 : 70, c = S.drag ? 22 : 5.5;
  const prevV = S.thetaV;
  S.thetaV += (-(S.theta - target) * k - S.thetaV * c) * dt;
  S.theta += S.thetaV * dt;
  const alpha = (S.thetaV - prevV) / dt; // angular acceleration, deg/s^2
  // vertical give when a scoop lands
  S.dyV += (-S.dy * 260 - S.dyV * 16) * dt; S.dy += S.dyV * dt;
  // camera: pull back as the stack grows
  S.zoomV = (S.zoomV || 0) + (-(S.zoom - S.zoomT) * 60 - (S.zoomV || 0) * 13) * dt;
  S.zoom += S.zoomV * dt;

  const g = 6200;
  let ox = 0;
  const packed = !!metrics().glass;
  S.scoops.forEach((sc, i) => {
    if (sc.falling) {
      sc.vy -= g * dt; sc.y += sc.vy * dt;
      if (sc.y <= 0) {
        const impact = -sc.vy;
        sc.y = 0; sc.vy = 0; sc.falling = false;
        sc.sy = 1 - Math.min(0.3, impact / 11000); sc.vsy = 0;
        const below = S.scoops[i - 1];
        if (below) { below.vsy -= impact * 0.00006 * 60; }
        S.dyV += impact * 0.05;
        if (sc.onLand) { const f = sc.onLand; sc.onLand = null; f(); }
      }
    } else {
      sc.vsy += (-(sc.sy - 1) * 420 - sc.vsy * 11) * dt; sc.sy += sc.vsy * dt;
    }
    // follow-through: each scoop lags the cone's swing, more the higher it sits
    sc.vtilt += (-(sc.tilt + S.thetaV * 0.016 * (i + 1)) * 170 - sc.vtilt * 7 - alpha * 0.002 * (i + 1)) * dt;
    sc.tilt += sc.vtilt * dt;
    sc.tilt = clamp(sc.tilt, -14, 14);
    const sy = clamp(sc.sy, 0.6, 1.4), sx = 1 / Math.sqrt(sy);
    if (sc.x == null) sc.x = sc.homeX || 0;
    sc.x += ((sc.homeX || 0) - sc.x) * Math.min(1, dt * 7);
    const slide = packed ? sc.x : sc.x + ox;
    sc.el.style.transform = `translate(calc(-50% + ${slide.toFixed(2)}px), ${(-sc.y).toFixed(2)}px) rotate(${(sc.tilt + (sc.lean || 0)).toFixed(3)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
    if (!packed) ox += Math.sin(sc.tilt * Math.PI / 180) * scoopH(sc.f) * 0.7;
    if (sc.el.style.visibility === 'hidden' && !sc.hold) sc.el.style.visibility = '';
    // topping bits falling onto this scoop
    for (const b of sc.bits) {
      if (b.y <= 0 && b.bounced) continue;
      if (b.delay > 0) { b.delay -= dt; continue; }
      b.el.style.visibility = '';
      b.vy -= g * 0.8 * dt; b.y += b.vy * dt;
      if (b.y <= 0) { if (!b.bounced && b.vy < -300) { b.vy = -b.vy * 0.22; b.bounced = true; b.y = 0.01; } else { b.y = 0; b.bounced = true; } }
      b.el.style.transform = `translateY(${(-b.y).toFixed(1)}px) rotate(${b.rot.toFixed(0)}deg)`;
    }
  });
  if (ghost) {
    const bob = RM ? 0 : 26 + Math.sin(S.t * 3.2) * 8;
    const gx = ghost._homeX || 0;
    ghost.style.transform = `translate(calc(-50% + ${gx.toFixed(1)}px), ${-bob}px) rotate(${ghost._lean || 0}deg)`;
  }
  const f = S.fly;
  rig.style.transform = `translate(${f.x.toFixed(1)}px, ${(S.dy + S.enterY + f.y).toFixed(2)}px) rotate(${f.r.toFixed(2)}deg) scale(${(S.zoom * f.s).toFixed(4)})`;
  rigInner.style.transform = `rotate(${S.theta.toFixed(3)}deg)`;
}

// ---------- grab the cone ----------
function initDrag() {
  let start = null;
  rig.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, target: e.target.closest('.scoop'), moved: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!start.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      start.moved = true; S.drag = true; rig.classList.add('is-grab');
      try { rig.setPointerCapture(e.pointerId); } catch (err) {}
    }
    if (start.moved) { const sway = metrics().sway; S.thetaT = clamp(dx * 0.11, -18 * sway, 18 * sway); }
  });
  const end = (e) => {
    if (!start || (e && e.pointerId !== start.id)) return;
    if (!start.moved && start.target) {
      const k = S.scoops.findIndex((s) => s.el === start.target);
      if (k >= 0) removeScoop(k);
    }
    S.drag = null; rig.classList.remove('is-grab'); start = null;
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

// ---------- tray, crowns, tally ----------
function buildTray() {
  const tray = $('#tray'); tray.textContent = '';
  const top = S.scoops[S.scoops.length - 1];
  FLAVOURS.forEach((f, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sw' + (top && top.f === i ? ' is-top' : '');
    b.innerHTML = `<img src="${scoopSrc(i, "t")}" alt="" width="220" height="${Math.round(220 * f.ratio)}" draggable="false"><span>${f[S.lang].name}</span>`;
    b.setAttribute('aria-label', `${f[S.lang].name}, ${t('aria.add')}`);
    b.addEventListener('click', () => { addScoop(i); bumpSwatch(b); });
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') previewOn(i); });
    b.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') previewOff(); });
    b.addEventListener('focus', () => { if (!S.mobile) previewOn(i); });
    b.addEventListener('blur', () => previewOff());
    tray.appendChild(b);
  });
}
function bumpSwatch(b) {
  if (!gsap || RM) return;
  const im = b.querySelector('img');
  gsap.fromTo(im, { y: 0 }, { y: -26, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 });
}
let previewTimer = 0;
function previewOn(i) {
  clearTimeout(previewTimer);
  // The marquee names this flavour while the pointer is on it. Remember it
  // so Add can still drop it if the pointer leaves for the button.
  previewTimer = setTimeout(() => { S.preview = i; S.held = i; setWord(i, true); updateGhost(); renderTally(); }, 90);
}
function previewOff() {
  clearTimeout(previewTimer);
  if (S.preview == null) return;
  previewTimer = setTimeout(() => { S.preview = null; setWord(currentFlavour(), true); updateGhost(); }, 140);
}

function buildCrowns() {
  const box = $('#crowns'); box.textContent = '';
  CROWNS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.setAttribute('aria-pressed', S.crowns.has(c.id) ? 'true' : 'false');
    b.setAttribute('aria-label', `${c[S.lang]}, +${nf(PRICE.crown)} ${t('currency')}`);
    const m = META && c.atlas && META[c.atlas];
    let icon = '';
    if (m) {
      const r = m.rects[0]; const s = 24 / Math.max(r[2], r[3]);
      icon = `<i style="background-image:url(${art(c.atlas + '.webp')});background-size:${(m.w * s).toFixed(1)}px ${(m.h * s).toFixed(1)}px;background-position:${(-r[0] * s + (24 - r[2] * s) / 2).toFixed(1)}px ${(-r[1] * s + (24 - r[3] * s) / 2).toFixed(1)}px"></i>`;
    } else if (c.src) {
      icon = `<i style="background-image:url(${art(c.src)});background-size:contain;background-repeat:no-repeat"></i>`;
    }
    b.innerHTML = `${icon}<span>${c[S.lang]}</span>`;
    b.addEventListener('click', () => toggleCrown(c.id));
    box.appendChild(b);
  });
}

const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function crownExtra(crowns) {
  if (typeof crowns === "number") return crowns * (PRICE.crown || 0)
  const ids = crowns && crowns.size != null ? [...crowns] : crowns || []
  if (PRICE.crownById) {
    let extra = 0
    for (const id of ids) extra += PRICE.crownById[id] ?? PRICE.crown ?? 0
    return extra
  }
  return ids.length * (PRICE.crown || 0)
}
function priceNow(n = S.scoops.length, crowns = S.crowns) {
  if (!n) return 0
  const scoop = PRICE.scoops[n] ?? PRICE.scoops[PRICE.scoops.length - 1] ?? 0
  return scoop + crownExtra(crowns)
}
function renderTally() {
  const n = S.scoops.length;
  const list = $('#tally'); list.textContent = '';
  if (!n) {
    const li = document.createElement('li'); li.className = 't-empty'; li.textContent = t(S.vessel === 'cup' ? 'hero.empty.cup' : 'hero.empty'); list.appendChild(li);
  }
  [...S.scoops].reverse().forEach((sc) => {
    const k = S.scoops.indexOf(sc);
    const li = document.createElement('li');
    const f = FLAVOURS[sc.f];
    li.innerHTML = `<img src="${scoopSrc(sc.f, "t")}" alt="" width="220" height="${Math.round(220 * f.ratio)}"><span class="t-n">${f[S.lang].name}</span>`;
    const b = document.createElement('button'); b.type = 'button'; b.innerHTML = X_ICON;
    b.setAttribute('aria-label', t('hero.remove', { n: f[S.lang].name }));
    b.addEventListener('click', () => removeScoop(k));
    li.appendChild(b); list.appendChild(li);
  });
  $('#scoopCount').textContent = n === 1 ? t('scoop.1') : n ? t('scoop.n', { n: nf(n) }) : '';
  // A cone with no scoop still has a flavour when the marquee is showing one
  // the shopper just pointed at or just bagged. Price that single scoop.
  // Start over clears `held`, and that empty cone stays at 0 and disabled.
  const offer = !n && S.held != null ? 1 : n;
  $('#price').innerHTML = `<bdi>${nf(priceNow(offer))}</bdi> <span>${t('currency')}</span>`;
  $('#addBtn').disabled = !offer || !!S.submitting;
  const top = S.scoops[n - 1];
  $$('#tray .sw').forEach((b, i) => b.classList.toggle('is-top', !!top && top.f === i));
}

// ---------- toast ----------
let toastT = 0;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 2600);
}

// ---------- bag ----------
function lineSize(x) { return x && x.v === 'cup' ? sizeForCount(x.s.length) : 'regular'; }
function loadBag() {
  // The shop bag is the server cart. Drop any demo copy so a reload cannot
  // paint scoops the back-end does not have.
  if (shopCart) {
    try { localStorage.removeItem('drip.bag'); } catch (e) {}
    S.bag = [];
    S.subtotalCents = 0;
    return;
  }
  try { S.bag = JSON.parse(localStorage.getItem('drip.bag') || '[]').filter((x) => Array.isArray(x.s) && x.s.length).map((x) => ({ ...x, v: x.v === 'cup' ? 'cup' : 'cone', size: x.v === 'cup' ? sizeForCount(x.s.length) : 'regular' })); } catch (e) { S.bag = []; }
}
function saveBag() {
  if (shopCart) return;
  try { localStorage.setItem('drip.bag', JSON.stringify(S.bag)); } catch (e) {}
}
function moneyHtml(cents) {
  return `<bdi>${shopCart.formatCents(cents, S.lang)}</bdi>`;
}
function bagCount() { return S.bag.reduce((a, x) => a + x.q, 0); }
function itemPrice(x) { return priceNow(x.s.length, x.c) * x.q; }
function updateBagBtn(bump) {
  const n = bagCount();
  const el = $('#bagCount');
  el.innerHTML = `<bdi>${nf(n)}</bdi>`;
  if (bump && gsap && !RM) {
    gsap.fromTo(el.firstChild, { yPercent: 100 }, { yPercent: 0, duration: 0.45, ease: 'back.out(2.4)' });
    const b = $('#bagBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }
}

function addToBag() {
  if (S.submitting) return;
  // The marquee can name a flavour the cone is not holding: a hover, or the
  // flavour just bagged. Drop that scoop first so Add is never a no-op on it.
  // A cone emptied with Start over has no held flavour and still does not add.
  if (!S.scoops.length) {
    if (S.held == null) return;
    addScoop(S.held, { instant: true });
  }
  const n = S.scoops.length;
  if (!n) return;
  const bagged = S.scoops.slice();
  const baggedCrowns = [...S.crowns];
  const item = { s: bagged.map((x) => x.f), c: baggedCrowns.slice(), q: 1, v: S.vessel, size: S.vessel === 'cup' ? sizeForCount(n) : 'regular' };
  const topF = bagged[bagged.length - 1].f;
  const fly = () => {
    let settled = false;
    const done = () => {
      if (settled || !alive) return;
      settled = true;
      updateBagBtn(true); renderBag();
      toast(t('hero.added'));
      // Only the scoops that were submitted leave. A flavour picked while
      // this one flies to the bag stays on the cone.
      const kept = S.scoops.filter((sc) => !bagged.includes(sc));
      for (const sc of bagged) sc.el.remove();
      S.scoops = kept;
      if (!kept.length) {
        for (const id of baggedCrowns) S.crowns.delete(id);
        buildCrowns();
      }
      syncCupSize();
      layout();
      S.zoom = S.zoomT;
      S.fly = { x: 0, y: 0, s: 1, r: 0 };
      S.busy = false;
      S.submitting = false;
      if (!S.scoops.length && topF != null) addScoop(topF, { instant: true });
      else { renderTally(); setWord(currentFlavour(), true); }
      // a fresh cone rises from below; this must not keep Add locked
      if (gsap && !RM) {
        S.enterY = S.hero.h * 0.9;
        gsap.to(S, { enterY: 0, duration: 0.9, ease: 'back.out(1.3)' });
      }
    };
    if (!gsap || RM) { done(); return; }
    S.busy = true; request();
    const bb = $('#bagBtn').getBoundingClientRect();
    const rr = rig.getBoundingClientRect();
    const tx = bb.left + bb.width / 2 - (rr.left + rr.width / 2);
    const ty = bb.top + bb.height / 2 - (rr.top + rr.height * 0.35);
    const tl = gsap.timeline({ onComplete: done });
    tl.to(S.fly, { y: -40, s: 1.04, r: tx > 0 ? -6 : 6, duration: 0.22, ease: 'power2.out' })
      .to(S.fly, { x: tx, duration: 0.62, ease: 'power2.in' }, '>')
      .to(S.fly, { y: ty, s: 0.06, r: tx > 0 ? 28 : -28, duration: 0.62, ease: 'power3.in' }, '<');
    setTimeout(done, 2200);
  };
  const release = () => { S.submitting = false; S.busy = false; renderTally(); };
  if (shopCart) {
    S.submitting = true;
    S.busy = true;
    renderTally();
    const line = { scoops: item.s.slice(), crowns: item.c.slice(), quantity: 1, vessel: item.v === 'cup' ? 'cup' : 'cone' };
    Promise.resolve(shopCart.persistLine(line)).then((ok) => {
      if (!alive) return;
      if (!ok) { release(); toast(t('bag.checkoutFail')); return; }
      fly();
    }).catch(() => {
      if (!alive) return;
      release();
      toast(t('bag.checkoutFail'));
    });
    return;
  }
  const same = S.bag.find((x) => x.v === item.v && lineSize(x) === item.size && x.s.join() === item.s.join() && x.c.slice().sort().join() === item.c.slice().sort().join());
  if (same) same.q++; else S.bag.push(item);
  saveBag();
  fly();
}

const bagEl = $('#bag');
let lastFocus = null;
function openBag() {
  renderBag();
  lastFocus = document.activeElement;
  bagEl.hidden = false; void bagEl.offsetWidth; bagEl.classList.add('is-open');
  if (lenis) lenis.stop();
  root.style.overflow = 'hidden';
  setTimeout(() => { const x = $('.bag__x', bagEl); x && x.focus({ preventScroll: true }); }, 60);
}
function closeBag() {
  bagEl.classList.remove('is-open');
  root.style.overflow = '';
  if (lenis) lenis.start();
  setTimeout(() => { if (!bagEl.classList.contains('is-open')) bagEl.hidden = true; }, 600);
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  if (S.bagView === 'done') { S.bagView = 'list'; renderBag(); }
}

function miniCone(sList, cList, boxH = 110, id = 'cone', size = 'regular') {
  const v = metrics(id, size);
  const n = sList.length;
  const span = heightFor(Math.max(1, n), 0.97, id, size);
  let cw = boxH / span;
  if (v.glass) cw = Math.min(cw, size === 'large' ? 74 : 56);
  const hpx = cw * span;
  const el = document.createElement('div'); el.className = 'mini' + (v.glass ? ' mini--cup' : '');
  el.style.cssText = `position:relative;width:${Math.max(v.glass ? cw : cw * v.scoop, 40).toFixed(1)}px;height:${hpx.toFixed(1)}px`;
  const sw = cw * v.scoop;
  let prevTop = 0, prevH = 0;
  const scoops = v.glass
    ? cupPlaces(sList.map((f) => FLAVOURS[f].ratio), v).map((p, k) => ({ f: sList[k], b: p.bottom * cw, x: p.x * cw, lean: p.lean, z: p.z }))
    : sList.map((f, k) => {
      const h = sw * FLAVOURS[f].ratio;
      const b = k === 0 ? cw * v.ratio * (1 - v.rim) - SEAT * h : prevTop - NEST * prevH - SEAT * h;
      prevTop = b + h; prevH = h;
      return { f, b, x: 0, lean: 0, z: k + 1 };
    });
  const pile = document.createElement('div');
  // The hero stack sits above the cone (z-index 2 vs the cone's 1) and the
  // glass sits above that. The bag used to leave this pile at auto, so the
  // waffle (z-index 1) covered the lower scoop and a mixed cone read as two
  // of the top flavour.
  pile.style.cssText = 'position:absolute;inset:0;z-index:2';
  if (v.glass) pile.style.clipPath = 'inset(-70% 3% 2% 3%)';
  if (!v.glass) {
    const cone = new Image(); cone.src = art(v.file); cone.alt = ''; cone.className = 'rig__cone';
    cone.style.cssText = `width:${cw.toFixed(1)}px;left:50%;margin-left:${(-cw / 2).toFixed(1)}px`;
    el.appendChild(cone);
  }
  scoops.forEach((s) => {
    const im = new Image(); im.src = scoopSrc(s.f, "t"); im.alt = '';
    im.style.cssText = `position:absolute;left:50%;width:${sw.toFixed(1)}px;bottom:${s.b.toFixed(1)}px;z-index:${s.z};transform:translate(calc(-50% + ${s.x.toFixed(1)}px), 0) rotate(${s.lean}deg)`;
    pile.appendChild(im);
  });
  el.appendChild(pile);
  if (v.glass) {
    const cup = new Image(); cup.src = art(v.file); cup.alt = ''; cup.className = 'rig__cone';
    cup.style.cssText = 'width:100%;left:0;bottom:0;height:auto;z-index:5';
    el.appendChild(cup);
  }
  void cList;
  return el;
}

function describe(x) {
  const names = x.s.map((f) => (FLAVOURS[f] ? FLAVOURS[f][S.lang].name : '')).filter(Boolean).join(S.lang === 'ar' ? '، ' : ', ');
  const crowns = x.c.map((id) => { const row = CROWNS.find((c) => c.id === id); return row ? row[S.lang] : ''; }).filter(Boolean).join(S.lang === 'ar' ? ' و' : ' + ');
  const size = x.v === 'cup' ? t(lineSize(x) === 'large' ? 'hero.size.large' : 'hero.size.regular') : '';
  return { names, sub: (x.s.length === 1 ? t('scoop.1') : t('scoop.n', { n: nf(x.s.length) })) + (size ? ' · ' + size : '') + (crowns ? ', ' + t('crown.with', { c: crowns }) : '') };
}

function renderBag() {
  const body = $('#bagBody'); body.textContent = '';
  if (S.bagView === 'done') {
    const d = document.createElement('div'); d.className = 'bag__done';
    d.innerHTML = `<h3>${t('bag.done.h', { c: '<bdi>' + S.orderCode + '</bdi>' })}</h3><p>${t('bag.done.p')}</p><p class="demo">${t('bag.done.demo')}</p>`;
    const again = document.createElement('button'); again.type = 'button'; again.className = 'btn btn--ink'; again.textContent = t('bag.done.again');
    again.addEventListener('click', () => { closeBag(); goCounter(); });
    d.appendChild(again); body.appendChild(d); return;
  }
  if (!S.bag.length) {
    const d = document.createElement('div'); d.className = 'bag__empty';
    d.insertAdjacentHTML('afterbegin', `<img src="${art(metrics().file)}" alt="" width="70">`);
    d.insertAdjacentHTML('beforeend', `<p>${t('bag.empty')}</p>`);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--ink'; b.textContent = t('bag.build');
    b.addEventListener('click', () => { closeBag(); goCounter(); });
    d.appendChild(b); body.appendChild(d); return;
  }
  const ul = document.createElement('ul'); ul.className = 'bag__list';
  S.bag.forEach((x, idx) => {
    const li = document.createElement('li'); li.className = 'line';
    li.appendChild(miniCone(x.s, x.c, 110, x.v, lineSize(x)));
    const d = describe(x);
    const mid = document.createElement('div');
    mid.innerHTML = `<p class="line__t">${d.names}</p><p class="line__s">${d.sub}</p>`;
    const q = document.createElement('div'); q.className = 'line__q';
    q.innerHTML = `<button type="button" aria-label="${t('bag.dec')}">&minus;</button><span><bdi>${nf(x.q)}</bdi></span><button type="button" aria-label="${t('bag.inc')}">+</button>`;
    const [dec, inc] = q.querySelectorAll('button');
    const shopChange = (next) => {
      if (!x.id) return;
      const job = next <= 0 ? shopCart.removeLine(x.id) : shopCart.setQuantity(x.id, next);
      Promise.resolve(job).then((ok) => {
        if (!alive || ok) return;
        toast(t('bag.checkoutFail'));
      }).catch(() => { if (alive) toast(t('bag.checkoutFail')); });
    };
    dec.addEventListener('click', () => {
      if (shopCart) { shopChange(x.q - 1); return; }
      x.q--; if (x.q <= 0) S.bag.splice(idx, 1); saveBag(); renderBag(); updateBagBtn();
    });
    inc.addEventListener('click', () => {
      if (shopCart) { shopChange(x.q + 1); return; }
      x.q++; saveBag(); renderBag(); updateBagBtn();
    });
    mid.appendChild(q);
    const p = document.createElement('div'); p.className = 'line__p';
    p.innerHTML = `<span>${shopCart && typeof x.totalCents === 'number' ? moneyHtml(x.totalCents) : `<bdi>${nf(itemPrice(x))}</bdi> ${t('currency')}`}</span>`;
    const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'line__rm'; rm.textContent = t('bag.remove');
    rm.addEventListener('click', () => {
      if (shopCart) { shopChange(0); return; }
      S.bag.splice(idx, 1); saveBag(); renderBag(); updateBagBtn();
    });
    p.appendChild(rm);
    li.append(mid, p); ul.appendChild(li);
  });
  body.appendChild(ul);
  const total = S.bag.reduce((a, x) => a + itemPrice(x), 0);
  const sumHtml = shopCart && typeof S.subtotalCents === 'number'
    ? moneyHtml(S.subtotalCents)
    : `<bdi>${nf(total)}</bdi> ${t('currency')}`;
  const foot = document.createElement('form'); foot.className = 'bag__foot'; foot.noValidate = true;
  if (shopCart) {
    foot.innerHTML = `<div class="bag__sum"><span>${t('bag.subtotal')}</span><span>${sumHtml}</span></div>
      <p class="field__err" id="bagErr" role="alert"></p>
      <button class="btn btn--ink" type="submit">${t('bag.checkout')}</button>`;
    foot.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#bagErr');
      const btn = $('button', foot);
      btn.disabled = true;
      let ok = false;
      try { ok = await shopCart.goCheckout(); } catch (err2) { ok = false; }
      if (!alive) return;
      if (!ok) { err.textContent = t('bag.checkoutFail'); btn.disabled = false; return; }
      closeBag();
    });
  } else if (typeof opts.getCheckout === 'function') {
    const ready = !!opts.getCheckout();
    foot.innerHTML = `<div class="bag__sum"><span>${t('bag.subtotal')}</span><span>${sumHtml}</span></div>
      <p class="field__err" id="bagErr" role="alert"></p>
      <button class="btn btn--ink" type="submit"${ready ? '' : ' disabled'}>${t('bag.checkout')}</button>`;
    foot.addEventListener('submit', async (e) => {
      e.preventDefault();
      const go = opts.getCheckout();
      const err = $('#bagErr');
      const btn = $('button', foot);
      if (!go) { err.textContent = t('bag.checkoutFail'); return; }
      btn.disabled = true;
      const lines = S.bag.map((x) => ({
        scoops: x.s.slice(),
        crowns: x.c.slice(),
        quantity: x.q,
        vessel: x.v === 'cup' ? 'cup' : 'cone',
      }));
      let ok = false;
      try { ok = await go(lines); } catch (err2) { ok = false; }
      if (!alive) return;
      if (!ok) { err.textContent = t('bag.checkoutFail'); btn.disabled = false; return; }
      S.bag = []; saveBag(); updateBagBtn();
      closeBag();
    });
  } else {
    foot.innerHTML = `<div class="bag__sum"><span>${t('bag.subtotal')}</span><span>${sumHtml}</span></div>
      <label class="field">${t('bag.name')}<input name="name" autocomplete="given-name" required maxlength="40" value="${S.pickName ? S.pickName.replace(/"/g, '&quot;') : ''}"></label>
      <label class="field">${t('bag.when')}<select name="when"><option value="asap">${t('bag.asap')}</option><option value="15">${t('bag.m15')}</option><option value="30">${t('bag.m30')}</option><option value="45">${t('bag.m45')}</option></select></label>
      <p class="field__err" id="bagErr" role="alert"></p>
      <button class="btn btn--ink" type="submit">${t('bag.place')}</button>`;
    foot.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = foot.name.value.trim();
      if (!name) { $('#bagErr').textContent = t('bag.needname'); foot.name.focus(); return; }
      S.orderCode = 'DR-' + String(1000 + Math.floor(Math.random() * 9000));
      S.bag = []; saveBag(); updateBagBtn(true);
      S.bagView = 'done'; renderBag();
    });
    foot.addEventListener('input', (e) => { if (e.target.name === 'name') S.pickName = e.target.value; });
  }
  body.appendChild(foot);
}

function goCounter(cb) {
  if (lenis) lenis.scrollTo(0, { duration: 1.1, onComplete: cb });
  else { window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); if (cb) setTimeout(cb, RM ? 50 : 700); }
}

// ---------- case rows ----------
function buildRows() {
  const ol = $('#rows'); ol.textContent = '';
  FLAVOURS.forEach((f, i) => {
    const li = document.createElement('li'); li.className = 'row'; li.style.setProperty('--rbg', f.bg); li.dataset.f = i;
    const L = f[S.lang];
    li.innerHTML = `<div class="row__in"><span class="row__n"><bdi>0${i + 1}</bdi></span><h3 class="row__name">${L.name}</h3>
      <div class="row__txt"><p class="row__note">${L.note}</p><div class="row__tags">${L.tags.map((x) => `<span>${x}</span>`).join('')}<span>${t('case.from', { p: nf(PRICE.scoops[1]) })}</span></div></div>
      <img class="row__img" src="${scoopSrc(i, "t")}" alt="" loading="lazy" width="220" height="${Math.round(220 * f.ratio)}">
      <button class="btn btn--line" type="button">${t('case.stack')} +</button></div>`;
    $('button', li).addEventListener('click', () => goCounter(() => setTimeout(() => addScoop(i), 120)));
    ol.appendChild(li);
  });
}
function initRowFloat() {
  const fl_ = $('#rowFloat'), img = $('img', fl_);
  let on = false, cur = -1, x = 0, y = 0, tx = 0, ty = 0, vx = 0, raf = 0;
  const loop = (now) => {
    raf = 0;
    const dt = 1 / 60; void now;
    const k = 1 - Math.exp(-dt * 14);
    const nx = lerp(x, tx, k); vx = nx - x; x = nx; y = lerp(y, ty, k);
    fl_.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) rotate(${clamp(vx * 0.6, -18, 18).toFixed(2)}deg) scale(${on ? 1 : 0.6})`;
    if (on || Math.abs(tx - x) > 0.5) raf = requestAnimationFrame(loop);
  };
  $('#rows').addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || S.mobile) return;
    const row = e.target.closest('.row'); if (!row) return;
    const i = +row.dataset.f;
    if (i !== cur) { cur = i; img.src = scoopSrc(i, "m"); }
    if (!on) { x = e.clientX; y = e.clientY; }
    on = true; fl_.classList.add('is-on');
    tx = e.clientX + (S.lang === 'ar' ? -150 : 150); ty = e.clientY;
    if (!raf) raf = requestAnimationFrame(loop);
  });
  $('#rows').addEventListener('pointerleave', () => { on = false; cur = -1; fl_.classList.remove('is-on'); });
}

// ---------- cold (scroll-scrubbed temperature) ----------
const cold = $('#cold');
const mix = (a, b, p) => {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16)), pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], p)).toString(16).padStart(2, '0')).join('');
};
let coldStep = -1;
function onScroll() {
  const y = window.scrollY || document.documentElement.scrollTop;
  const vh = window.innerHeight || S.hero.h;
  $('#nav').classList.toggle('is-solid', y > S.hero.h - 80);
  S.heroVisible = y < S.hero.h + 40;
  if (S.heroVisible) request();
  const top = cold.offsetTop, h = cold.offsetHeight;
  const p = clamp((y - top) / Math.max(1, h - vh), 0, 1);
  const temp = Math.round(4 - 15 * p);
  const tn = $('#tempN');
  const txt = temp > 0 ? '+' + temp : temp < 0 ? '−' + Math.abs(temp) : '0';
  if (tn.textContent !== txt) tn.textContent = txt;
  const pin = $('#coldPin');
  pin.style.setProperty('--tp', p.toFixed(4));
  pin.style.setProperty('--frost', (clamp((p - 0.3) / 0.7, 0, 1) * 0.95).toFixed(3));
  pin.style.setProperty('--coldbg', mix('FFF9F0', 'E4EFF2', clamp(p * 1.1, 0, 1)));
  pin.style.setProperty('--tempc', p < 0.5 ? mix('B4541E', '3A2A24', p * 2) : mix('3A2A24', '2F6F92', (p - 0.5) * 2));
  const st = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;
  if (st !== coldStep) {
    coldStep = st;
    $$('.cold__ph').forEach((el) => el.classList.toggle('is-on', +el.dataset.step === st));
    $$('.step').forEach((el) => el.classList.toggle('is-on', +el.dataset.step === st));
  }
}

// ---------- open / closed (Riyadh time) ----------
function updateOpen() {
  let open = true, fri = false;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: 'numeric', weekday: 'short', hour12: false }).formatToParts(new Date());
    const h = +parts.find((p) => p.type === 'hour').value % 24;
    fri = parts.find((p) => p.type === 'weekday').value === 'Fri';
    const openH = fri ? 16 : 14;
    open = h >= openH || h < 1;
  } catch (e) {}
  const msg = open ? t('open.now') : fri ? t('open.fri') : t('open.soon', { t: S.lang === 'ar' ? '٢ الظهر' : '2 PM' });
  $('#openText').textContent = msg; $('#openText2').textContent = msg;
  $('#openPill').classList.toggle('is-closed', !open);
  $('.visit__now').classList.toggle('is-closed', !open);
}

// ---------- footer drips ----------
let footDrips = [];
function buildFootDrips() {
  const text = $('#footText'), g = $('#footDrips');
  g.textContent = '';
  footDrips = [];
  let boxes = [];
  try { for (let i = 0; i < 4; i++) boxes.push(text.getExtentOfChar(i)); } catch (e) { return; }
  const base = 232 - 6;
  const spots = [[0, 0.24, 1.0], [0, 0.66, 0.55], [1, 0.22, 0.8], [1, 0.8, 0.45], [2, 0.5, 0.95], [3, 0.26, 0.7]];
  spots.forEach(([ci, fx, L]) => {
    const b = boxes[ci]; if (!b) return;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    g.appendChild(p);
    footDrips.push({ p, x: b.x + b.width * fx, y: base, w: 16 + L * 10, L: 30 + L * 70, k: 0 });
  });
  drawFootDrips();
}
function dripD(x, y, w, L) {
  const hw = w / 2, e = y + Math.max(2, L);
  return `M${x - hw - 6} ${y} Q${x - hw} ${y} ${x - hw} ${y + 8} L${x - hw * 0.8} ${e - hw} C${x - hw * 1.05} ${e + hw * 0.2} ${x + hw * 1.05} ${e + hw * 0.2} ${x + hw * 0.8} ${e - hw} L${x + hw} ${y + 8} Q${x + hw} ${y} ${x + hw + 6} ${y} Z`;
}
function drawFootDrips() { footDrips.forEach((d) => d.p.setAttribute('d', dripD(d.x, d.y, d.w, d.L * d.k))); }
function growFootDrips() {
  if (!footDrips.length) return;
  if (!gsap || RM) { footDrips.forEach((d) => { d.k = 1; }); drawFootDrips(); return; }
  footDrips.forEach((d, i) => gsap.to(d, { k: 1, duration: 2.4 + i * 0.35, ease: 'power2.out', delay: i * 0.12, onUpdate: drawFootDrips }));
}

// ---------- loader ----------
const DRIP_SEEDS = Array.from({ length: 11 }, (_, i) => ({ x: (i + 0.5) / 11 + (Math.sin(i * 12.9) * 0.025), w: 36 + ((i * 37) % 5) * 13, L: 0.25 + ((i * 53) % 7) / 8 }));
function sizeDrips() {
  const svg = $('#loaderDrips'); if (!svg) return;
  const w = S.hero.w, h = Math.round((window.innerHeight || S.hero.h) * 0.26);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  S.dripBox = { w, h };
  drawLoaderDrips(S.dripK || 0);
}
function drawLoaderDrips(k) {
  S.dripK = k;
  const p = $('#loaderDripPath'); if (!p || !S.dripBox) return;
  const { w, h } = S.dripBox;
  let d = `M0 0 H${w} V2 `;
  DRIP_SEEDS.map((s) => ({ x: s.x * w, hw: s.w / 2, L: 2 + s.L * h * k })).sort((a, b) => b.x - a.x).forEach((s) => {
    d += `L${(s.x + s.hw).toFixed(1)} 2 C${(s.x + s.hw * 0.7).toFixed(1)} ${(s.L * 0.5).toFixed(1)} ${(s.x + s.hw * 1.3).toFixed(1)} ${s.L.toFixed(1)} ${s.x.toFixed(1)} ${s.L.toFixed(1)} C${(s.x - s.hw * 1.3).toFixed(1)} ${s.L.toFixed(1)} ${(s.x - s.hw * 0.7).toFixed(1)} ${(s.L * 0.5).toFixed(1)} ${(s.x - s.hw).toFixed(1)} 2 `;
  });
  p.setAttribute('d', d + 'L0 2 Z');
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function decode(src) { const im = new Image(); im.src = src; return (im.decode ? im.decode() : Promise.resolve()).catch(() => {}); }

async function boot() {
  root.classList.add('is-loading'); document.documentElement.classList.add('drip-loading');
  loadBag(); updateBagBtn();
  try { const l = localStorage.getItem('drip.lang'); if (l === 'ar' || l === 'en') S.lang = l; } catch (e) {}
  try { const v = localStorage.getItem('drip.vessel'); if (v === 'cup' || v === 'cone') S.vessel = v; } catch (e) {}
  try { localStorage.removeItem('drip.cupSize'); } catch (e) {}
  { const ql = new URLSearchParams(location.search).get('lang'); if (ql === 'ar' || ql === 'en') S.lang = ql; }

  const pctEl = $('#loaderPct bdi'), ball = $('#loaderBall');
  let shown = 0, real = 0, t0 = performance.now();
  const assets = [
    Promise.resolve(META),
    document.fonts ? Promise.all([document.fonts.load('400 100px "' + fontName('--drip-bagel') + '"'), document.fonts.load('400 100px "' + fontName('--drip-lalezar') + '"'), document.fonts.load('600 16px "' + fontName('--drip-body') + '"')]).catch(() => {}) : Promise.resolve(),
    decode(art('cone.webp')), decode(art('cup.webp')), decode(art('cup-lg.webp')), decode(art('scoop-pistachio.webp')),
    ...FLAVOURS.map((_, i) => decode(scoopSrc(i, "t"))),
    ...FLAVOURS.map((_, i) => decode(scoopSrc(i, ""))),
  ];
  let settled = 0;
  assets.forEach((p) => p.then(() => { settled++; real = settled / assets.length; }));
  const allIn = Promise.race([Promise.all(assets), wait(6000)]);

  // progress: creeps toward the real value; the ball rolls up bigger with it
  let loaderDone = false;
  const paint = () => {
    const el = (performance.now() - t0) / 1000;
    const cap = Math.min(real, clamp(el / 1.5, 0, 1)) ;
    shown = lerp(shown, loaderDone ? 1 : Math.max(cap, Math.min(0.9, el * 0.35)), 0.18);
    if (loaderDone && shown > 0.995) shown = 1;
    pctEl.textContent = nf(Math.round(shown * 100));
    if (!RM) ball.style.transform = `translate(-50%, -50%) rotate(${((1 - shown) * -220).toFixed(1)}deg) scale(${(0.3 + 0.7 * shown).toFixed(3)})`;
  };
  const iv = setInterval(paint, 33);

  await allIn;
  if (!alive) return;
  applyLang();
  buildTray(); buildCrowns();
  layout();
  initDrag(); initRowFloat();
  // reached 100
  const minShow = STILL ? 0 : 1300;
  const since = performance.now() - t0;
  if (since < minShow) await wait(minShow - since);
  if (!alive) return;
  loaderDone = true;
  if (!STILL) await wait(RM ? 60 : 380);
  if (!alive) return;
  clearInterval(iv); shown = 1; pctEl.textContent = nf(100);

  if (STILL || !gsap) {
    addScoop(0, { instant: true });
    $('#loader').classList.add('is-gone');
    finish(); return;
  }
  if (RM) {
    addScoop(0, { instant: true });
    gsap.to('#loader', { opacity: 0, duration: 0.4, onComplete: () => { $('#loader').classList.add('is-gone'); finish(); } });
    return;
  }
  exitLoader(ball);
}

function exitLoader(ball) {
  if (!alive) return;
  const loader = $('#loader');
  loader.classList.add('is-cut');
  // the loader's ball IS the first scoop: find where scoop 0 will rest
  const sc = addScoop(0, { instant: true, hidden: true });
  sc.hold = true;
  S.zoom = S.zoomT; S.enterY = 0; step(0.001);
  const to = sc.el.getBoundingClientRect();
  S.enterY = S.hero.h * 0.8; step(0.001);
  ball.style.transform = '';
  gsap.set(ball, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: 0, scale: 1 });
  const from = ball.getBoundingClientRect();
  const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
  const tx = to.left + to.width / 2, ty = to.top + to.height / 2;
  const sEnd = to.width / from.width;
  S.busy = true; request();
  const vh = window.innerHeight || S.hero.h;
  const drips = { k: 0 };
  const tl = gsap.timeline({
    onComplete: () => { loader.classList.add('is-gone'); S.busy = false; finish(); },
  });
  tl.to('#loaderSheet', { y: -(vh + (S.dripBox ? S.dripBox.h : 200) + 20), duration: 1.15, ease: 'power3.inOut' }, 0)
    .to(drips, { k: 1, duration: 0.8, ease: 'power2.out', onUpdate: () => drawLoaderDrips(drips.k) }, 0.05)
    .to(S, { enterY: 0, duration: 0.85, ease: "back.out(1.2)" }, 0)
    // lift, then fall onto the cone
    .to(ball, { y: -40, duration: 0.3, ease: 'power2.out' }, 0)
    .to(ball, { x: tx - fx, duration: 0.72, ease: 'power1.inOut' }, 0.3)
    .to(ball, { y: ty - fy, duration: 0.72, ease: 'power2.in' }, 0.3)
    .to(ball, { scale: sEnd, rotation: 0, duration: 0.72, ease: 'power1.inOut' }, 0.3)
    .add(() => {
      ball.style.visibility = 'hidden';
      sc.hold = false; sc.el.style.visibility = '';
      sc.sy = 0.72; sc.vsy = 0; S.dyV += 160;
      setWord(0, true);
    }, 1.02);
  // hide the word until the scoop lands, then drop the letters in
  giant.textContent = ''; wordKey = '';
  // safety net: a frozen animation clock (hidden tab, embedded preview) must never strand the loader
  setTimeout(() => { if (!S.ready) tl.progress(1); }, 4000);
}

function finish() {
  if (!alive) return;
  root.classList.remove('is-loading'); document.documentElement.classList.remove('drip-loading');
  S.ready = true;
  if (!giant.textContent) { wordKey = ''; setWord(currentFlavour(), !STILL); }
  initLenis();
  initReveals();
  buildFootDrips();
  onScroll();
  request();
  if (window.__siteResolve) window.__siteResolve();
}

// ---------- scroll + reveals ----------
function initLenis() {
  if (!RM && !STILL) {
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1 });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    lenis.on('scroll', onScroll);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : el, { duration: 1.2 });
    else window.scrollTo({ top: id === '#top' ? 0 : el.getBoundingClientRect().top + window.scrollY, behavior: RM ? 'auto' : 'smooth' });
  }));
}
function initReveals() {
  const els = $$('.reveal, .visit__arch');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -12% 0px' });
  els.forEach((e) => io.observe(e));
  const fio = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { growFootDrips(); fio.disconnect(); } }), { threshold: 0.3 });
  fio.observe($('#foot'));
}

// ---------- wiring ----------
$('#addBtn').addEventListener('click', addToBag);
$('#resetBtn').addEventListener('click', () => resetCone(false));
$('#bagBtn').addEventListener('click', openBag);
$('#orderAhead').addEventListener('click', () => { if (S.bag.length) openBag(); else goCounter(); });
bagEl.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeBag(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !bagEl.hidden) closeBag();
  if (e.key === 'Tab' && !bagEl.hidden) {
    const f = $$('button, input, select, a[href]', bagEl).filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});
$('#langBtn').addEventListener('click', () => { S.lang = S.lang === 'en' ? 'ar' : 'en'; applyLang(); layout(); buildFootDrips(); footDrips.forEach((d) => { d.k = 1; }); drawFootDrips(); });
$$('#vessel [data-vessel]').forEach((b) => b.addEventListener('click', () => setVessel(b.dataset.vessel)));
let rz = 0;
const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { layout(); onScroll(); request(); }, 60); };
window.addEventListener('resize', onResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; request(); } });
setInterval(updateOpen, 60000);

// ---------- QA hook ----------
const ready = new Promise((r) => { window.__siteResolve = r; });
window.__site = {
  __drip: true,
  ready,
  setScroll(frac) {
    const max = document.documentElement.scrollHeight - (window.innerHeight || S.hero.h);
    const y = max * clamp(frac, 0, 1);
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    window.scrollTo(0, y); onScroll();
  },
  scrollToEl(sel, off = 0) { const el = $(sel); const y = el.getBoundingClientRect().top + window.scrollY + off; if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); window.scrollTo(0, y); onScroll(); },
  addScoop: (i, instant) => addScoop(i, { instant }), removeScoop, reset: () => resetCone(true), toggleCrown, addToBag,
  openBag, closeBag, refreshBag() { renderBag(); },
  setBag(lines, subtotalCents) {
    if (!shopCart) return;
    S.subtotalCents = typeof subtotalCents === 'number' ? subtotalCents : 0;
    S.bag = (Array.isArray(lines) ? lines : []).map((x) => {
      const scoops = (Array.isArray(x.scoops) ? x.scoops : []).filter((i) => FLAVOURS[i]);
      const vessel = x.vessel === 'cup' ? 'cup' : 'cone';
      return {
        id: x.id,
        s: scoops,
        c: Array.isArray(x.crowns) ? x.crowns.slice() : [],
        q: x.quantity > 0 ? x.quantity : 1,
        v: vessel,
        size: vessel === 'cup' ? sizeForCount(scoops.length) : 'regular',
        totalCents: typeof x.totalCents === 'number' ? x.totalCents : 0,
      };
    });
    updateBagBtn();
    renderBag();
  },
  setLang(l) { S.lang = l; applyLang(); layout(); }, setVessel,

  settle() { for (let i = 0; i < 240; i++) step(1 / 60); },
  reveal() { $$('.reveal, .visit__arch').forEach((e) => e.classList.add('in')); },
  state: () => ({ lang: S.lang, vessel: S.vessel, cupSize: S.cupSize, scoops: S.scoops.map((s) => FLAVOURS[s.f].id), crowns: [...S.crowns], bag: S.bag, bagCount: bagCount(), price: priceNow(), zoom: S.zoom, cw: S.cw, ready: S.ready, busy: !!S.busy }),
  S,
};

boot();


  return () => {
    alive = false
    ac.abort()
    EventTarget.prototype.addEventListener = origAdd
    for (const id of rafs) nativeCAF(id)
    rafs.clear()
    for (const id of pendingTimers) nativeClearTimeout(id)
    for (const id of intervals) nativeClearInterval(id)
    pendingTimers.clear()
    intervals.clear()
    if (lenis) { lenis.destroy(); lenis = null }
    if (ctx) ctx.revert()
    gsapRaw.killTweensOf(host.querySelectorAll("*"))
    document.documentElement.classList.remove("drip-loading")
    if (window.__site && window.__site.__drip) window.__site = previousSite
    try { delete window.__siteResolve } catch (e) {}
  }
}
