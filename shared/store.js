// Small, safe wrapper around localStorage.
// Every read and write is guarded: private mode, blocked storage or a full
// quota must never break a game.

const PREFIX = 'playbox:';

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readJSON(key, fallback, storage = defaultStorage()) {
  if (!storage) {
    return fallback;
  }
  try {
    const raw = storage.getItem(PREFIX + key);
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value, storage = defaultStorage()) {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key, storage = defaultStorage()) {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(PREFIX + key);
  } catch {
    // Nothing to do: storage is unavailable.
  }
}
