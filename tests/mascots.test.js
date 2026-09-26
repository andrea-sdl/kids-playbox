import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, MASCOTS } from '../games/dice/logic.js';
import { MASCOT_INFO } from '../games/dice/mascots.js';

const gameDir = fileURLToPath(new URL('../games/dice/', import.meta.url));

test('every look has a name, cheers, a body and a face', () => {
  MASCOTS.forEach((mascot) => {
    CHARACTERS[mascot].forEach((character) => {
      const info = MASCOT_INFO[character];
      assert.ok(info, `${character} has no drawing`);
      assert.ok(info.name);
      assert.ok(info.cheers.length > 0);
      assert.match(info.svg(), /m-hand/, `${character} needs a hand for the dice to leave from`);
      assert.ok(info.face().length > 0);
    });
  });
});

test('images used by painted characters exist', () => {
  Object.values(MASCOT_INFO).forEach((info) => {
    const html = info.svg() + info.face();
    [...html.matchAll(/src="([^"]+)"/g)].forEach(([, src]) => {
      assert.ok(existsSync(gameDir + src), `missing ${src}`);
    });
  });
});
