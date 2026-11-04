// Join links for the TV: the phone URL and its QR code. Copied from ~/me/co-op/shared/lobby.js, minus its seat cards.
// Needs qrcode-generator loaded as a global (see index.html).
import { param } from './net.js';

// tools/serve.mjs answers /__lan with this machine's address on the home network, so a board opened at
// localhost still shows phones a URL they can reach. Elsewhere (GitHub Pages) the request just fails.
let lan = null;
export async function findLan() {
  if (!/^(localhost|127\.)/.test(location.hostname)) return;
  try { lan = (await (await fetch('/__lan')).json()).origin; } catch (e) {}
}

export function joinUrl(room, page = 'pad.html') {
  const base = new URL(page, (lan || location.origin) + location.pathname);
  base.searchParams.set('room', room);
  for (const k of ['net', 'relay']) if (param(k) != null) base.searchParams.set(k, param(k));
  return base.href;
}

// true when the link only works on this machine: phones cannot reach localhost
export const stuckOnLocalhost = url => /^(localhost|127\.)/.test(new URL(url).hostname) && param('net') !== 'local';

export function qrSvg(text) {
  try { const g = qrcode(0, 'M'); g.addData(text); g.make(); return g.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
  catch (e) { return ''; }
}
