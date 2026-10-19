import { juratArt } from "./art"
// Rib by rib. One oud photograph is cut into the ribs of its bowl (meridians of a body of revolution seen
// from behind: x = centre + halfWidth(y) * sin(angle)) plus the neck above the joint. A new photograph is laid
// one rib at a time: the centre rib first, then outward on both sides, the neck last. Each rib is pressed on from
// the neck joint down, slides home with an overshoot, and its seams catch a bronze glint as it lands.
import { META } from './meta.js';
import { clamp, E, tween } from './tween.js';

const [FW, FH] = META.frame;
const BOT = META.bottom;
const CX = FW / 2;
export const PAD = 64;
const N = 17;
const PIECES = N + 1;           // the ribs and the neck
// each piece's share of the transition (D) and the stagger (G): swaps in time overlap more, the scrolled turn
// lays the ribs further apart so each one reads
const SCHED = { swap: { D: 0.26, G: (0.74 - 0.26) / (PIECES - 1) }, turn: { D: 0.15, G: (0.86 - 0.15) / (PIECES - 1) } };
export { PIECES, N as RIBS, RANK };
const RANK = [];
for (let i = 0; i < N; i++) { const d = i - (N - 1) / 2; RANK[i] = d === 0 ? 0 : Math.abs(d) * 2 - (d < 0 ? 1 : 0); }
const BRASS = '205,178,122';

const cache = {};               // key -> HTMLImageElement
const pending = {};
let SUFFIX = '';
export function setPhone(on) { SUFFIX = on ? '-m' : ''; }
export function load(key) {
  if (!key) return Promise.resolve(null);
  if (cache[key]) return Promise.resolve(cache[key]);
  if (pending[key]) return pending[key];
  const [i, s] = parse(key);
  const im = new Image();
  im.decoding = 'async';
  pending[key] = new Promise((res) => {
    let tries = 0;
    const go = () => { im.src = juratArt(`oud/oud${i}-${s}${SUFFIX}.webp`); };
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { cache[key] = im; res(im); }); };
    im.onerror = () => { if (++tries < 3) setTimeout(go, 400 * tries); else res(null); };
    go();
  });
  return pending[key];
}
export const loaded = (key) => !!cache[key];
// v3: the beech mould the ribs are laid on, already warped onto the bowl of oud 1 (tools/assets3.py)
const mould = new Image();
let mouldOk = false, mouldP = null;
export function loadMould() {
  if (mouldP) return mouldP;
  mouldP = new Promise((res) => {
    mould.decoding = 'async';
    mould.onload = () => { (mould.decode ? mould.decode() : Promise.resolve()).catch(() => {}).then(() => { mouldOk = true; res(mould); }); };
    mould.onerror = () => res(null);
    mould.src = juratArt(`oud/mould${SUFFIX}.webp`);
  });
  return mouldP;
}
// '1f' = oud 1 front, '3b' = oud 3 back
export function parse(key) { return [+key[0], key[1] === 'b' ? 'back' : 'front']; }

function halfAt(key, y) {
  const [i, side] = parse(key);
  const o = META.ouds[i]; if (!o || !o[side]) return 0;
  const j = o[side].joint, h = o[side].half, u = (y - j) / (BOT - j);
  if (u < 0 || u > 1) return 0;
  const f = u * (h.length - 1), a = Math.floor(f), b = Math.min(a + 1, h.length - 1);
  return h[a] + (h[b] - h[a]) * (f - a);
}
const jointOf = (key) => { const [i, side] = parse(key); return META.ouds[i][side].joint; };

const geoCache = {};
function geometry(a, b) {
  const id = (a || '_') + (b || '_');
  if (geoCache[id]) return geoCache[id];
  const keys = [a, b].filter(Boolean);
  const J = Math.max(...keys.map(jointOf));
  const hf = (y) => Math.max(...keys.map((k) => halfAt(k, y))) + 5;
  const ys = []; for (let k = 0; k <= 44; k++) ys.push(J + (BOT - J) * k / 44);
  const X = (j, y) => CX + hf(y) * Math.sin(-Math.PI / 2 + Math.PI * j / N);
  const strips = [], seams = [];
  for (let j = 1; j < N; j++) { const s = new Path2D(); ys.forEach((y, k) => (k ? s.lineTo(X(j, y), y) : s.moveTo(X(j, y), y))); seams[j] = s; }
  for (let i = 0; i < N; i++) {
    const p = new Path2D();
    if (i === 0) { p.moveTo(-PAD, J); p.lineTo(-PAD, FH + PAD); }
    else { ys.forEach((y, k) => (k ? p.lineTo(X(i, y), y) : p.moveTo(X(i, y), y))); p.lineTo(CX, FH + PAD); }
    if (i === N - 1) { p.lineTo(FW + PAD, FH + PAD); p.lineTo(FW + PAD, J); }
    else { p.lineTo(CX, FH + PAD); for (let k = ys.length - 1; k >= 0; k--) p.lineTo(X(i + 1, ys[k]), ys[k]); }
    p.closePath();
    strips.push(p);
  }
  const neck = new Path2D(); neck.rect(-PAD, -PAD, FW + 2 * PAD, J + PAD);
  const pieces = [];
  for (let i = 0; i < N; i++) pieces[RANK[i]] = { path: strips[i], i, neck: false };
  pieces[N] = { path: neck, i: -1, neck: true };
  // the crack for the repair: down the middle of rib 11, jagged
  const crack = [];
  { const c = 11, y0 = J + (BOT - J) * 0.2, y1 = J + (BOT - J) * 0.66; let s = 7;
    for (let k = 0; k <= 26; k++) {
      const y = y0 + (y1 - y0) * k / 26;
      s = (s * 9301 + 49297) % 233280;
      const jit = (s / 233280 - 0.5) * 7;
      const xm = (X(c, y) + X(c + 1, y)) / 2;
      crack.push([xm + jit, y]);
    } }
  geoCache[id] = { J, strips, seams, pieces, crack, X, hf };
  return geoCache[id];
}

function shadowOf(img) {
  if (img._shadow) return img._shadow;
  const sw = Math.ceil((FW + 2 * PAD) / 12), sh = Math.ceil((FH + 2 * PAD) / 12);
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const x = c.getContext('2d');
  x.drawImage(img, PAD / 12, PAD / 12, FW / 12, FH / 12);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#0b1120'; x.fillRect(0, 0, sw, sh);
  img._shadow = c;
  return c;
}

export class Ribs {
  constructor(canvas) {
    this.ks = null;
    this.c = canvas;
    this.x = canvas.getContext('2d');
    this.a = null; this.b = null; this.t = 0;
    this.light = { x: 0.5, a: 0 };
    this.shadowA = 0.26;
    this.dirty = true;
    this.anim = null;
    this.fx = null;
    this.sc = SCHED.swap;
  }
  resize(cssH, dpr) {
    const h = Math.round(cssH * dpr), w = Math.round(h * (FW + 2 * PAD) / (FH + 2 * PAD));
    if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
    this.c.style.height = cssH + 'px';
    this.c.style.width = (cssH * (FW + 2 * PAD) / (FH + 2 * PAD)) + 'px';
    this.dirty = true;
  }
  get shown() { return this.t >= 1 && this.b ? this.b : this.a; }
  get busy() { return !!(this.anim && this.anim.alive); }
  show(key) { this.kill(); this.ks = null; this.a = key; this.b = null; this.t = 0; this.dirty = true; load(key).then(() => { this.dirty = true; }); }
  kill() { if (this.anim) { this.anim.kill(); this.anim = null; } }
  // scroll driven: a to b at t
  scrub(a, b, t) {
    this.kill();
    if (this.ks) { this.ks = null; this.dirty = true; }
    if (this.sc !== SCHED.turn) { this.sc = SCHED.turn; this.dirty = true; }
    if (this.a !== a || this.b !== b || this.t !== t) { this.a = a; this.b = b; this.t = t; this.dirty = true; }
  }
  // time driven, from what is on screen now to key; going back to the picture being replaced rewinds
  go(key, o = {}) {
    if (this.ks) { this.ks = null; this.dirty = true; }
    const dur = o.dur ?? 1.15;
    if (this.busy && key === this.a && this.b) {
      const from = this.t; this.kill();
      return new Promise((res) => {
        this.anim = tween({ dur: dur * Math.max(0.25, from), ease: E.lin, update: (k) => { this.t = from * (1 - k); this.dirty = true; },
          done: () => { this.b = null; this.t = 0; this.dirty = true; res(); } });
      });
    }
    const cur = this.busy ? (this.t > 0.5 ? this.b : this.a) : this.shown;
    this.kill();
    this.sc = SCHED[o.sched || 'swap'];
    const { D, G } = this.sc;
    if (cur === key) { this.a = key; this.b = null; this.t = 0; this.dirty = true; return Promise.resolve(); }
    return load(key).then(() => new Promise((res) => {
      this.a = cur; this.b = key; this.t = 0; this.dirty = true;
      if (dur === 0) { this.a = key; this.b = null; this.t = 0; return res(); }
      let landed = 0;
      this.anim = tween({ dur, ease: E.lin, update: (k) => {
        this.t = k; this.dirty = true;
        if (o.onRib) while (landed < PIECES && k >= landed * G + D) o.onRib(landed++);
      }, done: () => { this.a = key; this.b = null; this.t = 0; this.dirty = true; res(); } });
    }));
  }
  frame() {
    const { c, x } = this;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    const sc = c.width / (FW + 2 * PAD);
    x.setTransform(sc, 0, 0, sc, PAD * sc, PAD * sc);
    return sc;
  }
  draw() {
    if (!this.dirty) return false;
    this.dirty = false;
    this.frame();
    const x = this.x;
    const A = this.a && cache[this.a], B = this.b && cache[this.b];
    if (this.fx) { this.drawRepair(A); return true; }
    if (this.ks) { this.drawBuild(A); return true; }
    const t = this.t;
    if (!B || t <= 0) { if (A) x.drawImage(A, 0, 0, FW, FH); }
    else if (t >= 1) x.drawImage(B, 0, 0, FW, FH);
    else this.drawLay(A, B, t);
    this.lightPass();
    // one soft shadow, handed from the old picture to the new one
    x.globalCompositeOperation = 'destination-over';
    const sh = (img, clip, inv) => {
      if (!img) return;
      x.save();
      if (clip) { const p = new Path2D(); if (inv) p.rect(-PAD * 2, -PAD * 2, FW + 4 * PAD, FH + 4 * PAD); p.addPath(clip); x.clip(p, 'evenodd'); }
      x.globalAlpha = this.shadowA; x.drawImage(shadowOf(img), -PAD + 16, -PAD + 26, FW + 2 * PAD, FH + 2 * PAD);
      x.restore();
    };
    if (!B || t <= 0) sh(A);
    else if (t >= 1) sh(B);
    else { sh(A, this._laid, true); sh(B, this._laid, false); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    return true;
  }
  drawLay(A, B, t) {
    const x = this.x;
    const g = geometry(this.a, this.b);
    if (A) x.drawImage(A, 0, 0, FW, FH);
    const { D, G } = this.sc;
    const done = new Path2D(), laid = new Path2D();
    let nd = 0;
    const moving = [];
    for (let r = 0; r < PIECES; r++) {
      const k = (t - r * G) / D;
      if (k >= 1) { done.addPath(g.pieces[r].path); laid.addPath(g.pieces[r].path); nd++; if (k < 1.9) moving.push([r, k]); }
      else if (k > 0) { moving.push([r, k]); if (k > 0.35) laid.addPath(g.pieces[r].path); }
    }
    this._laid = laid;
    if (nd) { x.save(); x.clip(done); x.clearRect(-PAD, -PAD, FW + 2 * PAD, FH + 2 * PAD); x.drawImage(B, 0, 0, FW, FH); x.restore(); }
    for (const [r, k] of moving) {
      const p = g.pieces[r];
      if (k >= 1) { this.glint(g, p, 1 - (k - 1) / 0.9); continue; }
      const e = E.out3(k), slide = (1 - E.back(k, 1.7)) * 30;
      x.save(); x.clip(p.path);
      let yf;
      if (!p.neck) {
        yf = g.J + (FH + PAD - g.J) * e;
        x.beginPath(); x.rect(-PAD, -PAD, FW + 2 * PAD, yf + PAD); x.clip();
        x.clearRect(-PAD, -PAD, FW + 2 * PAD, FH + 2 * PAD);
        x.drawImage(B, 0, -slide, FW, FH);
      } else {
        yf = g.J - (g.J + PAD) * e;
        x.beginPath(); x.rect(-PAD, yf, FW + 2 * PAD, g.J - yf); x.clip();
        x.clearRect(-PAD, -PAD, FW + 2 * PAD, FH + 2 * PAD);
        x.drawImage(B, 0, slide, FW, FH);
      }
      x.restore();
      // the pressing edge: a bronze line on the wood, the old wood shaded just past it
      x.save(); x.clip(p.path); x.globalCompositeOperation = 'source-atop';
      const dn = p.neck ? -1 : 1;
      const gr = x.createLinearGradient(0, yf, 0, yf + 34 * dn);
      gr.addColorStop(0, 'rgba(11,17,32,.34)'); gr.addColorStop(1, 'rgba(11,17,32,0)');
      x.fillStyle = gr; x.fillRect(-PAD, Math.min(yf, yf + 34 * dn), FW + 2 * PAD, 34);
      x.fillStyle = `rgba(${BRASS},${(0.95 * (1 - k * 0.6)).toFixed(3)})`;
      x.fillRect(-PAD, yf - 2, FW + 2 * PAD, 4);
      x.restore();
    }
  }
  glint(g, p, a) {
    if (a <= 0 || p.neck) return;
    const x = this.x;
    x.save(); x.globalCompositeOperation = 'source-atop';
    x.strokeStyle = `rgba(${BRASS},${(0.85 * a * a).toFixed(3)})`; x.lineWidth = 3;
    if (g.seams[p.i]) x.stroke(g.seams[p.i]);
    if (g.seams[p.i + 1]) x.stroke(g.seams[p.i + 1]);
    x.restore();
  }
  lightPass() {
    const { x, light } = this;
    if (light.a <= 0.001) return;
    x.save(); x.globalCompositeOperation = 'source-atop';
    const cx = -PAD + (FW + 2 * PAD) * light.x;
    const gr = x.createLinearGradient(cx - 260, 0, cx + 260, 520);
    gr.addColorStop(0, 'rgba(255,248,232,0)');
    gr.addColorStop(0.5, `rgba(255,248,232,${(0.2 * light.a).toFixed(3)})`);
    gr.addColorStop(1, 'rgba(255,248,232,0)');
    x.fillStyle = gr; x.fillRect(-PAD, -PAD, FW + 2 * PAD, FH + 2 * PAD);
    x.restore();
  }
  // v3, the build: ks[r] is each piece's flight (0 on the bench, 1 landed). Landed pieces are drawn here, over the
  // mould and its pencil lines; pieces in flight are drawn by the page as their own canvases (piece()).
  setBuild(ks) { this.kill(); this.ks = ks; this.dirty = true; }
  drawBuild(A) {
    const x = this.x;
    const g = geometry(this.a, null);
    const ks = this.ks;
    const laid = new Path2D();
    let any = false, neck = false;
    for (let r = 0; r < PIECES; r++) if (ks[r] >= 1) { laid.addPath(g.pieces[r].path); any = true; if (g.pieces[r].neck) neck = true; }
    if (mouldOk) {
      x.drawImage(mould, 0, 0, FW, FH);
      // the maker's pencil lines: where every rib goes
      x.save(); x.globalCompositeOperation = 'source-atop';
      x.strokeStyle = 'rgba(64,46,30,.34)'; x.lineWidth = 1.4;
      for (let j = 1; j < N; j++) x.stroke(g.seams[j]);
      x.restore();
    }
    if (any && A) {
      x.save(); x.clip(laid);
      x.clearRect(-PAD, -PAD, FW + 2 * PAD, FH + 2 * PAD);
      if (!neck && mouldOk) x.drawImage(mould, 0, 0, FW, FH);
      x.drawImage(A, 0, 0, FW, FH);
      x.restore();
    }
    for (let r = 0; r < PIECES; r++) { const k = ks[r]; if (k >= 1 && k < 1.7) this.glint(g, g.pieces[r], 1 - (k - 1) / 0.7); }
    // the shadow on the bench: the mould's, then the neck's once it is on
    x.globalCompositeOperation = 'destination-over';
    x.globalAlpha = this.shadowA;
    if (mouldOk) x.drawImage(shadowOf(mould), -PAD + 12, -PAD + 18, FW + 2 * PAD, FH + 2 * PAD);
    if (neck && A) {
      x.save(); const p = new Path2D(); p.rect(-PAD * 2, -PAD * 2, FW + 4 * PAD, g.J + PAD * 2); x.clip(p);
      x.drawImage(shadowOf(A), -PAD + 12, -PAD + 18, FW + 2 * PAD, FH + 2 * PAD); x.restore();
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  // one piece of key as its own canvas at s device px per frame unit, with its box in frame units
  piece(key, r, s, cv) {
    const img = cache[key]; if (!img) return null;
    const g = geometry(key, null);
    const p = g.pieces[r];
    let x0, x1, y0, y1;
    if (p.neck) {
      const [i, side] = parse(key);
      y0 = Math.max(-PAD, META.ouds[i][side].top - 16); y1 = g.J + 1; x0 = CX - 150; x1 = CX + 150;
    } else {
      const ys = []; for (let k = 0; k <= 44; k++) ys.push(g.J + (BOT - g.J) * k / 44);
      x0 = Math.min(...ys.map((y) => g.X(p.i, y))) - 2; x1 = Math.max(...ys.map((y) => g.X(p.i + 1, y))) + 2;
      y0 = g.J - 1; y1 = BOT + 3;
    }
    const w = Math.max(2, Math.ceil((x1 - x0) * s)), h = Math.max(2, Math.ceil((y1 - y0) * s));
    const c = cv || document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
    x.setTransform(s, 0, 0, s, -x0 * s, -y0 * s);
    x.save(); x.clip(p.path); x.drawImage(img, 0, 0, FW, FH); x.restore();
    return { c, x0, y0, x1, y1, i: p.i, neck: p.neck };
  }
  // the repair: one rib cracks, comes off, a fresh one is laid
  drawRepair(A) {
    if (!A) return;
    const x = this.x, f = this.fx;
    const g = geometry(this.a, null);
    const p = g.strips[11];
    x.drawImage(A, 0, 0, FW, FH);
    const hole = f.lift > 0 || f.land > 0;
    if (hole) {
      x.save(); x.clip(p); x.globalCompositeOperation = 'source-atop';
      const gr = x.createLinearGradient(0, g.J, 0, BOT);
      gr.addColorStop(0, '#120c08'); gr.addColorStop(1, '#2a1c12');
      x.fillStyle = gr; x.fillRect(-PAD, -PAD, FW + 2 * PAD, FH + 2 * PAD);
      x.restore();
    }
    if (f.land > 0) {
      const k = f.land, e = E.out3(k), slide = (1 - E.back(k, 1.7)) * 30;
      const yf = g.J + (FH + PAD - g.J) * e;
      x.save(); x.clip(p); x.beginPath(); x.rect(-PAD, -PAD, FW + 2 * PAD, yf + PAD); x.clip();
      x.drawImage(A, 0, -slide, FW, FH); x.restore();
      if (k < 1) { x.save(); x.clip(p); x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(${BRASS},${(0.95 * (1 - k)).toFixed(3)})`; x.fillRect(-PAD, yf - 2, FW + 2 * PAD, 4); x.restore(); }
      else this.glint(g, { i: 11, neck: false }, 1 - clamp(f.glint || 0));
    }
    if (f.lift < 1 && f.crack > 0) {
      x.save();
      if (f.lift > 0) {
        const l = E.in3(f.lift);
        const [px, py] = g.crack[13];
        x.translate(px + l * 70, py - l * 150); x.rotate(l * 0.22); x.translate(-px, -py);
        x.globalAlpha = 1 - E.in3(f.lift);
        x.save(); x.clip(p); x.drawImage(A, 0, 0, FW, FH); x.restore();
      }
      const n = Math.max(2, Math.round(g.crack.length * clamp(f.crack)));
      x.save(); x.clip(p); x.lineJoin = 'round';
      x.beginPath(); g.crack.slice(0, n).forEach(([cx, cy], k) => (k ? x.lineTo(cx, cy) : x.moveTo(cx, cy)));
      x.strokeStyle = 'rgba(8,5,3,.92)'; x.lineWidth = 3.2; x.stroke();
      x.translate(1.6, 1.2); x.strokeStyle = 'rgba(255,214,170,.35)'; x.lineWidth = 1; x.stroke();
      x.restore();
      x.restore();
    }
    this.lightPass();
    x.globalCompositeOperation = 'destination-over';
    x.globalAlpha = this.shadowA; x.drawImage(shadowOf(A), -PAD + 16, -PAD + 26, FW + 2 * PAD, FH + 2 * PAD);
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  }
  // where the oud is, in canvas css px, for QA and layout (the photograph's own outline)
  bounds() {
    const key = this.shown; if (!key) return null;
    const [i, side] = parse(key), o = META.ouds[i];
    const half = Math.max(...o[side].half);
    return { x0: CX - half, x1: CX + half, y0: o[side].top, y1: BOT, fw: FW + 2 * PAD, fh: FH + 2 * PAD, pad: PAD };
  }
}

// The store ground fanning out from behind the oud, rib by rib: wedges round the neck joint, the one pointing
// down first, then outward on both sides.
export class Fan {
  constructor(canvas) { this.c = canvas; this.x = canvas.getContext('2d'); this.t = -1; }
  resize(w, h, dpr) { this.dpr = dpr; this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); this.t = -1; }
  draw(t, px, py, color) {
    if (t === this.t && px === this.px && py === this.py) return;
    this.t = t; this.px = px; this.py = py;
    const { c, x } = this, d = this.dpr;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    if (t <= 0) return;
    x.fillStyle = color;
    if (t >= 1) { x.fillRect(0, 0, c.width, c.height); return; }
    const M = 17, span = Math.PI * 2 / M, R = Math.hypot(c.width, c.height) * 1.1;
    const Dw = 0.62, Gw = (1 - Dw) / (M - 1);
    for (let m = 0; m < M; m++) {
      const dm = m <= (M - 1) / 2 ? m : m - M;      // signed steps from the downward wedge
      const rank = dm === 0 ? 0 : Math.abs(dm) * 2 - (dm < 0 ? 1 : 0);
      const k = E.io3(clamp((t - rank * Gw) / Dw));
      if (k <= 0) continue;
      const mid = Math.PI / 2 + dm * span;
      const a0 = mid - span / 2 - 0.006, a1 = mid + span / 2 + 0.006;
      x.beginPath(); x.moveTo(px * d, py * d);
      x.arc(px * d, py * d, R * k, a0, a1);
      x.closePath(); x.fill();
    }
  }
}
