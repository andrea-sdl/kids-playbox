// Pure dice logic: no DOM, so it can be tested with `node --test`.

export const MIN_DICE = 1;
export const MAX_DICE = 6;
export const HISTORY_LIMIT = 20;
export const MASCOTS = ['princess', 'cowboy', 'explorer', 'pixel'];

// Cube rotation (degrees) that turns each face toward the viewer.
// Faces are placed so opposite sides add up to 7, like a real die:
// 1 front / 6 back, 2 right / 5 left, 3 top / 4 bottom.
export const FACE_ROTATIONS = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

// Which cells of a 3x3 grid (numbered 1-9, left to right, top to bottom)
// hold a pip for each face.
export const PIP_CELLS = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

// Fair random integer in [0, max) using the crypto API, with rejection
// sampling so no value is more likely than another.
export function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

export function rollDice(count, random = randomInt) {
  const values = [];
  for (let i = 0; i < clampDiceCount(count); i += 1) {
    values.push(random(6) + 1);
  }
  return values;
}

export function clampDiceCount(count) {
  const whole = Math.round(Number(count));
  if (!Number.isFinite(whole)) {
    return MIN_DICE;
  }
  return Math.min(MAX_DICE, Math.max(MIN_DICE, whole));
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function emptyState() {
  return {
    mascot: MASCOTS[0],
    count: 2,
    sound: true,
    music: true,
    history: [],
    stats: { rolls: 0, best: 0, faces: [0, 0, 0, 0, 0, 0] },
  };
}

function isDieValue(value) {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

function normalizeRoll(roll) {
  if (!roll || typeof roll !== 'object' || !Array.isArray(roll.values)) {
    return null;
  }
  const values = roll.values.filter(isDieValue).slice(0, MAX_DICE);
  if (values.length === 0) {
    return null;
  }
  let mascot = MASCOTS[0];
  if (MASCOTS.includes(roll.mascot)) {
    mascot = roll.mascot;
  }
  let at = 0;
  if (typeof roll.at === 'number') {
    at = roll.at;
  }
  return { values, total: sum(values), mascot, at };
}

// Turn whatever is in storage into a valid state. Bad or old data falls back
// to defaults instead of breaking the game.
export function normalizeState(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== 'object') {
    return state;
  }
  if (MASCOTS.includes(raw.mascot)) {
    state.mascot = raw.mascot;
  }
  if (raw.count !== undefined) {
    state.count = clampDiceCount(raw.count);
  }
  if (typeof raw.sound === 'boolean') {
    state.sound = raw.sound;
  }
  if (typeof raw.music === 'boolean') {
    state.music = raw.music;
  }
  if (Array.isArray(raw.history)) {
    state.history = raw.history.map(normalizeRoll).filter(Boolean).slice(0, HISTORY_LIMIT);
  }
  const stats = raw.stats;
  if (stats && typeof stats === 'object') {
    if (Number.isInteger(stats.rolls) && stats.rolls > 0) {
      state.stats.rolls = stats.rolls;
    }
    if (Number.isInteger(stats.best) && stats.best > 0) {
      state.stats.best = stats.best;
    }
    if (Array.isArray(stats.faces) && stats.faces.length === 6) {
      state.stats.faces = stats.faces.map((n) => {
        if (Number.isInteger(n) && n > 0) {
          return n;
        }
        return 0;
      });
    }
  }
  return state;
}

// Returns a new state with the roll added to history and stats.
export function addRoll(state, values, mascot, at = Date.now()) {
  const roll = { values: [...values], total: sum(values), mascot, at };
  const faces = [...state.stats.faces];
  values.forEach((value) => {
    faces[value - 1] += 1;
  });
  return {
    ...state,
    history: [roll, ...state.history].slice(0, HISTORY_LIMIT),
    stats: {
      rolls: state.stats.rolls + 1,
      best: Math.max(state.stats.best, roll.total),
      faces,
    },
  };
}

export function clearResults(state) {
  const fresh = emptyState();
  return { ...state, history: fresh.history, stats: fresh.stats };
}
