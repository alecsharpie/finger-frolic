// Recognises a finger-drawn stroke as a swipe or one of a few shapes. Runs on the phone, so the TV only ever hears
// a word ('u', 'tri', …). Template matching in the style of the $1 unistroke recognizer (Wobbrock et al. 2007):
// resample the stroke to N points, scale it into a unit box, centre it, and compare point by point with templates.
// Unlike $1 it does not rotate strokes, so a V and a ∧ stay different. Closed shapes get a template for every
// starting corner and both directions, so it does not matter where you start or which way round you go.

export const SHAPES = {
  circle: { label: 'circle', icon: '○' },
  tri:    { label: 'triangle', icon: '△' },
  square: { label: 'square', icon: '□' },
  zig:    { label: 'zigzag', icon: 'Z' },
  v:      { label: 'check', icon: '✓' },
};
export const isShape = t => t in SHAPES;

const N = 48;
export const MIN_SCORE = 0.78;

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function pathLength(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += dist(pts[i - 1], pts[i]); return d; }

function resample(pts, n = N) {
  const I = pathLength(pts) / (n - 1), out = [pts[0].slice()];
  let D = 0, prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i], d = dist(prev, cur);
    while (D + d >= I && d > 0) {
      const t = (I - D) / d, q = [prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])];
      out.push(q); prev = q; d = dist(prev, cur); D = 0;
    }
    D += d; prev = cur;
  }
  while (out.length < n) out.push(pts[pts.length - 1].slice());
  return out.slice(0, n);
}

function normalize(pts) {
  const p = resample(pts);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  // keep the aspect ratio unless the stroke is very thin, so a square stays square-ish and a squashed circle still matches
  const w = Math.max(x1 - x0, 1e-6), h = Math.max(y1 - y0, 1e-6), s = Math.max(w, h);
  const sx = w / s < 0.35 ? w : s, sy = h / s < 0.35 ? h : s;
  const q = p.map(([x, y]) => [(x - x0) / sx, (y - y0) / sy]);
  const cx = q.reduce((a, b) => a + b[0], 0) / q.length, cy = q.reduce((a, b) => a + b[1], 0) / q.length;
  return q.map(([x, y]) => [x - cx, y - cy]);
}

// Shape outlines in screen coordinates (y down).
const poly = c => c;
const OUTLINES = {
  circle: Array.from({ length: 33 }, (_, i) => [Math.cos((i / 32) * Math.PI * 2), Math.sin((i / 32) * Math.PI * 2)]),
  tri: poly([[0, -1], [0.95, 0.7], [-0.95, 0.7], [0, -1]]),
  square: poly([[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]),
  zig: poly([[-1, -1], [1, -1], [-1, 1], [1, 1]]),
  v: poly([[-1, -0.2], [-0.35, 0.8], [1, -1]]),
};
const CLOSED = { circle: true, tri: true, square: true };

// densify a polyline so start-point rotation works on even spacing
function dense(c, n = 64) { return resample(c, n); }

function variants(name) {
  const base = dense(OUTLINES[name]);
  const out = [];
  if (CLOSED[name]) {
    const ring = base.slice(0, -1);
    for (let k = 0; k < ring.length; k += 4) {
      const r = ring.slice(k).concat(ring.slice(0, k));
      r.push(r[0]);
      out.push(r, r.slice().reverse());
    }
  } else {
    out.push(base, base.slice().reverse());
    if (name === 'v') { // a check mark drawn the other way round: ✓ mirrored
      const m = base.map(([x, y]) => [-x, y]); out.push(m, m.slice().reverse());
    }
  }
  return out.map(normalize);
}
const TEMPLATES = Object.keys(SHAPES).flatMap(name => variants(name).map(pts => ({ name, pts })));

// Hand-drawn shapes are rarely level, so the stroke is also tried turned a little either way (not far enough to
// turn a V into a <).
const TURNS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3];
function turn(pts, a) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

function bestDistance(stroke, name) {
  let best = Infinity;
  for (const a of TURNS) {
    const c = normalize(a ? turn(stroke, a) : stroke);
    for (const t of TEMPLATES) {
      if (t.name !== name) continue;
      let d = 0;
      for (let i = 0; i < N; i++) d += dist(c[i], t.pts[i]);
      best = Math.min(best, d / N);
    }
  }
  return best;
}

// Sharp turns along the stroke: where the heading changes by more than ~55° over a short stretch.
export function corners(stroke) {
  const p = resample(stroke, 64), K = 3, turnAt = [];
  for (let i = K; i < p.length - K; i++) {
    const a = Math.atan2(p[i][1] - p[i - K][1], p[i][0] - p[i - K][0]), b = Math.atan2(p[i + K][1] - p[i][1], p[i + K][0] - p[i][0]);
    let d = Math.abs(b - a); if (d > Math.PI) d = 2 * Math.PI - d;
    turnAt.push([i, d]);
  }
  let n = 0, last = -99;
  for (let j = 1; j < turnAt.length - 1; j++) {
    const [i, d] = turnAt[j];
    if (d > 0.95 && d >= turnAt[j - 1][1] && d >= turnAt[j + 1][1] && i - last > K * 2) { n++; last = i; }
  }
  return n;
}

export function recognizeShape(stroke) {
  if (stroke.length < 5) return null;
  let best = null;
  for (const a of TURNS) {
    const c = normalize(a ? turn(stroke, a) : stroke);
    for (const t of TEMPLATES) {
      let d = 0;
      for (let i = 0; i < N; i++) d += dist(c[i], t.pts[i]);
      d /= N;
      if (!best || d < best.d) best = { name: t.name, d };
    }
  }
  let score = 1 - best.d / (0.5 * Math.SQRT2);
  // Template distance alone is kind to circles: a wobbly square sits close to one. Corners settle it.
  if (best.name === 'circle' || best.name === 'square' || best.name === 'tri') {
    const k = corners(stroke);
    const fits = { circle: k <= 1, tri: k === 2 || k === 3, square: k >= 3 && k <= 5 };
    if (!fits[best.name]) {
      const alt = ['square', 'tri', 'circle'].filter(n => fits[n])
        .map(n => ({ n, d: bestDistance(stroke, n) })).sort((a, b) => a.d - b.d)[0];
      if (alt) score = 1 - alt.d / (0.5 * Math.SQRT2), best.name = alt.n;
    }
  }
  return { name: best.name, score };
}

// The whole gesture: {type: 'tap'} | {type: 'swipe', dir} | {type: 'shape', name, score} | {type: 'unknown'}
export function classify(stroke) {
  const len = pathLength(stroke);
  if (len < 14) return { type: 'tap' };
  const a = stroke[0], b = stroke[stroke.length - 1], dx = b[0] - a[0], dy = b[1] - a[1];
  if (len >= 26 && Math.hypot(dx, dy) / len > 0.8) {
    return { type: 'swipe', dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u') };
  }
  const r = recognizeShape(stroke);
  return r && r.score >= MIN_SCORE ? { type: 'shape', ...r } : { type: 'unknown', ...r };
}

// For drawing the shapes (TV chips, phone hints): the outline as points in [-1, 1].
export const outline = name => OUTLINES[name];
