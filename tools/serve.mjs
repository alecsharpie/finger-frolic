// Serves the game: node tools/serve.mjs [port] [--lan] [--relay]  (copied from ~/me/co-op). Only this machine can reach it
// unless --lan is given, which opens it to the home network so phones can join.
// Also answers /__lan with this machine's LAN address, which the board uses for its QR code. With --relay it also
// runs the relay (`wrangler dev` in server/) on :8787, which pages served from this machine use by default.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +process.argv.slice(2).find(a => /^\d+$/.test(a)) || 8080;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown' };
const ip = Object.values(os.networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
const open = process.argv.includes('--lan');
const lan = open && ip && `http://${ip}:${port}`;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/__lan') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ origin: lan })); }
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root) || /[\\/](node_modules|server|\.)/.test('/' + path.relative(root, file))) { res.writeHead(404); return res.end(); }
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end('not found'); }
}).listen(port, open ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`game:   http://localhost:${port}/`);
  if (lan) console.log(`phones: ${lan}/  (same Wi-Fi)`);
  else console.log('phones: run with --lan to let phones on your Wi-Fi join');
  console.log(`dev:    http://localhost:${port}/dev.html  (TV + three phones in one tab, no relay needed)`);
});

if (process.argv.includes('--relay')) {
  const relay = spawn('npm', ['--prefix', path.join(root, 'server'), 'run', 'dev'], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('relay:  ws://localhost:8787  (wrangler dev)');
  const stop = () => { relay.kill(); process.exit(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
