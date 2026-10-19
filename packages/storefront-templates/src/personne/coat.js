/* eslint-disable */
import { PERSONNE_ASSETS as A } from "./assets.js"
/* PERSONNE coat engine. One garment drawn as a WebGL mesh that morphs from "on its hanger"
   (flat) to "worn by nobody" (ghost) along a dense optical flow field (tools/assets.py).
   The mesh can also slump, breathe, lean, walk, lift its own hook off, and flood the
   screen with the blue lining from the open collar. Pure draw(state): no timers in here. */

  var VS = [
    'precision highp float;',
    'attribute vec2 a_uv; attribute vec2 a_d; attribute float a_w;',
    'uniform vec2 u_res, u_size, u_anchor, u_screen, u_cam, u_pivotL, u_pivotR;',
    'uniform float u_scale, u_rot, u_zoom, u_fill, u_slump, u_breath, u_lean, u_walk, u_walkAmt, u_sway;',
    'varying vec2 v_uvA; varying vec2 v_uvB;',
    'vec2 rot(vec2 p, vec2 c, float a){ float s=sin(a), k=cos(a); p-=c; return c+vec2(p.x*k-p.y*s, p.x*s+p.y*k); }',
    'void main(){',
    '  vec2 p = a_uv + a_d * u_fill;',
    // slump: the top sinks and folds in, most at the shoulders
    '  float top = 1.0 - smoothstep(0.04, 0.62, p.y);',
    '  p.x = 0.5 + (p.x - 0.5) * (1.0 - u_slump * 0.11 * top);',
    '  p.y += u_slump * (0.045 * top + 0.012);',
    // breath: the chest widens a touch
    '  float chest = exp(-pow((p.y - 0.34) / 0.22, 2.0));',
    '  p.x = 0.5 + (p.x - 0.5) * (1.0 + u_breath * 0.012 * chest);',
    // sleeves swing from the shoulder (walk), the right one against the left
    '  float wl = max(-a_w, 0.0), wr = max(a_w, 0.0);',
    '  float sw = sin(u_walk) * u_walkAmt;',
    '  p = mix(p, rot(p, u_pivotL, -0.05 * sw), wl);',
    '  p = mix(p, rot(p, u_pivotR, -0.05 * sw), wr);',
    '  p.y -= (wl * max(sw, 0.0) + wr * max(-sw, 0.0)) * 0.012 * smoothstep(u_pivotL.y, 1.0, p.y);',
    // hem sways, the top leans toward the cursor
    '  float low = clamp((p.y - 0.42) / 0.58, 0.0, 1.0);',
    '  p.x += u_sway * low * low * 0.028;',
    '  p.x += u_lean * (0.62 - p.y) * 0.035;',
    '  v_uvA = a_uv; v_uvB = a_uv + a_d;',
    '  vec2 px = (p * u_size - u_anchor) * u_scale;',
    '  px = rot(px, vec2(0.0), u_rot) + u_screen;',
    '  px = u_cam + (px - u_cam) * u_zoom;',
    '  vec2 c = px / u_res * 2.0 - 1.0;',
    '  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'uniform sampler2D u_A, u_B, u_L, u_S;',
    'uniform vec2 u_res; uniform vec3 u_holeK;',
    'uniform float u_xf, u_cut, u_cutInv, u_flood, u_soft, u_linMix, u_alpha, u_hasS, u_linAspect;',
    'varying vec2 v_uvA; varying vec2 v_uvB;',
    'void main(){',
    '  float keep = u_cutInv > 0.5 ? step(v_uvA.y, u_cut) : step(u_cut, v_uvA.y);',
    '  vec4 a = texture2D(u_A, v_uvA) * keep;',
    '  vec4 b = texture2D(u_B, clamp(v_uvB, 0.0, 1.0));',
    '  b *= step(0.0, v_uvB.x) * step(v_uvB.x, 1.0) * step(0.0, v_uvB.y) * step(v_uvB.y, 1.0);',
    // colour crossfades linearly, coverage settles faster so no half-clear patches linger
    '  vec4 m = mix(a, b, u_xf);',
    '  float al = max(m.a, mix(a.a, b.a, smoothstep(0.0, 0.45, u_xf)));',
    '  vec4 c = m.a > 0.002 ? vec4(m.rgb / m.a * al, al) : vec4(0.0);',
    '  if (u_hasS > 0.5 && u_flood > 0.0) {',
    '    float s = texture2D(u_S, clamp(v_uvB, 0.0, 1.0)).r; float d = s * s * 1500.0;',
    '    float f = 1.0 - smoothstep(u_flood - u_soft, u_flood, d);',
    '    vec2 q = gl_FragCoord.xy / u_res; q.y = 1.0 - q.y;',
    '    float sa = u_res.x / u_res.y;',
    '    if (sa > u_linAspect) q.y = 0.5 + (q.y - 0.5) * (u_linAspect / sa); else q.x = 0.5 + (q.x - 0.5) * (sa / u_linAspect);',
    '    vec3 lin = texture2D(u_L, q).rgb * mix(u_holeK, vec3(1.0), u_linMix);',
    '    c = mix(c, vec4(lin, 1.0), f);',
    '  }',
    '  gl_FragColor = c * u_alpha;',
    '}'
  ].join('\n');

  function sh(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  function Coat(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.dprCap = opts.dprCap || 2;
    // no MSAA, no depth or stencil: every edge of the coat comes from its photograph's alpha, not
    // from the mesh, so a multisampled full screen buffer (4 samples, a phone's GPU memory) bought nothing
    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: !!opts.preserve });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.prog = p;
    gl.useProgram(p);
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), u = {};
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    this.u = u;
    this.attr = { uv: gl.getAttribLocation(p, 'a_uv'), d: gl.getAttribLocation(p, 'a_d'), w: gl.getAttribLocation(p, 'a_w') };
    gl.uniform1i(u.u_A, 0); gl.uniform1i(u.u_B, 1); gl.uniform1i(u.u_L, 2); gl.uniform1i(u.u_S, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.pieces = {};
    this.lining = null; this.sdf = null;
    this.W = 1; this.H = 1;
    this.blank = this.tex(null);
  }

  Coat.prototype.tex = function (img) {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    if (img) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  /* Build the mesh for one piece. ghost may arrive later (setGhost). */
  Coat.prototype.addPiece = function (key, flatImg, ghostImg) {
    var gl = this.gl, m = A.pieces[key], GX = A.grid[0], GY = A.grid[1];
    var nv = (GX + 1) * (GY + 1), uv = new Float32Array(nv * 2), d = new Float32Array(nv * 2), w = new Float32Array(nv);
    var shHalf = m.shoulderW / 2 / m.w, shY = m.shoulderY / m.h;
    for (var j = 0, k = 0; j <= GY; j++) {
      for (var i = 0; i <= GX; i++, k++) {
        var x = i / GX, y = j / GY;
        uv[k * 2] = x; uv[k * 2 + 1] = y;
        var dx = m.field[k * 2] / m.w, dy = m.field[k * 2 + 1] / m.h;
        d[k * 2] = dx; d[k * 2 + 1] = dy;
        var gx = x + dx, gy = y + dy, off = Math.abs(gx - 0.5);
        var wt = smooth(shHalf * 0.66, shHalf * 0.86, off) * smooth(shY - 0.03, shY + 0.07, gy);
        w[k] = gx < 0.5 ? -wt : wt;
      }
    }
    var idx = new Uint16Array(GX * GY * 6), q = 0;
    for (j = 0; j < GY; j++) {
      for (i = 0; i < GX; i++) {
        var a = j * (GX + 1) + i, b = a + 1, c = a + GX + 1, e = c + 1;
        idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = e; idx[q++] = c;
      }
    }
    function buf(target, data) { var bb = gl.createBuffer(); gl.bindBuffer(target, bb); gl.bufferData(target, data, gl.STATIC_DRAW); return bb; }
    this.pieces[key] = {
      m: m, count: idx.length,
      uv: buf(gl.ARRAY_BUFFER, uv), d: buf(gl.ARRAY_BUFFER, d), w: buf(gl.ARRAY_BUFFER, w),
      idx: buf(gl.ELEMENT_ARRAY_BUFFER, idx),
      A: this.tex(flatImg), B: ghostImg ? this.tex(ghostImg) : null,
      pivotL: [0.5 - shHalf * 0.82, shY], pivotR: [0.5 + shHalf * 0.82, shY]
    };
    return this.pieces[key];
  };

  Coat.prototype.setGhost = function (key, img) { var p = this.pieces[key]; if (p && !p.B) p.B = this.tex(img); };
  Coat.prototype.hasGhost = function (key) { var p = this.pieces[key]; return !!(p && p.B); };
  Coat.prototype.setLining = function (img) { this.lining = this.tex(img); this.linAspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height); };
  Coat.prototype.setSDF = function (img) { this.sdf = this.tex(img); };

  Coat.prototype.resize = function (w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.W = w; this.H = h; this.dpr = dpr;
    var cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    this.gl.viewport(0, 0, cw, ch);
  };

  Coat.prototype.clear = function () { var gl = this.gl; gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); };

  /* s: { key, anchor:[x,y] crop px, screen:[x,y] css px, scale, rot, zoom, cam:[x,y],
          fill, xf, slump, breath, lean, walk, walkAmt, sway, cut, cutInv, flood, soft, linMix, alpha }
     cut drops the flat photo above that row (its hook); cutInv keeps only the hook. */
  Coat.prototype.draw = function (s) {
    var gl = this.gl, u = this.u, P = this.pieces[s.key];
    if (!P) return;
    var m = P.m, dpr = this.dpr;
    gl.useProgram(this.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.uv); gl.enableVertexAttribArray(this.attr.uv); gl.vertexAttribPointer(this.attr.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.d); gl.enableVertexAttribArray(this.attr.d); gl.vertexAttribPointer(this.attr.d, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.w); gl.enableVertexAttribArray(this.attr.w); gl.vertexAttribPointer(this.attr.w, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, P.idx);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.A);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, P.B || P.A);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.lining || this.blank);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.sdf || this.blank);
    gl.uniform2f(u.u_res, this.W * dpr, this.H * dpr);
    gl.uniform2f(u.u_size, m.w, m.h);
    gl.uniform2f(u.u_anchor, s.anchor[0], s.anchor[1]);
    gl.uniform2f(u.u_screen, s.screen[0] * dpr, s.screen[1] * dpr);
    gl.uniform1f(u.u_scale, s.scale * dpr);
    gl.uniform1f(u.u_rot, s.rot || 0);
    gl.uniform1f(u.u_zoom, s.zoom || 1);
    var cam = s.cam || [this.W / 2, this.H / 2];
    gl.uniform2f(u.u_cam, cam[0] * dpr, cam[1] * dpr);
    var hasB = !!P.B;
    gl.uniform1f(u.u_fill, hasB ? (s.fill || 0) : 0);
    gl.uniform1f(u.u_xf, hasB ? (s.xf == null ? Math.min(1, Math.max(0, s.fill || 0)) : s.xf) : 0);
    gl.uniform1f(u.u_slump, s.slump || 0);
    gl.uniform1f(u.u_breath, s.breath || 0);
    gl.uniform1f(u.u_lean, s.lean || 0);
    gl.uniform1f(u.u_walk, s.walk || 0);
    gl.uniform1f(u.u_walkAmt, s.walkAmt || 0);
    gl.uniform1f(u.u_sway, s.sway || 0);
    gl.uniform2f(u.u_pivotL, P.pivotL[0], P.pivotL[1]);
    gl.uniform2f(u.u_pivotR, P.pivotR[0], P.pivotR[1]);
    gl.uniform1f(u.u_cut, s.cut || 0);
    gl.uniform1f(u.u_cutInv, s.cutInv ? 1 : 0);
    var hasS = this.sdf && this.lining && s.key === '01';
    gl.uniform1f(u.u_hasS, hasS ? 1 : 0);
    gl.uniform1f(u.u_flood, s.flood || 0);
    gl.uniform1f(u.u_soft, s.soft || 24);
    gl.uniform1f(u.u_linMix, s.linMix == null ? 1 : s.linMix);
    gl.uniform1f(u.u_linAspect, this.linAspect || 1.5);
    var hk = A.pieces['01'].holeRGB, lk = A.liningRGB;
    gl.uniform3f(u.u_holeK, hk[0] / lk[0], hk[1] / lk[1], hk[2] / lk[2]);
    gl.uniform1f(u.u_alpha, s.alpha == null ? 1 : s.alpha);
    gl.drawElements(gl.TRIANGLES, P.count, gl.UNSIGNED_SHORT, 0);
  };

export { Coat as PersonneCoat }
