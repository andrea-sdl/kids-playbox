import { readJSON, writeJSON } from './store.js';

// A tiny, game-agnostic record the home page can show on each card.
// Games keep their own detailed results under their own key.

function key(gameId) {
  return `progress:${gameId}`;
}

export function getProgress(gameId, storage) {
  const raw = readJSON(key(gameId), null, storage);
  if (!raw || typeof raw !== 'object') {
    return { plays: 0, lastPlayed: null, last: '' };
  }
  const progress = { plays: 0, lastPlayed: null, last: '' };
  if (Number.isInteger(raw.plays) && raw.plays > 0) {
    progress.plays = raw.plays;
  }
  if (typeof raw.lastPlayed === 'number') {
    progress.lastPlayed = raw.lastPlayed;
  }
  if (typeof raw.last === 'string') {
    progress.last = raw.last;
  }
  return progress;
}

export function recordPlay(gameId, summary, storage, now = Date.now()) {
  const current = getProgress(gameId, storage);
  const next = { plays: current.plays + 1, lastPlayed: now, last: summary };
  writeJSON(key(gameId), next, storage);
  return next;
}

export function clearProgress(gameId, storage) {
  writeJSON(key(gameId), { plays: 0, lastPlayed: null, last: '' }, storage);
}
