import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memories, memoryLength, places, restore, road, roadPosition, pitch, doors } from '../games/forest/world.js';

test('walking east and back crosses every landscape at the same world position', () => {
  assert.equal(road.length, 12);
  for (let i = 0; i < road.length - 1; i++) {
    const east = roadPosition(road[i], 0.945);
    assert.equal(east.room, road[i + 1]);
    assert.ok(Math.abs(east.x + pitch - 0.945) < 1e-9);
    assert.equal(roadPosition(east.room, east.x - 0.02).room, road[i]);
  }
  assert.equal(roadPosition(road[0], -1).room, road[0]);
  assert.equal(roadPosition(road.at(-1), 2).room, road.at(-1));
  assert.equal(doors.house.to, 'hearth');
  assert.equal(doors.hearth.to, 'house');
  const points = [...road, 'hearth'].flatMap((room) => Object.keys(places[room].points));
  assert.equal(memories.length, 22);
  assert.equal(new Set(points).size, 23);
  assert.deepEqual(new Set(points), new Set([...memories, 'passage']));
});

test('bad or duplicate saved items cannot open the waterfall', () => {
  const state = restore({
    found: ['coin1', 'coin1', 'imaginary', 'passage'],
    finished: true,
    room: { toString: null },
    x: Infinity,
    y: -9,
    shipStep: 4,
  });
  assert.deepEqual([...state.found], ['coin1']);
  assert.equal(state.finished, false);
  assert.equal(state.room, 'meadow');
  assert.equal(state.shipStep, 0);
  assert.ok(Number.isFinite(state.x) && state.y > 0);
});

test('a cleared ship stays cleared and a finished journey survives reload', () => {
  assert.equal(restore({ shipStep: 1 }).shipStep, 1);
  const state = restore({ room: 'falls', found: memories, finished: true });
  assert.equal(state.shipStep, 2);
  assert.equal(state.room, 'falls');
  assert.equal(state.finished, true);
});

test('restarting can distinguish an old open tab from the new journey', () => {
  assert.equal(restore({ room: 'grove', found: ['owl'] }).journeyId, '');
  const fresh = restore({ journeyId: 'second-visit' });
  assert.equal(fresh.journeyId, 'second-visit');
  assert.equal(fresh.room, 'meadow');
  assert.equal(fresh.found.size, 0);
  assert.equal(fresh.shipStep, 0);
  assert.equal(fresh.finished, false);
});

// Read GIF block boundaries so compressed pixel data cannot count as another frame.
function gifTiming(data) {
  const paletteBytes = (packed) => (packed & 0x80 ? 3 * (2 << (packed & 7)) : 0);
  let offset = 13 + paletteBytes(data[10]);
  let frames = 0;
  let centiseconds = 0;
  while (offset < data.length && data[offset] !== 0x3b) {
    const type = data[offset++];
    if (type === 0x2c) {
      frames++;
      offset += 10 + paletteBytes(data[offset + 8]); // Descriptor, palette and LZW code size.
    } else {
      assert.equal(type, 0x21, 'expected a GIF extension');
      if (data[offset++] === 0xf9) centiseconds += data.readUInt16LE(offset + 2);
    }
    while (offset < data.length && data[offset]) offset += 1 + data[offset];
    offset++;
  }
  assert.equal(data[offset], 0x3b, 'expected the GIF trailer');
  return { frames, centiseconds };
}

test('every discovery has an animated GIF timed to its playback window', () => {
  for (const id of memories) {
    const url = new URL('../games/forest/art/films/' + id + '.gif', import.meta.url);
    const data = readFileSync(url);
    assert.equal(data.toString('ascii', 0, 6), 'GIF89a', id);
    const { frames, centiseconds } = gifTiming(data);
    assert.ok(frames > 1, id);
    assert.equal(centiseconds, id === 'ship' ? 550 : memoryLength * 100, id);
  }
});
