/* eslint-disable */
import { PERSONNE_ASSETS as A } from "./assets.js"
/* PERSONNE rail: six pieces on hangers on one nickel rod, drawn in a single 2D canvas
   (one GPU layer, see android-gpu-tile-budget). Each piece is a damped pendulum hanging
   from its hook tip.
   The rod stays exactly under the finger, but the hooks feel its motion through a soft
   filter, the way a heavy rod on a real rail moves: uneven pointer events never reach the
   cloth as jolts. The hem trails the rod (it starts late and runs on when the rod stops),
   a cursor brushing through the cloth pushes the hem along with it, and big swings meet
   air drag and a soft stop instead of a wall. A let go glides into the nearest slot. */
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* tuning, in screen px and seconds (a coat is about a metre long at ~400 px) */
  var G = 2600;            // gravity
  var HOOK_W = 7.5;        // rad/s: the hooks feel the rod's acceleration through this low pass
  var DRIVE = 0.21;        // how much of that acceleration reaches the cloth: a heavy rail, not a whip
  var ZETA = 0.3;          // linear damping ratio (hook friction, the cloth's own stiffness)
  var AIR = 1.6;           // quadratic air drag: a big swing loses most of itself in one pass
  var SOFT = 0.2, WALL = 150, HARD = 0.46;  // rad: past SOFT a stiffening return, HARD a dead stop
  var BRUSH = 0.0034, BRUSH_MAX = 1400;     // a cursor brushing through the cloth
  var FRICTION = 4.4;      // 1/s: how quickly a fling would slow, used to project where it lands
  var GLIDE_W = 7.2;       // rad/s: the glide into a slot (critically damped, never bounces)
  var STEP = 1 / 120;      // fixed sub step: the same swing at 60, 90 and 120 Hz
  var SPRITES = typeof window.createImageBitmap === 'function';

  function Rail(opts) {
    this.cv = opts.canvas; this.ctx = this.cv.getContext('2d');
    this.box = opts.box; this.tags = opts.tags; this.pieces = opts.pieces; this.imgs = opts.imgs;
    this.onPick = opts.onPick; this.onCount = opts.onCount; this.fmt = opts.fmt;
    this.items = this.pieces.map(function (p, i) {
      var m = A.pieces[p.key];
      // each piece carries its weight a little differently
      return { i: i, key: p.key, m: m, img: opts.imgs[i], th: 0, om: 0, lift: 0, liftV: 0, hidden: false, alpha: null, shadow: null, x: 0,
        drive: 0.9 + 0.2 * ((i * 0.618) % 1), wk: 0.92 + 0.16 * ((i * 0.381 + 0.2) % 1), sprite: null, spriteKey: '' };
    });
    this.drag = 0; this.dragV = 0; this.target = null; this.raw = 0;
    this.scrollOff = 0; this.X = null; this.xf = 0; this.vf = 0; this.af = 0; this.lastStep = 0;
    this.pointer = { x: -1e4, y: -1e4, vx: 0, inside: false, id: null, down: false, moved: 0, t0: 0, lastX: 0, lastT: 0, samples: [] };
    this.hover = -1; this.count = -1; this.dirty = true;
    this.build();
    this.bind();
  }

  Rail.prototype.build = function () {
    var self = this;
    this.tags.innerHTML = '';
    this.items.forEach(function (it) {
      var p = self.pieces[it.i];
      var li = document.createElement('li');
      li.className = 'rail-tag';
      li.innerHTML = '<button type="button" class="tag" data-i="' + it.i + '">' +
        '<span class="tag-no">No. ' + p.key + '</span>' +
        '<span class="tag-name">' + p.name + '</span>' +
        '<span class="tag-cloth">' + p.cloth + '</span>' +
        '<span class="tag-price">' + self.fmt(p.price) + '</span>' +
        '<span class="tag-try">Try it on</span></button>';
      self.tags.appendChild(li);
      it.tag = li;
      li.querySelector('button').addEventListener('click', function () { self.pick(it.i); });
      li.querySelector('button').addEventListener('focus', function () { self.showItem(it.i); });
      // shadow + hit map, made once from the photograph's alpha
      var img = it.img, w = it.m.w, h = it.m.h, q = 4;
      var c = document.createElement('canvas'); c.width = Math.ceil(w / q); c.height = Math.ceil(h / q);
      // a CPU canvas (willReadFrequently): reading it back no longer waits on a GPU decode
      var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, c.width, c.height);
      try { it.alpha = x.getImageData(0, 0, c.width, c.height).data; it.aw = c.width; it.ah = c.height; } catch (e) { it.alpha = null; }
      var s = document.createElement('canvas'); s.width = c.width + 24; s.height = c.height + 24;
      var sx = s.getContext('2d');
      if ('filter' in sx) sx.filter = 'blur(5px)';
      sx.drawImage(c, 12, 12);
      sx.globalCompositeOperation = 'source-in';
      sx.fillStyle = '#3b3128'; sx.fillRect(0, 0, s.width, s.height);
      it.shadow = s;
    });
  };

  /* the rail's geometry needs only the piece data and the width, not the photographs: site.js sizes
     the box with it at boot, so the page does not change length when the rail is built later */
  Rail.size = function (W, pieces) {
    var small = W < 700;
    var g = { small: small, shoulder: small ? 150 : clamp(W * 0.128, 160, 210), spacing: small ? Math.max(220, W * 0.62) : clamp(W * 0.24, 280, 360) };
    // a short screen (a phone on its side) hangs smaller pieces so one fits in the window
    var cap = Math.max(110, window.innerHeight * 0.32);
    if (g.shoulder > cap) { g.spacing *= cap / g.shoulder; g.shoulder = cap; }
    g.railY = small ? 34 : 40;
    var depth = 0;
    pieces.forEach(function (p) { var m = A.pieces[p.key]; depth = Math.max(depth, (m.flatBox[3] - m.tip[1]) * g.shoulder / m.shoulderW); });
    g.tagTop = Math.round(g.railY + depth + (small ? 18 : 26));
    g.height = g.tagTop + (small ? 118 : 128);
    return g;
  };
  Rail.sizeBox = function (box, W, pieces) {
    var g = Rail.size(W, pieces);
    box.style.setProperty('--tagTop', g.tagTop + 'px');
    box.style.height = g.height + 'px';
    return g;
  };

  Rail.prototype.layout = function () {
    var W = this.box.clientWidth;
    var g = Rail.sizeBox(this.box, W, this.pieces), small = g.small;
    this.shoulder = g.shoulder; this.spacing = g.spacing; this.railY = g.railY;
    var self = this;
    var r = this.box.getBoundingClientRect();
    var H = this.box.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = W; this.H = H; this.dpr = dpr;
    this.items.forEach(function (it) {
      it.sc = self.shoulder / it.m.shoulderW;
      it.depth = (it.m.flatBox[3] - it.m.tip[1]) * it.sc;
      it.L = it.depth * 0.48;
      it.w0 = Math.sqrt(G * it.wk / it.L);
      self.sprite(it);
    });
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) {
      this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    }
    this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    var ry = this.railY, gr = this.ctx.createLinearGradient(0, ry - 3, 0, ry + 4);
    gr.addColorStop(0, '#e9e8e4'); gr.addColorStop(0.45, '#a8a7a1'); gr.addColorStop(1, '#6f6e69');
    this.rodGrad = gr;
    var n = this.items.length;
    this.startX = small ? W * 0.5 : this.spacing * 0.8;
    this.minDrag = small ? -this.spacing * (n - 1) : Math.min(0, (W - this.spacing * 0.8) - (this.startX + this.spacing * (n - 1)));
    this.maxDrag = 0;
    this.drag = clamp(this.drag, this.minDrag, this.maxDrag);
    if (this.target != null) this.target = this.slot(this.target);
    this.top = r.top + window.scrollY;
    this.X = null; // the geometry jumped: the hooks start again from rest, no kick
    this.dirty = true;
  };

  /* each photograph is drawn once at its size on screen (a high quality downscale, off the main
     thread where the browser can): the rod then never resamples a 1400 px photograph to 400 px
     every frame, which shimmered on a swing and kept six full size textures on the GPU */
  Rail.prototype.sprite = function (it) {
    var w = Math.max(1, Math.round(it.m.w * it.sc * this.dpr)), h = Math.max(1, Math.round(it.m.h * it.sc * this.dpr));
    var key = w + 'x' + h;
    if (it.spriteKey === key) return;
    it.spriteKey = key;
    var self = this, src = it.img;
    var done = function (bm) { if (it.spriteKey === key) { it.sprite = bm; self.dirty = true; } };
    if (SPRITES) {
      createImageBitmap(src, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }).then(done, function () { done(self.spriteCanvas(src, w, h)); });
    } else done(this.spriteCanvas(src, w, h));
  };
  Rail.prototype.spriteCanvas = function (src, w, h) {
    // two halving passes and a final pass: a smooth downscale where resizeQuality is missing
    var cur = src, cw = src.width || src.naturalWidth, ch = src.height || src.naturalHeight;
    while (cw / 2 > w) {
      var nw = Math.ceil(cw / 2), nh = Math.ceil(ch / 2), c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      var x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, nw, nh);
      cur = c; cw = nw; ch = nh;
    }
    var out = document.createElement('canvas'); out.width = w; out.height = h;
    var o = out.getContext('2d'); o.imageSmoothingQuality = 'high'; o.drawImage(cur, 0, 0, w, h);
    return out;
  };

  /* the slots the rod comes to rest in: each piece centred, plus the far end */
  Rail.prototype.slot = function (x) {
    var s = this.spacing, n = Math.round(x / s) * s;
    if (Math.abs(x - this.minDrag) < Math.abs(x - n)) n = this.minDrag;
    return clamp(n, this.minDrag, this.maxDrag);
  };

  /* past either end the rod gives less and less (a rubber band), never a hard stop */
  Rail.prototype.band = function () { return Math.max(120, this.W * 0.28); };
  Rail.prototype.rubber = function (x) {
    var d = this.band();
    if (x > this.maxDrag) { var o = x - this.maxDrag; return this.maxDrag + d * (1 - 1 / (o * 0.55 / d + 1)); }
    if (x < this.minDrag) { var u = this.minDrag - x; return this.minDrag - d * (1 - 1 / (u * 0.55 / d + 1)); }
    return x;
  };
  Rail.prototype.unrubber = function (y) {
    var d = this.band();
    if (y > this.maxDrag) { var r = Math.min(0.98, (y - this.maxDrag) / d); return this.maxDrag + (1 / (1 - r) - 1) * d / 0.55; }
    if (y < this.minDrag) { var q = Math.min(0.98, (this.minDrag - y) / d); return this.minDrag - (1 / (1 - q) - 1) * d / 0.55; }
    return y;
  };

  Rail.prototype.bind = function () {
    var self = this, cv = this.cv, P = this.pointer;
    function local(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointermove', function (e) {
      var l = local(e), now = e.timeStamp || performance.now();
      var dx = l[0] - P.x;
      if (P.inside && Math.abs(dx) < 200) {
        var inst = dx / Math.max(4, now - P.lastT) * 1000;
        P.vx = P.vx * 0.55 + inst * 0.45;
      }
      P.x = l[0]; P.y = l[1]; P.inside = true; P.lastT = now;
      if (P.down && P.id === e.pointerId) {
        var mv = e.clientX - P.lastX; P.lastX = e.clientX;
        P.moved += Math.abs(mv);
        self.target = null;
        self.raw += mv;
        self.drag = self.rubber(self.raw);
        P.samples.push(now, self.raw);
        while (P.samples.length > 2 && now - P.samples[0] > 120) P.samples.splice(0, 2);
        self.dirty = true;
      }
      var h = self.hit(l[0], l[1]);
      if (h !== self.hover) { self.hover = h; cv.style.cursor = h >= 0 ? 'pointer' : (P.down ? 'grabbing' : 'grab'); }
    });
    cv.addEventListener('pointerleave', function () { P.inside = false; P.x = P.y = -1e4; P.vx = 0; self.hover = -1; });
    cv.addEventListener('pointerdown', function (e) {
      P.down = true; P.id = e.pointerId; P.moved = 0; P.t0 = performance.now(); P.lastX = e.clientX;
      P.samples = [e.timeStamp || P.t0, 0];
      // catch the rod where it is, even mid glide or out on the rubber band
      self.raw = self.unrubber(self.drag); P.samples[1] = self.raw;
      self.target = null; self.dragV = 0;
      try { cv.setPointerCapture(e.pointerId); } catch (er) { }
      cv.style.cursor = 'grabbing';
    });
    function up(e, cancelled) {
      if (!P.down || P.id !== e.pointerId) return;
      P.down = false;
      self.release(e.timeStamp || performance.now());
      if (!cancelled && P.moved < 7 && performance.now() - P.t0 < 500) {
        var l = local(e), h = self.hit(l[0], l[1]);
        if (h >= 0) self.pick(h);
      }
      cv.style.cursor = self.hover >= 0 ? 'pointer' : 'grab';
    }
    cv.addEventListener('pointerup', function (e) { up(e, false); });
    // a vertical swipe on a phone hands the gesture to the page: the rod still settles into a slot
    cv.addEventListener('pointercancel', function (e) { up(e, true); });
  };

  /* the finger lets go: the fling's speed from the last ~80 ms of samples (a least squares slope,
     not the last event pair), projected to where friction would stop it, rounded to a slot */
  Rail.prototype.release = function (now) {
    var s = this.pointer.samples, v = 0;
    if (s.length >= 4 && now - s[s.length - 2] < 60) {
      var n = 0, mt = 0, mx = 0;
      for (var i = 0; i < s.length; i += 2) if (now - s[i] <= 90) { n++; mt += s[i]; mx += s[i + 1]; }
      if (n >= 2) {
        mt /= n; mx /= n;
        var num = 0, den = 0;
        for (var j = 0; j < s.length; j += 2) if (now - s[j] <= 90) { var dt = s[j] - mt; num += dt * (s[j + 1] - mx); den += dt * dt; }
        if (den > 0) v = num / den * 1000;
      }
    }
    v = clamp(v, -5000, 5000);
    // out on the rubber band a fling only carries back in
    if ((this.drag > this.maxDrag && v > 0) || (this.drag < this.minDrag && v < 0)) v = 0;
    this.dragV = v;
    this.target = this.slot(this.drag + v / FRICTION);
    this.pointer.samples = [];
  };

  Rail.prototype.itemPose = function (it) {
    return { x: this.startX + it.i * this.spacing + this.drag + this.scrollOff, y: this.railY - it.lift, th: it.th, sc: it.sc };
  };

  Rail.prototype.hit = function (px, py) {
    for (var k = this.items.length - 1; k >= 0; k--) {
      var it = this.items[k]; if (it.hidden) continue;
      var p = this.itemPose(it), dx = px - p.x, dy = py - p.y;
      var c = Math.cos(-p.th), s = Math.sin(-p.th);
      var lx = (dx * c - dy * s) / p.sc + it.m.tip[0], ly = (dx * s + dy * c) / p.sc + it.m.tip[1];
      if (lx < 0 || ly < 0 || lx >= it.m.w || ly >= it.m.h) continue;
      if (ly < it.m.hookBase) continue;
      if (!it.alpha) return k;
      var ax = (lx / 4) | 0, ay = (ly / 4) | 0;
      if (it.alpha[(ay * it.aw + ax) * 4 + 3] > 60) return k;
    }
    return -1;
  };

  Rail.prototype.pick = function (i) {
    var it = this.items[i]; if (it.hidden) return;
    this.onPick && this.onPick(i, this.screenPose(i));
  };

  /* client-space pose of a piece, for the fitting room to take it off the rod */
  Rail.prototype.screenPose = function (i) {
    var it = this.items[i], p = this.itemPose(it), r = this.cv.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y, rot: p.th, scale: p.sc, key: it.key };
  };

  Rail.prototype.setHidden = function (i, v) {
    var it = this.items[i]; it.hidden = v;
    // hung back on the rod: a small settling swing and a dip on the hook
    if (!v) { it.om += (Math.random() > 0.5 ? 1 : -1) * 0.5; it.liftV -= 50; }
    it.tag.classList.toggle('is-off', v);
    this.dirty = true;
  };

  Rail.prototype.nudge = function (dir) {
    var base = this.target == null ? this.drag : this.target;
    this.target = clamp(this.slot(base) - dir * this.spacing, this.minDrag, this.maxDrag);
    if (dir > 0 && this.target > base - 1 && base > this.minDrag) this.target = this.minDrag;
  };

  Rail.prototype.showItem = function (i) {
    var want = this.W * 0.5 - (this.startX + i * this.spacing + this.scrollOff);
    this.target = clamp(want, this.minDrag, this.maxDrag);
  };

  Rail.prototype.kick = function (v) { this.items.forEach(function (it) { it.om += v * (0.6 + Math.random() * 0.8); }); };

  Rail.prototype.step = function (dt, t, scrollY, vh) {
    if (dt <= 0) return;
    var self = this, P = this.pointer;
    // a long gap (the rail was off screen, a background tab): pick up from rest, no catch up
    var gap = t - this.lastStep > 0.25; this.lastStep = t;
    dt = Math.min(dt, 1 / 20);
    // the page scroll pushes the rod along while the section passes
    var rel = scrollY + vh - this.top;
    this.scrollOff = (0.5 - clamp(rel / (vh * 2), 0, 1)) * this.spacing * 0.9;
    // the rod: under the finger while held, otherwise a glide into its slot
    if (!P.down) {
      if (this.target == null && (this.drag > this.maxDrag || this.drag < this.minDrag)) this.target = this.slot(this.drag);
      if (this.target != null) {
        var w = GLIDE_W, x = this.drag - this.target, v = this.dragV;
        // the exact solution of a critically damped spring over dt: no overshoot at any frame rate
        var e = Math.exp(-w * dt), c2 = v + w * x;
        this.drag = this.target + (x + c2 * dt) * e;
        this.dragV = (c2 - w * (x + c2 * dt)) * e;
        if (Math.abs(this.drag - this.target) < 0.15 && Math.abs(this.dragV) < 2) { this.drag = this.target; this.dragV = 0; this.target = null; }
        this.dirty = true;
      }
    }
    var X1 = this.drag + this.scrollOff;
    if (this.X == null || gap) { this.X = X1; this.xf = X1; this.vf = 0; this.af = 0; }
    var X0 = this.X; this.X = X1;
    // the cursor brushing through the cloth (a push along its own direction), fading when it stops
    var brush = null;
    if (P.inside && !P.down && Math.abs(P.vx) > 20) {
      brush = [];
      var vx = clamp(P.vx, -BRUSH_MAX, BRUSH_MAX);
      this.items.forEach(function (it) {
        var pose = self.itemPose(it), dx = P.x - pose.x, dy = P.y - pose.y;
        var reach = it.m.w * it.sc * 0.42;
        brush[it.i] = (!it.hidden && Math.abs(dx) < reach && dy > 20 && dy < it.depth) ? -vx * BRUSH * (dy / it.depth) / Math.max(0.6, it.L / 200) : 0;
      });
    }
    P.vx *= Math.exp(-dt * 9);
    var n = Math.max(1, Math.ceil(dt / STEP - 1e-6)), h = dt / n, W2 = HOOK_W * HOOK_W;
    for (var k = 1; k <= n; k++) {
      // the hooks' view of the rod: a critically damped follower, its acceleration is what they feel
      var Xk = X0 + (X1 - X0) * (k / n);
      var af = W2 * (Xk - this.xf) - 2 * HOOK_W * this.vf;
      this.vf += af * h; this.xf += this.vf * h; this.af = af;
      for (var q = 0; q < this.items.length; q++) {
        var it = this.items[q], th = it.th, om = it.om, L = it.L, w0 = it.w0;
        var draft = Math.sin(t * 0.7 + it.i * 1.9) * 0.01 + Math.sin(t * 1.31 + it.i) * 0.005;
        // the pivot accelerates one way, the hem lags the other: + af swings the hem back (+th)
        var acc = -w0 * w0 * Math.sin(th) + DRIVE * it.drive * (af / L) * Math.cos(th)
          - 2 * ZETA * w0 * om - AIR * om * Math.abs(om) + draft + (brush ? brush[q] : 0);
        var a = Math.abs(th);
        if (a > SOFT) { var o = a - SOFT; acc -= (th > 0 ? 1 : -1) * WALL * o * (1 + o * 8); if (om * th > 0) acc -= om * 6; }
        om += acc * h; th += om * h;
        if (th > HARD) { th = HARD; if (om > 0) om = 0; } else if (th < -HARD) { th = -HARD; if (om < 0) om = 0; }
        it.th = th; it.om = om;
      }
    }
    this.items.forEach(function (it) {
      var lt = (self.hover === it.i && !P.down) ? 10 : 0;
      it.liftV += ((lt - it.lift) * 220 - it.liftV * 18) * dt;
      it.lift += it.liftV * dt;
    });
  };

  // the label under each piece follows its hem; written only when it moved
  Rail.prototype.tagTo = function (it, tx) {
    if (it._tx != null && Math.abs(it._tx - tx) <= 0.4) return;
    it._tx = tx; it.tag.style.transform = 'translate(' + tx.toFixed(1) + 'px,0)';
  };

  Rail.prototype.draw = function () {
    var self = this, W = this.W;
    // nothing moved by a visible amount since the last frame: leave the canvas as it is
    var still = !this.dirty;
    if (still) {
      for (var i = 0; i < this.items.length; i++) {
        var it0 = this.items[i], px = this.startX + it0.i * this.spacing + this.drag + this.scrollOff;
        if (Math.abs(px - it0._px) > 0.05 || Math.abs(it0.th - it0._th) * it0.depth > 0.05 || Math.abs(it0.lift - it0._lift) > 0.05) { still = false; break; }
      }
    }
    if (still) return;
    this.dirty = false;
    var c = this.ctx, dpr = this.dpr, H = this.H;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // the rod
    var ry = this.railY;
    c.fillStyle = 'rgba(40,32,24,0.10)'; c.fillRect(0, ry + 5, W, 3);
    c.fillStyle = this.rodGrad; c.fillRect(0, ry - 3, W, 7);
    var count = 0, best = 1e9;
    this.items.forEach(function (it) {
      var p = self.itemPose(it);
      it._px = p.x; it._th = it.th; it._lift = it.lift;
      var d = Math.abs(p.x - W * 0.5); if (d < best) { best = d; count = it.i; }
      var w = it.m.w * p.sc, h = it.m.h * p.sc;
      if (it.hidden || p.x + w < -40 || p.x - w > W + 40) { self.tagTo(it, p.x - 90); return; }
      var cs = Math.cos(p.th), sn = Math.sin(p.th);
      // shadow on the wall, a little behind and below
      var sth = p.th * 0.75, scs = Math.cos(sth), ssn = Math.sin(sth);
      c.globalAlpha = 0.2;
      c.setTransform(dpr * scs, dpr * ssn, -dpr * ssn, dpr * scs, dpr * (p.x + 14), dpr * (p.y + 22));
      c.drawImage(it.shadow, -it.m.tip[0] * p.sc - 12 * 4 * p.sc, -it.m.tip[1] * p.sc - 12 * 4 * p.sc, it.shadow.width * 4 * p.sc, it.shadow.height * 4 * p.sc);
      c.globalAlpha = 1;
      c.setTransform(dpr * cs, dpr * sn, -dpr * sn, dpr * cs, dpr * p.x, dpr * p.y);
      c.drawImage(it.sprite || it.img, -it.m.tip[0] * p.sc, -it.m.tip[1] * p.sc, w, h);
      // the label follows the hem, a little
      self.tagTo(it, p.x - 90 - sn * 24);
    });
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (count !== this.count) { this.count = count; this.onCount && this.onCount(count); }
  };

export { Rail as PersonneRail }
