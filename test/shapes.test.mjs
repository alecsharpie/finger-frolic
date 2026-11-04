// The recognizer against synthetic finger drawings: random size, start point, direction, wobble, a little tilt
// and squash. Real fingers are sloppier, so these thresholds leave headroom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, recognizeShape, SHAPES, outline } from '../shared/shapes.js';

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const CLOSED = ['circle', 'tri', 'square'];

function sloppy(name, r, { wobble = 0.06, tilt = 0.25 } = {}) {
  let pts = outline(name).map(p => p.slice());
  // dense
  const d = [];
  for (let i = 1; i < pts.length; i++) for (let k = 0; k < 12; k++) { const t = k / 12; d.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]); }
  d.push(pts[pts.length - 1]);
  pts = d;
  if (CLOSED.includes(name)) { const k = Math.floor(r() * (pts.length - 1)); pts = pts.slice(k, -1).concat(pts.slice(0, k + 1)); }
  if (r() < 0.5) pts.reverse();
  if (CLOSED.includes(name) && r() < 0.5) pts = pts.slice(0, Math.floor(pts.length * (0.9 + r() * 0.08))); // not quite closed
  const a = (r() - 0.5) * tilt, sx = 0.8 + r() * 0.4, sy = 0.8 + r() * 0.4, S = 60 + r() * 120, ox = r() * 200, oy = r() * 300;
  let wx = 0, wy = 0;
  return pts.map(([x, y]) => {
    wx = wx * 0.8 + (r() - 0.5) * wobble; wy = wy * 0.8 + (r() - 0.5) * wobble;
    const X = (x + wx) * sx, Y = (y + wy) * sy;
    return [ox + S * (X * Math.cos(a) - Y * Math.sin(a)), oy + S * (X * Math.sin(a) + Y * Math.cos(a))];
  });
}

test('each shape is recognised from sloppy drawings, from any start and either direction', () => {
  const r = rnd(7), report = {};
  for (const name of Object.keys(SHAPES)) {
    let ok = 0; const wrong = {};
    for (let i = 0; i < 200; i++) {
      const c = classify(sloppy(name, r));
      if (c.type === 'shape' && c.name === name) ok++; else { const k = c.type === 'shape' ? c.name : c.type; wrong[k] = (wrong[k] || 0) + 1; }
    }
    report[name] = [ok / 200, wrong];
  }
  console.log(JSON.stringify(report));
  for (const [name, [acc]] of Object.entries(report)) assert.ok(acc >= 0.9, `${name}: ${acc}`);
});

test('straight strokes are swipes and dots are taps, never shapes', () => {
  const r = rnd(3);
  for (const [dir, dx, dy] of [['u', 0, -1], ['d', 0, 1], ['l', -1, 0], ['r', 1, 0]]) {
    for (let i = 0; i < 50; i++) {
      const L = 40 + r() * 200, bend = (r() - 0.5) * 0.3, pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([100 + dx * L * t + dy * bend * L * t * (1 - t) * 2 + (r() - 0.5) * 4, 100 + dy * L * t + dx * bend * L * t * (1 - t) * 2 + (r() - 0.5) * 4]); }
      assert.deepEqual(classify(pts), { type: 'swipe', dir });
    }
  }
  assert.equal(classify([[0, 0], [3, 2], [5, 4]]).type, 'tap');
});

test('scribbles are not confidently anything', () => {
  const r = rnd(11); let fooled = 0;
  for (let i = 0; i < 100; i++) {
    const pts = []; let x = 100, y = 100;
    for (let k = 0; k < 40; k++) { x += (r() - 0.5) * 80; y += (r() - 0.5) * 80; pts.push([x, y]); }
    if (classify(pts).type === 'shape') fooled++;
  }
  assert.ok(fooled < 25, `scribbles taken for shapes: ${fooled}/100`);
});
