# Playbox

Games and little tools for kids. A fast, installable web app (PWA) that works fully offline.

Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Games

| Game | What it does |
|---|---|
| **Dice Thrower** (`games/dice/`) | Pick a buddy and watch them throw 1 to 6 animated 3D dice. Five buddies, each with two looks and their own scene: Princess or Prince, Cowboy or Cowgirl, Explorer or Adventurer, Pixel Boy or Pixel Girl, Witch or Wizard. Every buddy has its own background music (can be turned off). Keeps your last rolls, your best total, and how often each number came up. |

Kids can star games to keep favorites at the top of the home page.

## Run it locally

```bash
npm start
```

Then open <http://localhost:8080>. Any static file server works. The service worker needs `http://localhost` or HTTPS, so opening `index.html` as a file won't enable offline mode.

## Test

```bash
npm test
```

Uses Node's built-in test runner (Node 20+). The tests cover the dice logic, saved data, favorites, and a check that every shipped file is in the offline cache.

## How it's built

- `index.html`, `home.js`, `home.css`: the home page with the game list and favorites.
- `shared/`: code every page uses. `store.js` wraps `localStorage` safely, `favorites.js` and `progress.js` hold per-game data, `games.js` lists the games.
- `games/<id>/`: each game is its own folder and page.
- `sw.js`: the service worker. It caches every file on first visit, then serves from the cache and refreshes it in the background.

All saved data lives in the browser's `localStorage` under keys starting with `playbox:`.

## Add a new game

1. Create `games/<id>/` with its own `index.html` (set `<html data-root="../../">`), CSS and JS.
2. Add an entry to `shared/games.js`.
3. Add every new file to the `FILES` list in `sw.js` and bump `VERSION`. `npm test` fails if you forget a file.

## Art

Most buddies are hand-made SVGs. The Witch and Wizard are painted 3D-style images. Those, the scene backgrounds and the table textures in `games/dice/art/` were generated with Codex image generation. The prompts are in [`docs/art-prompts.md`](docs/art-prompts.md) and [`docs/art-prompts-2.md`](docs/art-prompts-2.md).

## Music

Each buddy's tune is written as a MIDI-style score in `games/dice/songs.js` and played with small Web Audio synths in `music.js`. There are no audio files, so it works offline. Music starts after the first tap (browsers block sound before that) and pauses when the page is hidden.

---

Brought to you by Andrea Grassi, [Givemethechills](https://givemethechills.com).
