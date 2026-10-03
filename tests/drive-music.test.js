import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, chordNote } from '../games/drive/music.js';
import { SCENARIOS } from '../games/drive/world.js';

test('every track has a song', () => {
  assert.deepEqual(Object.keys(SONGS).sort(), [...SCENARIOS].sort());
});

test('song patterns are one bar of 16 steps, using only known symbols', () => {
  Object.entries(SONGS).forEach(([id, song]) => {
    ['kick', 'snare', 'hat', 'tom', 'bass', 'arp'].forEach((part) => {
      if (song[part] === undefined) {
        return;
      }
      assert.equal(song[part].length, 16, `${id} ${part}`);
    });
    ['kick', 'snare', 'hat', 'tom'].forEach((part) => {
      if (song[part]) {
        assert.match(song[part], /^[x.]+$/, `${id} ${part}`);
      }
    });
    assert.match(song.bass, /^[0-9a-c.]+$/, `${id} bass`);
    assert.match(song.arp, /^[0-3.]+$/, `${id} arp`);
    assert.ok(song.bpm >= 80 && song.bpm <= 140, `${id} tempo`);
    song.chords.forEach(([root, quality]) => {
      assert.ok(Number.isInteger(root) && root >= 40 && root <= 72, `${id} root ${root}`);
      assert.ok(['minor', 'major'].includes(quality), `${id} ${quality}`);
    });
  });
});

test('arpeggio digits pick root, third, fifth and octave', () => {
  assert.deepEqual([0, 1, 2, 3].map((digit) => chordNote('minor', digit)), [0, 3, 7, 12]);
  assert.deepEqual([0, 1, 2, 3].map((digit) => chordNote('major', digit)), [0, 4, 7, 12]);
});
