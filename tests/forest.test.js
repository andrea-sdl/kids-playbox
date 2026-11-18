import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { memories, walkableY, places, restore, road, roadPosition, pitch, doors } from '../games/forest/world.js';

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

test('each discovery has a painted background and a separate WebP pose sheet', () => {
  for (const id of memories) {
    for (const layer of ['ground', 'poses']) {
      const src = new URL('../games/forest/art/objects/' + id + '-' + layer + '.webp', import.meta.url);
      assert.equal(readFileSync(src).toString('ascii', 8, 12), 'WEBP', id);
    }
  }
});

test('narrow paths meet at both ends of the shared painting overlap', () => {
  for (let i = 1; i < road.length; i++) {
    for (const x of [0.89, 0.94, 0.99]) {
      for (const y of [0.72, 0.84, 0.91]) {
        assert.equal(walkableY(road[i - 1], x, y), walkableY(road[i], x - pitch, y));
      }
    }
  }
});

test('a saved guardian standing in reeds or below the viaduct resumes on the path', () => {
  for (const room of ['causeway', 'marsh', 'viaduct', 'gorge']) {
    assert.ok(restore({ room, x: 0.5, y: 0.72 }).y >= 0.79, room);
    assert.ok(restore({ room, x: 0.5, y: 0.91 }).y <= 0.89, room);
  }
  assert.equal(restore({ room: 'meadow', x: 0.5, y: 0.72 }).y, 0.72);
});
