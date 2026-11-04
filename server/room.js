// Finger Frolic relay: one room = one board (the TV, host) and its hands (phones, guests), star-shaped: hands only talk to
// the board, which runs the game. Pure logic with no platform APIs, so it runs in a Durable Object (worker.js) or
// anywhere else. Copied from the co-op relay (~/me/co-op/server/room.js), with limits raised for real-time play.
//
// A connection is {id, role: 'host'|'guest', send(string), close(code, reason)}. The room keeps no state of its own:
// membership is whatever connections the caller passes in, which is what lets a Durable Object hibernate between
// messages (its memory is wiped; the sockets and their {id, role} attachments survive).
//
// Server -> client:  {t:'hello', id, role}   your id
//                    {t:'peer', id}          host: a guest arrived; guest: this is the host
//                    {t:'msg', from, body}   relayed game message
//                    {t:'gone', id}          that peer left (guests are then closed when the host leaves)
//                    {t:'error', type}       'unavailable-id' (code taken), 'peer-unavailable' (no host), 'room-full'
// Client -> server:  {to, body}              host: to = guest id, or null for every guest; guest: always to the host
//                    'ping'                  heartbeat, answered 'pong'

// Eight players, plus room for phones whose old sockets have not timed out yet when they reconnect after a screen lock.
export const MAX_GUESTS = 12, MAX_BYTES = 1 << 16;
// Real-time: the board broadcasts state ~6 times a second and a frantic phone swipes ~8 times a second.
export const RATE = { msgs: 300, perMs: 5000 };

const out = o => JSON.stringify(o);
const hostOf = conns => conns.find(c => c.role === 'host');

// Decide whether a new connection may join, before it is accepted. Returns an error type or null.
export function admit(conns, role) {
  if (role !== 'host' && role !== 'guest') return 'bad-role';
  const host = hostOf(conns);
  if (role === 'host') return host ? 'unavailable-id' : null;
  if (!host) return 'peer-unavailable';
  return conns.filter(c => c.role === 'guest').length >= MAX_GUESTS ? 'room-full' : null;
}

// After an admitted connection is accepted (conns includes me).
export function joined(conns, me) {
  me.send(out({ t: 'hello', id: me.id, role: me.role }));
  if (me.role === 'guest') {
    const host = hostOf(conns);
    host.send(out({ t: 'peer', id: me.id }));
    me.send(out({ t: 'peer', id: host.id }));
  }
}

// Refuse a connection that admit() turned away: tell it why, then close.
export function refuse(conn, type) {
  conn.send(out({ t: 'error', type }));
  conn.close(4000, type);
}

export function message(conns, me, raw, rate) {
  if (raw === 'ping') return me.send('pong');
  if (typeof raw !== 'string') return me.close(1003, 'text only');
  if (raw.length > MAX_BYTES) return me.close(1009, 'too big');
  if (rate && !rate(me.id)) return me.close(4008, 'slow down');
  let m; try { m = JSON.parse(raw); } catch (e) { return me.close(1007, 'bad json'); }
  if (!m || typeof m !== 'object' || !('body' in m)) return;
  const relay = out({ t: 'msg', from: me.id, body: m.body });
  if (me.role === 'guest') { const host = hostOf(conns); if (host) host.send(relay); return; }
  for (const c of conns) if (c.role === 'guest' && (m.to == null || c.id === m.to)) c.send(relay);
}

// After a connection has gone (conns no longer includes it).
export function left(conns, gone) {
  if (gone.role === 'guest') { const host = hostOf(conns); if (host) host.send(out({ t: 'gone', id: gone.id })); return; }
  for (const c of conns) { c.send(out({ t: 'gone', id: gone.id })); c.close(1000, 'host left'); }
}

// Sliding-window message counter per connection id. In-memory on purpose: it resets if the object hibernates,
// which only happens after a quiet spell, when the counters would be near zero anyway.
export function rateLimiter({ msgs, perMs } = RATE, now = () => Date.now()) {
  const seen = new Map();
  return id => {
    const t = now(), w = (seen.get(id) || []).filter(x => t - x < perMs);
    w.push(t); seen.set(id, w);
    return w.length <= msgs;
  };
}
