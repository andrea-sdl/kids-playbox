import { test } from 'node:test';
import assert from 'node:assert/strict';
import { steerFromTilt, wheelAngle } from '../games/drive/tilt.js';

test('the wheel angle comes from gamma upright and from beta on either side', () => {
  const reading = { beta: 12, gamma: -7 };
  assert.equal(wheelAngle(reading, 0), -7);
  assert.equal(wheelAngle(reading, 180), 7);
  assert.equal(wheelAngle(reading, 90), 12);
  assert.equal(wheelAngle(reading, 270), -12);
  assert.equal(wheelAngle(reading, -90), -12, 'some browsers report -90 for 270');
});

test('steering has a dead zone, grows with the tilt and stops at full lock', () => {
  assert.equal(steerFromTilt(1, 0), 0);
  assert.equal(steerFromTilt(-2, 0), 0);
  assert.ok(steerFromTilt(10, 0) > 0.2 && steerFromTilt(10, 0) < 0.5);
  assert.equal(steerFromTilt(40, 0), 1);
  assert.equal(steerFromTilt(-40, 0), -1);
});

test('steering is measured from where the drive started', () => {
  assert.equal(steerFromTilt(31, 30), 0);
  assert.equal(steerFromTilt(60, 30), 1);
  assert.ok(steerFromTilt(20, 30) < 0);
});
