// The name rosette, drawn in 2D: a ring of small leaves and the name cut large across the heart in Reem Kufi.
// mask(): air = cut through, order = when the cutter reaches it (the centre first). paint() lays light maple
// fretwork wherever the wood is left, so the rosette is "cut" by raising cut from 0 to 1.
function petal(x, cx, cy, a, r0, r1, wd) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const p = (r, s) => [cx + ca * r - sa * s, cy + sa * r + ca * s];
  x.beginPath();
  const q = p(r0, 0); x.moveTo(q[0], q[1]);
  let c1 = p((r0 + r1) / 2, wd); const e = p(r1, 0);
  x.quadraticCurveTo(c1[0], c1[1], e[0], e[1]);
  c1 = p((r0 + r1) / 2, -wd);
  x.quadraticCurveTo(c1[0], c1[1], q[0], q[1]);
  x.fill();
}

export function mask(name, S = 512, fallback = 'جرعة فن') {
  // white = cut through (air), black = wood left standing
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const R = S / 2, cx = R, cy = R;
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#fff';
  // the heart is open: the name stands in it on a baseline bar, held by a ring
  x.beginPath(); x.arc(cx, cy, R * 0.62, 0, Math.PI * 2); x.fill();
  // a band of small leaves cut round it
  for (let k = 0; k < 32; k++) petal(x, cx, cy, k * Math.PI / 16 + Math.PI / 32, R * 0.67, R * 0.9, R * 0.062);
  for (let k = 0; k < 32; k++) petal(x, cx, cy, k * Math.PI / 16, R * 0.74, R * 0.86, R * 0.026);
  const label = (name || '').trim().slice(0, 16) || fallback;
  let fs = R * 0.44;
  const font = (f) => `700 ${f}px "Reem Kufi", "IBM Plex Sans Arabic", sans-serif`;
  x.font = font(fs); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.direction = /[؀-ۿ]/.test(label) ? 'rtl' : 'ltr';
  const maxW = R * 1.08, wd = x.measureText(label).width;
  if (wd > maxW) { fs *= maxW / wd; x.font = font(fs); }
  x.fillStyle = '#000'; x.strokeStyle = '#000'; x.lineJoin = 'round';
  x.lineWidth = Math.max(2, fs * 0.07);
  const ty = cy + fs * 0.04;
  x.strokeText(label, cx, ty); x.fillText(label, cx, ty);
  // the baseline bar and a cross bar hold the letters to the ring
  const bar = R * 0.035, by = ty + fs * 0.34;
  x.fillRect(cx - R * 0.62, by - bar / 2, R * 1.24, bar);
  x.fillRect(cx - bar / 2, by, bar, R * 0.62 - (by - cy));
  // the rim is always wood
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.arc(cx, cy, R * 0.93, 0, Math.PI * 2, true); x.fill();
  const d = x.getImageData(0, 0, S, S).data;
  const air = new Uint8Array(S * S), order = new Float32Array(S * S);
  for (let i = 0, p = 0; p < S * S; p++, i += 4) {
    const px = p % S, py = (p / S) | 0;
    const r = Math.hypot(px - cx, py - cy) / R;
    air[p] = r < 1 && d[i] > 127 ? 1 : 0;
    order[p] = r;
  }
  return { S, air, order };
}

// ivory fretwork with a bevel, and its shadow thrown into the dark hole below it
export function paint(ctx, m, cut) {
  const { S, air, order } = m;
  const img = ctx.createImageData(S, S), o = img.data;
  const R = S / 2;
  const isAir = (p) => air[p] && order[p] < cut;
  const wood = (px, py) => px >= 0 && py >= 0 && px < S && py < S && !isAir(py * S + px) && Math.hypot(px - R, py - R) <= R;
  for (let p = 0, i = 0; p < S * S; p++, i += 4) {
    const px = p % S, py = (p / S) | 0;
    if (Math.hypot(px - R, py - R) > R) { o[i + 3] = 0; continue; }
    if (isAir(p)) {
      // shadow of the fretwork falling down and to the right
      if (wood(px - 5, py - 7)) { o[i] = 6; o[i + 1] = 4; o[i + 2] = 3; o[i + 3] = 150; } else o[i + 3] = 0;
      continue;
    }
    let l = 0;
    if (px > 1 && py > 1 && isAir(p - S - 1)) l += 0.22;
    if (px > 2 && py > 2 && isAir(p - 2 * S - 2)) l += 0.08;
    if (px < S - 2 && py < S - 2 && isAir(p + S + 1)) l -= 0.34;
    if (px < S - 3 && py < S - 3 && isAir(p + 2 * S + 2)) l -= 0.12;
    const n = ((px * 7 + py * 13) % 11) / 11 - 0.5;
    const g = 1 + l + n * 0.04;
    o[i] = Math.min(255, 238 * g); o[i + 1] = Math.min(255, 224 * g); o[i + 2] = Math.min(255, 196 * g); o[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
