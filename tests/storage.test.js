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

  recordPlay('dice', 'Last roll: 7', storage, 1000);
  recordPlay('dice', 'Last roll: 9', storage, 2000);
  assert.deepEqual(getProgress('dice', storage), { plays: 2, lastPlayed: 2000, last: 'Last roll: 9' });

  clearProgress('dice', storage);
  assert.equal(getProgress('dice', storage).plays, 0);
});
