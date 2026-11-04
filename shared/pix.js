// Pixel-art toolkit, after the sprite lab in ~/me/aoe: sprites are painted onto a small grid of materials, shaded
// with three-tone hue-shifted ramps lit from the upper-left, given a selective 1-px outline, and baked ONCE into
// canvases. Drawing a sprite in the game is then a single drawImage with smoothing off, which is what keeps a
// TV full of monsters cheap.
//
// A painter works in grid pixels. Primitives take a material (a ramp) and fill pixels with a tone 0..3
// (light, mid, shade, deep) worked out from a pseudo-3D normal, so every blob reads as a lit, round form.

// ---------- colour ----------
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
}
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}
// move a hue a little toward a target hue (shortest way round)
const toward = (h, t, k) => { let d = ((t - h + 540) % 360) - 180; return h + d * k; };

// A ramp from one mid colour: lights warmer (toward yellow) and paler, shades cooler (toward blue) and richer.
export function ramp(mid) {
  const [h, s, l] = hexToHsl(mid);
  return [
    hsl(toward(h, 55, 0.18), s * 0.95, l + (1 - l) * 0.35),
    mid,
    hsl(toward(h, 245, 0.16), Math.min(1, s * 1.08), l * 0.7),
    hsl(toward(h, 250, 0.3), Math.min(1, s * 1.1), l * 0.45),
  ];
}
export const flat = c => [c, c, c, c];

// ---------- painting ----------
const LX = -0.55, LY = -0.65, LZ = 0.52; // light from the upper-left, a little in front

export class Painter {
  constructor(w, h, mats, ink = '#1a1028') {
    this.w = w; this.h = h; this.mats = mats; this.ink = ink;
    this.mat = new Array(w * h).fill(null); this.tone = new Uint8Array(w * h);
  }
  set(x, y, m, t) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.mat[y * this.w + x] = m; this.tone[y * this.w + x] = t;
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.mat[y * this.w + x]; }
  // shade from a normal: four clean bands, no dithering noise
  static toneOf(nx, ny, nz, bias = 0) {
    const d = LX * nx + LY * ny + LZ * nz + bias;
    return d > 0.66 ? 0 : d > -0.02 ? 1 : d > -0.42 ? 2 : 3;
  }
  // a lit ellipse: the workhorse for bodies, heads, feet
  blob(cx, cy, rx, ry, m, bias = 0) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, q = nx * nx + ny * ny;
      if (q > 1) continue;
      this.set(x, y, m, Painter.toneOf(nx, ny, Math.sqrt(1 - q), bias));
    }
    return this;
  }
  // a lit rounded box: shaded like a cushion (flat top light, sides fall off)
  box(x0, y0, w, h, m, r = 2, bias = 0) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const dx = Math.max(x0 + r - x - 0.5, 0, x + 0.5 - (x0 + w - r)), dy = Math.max(y0 + r - y - 0.5, 0, y + 0.5 - (y0 + h - r));
      if (r && dx * dx + dy * dy > r * r) continue;
      // a cushion: flat in the middle, falling off only near the edges
      const ex = (x + 0.5 - x0) / w - 0.5, ey = (y + 0.5 - y0) / h - 0.5;
      const nx = Math.sign(ex) * Math.max(0, Math.abs(ex) * 2 - 0.45) * 1.6, ny = Math.sign(ey) * Math.max(0, Math.abs(ey) * 2 - 0.45) * 1.6;
      this.set(x, y, m, Painter.toneOf(nx, ny, 0.8, bias + 0.05));
    }
    return this;
  }
  // a filled polygon with one tone, or shaded by height if tone is null
  poly(pts, m, tone = null) {
    const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], yy = y + 0.5;
        if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
        this.set(x, y, m, tone ?? (y - y0 < (y1 - y0) * 0.35 ? 1 : y - y0 < (y1 - y0) * 0.75 ? 2 : 3));
      }
    }
    return this;
  }
  line(x0, y0, x1, y1, m, t = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, m, t);
    return this;
  }
  px(x, y, m, t = 1) { this.set(x, y, m, t); return this; }
  // hand-placed pixels: rows of characters, map[ch] = [material, tone]; '.' and ' ' are empty
  grid(rows, map, ox = 0, oy = 0) {
    rows.forEach((row, y) => [...row].forEach((ch, x) => { const m = map[ch]; if (m) this.set(ox + x, oy + y, m[0], m[1]); }));
    return this;
  }
  // A dark 1-px rim around the silhouette. Selective: where the rim touches the lit upper-left of a form it takes
  // that material's deep tone instead of ink, so sprites look painted rather than stickered.
  outline() {
    const { w, h } = this, add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (this.get(x, y) != null) continue;
      const r = this.get(x + 1, y), b = this.get(x, y + 1), l = this.get(x - 1, y), t = this.get(x, y - 1);
      if (r == null && b == null && l == null && t == null) continue;
      const lit = (r != null || b != null) && l == null && t == null;
      add.push([x, y, lit ? (r ?? b) : null]);
    }
    for (const [x, y, m] of add) { this.mat[y * w + x] = m ?? '_ink'; this.tone[y * w + x] = 3; }
    return this;
  }
  // Bake to a canvas. recolor(mat, tone, color) can swap colours (white flash, ice tint).
  bake(recolor) {
    const c = makeCanvas(this.w, this.h), x = c.getContext('2d');
    const img = x.createImageData(this.w, this.h), d = img.data;
    for (let i = 0; i < this.mat.length; i++) {
      const m = this.mat[i]; if (m == null) continue;
      let col = m === '_ink' ? this.ink : this.mats[m][this.tone[i]];
      if (recolor) col = recolor(m, this.tone[i], col);
      const n = parseInt(col.slice(1), 16);
      d[i * 4] = n >> 16; d[i * 4 + 1] = (n >> 8) & 255; d[i * 4 + 2] = n & 255; d[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// ---------- variants used in play ----------
// flash: the white "ouch" frame; ice: frozen tint. Built once alongside the normal frame.
export const VARIANTS = {
  normal: null,
  flash: (m, t, c) => (m === '_ink' ? '#ffffff' : t >= 3 ? '#d8d0ff' : '#ffffff'),
  ice: (m, t, c) => mix(c, ['#e8f8ff', '#bfe8ff', '#7cc4e8', '#3b6f9a'][t], 0.55),
};
export function mix(a, b, k) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((A >> s) & 255) * (1 - k) + ((B >> s) & 255) * k);
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}

// A sprite: {w, h, anchor:[x,y] (feet), frames: n, paint(P, frame, opts)}. Built lazily per (frame, variant, key)
// and kept forever: the whole cast is a few hundred small canvases.
const CACHE = new Map();
export function frame(spec, f, variant = 'normal', opts = null, key = '') {
  const k = spec.id + '|' + f + '|' + variant + '|' + key;
  let c = CACHE.get(k);
  if (!c) {
    const P = new Painter(spec.w, spec.h, typeof spec.mats === 'function' ? spec.mats(opts) : spec.mats, spec.ink);
    spec.paint(P, f, opts);
    if (spec.outline !== false) P.outline();
    c = P.bake(VARIANTS[variant]);
    CACHE.set(k, c);
  }
  return c;
}
export const cacheSize = () => CACHE.size;

// Draw a sprite with its anchor at (x, y), at an integer scale, snapped to whole pixels.
export function draw(ctx, spec, f, x, y, { variant = 'normal', opts = null, key = '', scale = 1, flip = false, sx = 1, sy = 1 } = {}) {
  const c = frame(spec, f % spec.frames, variant, opts, key);
  const w = Math.round(spec.w * scale * sx), h = Math.round(spec.h * scale * sy);
  const ax = Math.round(x - spec.anchor[0] * scale * sx), ay = Math.round(y - spec.anchor[1] * scale * sy);
  if (flip) { ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(c, Math.round(-spec.anchor[0] * scale * sx), ay, w, h); ctx.restore(); }
  else ctx.drawImage(c, ax, ay, w, h);
}
