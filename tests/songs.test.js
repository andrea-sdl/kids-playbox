import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, noteToMidi, parseDrums, parseNotes } from '../games/dice/songs.js';
import { INSTRUMENTS } from '../games/dice/music.js';
import { MASCOTS } from '../games/dice/logic.js';

test('every mascot has its own tune', () => {
  assert.deepEqual(Object.keys(SONGS).sort(), [...MASCOTS].sort());
});

test('note names turn into the right MIDI numbers', () => {
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('F#4'), 66);
  assert.equal(noteToMidi('Bb3'), 58);
  assert.equal(noteToMidi('H2'), null);
});

test('holds extend a note and rests leave gaps', () => {
  const { events, length } = parseNotes('C4 - - . E4 | G4 -');
  assert.equal(length, 7);
  assert.deepEqual(events, [
    { step: 0, midi: 60, steps: 3 },
    { step: 4, midi: 64, steps: 1 },
    { step: 5, midi: 67, steps: 2 },
  ]);
});

test('bad notes and drums are reported, not ignored', () => {
  assert.throws(() => parseNotes('C4 Q9'), /Unknown note "Q9"/);
  assert.throws(() => parseDrums('k z'), /Unknown drum "z"/);
});

// Catches typos in the scores: a missing or extra step shifts every
// following note out of time.
test('every bar of every track has the right number of steps', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    song.tracks.forEach((track, index) => {
      const score = track.notes || track.drums;
      const bars = score.split('|').map((bar) => bar.trim()).filter(Boolean);
      bars.forEach((bar, barIndex) => {
        const steps = bar.split(/\s+/).length;
        assert.equal(steps, song.stepsPerBar, `${id} track ${index} bar ${barIndex + 1} has ${steps} steps`);
      });
    });
  }
});

test('every track parses and uses a real instrument', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    song.tracks.forEach((track, index) => {
      if (track.drums) {
        assert.ok(parseDrums(track.drums).events.length > 0, `${id} drum track ${index} is empty`);
        return;
      }
      assert.ok(INSTRUMENTS[track.instrument], `${id} track ${index} uses unknown instrument ${track.instrument}`);
      const { events } = parseNotes(track.notes);
      assert.ok(events.length > 0, `${id} track ${index} is empty`);
      events.forEach((event) => {
        assert.ok(event.midi >= 21 && event.midi <= 108, `${id} track ${index} note out of piano range`);
      });
    });
  }
});
