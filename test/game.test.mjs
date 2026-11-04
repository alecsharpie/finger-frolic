import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, startGame, step, swipe, need, targetOf, planWave, breakOver, startWave, KINDS, OPPOSITE, STUN, START_HEARTS, BOSS_EVERY } from '../game.js';

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

test('swipes only reach your own lane', () => {
  const G = newGame(3); startGame(G, ['p1', 'p2']);
  for (let i = 0; i < 3000 && !G.enemies.some(e => e.y > 0 && e.lane === 0); i++) step(G, 1 / 30);
  const e = G.enemies.find(e => e.lane === 0);
  const before = e.hit;
  if (!targetOf(G, 1)) assert.equal(swipe(G, 'p2', need(e, 0)), null);
  assert.equal(e.hit, before);
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
