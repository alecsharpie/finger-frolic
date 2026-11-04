// Everything the TV draws: the field, monsters, their arrows, the heroes on the wall, and the effects. All canvas,
// no images, so there is nothing to load.
import { aim, MAX_HEARTS, FRENZY } from './game.js';

// player colours: none of them green, so a hero never looks like a grunt
export const COLORS = ['#ff5a8a', '#3fb6ff', '#ffd23f', '#c58bff', '#ff9a3c', '#2ee6d6', '#f2f2f2', '#ff6bd6'];
export const seatColor = seat => COLORS[(+String(seat).slice(1) - 1) % COLORS.length];

export const BODY = { grunt: '#6fd36a', brute: '#9b6bff', runner: '#ff9f43', spinner: '#3fd2d0', trickster: '#ff5d73', gift: '#ffcf33', boss: '#5b4bd6' };
const SIZE = { grunt: 1, brute: 1.35, runner: 0.8, spinner: 1, trickster: 1, gift: 0.9, boss: 1 };
const ANGLE = { u: -Math.PI / 2, r: 0, d: Math.PI / 2, l: Math.PI };

export function layout(W, H, L) {
  const top = H * 0.13, wall = H * 0.8;
  const lw = Math.min((W * 0.94) / Math.max(1, L), Math.min(W * 0.34, H * 0.5));
  const x0 = (W - lw * L) / 2;
  return { W, H, L, top, wall, lw, x0, laneX: i => x0 + lw * (i + 0.5), yOf: y => top + y * (wall - top), unit: Math.min(lw, H * 0.25) };
}

// ---------- effects ----------
export const fx = { parts: [], pops: [], slashes: [], bolts: [], snow: [], shake: 0, flash: 0, flashColor: '#ff3355', lunge: {} };

export function burst(x, y, color, n = 18, speed = 420) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.7);
    fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.5 + Math.random() * 0.4, t: 0, color, r: 4 + Math.random() * 6, g: 900 });
  }
}
export function popup(x, y, text, color = '#fff', size = 34) { fx.pops.push({ x, y, text, color, size, t: 0, life: 1 }); }
export function slash(x1, y1, x2, y2, color) { fx.slashes.push({ x1, y1, x2, y2, color, t: 0, life: 0.18 }); }
export function bolt(x, y) {
  const pts = [[x + (Math.random() - 0.5) * 60, -10]];
  for (let k = 1; k <= 8; k++) pts.push([x + (Math.random() - 0.5) * 70 * (1 - k / 9), (y * k) / 8]);
  fx.bolts.push({ pts, t: 0, life: 0.45 });
}

export function tickFx(dt) {
  for (const p of fx.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.98; }
  fx.parts = fx.parts.filter(p => p.t < p.life);
  for (const p of fx.pops) { p.t += dt; p.y -= 70 * dt; }
  fx.pops = fx.pops.filter(p => p.t < p.life);
  for (const s of fx.slashes) s.t += dt;
  fx.slashes = fx.slashes.filter(s => s.t < s.life);
  for (const b of fx.bolts) b.t += dt;
  fx.bolts = fx.bolts.filter(b => b.t < b.life);
  for (const s of fx.snow) { s.y += s.v * dt; s.x += Math.sin(s.y / 40 + s.p) * 20 * dt; }
  fx.snow = fx.snow.filter(s => s.y < s.H);
  fx.shake = Math.max(0, fx.shake - dt * 30);
  fx.flash = Math.max(0, fx.flash - dt * 2.5);
  for (const k in fx.lunge) fx.lunge[k] = Math.max(0, fx.lunge[k] - dt * 6);
}

// ---------- pieces ----------
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function arrowChip(ctx, x, y, s, dir, { fill = '#ffffff', ink = '#1b1530', glow = null, trick = false, alpha = 1 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = s * 0.6; }
  rr(ctx, -s / 2, -s / 2, s, s, s * 0.24);
  ctx.fillStyle = trick ? '#ff3b5c' : fill; ctx.fill();
  ctx.shadowBlur = 0;
  if (glow) { ctx.lineWidth = Math.max(3, s * 0.09); ctx.strokeStyle = glow; ctx.stroke(); }
  if (trick) { ctx.setLineDash([s * 0.12, s * 0.1]); ctx.lineWidth = Math.max(2, s * 0.06); ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.setLineDash([]); }
  ctx.rotate(ANGLE[dir]);
  ctx.fillStyle = trick ? '#fff' : ink;
  const a = s * 0.3;
  ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(-a * 0.15, -a * 0.9); ctx.lineTo(-a * 0.15, -a * 0.35); ctx.lineTo(-a, -a * 0.35);
  ctx.lineTo(-a, a * 0.35); ctx.lineTo(-a * 0.15, a * 0.35); ctx.lineTo(-a * 0.15, a * 0.9); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function eyes(ctx, x, y, r, lookX = 0, lookY = 1, angry = false, ouch = false) {
  for (const sx of [-1, 1]) {
    const ex = x + sx * r * 0.36, ey = y - r * 0.1;
    if (ouch) { // squeezed shut: > <
      ctx.strokeStyle = '#1b1530'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - sx * r * 0.15, ey - r * 0.12); ctx.lineTo(ex + sx * r * 0.1, ey); ctx.lineTo(ex - sx * r * 0.15, ey + r * 0.12); ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.24, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b1530'; ctx.beginPath(); ctx.arc(ex + lookX * r * 0.09, ey + lookY * r * 0.09, r * 0.12, 0, 7); ctx.fill();
    if (angry) {
      ctx.strokeStyle = '#1b1530'; ctx.lineWidth = r * 0.09; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - sx * r * 0.22, ey - r * 0.34); ctx.lineTo(ex + sx * r * 0.18, ey - r * 0.2); ctx.stroke();
    }
  }
}

function monster(ctx, e, x, y, r, t, frozen) {
  const c = BODY[e.kind], speed = frozen ? 0.25 : 1, bob = Math.sin(t * speed * (e.kind === 'runner' ? 18 : 7) + e.wob) * r * 0.06;
  const ouch = e.hurt > 0, sq = ouch ? 1 + e.hurt * 2 : 1;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, r * 0.95 - bob, r * 0.8, r * 0.18, 0, 0, 7); ctx.fill();
  ctx.scale(sq, 1 / sq);
  if (e.kind === 'gift') {
    // a wrapped present that hops along
    ctx.rotate(Math.sin(t * 9 + e.wob) * 0.12);
    ctx.shadowColor = '#fff3a0'; ctx.shadowBlur = 18 + Math.sin(t * 6) * 8;
    ctx.fillStyle = ouch ? '#fff' : c; rr(ctx, -r, -r * 0.75, r * 2, r * 1.65, r * 0.2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff4f7b'; ctx.fillRect(-r * 0.16, -r * 0.75, r * 0.32, r * 1.65); ctx.fillRect(-r, -r * 0.1, r * 2, r * 0.3);
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r * 0.32, -r * 0.92, r * 0.34, r * 0.2, sx * 0.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-r * 0.85, -r * 0.62, r * 0.25, r * 0.5);
    if (Math.random() < 0.2) { ctx.fillStyle = '#fff'; ctx.font = `${r * 0.5}px system-ui`; ctx.fillText('✦', (Math.random() - 0.5) * r * 2.4, (Math.random() - 0.7) * r * 2); }
    ctx.restore();
    return;
  }
  // feet
  ctx.fillStyle = shade(c, -0.25);
  const step = Math.sin(t * speed * (e.kind === 'runner' ? 22 : 9) + e.wob) * r * 0.15;
  ctx.beginPath(); ctx.ellipse(-r * 0.4, r * 0.8 + step, r * 0.22, r * 0.16, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r * 0.4, r * 0.8 - step, r * 0.22, r * 0.16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = ouch ? '#ffffff' : c;
  if (e.kind === 'brute') {
    rr(ctx, -r, -r * 0.85, r * 2, r * 1.75, r * 0.45); ctx.fill();
    ctx.fillStyle = '#f4e6c8';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * r * 0.55, -r * 0.8); ctx.lineTo(sx * r * 0.95, -r * 1.35); ctx.lineTo(sx * r * 0.85, -r * 0.7); ctx.fill(); }
  } else if (e.kind === 'spinner') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = shade(c, 0.35); ctx.lineWidth = r * 0.1;
    ctx.beginPath(); for (let a = 0; a < 9; a += 0.2) { const rad = r * 0.08 * a; ctx.lineTo(Math.cos(a + t * 6) * rad, Math.sin(a + t * 6) * rad + r * 0.3); } ctx.stroke();
  } else if (e.kind === 'runner') {
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r, 0, 0, 7); ctx.fill();
    ctx.fillStyle = shade(c, 0.3); ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.95); ctx.lineTo(0, -r * 1.4); ctx.lineTo(r * 0.3, -r * 0.95); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    if (e.kind === 'trickster') { ctx.fillStyle = '#1b1530'; rr(ctx, -r * 0.75, -r * 0.42, r * 1.5, r * 0.5, r * 0.25); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.3, r * 0.18, -0.5, 0, 7); ctx.fill();
  eyes(ctx, 0, 0, r, 0, 1, e.kind !== 'grunt', ouch);
  ctx.fillStyle = '#1b1530'; ctx.beginPath();
  if (ouch) ctx.ellipse(0, r * 0.42, r * 0.18, r * 0.2, 0, 0, 7); else ctx.ellipse(0, r * 0.38, r * 0.25, r * 0.12, 0, 0, Math.PI);
  ctx.fill();
  if (frozen) { ctx.fillStyle = 'rgba(170,225,255,.45)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.08, 0, 7); ctx.fill(); }
  ctx.restore();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function arrowRow(ctx, dirs, flips, x, y, s, color) {
  const gap = s * 0.18, w = dirs.length * s + (dirs.length - 1) * gap;
  dirs.forEach((d, i) => {
    const first = i === 0, sz = first && color ? s * 1.18 : s;
    arrowChip(ctx, x - w / 2 + i * (s + gap) + s / 2, y, sz, d, { glow: first ? color : null, trick: flips && flips[i], alpha: first ? 1 : 0.75 });
  });
}

function hero(ctx, x, y, r, color, p, t, live, lunge, look) {
  ctx.save(); ctx.translate(x + look * lunge * r * 0.5, y - lunge * r * 0.5);
  ctx.globalAlpha = live ? 1 : 0.35;
  if (p.super >= 1) { ctx.shadowColor = color; ctx.shadowBlur = 30 + Math.sin(t * 8) * 12; }
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.3, r * 0.18, -0.5, 0, 7); ctx.fill();
  eyes(ctx, 0, 0, r, look * 0.6, -1);
  ctx.fillStyle = '#1b1530'; ctx.beginPath(); ctx.arc(0, r * 0.32, r * (p.combo >= 10 ? 0.3 : 0.22), 0, Math.PI); ctx.fill();
  // a little sword
  ctx.save(); ctx.translate(r * 0.85, -r * 0.1); ctx.rotate(-0.6 - lunge * 1.2);
  ctx.fillStyle = '#d9e2f2'; ctx.fillRect(-r * 0.07, -r * 1.1, r * 0.14, r * 0.95); ctx.fillStyle = '#7a4d2b'; ctx.fillRect(-r * 0.22, -r * 0.18, r * 0.44, r * 0.12);
  ctx.restore();
  if (p.stun > 0) {
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * 2.1;
      ctx.fillStyle = '#ffe14d'; ctx.font = `${r * 0.5}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText('★', Math.cos(a) * r * 0.8, -r * 1.05 + Math.sin(a) * r * 0.25);
    }
  }
  ctx.restore();
}

// ---------- the whole frame ----------
export function drawField(ctx, G, view) {
  const { W, H } = view, t = G.t, L = Math.max(1, G.lanes.length), Lo = layout(W, H, L);
  const frozen = G.freezeT > 0, frenzy = G.frenzyT > 0;
  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * fx.shake * 2, (Math.random() - 0.5) * fx.shake * 2);

  // sky to meadow
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, frenzy ? `hsl(${(t * 120) % 360},55%,22%)` : '#24163f'); g.addColorStop(0.14, '#2f2a5c');
  g.addColorStop(0.15, frozen ? '#3d6f7a' : '#2b5d3c'); g.addColorStop(1, frozen ? '#2a4f5c' : '#1d3f2c');
  ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
  // woods
  for (let i = 0; i < 26; i++) {
    const x = (i / 25) * W, h = H * (0.07 + ((i * 37) % 11) / 110);
    ctx.fillStyle = i % 2 ? '#173826' : '#1e4630';
    ctx.beginPath(); ctx.moveTo(x - W * 0.04, Lo.top); ctx.lineTo(x, Lo.top - h); ctx.lineTo(x + W * 0.04, Lo.top); ctx.fill();
    if (frozen) { ctx.fillStyle = '#eaf6ff'; ctx.beginPath(); ctx.moveTo(x - W * 0.012, Lo.top - h * 0.7); ctx.lineTo(x, Lo.top - h); ctx.lineTo(x + W * 0.012, Lo.top - h * 0.7); ctx.fill(); }
  }
  // lanes
  for (let i = 0; i < L; i++) {
    const seat = G.lanes[i], live = view.live(seat), x = Lo.x0 + i * Lo.lw;
    ctx.fillStyle = frenzy ? `hsla(${(t * 200 + i * 50) % 360},70%,60%,.22)` : i % 2 ? 'rgba(160,120,70,.22)' : 'rgba(160,120,70,.3)';
    ctx.fillRect(x + Lo.lw * 0.06, Lo.top, Lo.lw * 0.88, Lo.wall - Lo.top);
    if (seat) {
      ctx.fillStyle = seatColor(seat) + '22'; ctx.fillRect(x + Lo.lw * 0.06, Lo.wall - H * 0.08, Lo.lw * 0.88, H * 0.08);
      if (!live) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, Lo.top, Lo.lw, Lo.wall - Lo.top);
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(Lo.unit * 0.11)}px system-ui`; ctx.textAlign = 'center';
        ctx.fillText('reconnecting…', Lo.laneX(i), (Lo.top + Lo.wall) / 2);
      }
    }
  }

  // who is swinging at what: a monster glows in its owner's colour, or a helper's when the owner is elsewhere
  const aims = G.phase === 'wave' ? G.lanes.map((_, i) => aim(G, i)) : [];
  const glowOf = (e, lane) => {
    let c = null;
    aims.forEach((a, i) => { if (a && a.e === e && a.lane === lane && (!c || i === lane)) c = seatColor(G.lanes[i]); });
    return c;
  };

  // monsters, far ones first
  const es = G.enemies.filter(e => e.y > -0.2).sort((a, b) => a.y - b.y);
  const chip = Math.max(22, Math.min(46, Lo.unit * 0.16));
  for (const e of es) {
    const y = Lo.yOf(e.y);
    if (e.kind === 'boss') {
      const w = Lo.lw * L * 0.96, r = Math.min(H * 0.12, w * 0.3), sq = e.hurt > 0 ? 1 + e.hurt * 0.4 : 1;
      ctx.save(); ctx.translate(W / 2, y); ctx.scale(1, 1 / sq);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.9, w * 0.5, r * 0.25, 0, 0, 7); ctx.fill();
      ctx.fillStyle = e.hurt > 0 ? '#8d80ff' : BODY.boss; rr(ctx, -w / 2, -r, w, r * 1.8, r * 0.7); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * r * 0.5 - r * 0.18, -r); ctx.lineTo(k * r * 0.5, -r * 1.45); ctx.lineTo(k * r * 0.5 + r * 0.18, -r); ctx.fill(); }
      if (frozen) { ctx.fillStyle = 'rgba(170,225,255,.4)'; rr(ctx, -w / 2, -r, w, r * 1.8, r * 0.7); ctx.fill(); }
      ctx.restore();
      eyes(ctx, W / 2, y - r * 0.1, r * 0.9, 0, 1, true, e.hurt > 0);
      e.tracks.forEach((tr, i) => {
        const left = tr.slice(e.hits[i]);
        if (left.length) arrowRow(ctx, left, null, Lo.laneX(i), y + r * 0.55, chip, glowOf(e, i));
        else { ctx.fillStyle = '#5be37d'; ctx.font = `800 ${chip}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('✓', Lo.laneX(i), y + r * 0.7); }
      });
      continue;
    }
    const x = Lo.laneX(e.lane), r = Lo.unit * 0.17 * SIZE[e.kind];
    monster(ctx, e, x, y, r, t, frozen);
    const left = e.arrows.slice(e.hit), flips = e.flip && e.flip.slice(e.hit);
    const glow = glowOf(e, e.lane);
    arrowRow(ctx, left, flips, x, y - r - chip * 0.85, glow ? chip : chip * 0.85, glow);
    if (e.kind === 'spinner' && e.hit === 0) {
      ctx.strokeStyle = '#3fd2d0'; ctx.lineWidth = 4; ctx.beginPath();
      ctx.arc(x - (left.length - 1) * chip * 0.59, y - r - chip * 0.85, chip * 0.75, -Math.PI / 2, -Math.PI / 2 + (e.spin / 0.75) * Math.PI * 2); ctx.stroke();
    }
  }

  // the wall
  const wy = Lo.wall + H * 0.02;
  ctx.fillStyle = '#6b6f86'; ctx.fillRect(0, wy, W, H - wy);
  ctx.fillStyle = frozen ? '#c9e6f5' : '#80859e';
  const bw = H * 0.05;
  for (let x = 0; x < W; x += bw * 2) ctx.fillRect(x, wy - bw * 0.55, bw, bw * 0.6);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let row = 0; row < 4; row++) for (let x = (row % 2) * bw * 0.6; x < W; x += bw * 1.2) ctx.fillRect(x, wy + row * bw * 0.55 + 4, 2, bw * 0.5);

  // heroes
  for (let i = 0; i < G.lanes.length; i++) {
    const seat = G.lanes[i], p = G.players[seat], color = seatColor(seat), x = Lo.laneX(i);
    const a = aims[i], tx = a ? Lo.laneX(a.e.kind === 'boss' ? a.lane : a.e.lane) : x;
    const look = Math.max(-1, Math.min(1, (tx - x) / 100));
    const r = Math.min(Lo.unit * 0.15, H * 0.05);
    // combo flames
    if (p.combo >= 10 && G.phase === 'wave' && Math.random() < Math.min(0.9, p.combo / 30)) {
      fx.parts.push({ x: x + (Math.random() - 0.5) * r * 1.4, y: wy - r * 0.3, vx: (Math.random() - 0.5) * 40, vy: -120 - Math.random() * 120, life: 0.5, t: 0, color: Math.random() < 0.5 ? '#ffb02e' : '#ff5a3c', r: 3 + Math.random() * 5, g: -100 });
    }
    hero(ctx, x, wy - r * 0.2, r, color, p, t, view.live(seat), fx.lunge[seat] || 0, look);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(H * 0.026)}px system-ui`;
    ctx.fillText(view.name(seat), x, wy + H * 0.075);
    ctx.font = `700 ${Math.round(H * 0.022)}px system-ui`; ctx.fillStyle = p.combo >= 10 ? '#ffb02e' : '#e7e2ff';
    ctx.fillText(`${p.score.toLocaleString()}${p.combo >= 5 ? `  ·  ${p.combo}×${p.combo >= 10 ? '🔥' : ''}` : ''}`, x, wy + H * 0.11);
    // super meter
    const mw = Math.min(Lo.lw * 0.7, H * 0.18), mh = H * 0.014, my = wy + H * 0.13;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, x - mw / 2, my, mw, mh, mh / 2); ctx.fill();
    ctx.fillStyle = p.super >= 1 ? (Math.sin(t * 10) > 0 ? '#fff' : color) : color;
    if (p.super > 0) { rr(ctx, x - mw / 2, my, Math.max(mh, mw * p.super), mh, mh / 2); ctx.fill(); }
    if (p.super >= 1) { ctx.font = `800 ${Math.round(H * 0.018)}px system-ui`; ctx.fillStyle = '#fff'; ctx.fillText('TAP FOR SUPER!', x, my + H * 0.04); }
  }

  // effects
  if (frozen && Math.random() < 0.7) fx.snow.push({ x: Math.random() * W, y: -10, v: 60 + Math.random() * 80, p: Math.random() * 6, r: 2 + Math.random() * 4, H });
  ctx.fillStyle = '#ffffff';
  for (const s of fx.snow) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const s of fx.slashes) {
    ctx.globalAlpha = 1 - s.t / s.life; ctx.strokeStyle = s.color; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  for (const b of fx.bolts) {
    ctx.globalAlpha = Math.random() < 0.3 ? 0.4 : 1 - b.t / b.life;
    for (const [w, c] of [[16, 'rgba(160,200,255,.6)'], [6, '#ffffff']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round';
      ctx.beginPath(); b.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const p of fx.parts) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const p of fx.pops) {
    ctx.globalAlpha = Math.min(1, 2 * (1 - p.t / p.life)); ctx.font = `900 ${p.size}px system-ui`;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,10,40,.8)'; ctx.strokeText(p.text, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (fx.flash > 0) { ctx.fillStyle = fx.flashColor; ctx.globalAlpha = fx.flash * 0.35; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (frenzy) { // a rainbow frame around the whole TV
    ctx.lineWidth = H * 0.012; ctx.strokeStyle = `hsl(${(t * 300) % 360},90%,60%)`; ctx.strokeRect(0, 0, W, H);
  }

  // HUD
  if (!G.wave) return Lo;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(H * 0.045)}px system-ui`;
  ctx.fillText(`Wave ${G.wave}`, H * 0.03, H * 0.065);
  if (frozen) { ctx.font = `800 ${Math.round(H * 0.03)}px system-ui`; ctx.fillStyle = '#bfe8ff'; ctx.fillText(`❄️ ${Math.ceil(G.freezeT)}s`, H * 0.03, H * 0.11); }
  ctx.textAlign = 'center'; ctx.font = `${Math.round(H * 0.045)}px system-ui`;
  let hearts = '';
  for (let i = 0; i < Math.max(G.hearts, 5) && i < MAX_HEARTS; i++) hearts += i < G.hearts ? '❤️' : '🖤';
  ctx.fillText(hearts, W / 2, H * 0.065);
  // team frenzy meter
  const fw = H * 0.4, fh = H * 0.016, fx0 = W / 2 - fw / 2, fy = H * 0.088;
  ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(ctx, fx0, fy, fw, fh, fh / 2); ctx.fill();
  const fill = frenzy ? G.frenzyT / FRENZY : G.frenzy;
  if (fill > 0) { ctx.fillStyle = frenzy ? `hsl(${(t * 300) % 360},90%,60%)` : '#ff8a3c'; rr(ctx, fx0, fy, Math.max(fh, fw * fill), fh, fh / 2); ctx.fill(); }
  ctx.font = `900 ${Math.round(H * 0.017)}px system-ui`; ctx.fillStyle = '#fff';
  ctx.fillText(frenzy ? `🔥 FRENZY · DOUBLE POINTS · ${Math.ceil(G.frenzyT)}s` : 'TEAM FRENZY', W / 2, fy + fh + H * 0.024);
  return Lo;
}
