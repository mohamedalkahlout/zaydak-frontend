// Eleven strings across the band (five pairs and a single bass), tied at the bridge of the photographed face
// behind them (assets/img/strings-plate: bridge at x 117..237, fingerboard rows 322..676 of 1536 x 1024). They wobble when the
// pointer or a finger crosses them, and a new set goes on one string at a time: slack, swapped, pulled up to
// pitch with a glint running along it.
import { clamp, E, lerp } from './tween.js';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export class Strings {
  constructor(canvas, onPluck) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.onPluck = onPluck;
    this.s = [];
    // course 0 is the single bass at the top, as the oud is held
    for (let c = 0; c < 6; c++) for (let k = 0; k < (c === 0 ? 1 : 2); k++) {
      this.s.push({ c, k, wound: c < 3, w: [2.6, 2.2, 1.9, 1.5, 1.25, 1.1][c], amp: 0, ph: 0, f: 10 + c * 2.4 + k * 0.3, sag: 0, glint: -1, col: [230, 230, 230], to: null, swap: 0, t0: 0 });
    }
    this.rtl = true;
    this.dirty = true;
  }
  resize(w, h, dpr) {
    this.W = w; this.H = h; this.d = dpr;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    // the plate is laid like object-fit: cover, mirrored when the page reads left to right
    const P = { w: 1536, h: 1024, tie: 212, y0: 356, y1: 642 };
    const sc = Math.max(w / P.w, h / P.h), ox = (w - P.w * sc) / 2, oy = (h - P.h * sc) / 2;
    this.tie = ox + P.tie * sc;
    const top = oy + P.y0 * sc, bot = oy + P.y1 * sc, step = (bot - top) / 5.4;
    this.s.forEach((s) => { s.y = top + s.c * step + (s.c === 0 ? 0 : (s.k - 0.5) * Math.min(7, step * 0.24) + step * 0.2); });
    this.sc = sc;
    this.dirty = true;
  }
  // a set's look; animate = restring one string at a time
  look(set, animate, now) {
    const tre = hex(set.tre), bass = hex(set.bass);
    this.s.forEach((s, i) => {
      const col = s.wound ? bass : tre;
      if (!animate) { s.col = col; s.to = null; s.sag = 0; s.glint = -1; return; }
      s.to = col; s.t0 = now + i * 0.06; s.from = s.col.slice();
    });
    this.restringEnd = animate ? now + (this.s.length - 1) * 0.06 + 1.25 : 0;
    this.dirty = true;
  }
  bridgeX() { return this.rtl ? this.tie : this.W - this.tie; }
  cross(x0, y0, x1, y1) {
    const hits = [];
    this.s.forEach((s, i) => {
      if ((y0 - s.y) * (y1 - s.y) < 0) {
        const u = (s.y - y0) / (y1 - y0), x = x0 + (x1 - x0) * u;
        const bx = this.bridgeX();
        if (this.rtl ? x < bx : x > bx) return;
        s.amp = clamp(Math.abs(y1 - y0) * 0.5, 3, 11) * Math.sign(y1 - y0);
        s.ph = 0; s.hit = x;
        hits.push(s.c);
      }
    });
    [...new Set(hits)].forEach((c) => this.onPluck && this.onPluck(c));
    if (hits.length) this.dirty = true;
  }
  strum() { this.s.forEach((s, i) => { s.amp = 6 - i * 0.2; s.ph = -i * 0.35; s.hit = this.W / 2; }); this.dirty = true; }
  step(now, dt) {
    let live = false;
    for (const s of this.s) {
      if (Math.abs(s.amp) > 0.05) { s.ph += dt * s.f * Math.PI * 2; s.amp *= Math.exp(-dt * 2.6); live = true; } else s.amp = 0;
      if (s.to) {
        const u = now - s.t0;
        if (u < 0) { live = true; continue; }
        if (u < 0.35) { s.sag = E.out3(u / 0.35) * 26; s.col = mix(s.from, s.from.map((v) => v * 0.55), u / 0.35); }
        else if (u < 1.2) {
          const k = (u - 0.35) / 0.85;
          s.col = s.to; s.sag = 26 * (1 - E.back(k, 2.2)); s.glint = E.io3(k);
        } else { s.sag = 0; s.glint = -1; s.col = s.to; s.to = null; s.amp = 3; s.ph = 0; s.hit = this.W / 2; }
        live = true;
      }
    }
    if (live) this.dirty = true;
    return live;
  }
  draw() {
    if (!this.dirty) return;
    this.dirty = false;
    const { x, W, H, d } = this;
    x.setTransform(d, 0, 0, d, 0, 0);
    x.clearRect(0, 0, W, H);
    const bx = this.bridgeX(), far = this.rtl ? W + 20 : -20;
    const lift = Math.max(3, 7 * this.sc / 0.6);
    for (const s of this.s) {
      const span = far - bx, mid = bx + span / 2;
      const env = Math.sin(s.ph) * s.amp;
      const off = env * 2 + s.sag * 2;
      const path = () => { x.beginPath(); x.moveTo(bx, s.y); x.quadraticCurveTo(mid, s.y + off, far, s.y); };
      // shadow on the ground, the string, its winding, its highlight
      path(); x.strokeStyle = 'rgba(40,20,4,.32)'; x.lineWidth = s.w + 1.5; x.save(); x.translate(0, lift); x.stroke(); x.restore();
      path(); x.strokeStyle = rgb(s.col); x.lineWidth = s.w; x.stroke();
      if (s.wound) { path(); x.setLineDash([1.1, 1.7]); x.strokeStyle = 'rgba(40,44,52,.5)'; x.stroke(); x.setLineDash([]); }
      path(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = Math.max(0.6, s.w * 0.35); x.save(); x.translate(0, -s.w * 0.3); x.stroke(); x.restore();
      // the tie at the bridge
      x.fillStyle = rgb(s.col, 0.95); x.fillRect(bx - 5, s.y - s.w, 10, s.w * 2);
      if (s.glint >= 0) {
        const gx = bx + span * s.glint, gy = s.y + off * 2 * s.glint * (1 - s.glint);
        const gr = x.createRadialGradient(gx, gy, 0, gx, gy, 14);
        gr.addColorStop(0, 'rgba(255,244,214,.95)'); gr.addColorStop(1, 'rgba(255,244,214,0)');
        x.fillStyle = gr; x.fillRect(gx - 14, gy - 14, 28, 28);
      }
    }
  }
}
