/* eslint-disable */
// جرعة فن v3 «the workshop»: the wall where his ouds hang, the bench where one is built rib by rib, the wall again.
import Lenis from 'lenis';
import { juratArt } from './art';
import { T, PRODUCTS, SETS, ITEMS, STORE, WA } from './content.js';
import { META } from './meta.js';
import { META3 } from './meta3.js';
import { Ribs, Fan, load, loaded, setPhone, PAD, loadMould, PIECES, RIBS } from './ribs.js';
import { Cover } from './cover.js';
import { Strings } from './strings.js';
import { Sound } from './sound.js';
import { mask as roseMask, paint as rosePaint } from './rosette.js';
import { tween, step, E, clamp, seg, lerp } from './tween.js';

export function mountJurat(root) {
const $ = (s, r = root) => r.querySelector(s);
const $$ = (s, r = root) => [...r.querySelectorAll(s)];
const html = root;
const qs = new URLSearchParams(location.search);
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; };
const env = {
  touch: matchMedia('(hover: none) and (pointer: coarse)').matches,
  rm: matchMedia('(prefers-reduced-motion: reduce)').matches || qs.get('rm') === '1',
  phone: innerWidth < 760,
  lang: qs.get('lang') || store('jf-lang') || 'ar',
};
if (!T[env.lang]) env.lang = 'ar';
if (env.rm) html.classList.add('rm');
const DPR = Math.min(window.devicePixelRatio || 1, env.touch ? 1.75 : 2);
const t = (k) => T[env.lang][k] ?? k;
const shopUrl = (slug) => `${STORE}/${env.lang}/${slug}`;
const fmt = (n) => n.toLocaleString('en-US');
const keyOf = (i, side) => `${PRODUCTS[i].img}${side === 'back' ? 'b' : 'f'}`;
setPhone(env.phone);

const pin = $('#pin'), story = $('#top'), stageEl = $('#stage'), oudCanvas = $('#oud'), flyersEl = $('#flyers');
const wallCam = $('#wallCam'), wallLamp = $('#wallLamp'), benchTop = $('#benchTop'), stringsScene = $('#strings');
const ribs = new Ribs(oudCanvas);
const fan = new Fan($('#fan'));
const cover = new Cover($('#cover'));
const sound = new Sound();

// the story, in screens of scroll: the hero rests, the dive, the build, the turn, five ouds, the cover, the strings
const TL = env.touch
  ? { hold: 0.3, dive: 0.8, build: 1.85, turn: 1.0, zone: 0.74, exit: 0.6, strings: 1.0 }
  : { hold: 0.45, dive: 1.0, build: 2.6, turn: 1.3, zone: 1, exit: 0.8, strings: 1.4 };
const AT = {};
{ let a = 0; for (const k of ['hold', 'dive', 'build', 'turn']) { AT[k] = a; a += TL[k]; } AT.zones = a; a += 5 * TL.zone; AT.exit = a; a += TL.exit; AT.strings = a; a += TL.strings; AT.end = a; }
const LEN = () => AT.end;
// inside the build: seventeen ribs by 0.76, then the neck while the camera pulls back to the whole oud
const RD = 0.13, RG = (0.76 - RD) / (RIBS - 1), NECK0 = 0.8, ND = 0.14, PULL0 = 0.72;
function buildKs(b) { const ks = new Array(PIECES); for (let r = 0; r < RIBS; r++) ks[r] = (b - r * RG) / RD; ks[RIBS] = (b - NECK0) / ND; return ks; }

const state = { ready: false, landed: false, zone: -1, cur: 0, side: 'front', heroIn: env.rm ? 1 : 0, set: 0, carve: '', repair: 'idle', fanT: 0, uTurn: 0, b: 0, d: 0, e: 0, ct: 0, jumping: null, lamp: 1, lampOff: false, landedRibs: 0 };

// ---------- words ----------
function applyLang() {
  html.lang = env.lang; html.dir = env.lang === 'ar' ? 'rtl' : 'ltr';
  document.title = t('title');
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $$('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
  $$('[data-href-lang]').forEach((a) => { a.href = `${STORE}/${env.lang}`; });
  $$('[data-shop]').forEach((a) => { a.href = shopUrl(a.dataset.shop); });
  const lb = $('#langBtn');
  lb.textContent = t('lang_code'); lb.setAttribute('aria-label', t('lang_other')); lb.lang = env.lang === 'ar' ? 'en' : 'ar';
  $('#sHint').textContent = t(env.touch ? 'strings_hint' : 'strings_hint_mouse');
  setSoundUi();
  buildRail(); buildSets(); buildLay();
  showProduct(state.cur, { instant: true });
  setTurnUi();
  strings.rtl = env.lang === 'ar'; strings.dirty = true;
  updateWA();
}

function drum(el, text, dir = 1, instant = false) {
  const old = [...el.children];
  if (old.length && old[old.length - 1].textContent === text) return;
  const nu = document.createElement('span'); nu.className = 'dr'; nu.textContent = text;
  el.appendChild(nu);
  if (instant || env.rm || !old.length) { old.forEach((o) => o.remove()); return; }
  old.forEach((o) => {
    o.getAnimations().forEach((a) => a.cancel());
    o.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-105 * dir}%)` }], { duration: 620, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' }).onfinish = () => o.remove();
  });
  nu.animate([{ transform: `translateY(${105 * dir}%)` }, { transform: 'translateY(0)' }], { duration: 950, delay: 130, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
}

function setOdo(el, str, instant) {
  const chars = [...str];
  if (el.dataset.s !== chars.map((c) => (/\d/.test(c) ? 'd' : c)).join('')) {
    el.innerHTML = chars.map((c) => (/\d/.test(c)
      ? `<span class="d"><span class="col">${'0123456789'.split('').map((n) => `<span>${n}</span>`).join('')}</span></span>`
      : `<span class="sep">${c}</span>`)).join('');
    el.dataset.s = chars.map((c) => (/\d/.test(c) ? 'd' : c)).join('');
    if (!instant) void el.offsetWidth;
  }
  const cols = $$('.col', el), slots = $$('.d', el);
  const font = getComputedStyle(el).font;
  let k = 0;
  chars.forEach((c) => {
    if (!/\d/.test(c)) return;
    const col = cols[k], delay = instant ? '0s' : `${(cols.length - 1 - k) * 70}ms`;
    col.style.transition = instant || env.rm ? 'none' : '';
    col.style.transitionDelay = delay;
    col.style.transform = `translateY(${-(+c) * 10}%)`;
    slots[k].style.transition = instant || env.rm ? 'none' : '';
    slots[k].style.transitionDelay = delay;
    slots[k].style.width = digitW(font, c) + 'px';
    k++;
  });
}
const dwCache = {};
const dwCtx = document.createElement('canvas').getContext('2d');
function digitW(font, d) { const k = font + d; if (!dwCache[k]) { dwCtx.font = font; dwCache[k] = Math.ceil(dwCtx.measureText(d).width) + 1; } return dwCache[k]; }

// ---------- shop: the oud in your hands, the others on the rail ----------
function buildRail() {
  const rail = $('#rail');
  rail.innerHTML = PRODUCTS.map((P, i) => `<button class="peg" role="tab" type="button" aria-selected="${i === state.cur}" data-i="${i}">
    <span class="peg__hook" aria-hidden="true"></span><span class="peg__oud"><img src="${juratArt(`oud/oud${P.img}-h.webp`)}" alt="" width="360" height="760"></span><span class="peg__t">${P[env.lang].tab}</span></button>`).join('');
  $$('.peg', rail).forEach((b) => {
    b.addEventListener('click', () => jumpTo(+b.dataset.i));
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') sound.course(PRODUCTS[+b.dataset.i].course, 0.22); });
  });
}
function renderWoods(L) {
  $('#pWoods').innerHTML = L.woods.map(([k, v]) => `<li data-k="${k}"><b>${t(k)}</b> ${v}</li>`).join('');
  hotWoods();
}
function hotWoods() { $$('#pWoods li').forEach((li) => li.classList.toggle('hot', state.side === 'back' ? li.dataset.k !== 'top' : li.dataset.k === 'top')); }
function showProduct(i, o = {}) {
  const P = PRODUCTS[i], L = P[env.lang], prev = state.cur;
  const dir = i >= prev ? 1 : -1;
  state.cur = i;
  drum($('#pName'), L.name, dir, o.instant);
  drum($('#pNote'), L.note, dir, o.instant);
  renderWoods(L);
  $('#pSpecs').innerHTML = L.specs.map(([a, b]) => `<div><dt>${a}</dt><dd><bdi>${b}</bdi></dd></div>`).join('');
  setOdo($('#pPrice'), fmt(P.price), o.instant);
  $('#pPriceSr').textContent = `${fmt(P.price)} ${t('sar')}`;
  $('#pWas').innerHTML = P.was ? `${t('was')} <bdi>${fmt(P.was)}</bdi>` : '';
  $('#pNego').hidden = !P.nego;
  $('#pBuy').href = shopUrl(P.slug);
  $('#cNum').textContent = String(i + 1).padStart(2, '0');
  oudCanvas.setAttribute('aria-label', L.name);
  $$('.peg').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.i === i)));
}
function select(i, o = {}) {
  const was = state.cur;
  showProduct(i, o);
  if (!o.instant && !env.rm && was !== i) breathe();
  const k = keyOf(i, state.side);
  ribs.go(k, { dur: env.rm || o.instant ? 0 : 1.2, onRib }).then(() => { if (state.cur === i && was !== i) sound.course(PRODUCTS[i].course, 0.5); });
  [i - 1, i + 1].forEach((j) => { if (j >= 0 && j < PRODUCTS.length) load(keyOf(j, state.side)); });
}
let breathT = null;
function breathe() { if (breathT) breathT.kill(); breathT = tween({ dur: 1.25, ease: E.lin, update: (v) => { state.breath = Math.sin(Math.PI * v) * (1 - v * 0.3); }, done: () => { state.breath = 0; } }); }
function onRib(r) { if (r % 3 === 0) sound.play('tap', { rate: 1.5 + r * 0.03, gain: 0.16, gap: 0.025 }); }
function setTurnUi() {
  const b = $('#pTurn');
  b.setAttribute('aria-pressed', String(state.side === 'back'));
  $('#pTurnL').textContent = t(state.side === 'back' ? 'turn_front' : 'turn_back');
}
$('#pTurn').addEventListener('click', () => {
  state.side = state.side === 'back' ? 'front' : 'back';
  breathe();
  setTurnUi(); hotWoods();
  ribs.go(keyOf(state.cur, state.side), { dur: env.rm ? 0 : 1.2, onRib });
  sound.play('knock', { gain: 0.35 });
});

// ---------- strings ----------
const strings = new Strings($('#sCanvas'), (c) => sound.course(c, 0.45));
function buildSets() {
  $('#sets').innerHTML = SETS.map((s, i) => `<button class="sw" type="button" role="radio" aria-checked="${i === state.set}" data-i="${i}" style="--tre:${s.tre};--bass:${s.bass}" aria-label="${s[env.lang]}, ${s.price} ${t('sar')}"></button>`).join('');
  $$('#sets .sw').forEach((b) => b.addEventListener('click', () => chooseSet(+b.dataset.i)));
  showSet(state.set, true);
}
function showSet(i, instant) {
  const s = SETS[i];
  drum($('#setName'), s[env.lang], i >= (state.shownSet ?? i) ? 1 : -1, instant);
  state.shownSet = i;
  $('#setPrice').textContent = s.price;
  $('#setBuy').href = shopUrl(s.slug);
  $$('#sets .sw').forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.i === i)));
}
function chooseSet(i) {
  if (i === state.set) { strings.strum(); sound.strum(0.4); return; }
  state.set = i;
  showSet(i);
  strings.look(SETS[i], !env.rm, now);
  if (env.rm) return;
  sound.play('knock', { gain: 0.25 });
  setTimeout(() => sound.strum(0.4), (strings.restringEnd - now) * 1000);
}
strings.look(SETS[0], false, 0);
{
  const band = $('#sBand');
  let last = null;
  const at = (x, y) => { const r = band.getBoundingClientRect(); return [x - r.left, y - r.top]; };
  const move = (x, y) => { const p = at(x, y); if (last) strings.cross(last[0], last[1], p[0], p[1]); last = p; };
  band.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') move(e.clientX, e.clientY); });
  band.addEventListener('pointerleave', () => { last = null; });
  band.addEventListener('touchstart', (e) => { const q = e.touches[0]; last = at(q.clientX, q.clientY); }, { passive: true });
  band.addEventListener('touchmove', (e) => { const q = e.touches[0]; if (q) move(q.clientX, q.clientY); }, { passive: true });
  band.addEventListener('touchend', () => { last = null; });
}

// ---------- the bench: everything else lies on it with a paper tag ----------
// [x %, y %, size % of the lay width, rotation]
const LAY = {
  desk: { case: [21, 47, 40, -24], footrest: [77, 31, 27, 7], pickup: [80, 72, 19, 0],
    'risha-pearl': [47, 57, 25, -74], 'risha-silicone': [50, 57, 25, -62], 'risha-tortoise': [53, 57, 25, -50], 'risha-artistic': [56, 57, 25, -38] },
  phone: { case: [28, 12, 58, -14], footrest: [70, 35, 48, 8], pickup: [25, 40, 30, 0],
    'risha-pearl': [42, 70, 52, -74], 'risha-silicone': [46, 70, 52, -62], 'risha-tortoise': [50, 70, 52, -50], 'risha-artistic': [54, 70, 52, -38] },
};
const TAGS = {
  desk: { case: [22, 80, -2.2], kit: [79, 84, 1.6], rishas: [51, 80, 1] },
  phone: { case: [72, 5, 2], kit: [50, 48.5, -1.5], rishas: [50, 81, 1] },
};
function buildLay() {
  const lay = $('#lay'), L = LAY[env.phone ? 'phone' : 'desk'], G = TAGS[env.phone ? 'phone' : 'desk'];
  const objs = ITEMS.map((it, i) => { const p = L[it.img]; return `<a class="obj" data-k="${i}" href="${shopUrl(it.slug)}" target="_blank" rel="noopener" aria-label="${it[env.lang]}" style="--x:${p[0]};--y:${p[1]};--s:${p[2]};--r:${p[3]};--i:${i}"><img src="${juratArt(`bench/${it.img === 'footrest' ? 'footrest-top' : it.img}.webp`)}" alt="" width="560" height="560" loading="lazy"></a>`; }).join('');
  const line = (it, i) => `<li><a data-k="${i}" href="${shopUrl(it.slug)}" target="_blank" rel="noopener"><span>${it[env.lang]}</span><b><bdi>${it.price}</bdi><small>${t('sar')}</small></b></a></li>`;
  const tag = (key, title, list) => { const p = G[key]; return `<div class="paper ltag" data-g="${key}" style="--x:${p[0]};--y:${p[1]};--rot:${p[2]}deg"><p class="paper__k">${title}</p><ul>${list}</ul></div>`; };
  const items = ITEMS.map((it, i) => [it, i]);
  lay.innerHTML = objs
    + tag('case', t('g_kit'), items.filter(([it]) => it.img === 'case').map(([it, i]) => line(it, i)).join(''))
    + tag('kit', t('g_kit'), items.filter(([it]) => it.img === 'pickup' || it.img === 'footrest').map(([it, i]) => line(it, i)).join(''))
    + tag('rishas', t('g_rishas'), items.filter(([it]) => it.g === 'rishas').map(([it, i]) => line(it, i)).join(''));
  const on = (k) => {
    $$('.obj', lay).forEach((o) => o.classList.toggle('on', o.dataset.k === String(k)));
    $$('.ltag a', lay).forEach((o) => o.classList.toggle('on', o.dataset.k === String(k)));
    $$('.ltag', lay).forEach((g) => g.classList.toggle('on', !!$(`a[data-k="${k}"]`, g)));
    if (k != null) sound.play('tap', { gain: 0.12, rate: 1.2 + (+k) * 0.05, gap: 0.05 });
  };
  $$('.obj, .ltag a', lay).forEach((a) => {
    a.addEventListener('pointerenter', () => on(a.dataset.k)); a.addEventListener('focus', () => on(a.dataset.k));
    a.addEventListener('pointerleave', () => on(null)); a.addEventListener('blur', () => on(null));
  });
  revealIndex(lay);
}

// ---------- repair ----------
const rCanvas = $('#rCanvas');
const rRibs = new Ribs(rCanvas);
rRibs.shadowA = 0.55;
rRibs.show('1b');
rRibs.fx = { crack: 0, lift: 0, land: 0, glint: 0 };
let repairRun = 0;
function playRepair() {
  const run = ++repairRun, f = rRibs.fx;
  Object.assign(f, { crack: 0, lift: 0, land: 0, glint: 0 }); rRibs.dirty = true;
  setOdo($('#rPrice'), '000', true);
  if (env.rm) { Object.assign(f, { crack: 1, lift: 1, land: 1, glint: 1 }); rRibs.dirty = true; setOdo($('#rPrice'), '140', true); state.repair = 'done'; return; }
  state.repair = 'crack';
  const ok = () => run === repairRun;
  const tw = (k, dur, delay, ease, cb) => tween({ dur, delay, ease, update: (v) => { if (ok()) { f[k] = v; rRibs.dirty = true; } }, done: () => ok() && cb && cb() });
  sound.play('crack', { gain: 0.6, delay: 0.35 });
  tw('crack', 0.75, 0.35, E.out3, () => {
    state.repair = 'lift'; sound.play('knock', { gain: 0.45, delay: 0.25 });
    tw('lift', 0.85, 0.3, E.io3, () => {
      state.repair = 'land'; sound.play('tap', { gain: 0.4, delay: 0.62, rate: 1.1 });
      setOdo($('#rPrice'), '140');
      tw('land', 0.95, 0.15, E.lin, () => { tw('glint', 0.8, 0, E.lin, () => { state.repair = 'done'; }); });
    });
  });
}
$('#rAgain').addEventListener('click', playRepair);

// ---------- name in the rosette ----------
const rose = $('#rosette'), rctx = rose.getContext('2d');
let roseM = null, carveT = null;
function placeRosette() {
  const f = META.face || { cx: 0.5, cy: 0.5, r: 0.26 };
  const r = f.r * 0.985;
  Object.assign(rose.style, { left: `${(f.cx - r) * 100}%`, top: `${(f.cy - r) * 100}%`, width: `${r * 200}%`, height: `${r * 200}%` });
}
function carve(name, animate = true) {
  roseM = roseMask(name, 512, t('brand'));
  state.carve = name;
  if (carveT) carveT.kill();
  if (!animate || env.rm) { rosePaint(rctx, roseM, 1.01); return; }
  let lastTap = 0;
  carveT = tween({ dur: 1.7, ease: E.io3, update: (v) => {
    rosePaint(rctx, roseM, v * 1.01);
    if (v - lastTap > 0.09 && v < 0.97) { lastTap = v; sound.play('tap', { gain: 0.14, rate: 1.7 + Math.random() * 0.4, gap: 0.04 }); }
  }, done: () => sound.play('phrase', { gain: 0.55 }) });
}
function updateWA() {
  const n = ($('#nameIn').value || '').trim();
  $('#waBtn').href = `https://wa.me/${WA}?text=${encodeURIComponent(n ? t('wa_msg') + n : t('wa_plain'))}`;
}
{
  let to = null;
  $('#nameIn').addEventListener('input', () => { updateWA(); clearTimeout(to); to = setTimeout(() => carve($('#nameIn').value.trim()), 380); });
  $('#carve').addEventListener('submit', (e) => { e.preventDefault(); carve($('#nameIn').value.trim()); });
}

// ---------- sound ----------
function setSoundUi() {
  const b = $('#soundBtn');
  b.setAttribute('aria-pressed', String(sound.on));
  b.setAttribute('aria-label', t(sound.on ? 'sound_off_aria' : 'sound_on_aria'));
}
$('#soundBtn').addEventListener('click', async () => {
  await sound.unlock();
  sound.on = !sound.on; store('jf-sound', sound.on ? '1' : '0');
  setSoundUi();
  if (sound.on) { await sound.ready; sound.course(2, 0.5); }
});
const wantSound = store('jf-sound') === '1';
const unlockOnce = async () => { if (!wantSound || sound.ctx) return; await sound.unlock(); sound.on = true; setSoundUi(); };
addEventListener('pointerdown', unlockOnce, { passive: true });
addEventListener('keydown', unlockOnce);

// ---------- the wall: the plate laid like object-fit cover, his ouds hung on it ----------
const HOOK_F = 300 / 1520, BOT_FR = 1490 / 1520, BOWL_FR = 600 / 1520;   // in the oud frame: the hook, the bowl bottom, the bowl width
const hangs = { hero: [], close: [] };
let wallBox = null, closeBox = null;
function plateBox(P, w, h) {
  const s = Math.max(w / P.w, h / P.h);
  return { s, ox: (w - P.w * s) / 2, oy: (h - P.h * s) / 2, w: P.w * s, h: P.h * s, P };
}
function hangOuds(el, list, box, which) {
  // list: [{ i, x, hook, H }] in screen px of the frame; the cam sits at box.ox, box.oy
  el.innerHTML = list.map((o) => {
    const W = o.H * 720 / 1520, P = PRODUCTS[o.i];
    return `<button class="hang" type="button" data-i="${o.i}" tabindex="${which === 'hero' ? 0 : -1}" ${which === 'hero' ? '' : 'aria-hidden="true"'} aria-label="${t('hang_aria')}${P[env.lang].name}" style="left:${(o.x - W / 2 - box.ox).toFixed(1)}px;top:${(o.hook - o.H * HOOK_F - box.oy).toFixed(1)}px;width:${W.toFixed(1)}px;height:${o.H.toFixed(1)}px;--hy:${(HOOK_F * 100).toFixed(2)}%"><img src="${juratArt(`oud/oud${P.img}-h.webp`)}" alt="" width="360" height="760"><span class="hang__peg"></span></button>`;
  }).join('');
  hangs[which] = $$('.hang', el).map((b, k) => ({ el: b, th: 0, w: 0, drop: which === 'hero' && !env.rm && !state.landed ? 0 : 1, i: +b.dataset.i, k }));
  if (which !== 'hero') return;
  hangs.hero.forEach((h) => {
    h.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { h.w += 26; sound.course(PRODUCTS[h.i].course, 0.3); } });
    h.el.addEventListener('click', () => { h.w += 30; sound.course(PRODUCTS[h.i].course, 0.4); jumpTo(h.i); });
  });
}
function signBox() {
  const navB = env.phone ? 64 : 76;
  const w = env.phone ? Math.min(236, VW * 0.6) : Math.min(400, VW * 0.28);
  return { x: VW / 2 - w / 2, y: navB + (env.phone ? 2 : 6), w, h: w * 412 / 934 };
}
function layoutWall() {
  const P = env.phone ? META3.wallM : META3.wall;
  const box = wallBox = plateBox(P, VW, PH);
  Object.assign(wallCam.style, { width: box.w + 'px', height: box.h + 'px' });
  const src = juratArt(env.phone ? 'wall-m.webp' : 'wall.webp');
  if (!$('#wallPlate').src.endsWith(src)) $('#wallPlate').src = src;
  // his sign in the lamp light, the words under it; on a short screen the sign gives way so the words stay
  // above the mould
  box.bench = box.oy + P.bench * box.s;
  box.mould = P.mould.map((v, k) => (k % 2 ? box.oy : box.ox) + v * box.s);
  const hero = $('#hero');
  const sg = box.sign = signBox();
  const room = box.oy + (P.fg ? P.fg[1] : P.mould[1]) * box.s - 16 - (env.phone ? 4 : 10) - hero.offsetHeight - sg.y;
  if (sg.h > room) { const w = Math.max(150, room * 934 / 412); sg.x += (sg.w - w) / 2; sg.w = w; sg.h = w * 412 / 934; }
  Object.assign($('#sign').style, { left: (sg.x - box.ox) + 'px', top: (sg.y - box.oy) + 'px', width: sg.w + 'px', height: sg.h + 'px' });
  hero.style.top = (sg.y + sg.h + (env.phone ? 4 : 10)) + 'px';
  box.heroB = sg.y + sg.h + (env.phone ? 4 : 10) + hero.offsetHeight;
  hangOuds($('#hooks'), wallSlots(box, box.heroB, false), box, 'hero');
}
function wallSlots(box, clearB, centre) {
  const rtl = env.lang === 'ar';
  const flip = (x) => (rtl ? x : VW - x);
  const bowlB = box.bench - (env.phone ? 10 : 20);
  const out = [];
  if (!env.phone) {
    const colHalf = Math.max(box.sign.w, 470) / 2 + 26;
    const zoneW = VW / 2 - colHalf - VW * 0.035;
    let hook = 76 + 64;
    let H = (bowlB - hook) / (BOT_FR - HOOK_F);
    if (2 * H * BOWL_FR + 44 > zoneW) { H = (zoneW - 44) / 2 / BOWL_FR; hook = bowlB - H * (BOT_FR - HOOK_F); }
    const zc = VW - VW * 0.035 - zoneW / 2;          // the start side (right in Arabic)
    const gap = H * BOWL_FR / 2 + 22;
    [[1, zc + gap], [2, zc - gap], [3, VW - zc + gap], [4, VW - zc - gap]].forEach(([i, x]) => out.push({ i, x: flip(x), hook, H }));
    if (centre) out.push({ i: 0, x: VW / 2, hook, H });
  } else {
    const [mx0, , mx1] = box.mould;
    const room = Math.min(mx0 - 8, VW - mx1 - 8);
    const H = Math.min((room - 6) / BOWL_FR, (bowlB - clearB - 16) / (BOT_FR - HOOK_F));
    const hook = bowlB - H * (BOT_FR - HOOK_F);
    out.push({ i: 1, x: flip(VW - (VW - mx1) / 2 - 2), hook, H }, { i: 2, x: flip(mx0 / 2 + 2), hook, H });
    if (centre) {
      const cH = Math.min((bowlB + 24 - clearB - 20) / (BOT_FR - HOOK_F), (mx1 - mx0) * 0.9 / BOWL_FR);
      out.push({ i: 0, x: VW / 2, hook: bowlB + 24 - cH * (BOT_FR - HOOK_F), H: cH });
    }
  }
  return out;
}
function layoutClose() {
  const P = env.phone ? META3.wallM : META3.wall;
  const ph = $('.close__pin').clientHeight || VH;
  const box = closeBox = plateBox(P, VW, ph);
  const cam = $('#closeCam');
  Object.assign(cam.style, { width: box.w + 'px', height: box.h + 'px', transform: `translate(${box.ox}px, ${box.oy}px)` });
  const src = juratArt(env.phone ? 'wall-m.webp' : 'wall.webp');
  if (!$('#closePlate').src.endsWith(src)) $('#closePlate').src = src;
  box.bench = box.oy + P.bench * box.s;
  box.mould = P.mould.map((v, k) => (k % 2 ? box.oy : box.ox) + v * box.s);
  // the sign: on a wide screen it sits on the closing words and the wall above is all ouds, his Razeen in the
  // middle; on a phone it goes back up on the wall where the hero had it, the Razeen under it
  const sg = signBox(), fm = $('#footMark');
  let clearB;
  if (env.phone) { box.sign = sg; clearB = sg.y + sg.h; fm.style.top = sg.y + 'px'; fm.style.width = sg.w + 'px'; }
  else {
    box.sign = { x: VW / 2, y: 76, w: 0, h: 0 }; clearB = 86;
    const sw = Math.min(250, VW * 0.18);
    fm.style.width = sw + 'px';
    fm.style.top = (ph - $('#closeIn').offsetHeight - Math.max(26, ph * 0.05) - sw * 412 / 934 - 10) + 'px';
  }
  const hooksEl = $('#closeHooks');
  hangOuds(hooksEl, wallSlots(box, clearB, true), box, 'close');
  // the mould stands in front of the oud that was built on it
  const fg = P.fg;
  if (fg) hooksEl.insertAdjacentHTML('beforeend', `<img class="fg" src="${juratArt(env.phone ? 'wall-m-fg.webp' : 'wall-fg.webp')}" alt="" loading="lazy" style="position:absolute;left:${fg[0] * box.s}px;top:${fg[1] * box.s}px;width:${(fg[2] - fg[0]) * box.s}px;height:${(fg[3] - fg[1]) * box.s}px">`);
}

// ---------- layout ----------
let VH = innerHeight, VW = innerWidth, PH = innerHeight, storeTop = 0, footTop = 0, lastW = innerWidth;
const viewH = () => (window.__gwvh && window.__gwvh.on ? window.__gwvh.vh * 100 : innerHeight);
const FRAME_W = META.frame[0] + 2 * PAD, FRAME_H = META.frame[1] + 2 * PAD;
const J1 = META.ouds[1].back.joint, BOT = META.bottom;
const TOP_F = (Math.min(...Object.values(META.ouds).map((o) => o.front.top)) + PAD) / FRAME_H;
const BOT_F = (BOT + PAD + 6) / FRAME_H;
const BOWL0 = (J1 + PAD - 4) / FRAME_H;
let boxes = null, canvasH = 0, fanFill = '#131C30';
function layoutStage() {
  const rtl = env.lang === 'ar';
  const side = (f) => (rtl ? VW * f : VW * (1 - f));
  const navB = env.phone ? 64 : 76;
  const bf = BOT_F - BOWL0;
  let hB = (env.phone ? PH * 0.55 : PH * 0.8) / bf;
  hB = Math.min(hB, VW * (env.phone ? 0.86 : 0.62) * FRAME_H / 612);
  const build = { cx: VW / 2, top: (env.phone ? PH * 0.5 : PH * 0.53) - (BOWL0 + bf / 2) * hB, h: hB };
  // the whole oud; on a phone it stands between the two words
  const fTop = env.phone ? navB + 86 : navB + 6, fBot = env.phone ? PH - 150 : PH - 20;
  const hF = (fBot - fTop) / (BOT_F - TOP_F);
  const full = { cx: VW / 2, top: fTop - TOP_F * hF, h: hF };
  let shop;
  if (!env.phone) {
    const hS = Math.min((PH - 26 - (navB + 6)) / (BOT_F - TOP_F), 1400);
    shop = { cx: side(0.32), top: navB + 6 - TOP_F * hS, h: hS };
  } else {
    const railH = $('#rail').offsetHeight + 10;
    const wordsTop = PH - railH - 14 - shopMaxH();
    $('#shop').style.top = Math.round(wordsTop) + 'px';
    const top = 70, bot = wordsTop - 8;
    const hS = (bot - top) / (BOT_F - TOP_F);
    shop = { cx: VW / 2, top: top - TOP_F * hS, h: hS };
  }
  boxes = { build, full, shop };
  // the two words on the bench fit the bench beside the bowl (English runs longer than Arabic)
  $$('.bw').forEach((el) => {
    el.style.fontSize = '';
    if (env.phone) return;
    const avail = VW / 2 - 302 * Math.max(build.h, full.h) / FRAME_H - (VW * 0.05) - 28;
    const w = el.firstElementChild.offsetWidth, fs = parseFloat(getComputedStyle(el).fontSize);
    if (w > avail) el.style.fontSize = (fs * avail / w).toFixed(1) + 'px';
  });
  canvasH = Math.max(build.h, full.h, shop.h);
  ribs.resize(canvasH, Math.min(DPR, (env.phone ? 1500 : 2100) / canvasH));
  makeFlyers();
}
function shopMaxH() {
  const c = $('#shop').cloneNode(true);
  c.removeAttribute('id'); $$('[id]', c).forEach((e) => e.removeAttribute('id'));
  c.style.cssText = 'visibility:hidden;top:0';
  pin.appendChild(c);
  let m = 0;
  PRODUCTS.forEach((P) => {
    const L = P[env.lang];
    $('.pname .drum', c).textContent = L.name;
    $('.woods', c).innerHTML = L.woods.map(([k, v]) => `<li><b>${t(k)}</b> ${v}</li>`).join('');
    m = Math.max(m, c.offsetHeight);
  });
  c.remove();
  return m;
}
const mix = (a, b, m) => ({ cx: lerp(a.cx, b.cx, m), top: lerp(a.top, b.top, m), h: lerp(a.h, b.h, m) });
// the shop ground is the wall above the bench, a touch darker than the lit hero
function makeGround() {
  const img = $('#wallPlate');
  if (!img.complete || !img.naturalWidth || !fan.c.width) { fanFill = '#131C30'; return; }
  const P = env.phone ? META3.wallM : META3.wall;
  const c = document.createElement('canvas');
  c.width = fan.c.width; c.height = fan.c.height;
  const x = c.getContext('2d');
  const sh = P.bench * 0.84, s = Math.max(c.width / P.w, c.height / sh);
  const iw = img.naturalWidth / P.w;
  x.drawImage(img, ((P.w - c.width / s) / 2) * iw, ((sh - c.height / s) / 2) * iw, (c.width / s) * iw, (c.height / s) * iw, 0, 0, c.width, c.height);
  x.fillStyle = 'rgba(13,19,34,.38)'; x.fillRect(0, 0, c.width, c.height);
  fanFill = fan.x.createPattern(c, 'no-repeat');
  fan.t = -1;
}
function measure() {
  VH = viewH(); VW = innerWidth;
  env.phone = VW < 760;
  PH = pin.clientHeight || VH;
  $('#shop').style.top = '';
  story.style.height = Math.round((LEN() + 1) * VH) + 'px';
  storeTop = story.offsetTop;
  layoutWall();
  layoutStage();
  fan.resize(VW, PH, Math.min(DPR, 1.5));
  makeGround();
  cover.resize(VW, PH, Math.min(DPR, env.touch ? 1.25 : 1.5));
  const band = $('#sBand'); strings.resize(band.clientWidth, band.clientHeight, DPR);
  const rh = env.phone ? Math.min(VH * 0.6, 500) : Math.min(VH * 0.82, 800);
  rRibs.resize(rh, DPR);
  placeRosette();
  layoutClose();
  footTop = $('#foot').offsetTop;
  lastW = VW;
  apply(true);
}

// ---------- the build: every rib in flight is its own canvas ----------
const flyers = [];
function makeFlyers() {
  if (!loaded('1b') || !canvasH) return;
  const s = oudCanvas.width / FRAME_W, u = canvasH / FRAME_H;
  for (let r = 0; r < PIECES; r++) {
    let f = flyers[r];
    if (!f) { const c = document.createElement('canvas'); flyersEl.appendChild(c); f = flyers[r] = { c, on: false }; }
    const pc = ribs.piece('1b', r, s, f.c);
    if (!pc) continue;
    f.L = (pc.x0 + PAD) * u; f.T = (pc.y0 + PAD) * u; f.W = (pc.x1 - pc.x0) * u; f.H = (pc.y1 - pc.y0) * u;
    f.side = pc.neck ? 0 : Math.sign(pc.i - (RIBS - 1) / 2);
    Object.assign(f.c.style, { left: f.L + 'px', top: f.T + 'px', width: f.W + 'px', height: f.H + 'px' });
  }
}
function fly(ks, box, sc) {
  const w = canvasH * FRAME_W / FRAME_H, tx = box.cx - w * sc / 2, ty = box.top;
  for (let r = 0; r < flyers.length; r++) {
    const f = flyers[r]; if (!f || f.W == null) continue;
    const k = ks ? ks[r] : 0;
    const on = !!ks && k > 0 && k < 1 && !env.rm;
    if (f.on !== on) { f.on = on; f.c.style.visibility = on ? 'visible' : 'hidden'; }
    if (!on) continue;
    const rx = tx + (f.L + f.W / 2) * sc, ry = ty + (f.T + f.H / 2) * sc;
    let sx, sy, rot0;
    if (f.side < 0) { sx = -f.W * sc - VW * 0.08; sy = ry - PH * 0.16; rot0 = -0.5; }
    else if (f.side > 0) { sx = VW + f.W * sc + VW * 0.08; sy = ry - PH * 0.16; rot0 = 0.5; }
    else { sx = rx; sy = -f.H * sc * 0.6; rot0 = 0.06; }
    const e = E.out3(k), arc = Math.sin(Math.PI * k);
    const dx = (sx - rx) * (1 - e) / sc, dy = ((sy - ry) * (1 - e) - arc * 46) / sc;
    const rot = rot0 * (1 - E.out3(clamp(k * 1.12)));
    f.c.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${rot.toFixed(4)}rad) scale(${(1 + arc * 0.06).toFixed(4)})`;
  }
}

// ---------- the story ----------
const heroLines = $$('#hero .ln > *');
const shopLines = $$('#shop .ln > *');
const bw1 = $('.bw--1 > span'), bw2 = $('.bw--2 > span'), bsub = $('.bsub > span');
const tfCache = new WeakMap();
const setTf = (el, v) => { if (tfCache.get(el) !== v) { tfCache.set(el, v); el.style.transform = v; } };
const setOp = (el, v) => { const k = 'o' + v; if (el._o !== k) { el._o = k; el.style.opacity = v; } };
const setVis = (el, on) => { const v = on ? 'visible' : 'hidden'; if (el._v !== v) { el._v = v; el.style.visibility = v; } };
const parallax = { x: 0, y: 0 };
const vis = { strings: false, repair: false, close: false };
function apply(force) {
  if (!boxes || !wallBox) return;
  const y = scrollY;
  const s = (y - storeTop) / VH;
  const d = seg(s, AT.dive, AT.dive + TL.dive);
  const b = seg(s, AT.build, AT.build + TL.build);
  let u = seg(s, AT.turn, AT.turn + TL.turn);
  const e = seg(s, AT.exit, AT.exit + TL.exit);
  if (env.rm) u = u > 0.5 ? 1 : 0;
  state.uTurn = u; state.b = b; state.d = d; state.e = e;
  let z = s < AT.zones ? -1 : clamp(Math.floor((s - AT.zones) / TL.zone), 0, 4);
  if (state.jumping != null) z = state.jumping;

  // the dive: the camera pushes into the mould, the ribs close over the screen and open on the bench from above
  const atBench = env.rm ? d >= 0.5 : d >= 0.6;
  const inStrings = e >= 0.5;
  let ct = 0;
  if (!env.rm) {
    if (s < AT.build + 0.2) ct = d < 0.18 ? 0 : d < 0.6 ? seg(d, 0.18, 0.6) : 1 + seg(d, 0.6, 0.97);
    else if (s >= AT.exit - 0.1 && s < AT.strings + 0.2) ct = e < 0.5 ? seg(e, 0.04, 0.5) : 1 + seg(e, 0.5, 0.94);
  }
  if (ct >= 2) ct = 0;
  if (ct > 0 && ct < 2 && state.ct < 0.02 && state.ready) sound.play('swish', { gain: 0.3, gap: 0.6 });
  state.ct = ct;
  cover.draw(ct);
  const zoom = 1 + 1.7 * E.in3(seg(d, 0, 0.62));
  const P = wallBox.P;
  const mx = (P.mould[0] + P.mould[2]) / 2 * wallBox.s, my = (P.mould[1] + P.mould[3]) / 2 * wallBox.s;
  const px = parallax.x * (1 - seg(d, 0, 0.3)), py = parallax.y * (1 - seg(d, 0, 0.3));
  setVis($('#wall'), !atBench);
  if (!atBench) setTf(wallCam, `translate(${(wallBox.ox + mx * (1 - zoom) + px * 10).toFixed(1)}px, ${(wallBox.oy + my * (1 - zoom) + py * 6).toFixed(1)}px) scale(${zoom.toFixed(4)})`);
  setOp(wallLamp, state.lamp.toFixed(3));
  html.classList.toggle('atwall', s < AT.dive + TL.dive * 0.25);
  // over the lit bench the section links step aside; the words on the bench are the only words
  html.classList.toggle('quiet', s > AT.dive + TL.dive * 0.25 && s < AT.turn + TL.turn * 0.6);

  // the words of the hero rise in once, then leave as the camera moves
  heroLines.forEach((el, i) => {
    const inK = E.expo(seg(state.heroIn, i * 0.09, i * 0.09 + 0.55));
    const outK = E.in3(seg(d, i * 0.04, i * 0.04 + 0.24));
    setTf(el, `translateY(${((1 - inK) * 110 - outK * 115).toFixed(2)}%)`);
  });
  setVis($('#hero'), d < 0.4);
  setOp($('#hint'), (state.landed ? (1 - seg(s, 0.02, 0.2)) * clamp(state.heroIn * 1.4 - 0.4) : 0).toFixed(3));

  // the build words flank the bench
  const wIn = E.expo(seg(d, 0.66, 1)), wOut = E.in3(seg(u, 0, 0.28));
  const wx = (1 - wIn) * 60 + wOut * 60;
  const side1 = env.lang === 'ar' ? 1 : -1;
  if (env.phone) {
    setTf(bw1, `translateY(${(-(1 - wIn) * 110 - wOut * 110).toFixed(1)}%)`);
    setTf(bw2, `translateY(${((1 - wIn) * 110 + wOut * 110).toFixed(1)}%)`);
  } else {
    setTf(bw1, `translateX(${(side1 * wx).toFixed(2)}vw)`);
    setTf(bw2, `translateX(${(-side1 * wx).toFixed(2)}vw)`);
  }
  setTf(bsub, `translateY(${((1 - wIn) * 140 + wOut * 140).toFixed(1)}%)`);
  setVis($('#build'), d > 0.6 && u < 0.3);

  // the oud: built on the mould, pulled back to, turned over, carried to the shop
  let box;
  const br = state.breath || 0;
  if (s < AT.turn) box = env.rm ? (b > 0.3 ? boxes.full : boxes.build) : mix(boxes.build, boxes.full, E.io3(seg(b, PULL0, 1)));
  else box = mix(boxes.full, boxes.shop, E.io3(seg(u, 0.12, 0.92)));
  const lift = s >= AT.turn && s < AT.zones ? Math.sin(Math.PI * seg(u, 0, 0.75)) * 0.045 : 0;
  const sc0 = box.h / canvasH, sc = sc0 * (1 - br * 0.025) * (1 + lift);
  const w = canvasH * FRAME_W / FRAME_H;
  setTf(stageEl, `translate(${(box.cx - w * sc / 2).toFixed(1)}px, ${(box.top - (sc - sc0) * canvasH * 0.55 + box.h * br * 0.0125 - br * 10).toFixed(1)}px) scale(${sc.toFixed(4)})`);
  setVis(stageEl, atBench && !inStrings);

  // the wall of the shop fans out from the neck joint, rib by rib
  const fanT = s < AT.turn ? 0 : seg(u, 0.1, 0.86);
  state.fanT = fanT;
  setVis(benchTop, atBench && fanT < 1 && !inStrings);
  const jy = box.top + (META.ouds[1].joint + PAD) / FRAME_H * box.h;
  fan.draw(fanT, box.cx, jy, fanFill);
  setVis(fan.c, fanT > 0 && !inStrings);
  ribs.shadowA = s < AT.turn ? 0.42 : lerp(0.42 + lift * 3, 0.5, fanT);

  if (state.landed) {
    if (s < AT.turn) {
      if (state.zone >= 0 || force) {
        if (state.side !== 'front') { state.side = 'front'; setTurnUi(); hotWoods(); }
        if (state.cur !== 0) showProduct(0, { instant: true });
      }
      const ks = env.rm ? new Array(PIECES).fill(b > 0.3 ? 2 : 0) : buildKs(b);
      if (ribs.a !== '1b' || ribs.b) ribs.show('1b');
      ribs.setBuild(ks);
      fly(atBench ? ks : null, box, sc);
      let n = 0; for (let r = 0; r < PIECES; r++) if (ks[r] >= 1) n++;
      if (n > state.landedRibs && !force && atBench) sound.play('tap', { rate: 1.25 + n * 0.025, gain: 0.24, gap: 0.03 });
      state.landedRibs = n;
      z = -2;
    } else {
      fly(null, box, sc);
      if (z < 0) {
        if (state.zone >= 0 || force) {
          if (state.side !== 'front') { state.side = 'front'; setTurnUi(); hotWoods(); }
          if (state.cur !== 0) showProduct(0, { instant: force });
          if (!force && state.zone >= 0 && ribs.shown !== '1f') { state.back = true; ribs.go('1f', { dur: env.rm ? 0 : 0.9, onRib }).then(() => { state.back = false; }); }
        }
        if (!(state.back && ribs.busy)) ribs.scrub('1b', '1f', E.lin(seg(u, 0.04, 0.8)));
      } else if (z !== state.zone) {
        select(z, { instant: force && state.zone < 0 && z === 0 });
      }
    }
  }
  state.zone = z;

  // the shop words push in, the rail drops in
  shopLines.forEach((el, i) => {
    const k = E.expo(seg(u, 0.58 + i * 0.045, 0.9 + i * 0.045));
    setTf(el, `translateY(${((1 - k) * 112).toFixed(2)}%)`);
  });
  const rail = $('#rail');
  const pk = E.expo(seg(u, 0.72, 1));
  setTf(rail, `translateY(${((1 - pk) * 160).toFixed(1)}px)`);
  setVis(rail, pk > 0.01 && !inStrings);
  rail.style.pointerEvents = u > 0.9 ? 'auto' : 'none';
  $('#shop').classList.toggle('live', u > 0.9 && !inStrings);
  setVis($('#shop'), u > 0.5 && !inStrings);

  // the strings
  setVis(stringsScene, inStrings);
  vis.strings = inStrings && (ct >= 1.5 || env.rm || ct === 0);
  if (inStrings && !state.strummed && state.ready && (ct >= 1.85 || env.rm || ct === 0)) { state.strummed = true; setTimeout(() => { strings.strum(); sound.strum(0.35); }, 120); }

  // the nav reads what is under it
  const storyEnd = storeTop + LEN() * VH;
  html.classList.toggle('day', inStrings && !env.phone && y < storyEnd + VH * 0.5);
  html.classList.toggle('bar', y > storyEnd + VH * 0.9 && y < footTop - VH * 0.4);
  applyClose();
}
if (window.ResizeObserver) new ResizeObserver(() => { footTop = $('#foot').offsetTop; }).observe($('#main'));
const zoneY = (i) => storeTop + (AT.zones + TL.zone * (i + 0.5)) * VH;
const stringsY = () => storeTop + (AT.strings + 0.15) * VH;
function jumpTo(i) {
  if (i === state.cur && state.zone >= 0) return;
  if (state.zone >= 0) { state.jumping = i; select(i); state.zone = i; }
  scrollToY(zoneY(i), () => { state.jumping = null; });
}

// ---------- the close: back at the wall, the lamp goes off ----------
const closeLamp = $('#closeLamp');
function applyClose() {
  const c = (scrollY - footTop) / VH;
  if (c < -1.05) return;
  const off = c > 0.28;
  if (off !== state.lampOff) {
    state.lampOff = off;
    html.classList.toggle('lampoff', off);
    if (state.ready) sound.play('switch', { gain: 0.6 });
  }
  setOp(closeLamp, off ? '0.8' : '0');
  hangs.close.forEach((h) => { if (h.i === 0) h.drop = env.rm ? 1 : seg(c, -0.7, -0.05); });
}

// ---------- scroll ----------
let lenis = null;
function scrollToY(y, done) {
  if (lenis) lenis.scrollTo(y, { duration: env.rm ? 0 : 1.6, immediate: env.rm, onComplete: () => done && done() });
  else {
    window.scrollTo({ top: y, behavior: env.rm ? 'auto' : 'smooth' });
    if (done) { let n = 0; const chk = () => { if (Math.abs(scrollY - y) < 2 || ++n > 140) done(); else setTimeout(chk, 50); }; chk(); }
  }
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href').slice(1);
  e.preventDefault();
  if (id === 'top') return scrollToY(0);
  if (id === 'shop') return scrollToY(zoneY(0) - TL.zone * VH * 0.45);
  if (id === 'strings') return scrollToY(stringsY());
  const el = document.getElementById(id); if (!el) return;
  scrollToY(el.getBoundingClientRect().top + scrollY);
}));
addEventListener('scroll', () => { if (!lenis) apply(); }, { passive: true });
addEventListener('resize', () => {
  if (env.touch && Math.abs(innerWidth - lastW) < 2) { PH = pin.clientHeight || VH; layoutStage(); fan.resize(VW, PH, Math.min(DPR, 1.5)); makeGround(); apply(true); return; }
  measure();
});
$('#langBtn').addEventListener('click', () => {
  env.lang = env.lang === 'ar' ? 'en' : 'ar';
  store('jf-lang', env.lang);
  applyLang(); measure();
  if (state.carve === '') carve('', false);
});

// ---------- reveals ----------
function revealIndex(root) { $$('.ln > *, .obj, .ltag', root).forEach((el, i) => el.style.setProperty('--i', i)); }
$$('.rv').forEach(revealIndex);
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }), { threshold: 0.15 });
$$('.rv').forEach((el) => io.observe(el));
new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting && !state.carved && state.ready && !$('#nameIn').value) { state.carved = true; carve('', true); }
}), { threshold: 0.5 }).observe($('#face'));
{
  const o = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.target.id === 'repair') { vis.repair = e.isIntersecting; if (e.isIntersecting && state.repair === 'idle') playRepair(); if (!e.isIntersecting && e.boundingClientRect.top > 0) state.repair = 'idle'; }
    if (e.target.id === 'foot') { vis.close = e.isIntersecting; if (e.isIntersecting) $('#footMark').classList.add('on'); }
  }), { threshold: 0.2 });
  o.observe($('#repair')); o.observe($('#foot'));
}

// ---------- the loop ----------
let now = 0, lastTs = 0;
const pointer = { x: 0.5, y: 0.5, live: false };
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { pointer.x = e.clientX / VW; pointer.y = e.clientY / VH; pointer.live = true; } }, { passive: true });
// the ouds swing on their hooks: a damped spring, nudged by the pointer and by landing
function swing(list, dt, idle) {
  list.forEach((h, k) => {
    h.w += (-30 * h.th - 1.6 * h.w) * dt;
    h.th += h.w * dt;
    const a = h.th + (idle ? Math.sin(now * 0.7 + k * 1.7) * 0.35 : 0);
    const dy = (1 - E.back(clamp(h.drop), 1.6)) * -90;
    setTf(h.el, `translateY(${dy.toFixed(1)}px) rotate(${a.toFixed(3)}deg)`);
    setOp(h.el, h.drop > 0 ? '1' : '0');
  });
}
let live = true;
function frame(ts) {
  if (!live) return;
  now = ts / 1000;
  const dt = Math.min(0.05, lastTs ? now - lastTs : 0.016); lastTs = now;
  if (lenis) lenis.raf(ts);
  step(ts);
  if (pointer.live && !env.touch) { parallax.x = lerp(parallax.x, (pointer.x - 0.5) * -2, 0.06); parallax.y = lerp(parallax.y, (pointer.y - 0.5) * -2, 0.06); }
  apply();
  if (state.d < 0.62) { swing(hangs.hero, dt, true); setTf($('#hooks'), `translate(${(parallax.x * 6).toFixed(1)}px, ${(parallax.y * 4).toFixed(1)}px)`); }
  if (vis.close) {
    const it = hangs.close.find((h) => h.i === 0);
    if (it && it.drop >= 1 && !it.hung) { it.hung = true; it.w += 40; sound.play('knock', { gain: 0.3 }); }
    if (it && it.drop < 0.5) it.hung = false;
    swing(hangs.close, dt, true);
  }
  ribs.draw();
  if (vis.strings) { strings.step(now, dt); strings.draw(); }
  rRibs.draw();
  requestAnimationFrame(frame);
}

// ---------- boot: the mark writes itself on the dark wall, the lamp comes on, the mark becomes the sign ----------
function imgReady(im) { return im.complete && im.naturalWidth ? Promise.resolve() : new Promise((r) => { im.addEventListener('load', () => r(), { once: true }); im.addEventListener('error', () => r(), { once: true }); }); }
async function boot() {
  applyLang();
  measure();
  const mark = $('#mark'), count = $('#count'), loader = $('#loader');
  requestAnimationFrame(() => mark.classList.add('on'));
  const t0 = performance.now();
  const tasks = [document.fonts ? document.fonts.ready : Promise.resolve(), imgReady($('#wallPlate')), load('1b'), load('1f'), loadMould(), cover.load(), ...$$('img', mark).map(imgReady), ...$$('#hooks img').map(imgReady)];
  let done = 0; tasks.forEach((p) => p.then(() => { done++; }));
  let shown = 0;
  const tick = () => { const target = (done / tasks.length) * 100; shown = Math.min(target, shown + 2.4); count.textContent = Math.round(shown); if (!state.landed) requestAnimationFrame(tick); };
  tick();
  await Promise.race([Promise.all(tasks), new Promise((r) => setTimeout(r, 7000))]);
  const minT = env.rm ? 0 : 1700;
  await new Promise((r) => setTimeout(r, Math.max(0, minT - (performance.now() - t0))));
  count.textContent = '100';
  measure();
  carve('', false);
  // the lamp warms the wall while the mark flies up onto it
  const to = $('#sign').getBoundingClientRect(), from = mark.getBoundingClientRect();
  const sx = to.width / from.width;
  loader.classList.add('gone');
  if (!env.rm) {
    mark.style.transition = 'transform 1.15s cubic-bezier(.7,0,.2,1)';
    mark.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${sx})`;
    tween({ dur: 1.6, ease: E.io3, update: (v) => { state.lamp = 1 - v; } });
    hangs.hero.forEach((h, k) => tween({ dur: 0.95, delay: 0.75 + k * 0.14, ease: E.lin, update: (v) => { h.drop = v; }, done: () => { h.w += 24; sound.play('tap', { gain: 0.15, rate: 0.9 + k * 0.08 }); } }));
    tween({ dur: 1.5, delay: 0.95, ease: E.lin, update: (v) => { state.heroIn = v; } });
  } else {
    state.lamp = 0; state.heroIn = 1; hangs.hero.forEach((h) => { h.drop = 1; });
  }
  const land = () => { html.classList.add('landed'); loader.style.display = 'none'; };
  setTimeout(land, env.rm ? 0 : 1180);
  state.landed = true;
  state.ready = true;
  makeGround();
  makeFlyers();
  apply(true);
}

// ---------- QA hooks ----------
const api = {
  get ready() { return state.ready; },
  state: () => ({ zone: state.zone, cur: state.cur, side: state.side, shown: ribs.shown, busy: ribs.busy, lang: env.lang, sound: sound.on, d: state.d, b: state.b, uTurn: state.uTurn, e: state.e, fanT: state.fanT, ct: state.ct, landedRibs: state.landedRibs, set: state.set, carve: state.carve, repair: state.repair, lampOff: state.lampOff, landed: html.classList.contains('landed'), loaderGone: html.classList.contains('landed'), day: html.classList.contains('day'), building: !!ribs.ks }),
  setScroll: (y) => { if (lenis) lenis.scrollTo(y, { immediate: true }); window.scrollTo(0, y); apply(true); },
  // for the shared rigs (library/_qa): story fraction and the loader hand over
  setP: (p) => api.setScroll(storeTop + p * LEN() * VH),
  AT, TL, VH: () => VH, len: LEN, storeTop: () => storeTop, footTop: () => footTop,
  at: (phase, f = 0) => storeTop + (AT[phase] + (TL[phase] || 0) * f) * VH,
  zoneY, stringsY, pick: jumpTo, chooseSet, carve, playRepair,
  oudRect: () => {
    const r = oudCanvas.getBoundingClientRect(), bb = ribs.bounds(); if (!bb) return null;
    const sx = r.width / bb.fw, sy = r.height / bb.fh;
    // while the bowl is being built the neck is not on yet: the oud ends at the joint
    if (ribs.ks && !(ribs.ks[RIBS] >= 1)) bb.y0 = META.ouds[1].back.joint;
    return { left: r.left + (bb.x0 + bb.pad) * sx, right: r.left + (bb.x1 + bb.pad) * sx, top: r.top + (bb.y0 + bb.pad) * sy, bottom: r.top + (bb.y1 + bb.pad) * sy };
  },
};

if (!env.touch && !env.rm) {
  lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', () => apply());
}
requestAnimationFrame(frame);
boot();
root.__jurat = api;
return function cleanup() {
  live = false;
  if (lenis && lenis.destroy) lenis.destroy();
  sound.on = false;
  try { if (sound.ctx) sound.ctx.close(); } catch (e) {}
};

}
