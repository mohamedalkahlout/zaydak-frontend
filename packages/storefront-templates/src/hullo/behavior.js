/* hullo behaviour, ported from the Genesis Works demo.
   The React tree owns the markup. This module measures, scrolls and animates it.
   It does not render. Unmount aborts every listener registered during setup. */
/* eslint-disable */
import gsap from "gsap"
import Lenis from "lenis"

const ICON_PLUS = '<svg class="ico" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"/></svg>'
const ICON_MINUS = '<svg class="ico" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z"/></svg>'

export function mountHullo(root, opts = {}) {
  const ac = new AbortController()
  const signal = ac.signal
  const origAdd = EventTarget.prototype.addEventListener
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    const next = opts == null ? { signal } : typeof opts === "boolean" ? { capture: opts, signal } : { ...opts, signal }
    return origAdd.call(this, type, fn, next)
  }

  const pendingTimers = new Set()
  const intervals = new Set()
  const nativeSetTimeout = globalThis.setTimeout
  const nativeClearTimeout = globalThis.clearTimeout
  const nativeSetInterval = globalThis.setInterval
  const nativeClearInterval = globalThis.clearInterval
  const nativeRAF = globalThis.requestAnimationFrame
  const nativeCAF = globalThis.cancelAnimationFrame
  let rafId = 0
  const setTimeout = (fn, ms, ...args) => {
    const id = nativeSetTimeout(() => { pendingTimers.delete(id); fn(...args) }, ms)
    pendingTimers.add(id)
    return id
  }
  const clearTimeout = (id) => { pendingTimers.delete(id); nativeClearTimeout(id) }
  const setInterval = (fn, ms, ...args) => {
    const id = nativeSetInterval(fn, ms, ...args)
    intervals.add(id)
    return id
  }
  const clearInterval = (id) => { intervals.delete(id); nativeClearInterval(id) }
  const requestAnimationFrame = (fn) => {
    rafId = nativeRAF((t) => fn(t))
    return rafId
  }
  const cancelAnimationFrame = (id) => nativeCAF(id)

  let lenis = null
  let savedMq = null
  let mqEl = null
  let restoreTicker = () => {}
  let alive = true
  let ctx = null
  const previousSite = window.__site

  try {
    ctx = gsap.context(() => {

  'use strict';
  const d = document, html = root;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const eInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const eOut = t => 1 - Math.pow(1 - t, 3);
  const eBack = (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) html.classList.add('rm');
  const G = gsap;
  const shopCart = opts.shopCart || null;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };

  /* ---------- plate geometry (fractions of the storefront photo) ---------- */
  const PLATE = {
    aspect: 1.5,
    win: { x0: .2507, y0: .4434, x1: .75, y1: .7256, r: .105 }, // measured from the green key
    sign: { cy: .25, h: .18 },
    intAspect: 1.5,
    intEdge: .884, // interior y of the counter's front edge: it lands on the bottom of the screen
  };
  if (window.__PLATE) Object.assign(PLATE, window.__PLATE);

  // stickers: hang = fractions of the card rect in P0/P1; wall = fractions of the plate once slapped on
  const STK = [
    { hang: [-.035, .20, -9], hangM: [-.02, .14, -9], wall: [.17, .52, -11], wallM: [.27, .115, -10] },
    { hang: [.26, -.10, -7], hangM: [.88, -.12, 8], wall: [.765, .235, 7], wallM: [.73, .12, 8] },
    { hang: [1.025, .40, 6], hangM: [1.0, .60, 6], wall: [.68, .86, 9], wallM: [.36, .865, 7] },
    { hang: [.08, .72, -5], hangM: [.07, .84, -5], wall: [.285, .175, -6], wallM: [.64, .87, -6] },
  ];

  /* ---------- elements ---------- */
  const scene = $('.scene'), stage = $('.stage'), frame = $('.frame');
  const world = $('.world'), interior = $('.interior');
  const zW = $('.world .zin'), zI = $('.interior .zin');

  /* ---------- GPU memory on phones ----------
     Chrome rasters a will-change:transform layer at no less than device resolution while it is drawn
     between 0.25x and 1x, and keeps a raster once made. The storefront sat at ~0.45x on a phone, so it
     cost ~5x its screen area in tiles; a lights toggle re-rasters everything at once and Android ran
     out (letters and copy blanked). So each zooming plane is laid out at its smallest on-screen scale
     (zoom on its .zin) and only scales up, and rasterStep() drops the hint for two frames whenever
     the scale has moved ~1.4x (5% once the page rests): Chrome re-rasters it once, then holds it. */
  const ZOOM = !!(window.CSS && CSS.supports && CSS.supports('zoom', '0.5'));
  const rasterAt = new Map();
  let lastStep = 0, resting = false;
  function rasterStep(el, s) {
    const r = rasterAt.get(el);
    if (r == null) { rasterAt.set(el, s); return; }
    const q = s / r;
    if (q < (resting ? 0.95 : 0.72) || q > (resting ? 1.05 : 1.4)) {
      const t = performance.now();
      if (t - lastStep < 160) return; // one plane at a time; render() runs every frame, so it retries
      lastStep = t;
      rasterAt.set(el, s);
      el.style.willChange = 'auto';
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.willChange = ''; }));
    }
  }
  /* ---------- touch pacing ----------
     A phone swipe is short and flings, and the scene used to give the whole story ~8 swipes: the sign
     landed in one and the stickers crossed the screen at twice the finger's speed. On touch screens the
     scene is longer (site.css) and scroll reaches the story through PACE, measured with library/_qa/pace
     so nothing outruns the finger and nothing sits still for long. Pairs are [scene scroll, story p],
     joined by a monotone cubic so the story never changes speed with a jolt; desktop stays linear. */
  const PACE_MQ = matchMedia('(hover: none) and (pointer: coarse)');
  const PACE = [[0, 0], [.3342, .3], [.5013, .42], [.5901, .5], [.8512, .75], [.893, .8], [.9896, .985], [1, 1]];
  function monotone(K) { // Fritsch-Carlson: a smooth curve through the pairs that never runs backwards
    const n = K.length, h = [], dl = [], m = [];
    for (let i = 0; i < n - 1; i++) { h[i] = K[i + 1][0] - K[i][0]; dl[i] = (K[i + 1][1] - K[i][1]) / h[i]; }
    for (let i = 0; i < n; i++) {
      if (i === 0) m[i] = dl[0];
      else if (i === n - 1) m[i] = dl[n - 2];
      else if (dl[i - 1] * dl[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i]); }
    }
    return x => {
      if (x <= K[0][0]) return K[0][1];
      if (x >= K[n - 1][0]) return K[n - 1][1];
      let i = 0;
      while (x > K[i + 1][0]) i++;
      const t = (x - K[i][0]) / h[i], t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * K[i][1] + (t3 - 2 * t2 + t) * h[i] * m[i] + (3 * t2 - 2 * t3) * K[i + 1][1] + (t3 - t2) * h[i] * m[i + 1];
    };
  }
  const paceF = monotone(PACE);
  const pace = s => (PACE_MQ.matches ? paceF(s) : s);
  function unpace(p) { // the inverse, by bisection (QA hook only)
    if (!PACE_MQ.matches) return p;
    let a = 0, b = 1;
    for (let i = 0; i < 40; i++) { const c = (a + b) / 2; if (paceF(c) < p) a = c; else b = c; }
    return (a + b) / 2;
  }

  const shade = $('.win-shade'), glow = $('.win-glow'), ghost = $('.sign-ghost');
  const ghostL = $$('.sign-ghost span');
  const wordmark = $('.wordmark'), letters = $$('.wm-l');
  const side = $('.hero-side'), badge = $('.badge');
  const stks = $$('.stk');
  const orderPill = $('.order-pill'), countEl = $('.order-pill .count b');

  /* ---------- measure ---------- */
  const M = { ok: false };
  const intro = { l: [0, 0, 0, 0, 0].map(() => ({ y: 0, s: 1, o: 1 })), side: { y: 0, o: 1 }, card: { y: 0 } };
  const drag = stks.map(() => ({ x: 0, y: 0, lift: 0, wig: 0 }));

  function measure() {
    M.vw = stage.clientWidth || window.innerWidth || 1280;
    M.vh = (RM ? window.innerHeight : stage.clientHeight) || window.innerHeight || 800;
    M.mobile = M.vw < 761;
    const W = PLATE.win;
    M.Ww = Math.max(M.vw, M.vh * PLATE.aspect);
    M.Wh = M.Ww / PLATE.aspect;
    world.style.width = M.Ww + 'px';
    world.style.height = M.Wh + 'px';
    M.Iw = Math.max(M.vw * 1.03, PLATE.intAspect * M.vh / PLATE.intEdge * 1.02);
    M.Ih = M.Iw / PLATE.intAspect;
    interior.style.width = M.Iw + 'px';
    interior.style.height = M.Ih + 'px';
    M.winW = (W.x1 - W.x0) * M.Ww;
    M.winH = (W.y1 - W.y0) * M.Wh;
    M.Fx = (W.x0 + W.x1) / 2 * M.Ww;
    M.Fy = (W.y0 + W.y1) / 2 * M.Wh;
    Object.assign(shade.style, { left: W.x0 * 100 + '%', top: W.y0 * 100 + '%', width: (W.x1 - W.x0) * 100 + '%', height: (W.y1 - W.y0) * 100 + '%', borderRadius: W.r * M.winH + 'px' });
    Object.assign(glow.style, { left: (W.x0 - .3) * 100 + '%', top: (W.y0 - .34) * 100 + '%', width: (W.x1 - W.x0 + .6) * 100 + '%', height: (W.y1 - W.y0 + .72) * 100 + '%' });

    // sign letters in world px
    M.signFont = PLATE.sign.h * M.Wh;
    ghost.style.fontSize = M.signFont + 'px';
    ghost.style.top = (PLATE.sign.cy * M.Wh - M.signFont / 2) + 'px';
    M.sign = ghostL.map(s => ({ x: s.offsetLeft + s.offsetWidth / 2, y: ghost.offsetTop + s.offsetTop + s.offsetHeight / 2 }));

    // hero letters: natural centres in stage coords
    letters.forEach(l => { l.style.transform = 'none'; });
    side.style.transform = 'none';
    const sr = stage.getBoundingClientRect();
    M.hero = letters.map(l => { const r = l.getBoundingClientRect(); return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 }; });
    M.heroFont = parseFloat(getComputedStyle(wordmark).fontSize) || 200;
    const sb = side.getBoundingClientRect();
    M.sideBottom = sb.bottom - sr.top;
    M.badgeBottom = badge.offsetParent ? badge.getBoundingClientRect().bottom - sr.top : 0;

    // P0 card: a window of the plate peeking under the copy (mobile zooms in on the window)
    M.cw0 = M.mobile ? M.vw - 28 : Math.min(M.vw * .86, 1260);
    M.cx0 = (M.vw - M.cw0) / 2;
    M.cy0 = M.mobile ? Math.max(M.sideBottom + 40, M.vh * .56) : Math.max(M.sideBottom + 40, M.vh * .64);
    const fit0 = M.mobile ? .66 : 1;
    M.s0 = M.cw0 / (fit0 * M.Ww);
    M.tx0 = M.cx0 + M.cw0 / 2 - M.s0 * M.Ww / 2;
    M.crop0 = M.mobile ? .36 : .3; // this much of the plate sits above the card at P0
    M.ty0 = M.cy0 - M.crop0 * M.Wh * M.s0;
    M.ch0 = Math.min((1 - M.crop0) * M.Wh * M.s0, M.mobile ? M.vh - M.cy0 + 60 : 1e9);

    // P1 end: desktop covers the screen, mobile fits the sign + window band
    if (!M.mobile) {
      M.s1 = Math.max(M.vw / M.Ww, M.vh / M.Wh);
    } else {
      M.s1 = Math.min(Math.max(M.vw / M.Ww, M.vh / M.Wh), M.vw / (.56 * M.Ww));
    }
    M.tx1 = (M.vw - M.Ww * M.s1) / 2;
    M.ty1 = (M.vh - M.Wh * M.s1) / 2 + (M.mobile ? M.vh * .03 : 0);
    M.Fs1 = { x: M.tx1 + M.s1 * M.Fx, y: M.ty1 + M.s1 * M.Fy };
    // walk-in: the window must swallow the screen with room for its rounded corners
    M.sEnd = 1.34 * Math.max(M.vw / M.winW, M.vh / M.winH);
    M.zEnd = M.sEnd / M.s1;
    M.D1 = M.winW * M.s1 * 1.6;
    M.Dend = Math.max(M.Iw, M.D1 * 1.05);

    // sticker sizes
    M.sw = stks[0] ? stks[0].offsetWidth : 150;
    M.sh = stks[0] ? stks[0].offsetHeight : 170;
    M.stkWorld = (M.mobile ? .092 : .085);

    // smallest on-screen scale of each plane: the camera never goes below min(s0, s1), and the
    // interior is never smaller than 1.6x the window hole at that scale
    M.kW = ZOOM ? Math.min(1, M.s0, M.s1) : 1;
    M.kI = ZOOM ? Math.min(1, M.winW * Math.min(M.s0, M.s1) * 1.6 / M.Iw) : 1;
    zW.style.zoom = M.kW; zW.style.width = M.Ww + 'px'; zW.style.height = M.Wh + 'px';
    zI.style.zoom = M.kI; zI.style.width = M.Iw + 'px'; zI.style.height = M.Ih + 'px';
    rasterAt.set(world, -1); rasterAt.set(interior, -1); // re-raster both at the new layout
    drawHaze();

    // scroll range of the scene
    M.sceneTop = scene.offsetTop;
    // in-app browsers (Instagram) resize the window as their toolbar slides in and out (gw-vh in
    // index.html): the story is mapped on the height the page opened with, so it never jumps
    const gw = window.__gwvh;
    M.sceneDist = Math.max(1, scene.offsetHeight - (gw && gw.on ? gw.svh * 100 : M.vh));
    cache.clear();
    lastClip = '';
    // reduced motion: static composition, copy on top and the storefront card below it, no pin
    if (RM) stage.style.height = Math.ceil(M.cy0 + M.ch0 + 60) + 'px';
    M.ok = true;
  }

  /* ---------- the camera ---------- */
  const cam = { s: 1, tx: 0, ty: 0 };
  const clip = { l: 0, t: 0, r: 0, b: 0 };
  function camera(p) {
    if (p <= .3) {
      const t = eInOut(seg(p, 0, .3));
      cam.s = lerp(M.s0, M.s1, t);
      cam.tx = lerp(M.tx0, M.tx1, t);
      cam.ty = lerp(M.ty0 + intro.card.y, M.ty1, t);
      // clip: from the P0 card to the plate rect on screen
      const end = rectOf(M.s1, M.tx1, M.ty1);
      clip.l = lerp(M.cx0, end.l, t);
      clip.t = lerp(M.cy0 + intro.card.y, end.t, t);
      clip.r = lerp(M.cx0 + M.cw0, end.r, t);
      clip.b = lerp(M.cy0 + intro.card.y + M.ch0, end.b, t);
      return { u: 0, t };
    }
    const u = seg(p, .3, .985);
    const w = .12 * u + .88 * eInOut(u);
    let z = Math.pow(M.zEnd, w);
    z *= 1 + .03 * seg(p, .95, 1);
    cam.s = M.s1 * z;
    const k = eInOut(u);
    const fx = lerp(M.Fs1.x, M.vw / 2, k), fy = lerp(M.Fs1.y, M.vh / 2, k);
    cam.tx = fx - cam.s * M.Fx;
    cam.ty = fy - cam.s * M.Fy;
    const r = rectOf(cam.s, cam.tx, cam.ty);
    clip.l = r.l; clip.t = r.t; clip.r = r.r; clip.b = r.b;
    return { u, w, fx, fy };
  }
  function rectOf(s, tx, ty) {
    return { l: Math.max(0, tx), t: Math.max(0, ty), r: Math.min(M.vw, tx + M.Ww * s), b: Math.min(M.vh, ty + M.Wh * s) };
  }
  const toScreen = (wx, wy) => ({ x: cam.tx + cam.s * wx, y: cam.ty + cam.s * wy });

  /* ---------- render (synchronous, idempotent) ---------- */
  let P = 0, lastClip = '', now = 0, lastY = -1, lastMove = 0;
  const cache = new Map();
  function setT(el, v) { if (cache.get(el) !== v) { cache.set(el, v); el.style.transform = v; } }

  function render() {
    if (!M.ok) return;
    const y = lenis ? lenis.scroll : window.scrollY;
    const tNow = performance.now();
    if (y !== lastY) { lastY = y; lastMove = tNow; }
    resting = tNow - lastMove > 220;
    P = RM ? 0 : pace(clamp((y - M.sceneTop) / M.sceneDist));
    const p = P;
    const c = camera(p);

    // clip: the card is the frame box itself (rounded overflow clip), the planes move inside it
    const inL = Math.max(0, clip.l), inT = Math.max(0, clip.t), inR = Math.max(0, M.vw - clip.r), inB = Math.max(0, M.vh - clip.b);
    const rc = (a, b) => (28 * clamp(Math.min(a, b) / 24)).toFixed(1) + 'px';
    const fl = +inL.toFixed(1), ft = +inT.toFixed(1);
    const cp = `${fl}|${ft}|${(M.vw - inL - inR).toFixed(1)}|${(M.vh - inT - inB).toFixed(1)}|${rc(inT, inL)} ${rc(inT, inR)} ${rc(inB, inR)} ${rc(inB, inL)}`;
    if (cp !== lastClip) {
      lastClip = cp;
      const [, , fw, fh, rad] = cp.split('|');
      Object.assign(frame.style, { left: fl + 'px', top: ft + 'px', width: fw + 'px', height: fh + 'px', borderRadius: rad });
    }
    setT(world, `translate3d(${(cam.tx - fl).toFixed(2)}px,${(cam.ty - ft).toFixed(2)}px,0) scale(${(cam.s / M.kW).toFixed(5)})`);
    rasterStep(world, cam.s / M.kW);

    // interior plate behind the cutout: rigid until P3, then slower than the wall (depth)
    const Fs = toScreen(M.Fx, M.Fy);
    const holeW = M.winW * cam.s, holeH = M.winH * cam.s;
    let D, a;
    if (p <= .3) { D = holeW * 1.6; a = .6; }
    else {
      D = M.D1 * Math.pow(M.Dend / M.D1, c.w);
      const Dh = D / PLATE.intAspect;
      const aEnd = clamp((Fs.y + PLATE.intEdge * Dh - M.vh) / Dh, .3, .7);
      a = lerp(.6, aEnd, eInOut(c.u));
      // never let the hole outgrow the plate behind it
      const vis = { l: Math.max(0, Fs.x - holeW / 2), r: Math.min(M.vw, Fs.x + holeW / 2), t: Math.max(0, Fs.y - holeH / 2), b: Math.min(M.vh, Fs.y + holeH / 2) };
      const needW = 2 * Math.max(Fs.x - vis.l, vis.r - Fs.x) * 1.03;
      const needH = Math.max((Fs.y - vis.t) / a, (vis.b - Fs.y) / (1 - a)) * 1.03;
      D = Math.max(D, needW, needH * PLATE.intAspect);
    }
    const is = D / M.Iw;
    setT(interior, `translate3d(${(Fs.x - D / 2 - fl).toFixed(2)}px,${(Fs.y - a * D / PLATE.intAspect - ft).toFixed(2)}px,0) scale(${(is / M.kI).toFixed(5)})`);
    rasterStep(interior, is / M.kI);

    // letters: fly from the sky onto the wall and become the sign
    const kSign = M.signFont * cam.s / M.heroFont;
    let landedAll = true;
    letters.forEach((l, i) => {
      const tt = RM ? 0 : seg(p, .015 + i * .034, .19 + i * .034);
      const te = eInOut(tt);
      const tg = toScreen(M.sign[i].x, M.sign[i].y);
      const h = M.hero[i];
      const arc = -Math.sin(Math.PI * tt) * M.vh * .16;
      const x = lerp(h.x, tg.x, te) - h.x;
      const yy = lerp(h.y, tg.y, te) - h.y + arc + intro.l[i].y * (1 - te);
      const sc = lerp(1, kSign, te) * intro.l[i].s;
      const rot = Math.sin(Math.PI * tt) * (i % 2 ? 22 : -22);
      setT(l, `translate3d(${x.toFixed(2)}px,${yy.toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`);
      const m = seg(tt, .82, 1).toFixed(3);
      const key = 'm' + i;
      if (cache.get(key) !== m) { cache.set(key, m); l.firstElementChild.style.setProperty('--m', m); }
      const landed = tt >= 1;
      if (landed !== !!l._landed) {
        l._landed = landed;
        if (landed) { l.classList.remove('squish'); void l.offsetWidth; l.classList.add('squish'); }
      }
      if (!landed) landedAll = false;
      const ok = 'o' + i, ov = String(intro.l[i].o);
      if (cache.get(ok) !== ov) { cache.set(ok, ov); l.style.opacity = ov; }
    });
    html.classList.toggle('landed', landedAll && !RM);
    html.classList.toggle('show-mark', p > .2 || RM || y > M.sceneTop + M.sceneDist);

    // copy gets pushed up by the rising card
    const push = Math.min(0, clip.t - 30 - M.sideBottom);
    const so = clamp(1 + push / 150) * intro.side.o;
    setT(side, `translate3d(0,${(push + intro.side.y).toFixed(2)}px,0)`);
    side.style.opacity = so.toFixed(3);
    side.style.visibility = so < .01 ? 'hidden' : '';
    if (M.badgeBottom) {
      const bp = Math.min(0, clip.t - 24 - M.badgeBottom) + intro.side.y;
      setT(badge, `translate3d(0,${bp.toFixed(2)}px,0)`);
      badge.style.opacity = (clamp(1 + bp / 150) * intro.side.o).toFixed(3);
    }

    // stickers: hang off the card, peel, slap onto the wall, fly past
    const cardW = clip.r - clip.l, cardH = clip.b - clip.t;
    stks.forEach((el, i) => {
      const S = STK[i];
      const wall = M.mobile ? S.wallM : S.wall;
      const hang = M.mobile ? S.hangM : S.hang;
      const t2 = RM ? 0 : seg(p, .29 + i * .025, .41 + i * .025);
      const te = eBack(t2, 1.4);
      const float = RM ? 0 : Math.sin(now / 900 + i * 1.7) * 5;
      // hanging position (screen)
      const pad = M.sw * .42;
      let hx = clamp(clip.l + hang[0] * cardW, pad, M.vw - pad);
      let hy = clip.t + hang[1] * cardH + float;
      if (p <= .3) hy = Math.max(hy, clip.t - M.sh * .35);
      const ws = toScreen(wall[0] * M.Ww, wall[1] * M.Wh);
      const kWall = (M.stkWorld * M.Ww * cam.s) / M.sw;
      const lift = Math.sin(Math.PI * clamp(t2)) * (M.mobile ? 60 : 110);
      const x = lerp(hx, ws.x, te) + drag[i].x;
      const yy = lerp(hy, ws.y, te) - lift + drag[i].y;
      const sc = lerp(1 + drag[i].lift, kWall, clamp(te)) * (1 + .12 * Math.sin(Math.PI * clamp(t2)));
      const rot = lerp(hang[2], wall[2], clamp(te)) + drag[i].wig;
      setT(el, `translate3d(${(x - M.sw / 2).toFixed(2)}px,${(yy - M.sh / 2).toFixed(2)}px,0) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`);
      const off = x + M.sw * sc / 2 < -40 || x - M.sw * sc / 2 > M.vw + 40 || yy + M.sh * sc / 2 < -40 || yy - M.sh * sc / 2 > M.vh + 40;
      el.style.visibility = off ? 'hidden' : '';
    });

  }

  /* ---------- scroll: Lenis stepped by the rAF timestamp (Zen rounds performance.now) ---------- */
  if (!RM) {
    try {
      lenis = new Lenis({ lerp: .1, smoothWheel: true, wheelMultiplier: .9, touchMultiplier: 1.2 });
      lenis.on('scroll', render);
    } catch (e) { lenis = null; }
  }
  window.addEventListener('scroll', () => { if (!lenis) render(); }, { passive: true });
  const ownGsap = !!(G && G.updateRoot && G.ticker && G.ticker.remove);
  if (ownGsap) { G.ticker.remove(G.updateRoot); G.ticker.lagSmoothing(0); }
  const loops = new Set();
  let rafSeen = false;
  function clock(t) {
    if (!alive) return;
    rafSeen = true;
    now = t;
    if (lenis) lenis.raf(t);
    if (ownGsap) G.updateRoot(t / 1000);
    loops.forEach(fn => fn(t));
    render();
    requestAnimationFrame(clock);
  }
  requestAnimationFrame(clock);

  function jump(yv, smooth) {
    if (lenis) { lenis.scrollTo(yv, smooth ? { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) } : { immediate: true, force: true }); }
    else window.scrollTo(0, yv);
    render();
  }
  function goTo(sel, smooth = true) {
    if (sel === '#top') return jump(0, smooth);
    const el = $(sel);
    if (!el) return;
    let yv = el.getBoundingClientRect().top + (lenis ? lenis.scroll : window.scrollY);
    if (sel === '#menu') yv -= M.mobile ? 20 : 40;
    jump(yv, smooth);
  }
  d.addEventListener('click', e => {
    const a = e.target.closest('[data-go]');
    if (!a) return;
    e.preventDefault();
    const sel = a.getAttribute('data-go');
    if (html.classList.contains('menu-open')) closeMenu(() => goTo(sel));
    else if (tray.classList.contains('open')) { closeTray(); goTo(sel); }
    else goTo(sel);
  });

  /* ---------- loader ---------- */
  const loader = $('#loader');
  const ldN = $('.ld-n'), ldStatus = $('.ld-status'), ldLiquid = $('.ld-liquid'), ldIce = $('.ld-ice');
  const ldStraw = $('.ld-straw'), ldFlood = $('.ld-flood'), ldCenter = $('.ld-center'), ldCup = $('.ld-cup');
  const STATUS = [[0, 'grinding the beans'], [26, 'tamping, gently'], [52, 'pulling two shots'], [76, 'adding ice'], [97, 'ok. hi.']];
  const critical = [$('.wall'), $('.interior img'), ...stks.map(s => s.querySelector('img'))];
  let loadDone = 0;
  const loadTotal = critical.length + 1;
  const t0 = performance.now();
  let shown = 0, loaderState = 'filling', loaderGone = false;
  const bump = () => { loadDone++; };
  critical.forEach(img => {
    if (!img) { bump(); return; }
    if (img.complete && img.naturalWidth) bump();
    else { img.addEventListener('load', bump, { once: true }); img.addEventListener('error', bump, { once: true }); }
  });
  const fontsReady = (d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 4000))]).then(bump);
  // decode the plates before the reveal so the first scroll frame is not a decode stall
  const decodes = Promise.race([Promise.all(critical.slice(0, 2).map(i => (i && i.decode ? i.decode().catch(() => {}) : null))), new Promise(r => setTimeout(r, 6000))]);

  // hold hero pieces below until the reveal
  intro.l.forEach(o => { o.y = 90; o.s = .6; o.o = 0; });
  intro.side.y = 40; intro.side.o = 0; intro.card.y = 160;

  function loaderLoop(t) {
    if (loaderState !== 'filling') return;
    const elapsed = (t - t0) / 1000;
    const real = loadDone / loadTotal;
    const target = (RM ? real : Math.min(real, elapsed / 1.7)) * 100;
    shown += (target - shown) * (RM ? 1 : .12);
    if (target >= 100 && shown > 99.2) shown = 100;
    const n = Math.floor(shown);
    ldN.textContent = n;
    let st = STATUS[0][1];
    STATUS.forEach(([k, s]) => { if (n >= k) st = s; });
    if (ldStatus.textContent !== st) ldStatus.textContent = st;
    const level = lerp(250, 58, shown / 100);
    const wx = -((t / 14) % 100);
    ldLiquid.setAttribute('transform', `translate(${wx.toFixed(1)} ${level.toFixed(1)})`);
    ldIce.setAttribute('transform', `translate(0 ${(level - 150 + Math.sin(t / 300) * 3).toFixed(1)})`);
    if (shown >= 100) { loaderState = 'done'; decodes.then(finishLoader); }
  }
  // liquid path with its surface at y=0 so a translate sets the level
  ldLiquid.setAttribute('d', 'M-200 0 Q-175 -9 -150 0 T-100 0 T-50 0 T0 0 T50 0 T100 0 T150 0 T200 0 T250 0 T300 0 T350 0 T400 0 L400 330 L-200 330 Z');
  loops.add(loaderLoop);

  function heroIntro(delay) {
    if (!G || RM) { intro.l.forEach(o => { o.y = 0; o.s = 1; o.o = 1; }); intro.side.y = 0; intro.side.o = 1; intro.card.y = 0; render(); return; }
    const onUpdate = render;
    G.to(intro.card, { y: 0, duration: 1.1, ease: 'expo.out', delay, onUpdate });
    G.to(intro.side, { y: 0, o: 1, duration: .9, ease: 'expo.out', delay: delay + .1, onUpdate });
    intro.l.forEach((o, i) => {
      G.to(o, { y: 0, s: 1, o: 1, duration: 1.05, ease: 'back.out(2.2)', delay: delay + .18 + i * .07, onUpdate });
    });
    G.from(stks.map(s => s.querySelector('img')), { rotate: -25, scale: .4, duration: .9, ease: 'back.out(2)', stagger: .08, delay: delay + .35 });
  }

  function finishLoader() {
    if (loaderGone) return;
    if (!G || RM) {
      loader.classList.add('is-gone');
      loaderGone = true;
      heroIntro(0);
      return;
    }
    const tl = G.timeline();
    tl.fromTo(ldStraw, { y: -260, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'bounce.out' });
    tl.to(ldCup, { scale: 1.06, duration: .12, yoyo: true, repeat: 1, transformOrigin: '50% 100%' }, '-=.08');
    tl.add(() => {
      // the coffee spills out of the cup and floods the screen from its surface up
      const cr = ldCup.getBoundingClientRect();
      const surf = cr.top + cr.height * (58 / 260);
      const H = ldFlood.offsetHeight;
      G.set(ldFlood, { y: surf - 30 });
      G.to(ldFlood, {
        y: -H - 10, duration: 1.35, ease: 'power2.inOut',
        onUpdate() {
          const fy = G.getProperty(ldFlood, 'y');
          if (fy < -60 && loader.style.background !== 'transparent') {
            loader.style.background = 'transparent';
            ldCenter.style.visibility = 'hidden';
            heroIntro(.05);
          }
        },
        onComplete() { loader.classList.add('is-gone'); loaderGone = true; },
      });
    });
  }
  // safety net: never strand the page behind the loader
  setTimeout(() => {
    if (loaderGone) return;
    loaderState = 'done';
    loader.classList.add('is-gone');
    loaderGone = true;
    intro.l.forEach(o => { o.y = 0; o.s = 1; o.o = 1; }); intro.side.y = 0; intro.side.o = 1; intro.card.y = 0;
    render();
  }, 9000);

  /* ---------- haze on touch screens: a tiny canvas the GPU stretches (see .haze-cv) ---------- */
  const hazeBox = $('.haze'), hazeBlobs = $$('.haze i');
  const hazeCv = hazeBox && matchMedia('(hover: none)').matches ? d.createElement('canvas') : null;
  if (hazeCv) { hazeCv.className = 'haze-cv'; hazeBox.appendChild(hazeCv); hazeBox.classList.add('cv'); }
  // a disc of radius r under blur(s): coverage at distance q from its centre (s is the CSS blur sd)
  function blurDisc(r, s, q) {
    const n = 40, h = 2 * r / n;
    let sum = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = -r + (i + .5) * h, y = -r + (j + .5) * h;
      if (x * x + y * y > r * r) continue;
      sum += Math.exp(-((x - q) * (x - q) + y * y) / (2 * s * s));
    }
    return sum * h * h / (2 * Math.PI * s * s);
  }
  // paint each (hidden) CSS blob, with its themed colour and opacity, as its blurred radial profile
  function drawHaze() {
    if (!hazeCv) return;
    const br = hazeBox.getBoundingClientRect();
    if (!br.width) return;
    const k = 144 / br.width;
    hazeCv.width = 144; hazeCv.height = Math.max(1, Math.round(br.height * k));
    const ctx = hazeCv.getContext('2d');
    hazeBlobs.forEach(el => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const m = cs.backgroundColor.match(/[\d.]+/g);
      if (!m || !r.width) return;
      const op = parseFloat(cs.opacity) * (m[3] != null ? +m[3] : 1);
      const R = r.width / 2, s = 70, ext = R + 3 * s;
      const cx = (r.left - br.left + R) * k, cy = (r.top - br.top + R) * k;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ext * k);
      for (let j = 0; j <= 12; j++) g.addColorStop(j / 12, `rgba(${m[0]},${m[1]},${m[2]},${(op * blurDisc(R, s, j / 12 * ext)).toFixed(4)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, hazeCv.width, hazeCv.height);
    });
  }

  /* ---------- theme: lights off ---------- */
  const lightsBtn = $('.lights');
  function setTheme(t) {
    const night = t === 'night';
    // touch screens swap in one frame (see html.swap in site.css)
    html.classList.add('swap');
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('swap')));
    if (night) html.setAttribute('data-theme', 'night'); else html.removeAttribute('data-theme');
    lightsBtn.setAttribute('aria-pressed', String(night));
    lightsBtn.setAttribute('aria-label', night ? 'Turn the lights on' : 'Turn the lights off');
        const meta = d.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', night ? '#1B1411' : '#F6EEE4');
    store.set('hullo-theme', night ? 'night' : 'day');
    drawHaze();
  }
  lightsBtn.addEventListener('click', () => {
    const toNight = html.getAttribute('data-theme') !== 'night';
    setTheme(toNight ? 'night' : 'day');
    if (toNight && G && !RM) {
      // the tube flickers before it holds
      G.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: .7, ease: 'steps(1)', keyframes: { opacity: [0, .9, .1, .7, .2, 1] }, clearProps: 'opacity' });
    }
  });
  if (store.get('hullo-theme') === 'night') setTheme('night'); else setTheme('day');

  /* ---------- shutter menu ---------- */
  const shutter = $('#shutter'), burger = $('.burger');
  const shutterLinks = $$('.shutter-links a, .shutter-foot');
  if (G) G.set(shutter, { y: 0, yPercent: -102 });
  function openMenu() {
    if (html.classList.contains('menu-open')) return;
    if (tray.classList.contains('open')) closeTray();
    html.classList.add('menu-open');
    shutter.style.visibility = 'visible';
    shutter.removeAttribute('inert');
    shutter.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close the menu');
    if (lenis) lenis.stop();
    if (G && !RM) {
      G.killTweensOf(shutter);
      G.to(shutter, { yPercent: 0, duration: .95, ease: 'bounce.out' });
      G.fromTo(shutterLinks, { y: -40, opacity: 0, rotate: -3 }, { y: 0, opacity: 1, rotate: 0, duration: .6, ease: 'back.out(2)', stagger: .06, delay: .35 });
    } else if (G) G.set(shutter, { yPercent: 0 });
    setTimeout(() => { const f = $('.shutter-links a'); if (f) f.focus({ preventScroll: true }); }, 400);
  }
  function closeMenu(after) {
    if (!html.classList.contains('menu-open')) { if (after) after(); return; }
    html.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open the menu');
    shutter.setAttribute('aria-hidden', 'true');
    shutter.setAttribute('inert', '');
    const done = () => { shutter.style.visibility = 'hidden'; if (lenis) lenis.start(); if (after) after(); };
    if (G && !RM) { G.killTweensOf(shutter); G.to(shutter, { yPercent: -102, duration: .55, ease: 'power3.in', onComplete: done }); }
    else { if (G) G.set(shutter, { yPercent: -102 }); done(); }
  }
  burger.addEventListener('click', () => (html.classList.contains('menu-open') ? closeMenu() : openMenu()));

  /* ---------- cart + tray ---------- */
  const tray = $('#tray'), scrim = $('.tray-scrim'), receipt = $('.receipt');
  const rcItems = $('.rc-items'), rcSum = $('.rc-sum'), rcForm = $('.rc-form'), rcErr = $('.rc-err');
  const rcBody = $('.rc-body'), rcTicket = $('.rc-ticket'), pickup = $('#pickup');
  const CAT = {};
  $$('.card').forEach(c => {
    CAT[c.dataset.id] = { name: $('h3', c).textContent, price: +c.dataset.price, img: $('img', c).getAttribute('src'), bg: c.style.getPropertyValue('--bg') };
  });
  const cart = [];
  let shopLines = [];
  let shopTotalCents = 0;
  function rows() { return shopCart ? shopLines : cart; }
  function money(cents) { return shopCart.formatCents(cents); }
  function cartAdd(item) {
    if (shopCart) {
      if (String(item.key).startsWith('cup:')) {
        rcErr.textContent = 'the built cup stays on the window. send something from the menu.';
      }
      return;
    }
    const hit = cart.find(x => x.key === item.key);
    if (hit) hit.qty++; else cart.push(Object.assign({ qty: 1 }, item));
    cartUI(true);
  }
  function addItem(id) {
    const c = CAT[id];
    if (!c) return;
    const card = $('.card[data-id="' + id + '"]');
    if (card && card.dataset.stock === '0') return;
    if (shopCart) {
      Promise.resolve(shopCart.addProduct(id)).then((ok) => {
        if (!alive) return;
        if (!ok) rcErr.textContent = 'could not add that. try again.';
        else rcErr.textContent = '';
      }).catch(() => { if (alive) rcErr.textContent = 'could not add that. try again.'; });
      return;
    }
    cartAdd({ key: id, name: c.name, price: c.price, rx: '' });
  }
  function cartUI(bumpIt) {
    const list = rows();
    const n = list.reduce((s, x) => s + x.qty, 0);
    countEl.textContent = n;
    if (bumpIt) {
      const cEl = countEl.parentElement;
      cEl.classList.remove('bump'); orderPill.classList.remove('bump'); void cEl.offsetWidth;
      cEl.classList.add('bump'); orderPill.classList.add('bump');
    }
    rcItems.innerHTML = '';
    list.forEach((x, i) => {
      const li = d.createElement('li');
      li.innerHTML = `<span class="nm"></span><span class="qt"><button type="button" data-q="-1" aria-label="One less">${ICON_MINUS}</button><output></output><button type="button" data-q="1" aria-label="One more">${ICON_PLUS}</button></span><span class="rx"></span>`;
      $('.nm', li).textContent = x.name;
      $('.rx', li).textContent = shopCart
        ? (x.detail ? x.detail + ', ' : '') + money(x.totalCents)
        : (x.rx ? x.rx + ', ' : '') + (x.price * x.qty) + ' ' + (root.dataset.currency || 'SAR');
      $('output', li).textContent = x.qty;
      if (x.id) li.dataset.id = x.id;
      li.dataset.i = i;
      rcItems.appendChild(li);
    });
    if (shopCart) {
      rcSum.textContent = money(shopTotalCents);
      const extra = rcSum.nextSibling;
      if (extra && extra.nodeType === 3) extra.textContent = '';
    } else {
      rcSum.textContent = cart.reduce((s, x) => s + x.price * x.qty, 0);
    }
    receipt.classList.toggle('has-items', n > 0);
  }
  function shopChange(id, next) {
    const job = next <= 0 ? shopCart.removeLine(id) : shopCart.setQuantity(id, next);
    Promise.resolve(job).then((ok) => {
      if (!alive || ok) return;
      rcErr.textContent = 'could not update that. try again.';
    }).catch(() => { if (alive) rcErr.textContent = 'could not update that. try again.'; });
  }
  rcItems.addEventListener('click', e => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const li = b.closest('li');
    if (shopCart) {
      const id = li.dataset.id;
      const row = shopLines.find(x => x.id === id);
      if (!row) return;
      shopChange(id, row.qty + +b.dataset.q);
      return;
    }
    const i = +li.dataset.i;
    cart[i].qty += +b.dataset.q;
    if (cart[i].qty <= 0) cart.splice(i, 1);
    cartUI(false);
  });
  let lastFocus = null;
  function openTray() {
    if (html.classList.contains('menu-open')) closeMenu();
    lastFocus = d.activeElement;
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add('on'));
    tray.classList.add('open');
    tray.removeAttribute('inert');
    tray.setAttribute('aria-hidden', 'false');
    if (lenis) lenis.stop();
    setTimeout(() => $('.rc-close').focus({ preventScroll: true }), 60);
  }
  function closeTray() {
    tray.classList.remove('open');
    tray.setAttribute('inert', '');
    tray.setAttribute('aria-hidden', 'true');
    scrim.classList.remove('on');
    setTimeout(() => { if (!tray.classList.contains('open')) scrim.hidden = true; }, 450);
    if (lenis && !html.classList.contains('menu-open')) lenis.start();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  orderPill.addEventListener('click', openTray);
  $('.rc-close').addEventListener('click', closeTray);
  scrim.addEventListener('click', closeTray);
  d.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (tray.classList.contains('open')) closeTray();
    else if (html.classList.contains('menu-open')) closeMenu();
  });
  rcForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (shopCart) {
      if (!shopLines.length) { rcErr.textContent = 'add something first.'; return; }
      rcErr.textContent = '';
      const btn = $('.rc-send', rcForm);
      if (btn) btn.disabled = true;
      let ok = false;
      try { ok = await shopCart.goCheckout(); } catch (err2) { ok = false; }
      if (!ok) { rcErr.textContent = 'could not send that. try again.'; if (btn) btn.disabled = false; return; }
      closeTray();
      if (btn) btn.disabled = false;
      return;
    }
    if (!cart.length) { rcErr.textContent = 'add something first.'; return; }
    if (typeof opts.getCheckout === 'function') {
      if (cart.some((x) => String(x.key).startsWith('cup:'))) {
        rcErr.textContent = 'the built cup stays on the window. send something from the menu.';
        return;
      }
      const go = opts.getCheckout();
      if (!go) { rcErr.textContent = 'the window is not taking orders yet.'; return; }
      const btn = $('.rc-send', rcForm);
      if (btn) btn.disabled = true;
      const lines = cart.map((x) => ({ productId: x.key, quantity: x.qty }));
      let ok = false;
      try { ok = await go(lines); } catch (err2) { ok = false; }
      if (!ok) { rcErr.textContent = 'could not send that. try again.'; if (btn) btn.disabled = false; return; }
      cart.length = 0;
      cartUI(false);
      closeTray();
      return;
    }
    const name = pickup.value.trim();
    if (!name) { rcErr.textContent = 'we need a name to shout at the window.'; pickup.focus(); return; }
    rcErr.textContent = '';
    const num = 100 + Math.floor(Math.random() * 900);
    $('.rc-num').textContent = '#' + num;
    $('.rc-for').textContent = `for ${name.toLowerCase()}, ready in about 6 min`;
    pickup.value = '';
    cart.length = 0;
    cartUI(false);
    rcBody.hidden = true;
    rcTicket.hidden = false;
    if (G && !RM) {
      // thermal printer: the ticket feeds out in steps
      G.fromTo(rcTicket, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: 'steps(14)' });
      G.fromTo('.rc-num', { scale: .6, rotate: -8 }, { scale: 1, rotate: 0, duration: .8, ease: 'back.out(2.4)', delay: .9 });
    }
    setTimeout(() => $('.rc-again').focus({ preventScroll: true }), 50);
  });
  $('.rc-again').addEventListener('click', () => { rcTicket.hidden = true; rcBody.hidden = false; $('.rc-close').focus({ preventScroll: true }); });
  cartUI(false);

  // fly something into the order pill along an arc
  const flyLayer = $('.flyer-layer');
  function flyTo(src, opts = {}) {
    if (!src || RM || !G) { if (opts.done) opts.done(); return; }
    const a = src.getBoundingClientRect(), b = orderPill.getBoundingClientRect();
    const fl = d.createElement('div');
    fl.className = 'flyer';
    const w = opts.w || Math.min(a.width, 150), h = opts.h || w * (a.height / a.width);
    fl.style.width = w + 'px'; fl.style.height = h + 'px';
    if (opts.round === false) { fl.style.borderRadius = '0'; fl.style.boxShadow = 'none'; fl.style.overflow = 'visible'; }
    if (opts.bg) fl.style.background = opts.bg;
    fl.appendChild(src.cloneNode(true));
    flyLayer.appendChild(fl);
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
    const ex = b.left + b.width / 2, ey = b.top + b.height / 2;
    const cx = lerp(sx, ex, .35), cy = Math.min(sy, ey) - 180;
    const o = { t: 0 };
    G.to(o, {
      t: 1, duration: .85, ease: 'power2.in',
      onUpdate() {
        const t = o.t, u = 1 - t;
        const x = u * u * sx + 2 * u * t * cx + t * t * ex;
        const y = u * u * sy + 2 * u * t * cy + t * t * ey;
        const s = lerp(1, .12, t);
        fl.style.transform = `translate3d(${x - w / 2}px,${y - h / 2}px,0) rotate(${t * 540}deg) scale(${s})`;
      },
      onComplete() { fl.remove(); if (opts.done) opts.done(); },
    });
  }

  /* ---------- menu cards ---------- */
  const cards = $$('.card');
  const cardIO = 'IntersectionObserver' in window && !RM ? new IntersectionObserver(ents => {
    ents.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      cardIO.unobserve(el);
      const idx = cards.indexOf(el) % 4;
      if (G) {
        G.fromTo(el, { '--fy': '-90px', '--fr': (idx % 2 ? 14 : -12) + 'deg', '--fs': 1.1, opacity: 0 }, { '--fy': '0px', '--fr': '0deg', '--fs': 1, opacity: 1, duration: .9, ease: 'back.out(1.5)', delay: idx * .08 });
      }
    });
  }, { rootMargin: '0px 0px -12% 0px' }) : null;
  if (cardIO && G) cards.forEach(c => { G.set(c, { opacity: 0 }); cardIO.observe(c); });

  cards.forEach(c => {
    const inner = c.firstElementChild;
    c.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = c.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
      inner.style.setProperty('--ty2', (nx * 12).toFixed(2) + 'deg');
      inner.style.setProperty('--tx', (-ny * 10).toFixed(2) + 'deg');
    });
    c.addEventListener('pointerleave', () => { inner.style.setProperty('--ty2', '0deg'); inner.style.setProperty('--tx', '0deg'); });
    $('.add', c).addEventListener('click', ev => {
      const btn = ev.currentTarget;
      btn.classList.remove('done'); void btn.offsetWidth; btn.classList.add('done');
      flyTo($('.card-ph', c), { w: 110, done: () => addItem(c.dataset.id) });
    });
  });

  const chips = $$('.filters .chip');
  chips.forEach(ch => ch.addEventListener('click', () => {
    const f = ch.dataset.f;
    chips.forEach(x => { const on = x === ch; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
    const first = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
    const wasHidden = new Map(cards.map(c => [c, c.classList.contains('is-hidden')]));
    cards.forEach(c => c.classList.toggle('is-hidden', !(f === 'all' || c.dataset.tags.split(' ').includes(f))));
    if (!G || RM) return;
    cards.forEach(c => {
      if (c.classList.contains('is-hidden')) return;
      G.killTweensOf(c);
      if (wasHidden.get(c)) {
        G.fromTo(c, { '--fs': .5, '--fy': '-40px', '--fx': '0px', '--fr': '-10deg', opacity: 0 }, { '--fs': 1, '--fy': '0px', '--fr': '0deg', opacity: 1, duration: .7, ease: 'back.out(1.8)' });
      } else {
        const a = first.get(c), b = c.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top;
        G.set(c, { opacity: 1, '--fs': 1, '--fr': '0deg' });
        if (Math.abs(dx) + Math.abs(dy) > 1) G.fromTo(c, { '--fx': dx + 'px', '--fy': dy + 'px' }, { '--fx': '0px', '--fy': '0px', duration: .75, ease: 'expo.out' });
      }
    });
    measureSoon();
  }));

  /* ---------- hero stickers: peel, drag, throw back, tap to add ---------- */
  stks.forEach((el, i) => {
    let sx = 0, sy = 0, moved = 0, id = null;
    el.addEventListener('pointerdown', e => {
      id = e.pointerId; sx = e.clientX; sy = e.clientY; moved = 0;
      el.setPointerCapture(id);
      el.classList.add('is-drag');
      if (G) { G.killTweensOf(drag[i]); G.to(drag[i], { lift: .14, wig: (Math.random() - .5) * 16, duration: .3, ease: 'back.out(3)' }); }
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      drag[i].x = e.clientX - sx; drag[i].y = e.clientY - sy;
      moved = Math.max(moved, Math.hypot(drag[i].x, drag[i].y));
      render();
    });
    const up = e => {
      if (e.pointerId !== id) return;
      id = null;
      el.classList.remove('is-drag');
      if (G) G.to(drag[i], { x: 0, y: 0, lift: 0, wig: 0, duration: 1.1, ease: 'elastic.out(1, .45)' });
      else { drag[i].x = drag[i].y = drag[i].lift = drag[i].wig = 0; render(); }
      if (moved < 6 && e.type === 'pointerup') flyTo(el.querySelector('img'), { w: 100, done: () => addItem(el.dataset.item) });
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flyTo(el.querySelector('img'), { w: 100, done: () => addItem(el.dataset.item) }); } });
    el.setAttribute('aria-label', 'Add ' + el.textContent.trim() + ' to your order');
  });
  letters.forEach(l => l.addEventListener('click', () => { l.classList.remove('squish'); void l.offsetWidth; l.classList.add('squish'); }));

  // something reacts to being ignored: an idle sticker goes "psst"
  let idleT = performance.now();
  ['pointermove', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { idleT = performance.now(); }, { passive: true }));
  let lastPsst = 0;
  loops.add(t => {
    if (!G || RM || !loaderGone || P > .02) return;
    if (t - idleT > 8000 && t - lastPsst > 3600) {
      lastPsst = t;
      const i = Math.floor(Math.random() * stks.length);
      G.fromTo(drag[i], { wig: 0 }, { keyframes: { wig: [-14, 12, -9, 6, 0] }, duration: .9, ease: 'none' });
      const li = letters[4];
      li.classList.remove('squish'); void li.offsetWidth; li.classList.add('squish');
    }
  });

  /* ---------- build a cup ---------- */
  const cupSvg = $('.cup'), lySyrup = $('.ly-syrup'), lyMilk = $('.ly-milk'), lyTop = $('.ly-top');
  const foamEl = $('.foam'), iceG = $('.ice'), stream = $('.pour-stream');
  const cupName = $('.cup-name'), cupCap = $('.cup-cap'), bpN = $('.bp-n');
  const COL = {
    base: { espresso: '#4A2A1B', coldbrew: '#2B170E', matcha: '#86A857', ube: '#9270C2' },
    milk: { oat: '#EFE2CC', whole: '#FBF6EE', almond: '#EADBC2', none: '#EFE2CC' },
    sweet: { none: '#EFE2CC', vanilla: '#F2E3B0', caramel: '#C4843E', cherry: '#B8323A', condensed: '#F3E6C4' },
  };
  const PRICE = { base: { espresso: 15, coldbrew: 16, matcha: 18, ube: 18 }, size: { s: -2, m: 0, l: 3 } };
  const VIBES = {
    awake: { s: { base: 'coldbrew', milk: 'none', sweet: 'none', ice: 3, size: 'l', foam: false }, cap: "one sip and you're a person again." },
    locked: { s: { base: 'espresso', milk: 'oat', sweet: 'none', ice: 2, size: 'l', foam: false }, cap: 'focus mode, but make it creamy.' },
    soft: { s: { base: 'matcha', milk: 'oat', sweet: 'vanilla', ice: 2, size: 'm', foam: true }, cap: 'gentle. like a nap you can drink.' },
    main: { s: { base: 'ube', milk: 'whole', sweet: 'vanilla', ice: 2, size: 'm', foam: true }, cap: 'purple enough to get looked at.' },
    sunday: { s: { base: 'espresso', milk: 'whole', sweet: 'condensed', ice: 2, size: 'm', foam: false }, cap: 'slow morning energy.' },
  };
  const cup = { base: 'espresso', milk: 'oat', sweet: 'none', ice: 2, size: 'm', foam: false, vibe: 'locked' };
  const lv = { syrup: 0, milk: 0, base: 0, foam: 0, amp: 0, ampT: 0 };
  const CUP_BOT = 440, CUP_TOP_FILL = 118;

  function targets(s) {
    const syrup = s.sweet === 'none' ? 0 : (s.sweet === 'condensed' ? 40 : 28);
    const foam = s.foam ? 38 : 0;
    const total = CUP_BOT - CUP_TOP_FILL - foam;
    const milkBy = { espresso: 186, coldbrew: 92, matcha: 168, ube: 168 };
    const milk = s.milk === 'none' ? 0 : milkBy[s.base];
    return { syrup, milk, base: total - syrup - milk, foam };
  }
  function drinkName(s) {
    let core;
    if (s.base === 'espresso') core = s.milk === 'none' ? 'americano' : (s.sweet === 'condensed' ? 'spanish latte' : 'latte');
    else if (s.base === 'coldbrew') core = 'cold brew';
    else if (s.base === 'matcha') core = s.milk === 'none' ? 'matcha on ice' : 'matcha latte';
    else core = s.milk === 'none' ? 'ube on ice' : 'ube latte';
    const sweetW = { none: '', vanilla: 'vanilla', caramel: 'caramel', cherry: 'cherry', condensed: core === 'spanish latte' ? '' : 'sweet' }[s.sweet];
    const milkW = (s.base === 'coldbrew' || core === 'americano' || core === 'spanish latte') ? '' : ({ oat: 'oat', almond: 'almond', whole: '', none: '' }[s.milk]);
    const iced = (core.includes('ice') || s.base === 'coldbrew') ? '' : 'iced';
    let name = [iced, sweetW, milkW, core].filter(Boolean).join(' ');
    if (s.base === 'coldbrew' && s.milk !== 'none') name += s.milk === 'whole' ? ' with milk' : ` with ${s.milk} milk`;
    if (s.foam) name += ', cold foam';
    return name;
  }
  function caption(s) {
    if (s.vibe && VIBES[s.vibe]) return VIBES[s.vibe].cap;
    if (s.foam) return 'a little cloud on top. you earned it.';
    if (s.base === 'ube') return 'purple enough to get looked at.';
    if (s.base === 'matcha') return 'gentle. like a nap you can drink.';
    if (s.base === 'coldbrew' && s.milk === 'none') return "one sip and you're a person again.";
    if (s.sweet === 'condensed') return 'slow morning energy.';
    if (s.base === 'espresso' && s.milk === 'none') return 'cold, dark, zero drama.';
    return 'focus mode, but make it creamy.';
  }
  const price = s => PRICE.base[s.base] + (s.sweet === 'none' ? 0 : 2) + (s.foam ? 3 : 0) + (s.milk === 'almond' ? 2 : 0) + PRICE.size[s.size];

  function drawLiquid() {
    const ySy = CUP_BOT - lv.syrup, yMi = ySy - lv.milk, yTop = yMi - lv.base;
    lySyrup.setAttribute('y', ySy.toFixed(1)); lySyrup.setAttribute('height', Math.max(0, lv.syrup).toFixed(1));
    lyMilk.setAttribute('y', yMi.toFixed(1)); lyMilk.setAttribute('height', Math.max(0, lv.milk).toFixed(1));
    const A = lv.amp * Math.sin(lv.ampT * 9);
    let dStr = `M30 ${CUP_BOT + 20} L30 ${yTop.toFixed(1)}`;
    for (let x = 30; x <= 290; x += 20) dStr += ` L${x} ${(yTop + A * Math.sin(x / 34 + lv.ampT * 6) + A * .6 * ((x - 160) / 130)).toFixed(1)}`;
    dStr += ` L290 ${(yMi + 6).toFixed(1)} L30 ${(yMi + 6).toFixed(1)} Z`;
    lyTop.setAttribute('d', dStr);
    // foam: a lumpy cloud sitting on the surface
    if (lv.foam > .5) {
      const ft = yTop - lv.foam;
      let f = `M30 ${(yTop + 4).toFixed(1)} L30 ${(ft + 8).toFixed(1)}`;
      for (let x = 30; x <= 290; x += 26) f += ` Q${x + 13} ${(ft - 9 + Math.sin(x) * 3 + A * .5).toFixed(1)} ${x + 26} ${(ft + 6).toFixed(1)}`;
      f += ` L290 ${(yTop + 4).toFixed(1)} Z`;
      foamEl.setAttribute('d', f);
    } else foamEl.setAttribute('d', '');
    cup.surface = yTop - lv.foam;
  }
  // ice: little physics bodies that float at the surface
  const cubes = [];
  function syncIce(n) {
    while (cubes.length < n) {
      const r = d.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const size = 30 + Math.random() * 8;
      r.setAttribute('width', size); r.setAttribute('height', size); r.setAttribute('rx', 8);
      iceG.appendChild(r);
      const k = cubes.length;
      cubes.push({ el: r, size, x: 92 + (k % 3) * 52 + (Math.random() * 14 - 7) + (k > 2 ? 26 : 0), y: -80 - k * 50, vy: 0, rot: Math.random() * 60, vr: (Math.random() - .5) * 200, row: k > 2 ? 1 : 0, ph: Math.random() * 6, out: false });
    }
    cubes.forEach((c, k) => { c.out = k >= n; });
  }
  let lastT = 0;
  function icePhys(t) {
    const dt = Math.min(.05, (t - (lastT || t)) / 1000); lastT = t;
    lv.ampT += dt; lv.amp *= Math.pow(.18, dt);
    drawLiquid();
    const surf = cup.surface || 160;
    for (let k = cubes.length - 1; k >= 0; k--) {
      const c = cubes[k];
      if (c.out) {
        c.vy -= 900 * dt; c.y += c.vy * dt;
        if (c.y < -140) { c.el.remove(); cubes.splice(k, 1); continue; }
      } else {
        const rest = surf + 6 + c.row * 26 + Math.sin(t / 700 + c.ph) * 2.5;
        c.vy += 1500 * dt;
        c.y += c.vy * dt;
        if (c.y > rest) { c.y = rest; c.vy *= -.32; if (Math.abs(c.vy) > 80) lv.amp = Math.min(9, lv.amp + 1.2); }
        c.vr *= Math.pow(.2, dt); c.rot += c.vr * dt;
      }
      c.el.setAttribute('x', (c.x - c.size / 2).toFixed(1));
      c.el.setAttribute('y', (c.y - c.size / 2).toFixed(1));
      c.el.setAttribute('transform', `rotate(${c.rot.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)})`);
    }
  }
  const buildSec = $('#build');
  let buildOn = false;
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { buildOn = e[0].isIntersecting; }, { rootMargin: '200px 0px' }).observe(buildSec);
  else buildOn = true;
  loops.add(t => { if (buildOn) icePhys(t); else lastT = 0; });

  function applyCup(prev) {
    const tg = targets(cup);
    cupSvg.classList.toggle('has-foam', cup.foam);
    lyTop.style.fill = COL.base[cup.base];
    lyMilk.style.fill = COL.milk[cup.milk];
    lySyrup.style.fill = COL.sweet[cup.sweet];
    foamEl.style.fill = cup.sweet === 'cherry' ? '#F4C8CB' : '#F8F1E7';
    const sc = { s: .88, m: 1, l: 1.1 }[cup.size];
    cupSvg.style.transform = `scale(${sc})`;
    cupSvg.style.transformOrigin = '50% 100%';
    cupSvg.style.transition = 'transform .6s cubic-bezier(.34,1.8,.64,1)';
    if (G && !RM) {
      G.to(lv, { syrup: tg.syrup, milk: tg.milk, base: tg.base, foam: tg.foam, duration: .9, ease: 'power3.out' });
      lv.amp = Math.min(12, lv.amp + 7);
      if (prev && prev.base !== cup.base) {
        const surf = CUP_BOT - tg.syrup - tg.milk - tg.base;
        stream.style.fill = COL.base[cup.base];
        G.killTweensOf(stream);
        G.timeline()
          .set(stream, { attr: { y: -40, height: 0 } })
          .to(stream, { attr: { height: surf + 60 }, duration: .28, ease: 'power2.in' })
          .to(stream, { attr: { y: surf + 20, height: 0 }, duration: .32, ease: 'power2.in' }, '+=.18');
      }
    } else Object.assign(lv, tg);
    syncIce(cup.ice * 2);
    cupName.textContent = drinkName(cup);
    cupCap.textContent = caption(cup);
    bpN.textContent = price(cup);
    // controls reflect state
    $$('.build [data-group]').forEach(g => {
      const key = g.dataset.group;
      if (key === 'foam') { g.setAttribute('aria-checked', String(cup.foam)); return; }
      $$('.chip', g).forEach(ch => {
        const on = String(cup[key]) === ch.dataset.v;
        if (key === 'vibe') ch.classList.toggle('is-on', on);
        else { ch.setAttribute('aria-checked', String(on)); ch.tabIndex = on ? 0 : -1; }
      });
    });
    drawLiquid();
  }
  $$('.build [data-group]').forEach(g => {
    g.addEventListener('click', e => {
      const key = g.dataset.group;
      const prev = Object.assign({}, cup);
      if (key === 'foam') { cup.foam = !cup.foam; cup.vibe = null; applyCup(prev); return; }
      const ch = e.target.closest('.chip');
      if (!ch) return;
      const v = ch.dataset.v;
      if (key === 'vibe') { Object.assign(cup, VIBES[v].s); cup.vibe = v; }
      else { cup[key] = key === 'ice' ? +v : v; cup.vibe = null; }
      applyCup(prev);
    });
    if (g.getAttribute('role') === 'radiogroup') {
      g.addEventListener('keydown', e => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
        e.preventDefault();
        const list = $$('.chip', g);
        const i = list.findIndex(x => x.getAttribute('aria-checked') === 'true');
        const n = list[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
        n.click(); n.focus();
      });
    }
  });
  $('.add-cup').addEventListener('click', () => {
    const s = cup;
    const rx = [s.milk === 'none' ? 'no milk' : s.milk, s.sweet === 'none' ? '' : s.sweet, ['', 'light ice', 'normal ice', 'extra ice'][s.ice], { s: 'small', m: 'regular', l: 'big' }[s.size]].filter(Boolean).join(', ');
    const item = { key: 'cup:' + JSON.stringify([s.base, s.milk, s.sweet, s.ice, s.size, s.foam]), name: drinkName(s), price: price(s), rx };
    flyTo(cupSvg, { w: 90, h: 130, round: false, done: () => cartAdd(item) });
  });
  lv.base = 200;
  applyCup(null);

  /* ---------- marquee: speed follows scroll velocity ---------- */
  const mq = $('.mq-track');
  if (mq) {
    savedMq = mq.innerHTML; mq.innerHTML = savedMq + savedMq;
    let mx = 0, half = 0, mqOn = false;
    const mqMeasure = () => { half = mq.scrollWidth / 2; };
    mqMeasure();
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { mqOn = e[0].isIntersecting; }, { rootMargin: '100px 0px' }).observe(mq.closest('.mq-wrap'));
    let lt = 0;
    loops.add(t => {
      const dt = Math.min(.05, (t - (lt || t)) / 1000); lt = t;
      if (!mqOn || RM) return;
      const v = lenis ? Math.abs(lenis.velocity || 0) : 0;
      mx -= (60 + Math.min(900, v * 28)) * dt;
      if (!half) mqMeasure();
      if (half && mx <= -half) mx += half;
      mq.style.transform = `translate3d(${mx.toFixed(2)}px,0,0)`;
    });
    window.addEventListener('resize', mqMeasure);
  }

  /* ---------- camera roll: develop, flash, drag ---------- */
  const snaps = $$('.snap');
  const develop = (s, delay) => setTimeout(() => s.classList.add('dev'), delay);
  if ('IntersectionObserver' in window && !RM) {
    const io = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        develop(en.target, snaps.indexOf(en.target) * 260);
      });
    }, { threshold: .35 });
    snaps.forEach(s => io.observe(s));
  } else snaps.forEach(s => s.classList.add('dev'));
  let zTop = 5;
  snaps.forEach(s => {
    const flash = $('.snap-flash', s);
    const st = { x: 0, y: 0, vx: 0, vy: 0, id: null, sx: 0, sy: 0, moved: 0, lx: 0, ly: 0, lt: 0, ox: 0, oy: 0, rot: 0 };
    const place = () => { s.style.transform = `translate3d(${st.x}px,${st.y}px,0) rotate(calc(var(--r) + ${st.rot}deg))`; };
    s.addEventListener('pointerdown', e => {
      if (M.mobile) return;
      st.id = e.pointerId; st.sx = e.clientX; st.sy = e.clientY; st.moved = 0; st.ox = st.x; st.oy = st.y;
      st.lx = e.clientX; st.ly = e.clientY; st.lt = performance.now();
      s.setPointerCapture(st.id);
      s.classList.add('is-drag');
      s.style.zIndex = ++zTop;
      if (G) G.killTweensOf(st);
    });
    s.addEventListener('pointermove', e => {
      if (e.pointerId !== st.id) return;
      const tn = performance.now(), dtm = Math.max(1, tn - st.lt);
      st.vx = (e.clientX - st.lx) / dtm; st.vy = (e.clientY - st.ly) / dtm;
      st.lx = e.clientX; st.ly = e.clientY; st.lt = tn;
      st.x = st.ox + e.clientX - st.sx; st.y = st.oy + e.clientY - st.sy;
      st.rot = clamp(st.vx * 6, -10, 10);
      st.moved = Math.max(st.moved, Math.hypot(e.clientX - st.sx, e.clientY - st.sy));
      place();
    });
    const up = e => {
      if (e.pointerId !== st.id) return;
      st.id = null;
      s.classList.remove('is-drag');
      if (st.moved < 6) { shoot(); return; }
      if (G) {
        // a little throw, kept on the table
        const tb = s.parentElement.getBoundingClientRect(), r = s.getBoundingClientRect();
        const tx = clamp(st.x + st.vx * 160, st.x - (r.left - tb.left) - 40, st.x + (tb.right - r.right) + 40);
        const ty = clamp(st.y + st.vy * 160, st.y - (r.top - tb.top) - 40, st.y + (tb.bottom - r.bottom) + 60);
        G.to(st, { x: tx, y: ty, rot: 0, duration: .9, ease: 'expo.out', onUpdate: place });
      }
    };
    s.addEventListener('pointerup', up);
    s.addEventListener('pointercancel', up);
    s.addEventListener('click', () => { if (M.mobile) shoot(); });
    function shoot() {
      if (!G || RM) return;
      G.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: .9, ease: 'power2.out' });
      s.classList.remove('dev'); void s.offsetWidth;
      setTimeout(() => s.classList.add('dev'), 120);
    }
  });

  /* ---------- hanging sign + live hours (Riyadh) ---------- */
  const hang = $('.hang-sign'), hangState = $('.hang-state'), hangSub = $('.hang-sub');
  const nowEl = $('.now'), badgeState = $('.badge-state');
  function riyadh() {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(new Date());
      const g = k => (parts.find(x => x.type === k) || {}).value;
      let h = +g('hour'); if (h === 24) h = 0;
      return { day: g('weekday'), h, m: +g('minute') };
    } catch (e) { const t = new Date(); return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getDay()], h: t.getHours(), m: t.getMinutes() }; }
  }
  function hoursUI() {
    const t = riyadh();
    let open;
    if (t.day === 'Fri') open = t.h >= 14;
    else if (t.day === 'Sat') open = t.h < 1 || (t.h >= 7 && t.h < 23);
    else open = t.h >= 7 && t.h < 23;
    const back = (t.day === 'Fri' && t.h < 14) ? '2pm' : '7am';
    const h12 = ((t.h + 11) % 12) + 1, ap = t.h < 12 ? 'am' : 'pm';
    const clock = `${h12}:${String(t.m).padStart(2, '0')}${ap}`;
    hangState.textContent = open ? 'open' : 'closed';
    hangSub.textContent = open ? 'come up to the window' : `back at ${back}`;
    hang.classList.toggle('is-closed', !open);
    badgeState.textContent = open ? 'open' : 'closed';
    badge.classList.toggle('is-closed', !open);
    nowEl.innerHTML = open ? `it's ${clock} in riyadh. we're <b>open</b>.` : `it's ${clock} in riyadh. the shutter's down, back at ${back}.`;
  }
  hoursUI();
  setInterval(hoursUI, 30000);
  const pend = { a: 0, v: 0, lastX: null };
  hang.addEventListener('pointermove', e => {
    if (pend.lastX != null) pend.v += clamp((e.clientX - pend.lastX) * .9, -40, 40);
    pend.lastX = e.clientX;
  });
  hang.addEventListener('pointerleave', () => { pend.lastX = null; });
  hang.addEventListener('click', () => { hang.classList.toggle('flipped'); pend.v += 90; hang.setAttribute('aria-label', hang.classList.contains('flipped') ? 'Flip the sign back' : 'Flip the sign to see the hours'); });
  let visitOn = false, plt = 0;
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { visitOn = e[0].isIntersecting; }, { rootMargin: '100px 0px' }).observe(hang);
  loops.add(t => {
    const dt = Math.min(.05, (t - (plt || t)) / 1000); plt = t;
    if (!visitOn || RM) return;
    const breeze = Math.sin(t / 1300) * 5 + Math.sin(t / 530) * 2;
    pend.v += (-38 * pend.a + breeze) * dt;
    pend.v *= Math.pow(.35, dt);
    pend.a += pend.v * dt;
    pend.a = clamp(pend.a, -24, 24);
    hang.style.transform = `rotate(${pend.a.toFixed(2)}deg)`;
  });

  /* ---------- footer: letters dodge and squish under the cursor ---------- */
  const fm = $('.foot-mark'), fl = $$('.foot-mark span');
  const fs = fl.map(() => ({ x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1 }));
  let footOn = false, fp = null;
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { footOn = e[0].isIntersecting; }, {}).observe(fm);
  fm.addEventListener('pointermove', e => { fp = { x: e.clientX, y: e.clientY }; });
  fm.addEventListener('pointerleave', () => { fp = null; });
  loops.add(() => {
    if (!footOn || RM) return;
    fl.forEach((el, i) => {
      const f = fs[i];
      f.tx = 0; f.ty = 0; f.ts = 1;
      if (fp) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2 - f.x, cy = r.top + r.height / 2 - f.y;
        const dx = cx - fp.x, dy = cy - fp.y, dist = Math.hypot(dx, dy), R = r.width * 1.1;
        const k = clamp(1 - dist / R);
        f.tx = (dx / (dist || 1)) * k * r.width * .3;
        f.ty = (dy / (dist || 1)) * k * r.height * .12 - k * 20;
        f.ts = 1 - k * .22;
      }
      f.x += (f.tx - f.x) * .14; f.y += (f.ty - f.y) * .14; f.s += (f.ts - f.s) * .14;
      el.style.transform = `translate3d(${f.x.toFixed(2)}px,${f.y.toFixed(2)}px,0) scale(${(2 - f.s).toFixed(3)},${f.s.toFixed(3)})`;
    });
  });

  /* ---------- sizing ---------- */
  let rsT = 0;
  function measureSoon() { clearTimeout(rsT); rsT = setTimeout(() => { measure(); render(); }, 120); }
  window.addEventListener('resize', measureSoon);
  if (PACE_MQ.addEventListener) PACE_MQ.addEventListener('change', measureSoon); else if (PACE_MQ.addListener) PACE_MQ.addListener(measureSoon);
  window.addEventListener('load', () => { measure(); render(); if (lenis && lenis.resize) lenis.resize(); });
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => { measure(); render(); });
  measure();
  render();

  /* ---------- QA hook ---------- */
  let cartPainted = false;
  const api = {
    setScroll(f) { const max = d.documentElement.scrollHeight - (M.vh || window.innerHeight); jump(max * clamp(f)); },
    setP(p) { jump(M.sceneTop + unpace(clamp(p)) * M.sceneDist); },
    openMenu, closeMenu, openTray, closeTray, addItem, setTheme,
    goTo(sel) { goTo(sel, false); },
    reveal() {
      cards.forEach(c => { if (G) { G.killTweensOf(c); G.set(c, { opacity: 1, '--fx': '0px', '--fy': '0px', '--fr': '0deg', '--fs': 1 }); } });
      snaps.forEach(s => s.classList.add('dev'));
    },
    setCart(lines, totalCents) {
      if (!shopCart) return;
      const prev = shopLines.reduce((s, x) => s + x.qty, 0);
      shopTotalCents = typeof totalCents === 'number' ? totalCents : 0;
      shopLines = (Array.isArray(lines) ? lines : []).map((x) => ({
        id: x.id,
        name: x.name || '',
        detail: x.detail || '',
        qty: x.quantity > 0 ? x.quantity : 0,
        totalCents: typeof x.totalCents === 'number' ? x.totalCents : 0,
      })).filter((x) => x.id && x.qty > 0);
      const next = shopLines.reduce((s, x) => s + x.qty, 0);
      const bump = cartPainted && next > prev;
      cartPainted = true;
      cartUI(bump);
    },
    state() { return { p: P, cart: rows().map(x => ({ name: x.name, qty: x.qty })), theme: html.getAttribute('data-theme') || 'day', loaderGone, cup: Object.assign({}, cup), M: { vw: M.vw, vh: M.vh, s1: M.s1, zEnd: M.zEnd, sceneDist: M.sceneDist } }; },
    cam() { return Object.assign({}, cam, { clip: Object.assign({}, clip) }); },
  };

      window.__site = api
      window.__site.__hullo = true
      mqEl = $(".mq-track")
      if (ownGsap) {
        restoreTicker = () => { G.ticker.add(G.updateRoot); G.ticker.lagSmoothing(500) }
      }
    }, root)
  } finally {
    EventTarget.prototype.addEventListener = origAdd
  }

  return () => {
    alive = false
    ac.abort()
    nativeCAF(rafId)
    for (const id of pendingTimers) nativeClearTimeout(id)
    for (const id of intervals) nativeClearInterval(id)
    pendingTimers.clear()
    intervals.clear()
    if (lenis) { lenis.destroy(); lenis = null }
    // Revert kills the plain-object tweens too. Their onUpdate is render(), and a
    // dev remount would otherwise leave the first camera writing over the second.
    if (ctx) ctx.revert()
    restoreTicker()
    gsap.killTweensOf(root.querySelectorAll("*"))
    if (mqEl && savedMq != null) mqEl.innerHTML = savedMq
    if (window.__site && window.__site.__hullo) window.__site = previousSite
  }
}
