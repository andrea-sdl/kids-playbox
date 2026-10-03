# Playbox

Games and little tools for kids. A fast, installable web app (PWA) that works fully offline. Play it at <https://playbox.view.fast/>.

Plain HTML, CSS and JavaScript. No build step, and nothing to install to run it.

**No ads. No tracking. Open source.** See [Privacy](#privacy) and [License](#license).

## Games

| Game | What it does |
|---|---|
| **Dice Thrower** (`games/dice/`) | Pick a buddy and watch them throw 1 to 6 animated 3D dice. Five buddies, each with two looks and their own scene: Princess or Prince, Cowboy or Cowgirl, Explorer or Adventurer, Pixel Boy or Pixel Girl, Witch or Wizard. Every buddy has its own background music (can be turned off). Keeps your last rolls, your best total, and how often each number came up. |
| **Memory** (`games/memory/`) | Flip cards to find pairs on a 4×4 to 7×7 table (odd sizes get one free star card in the middle). Card sets: animals, planets and moons, country flags (each match shows a fun fact), or your own photos, which stay on the device. Four card backs, zoom, best moves and times. |
| **Blocks** (`games/blocks/`) | Build anything with 3D toy blocks: nine shapes, any color, plain plastic or textures (brick, stone, wood and more). Turn, paint, remove, undo. The sky follows the time of day, including sunset and a starry night, or your real clock. |
| **Molecules** (`games/molecules/`) | Join atoms into real molecules, from hydrogen gas to benzene. Each atom shows its free "hands" (bonds). Easy mode shows the molecule; hard mode only its name. Every molecule has a fun fact. |
| **Turbo Drive** (`games/drive/`) | A 3D driving game in a neon city, a jungle and a snowy wasteland that turns into desert. Collect points around the circuit (harder levels put them at the edges), hit boost pads for nitro, steer with buttons or by tilting the phone, customize your car, and build and share your own tracks. Each track has its own music. |

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
- `vendor/three/`: a trimmed, minified build of [Three.js](https://threejs.org) (MIT), used by Blocks and Turbo Drive.
- `sw.js` and `offline.json`: offline support (see below).

All saved data lives in the browser's `localStorage` under keys starting with `playbox:` (Memory's own photos are in IndexedDB).

## Languages

English, Italian, Spanish, Brazilian Portuguese and German. The app picks the device language the first time and remembers the choice from the language menu (home page and every page footer).

- Shared texts live in `shared/i18n.js`; each game has its own `strings.js` (Memory's also holds every card name and fun fact).
- In HTML, `data-i18n="key"` sets text, `data-i18n-attr="aria-label:key"` sets attributes. In code, use `t('key', { vars })`. Texts with `{ one, other }` pick the right plural.
- Tests fail if a language misses a text or a `{placeholder}`, or if a game, shape, card or buddy has no name.

## Updates, What's new and full screen

- **Updates:** a new version downloads in the background and takes over. If nobody has tapped since the page was shown, it reloads straight away; otherwise a banner offers a refresh, and the reload happens when the app goes to the background, so a game in progress is safe. The app checks for updates whenever it comes back on screen.
- **What's new:** the home page lists every release (`shared/changelog.js`) and puts a "New" or "Updated" badge on games changed since you last looked. Every release needs an entry: a test fails if `VERSION` in `sw.js` has no matching release. The notes themselves are in `notes/release-notes.js`, outside the first download: they load on Wi-Fi in the background, or when What's new is opened.
- **Full screen:** every game has a full-screen button. It hides the top bar and footer and moves the full-screen, sound and music buttons into the game (each page gives them a `.focus-slot`). Where the browser allows it, the page also goes truly full screen; iPhone Safari doesn't allow that, but focus mode still gives the game the whole screen.

## Offline and download size

Everything works offline, but the app doesn't download every game up front:

1. The first visit saves only the small shell (home page, shared code, icons). A test keeps it under 150 KB.
2. Opening a game saves all of that game's files.
3. On an unmetered connection the home page quietly saves the other games too. Elsewhere (for example on phone data, or in Safari, which doesn't say), people can press **Save all games for offline**. Each game card shows when it works offline.
4. Pages load from the cache instantly and refresh in the background, so an update shows up on the next visit. Games that were saved stay saved across updates.

The file lists live in `offline.json`, generated by `npm run offline`. A test fails if it's out of date.

## Add a new game

1. Create `games/<id>/` with its own `index.html` (set `<html data-root="../../">`), CSS and JS. Call `registerServiceWorker('<id>')` so it's saved for offline use when opened.
2. Add an entry to `shared/games.js`.
3. Run `npm run offline`, bump `VERSION` in `sw.js`, add a release to `shared/changelog.js`, and its notes (in all five languages) to `notes/release-notes.js`.

## Dev scripts

- `npm start`: local server that always sends fresh files.
- `npm test`: tests.
- `npm run offline`: rebuild `offline.json`.
- `npm run deploy`: publish the last commit to https://playbox.view.fast/ (Spacefast). Uncommitted changes are never published.
- `npm run vendor`: rebuild `vendor/three/three.min.js` from the `three` package.
- `scripts/cut-memory-sheets.py`: cut the Memory card sheets in `art-src/` into single cards.

## Art

Most dice buddies are hand-made SVGs, and the country flags are drawn in code. The Witch and Wizard, the scene backgrounds, the table and block textures, and the animal and space cards were generated with Codex image generation. The prompts are in `docs/art-prompts*.md`.

## Music

Each buddy's tune is written as a MIDI-style score in `games/dice/songs.js` and played with small Web Audio synths in `music.js`. There are no audio files, so it works offline. Music starts after the first tap (browsers block sound before that) and pauses when the page is hidden.

## Privacy

Playbox is made for kids, so it keeps nothing about them:

- **No tracking.** No analytics, no cookies, no fingerprinting, no third-party scripts. The app's own code never sends anything anywhere.
- **No ads.** None, and no plans for any.
- **Your data stays on your device.** Favorites, scores, best times, built tracks and Memory photos are kept in the browser (`localStorage` and IndexedDB). Clearing the site's data removes them.
- **Network use** is only for downloading the app and its games, so they work offline. Shared tracks travel as files or codes you pass along yourself.

The site is hosted on Spacefast. Like any web host, its servers keep standard request logs. Spacefast also adds a small script to every page that only does anything inside Spacefast's own review tool; for visitors it makes no requests and stores nothing.

## Contributing

Thanks for your interest! Pull requests aren't open yet. Issues with ideas and bug reports are welcome.

## License

Playbox is open source under the [GNU General Public License v2.0](LICENSE). The bundled Three.js build keeps its own [MIT license](vendor/three/LICENSE).

---

Brought to you by Andrea Grassi, [Givemethechills](https://givemethechills.com).
