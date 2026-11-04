// Pixel art in HTML: icons, sprites and pixel-font text as <img> tags with crisp scaling. Each image is baked once
// (shared/pix.js, shared/pixfont.js) and turned into a data URL, cached by key, so menus re-render for free.
import { frame } from './pix.js';
import { textCanvas } from './pixfont.js';
import { ICONS } from '../icons.js';
import { MONSTERS, wizard, chip, wyrmHead } from '../sprites.js';

const URLS = new Map();
function toURL(key, make) {
  let u = URLS.get(key);
  if (!u) {
    const src = make(), c = document.createElement('canvas');
    c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0);
    u = { url: c.toDataURL(), w: src.width, h: src.height };
    URLS.set(key, u);
  }
  return u;
}

// The canvas for a named picture: an icon, a monster, a wizard in a colour ('wizard:#ff5a8a'), or a chip
// ('chip:u', 'chip:tri').
export function picture(name) {
  if (ICONS[name]) return frame(ICONS[name], 0);
  if (MONSTERS[name]) return frame(MONSTERS[name], 0);
  if (name === 'boss') return frame(wyrmHead, 0);
  if (name.startsWith('wizard:')) { const c = name.slice(7); return frame(wizard, 0, 'normal', c, c); }
  if (name.startsWith('chip:')) { const g = name.slice(5), kind = 'udlr'.includes(g) ? 'arrow' : 'shape'; return frame(chip, 0, 'normal', { kind, glyph: g }, kind + g); }
  throw new Error('no picture ' + name);
}

// <img> of a picture at a whole-number scale (so pixels stay square): `px` is the wanted height in CSS pixels.
export function pic(name, px = 32, cls = '') {
  const u = toURL('p:' + name, () => picture(name)), k = Math.max(1, Math.round(px / u.h));
  return `<img class="px ${cls}" src="${u.url}" width="${u.w * k}" height="${u.h * k}" alt="">`;
}

// <img> of a line of pixel-font text, `px` tall (rounded to whole pixels of the font).
export function ptext(str, px = 40, color = 'white', cls = '') {
  const u = toURL('t:' + str + '|' + color, () => textCanvas(str, color)), k = Math.max(1, Math.round(px / u.h));
  return `<img class="px ptext ${cls}" src="${u.url}" width="${u.w * k}" height="${u.h * k}" alt="${String(str).replace(/"/g, '')}">`;
}

export const PIXEL_CSS = `
  img.px { image-rendering: pixelated; image-rendering: crisp-edges; vertical-align: middle; display: inline-block; }
`;
