import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELEASES, badgesFor, hasUnseenReleases, latestVersion, normalizeSeen } from '../shared/changelog.js';
import { GAMES } from '../shared/games.js';
import { allStrings } from '../shared/i18n.js';
import '../notes/release-notes.js';

const TYPES = ['new', 'updated', 'fixed'];
const targets = ['app', ...GAMES.map((game) => game.id)];

test('every release in sw.js has a changelog entry', () => {
  const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const version = Number(/const VERSION = 'playbox-v(\d+)';/.exec(source)[1]);
  assert.equal(latestVersion(), version, 'bump sw.js VERSION and add a matching release to shared/changelog.js');
});

test('releases are newest first, with valid dates, targets, types and texts', () => {
  const english = allStrings().en;
  RELEASES.forEach((release, i) => {
    if (i > 0) {
      assert.ok(release.version < RELEASES[i - 1].version, `release ${release.version} is out of order`);
    }
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(release.date)));
    assert.ok(release.changes.length > 0);
    release.changes.forEach((change) => {
      assert.ok(targets.includes(change.target), `unknown target ${change.target}`);
      assert.ok(TYPES.includes(change.type), `unknown type ${change.type}`);
      assert.ok(english[change.text], `missing text ${change.text}`);
    });
  });
});

const sample = [
  { version: 3, date: '2026-01-03', changes: [{ target: 'blocks', type: 'new', text: 'x' }, { target: 'dice', type: 'updated', text: 'x' }] },
  { version: 2, date: '2026-01-02', changes: [{ target: 'memory', type: 'updated', text: 'x' }, { target: 'dice', type: 'fixed', text: 'x' }] },
  { version: 1, date: '2026-01-01', changes: [{ target: 'dice', type: 'new', text: 'x' }, { target: 'app', type: 'new', text: 'x' }] },
];

test('first-time players see no badges and no unseen releases', () => {
  const seen = normalizeSeen(null, sample);
  assert.deepEqual(seen, { release: 3, games: {} });
  assert.deepEqual(badgesFor(seen, sample), {});
  assert.equal(hasUnseenReleases(seen, sample), false);
});

test('returning players see what changed since they last looked', () => {
  const seen = { release: 1, games: {} };
  assert.deepEqual(badgesFor(seen, sample), { blocks: 'new', dice: 'updated', memory: 'updated' });
  assert.equal(hasUnseenReleases(seen, sample), true);
});

test('opening a game clears its badge; fixes and app changes never badge a game', () => {
  const seen = { release: 1, games: { dice: 3, memory: 3 } };
  assert.deepEqual(badgesFor(seen, sample), { blocks: 'new' });
});

test('a game that is new beats "updated" in the same batch', () => {
  const releases = [
    { version: 2, date: '2026-01-02', changes: [{ target: 'blocks', type: 'updated', text: 'x' }] },
    { version: 1, date: '2026-01-01', changes: [{ target: 'blocks', type: 'new', text: 'x' }] },
  ];
  assert.deepEqual(badgesFor({ release: 0, games: {} }, releases), { blocks: 'new' });
});

test('bad saved data is cleaned up', () => {
  assert.deepEqual(normalizeSeen({ release: 2, games: { dice: 'x', memory: 1 } }, sample), { release: 2, games: { memory: 1 } });
  assert.deepEqual(normalizeSeen({ release: 'two' }, sample), { release: 3, games: {} });
});
