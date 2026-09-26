import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// The app must work fully offline, so every file it ships has to be in the
// service worker's precache list, and every listed file has to exist.

const root = fileURLToPath(new URL('..', import.meta.url));
const IGNORED = new Set(['.git', 'node_modules', 'tests', 'art-src', 'docs', 'scripts', '.github', '.claude']);
const DEV_FILES = new Set(['sw.js', 'package.json', 'README.md', '.gitignore', 'LICENSE', '.nojekyll']);

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
    if (DEV_FILES.has(rel)) {
      return [];
    }
    return [`./${rel}`];
  });
}

function precachedFiles() {
  const source = readFileSync(join(root, 'sw.js'), 'utf8');
  const list = source.match(/const FILES = \[([\s\S]*?)\];/);
  assert.ok(list, 'sw.js should define a FILES list');
  return [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

test('every shipped file is precached for offline use', () => {
  const cached = new Set(precachedFiles());
  const missing = shippedFiles(root).filter((file) => !cached.has(file));
  assert.deepEqual(missing, []);
});

test('every precached file exists', () => {
  const missing = precachedFiles()
    .filter((file) => !file.endsWith('/'))
    .filter((file) => !existsSync(join(root, file)));
  assert.deepEqual(missing, []);
});
