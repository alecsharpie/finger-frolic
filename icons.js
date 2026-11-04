// The UI icon set: small hand-placed pixel grids in the same style as the sprites (shared ink outline added by the
// painter, ramps from shared/pix.js). Used by the TV and phone menus as <img> (shared/ui.js) and on the canvas.
// Every icon is one frame; see them all at tools/sprites.html.
import { ramp, flat } from './shared/pix.js';

const INK = '#1c1230';
const M = {
  red: ramp('#e8402f'), orange: ramp('#ff9a2e'), yellow: ramp('#ffd23f'), gold: ramp('#ffc21f'),
  white: ['#ffffff', '#f4f0ff', '#cfc6ea', '#9a8fc0'], ice: ramp('#7cc8ee'), blue: ramp('#3f8fff'),
  green: ramp('#5bd06a'), leaf: ramp('#3fa34d'), wood: ramp('#9a6a3a'), dirt: ramp('#7a5a3a'),
  steel: ['#f4f8ff', '#c4ccd8', '#8a94a6', '#4a5266'], violet: ramp('#9b5cff'), pink: ramp('#ff5a8a'),
  silver: ['#ffffff', '#dde3ee', '#a8b0c4', '#6a7088'], bronze: ramp('#d0803a'), brick: ramp('#c0583a'), mortar: ramp('#5a4a5a'),
  bone: ['#ffffff', '#f2ead6', '#cfc3aa', '#8a7a62'], grey: ramp('#8c8aa8'), black: flat('#1c1230'),
};
// one icon from rows and a key -> [material, tone] map
const icon = (id, rows, map) => ({
  id: 'icon-' + id, w: Math.max(...rows.map(r => r.length)) + 2, h: rows.length + 2, anchor: [0, 0], frames: 1, ink: INK, mats: M,
  paint(P) { P.grid(rows, map, 1, 1); },
});

export const ICONS = {
  flame: icon('flame', [
    '.....a......',
    '....aa......',
    '....aba.....',
    '...abba..a..',
    '...abbba.a..',
    '..abbcbbaa..',
    '..abccbbba..',
    '.abbcccbba..',
    '.abccdccba..',
    '.abcdddcba..',
    '..abcddcba..',
    '...aabbaa...',
  ], { a: ['red', 1], b: ['orange', 1], c: ['yellow', 1], d: ['yellow', 0] }),

  snow: icon('snow', [
    '.....a.....',
    '...a.a.a...',
    '....aaa....',
    '.a...a...a.',
    '..a..a..a..',
    'aaaaabaaaaa',
    '..a..a..a..',
    '.a...a...a.',
    '....aaa....',
    '...a.a.a...',
    '.....a.....',
  ], { a: ['ice', 1], b: ['white', 0] }),

  bolt: icon('bolt', [
    '.....aaaa.',
    '....abba..',
    '...abba...',
    '..abba....',
    '.abbbaaaa.',
    '.aabbbbba.',
    '....abba..',
    '...abba...',
    '..abba....',
    '..aba.....',
    '.aa.......',
  ], { a: ['yellow', 2], b: ['yellow', 0] }),

  crown: icon('crown', [
    'a....a....a',
    'aa..aaa..aa',
    'aba.aba.aba',
    'abbaabaabba',
    'abbbbbbbbba',
    'abcbbdbbcba',
    'abbbbbbbbba',
    'aaaaaaaaaaa',
  ], { a: ['gold', 2], b: ['gold', 1], c: ['red', 1], d: ['ice', 0] }),

  sparkle: icon('sparkle', [
    '.....a.....',
    '.....a.....',
    '....aba....',
    '....aba....',
    '..aabbbaa..',
    'aabbbcbbbaa',
    '..aabbbaa..',
    '....aba....',
    '....aba....',
    '.....a.....',
    '.....a.....',
  ], { a: ['gold', 2], b: ['gold', 0], c: ['white', 0] }),

  heart: icon('heart', [
    '.aaa...aaa.',
    'abbca.abbba',
    'abcbbabbbba',
    'abbbbbbbbba',
    'abbbbbbbbba',
    '.abbbbbbba.',
    '..abbbbba..',
    '...abbba...',
    '....aba....',
    '.....a.....',
  ], { a: ['pink', 2], b: ['pink', 1], c: ['white', 0] }),

  wand: icon('wand', [
    '.......a...',
    '......aba..',
    '.....abcba.',
    '......aba..',
    '.....d.a...',
    '....d......',
    '...d.......',
    '..d........',
    '.d.........',
    'd..........',
  ], { a: ['gold', 1], b: ['gold', 0], c: ['white', 0], d: ['wood', 1] }),

  pencil: icon('pencil', [
    '.........aa',
    '........abb',
    '.......cbba',
    '......cbbc.',
    '.....cbbc..',
    '....cbbc...',
    '...cbbc....',
    '..ebbc.....',
    '..eec......',
    '.e.........',
  ], { a: ['pink', 1], b: ['yellow', 1], c: ['orange', 2], e: ['wood', 0] }),

  shield: icon('shield', [
    'aaaaaaaaaa',
    'abbbbbbbba',
    'acbbbdbbba',
    'abbbdddbba',
    'abbbbdbbba',
    '.abbbdbba.',
    '.abbbbbba.',
    '..abbbba..',
    '...abba...',
    '....aa....',
  ], { a: ['blue', 2], b: ['blue', 1], c: ['white', 0], d: ['gold', 0] }),

  check: icon('check', [
    '.........aa',
    '........aaa',
    '.......aaa.',
    'aa....aaa..',
    'aaa..aaa...',
    '.aaaaaa....',
    '..aaaa.....',
    '...aa......',
  ], { a: ['green', 1] }),

  sword: icon('sword', [
    '...a...',
    '..aba..',
    '..aba..',
    '..aba..',
    '..aba..',
    '..aba..',
    '..aba..',
    '..aba..',
    'ccccccc',
    '...d...',
    '...d...',
    '..ccc..',
  ], { a: ['steel', 2], b: ['steel', 0], c: ['gold', 1], d: ['wood', 2] }),

  skull: icon('skull', [
    '..aaaaaaa..',
    '.abbbbbbba.',
    'abbbbbbbbba',
    'abbbbbbbbba',
    'ab..bbb..ba',
    'ab..bbb..ba',
    'abbbb.bbbba',
    '.abbbbbbba.',
    '..ab.b.ba..',
    '..abbbbba..',
  ], { a: ['bone', 2], b: ['bone', 1] }),

  sprout: icon('sprout', [
    '.aa.....bb.',
    'aaaa...bbbb',
    '.aaaa.bbbb.',
    '..aaacbbb..',
    '.....c.....',
    '.....c.....',
    '..ddddddd..',
    '.ddddddddd.',
  ], { a: ['green', 1], b: ['leaf', 1], c: ['leaf', 2], d: ['dirt', 1] }),

  target: icon('target', [
    '...aaaaa...',
    '..abbbbba..',
    '.abaaaaaba.',
    'abab...baba',
    'aba.ccc.aba',
    'aba.ccc.aba',
    'aba.ccc.aba',
    'abab...baba',
    '.abaaaaaba.',
    '..abbbbba..',
    '...aaaaa...',
  ], { a: ['red', 1], b: ['white', 1], c: ['red', 0] }),

  halo: icon('halo', [
    '..aaaaaaa..',
    '.abbbbbbba.',
    'ab.......ba',
    '.abbbbbbba.',
    '..aaaaaaa..',
    '...........',
    'c..ddddd..c',
    'cc.ddddd.cc',
    'ccc.ddd.ccc',
  ], { a: ['gold', 2], b: ['gold', 0], c: ['white', 1], d: ['pink', 1] }),

  brick: icon('brick', [
    'aaaaaaaaaaaa',
    'bbbbbabbbbba',
    'bcbbbabcbbba',
    'aaaaaaaaaaaa',
    'bbabbbbbabbb',
    'bbabcbbbabcb',
    'aaaaaaaaaaaa',
  ], { a: ['mortar', 2], b: ['brick', 1], c: ['brick', 0] }),

  stars: icon('stars', [
    '.a.......a.',
    'aba.....aba',
    '.a...a...a.',
    '....aba....',
    '.....a.....',
    '..a.....a..',
    '.aba...aba.',
    '..a.....a..',
  ], { a: ['yellow', 0], b: ['white', 0] }),

  speaker: icon('speaker', [
    '....a.......',
    '...aa...b...',
    'aaaba....b..',
    'abbba.b...b.',
    'abbba.b...b.',
    'aaaba....b..',
    '...aa...b...',
    '....a.......',
  ], { a: ['steel', 1], b: ['white', 0] }),

  mute: icon('mute', [
    '....a.......',
    '...aa.......',
    'aaaba.b...b.',
    'abbba..b.b..',
    'abbba...b...',
    'aaaba..b.b..',
    '...aa.b...b.',
    '....a.......',
  ], { a: ['steel', 1], b: ['red', 0] }),

  arrowL: icon('arrowL', ['...a.....', '..aa.....', '.abaaaaaa', 'abbbbbbba', '.abaaaaaa', '..aa.....', '...a.....'], { a: ['white', 2], b: ['white', 0] }),
  arrowR: icon('arrowR', ['.....a...', '.....aa..', 'aaaaaaba.', 'abbbbbbba', 'aaaaaaba.', '.....aa..', '.....a...'], { a: ['white', 2], b: ['white', 0] }),
  arrowU: icon('arrowU', ['...a...', '..aba..', '.abbba.', 'aabbbaa', '..aba..', '..aba..', '..aba..', '..aba..', '..aaa..'], { a: ['white', 2], b: ['white', 0] }),
};

// medals: a ribbon and a disc with the place on it
const DIGITS = { 1: ['.a.', 'aa.', '.a.', '.a.', 'aaa'], 2: ['aa.', '..a', '.a.', 'a..', 'aaa'], 3: ['aa.', '..a', '.a.', '..a', 'aa.'] };
for (const [n, metal] of [[1, 'gold'], [2, 'silver'], [3, 'bronze']]) {
  ICONS['medal' + n] = {
    id: 'icon-medal' + n, w: 14, h: 16, anchor: [0, 0], frames: 1, ink: INK, mats: M,
    paint(P) {
      P.poly([[3, 1], [6, 1], [8, 7], [5, 7]], 'red', 1).poly([[8, 1], [11, 1], [9, 7], [6, 7]], 'blue', 1);
      P.blob(7, 10, 5, 5, metal);
      P.grid(DIGITS[n], { a: [metal, 3] }, 6, 8);
    },
  };
}

// difficulty and award icons by name
export const DIFF_ICON = { easy: 'sprout', normal: 'sword', hard: 'flame', nightmare: 'skull' };
export const AWARD_ICON = { masher: 'sword', combo: 'flame', angel: 'halo', sharp: 'target', gifts: 'gift', dizzy: 'stars', brick: 'brick' };
