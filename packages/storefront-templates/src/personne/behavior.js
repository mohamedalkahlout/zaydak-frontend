/* PERSONNE behaviour. The React tree owns the markup. This module measures and draws it. */
/* eslint-disable */
import Lenis from "lenis"
import { PERSONNE_ASSETS as A } from "./assets.js"
import { PersonneCoat } from "./coat.js"
import { PIECES, SIZES } from "./data.js"
import { PersonneRail } from "./rail.js"

export function mountPersonne(root, art) {
  var raf = 0
  var offs = []
  function listen(target, type, fn, opt) {
    target.addEventListener(type, fn, opt)
    offs.push(function () { target.removeEventListener(type, fn, opt) })
  }
  var scrollRestoration = history.scrollRestoration
  var doc = root;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var smooth = function (a, b, x) { var t = seg(x, a, b); return t * t * (3 - 2 * t); };
  var eio = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var eout = function (t) { return 1 - Math.pow(1 - t, 3); };
  var expo = function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  var backOut = function (t, s) { s = s == null ? 1.9 : s; var u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
  var touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]rm=1/.test(location.search);
  if (RM) doc.classList.add('rm');
  var fmt = function (n) { return '€' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  // viewport size, kept from resize events so per-frame code never asks layout for it
  var VW = window.innerWidth, VH = window.innerHeight;
  listen(window, 'resize', function () { VW = window.innerWidth; VH = window.innerHeight; });
  // style writes that skip when nothing changed (the story rewrites ~40 transforms a frame)
  function setT(el, v) { if (el._t !== v) { el._t = v; el.style.transform = v; } }
  function setV(el, v) { if (el._v !== v) { el._v = v; el.style.visibility = v; } }

  /* ---------------- elements ---------------- */
  var story = $('#top'), stage = $('#stage'), giant = $('#giant'), rod = $('#rod'), hanger = $('#hanger');
  var coatCv = $('#coatgl'), liningBg = $('#liningBg'), def = $('#def'), cue = $('#cue'), inside = $('#inside');
  var nav = $('#nav'), tape = $('#tape'), tapeStrip = $('#tapeStrip'), tapeRead = $('#tapeRead');
  var l1 = $('.l1'), l2 = $('.l2'), l3 = $('.l3');
  var inEye = $('.inside-eye'), inP = $('.inside-p'), inBtn = $('.inside .btn');
  tape.setAttribute('data-loader', '');

  /* split words for movement: every word gets its own slot */
  function splitWords(el) {
    if (el._words) return el._words;
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
          parts.forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
            var o = document.createElement('span'); o.className = 'w';
            var i = document.createElement('span'); i.className = 'wi'; i.textContent = w;
            o.appendChild(i); frag.appendChild(o); out.push(i);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !n.classList.contains('sr-only')) walk(n);
      });
    })(el);
    el._words = out;
    return out;
  }
  // italic accents
  l1.innerHTML = '<span class="sr-only">Personne. </span><em>Nobody</em> is wearing it.';
  l2.innerHTML = 'Until <em>you</em> step in.';
  var W1 = splitWords(l1), W2 = splitWords(l2), W3 = splitWords(l3);
  var WIN = splitWords($('.inside-h'));
  if (!$('.g1', giant)) giant.innerHTML = '<span class="g g1">PERS</span><span class="g g2">ONNE</span>';
  var g1 = $('.g1', giant), g2 = $('.g2', giant);

  /* ---------------- smooth scroll ---------------- */
  var lenis = null;
  if (!RM && !touch) {
    try { lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9, smoothWheel: true }); } catch (e) { lenis = null; }
  }
  function scrollY() { return lenis ? lenis.scroll : window.scrollY; }
  function scrollTo(y, opts) {
    // sections below the story skip rendering until they come near (content-visibility); a jump
    // lays them all out first so the target is measured at its real place
    if (typeof y !== 'number') { doc.classList.add('cv-all'); void y.offsetTop; }
    if (lenis) lenis.scrollTo(y, Object.assign({ duration: 1.5 }, opts || {}));
    else window.scrollTo({ top: typeof y === 'number' ? y : y.getBoundingClientRect().top + window.scrollY, behavior: RM ? 'auto' : 'smooth' });
  }

  /* ---------------- WebGL coat ---------------- */
  // the fitting room's own context is made later (getFrCoat), off the boot path
  var coat = null, frCoat = null, frTried = false;
  try {
    coat = new PersonneCoat(coatCv, { dprCap: touch ? 1.75 : 2 });
  } catch (e) { coat = null; doc.classList.add('no-gl'); }
  function getFrCoat() {
    if (!frCoat && !frTried && coat) {
      frTried = true;
      try { frCoat = new PersonneCoat($('#frgl'), { dprCap: touch ? 1.75 : 2 }); } catch (e) { frCoat = null; doc.classList.add('fr-nogl'); }
    }
    return frCoat;
  }
  if (!coat) { var still = $('#coatStill'); if (still && still.dataset.src) still.src = still.dataset.src; }

  function asset(src) {
    var path = String(src).split('?')[0].replace(/^img\//, '');
    return art(path) || art(path.replace(/^m\//, '')) || src;
  }
  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image(); im.decoding = 'async';
      im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(function () { res(im); }, function () { res(im); }); };
      im.onerror = function () { res(null); };
      im.src = asset(src);
    });
  }
  /* textures: fetched once and decoded off the main thread (createImageBitmap). An <img> handed
     to WebGL or read back from a canvas is decoded again on the main thread, which stalled the
     phone for 400 to 700 ms at a time. Falls back to <img> where createImageBitmap is missing. */
  var BM = typeof window.createImageBitmap === 'function' && typeof window.fetch === 'function';
  function blobOf(src) { return fetch(asset(src)).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); }); }
  function bitmapOf(b) { return createImageBitmap(b, { premultiplyAlpha: 'premultiply' }); }
  function loadTex(src) {
    if (!BM) return loadImg(src);
    return blobOf(src).then(bitmapOf).catch(function () { return loadImg(src); });
  }
  // the flats were repainted with the blue lining (2026-10-05): a new URL so no cache keeps the old ones
  var FLAT_V = '?v=20261005a';
  // a phone never draws a rail piece or the fitting room wider than ~420 device px: its copies are
  // 560 px wide (img/m/, a third of the bytes). The hero coat stays full size (the dive zooms into it).
  var PIECE_DIR = Math.min(screen.width || 9999, screen.height || 9999) < 700 ? 'img/m/' : 'img/';
  var M = A.pieces['01'], HG = A.hanger;
  var HOLE = [M.hole[0], M.hole[1]];
  var imgs = { flat: [], ghost: [] };
  var loads = { n: 0, total: 5 };
  function counted(p) { return p.then(function (v) { loads.n++; return v; }); }
  // the loader waits only for what the first screens draw; the lining comes right after
  var heroP = Promise.all([
    counted(loadTex('img/p01-flath.webp' + FLAT_V)), counted(loadTex('img/p01-ghost.webp')),
    counted(loadTex('img/sdf01.png')), counted(hanger.decode ? hanger.decode().catch(function () {}) : loadImg(hanger.currentSrc || hanger.src)),
    counted(document.fonts ? document.fonts.ready : Promise.resolve())
  ]).then(function (r) {
    imgs.ghost[0] = r[1];
    if (coat && r[0]) {
      coat.addPiece('01', r[0], r[1]);
      if (r[2]) coat.setSDF(r[2]);
    }
    return true;
  });
  // the lining (needed from the dive on, two screens of scrolling after the intro lets go)
  heroP.then(function () {
    if (!BM) { doc.classList.add('lin'); return loadImg('img/lining.webp'); }
    return blobOf('img/lining.webp').then(function (b) {
      try { liningBg.style.backgroundImage = 'url(' + URL.createObjectURL(b) + ')'; } catch (e) { doc.classList.add('lin'); }
      return bitmapOf(b);
    }).catch(function () { doc.classList.add('lin'); return loadImg('img/lining.webp'); });
  }).then(function (im) { if (coat && im) coat.setLining(im); });
  var ready = false;
  Promise.race([heroP, new Promise(function (r) { setTimeout(r, 6000); })]).then(function () { ready = true; });

  /* ---------------- layout ---------------- */
  var L = {};
  // the stacked phone composition is for narrow PORTRAIT screens; a phone turned sideways gets
  // the wide one (the same queries drive site.css, so CSS and JS always agree)
  var mqNarrow = window.matchMedia('(max-width: 860px)'), mqLand = window.matchMedia('(min-aspect-ratio: 4/3)');
  function isSmall() { return mqNarrow.matches && !mqLand.matches; }
  function fitGiant() {
    var W = stage.clientWidth, small = isSmall();
    giant.style.fontSize = '100px';
    var w1 = g1.getBoundingClientRect().width, w2 = g2.getBoundingClientRect().width;
    var fs = small ? (W - 24) / Math.max(w1, w2) * 100 : (W - 2 * Math.max(16, W * 0.02)) / (w1 + w2) * 100;
    giant.style.fontSize = fs.toFixed(2) + 'px';
    L.gh = giant.getBoundingClientRect().height;
  }
  function layout() {
    var W = stage.clientWidth, H = stage.clientHeight, small = isSmall();
    L.W = W; L.H = H; L.small = small;
    L.s = small ? Math.min(H * 0.55 / M.h, W * 0.74 / M.w) : Math.min(H * 0.84 / M.h, W * 0.46 / M.w);
    L.top = small ? H * 0.2 : H * 0.115;
    L.hk = 0.94 * M.shoulderW / HG.w;
    var woodCropY = M.hookBase + 2;
    L.rodCrop = [M.tip[0], woodCropY - (HG.woodY - HG.tip[1]) * L.hk + 9 * L.hk];
    var navH = nav.offsetHeight || 64;
    if (small) {
      // the rod hangs below the definition, never through it (short phones put it across "a person")
      def.style.top = '';
      var defBot = def.offsetTop + def.offsetHeight;
      L.top = Math.max(L.top, defBot + 14 - L.rodCrop[1] * L.s);
    } else if (L.top + L.rodCrop[1] * L.s < navH + 10) {
      // short wide screens (a phone on its side): keep the rod clear of the nav, shrink the coat to fit
      L.top = navH + 10 - L.rodCrop[1] * L.s;
      L.s = Math.min(L.s, (H - L.top - H * 0.04) / M.h);
      L.top = navH + 10 - L.rodCrop[1] * L.s;
    }
    L.rodX = W / 2 + (L.rodCrop[0] - M.w / 2) * L.s;
    L.rodY = L.top + L.rodCrop[1] * L.s;
    // hanger element: css size and the rod point inside it
    L.hw = HG.w * L.hk * L.s; L.hh = HG.h * L.hk * L.s;
    L.hox = HG.tip[0] * L.hk * L.s; L.hoy = (HG.tip[1] + 9) * L.hk * L.s;
    hanger.style.width = L.hw.toFixed(1) + 'px';
    hanger.style.transformOrigin = L.hox.toFixed(1) + 'px ' + L.hoy.toFixed(1) + 'px';
    L.walkTo = [W / 2, small ? H * 0.33 : H * 0.34];
    def.style.top = small ? '' : Math.round(L.rodY + 34) + 'px';
    L.defBot = small ? 0 : def.offsetTop + def.offsetHeight;
    // in-app browsers: gw-vh freezes the track, so map on the opening height too
    var vh0 = window.__gwvh && window.__gwvh.on ? window.__gwvh.svh * 100 : H;
    L.storyH = story.offsetHeight;
    L.storyLen = Math.max(1, L.storyH - vh0);
    L.storyTop = story.offsetTop;
    L.storyEnd = L.storyTop + L.storyH + 50;
    fitGiant();
    if (!rail && PersonneRail) PersonneRail.sizeBox(railBox, W, PIECES); // final height before the rail exists
    if (coat) coat.resize(W, H);
    buildTape();
    var st = $('#coatStill');
    if (st) { st.style.height = (M.h * L.s * 0.94).toFixed(0) + 'px'; }
  }

  /* ---------------- the tape measure (loader) ---------------- */
  var tapeBand = tape.querySelector('.tape-band'), tapeMark = tape.querySelector('.tape-mark');
  function buildTape() {
    L.tapeOff = null; // measured once per layout, not every frame of the loader
    if (tapeStrip.childNodes.length) return;
    var html = '';
    for (var c = 10; c <= 300; c += 10) html += '<i style="left:' + (c * 12) + 'px">' + c + '</i>';
    tapeStrip.innerHTML = html;
  }

  /* ---------------- state ---------------- */
  var S = {
    t: 0, dt: 0, p: 0,
    intro: RM ? 'done' : 'load', introT0: 0, dispRead: 0, dropT: 0, slideIn: RM ? 1 : 0,
    th: 0, om: 0, dip: 0, dipV: 0, thud: 0, thudV: 0,
    att: 1, attV: 0, lastInput: 0, mx: 0, my: 0, mxs: 0, mvx: 0,
    fillPulse: 0, fillPulseV: 0,
    px: -1e4, py: -1e4, pvx: 0, pT: 0
  };

  /* one swing for the hanging coat and the footer hanger (the rail runs the same model in
     rail.js): gravity, linear and air damping, a soft stop instead of a wall, fixed sub steps so
     a 120 Hz screen swings exactly like a 60 Hz one. o.th > 0 swings the hem to the left. */
  function swing(o, dt, w0, zeta, push) {
    var n = Math.max(1, Math.ceil(dt * 120 - 1e-6)), h = dt / n;
    for (var i = 0; i < n; i++) {
      var a = -w0 * w0 * Math.sin(o.th) - 2 * zeta * w0 * o.om - 1.6 * o.om * Math.abs(o.om) + push;
      var x = Math.abs(o.th);
      if (x > 0.2) { var k = x - 0.2; a -= (o.th > 0 ? 1 : -1) * 150 * k * (1 + 8 * k); if (o.om * o.th > 0) a -= o.om * 6; }
      o.om += a * h; o.th += o.om * h;
    }
    if (o.th > 0.45) { o.th = 0.45; if (o.om > 0) o.om = 0; } else if (o.th < -0.45) { o.th = -0.45; if (o.om < 0) o.om = 0; }
  }

  function markInput() { S.lastInput = S.t; }
  listen(window, 'pointermove', function (e) {
    var nx = e.clientX / window.innerWidth * 2 - 1;
    S.mvx = (nx - S.mx); S.mx = nx; S.my = e.clientY / window.innerHeight * 2 - 1;
    // the cursor's speed in px/s (events come at 60 to 1000 Hz: a speed, not a per event push)
    var now = e.timeStamp || performance.now();
    if (S.pT && now > S.pT) S.pvx = S.pvx * 0.55 + clamp((e.clientX - S.px) / Math.max(4, now - S.pT) * 1000, -4000, 4000) * 0.45;
    S.px = e.clientX; S.py = e.clientY; S.pT = now;
    markInput();
  }, { passive: true });
  ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (ev) { listen(window, ev, markInput, { passive: true }); });

  /* ---------------- render the story ---------------- */
  var lastScrollV = 0, prevScroll = 0;
  function wordsY(ws, t, from, dir) {
    // t 0..1 enter progress per word with stagger, dir 1 from below
    var n = ws.length;
    for (var i = 0; i < n; i++) {
      var k = clamp(t * (1 + n * 0.12) - i * 0.12, 0, 1);
      var e = eout(k);
      setT(ws[i], 'translateY(' + ((1 - e) * from * dir).toFixed(1) + '%)');
    }
  }
  function wordsOut(ws, t, dir) {
    var n = ws.length;
    for (var i = 0; i < n; i++) {
      var k = clamp(t * (1 + n * 0.1) - i * 0.1, 0, 1);
      var e = eio(k);
      if (k > 0) setT(ws[i], 'translateY(' + (-e * 115 * dir).toFixed(1) + '%)');
    }
  }

  function render() {
    if (!L.W) return;
    var p = S.p, t = S.t, W = L.W, H = L.H;
    // phases
    var liftT = seg(p, 0.035, 0.17), fillT = seg(p, 0.17, 0.36), walkT = seg(p, 0.37, 0.62);
    var diveT = seg(p, 0.62, 0.8), inT = seg(p, 0.8, 0.95);

    // intro pieces
    var introOn = S.intro !== 'done';
    var slide = S.slideIn;
    var dropE = 1;
    if (S.intro === 'load') dropE = 0;
    else if (S.intro === 'drop') { var dt0 = seg(t - S.dropT, 0, 0.62); dropE = dt0 * dt0; }

    // the hanger swings on the rod until it is lifted out
    var hang = 1 - seg(p, 0, 0.05);
    var th = S.th * hang;
    var joint = Math.sin(clamp(liftT / 0.5, 0, 1) * Math.PI) * 16;
    var hangerUp = eio(seg(liftT, 0.22, 1)) * (L.rodY + L.hh + 80);
    var slideX = -(1 - expo(slide)) * (W * 0.62);
    var hx = L.rodX - L.hox + slideX, hy = L.rodY - L.hoy - joint - hangerUp + S.dip;
    var hr = th + Math.sin(seg(liftT, 0.2, 1) * Math.PI) * 0.14;
    setT(hanger, 'translate(' + hx.toFixed(1) + 'px,' + hy.toFixed(1) + 'px) rotate(' + hr.toFixed(4) + 'rad)');
    setV(hanger, liftT >= 1 ? 'hidden' : 'visible');

    // rod: draws in from the left at the start, slides away as the coat fills
    // after that the coat never walks: YOU step in. The camera recentres on the collar (walkE) and
    // comes toward it (stepE: no stop at the end, the dive's own zoom takes the move over)
    var walkE = eio(walkT), stepE = walkT * walkT * (2 - walkT);
    var rodIn = RM ? 1 : expo(seg(t - S.introT0, 0, 0.9));
    var rodOut = eio(seg(fillT, 0.05, 0.75));
    rod.style.transformOrigin = rodOut > 0 ? 'right center' : 'left center';
    setT(rod, 'translateY(' + (L.rodY - 3).toFixed(1) + 'px) scaleX(' + (introOn ? rodIn : 1 - rodOut).toFixed(4) + ')');
    setV(rod, rodOut >= 1 ? 'hidden' : '');

    // attention: ignored long enough, the coat sags back toward the hanger it lost
    var filled = fillT >= 1 && p < 0.62;
    var sag = filled ? (1 - S.att) : 0;

    // coat geometry
    var fill = fillT <= 0 ? 0 : (fillT >= 1 ? 1 : backOut(fillT, 2.1));
    fill = fill - sag * 0.2 + S.fillPulse;
    var slump = eout(seg(liftT, 0.3, 0.85)) * (1 - eout(fillT)) + sag * 0.55;
    var xf = smooth(0.1, 0.7, fillT);
    var breath = Math.sin(t * 1.7) * seg(fillT, 0.7, 1) * (1 - diveT);
    S.mxs += (S.mx - S.mxs) * Math.min(1, S.dt * 4);
    var lean = S.mxs * 0.9 * seg(fillT, 0.6, 1) * (1 - diveT);
    var sway = Math.sin(t * 0.9) * 0.18 * seg(fillT, 0.5, 1) + th * 2.5;
    var k = 1 + 0.45 * stepE;

    // where the collar sits on screen: rotate about the rod while hanging
    var dropY = -(1 - dropE) * (L.rodY + M.h * L.s + 60);
    var rx = (HOLE[0] - L.rodCrop[0]) * L.s, ry = (HOLE[1] - L.rodCrop[1]) * L.s;
    var c = Math.cos(th), sn = Math.sin(th);
    var hole0x = L.rodX + slideX * 0 + rx * c - ry * sn;
    var hole0y = L.rodY + rx * sn + ry * c - joint + dropY + S.dip + sag * 16;
    var hsx = lerp(hole0x, L.walkTo[0], walkE), hsy = lerp(hole0y, L.walkTo[1], walkE);

    // the dive: zoom about the collar, the lining floods out of it
    var z = Math.exp(Math.log(L.small ? 14 : 24) * Math.pow(diveT, 1.7));
    var flood = diveT > 0.01 ? 2 + 1500 * Math.pow(smooth(0.5, 1, diveT), 1.7) : 0;
    var full = p >= 0.8;

    if (coat && coat.pieces['01'] && !full) {
      setV(coatCv, 'visible');
      coat.clear();
      coat.draw({
        key: '01', anchor: HOLE, screen: [hsx, hsy], scale: L.s * k, rot: th, zoom: z, cam: [hsx, hsy],
        fill: fill, xf: xf, slump: slump, breath: breath, lean: lean, sway: sway,
        cut: (M.hookBase + 1) / M.h, flood: flood, soft: 3 + flood * 0.035, linMix: smooth(0.05, 0.6, diveT),
        alpha: S.intro === 'load' ? 0 : 1
      });
    } else if (coat && coatCv._v !== 'hidden') { coat.clear(); setV(coatCv, 'hidden'); }
    liningBg.classList.toggle('on', full);
    setT(liningBg, full ? 'scale(' + (1 + 0.09 * eout(inT)).toFixed(4) + ')' : '');

    // the word behind: thuds when the coat lands, parts as you step through it
    var part = stepE * (L.small ? 0.62 : 0.34) + Math.pow(diveT, 1.6) * 0.9;
    // wide: the word sits a little under the middle, and never under the definition (short screens)
    var gy = L.small ? -L.gh * 0.5 - H * 0.04 : Math.max(-L.gh * 0.42, L.defBot + 6 - H / 2);
    var gs = 1 + stepE * 0.06 + diveT * 0.5;
    setT(g1, 'translate(' + (-part * W).toFixed(1) + 'px,' + S.thud.toFixed(1) + 'px) scale(' + gs.toFixed(3) + ')');
    setT(g2, 'translate(' + (part * W).toFixed(1) + 'px,' + (S.thud * 0.6).toFixed(1) + 'px) scale(' + gs.toFixed(3) + ')');
    setT(giant, 'translateY(' + gy.toFixed(1) + 'px)');

    // words
    if (!introOn || S.intro === 'settle') {
      var uiIn = introOn ? seg(t - S.dropT - 0.5, 0, 1.2) : 1;
      wordsY(W1, uiIn, 110, 1);
      if (liftT > 0) wordsOut(W1, seg(liftT, 0.15, 0.85), 1);
      setV(l1, liftT >= 1 ? 'hidden' : 'visible');
      // l2 rises as the coat fills, steps aside when it walks
      var l2in = seg(fillT, 0.35, 1);
      setV(l2, l2in > 0 && walkT < 0.5 ? 'visible' : 'hidden');
      wordsY(W2, l2in, 110, 1);
      if (walkT > 0) wordsOut(W2, seg(walkT, 0, 0.45), 1);
      // l3 arrives during the walk and is passed by the camera in the dive
      var l3in = L.small ? seg(walkT, 0.42, 0.9) : seg(walkT, 0.3, 0.85);
      setV(l3, l3in > 0 && diveT < 0.6 ? 'visible' : 'hidden');
      wordsY(W3, l3in, 110, 1);
      var fly = eio(seg(diveT, 0, 0.6));
      var fdir = L.small ? -1 : 1;
      setT(l3, fly > 0 ? 'translate(' + (fly * W * 0.35).toFixed(1) + 'px,' + (fdir * fly * H * 0.25).toFixed(1) + 'px) scale(' + (1 + fly * 1.4).toFixed(3) + ')' : '');
      var sk = seg(fillT, 0.05, 0.45).toFixed(3), un = seg(fillT, 0.4, 0.9).toFixed(3);
      if (def._sk !== sk) { def._sk = sk; def.style.setProperty('--strike', sk); }
      if (def._un !== un) { def._un = un; def.style.setProperty('--under', un); }
      var dfly = L.small ? eio(seg(walkT, 0.1, 0.5)) : eio(seg(diveT, 0, 0.55)) + eio(seg(walkT, 0.6, 1)) * 0.15;
      setT(def, dfly > 0 ? 'translate(' + (-dfly * W * 0.3).toFixed(1) + 'px,' + (-dfly * H * 0.3).toFixed(1) + 'px) scale(' + (1 + dfly * 1.2).toFixed(3) + ')' : '');
      setV(def, (L.small ? walkT >= 0.5 : diveT >= 0.55) ? 'hidden' : '');
      setT(cue, 'translateY(' + (eio(seg(p, 0, 0.05)) * 90).toFixed(1) + 'px)');
    }

    // inside the coat
    inside.classList.toggle('on', full);
    if (full || inside._was) {
      wordsY(WIN, seg(inT, 0, 0.75), 110, 1);
      var e2 = eout(seg(inT, 0.25, 0.8)), e3 = eout(seg(inT, 0.4, 0.95)), e1 = eout(seg(inT, 0, 0.5));
      setT(inEye, 'translateY(' + ((1 - e1) * 40).toFixed(1) + 'px)');
      setT(inP, 'translateY(' + ((1 - e2) * 60).toFixed(1) + 'px)');
      setT(inBtn, 'translateY(' + ((1 - e3) * 80).toFixed(1) + 'px)');
      inEye.style.opacity = e1; inP.style.opacity = e2; inBtn.style.opacity = e3;
      inside._was = full;
    }
  }

  /* reduced motion: the finished coat, nothing moves with the scroll */
  var rmKey = '';
  function renderRM() {
    if (!coat || !coat.pieces['01'] || !L.W) return;
    // a still frame: draw it once per layout, not every frame
    var key = L.W + 'x' + L.H + ':' + L.s;
    if (key === rmKey) return;
    rmKey = key;
    coat.clear();
    var hsx = L.W / 2 + (HOLE[0] - M.w / 2) * L.s, hsy = L.top + HOLE[1] * L.s + 30;
    coat.draw({ key: '01', anchor: HOLE, screen: [hsx, hsy], scale: L.s, fill: 1, xf: 1, cut: (M.hookBase + 1) / M.h });
    hanger.style.visibility = 'hidden';
    rod.style.transform = 'translateY(' + (L.rodY - 3) + 'px)';
    def.style.setProperty('--strike', 1); def.style.setProperty('--under', 1);
    giant.style.transform = 'translateY(' + Math.max(-L.gh * 0.42, L.defBot + 6 - L.H / 2) + 'px)';
    [W1, WIN].forEach(function (ws) { ws.forEach(function (w) { w.style.transform = 'none'; }); });
    l2.style.visibility = l3.style.visibility = 'hidden';
  }

  /* ---------------- nav colour over the lining ---------------- */
  function navTheme(yy) {
    var y = yy == null ? scrollY() : yy, storyEnd = L.storyTop + L.storyH - VH;
    var blue;
    if (RM) { var ir = inside.getBoundingClientRect(); blue = ir.top < 40 && ir.bottom > 40; }
    else blue = S.p > 0.79 && y < storyEnd + VH - 40;
    var fr = doc.classList.contains('fr-open');
    nav.classList.toggle('on-blue', blue && !fr && !doc.classList.contains('menu-open'));
  }

  /* ---------------- scroll ---------------- */
  // the rAF loop draws the story every frame; the scroll handler draws only when that loop is
  // not running (the in-app preview freezes rAF), so a phone no longer draws the coat twice a frame
  var lastTickWall = 0;
  function onScroll() {
    var y = scrollY();
    S.p = RM ? 1 : clamp((y - L.storyTop) / L.storyLen, 0, 1);
    if (!RM && y < L.storyEnd && performance.now() - lastTickWall > 120) render();
    navTheme(y);
    atelierScroll(y);
    var v = y - prevScroll; prevScroll = y;
    lastScrollV = v;
    if (S.p < 0.05) S.om += clamp(v, -40, 40) * 0.0016;
    footKick(v);
    navAway(y, v);
    if (S.p > 0.05 || y > L.storyEnd) startRail();
  }
  /* past the story the nav steps out of the way while you read down and comes back as soon as
     you scroll up, so its words never sit on top of the page's own words */
  var navIsAway = false;
  function navAway(y, v) {
    var past = y > L.storyTop + L.storyH - L.H * 0.5;
    var want = navIsAway;
    if (!past || v < -3) want = false; else if (v > 3) want = true;
    if (/(^|\s)(menu-open|bag-open|fr-open)(\s|$)/.test(doc.className)) want = false;
    if (want !== navIsAway) { navIsAway = want; doc.classList.toggle('nav-away', want); }
  }
  function navBack() { if (navIsAway) { navIsAway = false; doc.classList.remove('nav-away'); } }
  nav.addEventListener('focusin', navBack);
  if (lenis) lenis.on('scroll', onScroll);
  listen(window, 'scroll', function () { if (!lenis) onScroll(); }, { passive: true });

  /* ---------------- the clock ---------------- */
  var lastT = 0;
  function tick(now) {
    lastTickWall = performance.now();
    var y0 = lenis ? 0 : window.scrollY; // read before any write this frame: no forced layout
    var t = now / 1000;
    S.dt = lastT ? Math.min(0.05, t - lastT) : 0.016; lastT = t; S.t = t;
    if (lenis) lenis.raf(now);
    var dt = S.dt;
    if (!S.introT0) S.introT0 = t;
    intro(t, dt);
    // pendulum of the hanging coat: a cursor brushing through the cloth pushes the hem its way
    var Lp = M.h * L.s * 0.48 || 300, push = 0;
    if (S.p < 0.06 && S.intro === 'done' && L.s && Math.abs(S.pvx) > 20) {
      var bd = Math.abs(S.px - L.rodX), by = S.py - L.rodY, blen = M.h * L.s * 0.9;
      if (bd < M.w * L.s * 0.45 && by > 0 && by < blen) push = -clamp(S.pvx, -1400, 1400) * 0.0021 * (0.35 + 0.65 * by / blen);
    }
    S.pvx *= Math.exp(-dt * 9);
    swing(S, dt, Math.sqrt(2600 / Lp), 0.2, push);
    S.dipV += (-S.dip * 170 - S.dipV * 11) * dt; S.dip += S.dipV * dt;
    S.thudV += (-S.thud * 260 - S.thudV * 13) * dt; S.thud += S.thudV * dt;
    S.fillPulseV += (-S.fillPulse * 140 - S.fillPulseV * 9) * dt; S.fillPulse += S.fillPulseV * dt;
    var idle = S.intro === 'done' && S.t - S.lastInput > 7;
    var target = idle ? 0 : 1;
    S.attV += ((target - S.att) * (idle ? 1.2 : 34) - S.attV * (idle ? 2.4 : 7)) * dt; S.att += S.attV * dt;
    var y = lenis ? lenis.scroll : y0;
    if (RM) renderRM();
    else if (y < L.storyEnd) render();
    railTick(dt, t, y);
    frTick(dt, t);
    footTick(dt, t, y);
    raf = requestAnimationFrame(tick);
  }

  function intro(t, dt) {
    if (S.intro === 'done') return;
    var since = t - S.introT0;
    S.slideIn = seg(since, 0.25, 1.5);
    if (S.slideIn >= 1 && !S._arrived) { S._arrived = true; S.om -= 0.45; } // slid in from the left and stopped: the hem runs on
    if (S.intro === 'load') {
      var target = ready ? 100 : Math.min(92, (loads.n / loads.total) * 100);
      var maxStep = dt * 100 / 1.15;
      S.dispRead += clamp((target - S.dispRead) * Math.min(1, dt * 5), 0, maxStep);
      var r = Math.min(100, S.dispRead);
      tapeRead.textContent = ('00' + Math.round(r)).slice(-3);
      if (L.tapeOff == null) L.tapeOff = tapeMark.offsetLeft - tapeBand.offsetLeft;
      tapeStrip.style.transform = 'translateX(' + (L.tapeOff - r * 12).toFixed(1) + 'px)';
      if (ready && r > 99.5 && since > 1.6) {
        S.intro = 'drop'; S.dropT = t;
        $('#loadStatus').textContent = 'Loaded';
      }
    } else if (S.intro === 'drop') {
      if (t - S.dropT >= 0.62 && !S._landed) {
        S._landed = true;
        S.dipV += 300; S.om += (Math.random() > 0.5 ? 1 : -1) * 0.3; S.thudV += 120;
        tape.classList.add('is-off');
        doc.classList.remove('is-loading');
        doc.classList.add('pre-ui');
        S.intro = 'settle';
        setTimeout(function () { doc.classList.remove('pre-ui'); }, 60);
      }
    } else if (S.intro === 'settle') {
      if (t - S.dropT > 2.2) {
        S.intro = 'done'; tape.classList.add('is-gone'); S.lastInput = t;
        if (lenis) lenis.start();
        doc.classList.remove('intro-lock');
      }
    }
  }
  function skipIntro() {
    if (S.intro === 'done') return;
    ready = true; S.dispRead = 100; S.slideIn = 1; S._arrived = true;
    S.intro = 'settle'; S._landed = true; S.dropT = S.t - 2.5;
    tape.classList.add('is-off', 'is-gone');
    doc.classList.remove('is-loading', 'pre-ui', 'intro-lock');
    S.intro = 'done'; if (lenis) lenis.start();
  }

  /* ---------------- the rail ---------------- */
  var rail = null, railBox = $('#rail'), railVis = false;
  // visibility from an observer, not a getBoundingClientRect every frame (that forced a style
  // pass right after the story wrote its transforms)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { railVis = es[es.length - 1].isIntersecting; }, { rootMargin: '40px 0px' }).observe(railBox);
  } else railVis = true;
  function railTick(dt, t, y) {
    if (!rail) return;
    if (!railVis && !doc.classList.contains('fr-open')) return;
    rail.step(dt, t, y, VH);
    rail.draw();
  }
  // the rail's six photographs are fetched once the visitor starts down the story (or jumps to
  // the rail), so a first screen never pays for them; they are decoded off the main thread
  var railStarted = false, railReadyRes, railReady = new Promise(function (r) { railReadyRes = r; });
  function startRail() {
    if (railStarted) return;
    railStarted = true;
    heroP.then(function () {
      return Promise.all(PIECES.map(function (p) { return loadTex(PIECE_DIR + 'p' + p.key + '-flat.webp' + FLAT_V); }));
    }).then(function (list) {
      list.forEach(function (im, i) { imgs.flat[i] = im; });
      rail = new PersonneRail({
        canvas: $('#railcv'), box: railBox, tags: $('#railTags'), pieces: PIECES, imgs: list, fmt: fmt,
        onPick: function (i, pose) { openFit(i, pose); },
        onCount: function (i) { $('#railCount').textContent = '0' + (i + 1) + ' / 06'; }
      });
      rail.layout();
      $$('.tag', railBox).forEach(function (b) {
        b.addEventListener('pointerenter', function () { prefetchGhost(+b.dataset.i); });
      });
      $('#railcv').addEventListener('pointermove', function () { if (rail.hover >= 0) prefetchGhost(rail.hover); });
      railReadyRes(rail);
      // the fitting room's WebGL context, made while nobody is waiting for it
      (window.requestIdleCallback || function (f) { return setTimeout(f, 200); })(function () { getFrCoat(); }, { timeout: 2000 });
    });
  }
  $('#railPrev').addEventListener('click', function () { rail && rail.nudge(-1); });
  $('#railNext').addEventListener('click', function () { rail && rail.nudge(1); });

  /* ---------------- fitting room ---------------- */
  var fr = { i: -1, phase: 'idle', t0: 0, from: null, to: null, size: null, fill: 0, swap: 0 };
  var frEl = $('#fitroom'), frBg = $('#frBg'), frCv = $('#frgl');
  var ghostP = {};
  function prefetchGhost(i) {
    var key = PIECES[i].key;
    if (!ghostP[key]) ghostP[key] = (i === 0 && imgs.ghost[0] ? Promise.resolve(imgs.ghost[0]) : loadTex(PIECE_DIR + 'p' + key + '-ghost.webp')).then(function (im) { imgs.ghost[i] = im; return im; });
    return ghostP[key];
  }
  function ensurePiece(i) {
    if (!getFrCoat()) return;
    var key = PIECES[i].key;
    if (!frCoat.pieces[key] && imgs.flat[i]) frCoat.addPiece(key, imgs.flat[i], imgs.ghost[i] || null);
    prefetchGhost(i).then(function (im) { if (im) frCoat.setGhost(key, im); });
  }
  function frTarget(i) {
    var m = A.pieces[PIECES[i].key], W = window.innerWidth, H = window.innerHeight, small = isSmall();
    var bh = m.flatBox[3] - m.hookBase, bw = m.flatBox[2] - m.flatBox[0];
    var avail = small ? H - $('#frPanel').offsetHeight - 24 : H;
    var sc = small ? Math.min((avail - 70) / bh, W * 0.7 / bw) : Math.min(H * 0.8 / bh, W * 0.44 / bw);
    var cx = small ? W / 2 : W * 0.33, cy = small ? 30 + (avail - 30) / 2 : H * 0.53;
    var gcx = (m.flatBox[0] + m.flatBox[2]) / 2, gcy = (m.hookBase + m.flatBox[3]) / 2;
    return { x: cx + (m.tip[0] - gcx) * sc, y: cy + (m.tip[1] - gcy) * sc, rot: 0, scale: sc };
  }
  function fillPanel(i) {
    var p = PIECES[i];
    $('#frNo').textContent = 'No. ' + p.key;
    $('#frName').textContent = p.name;
    $('#frCloth').textContent = p.cloth;
    $('#frPrice').textContent = fmt(p.price);
    $('#frDesc').textContent = p.desc;
    $('#frIdx').textContent = '0' + (i + 1) + ' / 06';
    $('#frSpec').innerHTML = p.spec.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('');
    $('#frSizes').innerHTML = SIZES.map(function (s) { return '<button type="button" class="size" aria-pressed="false" data-s="' + s + '">' + s + '</button>'; }).join('');
    $('#frMsg').textContent = '';
    fr.size = null;
    // the still stands in only without WebGL: only then is it worth a download (full size, it is 80svh tall)
    var st = $('#frStill'); st.alt = p.name + ', ' + p.cloth;
    if (!getFrCoat()) st.src = asset('img/p' + p.key + '-ghost.webp');
  }
  $('#frSizes').addEventListener('click', function (e) {
    var b = e.target.closest('.size'); if (!b) return;
    $$('.size', this).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    fr.size = +b.dataset.s; $('#frMsg').textContent = '';
  });
  var frReturnFocus = null;
  function openFit(i, pose) {
    if (fr.phase !== 'idle') return;
    frReturnFocus = document.activeElement;
    ensurePiece(i);
    fillPanel(i);
    fr.i = i; fr.phase = 'in'; fr.t0 = S.t; fr.from = pose; fr.to = frTarget(i);
    rail && rail.setHidden(i, true);
    if (frCoat) frCoat.resize(window.innerWidth, window.innerHeight);
    frEl.removeAttribute('inert'); frEl.classList.add('open');
    doc.classList.add('fr-open', 'lock');
    if (lenis) lenis.stop();
    navTheme();
    setTimeout(function () { frEl.classList.add('shown'); $('#frClose').focus({ preventScroll: true }); }, 380);
  }
  function closeFit() {
    if (fr.phase !== 'shown' && fr.phase !== 'in') return;
    fr.phase = 'out'; fr.t0 = S.t; fr.fillFrom = fr.fill;
    frEl.classList.remove('shown');
  }
  function swapFit(dir) {
    if (fr.phase !== 'shown') return;
    fr.phase = 'swap'; fr.t0 = S.t; fr.dir = dir; fr.fillFrom = fr.fill;
    frEl.classList.remove('shown');
  }
  $('#frClose').addEventListener('click', closeFit);
  $('#frPrev').addEventListener('click', function () { swapFit(-1); });
  $('#frNext').addEventListener('click', function () { swapFit(1); });
  $('#frAdd').addEventListener('click', function () {
    if (!fr.size) {
      var row = $('#frSizes'); row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
      $('#frMsg').textContent = 'Pick a size first.';
      return;
    }
    addToBag(PIECES[fr.i].key, fr.size);
    $('#frMsg').textContent = 'On your hanger. Size ' + fr.size + '.';
    S.fillPulseV += 1.4; fr.pulse = 1;
  });

  function frTick(dt, t) {
    if (fr.phase === 'idle') return;
    var W = VW, H = VH, tt = t - fr.t0;
    var i = fr.i, key = PIECES[i].key, m = A.pieces[key];
    var pos, fill = fr.fill, hookLift = 0, bgR = 0, alpha = 1;
    var maxR = Math.hypot(W, H);
    var from = fr.from, to = fr.to;
    if (fr.phase === 'in') {
      var e = expo(seg(tt, 0, 0.95));
      pos = { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) - Math.sin(e * Math.PI) * 50, rot: lerp(from.rot, 0, e) + Math.sin(e * Math.PI) * 0.05, scale: lerp(from.scale, to.scale, e) };
      bgR = eout(seg(tt, 0.05, 0.9)) * maxR;
      var hasG = frCoat && frCoat.hasGhost(key);
      if (hasG && !fr.fillStart) fr.fillStart = Math.max(t, fr.t0 + 0.55);
      var ft = fr.fillStart ? seg(t - fr.fillStart, 0, 1.25) : 0;
      fill = ft <= 0 ? 0 : (ft >= 1 ? 1 : backOut(ft, 2.3));
      hookLift = eio(seg(ft, 0, 0.6));
      if (ft >= 1 && tt > 1) { fr.phase = 'shown'; fr.fillStart = 0; }
    } else if (fr.phase === 'shown') {
      pos = to; fill = 1; hookLift = 1; bgR = maxR;
    } else if (fr.phase === 'out') {
      var back = rail ? rail.screenPose(i) : from;
      var d = eio(seg(tt, 0, 0.5));
      fill = fr.fillFrom * (1 - d); hookLift = 1 - d;
      var e2 = eio(seg(tt, 0.35, 1.15));
      pos = { x: lerp(to.x, back.x, e2), y: lerp(to.y, back.y, e2) - Math.sin(e2 * Math.PI) * 40, rot: lerp(0, back.rot, e2), scale: lerp(to.scale, back.scale, e2) };
      bgR = (1 - eout(seg(tt, 0.3, 1.1))) * maxR;
      if (tt >= 1.15) {
        fr.phase = 'idle'; fr.fill = 0;
        rail && rail.setHidden(i, false);
        frEl.classList.remove('open'); frEl.setAttribute('inert', '');
        doc.classList.remove('fr-open', 'lock');
        navBack();
        if (lenis) lenis.start();
        if (frCoat) frCoat.clear();
        frBg.style.clipPath = '';
        navTheme();
        if (frReturnFocus && frReturnFocus.focus) frReturnFocus.focus({ preventScroll: true });
        return;
      }
    } else if (fr.phase === 'swap') {
      var dd = eio(seg(tt, 0, 0.35));
      fill = fr.fillFrom * (1 - dd); hookLift = 1 - dd; bgR = maxR;
      var ex = eio(seg(tt, 0.25, 0.65));
      pos = { x: to.x - fr.dir * ex * W * 0.7, y: to.y - Math.sin(ex * Math.PI) * 30, rot: -fr.dir * ex * 0.2, scale: to.scale };
      if (tt >= 0.65) {
        rail && rail.setHidden(i, false);
        var ni = (i + fr.dir + PIECES.length) % PIECES.length;
        ensurePiece(ni); fillPanel(ni);
        rail && rail.setHidden(ni, true);
        fr.i = ni; fr.to = frTarget(ni);
        fr.from = { x: fr.to.x + fr.dir * W * 0.7, y: fr.to.y, rot: fr.dir * 0.2, scale: fr.to.scale };
        fr.phase = 'in'; fr.t0 = t - 0.25; fr.fillStart = 0;
        setTimeout(function () { frEl.classList.add('shown'); }, 300);
        return;
      }
    }
    fr.fill = fill;
    frBg.style.clipPath = 'circle(' + bgR.toFixed(1) + 'px at ' + (pos ? pos.x : W / 2).toFixed(1) + 'px ' + (pos ? pos.y + 200 : H / 2).toFixed(1) + 'px)';
    if (!frCoat || !frCoat.pieces[key]) return;
    var shown = fill > 0.9, cut = (m.hookBase + 1) / m.h;
    frCoat.clear();
    frCoat.draw({
      key: key, anchor: m.tip, screen: [pos.x, pos.y], scale: pos.scale, rot: pos.rot, cut: cut,
      fill: fill + (fr.phase === 'shown' ? S.fillPulse : 0), xf: smooth(0.1, 0.7, Math.min(1, fill)),
      breath: shown ? Math.sin(t * 1.7) : 0, lean: shown ? S.mxs * 0.6 : 0, sway: shown ? Math.sin(t * 0.9) * 0.2 : 0
    });
    if (hookLift < 1) {
      var up = eio(hookLift);
      frCoat.draw({
        key: key, anchor: m.tip, screen: [pos.x + up * 26, pos.y - up * (pos.y + 140)], scale: pos.scale, rot: pos.rot + up * 0.5,
        fill: 0, xf: 0, cut: cut, cutInv: true, alpha: 1 - seg(hookLift, 0.75, 1)
      });
    }
  }
  listen(window, 'keydown', function (e) {
    if (e.key === 'Escape') {
      if (fr.phase === 'shown' || fr.phase === 'in') closeFit();
      else if (doc.classList.contains('bag-open')) closeBag();
      else if (doc.classList.contains('menu-open')) closeMenu();
    }
    if (fr.phase === 'shown' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/INPUT|SELECT/.test(document.activeElement.tagName)) swapFit(e.key === 'ArrowRight' ? 1 : -1);
  });

  /* ---------------- bag ---------------- */
  var bag = [];
  var bagEl = $('#bag');
  function saveBag() { /* the six pieces are mesh art, not cart rows */ }
  function bagCount() { return bag.reduce(function (a, b) { return a + b.qty; }, 0); }
  function setCount(n, animate) {
    var box = $('#bagCount'), old = box.querySelector('span:not(.out)');
    if (old && old.textContent === String(n)) return;
    if (!animate || !old) { box.innerHTML = '<span>' + n + '</span>'; return; }
    var nu = document.createElement('span'); nu.className = 'in-start'; nu.textContent = n;
    box.appendChild(nu);
    old.classList.add('out');
    requestAnimationFrame(function () { requestAnimationFrame(function () { nu.classList.remove('in-start'); }); });
    setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 600);
    var b = $('#bagBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }
  function renderBag(animate) {
    var list = $('#bagList');
    list.innerHTML = bag.map(function (it, idx) {
      var p = PIECES.filter(function (x) { return x.key === it.key; })[0];
      return '<li class="bag-item"><div class="bag-thumb" style="background-image:url(' + asset(PIECE_DIR + 'p' + p.key + '-flat.webp') + ')"></div>' +
        '<div><p class="bag-name">' + p.name + '</p><p class="bag-meta">' + p.cloth + '<br>Size ' + it.size + '</p>' +
        '<div class="bag-qty"><button type="button" data-a="dec" data-i="' + idx + '" aria-label="One fewer">−</button><span>' + it.qty + '</span><button type="button" data-a="inc" data-i="' + idx + '" aria-label="One more">+</button></div></div>' +
        '<div><p class="bag-price">' + fmt(p.price * it.qty) + '</p><button type="button" class="bag-rm" data-a="rm" data-i="' + idx + '">Remove</button></div></li>';
    }).join('');
    var total = bag.reduce(function (a, it) { var p = PIECES.filter(function (x) { return x.key === it.key; })[0]; return a + p.price * it.qty; }, 0);
    $('#bagTotal').textContent = fmt(total);
    bagEl.classList.toggle('is-empty', !bag.length);
    setCount(bagCount(), animate);
  }
  function addToBag(key, size) {
    var f = bag.filter(function (x) { return x.key === key && x.size === size; })[0];
    if (f) f.qty++; else bag.push({ key: key, size: size, qty: 1 });
    saveBag(); renderBag(true);
    navBack();
  }
  $('#bagList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var i = +b.dataset.i, a = b.dataset.a;
    if (a === 'inc') bag[i].qty++;
    else if (a === 'dec') { bag[i].qty--; if (bag[i].qty < 1) bag.splice(i, 1); }
    else if (a === 'rm') bag.splice(i, 1);
    saveBag(); renderBag(true);
  });
  var bagReturn = null;
  function openBag() {
    bagReturn = document.activeElement;
    bagEl.removeAttribute('inert'); bagEl.classList.add('open'); doc.classList.add('bag-open', 'lock');
    $('#bagBtn').setAttribute('aria-expanded', 'true');
    if (lenis) lenis.stop();
    setTimeout(function () { $('#bagClose').focus({ preventScroll: true }); }, 50);
  }
  function closeBag() {
    bagEl.classList.remove('open'); bagEl.setAttribute('inert', ''); doc.classList.remove('bag-open', 'lock');
    $('#bagBtn').setAttribute('aria-expanded', 'false');
    if (lenis && fr.phase === 'idle') lenis.start();
    if (bagReturn && bagReturn.focus) bagReturn.focus({ preventScroll: true });
  }
  $('#bagBtn').addEventListener('click', function () { if (doc.classList.contains('menu-open')) closeMenu(); if (fr.phase !== 'idle') { closeFit(); } openBag(); });
  $('#bagClose').addEventListener('click', closeBag);
  $('#bagScrim').addEventListener('click', closeBag);
  $('#bagToRail').addEventListener('click', function (e) { e.preventDefault(); closeBag(); setTimeout(function () { scrollTo($('#collection')); }, 120); });
  $('#bagBook').addEventListener('click', function () {
    closeBag();
    if (bag.length) $('#fPiece').value = bag[0].key;
    setTimeout(function () { scrollTo($('#fitting')); }, 120);
  });
  renderBag(false);

  /* ---------------- menu ---------------- */
  function openMenu() {
    doc.classList.add('menu-open'); $('#menu').removeAttribute('inert');
    $('#burger').setAttribute('aria-expanded', 'true'); $('#burger').setAttribute('aria-label', 'Close the menu');
    navTheme();
  }
  function closeMenu() {
    doc.classList.remove('menu-open'); $('#menu').setAttribute('inert', '');
    $('#burger').setAttribute('aria-expanded', 'false'); $('#burger').setAttribute('aria-label', 'Open the menu');
    navTheme();
  }
  $('#burger').addEventListener('click', function () { doc.classList.contains('menu-open') ? closeMenu() : openMenu(); });

  /* ---------------- anchors ---------------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href'); if (id.length < 2) return;
      var el = $(id); if (!el) return;
      e.preventDefault();
      if (doc.classList.contains('menu-open')) closeMenu();
      if (S.intro !== 'done') skipIntro();
      if (id !== '#top') startRail();
      if (id === '#top') scrollTo(0); else scrollTo(el);
    });
  });

  /* ---------------- atelier: the stitch sews itself, figures drift ---------------- */
  var at = $('#atelier'), stitchSvg = $('#stitch'), stitchPath = $('#stitchPath'), stitchReveal = $('#stitchReveal'), needle = $('#needle');
  var atFigs = $$('.at-fig', at), stitchLen = 0;
  function buildStitch() {
    at.style.contentVisibility = 'visible'; // measured laid out, never as a skipped section
    var saved = atFigs.map(function (f) { var t = f.style.transform; f.style.transform = 'none'; return t; });
    var r0 = at.getBoundingClientRect(), W = at.clientWidth, H = at.clientHeight;
    stitchSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    function rel(el) { var r = el.getBoundingClientRect(); return { l: r.left - r0.left, t: r.top - r0.top, r: r.right - r0.left, b: r.bottom - r0.top, w: r.width, h: r.height }; }
    var head = rel($('.at-head', at)), tab = rel($('.at-table .at-img', at)), cnv = rel($('.at-canvas .at-img', at)), hol = rel($('.at-hole .at-img', at)), fac = rel($('.facts', at));
    // the thread only crosses gaps, or runs behind the photographs (sewn through them)
    var pts = W < 860 ? [
      [-24, head.b + 26], [W * 0.5, tab.t + tab.h * 0.45], [W + 30, tab.t + tab.h * 0.85], [W + 30, cnv.t + cnv.h * 0.15],
      [W * 0.45, cnv.t + cnv.h * 0.6], [-30, cnv.t + cnv.h * 0.95], [-30, hol.t + hol.h * 0.2], [hol.l + hol.w * 0.55, hol.t + hol.h * 0.6],
      [W + 30, hol.b - hol.h * 0.1], [W + 30, fac.t - 70], [W * 0.5, fac.t - 22], [-30, fac.t - 40]
    ] : [
      [-24, head.b + 40], [tab.l - 120, tab.t + tab.h * 0.12], [tab.l + tab.w * 0.3, tab.t + tab.h * 0.55], [tab.r + 60, tab.b - tab.h * 0.2],
      [W - 20, cnv.t - 30], [hol.l + hol.w * 0.4, hol.t + hol.h * 0.3], [(cnv.r + hol.l) / 2, cnv.b - cnv.h * 0.3],
      [cnv.l + cnv.w * 0.5, cnv.t + cnv.h * 0.45], [-30, cnv.b - 20], [-30, fac.t - 90], [W * 0.5, fac.t - 34], [W + 24, fac.t - 70]
    ];
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ' C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    stitchPath.setAttribute('d', d); stitchReveal.setAttribute('d', d);
    stitchLen = stitchPath.getTotalLength();
    atFigs.forEach(function (f, i) { f.style.transform = saved[i]; });
    stitchReveal.style.strokeDasharray = stitchLen + ' ' + stitchLen;
    at._top = r0.top + scrollY(); at._h = H; at._pr = -1; stitchDirty = !(stitchLen > 0 && H > 100);
    at.style.contentVisibility = '';
  }
  // the figures drift only while the atelier is within a screen of the viewport
  var atNear = true, stitchDirty = true;
  // the stitch is measured when the atelier comes within a screen (its section skips rendering
  // until then), and again after fonts, load or a resize if it is near at that moment
  function wantStitch() { stitchDirty = true; if (atNear) buildStitch(); }
  if ('IntersectionObserver' in window) {
    atNear = false;
    new IntersectionObserver(function (es) {
      atNear = es[es.length - 1].isIntersecting;
      if (atNear && stitchDirty) buildStitch();
      if (atNear) atelierScroll(scrollY());
    }, { rootMargin: '100% 0px' }).observe(at);
  }
  function atelierScroll(y) {
    if (!stitchLen) return;
    var vh = VH;
    // read every figure's rectangle before anything is written: one style pass, not one per figure
    var drift = !RM && atNear, rs = drift ? atFigs.map(function (f) { return f.getBoundingClientRect(); }) : null;
    if (drift) at._top = at.getBoundingClientRect().top + y; // sections above may have just been laid out
    var pr = RM ? 1 : seg(y + vh * 0.75, at._top, at._top + at._h * 0.95);
    if (pr !== at._pr) {
      at._pr = pr;
      stitchReveal.style.strokeDashoffset = (stitchLen * (1 - pr)).toFixed(1);
      if (pr > 0 && pr < 1) {
        var pt = stitchPath.getPointAtLength(stitchLen * pr), pt2 = stitchPath.getPointAtLength(Math.min(stitchLen, stitchLen * pr + 2));
        var ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
        needle.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ') rotate(' + ang.toFixed(1) + ')');
        needle.style.visibility = 'visible';
      } else needle.style.visibility = 'hidden';
    }
    if (!drift) return;
    atFigs.forEach(function (f, i) {
      var r = rs[i], c = clamp((r.top + r.height / 2 - vh / 2) / vh, -1.2, 1.2);
      setT(f, 'translateY(' + (c * parseFloat(f.dataset.par) * vh * -1).toFixed(1) + 'px)');
    });
  }

  /* ---------------- titles and figures arrive when seen ---------------- */
  var seen = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; seen.unobserve(el);
      if (el.classList.contains('at-fig')) { el.classList.add('in'); return; }
      var ws = splitWords(el);
      ws.forEach(function (w, i) {
        w.style.transition = 'transform 1.1s cubic-bezier(.16,1,.3,1) ' + (i * 0.07) + 's';
        w.style.transform = 'none';
      });
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  $$('.sec-title[data-words]').forEach(function (el) {
    var ws = splitWords(el);
    if (!RM) ws.forEach(function (w) { w.style.transform = 'translateY(110%)'; });
    seen.observe(el);
  });
  atFigs.forEach(function (f) { seen.observe(f); });

  /* ---------------- fittings form ---------------- */
  var form = $('#form');
  $('#fPiece').innerHTML = '<option value="">Not sure yet</option>' + PIECES.map(function (p) { return '<option value="' + p.key + '">No. ' + p.key + ', ' + p.name + '</option>'; }).join('');
  (function weeks() {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    var add = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + add);
    var M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var out = '';
    for (var i = 0; i < 6; i++) {
      var w = new Date(d); w.setDate(d.getDate() + i * 7);
      var label = 'Week of Monday ' + w.getDate() + ' ' + M[w.getMonth()];
      out += '<option value="' + w.toISOString().slice(0, 10) + '">' + label + '</option>';
    }
    $('#fWeek').innerHTML = out;
  })();
  function fieldErr(id, msg) {
    var f = $('#' + id).closest('.field'); f.classList.toggle('bad', !!msg);
    $('#' + id + 'Err').textContent = msg || '';
    $('#' + id).setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#fName').value.trim(), email = $('#fEmail').value.trim();
    var ok = true;
    if (!name) { fieldErr('fName', 'Tell us who the coat is for.'); ok = false; } else fieldErr('fName');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { fieldErr('fEmail', 'That email does not look right.'); ok = false; } else fieldErr('fEmail');
    if (!ok) { (name ? $('#fEmail') : $('#fName')).focus(); return; }
    if ($('#fWeb').value) return;
    var pk = $('#fPiece').value, piece = PIECES.filter(function (p) { return p.key === pk; })[0];
    var place = form.querySelector('input[name=place]:checked').value === 'video' ? 'on a video call' : 'at the atelier in Paris';
    var wk = $('#fWeek').selectedOptions[0].textContent.replace('Week of ', 'the week of ');
    var no = 400 + Math.floor(Math.random() * 600);
    $('#doneNo').textContent = 'Fitting request No. 0' + no;
    $('#doneH').textContent = 'A hanger is waiting for you, ' + name.split(' ')[0] + '.';
    $('#doneP').textContent = (piece ? 'The ' + piece.name.toLowerCase() + ', ' : 'Your first piece, ') + place + ', ' + wk + '. A tailor will write to you to confirm the hour.';
    form.reset();
    form.hidden = true; $('#done').hidden = false; $('#done').focus({ preventScroll: true });
  });
  $('#doneAgain').addEventListener('click', function () { $('#done').hidden = true; form.hidden = false; $('#fName').focus(); });

  /* ---------------- footer hanger ---------------- */
  var foot = { th: 0, om: 0 }, footH = $('#footHanger'), footVis = true;
  if ('IntersectionObserver' in window) {
    footVis = false;
    new IntersectionObserver(function (es) { footVis = es[es.length - 1].isIntersecting; }).observe($('.foot-rod'));
  }
  function footKick(v) { if (footVis) foot.om += clamp(v, -60, 60) * 0.0005; }
  // where the hanger hangs, in page coordinates, read when the cursor comes into the footer
  var footR = null;
  $('.foot-top').addEventListener('pointerenter', function () { var r = $('#footRod').getBoundingClientRect(), y = scrollY(); footR = { l: r.left - 30, r: r.right + 30, t: r.top + y - 10, b: r.bottom + y + 30 }; });
  function footTick(dt, t, y) {
    if (!footVis) return;
    var push = Math.sin(t * 0.8) * 0.02;
    if (footR && Math.abs(S.pvx) > 20 && S.px > footR.l && S.px < footR.r && S.py + y > footR.t && S.py + y < footR.b) push -= clamp(S.pvx, -1400, 1400) * 0.0017;
    swing(foot, dt, 4.03, 0.2, push);
    var v = foot.th.toFixed(4);
    if (v !== foot._v) { foot._v = v; footH.style.transform = 'translateX(-50%) rotate(' + v + 'rad)'; }
  }

  /* ---------------- boot ---------------- */
  var footDirty = true, footNear = true;
  if ('IntersectionObserver' in window) {
    footNear = false;
    new IntersectionObserver(function (es) { footNear = es[es.length - 1].isIntersecting; if (footNear && footDirty) fitFoot(); }, { rootMargin: '100% 0px' }).observe($('.foot'));
  }
  function wantFoot() { footDirty = true; if (footNear) fitFoot(); }
  function fitFoot() {
    footDirty = false;
    var fm = $('.foot-mark'); if (!fm) return;
    // measured with the footer laid out: a skipped (content-visibility) footer reads 0 wide, and a
    // 0 once set the wordmark 8000 px tall inside Instagram
    var ft = $('.foot'); ft.style.contentVisibility = 'visible';
    fm.style.fontSize = '100px';
    var rg = document.createRange(); rg.selectNodeContents(fm);
    var w = rg.getBoundingClientRect().width, avail = fm.clientWidth;
    ft.style.contentVisibility = '';
    if (!(w > 20) || !(avail > 20)) { footDirty = true; fm.style.fontSize = ''; return; }
    fm.style.fontSize = (avail / w * 100 * 0.995).toFixed(2) + 'px';
  }
  function onResize() {
    layout();
    wantFoot();
    if (rail) rail.layout();
    wantStitch();
    if (fr.phase !== 'idle') { if (frCoat) frCoat.resize(window.innerWidth, window.innerHeight); fr.to = frTarget(fr.i); }
    onScroll();
  }
  var rzT = 0, lastW = window.innerWidth;
  listen(window, 'resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () {
      // phones resize on toolbar slides; only width changes re-lay the story
      if (touch && window.innerWidth === lastW) {
        var vh0 = window.__gwvh && window.__gwvh.on ? window.__gwvh.svh * 100 : stage.clientHeight;
        L.storyLen = Math.max(1, story.offsetHeight - vh0);
        L.H = stage.clientHeight; if (coat) coat.resize(L.W, L.H);
        return;
      }
      lastW = window.innerWidth; onResize();
    }, 120);
  });

  if (RM) {
    var st = $('#top');
    st.parentNode.insertBefore(inside, st.nextSibling);
    inside.classList.add('on');
    doc.classList.remove('is-loading');
    tape.classList.add('is-gone');
  } else {
    doc.classList.add('intro-lock');
    if (lenis) lenis.stop();
    window.scrollTo(0, 0);
  }
  // safety net: if the clock never ticks (background tab, frozen preview) the loader still lets go
  setTimeout(function () { if (S.intro !== 'done' && !document.hidden) { skipIntro(); onScroll(); } }, 9000);
  listen(document, 'visibilitychange', function () { if (!document.hidden && S.intro !== 'done') setTimeout(function () { if (S.intro === 'load' && ready && S.t - S.introT0 > 12) skipIntro(); }, 4000); });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  layout();
  // the stitch is measured once the fonts have settled (and again on load); measuring it here too
  // only added a forced layout to the boot task
  document.fonts && document.fonts.ready.then(function () { layout(); wantFoot(); wantStitch(); });
  listen(window, 'load', function () { wantStitch(); if (rail) rail.layout(); });
  onScroll();
  raf = requestAnimationFrame(tick);
  return function () {
    cancelAnimationFrame(raf)
    if (lenis && lenis.destroy) lenis.destroy()
    offs.forEach(function (off) { off() })
    if (scrollRestoration) history.scrollRestoration = scrollRestoration
  }
}
