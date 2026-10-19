import { juratAudio } from "./audio"
// Real recordings only (see audio-src/SOURCES.md). Nothing plays before the visitor touches the page.
const FILES = {
  c3: 'pluck-c3', d3: 'pluck-d3', d3s: 'pluck-d3s', e3: 'pluck-e3', g3: 'pluck-g3', d5: 'pluck-d5',
  ring: 'ring', phrase: 'phrase', knock: 'knock', tap: 'tap', crack: 'crack', switch: 'switch', swish: 'swish',
};
// six courses, low to high: G2 C3 D3 E3 G3 D4 (real plucks, the low and high ones re-pitched)
export const COURSE = [
  { k: 'c3', r: 0.749 }, { k: 'c3', r: 1 }, { k: 'd3', r: 1 }, { k: 'e3', r: 1 }, { k: 'g3', r: 1 }, { k: 'd5', r: 0.5 },
];

export class Sound {
  constructor() { this.buf = {}; this.on = false; this.ctx = null; this.last = {}; }
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      this.ready = Promise.all(Object.entries(FILES).map(([k, f]) => fetch(juratAudio(f))
        .then((r) => r.arrayBuffer()).then((a) => new Promise((res, rej) => this.ctx.decodeAudioData(a, res, rej)))
        .then((b) => { this.buf[k] = b; }).catch(() => {})));
    }
    if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) { /* stays silent */ } }
    return true;
  }
  play(k, o = {}) {
    if (!this.on || !this.ctx || !this.buf[k]) return;
    const now = this.ctx.currentTime;
    const key = o.key || k;
    if (o.gap && this.last[key] && now - this.last[key] < o.gap) return;
    this.last[key] = now;
    const s = this.ctx.createBufferSource();
    s.buffer = this.buf[k];
    s.playbackRate.value = o.rate || 1;
    const g = this.ctx.createGain();
    g.gain.value = o.gain ?? 1;
    s.connect(g);
    if (o.pan && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); p.connect(this.master); }
    else g.connect(this.master);
    s.start(now + (o.delay || 0));
  }
  course(c, gain = 0.7, delay = 0) {
    const n = COURSE[Math.max(0, Math.min(5, c))];
    this.play(n.k, { rate: n.r * (1 + (Math.random() - 0.5) * 0.004), gain, delay, key: 'c' + c, gap: 0.05, pan: (c - 2.5) * 0.08 });
  }
  strum(gain = 0.55, down = true) {
    for (let i = 0; i < 6; i++) this.course(down ? i : 5 - i, gain, i * 0.028);
  }
}
