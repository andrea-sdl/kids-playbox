import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMES } from '../shared/games.js';
import { manifestText } from '../scripts/offline-manifest.mjs';

// The app must work fully offline, so every file it ships has to be listed
// in offline.json: either in the small "shell" saved on first visit, or in
// the list of the game that uses it.

const root = fileURLToPath(new URL('..', import.meta.url));
const IGNORED = new Set(['.git', 'node_modules', 'tests', 'art-src', 'docs', 'scripts', '.github', '.claude']);
const NOT_SHIPPED = new Set(['sw.js', 'offline.json', 'package.json', 'package-lock.json', 'README.md', '.gitignore', 'LICENSE', '.nojekyll']);
const SHELL_BUDGET_BYTES = 150 * 1024;

const manifest = JSON.parse(readFileSync(join(root, 'offline.json'), 'utf8'));
const gameLists = Object.values(manifest.games);
const listed = new Set([...manifest.shell, ...gameLists.flat(), ...manifest.notes]);

test('offline.json is up to date (run `npm run offline` to fix)', () => {
  assert.equal(readFileSync(join(root, 'offline.json'), 'utf8'), manifestText());
});

function shippedFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (IGNORED.has(name) || name.startsWith('.')) {
      return [];
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return shippedFiles(path);
    }
    const rel = relative(root, path);
    if (NOT_SHIPPED.has(rel)) {
      return [];
    }
    return [`./${rel}`];
  });
}

function realFiles(list) {
  return list.filter((file) => !file.endsWith('/'));
}

test('every shipped file is listed for offline use', () => {
  const missing = shippedFiles(root).filter((file) => !listed.has(file));
  assert.deepEqual(missing, []);
});

test('every listed file exists', () => {
  const missing = realFiles([...listed]).filter((file) => !existsSync(join(root, file)));
  assert.deepEqual(missing, []);
});

test('every game on the home page has its own offline list', () => {
  GAMES.forEach((game) => {
    const files = manifest.games[game.id];
    assert.ok(files, `${game.id} has no offline list`);
    assert.ok(files.includes(`./${game.path}`), `${game.id} list should include its page ./${game.path}`);
    assert.ok(files.includes(`./${game.path}index.html`), `${game.id} list should include its index.html`);
  });
});

// Keeps the first visit fast: games are saved separately, later.
test('the shell saved on first visit stays small', () => {
  const bytes = realFiles(manifest.shell)
    .map((file) => statSync(join(root, file)).size)
    .reduce((total, size) => total + size, 0);
  assert.ok(bytes < SHELL_BUDGET_BYTES, `shell is ${Math.round(bytes / 1024)} KB, budget is ${SHELL_BUDGET_BYTES / 1024} KB`);
});
