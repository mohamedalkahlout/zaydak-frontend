import { juratArt } from "./art"
// The cover between two places: the back of a bowl close up (assets/img/ribwood), cut along its own maple seams
// into ribs. The ribs slide down over the screen one at a time, the middle one first, then outward on both sides,
// and carry on down and away to show the next place. t: 0 clear, 1 covered, 2 clear again.
import { META3 } from './meta3.js';
import { E, clamp } from './tween.js';

const RW = META3.ribwood;
const BRASS = '205,178,122';

function at(rows, xs, y) {
  if (y <= rows[0]) return xs[0] + (xs[1] - xs[0]) * (y - rows[0]) / (rows[1] - rows[0]);
  for (let k = 1; k < rows.length; k++) if (y <= rows[k]) return xs[k - 1] + (xs[k] - xs[k - 1]) * (y - rows[k - 1]) / (rows[k] - rows[k - 1]);
  const n = rows.length - 1;
  return xs[n] + (xs[n] - xs[n - 1]) * (y - rows[n]) / (rows[n] - rows[n - 1]);
}

export class Cover {
  constructor(canvas) { this.c = canvas; this.x = canvas.getContext('2d'); this.img = new Image(); this.ok = false; this.t = -1; this.strips = []; }
  load() {
    if (this.p) return this.p;
    this.p = new Promise((res) => {
      this.img.decoding = 'async';
      this.img.onload = () => { (this.img.decode ? this.img.decode() : Promise.resolve()).catch(() => {}).then(() => { this.ok = true; this.t = -1; res(); }); };
      this.img.onerror = () => res();
      this.img.src = juratArt('ribwood.webp');
    });
    return this.p;
  }
  resize(w, h, dpr) {
    this.w = w; this.h = h; this.d = dpr;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    const s = Math.max(w / RW.w, h / RW.h), ox = (w - RW.w * s) / 2, oy = (h - RW.h * s) / 2;
    this.map = { s, ox, oy };
    const rows = RW.rows.map((y) => oy + y * s);
    const B = [rows.map(() => -60), ...RW.seams.map((sm) => sm.map((x) => ox + x * s)), rows.map(() => w + 60)];
    const ys = []; for (let k = 0; k <= 24; k++) ys.push(h * k / 24);
    this.strips = [];
    for (let i = 0; i < B.length - 1; i++) {
      const L = (y) => at(rows, B[i], y), R = (y) => at(rows, B[i + 1], y);
      if (Math.max(...ys.map(R)) < 0 || Math.min(...ys.map(L)) > w) continue;
      // the rib, with rounded ends past the top and bottom of the screen
      const p = new Path2D();
      p.moveTo(L(0), 0);
      ys.forEach((y) => p.lineTo(L(y), y));
      const lb = L(h), rb = R(h), lt = L(0), rt = R(0);
      p.quadraticCurveTo((lb + rb) / 2, h + (rb - lb) * 0.42, rb, h);
      for (let k = ys.length - 1; k >= 0; k--) p.lineTo(R(ys[k]), ys[k]);
      p.quadraticCurveTo((lt + rt) / 2, -(rt - lt) * 0.42, lt, 0);
      p.closePath();
      this.strips.push({ p, mid: (L(h / 2) + R(h / 2)) / 2, wb: rb - lb, wt: rt - lt, lb, rb, lt, rt });
    }
    const cx = w / 2;
    [...this.strips].sort((a, b) => Math.abs(a.mid - cx) - Math.abs(b.mid - cx)).forEach((s, r) => { s.rank = r; });
    this.t = -1;
  }
  draw(t) {
    if (t === this.t) return;
    this.t = t;
    const { x, c, d, w, h } = this;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    const vis = t > 0 && t < 2 && this.ok;
    this.c.style.visibility = vis ? 'visible' : 'hidden';
    if (!vis) return;
    x.setTransform(d, 0, 0, d, 0, 0);
    const n = this.strips.length, D = 0.46, G = (1 - D) / Math.max(1, n - 1);
    const { s, ox, oy } = this.map;
    for (const st of this.strips) {
      let off, k, laying = t <= 1;
      if (laying) { k = clamp((t - st.rank * G) / D); if (k <= 0) continue; off = -(1 - E.out3(k)) * (h * 1.12); }
      else { k = clamp((t - 1 - st.rank * G) / D); if (k >= 1) continue; off = E.in3(k) * (h * 1.12); }
      x.save();
      x.translate(0, off);
      x.clip(st.p);
      x.drawImage(this.img, ox, oy, RW.w * s, RW.h * s);
      // the moving end of the rib: shaded where it bends away, a brass line where it catches the lamp
      const end = laying ? h : 0, dir = laying ? -1 : 1;
      const gr = x.createLinearGradient(0, end, 0, end + 90 * dir);
      gr.addColorStop(0, 'rgba(10,6,3,.55)'); gr.addColorStop(1, 'rgba(10,6,3,0)');
      x.fillStyle = gr; x.fillRect(-80, Math.min(end, end + 90 * dir) - (laying ? 60 : 0), w + 160, 150);
      x.restore();
      const moving = laying ? k < 1 : k > 0;
      if (moving) {
        // a thin brass edge round the rounded end
        x.save(); x.translate(0, off);
        x.beginPath();
        if (laying) { x.moveTo(st.lb, h); x.quadraticCurveTo((st.lb + st.rb) / 2, h + st.wb * 0.42, st.rb, h); }
        else { x.moveTo(st.lt, 0); x.quadraticCurveTo((st.lt + st.rt) / 2, -st.wt * 0.42, st.rt, 0); }
        x.strokeStyle = `rgba(${BRASS},.85)`; x.lineWidth = 2; x.stroke();
        x.restore();
      }
    }
  }
}
