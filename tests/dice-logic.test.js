import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FACE_ROTATIONS,
  HISTORY_LIMIT,
  PIP_CELLS,
  addRoll,
  clampDiceCount,
  clearResults,
  emptyState,
  normalizeState,
  randomInt,
  rollDice,
} from '../games/dice/logic.js';

test('each face shows the right number of pips', () => {
  for (let value = 1; value <= 6; value += 1) {
    assert.equal(PIP_CELLS[value].length, value);
  }
});

test('every face has a rotation that brings it to the front', () => {
  const rotations = Object.values(FACE_ROTATIONS).map((r) => `${r.x},${r.y}`);
  assert.equal(new Set(rotations).size, 6);
});

test('rolls always give whole numbers from 1 to 6', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) {
    const [value] = rollDice(1);
    assert.ok(Number.isInteger(value) && value >= 1 && value <= 6, `bad value ${value}`);
    seen.add(value);
  }
  assert.equal(seen.size, 6, 'all six faces should show up');
});

test('randomInt stays in range', () => {
  for (let i = 0; i < 500; i += 1) {
    const n = randomInt(4);
    assert.ok(n >= 0 && n < 4);
  }
});

test('dice count is kept between 1 and 6', () => {
  assert.equal(clampDiceCount(0), 1);
  assert.equal(clampDiceCount(9), 6);
  assert.equal(clampDiceCount('3'), 3);
  assert.equal(clampDiceCount('nope'), 1);
  assert.equal(rollDice(10, () => 0).length, 6);
});

test('a roll updates history, best total and face counts', () => {
  let state = emptyState();
  state = addRoll(state, [3, 5], 'cowboy', 1);
  state = addRoll(state, [6, 6], 'pixel', 2);
  state = addRoll(state, [1, 2], 'princess', 3);

  assert.equal(state.stats.rolls, 3);
  assert.equal(state.stats.best, 12);
  assert.deepEqual(state.stats.faces, [1, 1, 1, 0, 1, 2]);
  assert.equal(state.history[0].total, 3, 'newest roll comes first');
  assert.equal(state.history[0].mascot, 'princess');
});

test('history keeps only the latest rolls', () => {
  let state = emptyState();
  for (let i = 0; i < HISTORY_LIMIT + 5; i += 1) {
    state = addRoll(state, [1], 'princess', i);
  }
  assert.equal(state.history.length, HISTORY_LIMIT);
  assert.equal(state.stats.rolls, HISTORY_LIMIT + 5);
});

test('saved state survives a round trip through JSON', () => {
  let state = emptyState();
  state.mascot = 'explorer';
  state.count = 4;
  state.music = false;
  state = addRoll(state, [2, 4, 6, 1], 'explorer', 5);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))), state);
});

test('bad saved data falls back to safe defaults', () => {
  assert.deepEqual(normalizeState(null), emptyState());
  assert.deepEqual(normalizeState('junk'), emptyState());

  const state = normalizeState({
    mascot: 'dragon',
    count: 99,
    sound: 'loud',
    music: 'yes please',
    history: [{ values: [7, 3, 'x'] }, null, { values: [] }],
    stats: { rolls: -1, best: 'big', faces: [1, 2] },
  });
  assert.equal(state.mascot, 'princess');
  assert.equal(state.count, 6);
  assert.equal(state.sound, true);
  assert.equal(state.music, true);
  assert.deepEqual(state.history.map((roll) => roll.values), [[3]]);
  assert.deepEqual(state.stats, emptyState().stats);
});

test('clearing results keeps mascot and settings', () => {
  let state = emptyState();
  state.mascot = 'pixel';
  state.count = 3;
  state.sound = false;
  state.music = false;
  state = addRoll(state, [4, 4, 4], 'pixel', 1);
  const cleared = clearResults(state);
  assert.equal(cleared.mascot, 'pixel');
  assert.equal(cleared.count, 3);
  assert.equal(cleared.sound, false);
  assert.equal(cleared.music, false);
  assert.equal(cleared.history.length, 0);
  assert.equal(cleared.stats.rolls, 0);
});
