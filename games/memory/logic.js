// Pure memory-game logic: no DOM, so it can be tested with `node --test`.

export const SIZES = [4, 5, 6, 7];
export const THEMES = ['animals', 'space', 'countries', 'photos'];
export const CARD_BACKS = ['classic', 'wood', 'galaxy', 'candy'];

// Odd grids (5x5, 7x7) have one free card in the middle, so every other
// card has a partner.
export function pairsFor(size) {
  return Math.floor((size * size) / 2);
}

export function hasFreeCell(size) {
  return size % 2 === 1;
}

export function freeCellIndex(size) {
  if (!hasFreeCell(size)) {
    return -1;
  }
  return Math.floor((size * size) / 2);
}

// Fair random integer in [0, max).
export function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

export function shuffle(list, random = randomInt) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Picks enough items for the grid, doubles them and shuffles.
// Returns one entry per cell: { key } for a card, or { free: true }.
export function buildDeck(itemKeys, size, random = randomInt) {
  const pairs = pairsFor(size);
  if (itemKeys.length < pairs) {
    throw new Error(`Need ${pairs} different pictures for ${size}x${size}, got ${itemKeys.length}`);
  }
  const chosen = shuffle(itemKeys, random).slice(0, pairs);
  const cards = shuffle([...chosen, ...chosen], random).map((key) => ({ key }));
  const free = freeCellIndex(size);
  if (free >= 0) {
    cards.splice(free, 0, { free: true });
  }
  return cards;
}

// 3 stars for a sharp memory, 1 star just for finishing.
export function starsFor(moves, pairs) {
  if (moves <= Math.ceil(pairs * 1.5)) {
    return 3;
  }
  if (moves <= Math.ceil(pairs * 2.2)) {
    return 2;
  }
  return 1;
}

export function recordKey(theme, size) {
  return `${theme}-${size}`;
}

// Fewer moves wins; on a tie, the faster time wins.
export function isBetter(result, best) {
  if (!best) {
    return true;
  }
  if (result.moves !== best.moves) {
    return result.moves < best.moves;
  }
  return result.seconds < best.seconds;
}

export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = String(whole % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function defaultSettings() {
  return { theme: 'animals', size: 4, back: 'classic', sound: true };
}

export function normalizeSettings(raw) {
  const settings = defaultSettings();
  if (!raw || typeof raw !== 'object') {
    return settings;
  }
  if (THEMES.includes(raw.theme)) {
    settings.theme = raw.theme;
  }
  if (SIZES.includes(raw.size)) {
    settings.size = raw.size;
  }
  if (CARD_BACKS.includes(raw.back)) {
    settings.back = raw.back;
  }
  if (typeof raw.sound === 'boolean') {
    settings.sound = raw.sound;
  }
  return settings;
}

export function normalizeRecords(raw) {
  const records = {};
  if (!raw || typeof raw !== 'object') {
    return records;
  }
  THEMES.forEach((theme) => {
    SIZES.forEach((size) => {
      const key = recordKey(theme, size);
      const record = raw[key];
      if (record && Number.isInteger(record.moves) && record.moves > 0 && typeof record.seconds === 'number' && record.seconds >= 0) {
        records[key] = { moves: record.moves, seconds: record.seconds };
      }
    });
  });
  return records;
}
