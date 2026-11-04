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
| 👆 Swipe the arrows | Each monster in your lane carries arrows. Swipe them in order, nearest monster first. |
| 💫 Wrong way = dizzy | A wrong swipe stuns you for half a second and resets your combo. |
| ⚡ Super | Good swipes fill your meter. When it's full, **tap** to wipe out your lane. |
| ❤️ Hearts | The team shares 5. Each monster that reaches the wall costs one; the game ends at zero. |
| 👑 Boss | Every 5th wave ends with a boss as wide as the field. Each player has their own row of its arrows, and it only falls when everyone finishes theirs (+1 heart). |

Monsters: 🟢 grunt (1 arrow) · 🟣 brute (2–3, slow) from wave 2 · 🟠 runner (fast) from wave 3 ·
🔵 spinner (its arrow turns until you hit it) from wave 4 · 🔴 trickster (red arrows mean swipe the *opposite*
way) from wave 6.

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
- `game.js` holds the rules (pure, tested), `draw.js` the canvas art, `shared/audio.js` the synth sounds (from Jumping Jack).

Changes from the co-op relay: up to 12 phones per room (8 players plus reconnecting stragglers), a higher message
rate for real-time play, and its own Worker name, `frolic-relay`.

## Development

No build step: edit and reload.

```sh
npm start        # serves on the home network + runs the relay locally (needs `npm install` in server/ once)
npm test         # rules tests + relay tests
```

`dev.html` shows the TV and three phones side by side in one tab, no relay needed (`?players=1..4`). Click a phone
frame and use the arrow keys (space = tap).

## Deploy

The site is static, so it can go on GitHub Pages like the other games. The relay is deployed separately:

```sh
CLOUDFLARE_API_TOKEN=… server/deploy.sh
```

It runs the tests, deploys `frolic-relay`, writes its URL into `shared/net.js`, and checks `/health`. Allowed
origins are in `server/wrangler.toml`. Until it is deployed, play over home Wi-Fi with `npm start`.
