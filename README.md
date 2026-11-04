# Finger Frolic

A party game for a TV and a room full of phones. The TV shows the castle wall and the monsters marching down
on it; every phone is a swipe pad. Each player holds one lane: swipe the arrows floating over the monster nearest
your wall, in order, before it gets there. Up to 8 players, co-op, waves until the wall falls.

## Play

1. Open the game on the laptop plugged into the TV (`F` for fullscreen, click once for sound).
2. Everyone scans the QR code (or opens the link and types the 5-letter code) and enters a name.
3. Everyone **swipes up** to say they're ready. The game starts when all the phones are ready, or press **Start now**.

| | |
|---|---|
| 🪄 Swipe to cast | You're a wizard on the wall. Each monster in your lane carries arrows: swipe them in order, nearest monster first, and every swipe fires a spell. Every good hit knocks it back up the lane. |
| ✏️ Draw the runes | Purple chips are shapes: ○ circle, △ triangle, ✓ check, □ square, Z zigzag. When one is next, your phone turns into a drawing pad: draw it in one stroke to cast 🔥 fireball, ⚡ lightning, ✨ smite, 🧊 ice cage or 🌪️ whirlwind. Rune Golems (from wave 3) always end in one; later, brutes and bosses do too. |
| 💫 Wrong way = dizzy | A wrong swipe stuns you for half a second and resets your combo. 10, 20, 30… combos get flames and a bigger multiplier. |
| 🤝 Help a neighbour | When your lane is clear, your swipes go to the closest monster in the lanes next to you. |
| 🎁 Gifts | Golden boxes from wave 2. Pop one and the team gets a power-up: ❄️ freeze (everything crawls for 5 s), ❤️ a heart back, or ⚡ lightning (zaps the front monster in every lane). A gift that gets away costs nothing. |
| 🔥 Team frenzy | Everyone's good swipes fill a shared meter (wrong swipes and breaches drain it). When it's full: 8 s of double points, double knockback and twice-as-fast supers. |
| ⚡ Super | Good swipes fill your own meter. When it's full, **tap** to wipe out your lane. |
| ❤️ Hearts | The team shares 5 (up to 8). Each monster that reaches the wall costs one; the game ends at zero. A wave with no breach is a ✨ perfect wave: +100 × wave each. |
| 👑 Boss | Every 5th wave ends with a boss as wide as the field. Each player has their own row of its arrows, and it only falls when everyone finishes theirs (+1 heart). |

Monsters: 🟢 grunt (1 arrow) · 🟣 brute (2–3, slow) from wave 2 · 🗿 rune golem (arrows + a shape) from wave 3 ·
🟠 runner (fast) from wave 4 · 🐌 spinner (its arrow turns until you hit it) from wave 5 · 🔴 trickster (red arrows
mean swipe the *opposite* way) from wave 6. The TV announces each one the wave it first appears.

**Difficulty:** 🌱 Easy · ⚔️ Normal · 🔥 Hard · 💀 Nightmare, picked on the TV lobby (or swipe ← → on any phone
there). Harder means fewer hearts, faster and bigger waves, less knockback, longer dizziness, a frenzy that is
harder to fill, and new monsters and shapes arriving sooner. `?diff=hard` on the TV page preselects one.

At the end, everyone gets an award (Monster Masher, Combo Machine, Guardian Angel, Sharpshooter, Gift Grabber,
Dizzy Dancer…) on the TV and on their phone.

Drop-in, drop-out: new phones can scan in at any time and join at the next wave. A phone that locks or drops
gets its seat back when it reconnects; while it's gone, the monsters in its lane wait for it.

TV keys: `F` fullscreen · `M` mute · `Space` start · `Esc` back to the lobby.

## How it fits together

The networking is copied from `~/me/co-op` (its relay is in turn from Age Up):

- `index.html` is the TV (host). It's the only place the rules run.
- `pad.html` is the phone. It sends swipes (`{s:'u'|'d'|'l'|'r'|'tap'}`) and shows what the TV broadcasts.
- `shared/net.js` connects them over the relay in `server/` (a Cloudflare Durable Object per room code), or over
  BroadcastChannel between tabs with `?net=local`. Phones keep their seat across screen locks and reloads.
- The TV sends **one** broadcast with every player's numbers about 6 times a second, so relay traffic does not
  grow with the number of players. Phones buzz on hits, kills, misses and breaches (Android; iOS has no vibration API).
- `game.js` holds the rules (pure, tested), `shared/shapes.js` the shape recogniser (runs on the phone; tested
  against sloppy synthetic drawings), `shared/audio.js` the synth sounds (from Jumping Jack).

### Pixel art and performance

The art follows the sprite lab in `~/me/aoe`: sprites are painted in code (`sprites.js`) on small grids with
`shared/pix.js`, which shades every form with hue-shifted three-tone ramps lit from the upper-left and adds a
selective outline. Each frame (and its hit-flash and frozen variants) is baked once into a canvas at load:
~150 frames in ~30 ms.

`draw.js` renders the world into a buffer about 270 px tall and scales it up by a whole number with smoothing
off, so the cost does not grow with the TV's resolution. The scenery is baked once per layout. Text is drawn on
top at full resolution. On a 3840×2160 canvas with 8 players, 80 monsters, frenzy, freeze and constant spells,
a frame is ~1 ms of work on average (p95 under 5 ms, headless Chromium without a GPU). `?debug` exposes
`frolic.perf()` on the TV page.

**Sprite sheet:** `/tools/sprites.html` (with `npm start`, or on the live site) shows every sprite and frame, large,
with its variants and at 1×. Edit `sprites.js` and reload.

Changes from the co-op relay: up to 12 phones per room (8 players plus reconnecting stragglers), a higher message
rate for real-time play, and its own Worker name, `frolic-relay`.

## Development

No build step: edit and reload.

```sh
npm start        # serves on the home network + runs the relay locally (needs `npm install` in server/ once)
npm test         # rules tests + relay tests
```

**Dev mode:** `dev.html` (also linked from the bottom of the TV lobby, and live at
https://www.alecsharpie.me/finger-frolic/dev.html) shows the TV and 1–8 phones side by side in one tab, talking
over BroadcastChannel, so it needs no relay. Pick the phone count at the top. Click a phone and use the arrow keys
(space = tap), or drag with the mouse. Tick **bot** on any phone (or **all bots**) to have it play itself; bot skill
sets how often bots swipe the wrong way.

## Deploy

The site is static, so it can go on GitHub Pages like the other games. The relay is deployed separately:

```sh
CLOUDFLARE_API_TOKEN=… server/deploy.sh
```

It runs the tests, deploys `frolic-relay`, writes its URL into `shared/net.js`, and checks `/health`. Allowed
origins are in `server/wrangler.toml`. Until it is deployed, play over home Wi-Fi with `npm start`.
