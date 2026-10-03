import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CIRCUITS,
  DIFFICULTIES,
  PAINTS,
  ROAD_WIDTH,
  SAMPLE_SPACING,
  SCENARIOS,
  formatTime,
  lapChange,
  nearestSample,
  normalizeSave,
  placePoints,
  pointCount,
  sampleTrack,
  sideMeters,
  sideOffset,
  snowiness,
} from '../games/drive/world.js';

const tracks = Object.fromEntries(SCENARIOS.map((scenario) => [scenario, sampleTrack(CIRCUITS[scenario])]));

test('every scenario has a circuit of a good length', () => {
  SCENARIOS.forEach((scenario) => {
    const { length } = tracks[scenario];
    assert.ok(length > 1200 && length < 3000, `${scenario} is ${Math.round(length)} m`);
  });
});

test('samples are evenly spaced and the loop closes', () => {
  SCENARIOS.forEach((scenario) => {
    const { samples } = tracks[scenario];
    samples.forEach((sample, i) => {
      const next = samples[(i + 1) % samples.length];
      const step = Math.hypot(next.x - sample.x, next.z - sample.z);
      assert.ok(Math.abs(step - SAMPLE_SPACING) < 0.3, `${scenario} step ${i} is ${step.toFixed(2)} m`);
    });
  });
});

test('the road never runs into itself', () => {
  SCENARIOS.forEach((scenario) => {
    const { samples } = tracks[scenario];
    const count = samples.length;
    // Parts of the road more than 60 m apart along it must be far apart on
    // the ground too, or the road would overlap.
    const nearby = Math.ceil(60 / SAMPLE_SPACING);
    let closest = Infinity;
    for (let i = 0; i < count; i += 4) {
      for (let j = i + nearby; j < count - nearby + i; j += 4) {
        const a = samples[i];
        const b = samples[j % count];
        closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
      }
    }
    assert.ok(closest > ROAD_WIDTH * 1.8, `${scenario}: two parts of the road come within ${closest.toFixed(1)} m`);
  });
});

test('bends are gentle enough to drive and hills are gentle enough to climb', () => {
  SCENARIOS.forEach((scenario) => {
    const { samples } = tracks[scenario];
    samples.forEach((sample, i) => {
      // A radius of at least 30 m.
      assert.ok(Math.abs(sample.curve) < 1 / 30, `${scenario} bend at ${i} is too tight`);
      const next = samples[(i + 1) % samples.length];
      assert.ok(Math.abs(next.y - sample.y) / SAMPLE_SPACING < 0.16, `${scenario} slope at ${i} is too steep`);
    });
  });
});

test('the car is found on the road, and its side is measured from the middle', () => {
  const { samples } = tracks.city;
  const sample = samples[300];
  const x = sample.x + sample.nx * 4;
  const z = sample.z + sample.nz * 4;
  assert.equal(nearestSample(samples, x, z, 290), 300);
  assert.ok(Math.abs(sideOffset(sample, x, z) - 4) < 1e-9);
});

test('laps count up across the start line, and down when reversing over it', () => {
  assert.equal(lapChange(990, 3, 1000), 1);
  assert.equal(lapChange(3, 990, 1000), -1);
  assert.equal(lapChange(400, 402, 1000), 0);
});

test('points: more and further to the side as levels get harder', () => {
  SCENARIOS.forEach((scenario) => {
    const { samples } = tracks[scenario];
    const spread = DIFFICULTIES.map((difficulty) => {
      const points = placePoints(samples, difficulty);
      assert.equal(points.length, pointCount(difficulty));
      points.forEach((point) => {
        assert.ok(point.index >= 0 && point.index < samples.length);
        assert.ok(Math.abs(sideMeters(point.side)) < ROAD_WIDTH / 2 - 1.5, 'points stay on the road');
      });
      return points.reduce((sum, point) => sum + Math.abs(point.side), 0) / points.length;
    });
    assert.equal(spread[0], 0, 'easy points are in the middle');
    assert.ok(spread[1] > 0 && spread[2] > spread[1], `${scenario} spread ${spread}`);
  });
  assert.deepEqual(placePoints(tracks.jungle.samples, 'hard'), placePoints(tracks.jungle.samples, 'hard'), 'same places every time');
});

test('hard points sit on the inside of bends', () => {
  const { samples } = tracks.jungle;
  placePoints(samples, 'hard').forEach((point) => {
    const curve = samples[point.index].curve;
    if (Math.abs(curve) > 0.004) {
      assert.equal(Math.sign(point.side), Math.sign(curve));
    }
  });
});

test('the wasteland turns from snow to desert and back', () => {
  assert.equal(snowiness(0.1), 1);
  assert.equal(snowiness(0.6), 0);
  assert.ok(snowiness(0.41) > 0 && snowiness(0.41) < 1);
  assert.ok(snowiness(0.95) > 0 && snowiness(0.95) < 1);
  assert.equal(snowiness(1.1), snowiness(0.1));
});

test('times read as minutes, seconds and tenths', () => {
  assert.equal(formatTime(0), '0:00.0');
  assert.equal(formatTime(75.46), '1:15.4');
});

test('bad saves fall back safely', () => {
  assert.deepEqual(normalizeSave(null), { scenario: 'city', difficulty: 'easy', car: 'comet', paint: PAINTS[0], sound: true, music: true, track: null, best: {} });
  const save = normalizeSave({
    scenario: 'moon', difficulty: 'hard', car: 'rover', paint: 'pink', sound: false, music: false, track: '../x',
    best: { 'city-easy': 42.5, 'city-impossible': 3, 'jungle-hard': -1, 'track-tabc1-medium': 61.2, 'track-bad id-easy': 5 },
  });
  assert.deepEqual(save, {
    scenario: 'city', difficulty: 'hard', car: 'rover', paint: PAINTS[0], sound: false, music: false, track: null,
    best: { 'city-easy': 42.5, 'track-tabc1-medium': 61.2 },
  });
  assert.equal(normalizeSave({ track: 'tabc1' }).track, 'tabc1');
  assert.equal(normalizeSave({ music: 'loud' }).music, true);
});
