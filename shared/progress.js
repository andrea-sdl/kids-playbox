import { readJSON, writeJSON } from './store.js';

// A tiny, game-agnostic record the home page can show on each card.
// Games keep their own detailed results under their own key.
// `last` is a translatable summary { key, vars }. Older saves stored plain
// English text, which is still shown as is.

function key(gameId) {
  return `progress:${gameId}`;
}

// Summaries saved as English text before translations existed.
function fromOldText(text) {
  let match = /^Last roll: (\d+)$/.exec(text);
  if (match) {
    return { key: 'progress.dice', vars: { total: Number(match[1]) } };
  }
  match = /^Won (\d+)×\d+ in (\d+) moves$/.exec(text);
  if (match) {
    return { key: 'progress.memory', vars: { size: Number(match[1]), moves: Number(match[2]) } };
  }
  if (text === 'Building') {
    return { key: 'progress.blocks', vars: {} };
  }
  return text;
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
    progress.last = fromOldText(raw.last);
  }
  if (raw.last && typeof raw.last === 'object' && typeof raw.last.key === 'string') {
    let vars = {};
    if (raw.last.vars && typeof raw.last.vars === 'object') {
      vars = raw.last.vars;
    }
    progress.last = { key: raw.last.key, vars };
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
