import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, startGame, step, swipe, need, targetOf, aim, planWave, breakOver, startWave, awards, KINDS, OPPOSITE, START_HEARTS, BOSS_EVERY, ASSIST_FROM, DIFFS, SHAPE_KEYS, planWave as plan, kindFrom } from '../game.js';
import { SHAPES } from '../shared/shapes.js';
const { stun: STUN, knock: KNOCK, frenzyHits: FRENZY_HITS } = DIFFS.normal;

const run = (G, secs, live) => { for (let i = 0; i < secs * 30; i++) step(G, 1 / 30, live); };
const firstOnField = G => { for (let i = 0; i < 3000 && !G.enemies.some(e => e.y > 0); i++) step(G, 1 / 30); return targetOf(G, 0); };

test('a wave spawns monsters that walk to the wall and cost hearts', () => {
  const G = newGame(1); startGame(G, ['p1']);
  assert.equal(G.phase, 'wave'); assert.equal(G.wave, 1); assert.ok(G.queue.length > 0);
  run(G, 120);
  assert.ok(G.hearts < START_HEARTS, 'unattended monsters should breach');
});

test('right swipes clear a monster, wrong swipes stun and drop the combo', () => {
  const G = newGame(2); startGame(G, ['p1']);
  const e = firstOnField(G);
  assert.ok(e);
  const want = need(e, 0), wrong = OPPOSITE[want];
  assert.equal(swipe(G, 'p1', wrong), 'miss');
  assert.equal(G.players.p1.stun, STUN);
  assert.equal(swipe(G, 'p1', want), null, 'stunned swipes are ignored');
  run(G, STUN + 0.05);
  const t = targetOf(G, 0);
  let r; while (t && G.enemies.includes(t)) r = swipe(G, 'p1', need(t, 0));
  assert.equal(r, 'kill');
  assert.ok(G.players.p1.score > 0); assert.equal(G.players.p1.kills, 1);
});

const grunt = (id, lane, y, arrows = ['u']) => ({ id, kind: 'grunt', lane, y, speed: 0, hit: 0, arrows, spin: 0, hurt: 0 });

test('your own lane comes first; when it is clear you help a neighbour, but only once their monster is close', () => {
  const G = newGame(3); startGame(G, ['p1', 'p2', 'p3']); G.queue = [];
  G.enemies = [grunt(1, 0, ASSIST_FROM - 0.05, ['u', 'u']), grunt(2, 2, 0.6, ['l', 'l'])];
  assert.equal(aim(G, 1).lane, 2, 'p2 helps the more urgent neighbour');
  assert.equal(aim(G, 0).lane, 0, 'p1 has its own monster');
  assert.equal(aim(G, 2).lane, 2);
  G.enemies = [grunt(1, 0, ASSIST_FROM - 0.05)];
  assert.equal(aim(G, 1), null, 'too far up the lane to help with yet');
  assert.equal(aim(G, 2), null, 'not a neighbour');
  G.enemies = [grunt(1, 0, 0.5, ['u', 'r'])];
  assert.equal(swipe(G, 'p2', 'u'), 'hit');
  assert.equal(G.players.p2.assists, 1); assert.equal(G.enemies[0].hit, 1);
});

test('a good hit knocks the monster back up its lane', () => {
  const G = newGame(9); startGame(G, ['p1']); G.queue = [];
  G.enemies = [grunt(1, 0, 0.5, ['u', 'u'])];
  swipe(G, 'p1', 'u');
  assert.ok(Math.abs(G.enemies[0].y - (0.5 - KNOCK)) < 1e-9);
});

test('popping a gift gives the team a power-up; a gift that gets through costs nothing', () => {
  for (let seed = 1; seed < 40; seed++) {
    const G = newGame(seed); startGame(G, ['p1', 'p2']); G.queue = []; G.hearts = 3;
    G.enemies = [{ ...grunt(1, 0, 0.5, ['u']), kind: 'gift' }, grunt(2, 1, 0.4, ['d', 'd'])];
    assert.equal(swipe(G, 'p1', 'u'), 'kill');
    const [, k] = G.log.find(l => l[0] === 'power');
    if (k === 'heal') assert.equal(G.hearts, 4);
    if (k === 'freeze') assert.ok(G.freezeT > 0);
    if (k === 'storm') assert.equal(G.enemies.length, 0, 'lightning hits every lane');
    assert.equal(G.players.p1.gifts, 1);
  }
  const G = newGame(1); startGame(G, ['p1']); G.queue = [];
  G.enemies = [{ ...grunt(1, 0, 0.99), kind: 'gift', speed: 1 }];
  step(G, 0.1); assert.equal(G.hearts, START_HEARTS);
});

test('freeze slows the field to a crawl', () => {
  const G = newGame(2); startGame(G, ['p1']); G.queue = [];
  G.enemies = [{ ...grunt(1, 0, 0.2), speed: 0.1 }, grunt(9, 0, 0.1)];
  G.freezeT = 5; step(G, 1);
  assert.ok(G.enemies[0].y < 0.2 + 0.1 * 0.5);
});

test('enough good swipes from the team set off a frenzy with double points', () => {
  const G = newGame(4); startGame(G, ['p1']); G.queue = [];
  G.enemies = [grunt(1, 0, 0.5, Array(FRENZY_HITS + 3).fill('u'))];
  for (let i = 0; i < FRENZY_HITS; i++) swipe(G, 'p1', 'u');
  assert.ok(G.frenzyT > 0); assert.equal(G.tlast, 'frenzy');
  const before = G.players.p1.score; swipe(G, 'p1', 'u');
  assert.ok(G.players.p1.score - before >= 30, 'frenzy doubles (on top of the combo bonus)');
});

test('a wave without a breach is perfect and pays a bonus', () => {
  const G = newGame(5); startGame(G, ['p1']); G.queue = []; G.enemies = [grunt(1, 0, 0.5)];
  swipe(G, 'p1', 'u'); const before = G.players.p1.score; step(G, 0.1);
  assert.equal(G.phase, 'break'); assert.equal(G.players.p1.score, before + 100); assert.equal(G.tlast, 'perfect');
});

test('everyone gets a different award', () => {
  const G = newGame(6); startGame(G, ['p1', 'p2', 'p3']);
  Object.assign(G.players.p1, { kills: 9, score: 900 }); Object.assign(G.players.p2, { best: 20, score: 500 }); Object.assign(G.players.p3, { assists: 4, score: 100 });
  const A = awards(G);
  assert.equal(A.p1.title, 'Monster Masher'); assert.equal(A.p2.title, 'Combo Machine'); assert.equal(A.p3.title, 'Guardian Angel');
});

test('a full super clears your lane with a tap', () => {
  const G = newGame(4); startGame(G, ['p1']);
  firstOnField(G);
  assert.equal(swipe(G, 'p1', 'tap'), null, 'no super yet');
  G.players.p1.super = 1;
  assert.equal(swipe(G, 'p1', 'tap'), 'super');
  assert.equal(G.enemies.filter(e => e.y > 0 && e.lane === 0).length, 0);
});

test('clearing a wave gives a break, then the next wave can take new players', () => {
  const G = newGame(5); startGame(G, ['p1']);
  for (let i = 0; i < 20000 && G.phase === 'wave'; i++) {
    step(G, 1 / 30);
    const t = targetOf(G, 0); if (t && !G.players.p1.stun) swipe(G, 'p1', need(t, 0));
  }
  assert.equal(G.phase, 'break'); assert.equal(G.hearts, START_HEARTS);
  run(G, 5); assert.ok(breakOver(G));
  startWave(G, ['p1', 'p2']);
  assert.equal(G.wave, 2); assert.deepEqual(G.lanes, ['p1', 'p2']); assert.ok(G.players.p2);
});

test('boss waves have a boss with a row of arrows for every lane, and it needs everyone', () => {
  const plan = planWave(BOSS_EVERY, 3, () => 0.5);
  assert.equal(plan.filter(q => q.kind === 'boss').length, 1);
  const G = newGame(6); startGame(G, ['p1', 'p2', 'p3']); G.wave = BOSS_EVERY - 1; startWave(G, ['p1', 'p2', 'p3']);
  assert.equal(G.queue.at(-1).kind, 'boss', 'the boss closes the wave');
  run(G, 3); assert.ok(!G.enemies.some(e => e.kind === 'boss'), 'and waits for the field to clear');
  G.queue = G.queue.slice(-1); G.queue[0].at = 0; G.enemies = [];
  let boss;
  for (let i = 0; i < 20000 && !(boss = G.enemies.find(e => e.kind === 'boss' && e.y > 0)); i++) step(G, 1 / 30);
  assert.ok(boss); assert.equal(boss.tracks.length, 3);
  G.enemies = [boss];
  for (const [lane, s] of ['p1', 'p2'].entries()) while (need(boss, lane)) swipe(G, s, need(boss, lane));
  assert.ok(G.enemies.includes(boss), 'p3 has not done their part yet');
  while (need(boss, 2)) swipe(G, 'p3', need(boss, 2));
  assert.ok(!G.enemies.includes(boss));
});

test('a disconnected lane waits instead of losing hearts, and gets no new monsters', () => {
  const G = newGame(7); startGame(G, ['p1', 'p2']);
  G.enemies.push({ id: 999, kind: 'grunt', lane: 1, y: 0.5, speed: 0.2, hit: 0, arrows: ['u'], spin: 0 });
  G.queue = G.queue.slice(0, 3);
  for (let i = 0; i < 30 * 60; i++) {
    step(G, 1 / 30, s => s === 'p1');
    const t = targetOf(G, 0); if (t && !G.players.p1.stun) swipe(G, 'p1', need(t, 0));
  }
  assert.equal(G.hearts, START_HEARTS);
  assert.deepEqual(G.enemies.map(e => [e.lane, e.y]), [[1, 0.5]]);
});

test('the game ends when the hearts run out', () => {
  const G = newGame(8); startGame(G, ['p1']); G.hearts = 1;
  run(G, 120);
  assert.equal(G.phase, 'over');
});

test('tricksters want the opposite of the arrow shown', () => {
  const e = { kind: 'trickster', lane: 0, hit: 0, arrows: ['u', 'l'], flip: [true, false] };
  assert.equal(need(e, 0), 'd'); e.hit = 1; assert.equal(need(e, 0), 'l');
  assert.ok(KINDS.trickster.from > 1);
});

test('the TV and the phone agree on the shapes', () => {
  assert.deepEqual([...SHAPE_KEYS].sort(), Object.keys(SHAPES).sort());
});

test('golems end in a shape; drawing the right one finishes them, the wrong one stuns', () => {
  const G = newGame(12); startGame(G, ['p1']); G.wave = 3; startWave(G, ['p1']); G.queue = [];
  G.enemies = [{ id: 1, kind: 'golem', lane: 0, y: 0.5, speed: 0, hit: 0, arrows: ['u', 'tri'], spin: 0, hurt: 0 }];
  assert.equal(swipe(G, 'p1', 'u'), 'hit');
  assert.equal(need(G.enemies[0], 0), 'tri');
  assert.equal(swipe(G, 'p1', 'u'), 'miss', 'a swipe is not a triangle');
  G.players.p1.stun = 0;
  assert.equal(swipe(G, 'p1', 'circle'), 'miss');
  G.players.p1.stun = 0;
  assert.equal(swipe(G, 'p1', 'tri'), 'kill');
  // real golems from makeEnemy
  for (let i = 0; i < 300 && !G.enemies.some(e => e.kind === 'golem'); i++) { G.queue = [{ at: 0, kind: 'golem', lane: 0 }]; G.enemies = []; step(G, 0.01); }
  const g = G.enemies.find(e => e.kind === 'golem');
  assert.ok(SHAPE_KEYS.includes(g.arrows.at(-1)));
  assert.ok(g.arrows.slice(0, -1).every(a => ['u', 'd', 'l', 'r'].includes(a)));
});

test('harder difficulties: fewer hearts, faster and bigger waves, new monsters sooner', () => {
  const r = () => 0.5;
  const sizes = Object.keys(DIFFS).map(d => plan(6, 3, r, DIFFS[d]).length);
  assert.ok(sizes.every((n, i) => !i || n > sizes[i - 1]), String(sizes));
  assert.ok(kindFrom('trickster', DIFFS.nightmare) < kindFrom('trickster', DIFFS.normal));
  const hearts = d => { const G = newGame(1, d); startGame(G, ['p1']); return G.hearts; };
  assert.ok(hearts('easy') > hearts('normal') && hearts('normal') > hearts('hard') && hearts('hard') > hearts('nightmare'));
  const G = newGame(1, 'hard'); startGame(G, ['p1']); assert.equal(G.diff, 'hard', 'restarts keep the difficulty');
});
