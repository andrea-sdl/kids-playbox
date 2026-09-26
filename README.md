# Playbox

Games and little tools for kids. A fast, installable web app (PWA) that works fully offline.

Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Games

| Game | What it does |
|---|---|
| **Dice Thrower** (`games/dice/`) | Pick a buddy (Princess, Cowboy, Explorer or Pixel Hero) and watch them throw 1 to 6 animated 3D dice. Keeps your last rolls, your best total, and how often each number came up. |

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

The mascots are hand-made SVGs. The scene backgrounds and table textures in `games/dice/art/` were generated with Codex image generation. The prompts are in [`docs/art-prompts.md`](docs/art-prompts.md).

---

Brought to you by Andrea Grassi, [Givemethechills](https://givemethechills.com).
