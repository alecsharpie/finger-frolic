// Networking, copied from ~/me/co-op/shared/net.js: the board (TV, host) runs the game; each phone (pad, guest)
// holds a seat and sends swipes. Two transports with one interface, as in Age Up:
//   {id, send(to|null, body), close()} plus handlers {open(id), peer(id), msg(from, body), close(id), error(e)}
//   ws    one WebSocket to the relay (server/: a Cloudflare Durable Object per room code)
//   local BroadcastChannel between tabs of one browser, no server at all (dev.html)
// On top of that, hostRoom() and joinRoom() handle seats and reconnecting. A phone is identified by a cid kept in
// its localStorage, not by its socket, so it gets the same seat back after its screen locks or the board reloads.

export const RELAY_URL = 'wss://frolic-relay.alecsharpie.workers.dev'; // written by server/deploy.sh

const q = new URLSearchParams(location.search);
export const param = k => q.get(k);

export function load(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}
export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

const LAN = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

// ?relay=ws://host:8787 overrides (remembered; ?relay= with no value clears it). Served from this machine or the
// home network, the relay is assumed to be `npm run dev` in server/ on the same host; anywhere else, the live one.
export function relayUrl() {
  let u = null;
  if (q.has('relay')) { u = q.get('relay'); if (u) save('frolic-relay', u); else localStorage.removeItem('frolic-relay'); }
  else u = load('frolic-relay');
  if (u) return u;
  return LAN.test(location.hostname) ? `ws://${location.hostname}:8787` : RELAY_URL;
}

export function randCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += A[Math.floor(Math.random() * A.length)];
  return c;
}

export function localTransport(room, isHost, h) {
  const bc = new BroadcastChannel('frolic-' + room);
  const id = 'L' + Math.random().toString(36).slice(2, 8), role = isHost ? 'host' : 'guest';
  bc.onmessage = e => {
    const m = e.data;
    if (!m || m.from === id || m.role === role) return; // the host hears guests, guests hear the host
    if (m.to && m.to !== id) return;
    h.msg(m.from, m.body);
  };
  setTimeout(() => h.open(id), 0);
  return { id, send: (to, body) => bc.postMessage({ from: id, role, to, body }), close: () => bc.close() };
}

export function wsTransport(room, isHost, h) {
  let ws = null, closed = false, ended = false, beat = null, slow = null, hostId = null;
  const tr = {
    id: null,
    send: (to, body) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ to, body })); },
    close: () => { closed = true; clearInterval(beat); clearTimeout(slow); if (ws) try { ws.close(1000); } catch (e) {} },
  };
  const end = e => { if (ended || closed) return; ended = true; clearInterval(beat); clearTimeout(slow); h.error(e); };
  try { ws = new WebSocket(relayUrl() + '/room/' + room + '?role=' + (isHost ? 'host' : 'guest')); }
  catch (e) { setTimeout(() => end({ type: 'network', message: 'bad relay address' }), 0); return tr; }
  slow = setTimeout(() => { if (!tr.id) { end({ type: 'network', message: 'could not reach the game server' }); try { ws.close(); } catch (e) {} } }, 10000);
  // heartbeat: keeps home routers from dropping a quiet room; the server answers without waking up
  ws.onopen = () => { beat = setInterval(() => { if (ws.readyState === 1) ws.send('ping'); }, 25000); };
  ws.onmessage = e => {
    if (e.data === 'pong') return;
    let m; try { m = JSON.parse(e.data); } catch (x) { return; }
    if (m.t === 'hello') { clearTimeout(slow); tr.id = m.id; h.open(m.id); }
    else if (m.t === 'peer') { if (!isHost) hostId = m.id; h.peer(m.id); }
    else if (m.t === 'msg') h.msg(m.from, m.body);
    else if (m.t === 'gone') { if (m.id === hostId) end({ type: 'host-left' }); else h.close(m.id); }
    else if (m.t === 'error') end({ type: m.type });
  };
  ws.onclose = () => end({ type: 'network', message: tr.id ? 'lost the connection to the game server' : 'could not reach the game server' });
  return tr;
}

// Keeps the screen on while a game page is open: a phone held as a controller is touched constantly but the TV
// laptop is not, and a laptop that sleeps takes the TV with it. Needs a secure context (GitHub Pages, localhost); some browsers only grant it
// after a tap, so it asks again on each one until it holds the lock.
export function keepAwake() {
  if (!('wakeLock' in navigator)) return;
  let lock = null;
  const get = async () => {
    if (lock || document.visibilityState !== 'visible') return;
    try { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } catch (e) {}
  };
  get();
  document.addEventListener('visibilitychange', get);
  addEventListener('pointerdown', get, { passive: true });
}

const transport = (net, room, isHost, h) => (net === 'local' ? localTransport : wsTransport)(room, isHost, h);
const backoff = n => Math.min(8000, 500 * 2 ** n);

// The board's side. seats: the seat names, e.g. ['keeper', 'navigator']. Calls onSeats() whenever who-sits-where
// or who-is-connected changes, and onAction(seat, body) for each action from a seated phone.
export function hostRoom({ game, seats, onSeats, onAction, onStatus = () => {} }) {
  keepAwake();
  const net = param('net') === 'local' ? 'local' : 'ws';
  // The real board remembers its code so phones can rejoin after a reload. A local (dev mode) room is never
  // remembered, so opening dev mode doesn't leave the real board stuck on its code.
  const saved = load(`frolic-room-${game}`), DEV = 'DEVXX';
  const room = (param('room') || (saved !== DEV && saved) || randCode()).toUpperCase();
  if (net !== 'local') save(`frolic-room-${game}`, room);
  const seatKey = `frolic-seats-${game}-${room}`;
  // seat -> {cid, name}; who is connected right now is kept apart, since it is not part of the save
  const sat = Object.fromEntries(seats.map(s => [s, (load(seatKey) || {})[s] || null]));
  const live = new Map(); // transport id -> cid
  let tr = null, tries = 0;

  const seatOf = cid => seats.find(s => sat[s] && sat[s].cid === cid);
  const idOf = cid => [...live].find(([, c]) => c === cid)?.[0];
  const changed = () => { save(seatKey, sat); onSeats(); };

  function msg(from, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join' && typeof m.cid === 'string') {
      for (const [id, c] of live) if (c === m.cid && id !== from) live.delete(id); // its old socket
      live.set(from, m.cid);
      let seat = seatOf(m.cid);
      if (!seat) {
        seat = seats.includes(m.want) && !sat[m.want] ? m.want : seats.find(s => !sat[s]);
        if (!seat) return tr.send(from, { t: 'full' });
      }
      sat[seat] = { cid: m.cid, name: String(m.name || '').slice(0, 16) };
      tr.send(from, { t: 'seat', seat });
      changed();
    } else if (m.t === 'act') {
      const seat = seatOf(live.get(from));
      if (seat) onAction(seat, m.body);
    }
  }

  function open() {
    onStatus('connecting');
    tr = transport(net, room, true, {
      open: () => { tries = 0; onStatus('open'); tr.send(null, { t: 'hostup' }); },
      peer: () => {},
      msg,
      close: id => { live.delete(id); onSeats(); },
      error: e => { live.clear(); onSeats(); onStatus('retrying', e); setTimeout(open, backoff(tries++)); },
    });
  }
  open();

  return {
    room, net, seats,
    seat: s => sat[s],
    connected: s => !!(sat[s] && idOf(sat[s].cid)),
    send(seat, body) { const id = sat[seat] && idOf(sat[seat].cid); if (id) tr.send(id, { t: 'game', body }); },
    // one relay message to every phone: what real-time state uses, so the message count does not grow with players
    all(body) { if (tr) tr.send(null, { t: 'game', body }); },
    free(seat) { sat[seat] = null; changed(); },
    swap(a, b) {
      [sat[a], sat[b]] = [sat[b], sat[a]];
      for (const s of [a, b]) { const id = sat[s] && idOf(sat[s].cid); if (id) tr.send(id, { t: 'seat', seat: s }); }
      changed();
    },
    clearSeats() { for (const s of seats) sat[s] = null; changed(); },
  };
}

// A phone's side. Keeps trying to reach the board until it gets a seat, and again whenever the connection drops.
export function joinRoom({ room, name = '', want = null, onSeat, onMessage, onStatus = () => {} }) {
  keepAwake();
  const net = param('net') === 'local' ? 'local' : 'ws';
  let cid = param('cid') || load('frolic-cid');
  if (!cid) { cid = Math.random().toString(36).slice(2, 10); save('frolic-cid', cid); }
  let tr = null, hostId = null, tries = 0, timer = null, up = false;

  const join = () => tr.send(hostId, { t: 'join', cid, name, want });
  function retry(e) {
    up = false; onStatus('waiting', e);
    clearTimeout(timer); timer = setTimeout(open, backoff(tries++));
  }
  function open() {
    clearTimeout(timer);
    if (tr) try { tr.close(); } catch (e) {}
    onStatus('connecting');
    tr = transport(net, room, false, {
      open: () => { up = true; if (net === 'local') join(); },
      peer: id => { hostId = id; tries = 0; join(); },
      msg: (from, m) => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'hostup') { hostId = from; join(); }
        else if (m.t === 'seat') { tries = 0; onStatus('open'); onSeat(m.seat); }
        else if (m.t === 'full') onStatus('full');
        else if (m.t === 'game') onMessage(m.body);
      },
      close: () => {},
      error: retry,
    });
  }
  open();
  // a phone that wakes from sleep should not wait out its backoff
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !up) { tries = 0; open(); } });

  return { cid, act: body => tr.send(hostId, { t: 'act', body }) };
}
