import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDS,
  HALF_D,
  HALF_W,
  LOOK_OPTIONS,
  PARKS,
  PRESETS,
  QP_HEIGHT,
  SCENARIOS,
  WORDS,
  buildPark,
  defaultLook,
  normalizeSave,
  presetLook,
  qpHeight,
  starsFor,
} from '../games/skate/world.js';
import { CRUISE, createRider, stepRider } from '../games/skate/physics.js';
import { FLIPS, GRABS, createTricks, praise, spinHalfTurns, spinPoints } from '../games/skate/tricks.js';
import { SONGS, chordNote } from '../games/skate/music.js';

const DT = 1 / 60;

// Rides for `seconds`, pressing jump at the frames `jumpAt` says, and
// returns every event with the rider's state at that moment.
function ride(park, rider, seconds, { steer = 0, jumpAt = () => false } = {}) {
  const log = [];
  for (let frame = 0; frame < seconds / DT; frame += 1) {
    const events = stepRider(rider, { steer, jump: jumpAt(rider, frame) }, DT, park);
    events.forEach((event) => log.push({ ...event, mode: rider.mode, x: rider.x, y: rider.y, z: rider.z }));
  }
  return log;
}

function riderAt(park, x, z, heading, speed = CRUISE) {
  const rider = createRider(park);
  Object.assign(rider, { x, z, y: park.height(x, z), heading, speed });
  return rider;
}

/* ---------- Parks ---------- */

test('every park has a layout, a start on the floor and one letter per letter of the word', () => {
  assert.deepEqual(Object.keys(PARKS).sort(), [...SCENARIOS].sort());
  SCENARIOS.forEach((name) => {
    const park = buildPark(name);
    assert.equal(park.height(park.start.x, park.start.z), 0, `${name} starts on the floor`);
    BOARDS.forEach((board) => assert.equal(park.letters.length, WORDS[board].length, `${name} ${board}`));
    assert.ok(park.quarterPipes.length >= 1, `${name} has a quarter pipe`);
    assert.ok(park.rails.length >= 2, `${name} has things to grind`);
  });
});

test('pieces and letters stay inside the park', () => {
  SCENARIOS.forEach((name) => {
    const park = buildPark(name);
    park.pieces.forEach((piece) => {
      const points = piece.type === 'rail' ? [piece.a, piece.b].map(([x, , z]) => [x, z]) : [[piece.x, piece.z]];
      points.forEach(([x, z]) => {
        assert.ok(Math.abs(x) <= HALF_W && Math.abs(z) <= HALF_D, `${name} ${piece.type} at ${x}, ${z}`);
      });
    });
    park.letters.forEach(({ x, z }) => {
      assert.ok(x >= park.bounds.minX - 0.5 && x <= park.bounds.maxX + 0.5, `${name} letter x ${x}`);
      assert.ok(z >= park.bounds.minZ - 0.5 && z <= park.bounds.maxZ + 0.5, `${name} letter z ${z}`);
    });
  });
});

test('quarter pipes curve up from the floor to the deck', () => {
  assert.equal(qpHeight(-1), 0);
  assert.equal(qpHeight(0), 0);
  assert.ok(qpHeight(2) > 0 && qpHeight(2) < qpHeight(4));
  assert.equal(qpHeight(100), QP_HEIGHT);
  const park = buildPark('city');
  // The city has its quarter pipes north and west, a fence east.
  assert.ok(park.height(0, -HALF_D - 3) > 0.5);
  assert.equal(park.height(HALF_W - 0.5, 0), 0);
});

/* ---------- Riding ---------- */

test('the board rolls by itself up to cruising speed', () => {
  const park = buildPark('city');
  const rider = riderAt(park, 0, 24, Math.PI, 0);
  ride(park, rider, 2);
  assert.ok(Math.abs(rider.speed - CRUISE) < 0.5, `speed ${rider.speed}`);
  assert.ok(rider.z < 15, 'moved forward (north)');
});

test('an ollie lifts off and lands again', () => {
  const park = buildPark('city');
  const rider = riderAt(park, 30, 25, Math.PI);
  const log = ride(park, rider, 1.5, { jumpAt: (r, frame) => frame === 5 });
  const types = log.map((event) => event.type);
  assert.deepEqual(types, ['ollie', 'land']);
  const land = log[1];
  assert.ok(land.airTime > 0.6 && land.airTime < 1.1, `air time ${land.airTime}`);
});

test('riding off a ramp flies through the air', () => {
  const park = buildPark('mountain');
  // The big jump is straight ahead of the start.
  const rider = riderAt(park, park.start.x, park.start.z, park.start.heading);
  const log = ride(park, rider, 4);
  assert.equal(log[0].type, 'launch');
  assert.ok(log[0].y > 1.5, `launched from the lip at ${log[0].y}`);
  assert.equal(log[1].type, 'land');
});

test('quarter pipes send the rider up and back down facing the park', () => {
  const park = buildPark('city');
  const rider = riderAt(park, 0, -20, Math.PI);
  const log = ride(park, rider, 3);
  const vert = log.find((event) => event.type === 'vert');
  assert.ok(vert, 'flew out of the quarter pipe');
  const land = log.find((event) => event.type === 'land');
  assert.ok(land?.vert, 'landed back on the wall');
  assert.ok(Math.cos(rider.heading) > 0.9, 'heading back south, into the park');
  ride(park, rider, 1.5);
  assert.equal(rider.mode, 'ground');
  assert.ok(rider.z > -HALF_D, 'rolled back down onto the floor');
});

test('jumping onto a rail grinds along it, then flies off the end', () => {
  const park = buildPark('city');
  // The flat rail runs along x = -14 from z = 14 to z = -6.
  const rider = riderAt(park, -14, 26, Math.PI);
  const log = ride(park, rider, 3.5, { jumpAt: (r) => r.mode === 'ground' && r.z < 16.5 && r.z > 15 });
  const types = log.map((event) => event.type);
  assert.deepEqual(types.slice(0, 4), ['ollie', 'grind', 'grindEnd', 'land']);
  const grind = log[1];
  assert.ok(Math.abs(grind.y - 0.7) < 0.01 && Math.abs(grind.x + 14) < 0.01);
  assert.equal(log[1].side, false, 'straight on: a 50-50');
});

test('walls stop the rider and turn them around', () => {
  const park = buildPark('city');
  // The city's south side is a fence.
  const rider = riderAt(park, 30, 26, 0);
  const log = ride(park, rider, 2);
  assert.ok(log.some((event) => event.type === 'bump'));
  assert.ok(rider.z <= park.bounds.maxZ);
  assert.ok(Math.cos(rider.heading) < 0, 'now heading back north');
});

/* ---------- Tricks ---------- */

test('a combo adds its tricks and multiplies by how many there were', () => {
  const tricks = createTricks('skate');
  tricks.takeOff();
  const flip = tricks.pressFlip();
  assert.equal(flip.name, 'Kickflip');
  assert.equal(tricks.pressFlip(), null, 'one flip at a time');
  tricks.update(1, 'air');
  assert.equal(tricks.flip, null, 'the flip is done');
  const result = tricks.land({ airTime: 1, spin: Math.PI * 2, from: 'ollie' });
  assert.equal(result.bail, false);
  assert.deepEqual(tricks.combo.map((trick) => trick.name), ['Kickflip', '360']);
  assert.equal(tricks.total, (100 + 200) * 2);
  assert.equal(tricks.update(0.3, 'ground'), 0, 'not banked yet');
  assert.equal(tricks.update(0.4, 'ground'), 600, 'banked after a moment on the ground');
  assert.equal(tricks.combo.length, 0);
});

test('landing in the middle of a flip is a fall and loses the combo', () => {
  const tricks = createTricks('snow');
  tricks.takeOff();
  tricks.pressFlip();
  tricks.update(0.1, 'air');
  assert.equal(tricks.land({ airTime: 0.4, spin: 0, from: 'ollie' }).bail, true);
  assert.equal(tricks.combo.length, 0);
});

test('grabs and grinds earn more the longer they last', () => {
  const tricks = createTricks('skate');
  tricks.takeOff();
  assert.equal(tricks.setGrab(true).name, 'Indy');
  tricks.update(1, 'air');
  tricks.setGrab(false);
  tricks.startGrind(false, 0);
  tricks.update(2, 'grind');
  tricks.endGrind();
  tricks.land({ airTime: 0.3, spin: 0, from: 'grind' });
  const [grab, grind] = tricks.combo;
  assert.equal(grab.points, 300);
  assert.equal(grind.name, '50-50 Grind');
  assert.equal(grind.points, 600);
});

test('a plain jump still scores, and every trick list has names', () => {
  const tricks = createTricks('skate');
  tricks.takeOff();
  tricks.land({ airTime: 0.8, spin: 0, from: 'ollie' });
  assert.deepEqual(tricks.combo.map((trick) => trick.name), ['Ollie']);
  BOARDS.forEach((board) => {
    assert.ok(FLIPS[board].length >= 5 && GRABS[board].length >= 5);
    [...FLIPS[board], ...GRABS[board]].forEach((trick) => assert.ok(trick.name && trick.points > 0 && trick.move));
  });
});

test('spins round to half turns and big combos get praise', () => {
  assert.equal(spinHalfTurns(Math.PI * 0.4), 0);
  assert.equal(spinHalfTurns(-Math.PI * 1.1), 1);
  assert.equal(spinHalfTurns(Math.PI * 3), 3);
  assert.ok(spinPoints(4) > spinPoints(2));
  assert.equal(praise(100), null);
  assert.equal(praise(5000), 'sick');
});

/* ---------- Looks, saves and music ---------- */

test('presets only use choices from the shop', () => {
  PRESETS.forEach((preset) => {
    assert.ok(BOARDS.includes(preset.board));
    const look = presetLook(preset);
    Object.entries(LOOK_OPTIONS).forEach(([key, values]) => {
      assert.ok(values.includes(look[key]), `${preset.id} ${key} ${look[key]}`);
    });
  });
});

test('saved settings are checked and fall back to defaults', () => {
  const fresh = normalizeSave(null);
  assert.equal(fresh.scenario, 'city');
  assert.deepEqual(fresh.look, defaultLook());
  const loaded = normalizeSave({
    scenario: 'sea', board: 'snow', mode: 'free', sound: false,
    look: { hair: 'mohawk', hat: 'tophat', deck: '#2f9bff' },
    best: { sea: 4200, moon: 10, city: -5 },
    stars: { sea: 7 },
  });
  assert.equal(loaded.scenario, 'sea');
  assert.equal(loaded.board, 'snow');
  assert.equal(loaded.mode, 'free');
  assert.equal(loaded.sound, false);
  assert.equal(loaded.look.hair, 'mohawk');
  assert.equal(loaded.look.hat, 'none');
  assert.equal(loaded.look.deck, '#2f9bff');
  assert.deepEqual(loaded.best, { sea: 4200 });
  assert.deepEqual(loaded.stars, { sea: 3 });
});

test('stars: two score goals and all the letters', () => {
  assert.equal(starsFor(0, 0, 5), 0);
  assert.equal(starsFor(6000, 5, 5), 2);
  assert.equal(starsFor(25000, 5, 5), 3);
});

test('every park has a song of one bar of 16 steps', () => {
  assert.deepEqual(Object.keys(SONGS).sort(), [...SCENARIOS].sort());
  Object.entries(SONGS).forEach(([id, song]) => {
    ['kick', 'snare', 'hat', 'tom', 'bass', 'arp'].forEach((part) => {
      if (song[part] !== undefined) {
        assert.equal(song[part].length, 16, `${id} ${part}`);
      }
    });
    assert.match(song.bass, /^[0-9a-c.]+$/);
    assert.match(song.arp, /^[0-3.]+$/);
    assert.ok(['saw', 'marimba', 'twang', 'bell', 'power'].includes(song.arpSound));
    song.chords.forEach(([root, quality]) => assert.ok(root >= 40 && root <= 72 && chordNote(quality, 1) > 0));
  });
});
