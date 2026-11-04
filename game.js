// Finger Frolic rules. Pure: no DOM, no network, no clock (the board calls step() with dt), so it runs in tests.
//
// The field is one lane per player. Monsters march down the lanes from y = 0 (the woods) to y = 1 (the wall).
// Each monster carries a row of arrows; the lane's player swipes them in order on their phone. A right swipe
// knocks off the next arrow, a wrong one leaves you dizzy for a moment and drops your combo. A monster that
// reaches the wall costs the team a heart. Every 5th wave a boss spans every lane, and each player has to clear
// their own row of its arrows, so it only falls when everyone does their part.

export const DIRS = ['u', 'r', 'd', 'l'];
export const OPPOSITE = { u: 'd', d: 'u', l: 'r', r: 'l' };
export const SEATS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];

export const START_HEARTS = 5, MAX_HEARTS = 8;
export const STUN = 0.5;            // seconds dizzy after a wrong swipe
export const BREAK = 4;             // seconds between waves
export const SUPER_PER_HIT = 0.07;  // a super needs ~15 good swipes
export const BOSS_EVERY = 5;

// speed: lane lengths per second at wave 1 (1/9 = nine seconds from the woods to the wall)
export const KINDS = {
  grunt:     { arrows: [1, 1], speed: 1 / 9,  points: 50,  from: 1 },
  brute:     { arrows: [2, 3], speed: 1 / 13, points: 120, from: 2 },
  runner:    { arrows: [1, 1], speed: 1 / 5,  points: 80,  from: 3 },
  spinner:   { arrows: [1, 2], speed: 1 / 10, points: 100, from: 4 }, // its next arrow turns until you hit it
  trickster: { arrows: [2, 2], speed: 1 / 10, points: 100, from: 6 }, // red arrows: swipe the other way
  boss:      { arrows: [6, 6], speed: 1 / 18, points: 600, from: BOSS_EVERY },
};
export const SPIN_EVERY = 0.75;
export const SPACING = 0.17;      // lane lengths between monsters in one lane, so their arrows never overlap

export function rng(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const between = (r, [a, b]) => a + Math.floor(r() * (b - a + 1));

export function newPlayer(name = '') {
  return { name, score: 0, combo: 0, best: 0, kills: 0, super: 0, stun: 0, ev: 0, last: '' };
}

export function newGame(seed) {
  return { phase: 'lobby', t: 0, wave: 0, hearts: START_HEARTS, lanes: [], players: {}, enemies: [], queue: [],
    next: 1, timer: 0, r: rng(seed), log: [], lost: 0 };
}

// Make sure a seat has a player record (they keep their score if they drop out and come back).
export function addPlayer(G, seat, name) {
  if (!G.players[seat]) G.players[seat] = newPlayer(name);
  else if (name) G.players[seat].name = name;
  return G.players[seat];
}

// seats: who plays the next wave, in lane order.
export function startGame(G, seats) {
  const seed = Math.floor(G.r() * 2 ** 31);
  const fresh = newGame(seed);
  for (const s of seats) fresh.players[s] = newPlayer(G.players[s]?.name);
  Object.assign(G, fresh);
  startWave(G, seats);
}

export const speedScale = wave => Math.min(2.2, 1 + 0.08 * (wave - 1));
export const isBossWave = wave => wave > 0 && wave % BOSS_EVERY === 0;

export function waveSize(wave, lanes) {
  return Math.round(lanes * (2.5 + wave * 1.2));
}

// Build the spawn list for a wave: [{at, kind, lane}] sorted by time.
export function planWave(wave, lanes, r) {
  const kinds = Object.keys(KINDS).filter(k => k !== 'boss' && KINDS[k].from <= wave);
  const n = waveSize(wave, lanes);
  const gap = Math.max(0.55, 2.4 - wave * 0.15) / Math.sqrt(lanes); // seconds between spawns across the field
  const out = [];
  let at = 1.2;
  for (let i = 0; i < n; i++) {
    // newer kinds show up less often, so the wave is mostly what you already know
    const w = kinds.map(k => (k === 'grunt' ? 3 : 1) + (wave - KINDS[k].from > 1 ? 1 : 0));
    let x = r() * w.reduce((a, b) => a + b, 0), kind = kinds[0];
    for (let j = 0; j < kinds.length; j++) { x -= w[j]; if (x < 0) { kind = kinds[j]; break; } }
    out.push({ at, kind, lane: Math.floor(r() * lanes) });
    at += gap * (0.6 + r() * 0.8);
  }
  // the boss closes its wave and comes alone (step() holds it until the field is clear)
  if (isBossWave(wave)) out.push({ at: at + 2, kind: 'boss', lane: -1 });
  return out;
}

export function startWave(G, seats) {
  G.wave++;
  G.lanes = seats.slice();
  for (const s of seats) addPlayer(G, s);
  G.queue = planWave(G.wave, G.lanes.length, G.r);
  G.enemies = [];
  G.phase = 'wave';
  G.timer = 0;
  say(G, 'wave', G.wave);
}

function makeEnemy(G, { kind, lane }) {
  const K = KINDS[kind], L = G.lanes.length;
  const row = n => Array.from({ length: n }, () => pick(G.r, DIRS));
  const e = { id: G.next++, kind, lane, y: -0.04, speed: K.speed * speedScale(G.wave), hit: 0, spin: 0, wob: G.r() * 6.28 };
  if (kind === 'boss') {
    const n = between(G.r, K.arrows) + Math.floor(G.wave / BOSS_EVERY) - 1;
    e.tracks = Array.from({ length: L }, () => row(n));
    e.hits = e.tracks.map(() => 0);
  } else {
    e.arrows = row(between(G.r, K.arrows));
    if (kind === 'trickster') e.flip = e.arrows.map(() => G.r() < 0.6);
  }
  return e;
}

// What the given lane needs swiped next on this enemy, or null if this enemy is done in that lane.
export function need(e, lane) {
  if (e.kind === 'boss') {
    const t = e.tracks[lane];
    return t && e.hits[lane] < t.length ? t[e.hits[lane]] : null;
  }
  if (e.lane !== lane || e.hit >= e.arrows.length) return null;
  const a = e.arrows[e.hit];
  return e.flip && e.flip[e.hit] ? OPPOSITE[a] : a;
}

// The enemy a lane's swipes hit: the one nearest the wall that still needs something from this lane.
export function targetOf(G, lane) {
  let best = null;
  for (const e of G.enemies) if (e.y > 0 && need(e, lane) && (!best || e.y > best.y)) best = e;
  return best;
}

const bump = (p, k) => { p.ev++; p.last = k; };
const mult = p => Math.min(3, 1 + Math.floor(p.combo / 10) * 0.5);
function say(G, k, ...a) { G.log.push([k, ...a]); }

// A swipe from a phone: 'u' 'd' 'l' 'r', or 'tap' to fire a full super.
export function swipe(G, seat, dir) {
  if (G.phase !== 'wave') return null;
  const lane = G.lanes.indexOf(seat), p = G.players[seat];
  if (lane < 0 || !p || p.stun > 0) return null;
  if (dir === 'tap') return p.super >= 1 ? fireSuper(G, seat, lane, p) : null;
  if (!DIRS.includes(dir)) return null;
  const e = targetOf(G, lane);
  if (!e) return null;
  if (dir !== need(e, lane)) {
    p.combo = 0; p.stun = STUN; bump(p, 'miss'); say(G, 'miss', lane, e.id);
    return 'miss';
  }
  p.combo++; p.best = Math.max(p.best, p.combo);
  p.score += Math.round(10 * mult(p));
  p.super = Math.min(1, p.super + SUPER_PER_HIT);
  if (e.kind === 'boss') e.hits[lane]++; else { e.hit++; e.spin = 0; }
  say(G, 'hit', lane, e.id, dir);
  if (done(e)) { kill(G, e, seat); bump(p, 'kill'); return 'kill'; }
  bump(p, 'hit');
  return 'hit';
}

const done = e => e.kind === 'boss' ? e.tracks.every((t, i) => e.hits[i] >= t.length) : e.hit >= e.arrows.length;

function kill(G, e, seat) {
  G.enemies = G.enemies.filter(x => x !== e);
  const pts = KINDS[e.kind].points;
  if (e.kind === 'boss') {
    // the boss is a team kill: everyone in the lanes shares it, and the team gets a heart back
    for (const s of G.lanes) { const q = G.players[s]; q.score += pts; q.kills++; }
    G.hearts = Math.min(MAX_HEARTS, G.hearts + 1);
  } else {
    const p = G.players[seat]; p.score += Math.round(pts * mult(p)); p.kills++;
  }
  say(G, 'kill', e.kind === 'boss' ? -1 : e.lane, e.id, e.kind, e.y);
}

function fireSuper(G, seat, lane, p) {
  p.super = 0; bump(p, 'super'); say(G, 'super', lane);
  for (const e of G.enemies.slice()) {
    if (e.y <= 0) continue;
    if (e.kind === 'boss') {
      const t = e.tracks[lane]; if (!t) continue;
      e.hits[lane] = Math.min(t.length, e.hits[lane] + 3);
      if (done(e)) kill(G, e, seat);
    } else if (e.lane === lane) kill(G, e, seat);
  }
  return 'super';
}

// Advance time. live(seat) says whether a lane's phone is connected: an empty lane's monsters wait for it, and a
// boss does not ask anything of it.
export function step(G, dt, live = () => true) {
  G.t += dt;
  for (const s of G.lanes) { const p = G.players[s]; if (p.stun > 0) p.stun = Math.max(0, p.stun - dt); }
  if (G.phase === 'break') {
    G.timer -= dt;
    return;
  }
  if (G.phase !== 'wave') return;
  const on = G.lanes.map(s => live(s));
  if (!on.some(Boolean)) return; // nobody connected: everything waits

  G.timer += dt;
  while (G.queue.length && G.queue[0].at <= G.timer) {
    const q = G.queue[0];
    if (q.kind === 'boss' && G.enemies.length) break;
    if (q.lane >= 0) {
      // only into lanes with someone to defend them, and not on top of a monster that has just come out
      const free = l => on[l] && !G.enemies.some(e => e.lane === l && e.y < SPACING);
      const L = G.lanes.length, to = [0, 1, 2, 3, 4, 5, 6, 7].slice(0, L).map(d => (q.lane + d) % L).find(free);
      if (to == null) { q.at += 0.3; G.queue.sort((a, b) => a.at - b.at); break; }
      q.lane = to;
    }
    G.queue.shift();
    G.enemies.push(makeEnemy(G, q));
  }

  for (const e of G.enemies.slice()) {
    if (e.kind === 'boss') {
      e.tracks.forEach((t, i) => { if (!on[i]) e.hits[i] = t.length; });
      if (done(e)) { kill(G, e, G.lanes[0]); continue; }
    } else if (!on[e.lane]) continue;
    e.y += e.speed * dt;
    if (e.kind === 'spinner' && e.hit === 0) {
      e.spin += dt;
      if (e.spin >= SPIN_EVERY) { e.spin -= SPIN_EVERY; e.arrows[0] = DIRS[(DIRS.indexOf(e.arrows[0]) + 1) % 4]; }
    }
    if (e.y >= 1) {
      G.enemies = G.enemies.filter(x => x !== e);
      const lost = e.kind === 'boss' ? 3 : 1;
      G.hearts = Math.max(0, G.hearts - lost); G.lost += lost;
      const owners = e.kind === 'boss' ? G.lanes : [G.lanes[e.lane]];
      for (const s of owners) { const p = G.players[s]; p.combo = 0; bump(p, 'ouch'); }
      say(G, 'breach', e.lane, e.id, lost);
      if (G.hearts <= 0) { G.phase = 'over'; say(G, 'over', G.wave); return; }
    }
  }

  if (!G.queue.length && !G.enemies.length) {
    G.phase = 'break'; G.timer = BREAK;
    say(G, 'cleared', G.wave);
  }
}

// After a break, the board calls this with whoever is connected now (players can join between waves).
export const breakOver = G => G.phase === 'break' && G.timer <= 0;

export function ranking(G) {
  return Object.entries(G.players).filter(([s]) => G.lanes.includes(s) || G.players[s].score > 0)
    .sort((a, b) => b[1].score - a[1].score);
}
