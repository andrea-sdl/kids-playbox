import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, allStrings, matchLanguage } from '../shared/i18n.js';
// Loading each game's strings registers them.
import '../games/dice/strings.js';
import '../games/memory/strings.js';
import '../games/blocks/strings.js';
import { GAMES } from '../shared/games.js';
import { SHAPES, TEXTURES } from '../games/blocks/world.js';
import { CHARACTERS } from '../games/dice/logic.js';
import { THEMES, CARD_BACKS } from '../games/memory/logic.js';
import { THEME_INFO } from '../games/memory/themes.js';

const dictionaries = allStrings();
const codes = LANGUAGES.map((language) => language.code);

function placeholders(entry) {
  const texts = typeof entry === 'object' ? Object.values(entry) : [entry];
  return [...new Set(texts.join(' ').match(/\{\w+\}/g) || [])].sort();
}

test('every text exists in every language', () => {
  const english = Object.keys(dictionaries.en).sort();
  codes.forEach((code) => {
    const keys = Object.keys(dictionaries[code]).sort();
    const missing = english.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !english.includes(key));
    assert.deepEqual({ code, missing, extra }, { code, missing: [], extra: [] });
  });
});

test('translations keep the same {placeholders} as English', () => {
  Object.entries(dictionaries.en).forEach(([key, entry]) => {
    codes.forEach((code) => {
      assert.deepEqual(placeholders(dictionaries[code][key]), placeholders(entry), `${code} ${key}`);
    });
  });
});

test('plural texts have "one" and "other" forms, and no text is empty', () => {
  codes.forEach((code) => {
    Object.entries(dictionaries[code]).forEach(([key, entry]) => {
      if (typeof entry === 'object') {
        assert.ok(entry.one && entry.other, `${code} ${key} needs one and other`);
        return;
      }
      assert.ok(typeof entry === 'string' && entry.trim().length > 0, `${code} ${key} is empty`);
    });
  });
});

test('browser languages map to the closest one we have', () => {
  assert.equal(matchLanguage('it-IT'), 'it');
  assert.equal(matchLanguage('pt-PT'), 'pt-BR');
  assert.equal(matchLanguage('pt-br'), 'pt-BR');
  assert.equal(matchLanguage('de-CH'), 'de');
  assert.equal(matchLanguage('fr-FR'), null);
});


test('everything shown by name has a translation', () => {
  const needed = [
    ...GAMES.flatMap((game) => [`game.${game.id}.title`, `game.${game.id}.blurb`, `progress.${game.id}`]),
    ...SHAPES.map((shape) => `blocks.shape.${shape.id}`),
    ...TEXTURES.map((texture) => `blocks.texture.${texture}`),
    ...Object.values(CHARACTERS).flat().flatMap((id) => [`char.${id}.name`, `char.${id}.cheers`]),
    ...THEMES.map((theme) => `memory.theme.${theme}`),
    ...CARD_BACKS.map((back) => `memory.back.${back}`),
    ...THEME_INFO.animals.items.map((item) => `animal.${item.key}`),
    ...THEME_INFO.space.items.flatMap((item) => [`space.${item.key}.name`, `space.${item.key}.fact`]),
    ...THEME_INFO.countries.items.flatMap((item) => [`country.${item.key}.name`, `country.${item.key}.fact`]),
  ];
  const missing = needed.filter((key) => dictionaries.en[key] === undefined);
  assert.deepEqual(missing, []);
});
