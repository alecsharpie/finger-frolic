// The cast, painted with shared/pix.js. Every sprite is a small grid (sizes below), anchored at its feet, and
// is baked once per frame into a canvas. Light from the upper-left; one shared ink; ramps from shared/pix.js.
// See them all at tools/sprites.html (npm start, then open /tools/sprites.html).
import { ramp, flat } from './shared/pix.js';

const INK = '#1c1230';
const EYE = { white: flat('#fbf7ff'), pupil: flat('#1c1230'), mouth: flat('#3a1430'), tooth: ['#ffffff', '#f3ecdc', '#cfc3aa', '#a8987a'], glint: flat('#ffffff') };
// eyes: two whites with pupils looking toward (lx, ly); `angry` adds a brow, `ouch` squeezes them shut
function eyes(P, cx, cy, gap, { lx = 0, ly = 1, angry = false, size = 2, mat = 'white' } = {}) {
  for (const s of [-1, 1]) {
    const ex = cx + s * gap;
    P.box(ex - size / 2 | 0, cy - size / 2 | 0, size, size, mat, 0);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) P.px((ex - size / 2 | 0) + x, (cy - size / 2 | 0) + y, mat, 0);
    P.px(Math.round(ex + lx * 0.5 - 0.5), Math.round(cy + ly * 0.5 - 0.5), 'pupil');
    if (angry) P.line(ex - s * 2, cy - size, ex + s * 0, cy - size + 1, 'pupil');
  }
}
const step4 = f => [0, 1, 0, -1][f % 4]; // a bob for 4-frame walks

// ---------- monsters (all face the viewer, walking down the lane) ----------
export const grunt = {
  id: 'grunt', w: 20, h: 20, anchor: [10, 19], frames: 4, ink: INK,
  mats: { body: ramp('#6fd36a'), belly: ramp('#b9f08a'), leaf: ramp('#3fa34d'), foot: ramp('#3f8a46'), ...EYE },
  paint(P, f) {
    const b = step4(f), sq = f % 2 ? 1 : 0;
    P.blob(6, 17 - (f === 1 ? 1 : 0), 3, 2, 'foot').blob(14, 17 - (f === 3 ? 1 : 0), 3, 2, 'foot');
    P.blob(10, 11 + b * 0.5, 7.5 + sq * 0.5, 6.5 - sq * 0.5, 'body');
    P.blob(10, 14 + b * 0.5, 4, 2.2, 'belly', 0.2);
    P.poly([[10, 4 + b], [13, 1 + b], [14, 3 + b], [11, 5 + b]], 'leaf', 1).px(10, 5 + b, 'leaf', 2);
    eyes(P, 10, 10 + b, 3, { ly: 1 });
    P.line(8, 13 + b, 12, 13 + b, 'mouth');
  },
};

export const brute = {
  id: 'brute', w: 28, h: 26, anchor: [14, 25], frames: 4, ink: INK,
  mats: { body: ramp('#9b6bff'), belly: ramp('#c6a6ff'), horn: ramp('#f1e3c4'), foot: ramp('#5f3fb8'), ...EYE },
  paint(P, f) {
    const b = step4(f) * 0.5;
    P.box(4, 22 - (f === 1 ? 1 : 0), 7, 4, 'foot', 2).box(17, 22 - (f === 3 ? 1 : 0), 7, 4, 'foot', 2);
    P.box(2, 6 + b, 24, 18, 'body', 6);
    P.box(8, 13 + b, 12, 9, 'belly', 4, 0.15);
    P.poly([[5, 8 + b], [2, 0 + b], [9, 6 + b]], 'horn').poly([[23, 8 + b], [26, 0 + b], [19, 6 + b]], 'horn');
    eyes(P, 14, 11 + b, 4, { angry: true });
    P.box(10, 16 + b, 8, 2, 'mouth', 0);
    P.px(10, 15 + b, 'tooth', 0).px(17, 15 + b, 'tooth', 0); // tusks
    P.px(10, 14 + b, 'tooth', 1).px(17, 14 + b, 'tooth', 1);
  },
};

export const runner = {
  id: 'runner', w: 16, h: 22, anchor: [8, 21], frames: 4, ink: INK,
  mats: { body: ramp('#ff9f43'), belly: ramp('#ffd08a'), spike: ramp('#ffdd55'), leg: ramp('#b5602a'), ...EYE },
  paint(P, f) {
    const k = [0, 2, 0, -2][f];
    P.line(6, 15, 5 - k * 0.5, 20, 'leg', 2).line(10, 15, 11 + k * 0.5, 20, 'leg', 2);
    P.px(5 - k * 0.5 - 1, 20, 'leg', 3).px(11 + k * 0.5 + 1, 20, 'leg', 3);
    P.blob(8, 10, 6, 7, 'body');
    P.blob(8, 13, 3.5, 3, 'belly', 0.2);
    P.poly([[6, 4], [8, 0], [10, 4]], 'spike', 1);
    eyes(P, 8, 9, 2.5, { angry: true });
    P.line(7, 13, 9, 13, 'mouth');
  },
};

export const spinner = { // a snail whose shell spins the arrow
  id: 'spinner', w: 22, h: 20, anchor: [11, 19], frames: 4, ink: INK,
  mats: { body: ramp('#3fd2d0'), shell: ramp('#2f8fb8'), swirl: ramp('#bff4f0'), ...EYE },
  paint(P, f) {
    P.blob(11, 16, 9, 3.2, 'body');
    P.blob(11, 9, 7, 7, 'shell');
    const a0 = f * Math.PI / 2;
    for (let a = 0; a < 10; a += 0.35) { const r = 0.6 * a; P.px(11 + Math.cos(a + a0) * r, 9 + Math.sin(a + a0) * r, 'swirl', a > 6 ? 1 : 0); }
    P.line(5, 13, 3, 7, 'body', 1).line(7, 13, 6, 6, 'body', 1);
    P.px(3, 6, 'white', 0).px(6, 5, 'white', 0).px(3, 7, 'pupil').px(6, 6, 'pupil');
  },
};

export const trickster = { // a masked imp
  id: 'trickster', w: 22, h: 22, anchor: [11, 21], frames: 4, ink: INK,
  mats: { body: ramp('#ff5d73'), mask: ramp('#2a1640'), horn: ramp('#ffe0b0'), tail: ramp('#c23a55'), foot: ramp('#a8304a'), ...EYE, white: flat('#ffe14d') },
  paint(P, f) {
    const b = step4(f) * 0.5, t = [0, 1, 2, 1][f];
    P.line(17, 15, 20, 12 - t, 'tail', 2).poly([[19, 11 - t], [21, 10 - t], [20, 13 - t]], 'tail', 1);
    P.blob(7, 19 - (f === 1 ? 1 : 0), 3, 2, 'foot').blob(15, 19 - (f === 3 ? 1 : 0), 3, 2, 'foot');
    P.blob(11, 12 + b, 7.5, 7, 'body');
    P.poly([[5, 7 + b], [4, 2 + b], [8, 6 + b]], 'horn').poly([[17, 7 + b], [18, 2 + b], [14, 6 + b]], 'horn');
    P.box(4, 9 + b, 14, 4, 'mask', 2);
    P.px(8, 10 + b, 'white', 0).px(9, 10 + b, 'white', 0).px(13, 10 + b, 'white', 0).px(14, 10 + b, 'white', 0);
    P.line(9, 16 + b, 13, 16 + b, 'mouth').px(9, 15 + b, 'mouth').px(13, 15 + b, 'mouth');
  },
};

export const golem = { // a stone golem with a glowing rune: the shape-drawing monster
  id: 'golem', w: 28, h: 28, anchor: [14, 27], frames: 4, ink: '#151020',
  mats: { stone: ramp('#8c8aa8'), dark: ramp('#5d5a78'), moss: ramp('#6fbf4a'), rune: ['#ffffff', '#9ff6ff', '#3fd7f0', '#1a7fb0'], foot: ramp('#4c4a66') },
  paint(P, f) {
    const b = step4(f) * 0.5, glow = f % 2;
    P.box(5, 23 - (f === 1 ? 1 : 0), 7, 4, 'foot', 1).box(16, 23 - (f === 3 ? 1 : 0), 7, 4, 'foot', 1);
    P.box(1, 11 + b, 6, 10, 'dark', 2).box(21, 11 + b, 6, 10, 'dark', 2); // arms
    P.box(5, 5 + b, 18, 19, 'stone', 3);
    P.box(5, 4 + b, 18, 3, 'moss', 1).px(7, 7 + b, 'moss', 2).px(15, 7 + b, 'moss', 2).px(20, 7 + b, 'moss', 2);
    P.line(9, 15 + b, 10, 17 + b, 'dark', 3).line(18, 13 + b, 17, 16 + b, 'dark', 3); // cracks
    P.px(11, 10 + b, 'rune', 1).px(12, 10 + b, 'rune', 1).px(16, 10 + b, 'rune', 1).px(17, 10 + b, 'rune', 1); // eyes
    // the rune on its chest
    P.line(12, 14 + b, 16, 14 + b, 'rune', glow ? 0 : 1).line(14, 13 + b, 14, 19 + b, 'rune', glow ? 0 : 1).line(12, 18 + b, 16, 18 + b, 'rune', 2);
  },
};

export const gift = {
  id: 'gift', w: 20, h: 20, anchor: [10, 19], frames: 4, ink: '#3a1a10',
  mats: { box: ramp('#ffcf33'), ribbon: ramp('#ff4f7b'), shine: flat('#fffbe0') },
  paint(P, f) {
    const hop = [0, 2, 3, 1][f];
    P.box(2, 7 - hop, 16, 12, 'box', 1);
    P.box(8, 7 - hop, 4, 12, 'ribbon', 0).box(2, 11 - hop, 16, 3, 'ribbon', 0);
    P.blob(6, 5 - hop, 3.5, 2.2, 'ribbon').blob(14, 5 - hop, 3.5, 2.2, 'ribbon').blob(10, 6 - hop, 1.6, 1.6, 'ribbon', 0.3);
    P.px(4, 9 - hop, 'shine').px(4, 10 - hop, 'shine').px(5, 9 - hop, 'shine');
  },
};

// The boss: a long wyrm whose body stretches across every lane. Head in the middle, segments either side.
export const wyrmHead = {
  id: 'wyrmHead', w: 46, h: 36, anchor: [23, 35], frames: 2, ink: INK,
  mats: { scale: ramp('#5b4bd6'), belly: ramp('#9d8cff'), crown: ramp('#ffd23f'), ...EYE, white: flat('#ffe14d') },
  paint(P, f) {
    const j = f; // jaw
    P.box(4, 8, 38, 24 + j, 'scale', 10);
    P.box(11, 22 + j, 24, 8, 'belly', 3, 0.2);
    for (let k = 0; k < 5; k++) P.poly([[10 + k * 6, 9], [13 + k * 6, 1 + (k % 2) * 2], [16 + k * 6, 9]], 'crown');
    P.box(9, 13, 8, 6, 'white', 2).box(29, 13, 8, 6, 'white', 2);
    P.box(12, 15, 3, 3, 'pupil', 0).box(32, 15, 3, 3, 'pupil', 0);
    P.line(8, 11, 17, 13, 'pupil').line(38, 11, 29, 13, 'pupil'); // brows
    P.box(15, 25 + j, 16, 3 + j, 'mouth', 1);
    for (let k = 0; k < 4; k++) P.px(17 + k * 4, 25 + j, 'tooth', 0);
  },
};
export const wyrmSeg = {
  id: 'wyrmSeg', w: 26, h: 26, anchor: [13, 25], frames: 2, ink: INK,
  mats: { scale: ramp('#5b4bd6'), belly: ramp('#9d8cff'), plate: ramp('#ffd23f'), foot: ramp('#3b2f98') },
  paint(P, f) {
    P.box(4, 21 - f, 5, 4, 'foot', 1).box(17, 20 + f, 5, 4, 'foot', 1);
    P.blob(13, 13, 12, 9, 'scale');
    P.blob(13, 17, 8, 3.5, 'belly', 0.15);
    P.poly([[9, 6], [13, 0], [17, 6]], 'plate');
  },
};

export const MONSTERS = { grunt, brute, runner, spinner, trickster, golem, gift };

// ---------- the heroes: little wizards in their player's colour ----------
// frames: 0-1 idle (breathing), 2 casting (staff thrust forward, orb bright), 3 dizzy
export const wizard = {
  id: 'wizard', w: 20, h: 26, anchor: [10, 25], frames: 4, ink: INK,
  mats: c => ({ robe: ramp(c), hat: ramp(c), band: ramp('#ffd23f'), skin: ramp('#f2c9a0'), beard: ramp('#f4f1ff'),
    staff: ramp('#9a6a3a'), orb: ['#ffffff', '#fff6c0', c, '#1c1230'], ...EYE }),
  paint(P, f) {
    const cast = f === 2, b = f === 1 ? 1 : 0, dizzy = f === 3;
    // robe
    P.poly([[5, 25], [7, 13 + b], [13, 13 + b], [15, 25]], 'robe');
    P.box(4, 23, 12, 3, 'robe', 1);
    // head and beard
    P.blob(10, 12 + b, 4, 3.5, 'skin');
    P.poly([[7, 13 + b], [13, 13 + b], [10, 19 + b]], 'beard', 1);
    if (dizzy) { P.px(8, 11 + b, 'pupil').px(12, 11 + b, 'pupil').px(9, 12 + b, 'pupil').px(11, 12 + b, 'pupil'); }
    else { P.px(8, 11 + b, 'pupil').px(12, 11 + b, 'pupil'); }
    // pointy hat, tilted, with a band
    P.poly([[4, 10 + b], [16, 10 + b], [12, 1 + b], [9, 0 + b]], 'hat');
    P.box(5, 8 + b, 10, 2, 'band', 0);
    P.px(9, 0 + b, 'hat', 0);
    // staff and orb
    const sx = cast ? 17 : 16, top = cast ? 4 : 8;
    P.line(sx, 24, sx + (cast ? 1 : 0), top + 2, 'staff', 2);
    P.blob(sx + (cast ? 1 : 0), top, cast ? 2.8 : 2, cast ? 2.8 : 2, 'orb', 0.3);
    P.px(14, 17 + b, 'skin', 1).px(15, 17 + b, 'skin', 1); // hand on staff
  },
};

// ---------- arrow and shape chips (the "what to do" over each monster) ----------
const ARROW = { // 9×9 white glyphs
  u: ['....#....', '...###...', '..#####..', '.#######.', '...###...', '...###...', '...###...', '...###...', '.........'],
};
const rot = g => g.map((_, y) => g.map(r => r[y]).reverse().join('')); // 90° clockwise
ARROW.r = rot(ARROW.u); ARROW.d = rot(ARROW.r); ARROW.l = rot(ARROW.d);
const SHAPE_GLYPH = {
  circle: ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..'],
  tri:    ['...#...', '...#...', '..#.#..', '..#.#..', '.#...#.', '.#...#.', '#######'],
  square: ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######'],
  zig:    ['#######', '.....#.', '....#..', '...#...', '..#....', '.#.....', '#######'],
  v:      ['......#', '.....#.', '#...#..', '.#.#...', '..#....', '.......', '.......'],
};
export const GLYPH = { ...ARROW, ...SHAPE_GLYPH };
export const isArrow = t => t === 'u' || t === 'd' || t === 'l' || t === 'r';

// kind: 'arrow' (white chip), 'trick' (red chip: swipe the other way), 'shape' (violet chip with a rune)
export const chip = {
  id: 'chip', w: 15, h: 15, anchor: [7, 7], frames: 1, ink: INK,
  mats: ({ kind }) => ({
    base: kind === 'trick' ? ramp('#ff3b5c') : kind === 'shape' ? ramp('#8a4dff') : ['#ffffff', '#f4f0ff', '#cfc6ea', '#9a8fc0'],
    glyph: kind === 'arrow' ? flat('#1c1230') : flat('#ffffff'),
  }),
  paint(P, f, { glyph }) {
    P.box(0, 0, 15, 15, 'base', 4);
    const g = GLYPH[glyph], ox = Math.floor((15 - g[0].length) / 2), oy = Math.floor((15 - g.length) / 2);
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') P.px(ox + x, oy + y, 'glyph', 1); }));
  },
};

// ---------- little things ----------
export const heart = {
  id: 'heart', w: 9, h: 8, anchor: [4, 7], frames: 2, ink: INK,
  mats: { red: ramp('#ff4f6d'), off: ramp('#3a2a50') },
  paint(P, f) { const m = f ? 'off' : 'red'; P.blob(2.5, 2.5, 2.5, 2.5, m).blob(6.5, 2.5, 2.5, 2.5, m).poly([[0, 3], [9, 3], [4.5, 8]], m, f ? 2 : 1); P.px(2, 1, m, 0); },
};

export const ALL = { ...MONSTERS, wyrmHead, wyrmSeg, wizard, chip, heart };
