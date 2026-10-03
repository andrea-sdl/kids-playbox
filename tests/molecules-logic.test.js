import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENTS,
  MOLECULES,
  addBond,
  countElements,
  emptyBuild,
  freeHands,
  isComplete,
  markDone,
  matches,
  normalizeSave,
  parseFormula,
  removeAtom,
  targetBuild,
  unlockedCount,
  weakenBond,
} from '../games/molecules/logic.js';

// A build from a short description: atoms 'C O O', bonds [[0, 1, 2], ...].
function build(elements, bonds) {
  return {
    atoms: elements.split(' ').map((el, id) => ({ id, el, x: 0, y: 0 })),
    bonds: bonds.map(([a, b, order]) => ({ a, b, order })),
  };
}

// The same molecule with its atoms listed in another order and new ids.
function shuffled(molecule) {
  const target = targetBuild(molecule);
  const ids = target.atoms.map((atom, i) => 100 + ((i * 7) % target.atoms.length));
  return {
    atoms: [...target.atoms].reverse().map((atom) => ({ ...atom, id: ids[atom.id] })),
    bonds: target.bonds.map((bond) => ({ a: ids[bond.b], b: ids[bond.a], order: bond.order })),
  };
}

test('every level is a real molecule: all hands hold, all atoms joined', () => {
  MOLECULES.forEach((molecule) => {
    assert.ok(isComplete(targetBuild(molecule)), `${molecule.id} has free hands or loose atoms`);
  });
});

test('every formula matches its atoms, and levels have unique ids', () => {
  MOLECULES.forEach((molecule) => {
    assert.deepEqual(parseFormula(molecule.formula), countElements(targetBuild(molecule).atoms), molecule.id);
    targetBuild(molecule).atoms.forEach((atom) => assert.ok(ELEMENTS[atom.el], `${molecule.id} uses ${atom.el}`));
  });
  assert.equal(new Set(MOLECULES.map((molecule) => molecule.id)).size, MOLECULES.length);
});

test('levels get bigger, starting with two atoms', () => {
  assert.equal(MOLECULES[0].atoms.length, 2);
  MOLECULES.forEach((molecule, i) => {
    if (i > 0) {
      assert.ok(molecule.atoms.length >= MOLECULES[i - 1].atoms.length, `${molecule.id} is smaller than the level before`);
    }
  });
});

test('a molecule matches itself, whatever order its atoms were added in', () => {
  MOLECULES.forEach((molecule) => {
    assert.ok(matches(shuffled(molecule), targetBuild(molecule)), molecule.id);
  });
});

test('benzene matches with its double bonds on either side of the ring', () => {
  const benzene = MOLECULES.find((molecule) => molecule.id === 'benzene');
  const flipped = targetBuild(benzene);
  flipped.bonds = flipped.bonds.map((bond) => {
    if (bond.a < 6 && bond.b < 6) {
      return { ...bond, order: 3 - bond.order };
    }
    return bond;
  });
  assert.ok(matches(flipped, targetBuild(benzene)));
});

test('the same atoms joined differently do not match', () => {
  const peroxide = targetBuild(MOLECULES.find((molecule) => molecule.id === 'hydrogenPeroxide'));
  // H-H and O=O: same atoms, same number of bonds, wrong molecule.
  assert.equal(matches(build('H H O O', [[0, 1, 1], [2, 3, 2]]), peroxide), false);
  const co2 = targetBuild(MOLECULES.find((molecule) => molecule.id === 'carbonDioxide'));
  assert.equal(matches(build('O C O', [[0, 1, 1], [1, 2, 1]]), co2), false);
  assert.equal(matches(build('O C O', [[0, 1, 2], [1, 2, 2]]), co2), true);
});

test('bonds use free hands and stop when hands run out', () => {
  let water = build('O H H', []);
  water = addBond(water, 0, 1);
  water = addBond(water, 0, 2);
  assert.equal(freeHands(water, 0), 0);
  assert.equal(addBond(water, 1, 2), null, 'hydrogens have no hands left');
  assert.ok(isComplete(water));

  let oxygen = build('O O', []);
  oxygen = addBond(addBond(oxygen, 0, 1), 0, 1);
  assert.deepEqual(oxygen.bonds, [{ a: 0, b: 1, order: 2 }]);
  assert.equal(addBond(oxygen, 0, 1), null, 'oxygen has only two hands');
  assert.equal(addBond(emptyBuild(), 0, 0), null);
});

test('weakening a bond steps it down, then breaks it; removing an atom drops its bonds', () => {
  const nitrogen = build('N N', [[0, 1, 3]]);
  assert.deepEqual(weakenBond(nitrogen, 1, 0).bonds, [{ a: 0, b: 1, order: 2 }]);
  assert.deepEqual(weakenBond(build('H H', [[0, 1, 1]]), 0, 1).bonds, []);
  const left = removeAtom(build('O H H', [[0, 1, 1], [0, 2, 1]]), 0);
  assert.deepEqual(left.atoms.map((atom) => atom.id), [1, 2]);
  assert.deepEqual(left.bonds, []);
});

test('loose pieces are not complete, even when every hand holds', () => {
  assert.equal(isComplete(build('H H H H', [[0, 1, 1], [2, 3, 1]])), false);
  assert.equal(isComplete(build('H', [])), false);
  assert.equal(isComplete(emptyBuild()), false);
});

test('levels open one at a time, and hard mode is kept over easy', () => {
  assert.equal(unlockedCount({}), 1);
  assert.equal(unlockedCount({ hydrogen: 'easy' }), 2);
  assert.equal(unlockedCount({ hydrogen: 'easy', nitrogen: 'hard' }), 2);
  const all = Object.fromEntries(MOLECULES.map((molecule) => [molecule.id, 'easy']));
  assert.equal(unlockedCount(all), MOLECULES.length);
  assert.deepEqual(markDone({ water: 'hard' }, 'water', 'easy'), { water: 'hard' });
  assert.deepEqual(markDone({ water: 'easy' }, 'water', 'hard'), { water: 'hard' });
});

test('bad saves fall back safely', () => {
  assert.deepEqual(normalizeSave(null), { mode: 'easy', level: 0, sound: true, done: {} });
  assert.deepEqual(
    normalizeSave({ mode: 'expert', level: 5, sound: 'no', done: { water: 'easy', unobtainium: 'hard', salt: 'yes' } }),
    { mode: 'easy', level: 0, sound: true, done: { water: 'easy' } },
  );
  assert.deepEqual(
    normalizeSave({ mode: 'hard', level: 1, sound: false, done: { hydrogen: 'hard' } }),
    { mode: 'hard', level: 1, sound: false, done: { hydrogen: 'hard' } },
  );
});
