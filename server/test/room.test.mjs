// Unit tests for the relay rules in room.js, with fake connections (no network, no Cloudflare).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admit, joined, refuse, message, left, rateLimiter, MAX_GUESTS, MAX_BYTES } from '../room.js';

const fake = (id, role) => ({ id, role, got: [], closed: null, send(s) { this.got.push(s === 'pong' ? s : JSON.parse(s)); }, close(c, r) { this.closed = [c, r]; } });
const room = (...cs) => cs;

test('admission: one host, guests need a host, room fills up', () => {
  assert.equal(admit([], 'host'), null);
  assert.equal(admit([], 'guest'), 'peer-unavailable');
  assert.equal(admit([fake('h', 'host')], 'host'), 'unavailable-id');
  assert.equal(admit([fake('h', 'host')], 'guest'), null);
  assert.equal(admit([], 'spectator'), 'bad-role');
  const full = [fake('h', 'host'), ...Array.from({ length: MAX_GUESTS }, (_, i) => fake('g' + i, 'guest'))];
  assert.equal(admit(full, 'guest'), 'room-full');
});

test('joining: guest learns the host, host learns the guest', () => {
  const h = fake('h', 'host'), g = fake('g', 'guest');
  joined(room(h), h);
  assert.deepEqual(h.got, [{ t: 'hello', id: 'h', role: 'host' }]);
  joined(room(h, g), g);
  assert.deepEqual(g.got, [{ t: 'hello', id: 'g', role: 'guest' }, { t: 'peer', id: 'h' }]);
  assert.deepEqual(h.got.at(-1), { t: 'peer', id: 'g' });
});

test('refusal tells the client why and closes it', () => {
  const c = fake(undefined, 'guest'); refuse(c, 'peer-unavailable');
  assert.deepEqual(c.got, [{ t: 'error', type: 'peer-unavailable' }]); assert.equal(c.closed[0], 4000);
});

test('relay: host targets one guest or all; guests reach only the host', () => {
  const h = fake('h', 'host'), a = fake('a', 'guest'), b = fake('b', 'guest'), R = room(h, a, b);
  message(R, h, JSON.stringify({ to: 'a', body: { t: 'lobby' } }));
  assert.deepEqual(a.got, [{ t: 'msg', from: 'h', body: { t: 'lobby' } }]); assert.equal(b.got.length, 0);
  message(R, h, JSON.stringify({ to: null, body: { t: 'turn', n: 1 } }));
  assert.equal(a.got.length, 2); assert.equal(b.got.length, 1);
  message(R, a, JSON.stringify({ to: 'b', body: { t: 'chat' } })); // guest trying to reach another guest
  assert.equal(b.got.length, 1); assert.deepEqual(h.got, [{ t: 'msg', from: 'a', body: { t: 'chat' } }]);
});

test('bad input closes the sender; ping is answered', () => {
  const h = fake('h', 'host');
  message([h], h, 'ping'); assert.deepEqual(h.got, ['pong']);
  message([h], h, '{nope'); assert.equal(h.closed[0], 1007);
  const big = fake('x', 'host'); message([big], big, 'x'.repeat(MAX_BYTES + 1)); assert.equal(big.closed[0], 1009);
  const bin = fake('y', 'host'); message([bin], bin, new ArrayBuffer(4)); assert.equal(bin.closed[0], 1003);
});

test('leaving: host hears about guests; guests are closed when the host goes', () => {
  const h = fake('h', 'host'), a = fake('a', 'guest'), b = fake('b', 'guest');
  left(room(h, b), a); assert.deepEqual(h.got, [{ t: 'gone', id: 'a' }]);
  left(room(b), h); assert.deepEqual(b.got, [{ t: 'gone', id: 'h' }]); assert.deepEqual(b.closed, [1000, 'host left']);
});

test('rate limit: sliding window per connection', () => {
  let t = 0; const ok = rateLimiter({ msgs: 3, perMs: 1000 }, () => t);
  assert.deepEqual([ok('a'), ok('a'), ok('a'), ok('a'), ok('b')], [true, true, true, false, true]);
  t = 1500; assert.equal(ok('a'), true);
  const h = fake('h', 'host'), deny = () => false; message([h], h, '{"body":1}', deny); assert.equal(h.closed[0], 4008);
});
