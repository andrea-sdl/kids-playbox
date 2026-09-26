import { readJSON, writeJSON } from './store.js';

const KEY = 'favorites';

export function getFavorites(storage) {
  const list = readJSON(KEY, [], storage);
  if (!Array.isArray(list)) {
    return [];
  }
  return list.filter((id) => typeof id === 'string');
}

export function isFavorite(id, storage) {
  return getFavorites(storage).includes(id);
}

// Returns true when the game is a favorite after the toggle.
export function toggleFavorite(id, storage) {
  const favorites = getFavorites(storage);
  const wasFavorite = favorites.includes(id);
  let next = [...favorites, id];
  if (wasFavorite) {
    next = favorites.filter((favoriteId) => favoriteId !== id);
  }
  writeJSON(KEY, next, storage);
  return !wasFavorite;
}
