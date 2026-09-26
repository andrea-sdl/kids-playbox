import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZES,
  buildDeck,
  freeCellIndex,
  isBetter,
  formatTime,
  normalizeRecords,
  normalizeSettings,
  pairsFor,
  starsFor,
} from '../games/memory/logic.js';
import { THEME_INFO } from '../games/memory/themes.js';
import { FLAGS } from '../games/memory/flags.js';

const keys = Array.from({ length: 30 }, (_, i) => `item-${i}`);

test('each grid size has the right number of pairs', () => {
  assert.deepEqual(SIZES.map(pairsFor), [8, 12, 18, 24]);
});

test('every picture appears exactly twice', () => {
  SIZES.forEach((size) => {
    const deck = buildDeck(keys, size);
    assert.equal(deck.length, size * size);
    const counts = new Map();
    deck.filter((card) => !card.free).forEach((card) => {
      counts.set(card.key, (counts.get(card.key) || 0) + 1);
    });
    assert.equal(counts.size, pairsFor(size));
    counts.forEach((count, key) => assert.equal(count, 2, `${key} appears ${count} times`));
  });
});

test('odd grids put one free card in the exact middle', () => {
  assert.equal(freeCellIndex(4), -1);
  assert.equal(freeCellIndex(5), 12);
  assert.equal(freeCellIndex(7), 24);
  [5, 7].forEach((size) => {
    const deck = buildDeck(keys, size);
    assert.deepEqual(deck[freeCellIndex(size)], { free: true });
    assert.equal(deck.filter((card) => card.free).length, 1);
  });
  assert.equal(buildDeck(keys, 6).filter((card) => card.free).length, 0);
});

test('decks are shuffled differently each game', () => {
  const first = buildDeck(keys, 6).map((card) => card.key).join();
  const second = buildDeck(keys, 6).map((card) => card.key).join();
  assert.notEqual(first, second);
});

test('asking for a grid bigger than the pictures available fails clearly', () => {
  assert.throws(() => buildDeck(keys.slice(0, 10), 5), /Need 12 different pictures/);
});

test('stars reward fewer moves', () => {
  assert.equal(starsFor(8, 8), 3);
  assert.equal(starsFor(12, 8), 3);
  assert.equal(starsFor(15, 8), 2);
  assert.equal(starsFor(30, 8), 1);
});

test('records keep the fewest moves, then the fastest time', () => {
  assert.equal(isBetter({ moves: 10, seconds: 50 }, null), true);
  assert.equal(isBetter({ moves: 9, seconds: 90 }, { moves: 10, seconds: 50 }), true);
  assert.equal(isBetter({ moves: 10, seconds: 40 }, { moves: 10, seconds: 50 }), true);
  assert.equal(isBetter({ moves: 11, seconds: 10 }, { moves: 10, seconds: 50 }), false);
});

test('time is shown as minutes and seconds', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65.7), '1:05');
});

test('bad saved settings and records fall back safely', () => {
  assert.deepEqual(normalizeSettings({ theme: 'dinosaurs', size: 9, back: 'gold', sound: 'yes' }), normalizeSettings(null));
  assert.deepEqual(normalizeSettings({ theme: 'space', size: 7, back: 'wood', sound: false }), { theme: 'space', size: 7, back: 'wood', sound: false });
  assert.deepEqual(
    normalizeRecords({ 'animals-4': { moves: 12, seconds: 30 }, 'animals-9': { moves: 1, seconds: 1 }, 'space-5': { moves: -1, seconds: 3 } }),
    { 'animals-4': { moves: 12, seconds: 30 } },
  );
});


test('every built-in theme has enough pictures for 7x7', () => {
  ['animals', 'space', 'countries'].forEach((theme) => {
    const items = THEME_INFO[theme].items;
    assert.ok(items.length >= pairsFor(7), `${theme} has ${items.length} items, needs ${pairsFor(7)}`);
    assert.equal(new Set(items.map((item) => item.key)).size, items.length, `${theme} has duplicate keys`);
  });
});

test('every country has a flag and a fun fact', () => {
  THEME_INFO.countries.items.forEach((country) => {
    assert.ok(country.fact, `${country.key} needs a fact`);
    assert.match(country.flag(), /^<svg class="flag"/, `${country.key} needs a flag`);
  });
  assert.equal(Object.keys(FLAGS).length, THEME_INFO.countries.items.length);
});

test('every space body has a fun fact', () => {
  THEME_INFO.space.items.forEach((body) => assert.ok(body.fact, `${body.key} needs a fact`));
});
