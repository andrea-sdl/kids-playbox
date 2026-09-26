import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID, MAX_HEIGHT, SHAPES, World, anchorFor, cellsFor, footprint, normalizeBlock, sunForHour } from '../games/blocks/world.js';

const brick = (x, y, z, extra = {}) => ({ shape: 'brick', x, y, z, rotation: 0, color: '#e3342f', texture: null, ...extra });

test('turning a long block swaps its width and depth', () => {
  assert.deepEqual(footprint('long', 0), [2, 1]);
  assert.deepEqual(footprint('long', 1), [1, 2]);
  assert.deepEqual(footprint('square', 1), [2, 2]);
  assert.deepEqual(footprint('plank', 3), [1, 4]);
});

test('a block fills every cell under it', () => {
  assert.deepEqual(cellsFor({ shape: 'long', x: 3, y: 0, z: 5, rotation: 1 }), [[3, 0, 5], [3, 0, 6]]);
  assert.equal(cellsFor({ shape: 'square', x: 0, y: 2, z: 0, rotation: 0 }).length, 4);
});

test('blocks cannot overlap', () => {
  const world = new World();
  assert.ok(world.add(brick(1, 0, 1)));
  assert.equal(world.add(brick(1, 0, 1)), null);
  assert.equal(world.add({ ...brick(0, 0, 1), shape: 'long' }), null, 'a long block would cover the taken cell');
  assert.ok(world.add(brick(1, 1, 1)), 'stacking on top is fine');
  assert.equal(world.size, 2);
});

test('blocks must stay inside the building area', () => {
  const world = new World();
  assert.equal(world.add(brick(-1, 0, 0)), null);
  assert.equal(world.add(brick(GRID, 0, 0)), null);
  assert.equal(world.add(brick(0, MAX_HEIGHT, 0)), null);
  assert.equal(world.add({ ...brick(GRID - 1, 0, 0), shape: 'long' }), null, 'a long block would stick out');
});

test('removing a block frees its cells', () => {
  const world = new World();
  const id = world.add({ ...brick(2, 0, 2), shape: 'square' });
  assert.ok(world.blockAt([3, 0, 3]));
  world.remove(id);
  assert.equal(world.blockAt([3, 0, 3]), null);
  assert.ok(world.add(brick(3, 0, 3)));
});

test('painting keeps the block in place', () => {
  const world = new World();
  const id = world.add(brick(4, 0, 4));
  world.update(id, { color: '#3490DC', texture: 'wood' });
  assert.deepEqual(world.blockAt([4, 0, 4]), { id, ...brick(4, 0, 4, { color: '#3490dc', texture: 'wood' }) });
});

test('the pointed-at cell lands near the middle of big blocks', () => {
  assert.deepEqual(anchorFor('brick', 0, [5, 0, 5]), { x: 5, y: 0, z: 5 });
  assert.deepEqual(anchorFor('plank', 0, [5, 0, 5]), { x: 4, y: 0, z: 5 });
  assert.deepEqual(anchorFor('plank', 1, [5, 0, 5]), { x: 5, y: 0, z: 4 });
});

test('saved builds load back, skipping broken or overlapping blocks', () => {
  const world = new World();
  SHAPES.forEach((shape, i) => world.add({ ...brick(i * 2, 0, 0), shape: shape.id, rotation: i % 4 }));
  const saved = JSON.parse(JSON.stringify(world.toJSON()));
  const loaded = World.fromJSON([...saved, brick(0, 0, 0), { shape: 'spaceship' }, { ...brick(9, 0, 9), color: 'red' }, null]);
  assert.deepEqual(loaded.toJSON(), saved);
  assert.equal(World.fromJSON('junk').size, 0);
});

test('odd rotations and textures are cleaned up', () => {
  assert.equal(normalizeBlock(brick(0, 0, 0, { rotation: 5 })).rotation, 1);
  assert.equal(normalizeBlock(brick(0, 0, 0, { rotation: -1 })).rotation, 3);
  assert.equal(normalizeBlock(brick(0, 0, 0, { texture: 'lava' })).texture, null);
  assert.equal(normalizeBlock(brick(0.5, 0, 0)), null);
});

test('the sun rises in the morning, is highest at noon and sets in the evening', () => {
  assert.ok(Math.abs(sunForHour(6).elevation) < 0.001);
  assert.ok(Math.abs(sunForHour(18).elevation) < 0.001);
  assert.equal(Math.round(sunForHour(12).elevation), 70);
  assert.ok(sunForHour(0).elevation < 0, 'below the horizon at midnight');
  assert.equal(sunForHour(12).daylight, 1);
  assert.equal(sunForHour(0).daylight, 0);
  assert.ok(sunForHour(18.3).daylight > 0 && sunForHour(18.3).daylight < 1, 'dusk is in between');
  assert.equal(sunForHour(9).azimuth < sunForHour(15).azimuth, true, 'moves from east to west');
});
