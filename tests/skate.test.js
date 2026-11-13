import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARDS,
  DROP,
  HALF_WIDTH,
  HILLS,
  LAP,
  LOOK_OPTIONS,
  PRESETS,
  SCENARIOS,
  WORDS,
  buildHill,
  defaultLook,
  normalizeSave,
  presetLook,
  starsFor,
} from '../games/skate/world.js';
import { MAX_HEADING, MAX_SPEED, START_SPEED, createRider, startBail, stepRider } from '../games/skate/physics.js';
import { FLIPS, GRABS, createTricks, grindName, praise, spinHalfTurns, spinPoints } from '../games/skate/tricks.js';
import { SONGS, chordNote } from '../games/skate/music.js';

const DT = 1 / 60;

// Rides for `seconds`, steering and jumping as `drive` says, and returns
// every event with the rider's state at that moment. Crashes become falls,
// as in the game.
function ride(hill, rider, seconds, drive = () => ({})) {
  const log = [];
  for (let frame = 0; frame < seconds / DT; frame += 1) {
    const { steer = 0, jump = false } = drive(rider, frame);
    const events = stepRider(rider, { steer, jump }, DT, hill);
    events.forEach((event) => {
      if (event.type === 'crash') {
        startBail(rider);
      }
      log.push({ ...event, mode: rider.mode, x: rider.x, y: rider.y, z: rider.z });
    });
  }
  return log;
}

function riderAt(hill, x, z, speed = START_SPEED) {
  const rider = createRider(hill);
  Object.assign(rider, { x, z, y: hill.height(x, z), heading: 0, speed });
  return rider;
}

function firstPiece(hill, test) {
  return hill.pieces.find(test);
}

/* ---------- The hill ---------- */

test('every hill has pieces to trick on, rails to grind and a letter per letter of the word', () => {
  assert.deepEqual(Object.keys(HILLS).sort(), [...SCENARIOS].sort());
  SCENARIOS.forEach((name) => {
    const hill = buildHill(name);
    assert.ok(hill.pieces.some((piece) => piece.type === 'kicker'), `${name} has ramps`);
    assert.ok(hill.rails.length >= 4, `${name} has things to grind`);
    BOARDS.forEach((board) => assert.equal(hill.letters.length, WORDS[board].length, `${name} ${board}`));
    assert.equal(hill.height(hill.start.x, hill.start.z), hill.base(hill.start.z), `${name} starts on open ground`);
  });
});

test('the hill always goes down, and every piece and letter is on the strip', () => {
  SCENARIOS.forEach((name) => {
    const hill = buildHill(name);
    for (let z = 0; z < LAP; z += 2) {
      assert.ok(hill.baseSlope(z) < -0.02, `${name} goes down at ${z}`);
    }
    hill.pieces.forEach((piece) => {
      const points = piece.type === 'rail' ? [piece.a, piece.b].map(([x, , z]) => [x, z]) : [[piece.x, piece.z]];
      points.forEach(([x, z]) => {
        const { min, max } = hill.edges(z);
        assert.ok(x > min + 0.5 && x < max - 0.5, `${name} ${piece.type} at ${x}, ${z}`);
        assert.ok(z > 40 && z < LAP - 20, `${name} ${piece.type} is clear of the ends of the lap`);
      });
    });
    hill.letters.forEach(({ x, y, z }) => {
      const { min, max } = hill.edges(z);
      assert.ok(x > min && x < max && y > hill.base(z) + 1, `${name} letter at ${x}, ${z}`);
    });
  });
});

test('the lap repeats without a step: the same ground, one drop lower', () => {
  SCENARIOS.forEach((name) => {
    const hill = buildHill(name);
    assert.ok(Math.abs(hill.height(2, LAP - 0.001) - hill.height(2, LAP + 0.001)) < 0.01, `${name} joins up`);
    [30, 200.5, 431].forEach((z) => {
      const x = hill.center(z) + 1;
      assert.ok(Math.abs(hill.height(x, z + LAP * 3) - (hill.height(x, z) - DROP * 3)) < 1e-6, `${name} at ${z}`);
      assert.ok(Math.abs(hill.center(z + LAP) - hill.center(z)) < 1e-9);
    });
    const rail = hill.rails[0];
    const later = hill.railsAt(LAP * 2 + 10)[0];
    assert.ok(Math.abs(later.az - rail.az - LAP * 2) < 1e-9 && Math.abs(later.ay - rail.ay + DROP * 2) < 1e-9);
  });
});

/* ---------- Riding ---------- */

test('the hill does the pushing, the wind holds the speed back, and it never ends', () => {
  SCENARIOS.forEach((name) => {
    const hill = buildHill(name);
    const rider = createRider(hill);
    let fastest = 0;
    for (let i = 0; i < 90; i += 1) {
      ride(hill, rider, 1);
      fastest = Math.max(fastest, rider.speed);
      assert.ok(Number.isFinite(rider.y) && rider.speed >= 2.5, `${name} keeps moving`);
      const { min, max } = hill.edges(rider.z);
      assert.ok(rider.x >= min - 1e-6 && rider.x <= max + 1e-6, `${name} stays on the strip`);
    }
    assert.ok(fastest > 14 && fastest <= MAX_SPEED, `${name} top speed ${fastest}`);
    assert.ok(rider.z > LAP * 1.5, `${name} rode past the first lap: ${rider.z}`);
    assert.ok(rider.y < -DROP, `${name} is far down the hill`);
  });
});

test('steering turns the rider, but never back up the hill', () => {
  const hill = buildHill('meadow');
  const rider = riderAt(hill, hill.center(30), 30);
  ride(hill, rider, 0.6, () => ({ steer: -1 }));
  assert.ok(rider.heading > 0.5 && rider.heading <= MAX_HEADING, `heading ${rider.heading}`);
  ride(hill, rider, 3, () => ({ steer: -1 }));
  assert.ok(Math.abs(rider.heading) <= MAX_HEADING);
  assert.ok(rider.z > 40, 'still going down');
});

test('a jump lifts off and lands again further down', () => {
  const hill = buildHill('meadow');
  const rider = riderAt(hill, hill.center(30), 30, 10);
  const log = ride(hill, rider, 1.6, (r, frame) => ({ jump: frame === 5 }));
  assert.deepEqual(log.map((event) => event.type), ['ollie', 'land']);
  assert.ok(log[1].airTime > 0.5 && log[1].airTime < 1.3, `air time ${log[1].airTime}`);
  assert.ok(log[1].y < log[0].y, 'landed lower than the take-off');
});

test('riding off a ramp flies through the air', () => {
  SCENARIOS.forEach((name) => {
    const hill = buildHill(name);
    const ramp = firstPiece(hill, (piece) => piece.type === 'kicker' && piece.h > 1.4 && piece.cos > 0.9);
    const back = ramp.l / 2 + 6;
    const rider = riderAt(hill, ramp.x - ramp.sin * back, ramp.z - ramp.cos * back, 14);
    const log = ride(hill, rider, 3);
    assert.equal(log[0].type, 'launch', name);
    assert.ok(log[0].y > hill.base(log[0].z) + 1, `${name} launched from the lip`);
    const land = log.find((event) => event.type === 'land');
    assert.ok(land && land.airTime > 0.6, `${name} flew for ${land?.airTime}`);
  });
});

test('jumping onto a rail grinds down it, then drops off the end', () => {
  const hill = buildHill('meadow');
  const piece = firstPiece(hill, (p) => p.type === 'rail' && p.from < 0.7);
  // Line up with the rail from up the hill, then jump just before it.
  const slant = (piece.b[0] - piece.a[0]) / (piece.b[2] - piece.a[2]);
  const rider = riderAt(hill, piece.a[0] - slant * 16, piece.a[2] - 16, 14);
  const log = ride(hill, rider, 4, (r) => ({ jump: r.mode === 'ground' && r.z > piece.a[2] - 4 && r.z < piece.a[2] }));
  assert.deepEqual(log.map((event) => event.type).slice(0, 4), ['ollie', 'grind', 'grindEnd', 'land']);
  assert.ok(Math.abs(log[1].x - (piece.a[0] + slant * (log[1].z - piece.a[2]))) < 0.01, 'on the rail');
  assert.equal(log[1].side, false, 'straight on: a 50-50');
});

test('riding into the side of a block is a fall, and the rider tumbles on past it', () => {
  const hill = buildHill('meadow');
  const table = firstPiece(hill, (piece) => piece.type === 'box' && piece.style === 'deck');
  // Start beside the table and steer into its side wall.
  const side = table.w / 2 + 1.2;
  const rider = riderAt(hill, table.x + table.cos * side - table.sin * 2, table.z - table.sin * side - table.cos * 2, 10);
  const log = ride(hill, rider, 1, () => ({ steer: 1 }));
  assert.ok(log.some((event) => event.type === 'crash'), 'hit the wall');
  assert.equal(rider.mode, 'bail');
  ride(hill, rider, 2.5);
  assert.equal(rider.mode, 'ground');
  assert.ok(rider.z > table.z + table.l / 2, 'carried on down the hill');
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
  const hop = createTricks('bike');
  hop.takeOff();
  hop.land({ airTime: 0.8, spin: 0, from: 'ollie' });
  assert.deepEqual(hop.combo.map((trick) => trick.name), ['Bunny Hop']);
  assert.equal(grindName(false, 'bike'), 'Peg Grind');
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
  assert.equal(fresh.scenario, 'meadow');
  assert.deepEqual(fresh.look, defaultLook());
  const loaded = normalizeSave({
    version: 2, scenario: 'sea', board: 'bike', mode: 'free', control: 'tilt', sound: false,
    look: { hair: 'mohawk', hat: 'tophat', deck: '#2f9bff' },
    best: { sea: 4200, moon: 10, meadow: -5 },
    stars: { sea: 7 },
  });
  assert.equal(loaded.scenario, 'sea');
  assert.equal(loaded.board, 'bike');
  assert.equal(loaded.mode, 'free');
  assert.equal(loaded.control, 'tilt');
  assert.equal(fresh.control, 'buttons');
  assert.equal(normalizeSave({ control: 'mind' }).control, 'buttons');
  assert.equal(loaded.sound, false);
  assert.equal(loaded.look.hair, 'mohawk');
  assert.equal(loaded.look.hat, 'none');
  assert.equal(loaded.look.deck, '#2f9bff');
  assert.deepEqual(loaded.best, { sea: 4200 });
  assert.deepEqual(loaded.stars, { sea: 3 });
  // Scores from the old skate parks don't carry over to the hill.
  const old = normalizeSave({ scenario: 'sea', best: { sea: 9000 }, stars: { sea: 2 }, look: { hair: 'curly' } });
  assert.deepEqual(old.best, {});
  assert.deepEqual(old.stars, {});
  assert.equal(old.look.hair, 'curly');
});

test('stars: two score goals and all the letters', () => {
  assert.equal(starsFor(0, 0, 5), 0);
  assert.equal(starsFor(6000, 5, 5), 2);
  assert.equal(starsFor(25000, 5, 5), 3);
});

test('every hill has a song of one bar of 16 steps', () => {
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
