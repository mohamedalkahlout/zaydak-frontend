// A small tween engine stepped by the page loop with the rAF timestamp (Zen rounds performance.now to 1 ms).
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (v, a, b) => clamp((v - a) / (b - a));
export const E = {
  lin: (t) => t,
  out3: (t) => 1 - (1 - t) ** 3,
  in3: (t) => t * t * t,
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  expo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  back: (t, s = 1.45) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
};

const live = new Set();
let now = 0;
export function step(t) {
  now = t;
  for (const w of [...live]) {
    if (w.t0 == null) w.t0 = t + w.delay;
    const k = clamp((t - w.t0) / w.dur);
    if (t < w.t0) continue;
    w.update(w.ease(k), k);
    if (k >= 1) { live.delete(w); w.done && w.done(); }
  }
  return live.size > 0;
}
export function tween(o) {
  const w = { dur: (o.dur ?? 0.8) * 1000, delay: (o.delay ?? 0) * 1000, ease: o.ease || E.out3, update: o.update, done: o.done, t0: null };
  if (o.dur === 0) { w.update(1, 1); w.done && w.done(); return { kill() {} }; }
  live.add(w);
  return { kill() { live.delete(w); }, get alive() { return live.has(w); } };
}
export const busy = () => live.size > 0;
export const clock = () => now;
