import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURVE_ANGLE,
  checkTrack,
  cleanName,
  closingPath,
  fileName,
  normalizeTrack,
  piecePath,
  piecesLength,
  readTrack,
  trackCode,
  trackFile,
  trackPoints,
} from '../games/drive/tracks.js';
import { sampleTrack } from '../games/drive/world.js';

// A rounded rectangle: straights joined by pairs of right curves.
const OVAL = 'SSSSRRSSRRSSSSRRSSRR';

test('straights go forward, curves turn 45° each way', () => {
  const straight = piecePath('S');
  assert.ok(Math.abs(straight.end.x - 30) < 1e-9 && Math.abs(straight.end.z) < 1e-9);
  const left = piecePath('L').end;
  const right = piecePath('R').end;
  assert.ok(Math.abs(left.heading + CURVE_ANGLE) < 1e-9, 'left lowers the heading');
  assert.ok(Math.abs(right.heading - CURVE_ANGLE) < 1e-9);
  assert.ok(left.z < 0 && right.z > 0, 'left and right go to opposite sides');
  // Eight right curves make a full circle back to the start.
  const circle = piecePath('RRRRRRRR').end;
  assert.ok(Math.hypot(circle.x, circle.z) < 1e-6);
});

test('a closed shape needs no extra road to get back', () => {
  const end = piecePath(OVAL).end;
  assert.ok(Math.hypot(end.x, end.z) < 1e-6, 'the oval ends where it starts');
  assert.deepEqual(closingPath(end), []);
});

test('any track becomes a loop: the way back ends at the start, pointing forward', () => {
  const end = piecePath('SSSRRS').end;
  const back = closingPath(end);
  assert.ok(back.length > 3);
  const last = back[back.length - 1];
  assert.ok(Math.hypot(last[0], last[1]) < 15, 'finishes next to the start');
  assert.ok(last[0] < 0, 'arrives from behind the start line');
});

test('good tracks pass; empty and crossing ones are explained', () => {
  assert.equal(checkTrack('').problem, 'empty');
  // Even one straight closes into an oval: the way back goes round.
  assert.ok(checkTrack('S').ok);
  const oval = checkTrack(OVAL);
  assert.ok(oval.ok, `oval: ${oval.problem}`);
  assert.ok(Math.abs(oval.length - piecesLength(OVAL)) < 5);
  // Turning 270° makes the road run back across its own start.
  const crossing = checkTrack('SSSSSSRRRRRRSSSSSS');
  assert.equal(crossing.problem, 'crossing');
  assert.ok(crossing.spot);
  // Going round and round in a circle overlaps itself.
  assert.equal(checkTrack('RRRRRRRRRRRR').problem, 'crossing');
});

test('the way back is never too tight, whichever way the road ends', () => {
  ['SSS', 'SSSSSSSSSSSS', 'LLLLSSSS', 'SSLLSSRRRRSSSS', 'SRSRSRSRSRS'].forEach((pieces) => {
    const result = checkTrack(pieces);
    assert.ok(result.ok, `${pieces}: ${result.problem}`);
  });
});

test('there is no limit on length', () => {
  const long = 'S'.repeat(60) + 'RRRR' + 'S'.repeat(60) + 'RRRR';
  const result = checkTrack(long);
  assert.ok(result.ok, result.problem);
  assert.ok(result.length > 3600);
});

test('passing tracks drive like the built-in ones: smooth samples, closed loop', () => {
  const { samples } = sampleTrack(trackPoints(OVAL));
  samples.forEach((sample, i) => {
    const next = samples[(i + 1) % samples.length];
    assert.ok(Math.abs(Math.hypot(next.x - sample.x, next.z - sample.z) - 2) < 0.3);
  });
});

test('codes and files round-trip, and bad ones are refused', () => {
  const track = { id: 'tabc', name: 'Zoom zoom | 🏎', scenario: 'jungle', pieces: OVAL };
  const fromCode = readTrack(trackCode(track));
  assert.deepEqual({ ...fromCode, id: 'x' }, { ...track, id: 'x' });
  const fromFile = readTrack(trackFile(track));
  assert.deepEqual({ ...fromFile, id: 'x' }, { ...track, id: 'x' });
  assert.equal(readTrack('hello'), null);
  assert.equal(readTrack('PBT1|moon|SSS|x'), null);
  assert.equal(readTrack('PBT1|city|SSX|x'), null);
  assert.equal(readTrack('{"format":"other"}'), null);
  assert.equal(readTrack('PBT1|city|SSRR|').name, 'My track');
});

test('names are tidied and saved tracks are checked', () => {
  assert.equal(cleanName('   a    b  ', 'x'), 'a b');
  assert.equal(cleanName('', 'Fallback'), 'Fallback');
  assert.equal(cleanName('x'.repeat(50), 'y').length, 32);
  assert.equal(normalizeTrack({ scenario: 'city', pieces: 'SSQ' }), null);
  assert.equal(normalizeTrack({ id: 'tok1', scenario: 'city', pieces: 'SS', name: 'A' }).id, 'tok1');
  assert.match(normalizeTrack({ id: '../bad', scenario: 'city', pieces: 'SS' }).id, /^t[a-z0-9]+$/);
  assert.equal(fileName({ name: 'Città Lunga!' }), 'citta-lunga.playbox-track.json');
});
