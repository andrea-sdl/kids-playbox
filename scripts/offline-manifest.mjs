// Builds offline.json: which files the service worker saves for offline use.
//   shell  – home page, shared code and icons, saved on the first visit
//   games  – everything inside games/<id>/, plus any extra files a game
//            needs from elsewhere (like a vendored library), saved when the
//            game is opened
//   notes  – the release notes for What's new, saved when first read
//
// Run `npm run offline` after adding, renaming or removing files.

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Files outside games/<id>/ that a game needs.
const GAME_EXTRAS = {
  blocks: ['vendor/three'],
  drive: ['vendor/three'],
};

function listFiles(path) {
  const full = join(root, path);
  if (statSync(full).isFile()) {
    return [`./${path}`];
  }
  return readdirSync(full)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .flatMap((name) => listFiles(relative(root, join(full, name))));
}

export function buildManifest() {
  const shell = [
    './',
    ...['index.html', 'home.css', 'home.js', 'manifest.webmanifest'].flatMap(listFiles),
    ...listFiles('icons'),
    ...listFiles('shared'),
  ];
  const games = {};
  readdirSync(join(root, 'games'))
    .filter((id) => statSync(join(root, 'games', id)).isDirectory())
    .sort()
    .forEach((id) => {
      const extras = (GAME_EXTRAS[id] || []).flatMap(listFiles);
      games[id] = [`./games/${id}/`, ...listFiles(`games/${id}`), ...extras];
    });
  return { shell, games, notes: listFiles('notes') };
}

export function manifestText() {
  return `${JSON.stringify(buildManifest(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(root, 'offline.json'), manifestText());
  console.log('offline.json updated');
}
