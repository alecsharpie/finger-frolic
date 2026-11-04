// Cloudflare adapter for the relay in room.js.
//   GET /room/<CODE>?role=host|guest  (WebSocket upgrade)  -> the Room Durable Object named <CODE>
//   GET /health                                            -> "ok"
// One Durable Object per room code, so everyone in a room reaches the same instance wherever they are. It uses the
// WebSocket Hibernation API: between messages the object can be evicted from memory (and stops costing duration)
// while the sockets stay open; each socket's {id, role} rides along as its attachment. Nothing is logged or stored:
// the game runs on the board.
import { DurableObject } from 'cloudflare:workers';
import { admit, joined, refuse, message, left, rateLimiter } from './room.js';

const CODE = /^[A-HJ-NP-Z2-9]{5}$/; // randCode() in shared/net.js

// ALLOWED_ORIGINS is a comma list; a trailing ':*' allows any port (for http://localhost:*), and '*' allows any
// origin (only for local play over home Wi-Fi, set in .dev.vars, where phones arrive as http://192.168.x.y:port).
export function allowed(origin, list) {
  if (!origin) return false;
  return list.split(',').map(s => s.trim()).filter(Boolean).some(a =>
    a === '*' ? true :
    a.endsWith(':*') ? origin === a.slice(0, -2) || (origin.startsWith(a.slice(0, -1)) && /^\d+$/.test(origin.slice(a.length - 1))) : origin === a);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
    const m = url.pathname.match(/^\/room\/([^/]+)$/);
    if (!m || !CODE.test(m[1])) return new Response('not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a WebSocket', { status: 426 });
    if (!allowed(req.headers.get('Origin'), env.ALLOWED_ORIGINS || '')) return new Response('origin not allowed', { status: 403 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.rate = rateLimiter();
    // answered by the runtime without waking the object, so idle rooms stay asleep
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  conn(ws) { const a = ws.deserializeAttachment() || {}; return { id: a.id, role: a.role, send: s => { try { ws.send(s) } catch (e) {} }, close: (c, r) => { try { ws.close(c, r) } catch (e) {} } }; }
  conns(except) { return this.ctx.getWebSockets().filter(ws => ws !== except && ws.readyState === 1).map(ws => this.conn(ws)).filter(c => c.id); }

  async fetch(req) {
    const role = new URL(req.url).searchParams.get('role');
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const err = admit(this.conns(server), role);
    if (err) { refuse(this.conn(server), err); return new Response(null, { status: 101, webSocket: client }); }
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), role });
    joined(this.conns(), this.conn(server));
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, raw) { message(this.conns(), this.conn(ws), raw, this.rate); }
  async webSocketClose(ws, code, reason) { this.gone(ws); try { ws.close(code, reason) } catch (e) {} }
  async webSocketError(ws) { this.gone(ws); }
  gone(ws) { const me = this.conn(ws); if (me.id) left(this.conns(ws), me); }
}
