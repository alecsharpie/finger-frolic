// Finger Frolic rules. Pure: no DOM, no network, no clock (the board calls step() with dt), so it runs in tests.
//
// The field is one lane per player. Monsters march down the lanes from y = 0 (the woods) to y = 1 (the wall).
// Each monster carries a row of arrows; the lane's player swipes them in order on their phone. A right swipe
// knocks off the next arrow (and knocks the monster back a little), a wrong one leaves you dizzy for a moment and
// drops your combo. A monster that reaches the wall costs the team a heart. When your lane is clear, your swipes
// help a neighbour. Golden gift boxes drop power-ups, and good teamwork fills a shared FRENZY meter. Every 5th wave
// a boss spans every lane, and each player has to clear their own row of its arrows.

export const DIRS = ['u', 'r', 'd', 'l'];
// Shapes drawn on the phone (shared/shapes.js recognises them). Each casts its own spell on the TV.
export const SHAPE_KEYS = ['circle', 'tri', 'v', 'square', 'zig'];
export const isShapeToken = t => SHAPE_KEYS.includes(t);

// Difficulty. Normal is the game as designed; Easy is for little ones and first goes.
//   speed: monster speed ×, ramp: extra speed per wave, size: monsters per wave ×, gap: time between spawns ×,
//   early: new monster kinds arrive this many waves sooner, shapesFrom: wave when brutes start ending in a shape.
export const DIFFS = {
  easy:      { label: 'Easy',      icon: '🌱', hearts: 6, speed: 0.85, ramp: 0.06, size: 0.85, gap: 1.15, knock: 0.03,  stun: 0.4, frenzyHits: 10, early: 0, shapesFrom: 9, shapeSet: 3 },
  normal:    { label: 'Normal',    icon: '⚔️', hearts: 5, speed: 1.15, ramp: 0.1,  size: 1.15, gap: 0.85, knock: 0.022, stun: 0.6, frenzyHits: 14, early: 0, shapesFrom: 7, shapeSet: 5 },
  hard:      { label: 'Hard',      icon: '🔥', hearts: 4, speed: 1.35, ramp: 0.12, size: 1.3,  gap: 0.75, knock: 0.016, stun: 0.8, frenzyHits: 18, early: 1, shapesFrom: 5, shapeSet: 5 },
  nightmare: { label: 'Nightmare', icon: '💀', hearts: 3, speed: 1.6,  ramp: 0.14, size: 1.5,  gap: 0.65, knock: 0.01,  stun: 1.0, frenzyHits: 22, early: 2, shapesFrom: 3, shapeSet: 5 },
};
export const DIFF_KEYS = Object.keys(DIFFS);
export const diffOf = G => DIFFS[G.diff] || DIFFS.normal;
export const OPPOSITE = { u: 'd', d: 'u', l: 'r', r: 'l' };
export const SEATS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];

export const START_HEARTS = 5, MAX_HEARTS = 8; // START_HEARTS: Normal's; each difficulty sets its own
export const BREAK = 4;             // seconds between waves
export const SUPER_PER_HIT = 0.07;  // a super needs ~15 good swipes
export const BOSS_EVERY = 5;
export const ASSIST_FROM = 0.25;    // a neighbour's monster must be this far down before you can help with it
export const FREEZE = 5, FRENZY = 8; // seconds
export const POWERS = ['freeze', 'heal', 'storm'];

// speed: lane lengths per second at wave 1 (1/9 = nine seconds from the woods to the wall)
export const KINDS = {
  grunt:     { arrows: [1, 1], speed: 1 / 9,  points: 50,  from: 1, weight: 3 },
  brute:     { arrows: [2, 3], speed: 1 / 13, points: 120, from: 2, weight: 1, heavy: true },
  golem:     { arrows: [1, 2], speed: 1 / 14, points: 220, from: 3, weight: 1, heavy: true }, // arrows, then a shape
  runner:    { arrows: [1, 1], speed: 1 / 5,  points: 80,  from: 4, weight: 1 },
  spinner:   { arrows: [1, 2], speed: 1 / 10, points: 100, from: 5, weight: 1 }, // its next arrow turns until hit
  trickster: { arrows: [2, 2], speed: 1 / 10, points: 100, from: 6, weight: 1 }, // red arrows: swipe the other way
  gift:      { arrows: [2, 2], speed: 1 / 6,  points: 150, from: 2, weight: 0 }, // placed by planWave; harmless
  boss:      { arrows: [6, 6], speed: 1 / 18, points: 600, from: BOSS_EVERY, weight: 0 },
};
// What the TV says when a kind first shows up.
export const INTRO = {
  brute: '🟣 Brutes: tough, 2–3 arrows',
  gift: '🎁 Gift boxes: pop them for a power-up!',
  golem: '🗿 Rune Golems: finish them by DRAWING the shape on your phone',
  runner: '🟠 Runners: fast!',
  spinner: '🌀 Spinners: the arrow turns until you hit it',
  trickster: '🟥 Tricksters: red arrows mean swipe the OTHER way',
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
  return { name, score: 0, combo: 0, best: 0, kills: 0, super: 0, stun: 0, ev: 0, last: '', misses: 0, hits: 0, assists: 0, gifts: 0 };
}

export function newGame(seed, diff = 'normal') {
  return { phase: 'lobby', t: 0, wave: 0, diff, hearts: (DIFFS[diff] || DIFFS.normal).hearts, lanes: [], players: {}, enemies: [], queue: [],
    next: 1, timer: 0, r: rng(seed), log: [], lost: 0, waveLost: 0,
    frenzy: 0, frenzyT: 0, freezeT: 0, tev: 0, tlast: '' };
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
  const fresh = newGame(seed, G.diff);
  for (const s of seats) fresh.players[s] = newPlayer(G.players[s]?.name);
  Object.assign(G, fresh);
  startWave(G, seats);
}

export const speedScale = (wave, D = DIFFS.normal) => D.speed * Math.min(2.4, 1 + D.ramp * (wave - 1));
export const kindFrom = (k, D = DIFFS.normal) => k === 'grunt' ? 1 : Math.max(2, KINDS[k].from - D.early);
export const isBossWave = wave => wave > 0 && wave % BOSS_EVERY === 0;

export function waveSize(wave, lanes, D = DIFFS.normal) {
  return Math.round(lanes * (2.5 + wave * 1.2) * D.size);
}

// Build the spawn list for a wave: [{at, kind, lane}] sorted by time.
export function planWave(wave, lanes, r, D = DIFFS.normal) {
  const kinds = Object.keys(KINDS).filter(k => KINDS[k].weight && kindFrom(k, D) <= wave);
  const n = waveSize(wave, lanes, D);
  const gap = D.gap * Math.max(0.5, 2.4 - wave * 0.15) / Math.sqrt(lanes); // seconds between spawns across the field
  const out = [];
  let at = 1.2;
  for (let i = 0; i < n; i++) {
    // newer kinds show up less often, so the wave is mostly what you already know
    const w = kinds.map(k => KINDS[k].weight + (wave - kindFrom(k, D) > 1 ? 1 : 0));
    let x = r() * w.reduce((a, b) => a + b, 0), kind = kinds[0];
    for (let j = 0; j < kinds.length; j++) { x -= w[j]; if (x < 0) { kind = kinds[j]; break; } }
    out.push({ at, kind, lane: Math.floor(r() * lanes) });
    at += gap * (0.6 + r() * 0.8);
  }
  // a gift or two somewhere in the middle of the wave
  if (wave >= kindFrom('gift', D)) {
    const gifts = 1 + (lanes >= 4 ? 1 : 0) + (wave >= 8 ? 1 : 0);
    for (let g = 0; g < gifts && out.length > 2; g++) out[1 + Math.floor(r() * (out.length - 2))].kind = 'gift';
  }
  // the boss closes its wave and comes alone (step() holds it until the field is clear)
  if (isBossWave(wave)) out.push({ at: at + 2, kind: 'boss', lane: -1 });
  return out;
}

export function startWave(G, seats) {
  G.wave++;
  G.lanes = seats.slice();
  for (const s of seats) addPlayer(G, s);
  G.queue = planWave(G.wave, G.lanes.length, G.r, diffOf(G));
  G.enemies = [];
  G.phase = 'wave';
  G.timer = 0;
  G.waveLost = 0;
  say(G, 'wave', G.wave, Object.keys(INTRO).filter(k => kindFrom(k, diffOf(G)) === G.wave));
}

function makeEnemy(G, { kind, lane }) {
  const K = KINDS[kind], L = G.lanes.length, D = diffOf(G);
  const row = n => Array.from({ length: n }, () => pick(G.r, DIRS));
  // the first shapes are the easy ones; the square and zigzag join a few waves later
  const shape = () => pick(G.r, SHAPE_KEYS.slice(0, G.wave >= kindFrom('golem', D) + 3 ? D.shapeSet : 3));
  const e = { id: G.next++, kind, lane, y: -0.04, speed: K.speed * speedScale(G.wave, D), hit: 0, spin: 0, wob: G.r() * 6.28, hurt: 0 };
  if (kind === 'boss') {
    const n = between(G.r, K.arrows) + Math.floor(G.wave / BOSS_EVERY) - 1;
    e.tracks = Array.from({ length: L }, () => row(n));
    // later bosses end every row with a shape
    if (G.wave >= D.shapesFrom + 3) for (const t of e.tracks) t[t.length - 1] = shape();
    e.hits = e.tracks.map(() => 0);
  } else {
    e.arrows = row(between(G.r, K.arrows));
    if (kind === 'golem' || (kind === 'brute' && G.wave >= D.shapesFrom)) e.arrows.push(shape());
    if (kind === 'trickster') e.flip = e.arrows.map(() => G.r() < 0.6);
  }
  if (kind === 'gift') say(G, 'gift', lane, e.id);
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
  return e.flip && e.flip[e.hit] && OPPOSITE[a] ? OPPOSITE[a] : a;
}

// The enemy in a lane that the lane's swipes hit: the one nearest the wall that still needs something from it.
export function targetOf(G, lane) {
  let best = null;
  for (const e of G.enemies) if (e.y > 0 && need(e, lane) && (!best || e.y > best.y)) best = e;
  return best;
}

// Where a player's swipes go: their own lane first; if it is clear, the more urgent of the neighbours' fronts.
// Returns {e, lane} (lane: whose arrows on e are being swiped) or null.
export function aim(G, lane) {
  const own = targetOf(G, lane);
  if (own) return { e: own, lane };
  let best = null;
  for (const n of [lane - 1, lane + 1]) {
    if (n < 0 || n >= G.lanes.length) continue;
    const e = targetOf(G, n);
    if (e && e.y >= ASSIST_FROM && (!best || e.y > best.e.y)) best = { e, lane: n };
  }
  return best;
}

const bump = (p, k) => { p.ev++; p.last = k; };
const team = (G, k) => { G.tev++; G.tlast = k; };
const knock = G => diffOf(G).knock;
const mult = (G, p) => Math.min(3, 1 + Math.floor(p.combo / 10) * 0.5) * (G.frenzyT > 0 ? 2 : 1);
function say(G, k, ...a) { G.log.push([k, ...a]); }

// A swipe from a phone: 'u' 'd' 'l' 'r', a drawn shape ('circle', 'tri', …), or 'tap' to fire a full super.
export function swipe(G, seat, dir) {
  if (G.phase !== 'wave') return null;
  const lane = G.lanes.indexOf(seat), p = G.players[seat];
  if (lane < 0 || !p || p.stun > 0) return null;
  if (dir === 'tap') return p.super >= 1 ? fireSuper(G, seat, lane, p) : null;
  if (!DIRS.includes(dir) && !isShapeToken(dir)) return null;
  const a = aim(G, lane);
  if (!a) return null;
  const { e, lane: tl } = a, assist = tl !== lane;
  if (dir !== need(e, tl)) {
    p.combo = 0; p.stun = diffOf(G).stun; p.misses++; bump(p, 'miss'); say(G, 'miss', lane, e.id);
    G.frenzy = Math.max(0, G.frenzy - 0.05);
    return 'miss';
  }
  p.combo++; p.hits++; p.best = Math.max(p.best, p.combo);
  if (assist) p.assists++;
  p.score += Math.round(10 * mult(G, p));
  p.super = Math.min(1, p.super + SUPER_PER_HIT * (G.frenzyT > 0 ? 2 : 1));
  if (e.kind === 'boss') e.hits[tl]++;
  else {
    e.hit++; e.spin = 0;
    // a drawn shape is a big spell: it knocks harder than a swipe
    e.y = Math.max(0.01, e.y - knock(G) * (KINDS[e.kind].heavy ? 0.5 : 1) * (G.frenzyT > 0 ? 2 : 1) * (isShapeToken(dir) ? 3 : 1));
  }
  e.hurt = 0.15;
  if (G.frenzyT <= 0) {
    G.frenzy += 1 / (diffOf(G).frenzyHits * G.lanes.length);
    if (G.frenzy >= 1 - 1e-9) { G.frenzy = 0; G.frenzyT = FRENZY; team(G, 'frenzy'); say(G, 'frenzy'); }
  }
  say(G, 'hit', tl, e.id, dir, lane, e.y, e.kind === 'boss' ? -1 : e.lane);
  if (done(e)) { kill(G, e, seat); bump(p, 'kill'); return 'kill'; }
  bump(p, assist ? 'assist' : 'hit');
  return 'hit';
}

const done = e => e.kind === 'boss' ? e.tracks.every((t, i) => e.hits[i] >= t.length) : e.hit >= e.arrows.length;

function kill(G, e, seat, how = 'swipe') {
  if (!G.enemies.includes(e)) return;
  G.enemies = G.enemies.filter(x => x !== e);
  const pts = KINDS[e.kind].points;
  if (e.kind === 'boss') {
    // the boss is a team kill: everyone in the lanes shares it, and the team gets a heart back
    for (const s of G.lanes) { const q = G.players[s]; q.score += pts; q.kills++; }
    G.hearts = Math.min(MAX_HEARTS, G.hearts + 1);
    team(G, 'boss');
  } else {
    const p = G.players[seat]; p.score += Math.round(pts * mult(G, p)); p.kills++;
  }
  say(G, 'kill', e.kind === 'boss' ? -1 : e.lane, e.id, e.kind, e.y, how);
  if (e.kind === 'gift') power(G, seat, e);
}

// A popped gift: a random power-up for the whole team.
function power(G, seat, e) {
  const p = G.players[seat]; p.gifts++;
  const options = POWERS.filter(k => k !== 'heal' || G.hearts < MAX_HEARTS);
  const k = pick(G.r, options);
  team(G, k);
  say(G, 'power', k, seat, e.lane);
  if (k === 'freeze') G.freezeT = FREEZE;
  else if (k === 'heal') G.hearts = Math.min(MAX_HEARTS, G.hearts + 1);
  else if (k === 'storm') {
    // lightning: the front monster of every lane, and two arrows off every row of a boss
    for (let l = 0; l < G.lanes.length; l++) {
      const t = targetOf(G, l);
      if (!t) continue;
      if (t.kind === 'boss') { t.hits[l] = Math.min(t.tracks[l].length, t.hits[l] + 2); say(G, 'bolt', l, t.y); if (done(t)) kill(G, t, seat, 'storm'); }
      else { say(G, 'bolt', l, t.y); kill(G, t, seat, 'storm'); }
    }
  }
}

function fireSuper(G, seat, lane, p) {
  p.super = 0; bump(p, 'super'); say(G, 'super', lane);
  for (const e of G.enemies.slice()) {
    if (e.y <= 0) continue;
    if (e.kind === 'boss') {
      const t = e.tracks[lane]; if (!t) continue;
      e.hits[lane] = Math.min(t.length, e.hits[lane] + 3);
      if (done(e)) kill(G, e, seat, 'super');
    } else if (e.lane === lane) kill(G, e, seat, 'super');
  }
  return 'super';
}

// Advance time. live(seat) says whether a lane's phone is connected: an empty lane's monsters wait for it, and a
// boss does not ask anything of it.
export function step(G, dt, live = () => true) {
  G.t += dt;
  for (const s of G.lanes) { const p = G.players[s]; if (p.stun > 0) p.stun = Math.max(0, p.stun - dt); }
  for (const e of G.enemies) if (e.hurt > 0) e.hurt = Math.max(0, e.hurt - dt);
  if (G.phase === 'break') {
    G.timer -= dt;
    return;
  }
  if (G.phase !== 'wave') return;
  const on = G.lanes.map(s => live(s));
  if (!on.some(Boolean)) return; // nobody connected: everything waits

  G.timer += dt;
  if (G.frenzyT > 0) { G.frenzyT = Math.max(0, G.frenzyT - dt); if (!G.frenzyT) say(G, 'frenzy-end'); }
  else G.frenzy = Math.max(0, G.frenzy - dt * 0.01);
  if (G.freezeT > 0) G.freezeT = Math.max(0, G.freezeT - dt);
  const pace = G.freezeT > 0 ? 0.2 : 1;

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
    e.y += e.speed * dt * pace;
    if (e.kind === 'spinner' && e.hit === 0) {
      e.spin += dt * pace;
      if (e.spin >= SPIN_EVERY) { e.spin -= SPIN_EVERY; e.arrows[0] = DIRS[(DIRS.indexOf(e.arrows[0]) + 1) % 4]; }
    }
    if (e.y >= 1) {
      G.enemies = G.enemies.filter(x => x !== e);
      if (e.kind === 'gift') { say(G, 'escape', e.lane, e.id); continue; } // a missed present, not a breach
      const lost = e.kind === 'boss' ? 3 : 1;
      G.hearts = Math.max(0, G.hearts - lost); G.lost += lost; G.waveLost += lost;
      G.frenzy = Math.max(0, G.frenzy - 0.25);
      const owners = e.kind === 'boss' ? G.lanes : [G.lanes[e.lane]];
      for (const s of owners) { const p = G.players[s]; p.combo = 0; bump(p, 'ouch'); }
      say(G, 'breach', e.lane, e.id, lost);
      if (G.hearts <= 0) { G.phase = 'over'; G.frenzyT = 0; G.freezeT = 0; say(G, 'over', G.wave); return; }
    }
  }

  if (!G.queue.length && !G.enemies.length) {
    G.phase = 'break'; G.timer = BREAK; G.frenzyT = 0; G.freezeT = 0;
    const perfect = G.waveLost === 0;
    if (perfect) { for (const s of G.lanes) G.players[s].score += 100 * G.wave; team(G, 'perfect'); }
    say(G, 'cleared', G.wave, perfect);
  }
}

// After a break, the board calls this with whoever is connected now (players can join between waves).
export const breakOver = G => G.phase === 'break' && G.timer <= 0;

export function ranking(G) {
  return Object.entries(G.players).filter(([s]) => G.lanes.includes(s) || G.players[s].score > 0)
    .sort((a, b) => b[1].score - a[1].score);
}

// One award each for the results screen, so everybody walks away with something.
// Categories are handed out in order, each to the best player who has not got one yet.
const AWARDS = [
  ['🗡️', 'Monster Masher', 'most monsters', p => p.kills],
  ['🔥', 'Combo Machine', 'longest combo', p => p.best],
  ['😇', 'Guardian Angel', 'most assists', p => p.assists],
  ['🎯', 'Sharpshooter', 'most accurate', p => p.hits >= 5 ? p.hits / (p.hits + p.misses) : 0],
  ['🎁', 'Gift Grabber', 'most gifts popped', p => p.gifts],
  ['💫', 'Dizzy Dancer', 'most wrong swipes', p => p.misses],
  ['🧱', 'Brick in the Wall', 'held the line', () => 0.001],
];
export function awards(G) {
  const out = {}, rows = ranking(G);
  for (const [icon, title, why, f] of AWARDS) {
    const free = rows.filter(([s]) => !out[s]);
    if (!free.length) break;
    const [s, p] = free.reduce((a, b) => (f(b[1]) > f(a[1]) ? b : a));
    if (f(p) > 0) out[s] = { icon, title, why };
  }
  for (const [s] of rows) out[s] ??= { icon: '🧱', title: 'Brick in the Wall', why: 'held the line' };
  return out;
}
