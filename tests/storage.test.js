import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJSON, writeJSON } from '../shared/store.js';
import { getFavorites, isFavorite, toggleFavorite } from '../shared/favorites.js';
import { getProgress, recordPlay, clearProgress } from '../shared/progress.js';
import { memoryStorage, brokenStorage } from './memory-storage.js';

test('store falls back safely when storage is broken or data is bad', () => {
  assert.equal(readJSON('x', 'fallback', brokenStorage()), 'fallback');
  assert.equal(writeJSON('x', 1, brokenStorage()), false);
  assert.equal(readJSON('x', 'fallback', null), 'fallback');

  const storage = memoryStorage();
  storage.setItem('playbox:x', '{not json');
  assert.equal(readJSON('x', 'fallback', storage), 'fallback');
});

test('favorites toggle on and off and survive a reload', () => {
  const storage = memoryStorage();
  assert.deepEqual(getFavorites(storage), []);

  assert.equal(toggleFavorite('dice', storage), true);
  assert.equal(isFavorite('dice', storage), true);
  assert.equal(storage.raw.get('playbox:favorites'), '["dice"]');

  assert.equal(toggleFavorite('dice', storage), false);
  assert.equal(isFavorite('dice', storage), false);
});

test('favorites ignore corrupted data', () => {
  const storage = memoryStorage();
  storage.setItem('playbox:favorites', '{"dice":true}');
  assert.deepEqual(getFavorites(storage), []);
  storage.setItem('playbox:favorites', '["dice", 4, null]');
  assert.deepEqual(getFavorites(storage), ['dice']);
});

test('progress counts plays and keeps the last summary', () => {
  const storage = memoryStorage();
  assert.deepEqual(getProgress('dice', storage), { plays: 0, lastPlayed: null, last: '' });

  recordPlay('dice', { key: 'progress.dice', vars: { total: 7 } }, storage, 1000);
  recordPlay('dice', { key: 'progress.dice', vars: { total: 9 } }, storage, 2000);
  assert.deepEqual(getProgress('dice', storage), { plays: 2, lastPlayed: 2000, last: { key: 'progress.dice', vars: { total: 9 } } });

  clearProgress('dice', storage);
  assert.equal(getProgress('dice', storage).plays, 0);
});

test('English summaries saved by older versions become translatable', () => {
  const storage = memoryStorage();
  const load = (last) => {
    storage.setItem('playbox:progress:dice', JSON.stringify({ plays: 3, lastPlayed: 5, last }));
    return getProgress('dice', storage).last;
  };
  assert.deepEqual(load('Last roll: 7'), { key: 'progress.dice', vars: { total: 7 } });
  assert.deepEqual(load('Won 6×6 in 25 moves'), { key: 'progress.memory', vars: { size: 6, moves: 25 } });
  assert.deepEqual(load('Building'), { key: 'progress.blocks', vars: {} });
  assert.equal(load('Something else'), 'Something else', 'unknown text is shown as it was');
});
