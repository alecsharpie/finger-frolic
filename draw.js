// Everything the TV draws. The world is pixel art: it is drawn into a small buffer (about 270 px tall) and scaled
// up by a whole number with smoothing off, so a 4K TV costs the same as a laptop. The scenery is baked once per
// layout into its own canvas, and every sprite frame is baked once (shared/pix.js), so a frame is mostly drawImage
// calls. Text (names, scores, popups) is drawn on top at full resolution so it stays crisp.
//
// Effects take SCREEN coordinates (what index.html works in) and are converted to buffer pixels when drawn.
import { aim, MAX_HEARTS, FRENZY, isShapeToken } from './game.js';
import { draw, frame, makeCanvas, mix } from './shared/pix.js';
import { MONSTERS, wyrmHead, wyrmSeg, wizard, chip, heart, isArrow } from './sprites.js';

// player colours: none of them green, so a hero never looks like a grunt
export const COLORS = ['#ff5a8a', '#3fb6ff', '#ffd23f', '#c58bff', '#ff9a3c', '#2ee6d6', '#f2f2f2', '#ff6bd6'];
export const seatColor = seat => COLORS[(+String(seat).slice(1) - 1) % COLORS.length];
export const BODY = { grunt: '#6fd36a', brute: '#9b6bff', runner: '#ff9f43', spinner: '#3fd2d0', trickster: '#ff5d73', golem: '#8c8aa8', gift: '#ffcf33', boss: '#5b4bd6' };

const BUF_H = 270; // world pixels from top to bottom

// The field layout in buffer pixels.
function layoutBuf(bw, bh, L) {
  const top = Math.round(bh * 0.15), wall = Math.round(bh * 0.8);
  const lw = Math.floor(Math.min((bw * 0.94) / Math.max(1, L), bw * 0.3, bh * 0.55));
  const x0 = Math.floor((bw - lw * L) / 2);
  return { bw, bh, L, top, wall, lw, x0, laneX: i => x0 + Math.floor(lw * (i + 0.5)), yOf: y => top + y * (wall - top) };
}

// ---------- effects (screen coordinates) ----------
export const fx = { parts: [], pops: [], spells: [], bolts: [], dying: [], snow: [], shake: 0, flash: 0, flashColor: '#ff3355', lunge: {} };

export function burst(x, y, color, n = 18, speed = 420) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.45 + Math.random() * 0.4, t: 0, color, r: 4 + Math.random() * 6, g: 900 });
  }
}
export function popup(x, y, text, color = '#fff', size = 34) { fx.pops.push({ x, y, text, color, size, t: 0, life: 1 }); }
export function bolt(x, y) {
  const pts = [[x + (Math.random() - 0.5) * 60, 0]];
  for (let k = 1; k <= 9; k++) pts.push([x + (Math.random() - 0.5) * 80 * (1 - k / 10), (y * k) / 9]);
  fx.bolts.push({ pts, t: 0, life: 0.4 });
}
// A spell from a wizard's staff to a monster. token: an arrow ('u'…) casts a quick bolt in the caster's colour;
// a shape casts its own spell. The monster may already be gone (the hit that killed it): the spell flies to where
// it was and its death is shown when the spell lands (see dying()).
const SPELL_TIME = { circle: 0.28, tri: 0.3, square: 0.32, zig: 0.34, v: 0.3 };
export function spell(token, from, to, color, enemyId) {
  fx.spells.push({ token, x0: from.x, y0: from.y, tx: to.x, ty: to.y, id: enemyId, color, t: 0, life: SPELL_TIME[token] || 0.13 });
}
// A monster that has just been killed: drawn white for a moment (until the spell gets there), then it bursts.
export function dying(kind, x, y, delay = 0.13) { fx.dying.push({ kind, x, y, t: 0, life: delay }); }

export function tickFx(dt, G, Lo) {
  for (const p of fx.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.98; }
  fx.parts = fx.parts.filter(p => p.t < p.life);
  for (const p of fx.pops) { p.t += dt; p.y -= 70 * dt; }
  fx.pops = fx.pops.filter(p => p.t < p.life);
  for (const b of fx.bolts) b.t += dt;
  fx.bolts = fx.bolts.filter(b => b.t < b.life);
  for (const s of fx.snow) { s.y += s.v * dt; s.x += Math.sin(s.y / 40 + s.p) * 20 * dt; }
  fx.snow = fx.snow.filter(s => s.y < s.H);
  for (const s of fx.spells) {
    s.t += dt;
    // follow a living target
    if (G && Lo && s.id != null) { const e = G.enemies.find(e => e.id === s.id); if (e && e.kind !== 'boss') { s.tx = Lo.laneX(e.lane); s.ty = Lo.yOf(e.y); } }
    const k = Math.min(1, s.t / s.life), x = s.x0 + (s.tx - s.x0) * k, y = s.y0 + (s.ty - s.y0) * k - Math.sin(k * Math.PI) * 40;
    trail(s, x, y);
    if (s.t >= s.life && !s.done) { s.done = true; impact(s); }
  }
  fx.spells = fx.spells.filter(s => !s.done);
  for (const d of fx.dying) {
    d.t += dt;
    if (d.t >= d.life && !d.done) { d.done = true; burst(d.x, d.y, '#ffffff', 10, 320); burst(d.x, d.y, BODY[d.kind] || '#fff', 24, 520); }
  }
  fx.dying = fx.dying.filter(d => !d.done);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  fx.flash = Math.max(0, fx.flash - dt * 2.5);
  for (const k in fx.lunge) fx.lunge[k] = Math.max(0, fx.lunge[k] - dt * 5);
}
const P = (x, y, color, r = 4, vx = 0, vy = 0, life = 0.3, g = 0) => fx.parts.push({ x, y, vx, vy, life, t: 0, color, r, g });
function trail(s, x, y) {
  const j = () => (Math.random() - 0.5) * 16;
  if (s.token === 'circle') { P(x + j(), y + j(), Math.random() < 0.5 ? '#ffb02e' : '#ff5a3c', 7, j() * 3, -60, 0.3); P(x, y, '#fff3a0', 9, 0, 0, 0.06); }
  else if (s.token === 'zig') { const a = s.t * 40; P(x + Math.cos(a) * 22, y + Math.sin(a) * 22, '#b8ffcf', 5, 0, 0, 0.25); P(x - Math.cos(a) * 22, y - Math.sin(a) * 22, '#5be37d', 5, 0, 0, 0.25); }
  else if (s.token === 'square' || s.token === 'tri' || s.token === 'v') { /* drawn as a shape, see drawSpell */ }
  else { P(x + j() / 2, y + j() / 2, s.color, 5, 0, 0, 0.18); P(x, y, '#ffffff', 6, 0, 0, 0.05); }
}
function impact(s) {
  const { tx: x, ty: y } = s;
  if (s.token === 'circle') { burst(x, y, '#ffb02e', 28, 600); burst(x, y, '#ff5a3c', 16, 400); burst(x, y, '#fff3a0', 8, 250); fx.shake = Math.max(fx.shake, 8); }
  else if (s.token === 'tri') { bolt(x, y); burst(x, y, '#cfe6ff', 20, 500); fx.shake = Math.max(fx.shake, 10); }
  else if (s.token === 'square') { for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; P(x, y, i % 2 ? '#bfe8ff' : '#ffffff', 6, Math.cos(a) * 420, Math.sin(a) * 420 - 100, 0.5, 900); } }
  else if (s.token === 'zig') { burst(x, y, '#5be37d', 22, 500); burst(x, y, '#ffffff', 8, 300); }
  else if (s.token === 'v') { burst(x, y, '#ffe14d', 26, 520); burst(x, y, '#ffffff', 12, 300); }
  else burst(x, y, s.color, 8, 260);
}

// ---------- the scenery, baked ----------
function rng(seed) { let s = seed | 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
let scenery = null;
function bakeScenery(Lb, lanes, frozen) {
  const { bw, bh, top, wall, lw, x0, L } = Lb, c = makeCanvas(bw, bh), x = c.getContext('2d'), r = rng(1234);
  const px = (X, Y, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(X | 0, Y | 0, w, h); };
  // sky in bands
  const sky = frozen ? ['#1e2244', '#252c55', '#2c3866', '#344477'] : ['#1c1236', '#24173f', '#2c1f4d', '#35285c'];
  sky.forEach((col, i) => px(0, (top * i) / sky.length, col, bw, top / sky.length + 1));
  for (let i = 0; i < bw / 12; i++) px(r() * bw, r() * top * 0.7, r() < 0.3 ? '#fff6c0' : '#8d86c9');
  // far hills
  x.fillStyle = frozen ? '#3b4a7a' : '#2c2a5a';
  for (let X = 0; X < bw; X++) { const h = 10 + Math.sin(X / 23) * 5 + Math.sin(X / 9 + 2) * 2; x.fillRect(X, top - h, 1, h); }
  // meadow with grass texture
  const g = frozen ? ['#5f8a8f', '#6f9ea2', '#517a80', '#86b6b8'] : ['#2f6a40', '#367a49', '#285c38', '#4c9a58'];
  px(0, top, g[0], bw, bh - top);
  for (let i = 0; i < bw * bh / 30; i++) { const X = r() * bw, Y = top + r() * (bh - top); px(X, Y, g[1 + (r() * 3 | 0)]); if (r() < 0.3) px(X, Y - 1, g[3]); }
  // the pine line of the woods
  for (let i = 0; i < bw / 7; i++) {
    const X = i * 7 + r() * 5, h = 14 + r() * 12, base = top + 2;
    for (let y = 0; y < h; y++) {
      const w = Math.max(1, Math.round((y / h) * 7 * (0.7 + ((y % 4) / 10))));
      px(X - w / 2, base - h + y, y < 3 && frozen ? '#eef8ff' : y % 4 === 0 ? '#1e4d30' : '#163a25', w, 1);
      if (y % 4 === 1 && !frozen) px(X - w / 2, base - h + y, '#2a6a3e', 1, 1);
    }
    px(X - 1, base, '#3b2614', 2, 2);
  }
  // lanes: dirt paths with ruts and pebbles
  for (let i = 0; i < L; i++) {
    const X = x0 + i * lw + Math.round(lw * 0.08), W = Math.round(lw * 0.84);
    const dirt = frozen ? ['#8aa0b0', '#9fb6c4', '#71889a'] : ['#7a5a3a', '#8a6a46', '#664a30'];
    px(X, top, dirt[0], W, wall - top);
    px(X, top, dirt[2], 1, wall - top); px(X + W - 1, top, dirt[2], 1, wall - top);
    for (let k = 0; k < (wall - top) * W / 18; k++) px(X + 1 + r() * (W - 2), top + r() * (wall - top), dirt[r() < 0.5 ? 1 : 2]);
    for (let k = 0; k < (wall - top) / 5; k++) { const Y = top + r() * (wall - top); px(X + 2 + r() * (W - 4), Y, '#b8ab94'); }
    // the owner's colour where the lane meets the wall
    if (lanes[i]) { const col = seatColor(lanes[i]); for (let k = 0; k < 8; k++) { x.globalAlpha = 0.06 + k * 0.03; px(X, wall - 8 + k, col, W, 1); } x.globalAlpha = 1; }
  }
  // the wall: stone courses, mortar, crenellations lit from the upper-left
  const wy = wall + 4, stone = frozen ? ['#a6b6cc', '#8496ae', '#64748c', '#e8f4ff'] : ['#8a8ea8', '#6e7290', '#55587a', '#a9adc6'];
  px(0, wy, stone[1], bw, bh - wy);
  for (let row = 0, Y = wy; Y < bh; row++, Y += 6) {
    px(0, Y, stone[2], bw, 1);
    for (let X = (row % 2) * 7; X < bw; X += 14) { px(X, Y, stone[2], 1, 6); px(X + 1, Y + 1, stone[0], 12, 1); }
  }
  for (let X = 0; X < bw; X += 16) { px(X, wy - 6, stone[1], 9, 6); px(X, wy - 6, stone[3], 9, 1); px(X, wy - 6, stone[3], 1, 6); px(X + 8, wy - 5, stone[2], 1, 5); }
  px(0, wy, stone[3], bw, 1);
  return c;
}

// ---------- the frame ----------
let buf = null, bctx = null;
const sprites = { MONSTERS };

export function drawField(ctx, G, view) {
  const { W, H } = view, s = Math.max(1, Math.round(H / BUF_H)), bw = Math.ceil(W / s), bh = Math.ceil(H / s);
  if (!buf || buf.width !== bw || buf.height !== bh) { buf = makeCanvas(bw, bh); bctx = buf.getContext('2d'); bctx.imageSmoothingEnabled = false; }
  const b = bctx, t = G.t, L = Math.max(1, G.lanes.length), Lb = layoutBuf(bw, bh, L);
  const frozen = G.freezeT > 0, frenzy = G.frenzyT > 0;
  const Lo = { s, W, H, top: Lb.top * s, wall: Lb.wall * s, lw: Lb.lw * s, laneX: i => Lb.laneX(i) * s, yOf: y => Lb.yOf(y) * s, unit: Lb.lw * s };
  const B = v => Math.round(v / s); // screen → buffer

  // scenery (baked)
  const key = [bw, bh, G.lanes.join(), frozen].join('|');
  if (!scenery || scenery.key !== key) scenery = { key, c: bakeScenery(Lb, G.lanes, frozen) };
  b.drawImage(scenery.c, 0, 0);
  if (frenzy) {
    for (let i = 0; i < L; i++) { b.globalAlpha = 0.18; b.fillStyle = `hsl(${(t * 200 + i * 50) % 360},80%,60%)`; b.fillRect(Lb.x0 + i * Lb.lw + 4, Lb.top, Lb.lw - 8, Lb.wall - Lb.top); }
    b.globalAlpha = 1;
  }
  for (let i = 0; i < L; i++) if (G.lanes[i] && !view.live(G.lanes[i])) { b.fillStyle = 'rgba(0,0,0,.4)'; b.fillRect(Lb.x0 + i * Lb.lw, Lb.top, Lb.lw, Lb.wall - Lb.top); }

  // who is aiming at what: a chip glows in its owner's colour, or a helper's when the owner is elsewhere
  const aims = G.phase === 'wave' ? G.lanes.map((_, i) => aim(G, i)) : [];
  const glowOf = (e, lane) => { let c = null; aims.forEach((a, i) => { if (a && a.e === e && a.lane === lane && (!c || i === lane)) c = seatColor(G.lanes[i]); }); return c; };

  // monsters, far ones first
  const fps = frozen ? 2 : 7;
  const es = G.enemies.filter(e => e.y > -0.2).sort((a, b2) => a.y - b2.y);
  for (const e of es) {
    const y = Lb.yOf(e.y), variant = e.hurt > 0 ? 'flash' : frozen ? 'ice' : 'normal';
    const f = Math.floor(t * fps + e.wob * 2);
    if (e.kind === 'boss') {
      // the wyrm: a segment per lane, the head in the middle, each segment rippling a little
      for (let i = 0; i < L; i++) draw(b, wyrmSeg, f + i, Lb.laneX(i), y + Math.round(Math.sin(t * 4 + i) * 1.5), { variant });
      draw(b, wyrmHead, f, bw / 2, y + 4, { variant, sy: e.hurt > 0 ? 0.9 : 1 });
      e.tracks.forEach((tr, i) => {
        const left = tr.slice(e.hits[i]);
        if (left.length) chips(b, left, null, Lb.laneX(i), y + 10, glowOf(e, i), Lb.lw);
        else { b.fillStyle = '#5be37d'; b.fillRect(Lb.laneX(i) - 3, y + 8, 2, 2); b.fillRect(Lb.laneX(i) - 1, y + 10, 2, 2); b.fillRect(Lb.laneX(i) + 1, y + 6, 2, 4); }
      });
      continue;
    }
    const spec = MONSTERS[e.kind], x = Lb.laneX(e.lane);
    const sq = e.hurt > 0 ? e.hurt * 1.5 : 0;
    draw(b, spec, f, x, Math.round(y + spec.h / 2), { variant, sx: 1 + sq, sy: 1 - sq });
    const left = e.arrows.slice(e.hit), flips = e.flip && e.flip.slice(e.hit);
    chips(b, left, flips, x, Math.round(y - spec.h / 2 - 9), glowOf(e, e.lane), Lb.lw);
    if (e.kind === 'spinner' && e.hit === 0) { // a ring that fills as the arrow is about to turn
      const k = e.spin / 0.75, cx = x - Math.min(16, (Lb.lw - 18) / Math.max(1, left.length - 1)) * (left.length - 1) / 2, cy = Math.round(y - spec.h / 2 - 9);
      b.fillStyle = '#3fd2d0';
      for (let a = 0; a < k * Math.PI * 2; a += 0.3) b.fillRect(Math.round(cx + Math.sin(a) * 10), Math.round(cy - Math.cos(a) * 10), 1, 1);
    }
  }
  // the dead, flashing until their spell lands
  for (const d of fx.dying) { const spec = MONSTERS[d.kind]; if (spec) draw(b, spec, 0, B(d.x), B(d.y) + spec.h / 2, { variant: 'flash', sx: 1.1 + d.t, sy: 1.1 - d.t }); }

  // heroes on the wall
  const wy = Lb.wall + 4;
  for (let i = 0; i < G.lanes.length; i++) {
    const seat = G.lanes[i], p = G.players[seat], color = seatColor(seat), x = Lb.laneX(i);
    const a = aims[i], tx = a ? Lb.laneX(a.e.kind === 'boss' ? a.lane : a.e.lane) : x;
    const lunge = fx.lunge[seat] || 0, f = p.stun > 0 ? 3 : lunge > 0.3 ? 2 : Math.floor(t * 2 + i) % 2;
    if (p.combo >= 10 && G.phase === 'wave' && Math.random() < Math.min(0.9, p.combo / 30)) {
      fx.parts.push({ x: (x + (Math.random() - 0.5) * 12) * s, y: (wy - 6) * s, vx: (Math.random() - 0.5) * 40, vy: -120 - Math.random() * 120, life: 0.5, t: 0, color: Math.random() < 0.5 ? '#ffb02e' : '#ff5a3c', r: 4 + Math.random() * 4, g: -100 });
    }
    if (p.super >= 1) { b.globalAlpha = 0.35 + Math.sin(t * 8) * 0.15; b.fillStyle = color; b.fillRect(x - 11, wy - 26, 22, 26); b.globalAlpha = 1; }
    b.globalAlpha = view.live(seat) ? 1 : 0.4;
    draw(b, wizard, f, x, wy + 1 - Math.round(lunge * 2), { opts: color, key: color, flip: tx < x - 2 });
    b.globalAlpha = 1;
    if (p.stun > 0) for (let k = 0; k < 3; k++) { const an = t * 7 + k * 2.1; b.fillStyle = '#ffe14d'; b.fillRect(Math.round(x + Math.cos(an) * 7), Math.round(wy - 27 + Math.sin(an) * 2), 2, 2); }
    // super meter, in pixels
    const mw = Math.min(Lb.lw - 10, 36), mx = x - (mw >> 1), my = Lb.bh - 8;
    b.fillStyle = '#1c1230'; b.fillRect(mx - 1, my - 1, mw + 2, 5);
    b.fillStyle = p.super >= 1 && Math.sin(t * 10) > 0 ? '#ffffff' : color; b.fillRect(mx, my, Math.round(mw * Math.min(1, p.super)), 3);
  }

  // effects, in buffer pixels
  if (frozen && Math.random() < 0.6) fx.snow.push({ x: Math.random() * W, y: -10, v: 60 + Math.random() * 80, p: Math.random() * 6, H });
  b.fillStyle = '#ffffff';
  for (const sn of fx.snow) b.fillRect(B(sn.x), B(sn.y), 1, 1);
  for (const sp of fx.spells) drawSpell(b, sp, B, t);
  for (const bo of fx.bolts) {
    if (Math.random() < 0.25) continue; // flicker
    for (let k = 1; k < bo.pts.length; k++) pixLine(b, B(bo.pts[k - 1][0]), B(bo.pts[k - 1][1]), B(bo.pts[k][0]), B(bo.pts[k][1]), k % 2 ? '#ffffff' : '#cfe6ff', 2);
  }
  for (const p of fx.parts) {
    if (p.t / p.life > 0.7 && Math.random() < 0.5) continue; // fizzle out instead of fading
    const r = Math.max(1, Math.round(p.r / s * (1 - p.t / p.life * 0.5)));
    b.fillStyle = p.color; b.fillRect(B(p.x) - (r >> 1), B(p.y) - (r >> 1), r, r);
  }

  // HUD in pixels: hearts and the team frenzy bar
  if (G.wave) {
    const n = Math.min(MAX_HEARTS, Math.max(G.hearts, view.maxHearts || 5)), hx = (bw >> 1) - n * 6;
    for (let k = 0; k < n; k++) draw(b, heart, k < G.hearts ? 0 : 1, hx + k * 12 + 5, 13, { scale: 1 });
    const fw = 90, fx0 = (bw >> 1) - 45, fy = 17, fill = frenzy ? G.frenzyT / FRENZY : G.frenzy;
    b.fillStyle = '#1c1230'; b.fillRect(fx0 - 1, fy - 1, fw + 2, 5);
    b.fillStyle = frenzy ? `hsl(${(t * 300) % 360},90%,60%)` : '#ff8a3c'; b.fillRect(fx0, fy, Math.round(fw * fill), 3);
  }

  // up to the screen
  ctx.imageSmoothingEnabled = false;
  const sh = fx.shake > 0 ? s * Math.round((Math.random() - 0.5) * fx.shake / s) : 0, sv = fx.shake > 0 ? s * Math.round((Math.random() - 0.5) * fx.shake / s) : 0;
  ctx.fillStyle = '#1c1236'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(buf, sh, sv, bw * s, bh * s);
  if (fx.flash > 0) { ctx.fillStyle = fx.flashColor; ctx.globalAlpha = fx.flash * 0.3; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (frenzy) { ctx.lineWidth = s * 3; ctx.strokeStyle = `hsl(${(t * 300) % 360},90%,60%)`; ctx.strokeRect(0, 0, W, H); }

  // crisp text on top
  text(ctx, G, view, Lo, Lb, s, t, frozen, frenzy);
  return Lo;
}

function text(ctx, G, view, Lo, Lb, s, t, frozen, frenzy) {
  const { W, H } = view;
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const label = (str, x, y, size, col = '#fff', weight = 800) => {
    ctx.font = `${weight} ${Math.round(size)}px ui-rounded, system-ui, sans-serif`;
    ctx.lineWidth = Math.max(3, size * 0.22); ctx.strokeStyle = 'rgba(20,10,40,.85)'; ctx.strokeText(str, x, y); ctx.fillStyle = col; ctx.fillText(str, x, y);
  };
  const wyS = (Lb.wall + 4) * s;
  for (let i = 0; i < G.lanes.length; i++) {
    const seat = G.lanes[i], p = G.players[seat], x = Lo.laneX(i);
    label(view.name(seat), x, wyS + H * 0.07, H * 0.028, seatColor(seat), 900);
    label(`${p.score.toLocaleString()}${p.combo >= 5 ? ` · ${p.combo}×${p.combo >= 10 ? '🔥' : ''}` : ''}`, x, wyS + H * 0.105, H * 0.023, p.combo >= 10 ? '#ffb02e' : '#ece6ff', 800);
    if (p.super >= 1) label('TAP FOR SUPER!', x, H - H * 0.04, H * 0.018, '#fff', 900);
    if (!view.live(seat) && G.phase !== 'lobby') label('reconnecting…', x, (Lo.top + Lo.wall) / 2, H * 0.025);
  }
  for (const p of fx.pops) { ctx.globalAlpha = Math.min(1, 2 * (1 - p.t / p.life)); label(p.text, p.x, p.y, p.size, p.color, 900); }
  ctx.globalAlpha = 1;
  if (!G.wave) return;
  ctx.textAlign = 'left'; label(`Wave ${G.wave}`, H * 0.03, H * 0.07, H * 0.045, '#fff', 900);
  if (frozen) label(`❄️ ${Math.ceil(G.freezeT)}s`, H * 0.03, H * 0.12, H * 0.03, '#bfe8ff');
  ctx.textAlign = 'center';
  label(frenzy ? `🔥 FRENZY · DOUBLE POINTS · ${Math.ceil(G.frenzyT)}s` : 'TEAM FRENZY', W / 2, 26 * s + H * 0.02, H * 0.017, '#fff', 900);
}

// A row of chips: what is left to swipe or draw on a monster. The first has a ring in the colour of whoever is
// aiming at it. Rows wider than the lane overlap a little rather than spill into the next lane.
function chips(b, tokens, flips, cx, cy, glow, lw) {
  const n = tokens.length, gap = Math.min(16, (lw - 18) / Math.max(1, n - 1)), x0 = cx - (gap * (n - 1)) / 2;
  for (let i = n - 1; i >= 0; i--) {
    const tk = tokens[i], kind = isShapeToken(tk) ? 'shape' : flips && flips[i] ? 'trick' : 'arrow';
    const x = Math.round(x0 + i * gap), y = cy;
    if (i === 0 && glow) { b.fillStyle = glow; b.fillRect(x - 9, y - 9, 18, 18); b.fillStyle = '#1c1230'; b.fillRect(x - 8, y - 8, 16, 16); }
    b.globalAlpha = i === 0 ? 1 : 0.8;
    draw(b, chip, 0, x, y, { opts: { kind, glyph: tk }, key: kind + tk });
    b.globalAlpha = 1;
  }
}

function pixLine(b, x0, y0, x1, y1, col, w = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); b.fillStyle = col;
  for (let i = 0; i <= n; i++) b.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), w, w);
}

function drawSpell(b, sp, B, t) {
  const k = Math.min(1, sp.t / sp.life), x = B(sp.x0 + (sp.tx - sp.x0) * k), y = B(sp.y0 + (sp.ty - sp.y0) * k - Math.sin(k * Math.PI) * 40);
  const tx = B(sp.tx), ty = B(sp.ty);
  if (sp.token === 'circle') { // fireball
    b.fillStyle = '#ff5a3c'; b.fillRect(x - 3, y - 3, 7, 7); b.fillStyle = '#ffb02e'; b.fillRect(x - 2, y - 2, 5, 5); b.fillStyle = '#fff3a0'; b.fillRect(x - 1, y - 1, 3, 3);
  } else if (sp.token === 'tri') { // a charging spark, then lightning on impact
    b.fillStyle = '#cfe6ff'; b.fillRect(x - 2, y - 2, 4, 4); b.fillStyle = '#ffffff'; b.fillRect(x - 1, y - 1, 2, 2);
  } else if (sp.token === 'square') { // an ice cage closing in on the monster
    const r = Math.round(16 * (1 - k)) + 7; b.fillStyle = '#bfe8ff';
    b.fillRect(tx - r, ty - r, r * 2, 2); b.fillRect(tx - r, ty + r - 2, r * 2, 2); b.fillRect(tx - r, ty - r, 2, r * 2); b.fillRect(tx + r - 2, ty - r, 2, r * 2);
    b.globalAlpha = 0.25 * k; b.fillRect(tx - r, ty - r, r * 2, r * 2); b.globalAlpha = 1;
  } else if (sp.token === 'zig') { // a little whirlwind
    for (let i = 0; i < 6; i++) { const a = t * 30 + i; b.fillStyle = i % 2 ? '#5be37d' : '#b8ffcf'; b.fillRect(Math.round(x + Math.cos(a) * (2 + i)), Math.round(y - i * 2 + Math.sin(a)), 2, 1); }
  } else if (sp.token === 'v') { // a beam of light from above
    const w = Math.round(2 + 6 * Math.sin(k * Math.PI)); b.globalAlpha = 0.85; b.fillStyle = '#ffe14d'; b.fillRect(tx - (w >> 1), 0, w, ty);
    b.fillStyle = '#ffffff'; b.fillRect(tx - (w >> 2), 0, Math.max(1, w >> 1), ty); b.globalAlpha = 1;
  } else { // magic missile
    b.fillStyle = sp.color; b.fillRect(x - 2, y - 2, 4, 4); b.fillStyle = '#ffffff'; b.fillRect(x - 1, y - 1, 2, 2);
  }
}

// Bake everything up front so the first wave never stutters on a new frame.
export function warmUp() {
  for (const spec of [...Object.values(MONSTERS), wyrmHead, wyrmSeg]) for (let f = 0; f < spec.frames; f++) for (const v of ['normal', 'flash', 'ice']) frame(spec, f, v);
  for (const c of COLORS) for (let f = 0; f < 4; f++) frame(wizard, f, 'normal', c, c);
  for (const g of ['u', 'd', 'l', 'r', 'circle', 'tri', 'square', 'zig', 'v']) for (const kind of ['arrow', 'shape', 'trick']) frame(chip, 0, 'normal', { kind, glyph: g }, kind + g);
  frame(heart, 0); frame(heart, 1);
}
export { mix };
