// Molecule rules, kept free of the page so they can be tested.
//
// Every atom has "hands" (its valence): H 1, O 2, N 3, C 4. A bond uses one
// hand on each atom, a double bond two, a triple bond three. A molecule is
// finished when it matches the target exactly: same atoms, joined the same
// way, no matter where they sit on the screen.

export const ELEMENTS = {
  H: { hands: 1, color: '#f4f1ea', ink: '#2b2140', size: 0.8 },
  C: { hands: 4, color: '#3d3a4b', ink: '#ffffff', size: 1 },
  N: { hands: 3, color: '#3f6fe0', ink: '#ffffff', size: 1 },
  O: { hands: 2, color: '#e5453c', ink: '#ffffff', size: 1 },
  Na: { hands: 1, color: '#9b63e0', ink: '#ffffff', size: 1.1 },
  Cl: { hands: 1, color: '#3fb860', ink: '#ffffff', size: 1.1 },
};

// The order atoms appear in the atom tray.
export const ELEMENT_ORDER = ['H', 'C', 'N', 'O', 'Na', 'Cl'];

export const MODES = ['easy', 'hard'];

// The levels, simplest first. Atom x/y only draw the picture (one unit is
// one bond); bonds are [atom, atom, order].
export const MOLECULES = [
  {
    id: 'hydrogen',
    formula: 'H2',
    atoms: [['H', 0, 0], ['H', 1, 0]],
    bonds: [[0, 1, 1]],
  },
  {
    id: 'oxygen',
    formula: 'O2',
    atoms: [['O', 0, 0], ['O', 1.1, 0]],
    bonds: [[0, 1, 2]],
  },
  {
    id: 'nitrogen',
    formula: 'N2',
    atoms: [['N', 0, 0], ['N', 1.2, 0]],
    bonds: [[0, 1, 3]],
  },
  {
    id: 'salt',
    formula: 'NaCl',
    atoms: [['Na', 0, 0], ['Cl', 1.2, 0]],
    bonds: [[0, 1, 1]],
  },
  {
    id: 'water',
    formula: 'H2O',
    atoms: [['O', 0, 0], ['H', -0.8, 0.6], ['H', 0.8, 0.6]],
    bonds: [[0, 1, 1], [0, 2, 1]],
  },
  {
    id: 'carbonDioxide',
    formula: 'CO2',
    atoms: [['O', -1.15, 0], ['C', 0, 0], ['O', 1.15, 0]],
    bonds: [[0, 1, 2], [1, 2, 2]],
  },
  {
    id: 'ammonia',
    formula: 'NH3',
    atoms: [['N', 0, 0], ['H', 0, -1], ['H', -0.87, 0.5], ['H', 0.87, 0.5]],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]],
  },
  {
    id: 'hydrogenPeroxide',
    formula: 'H2O2',
    atoms: [['H', -1.3, 0.6], ['O', -0.55, 0], ['O', 0.55, 0], ['H', 1.3, -0.6]],
    bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 1]],
  },
  {
    id: 'acetylene',
    formula: 'C2H2',
    atoms: [['H', -1.8, 0], ['C', -0.6, 0], ['C', 0.6, 0], ['H', 1.8, 0]],
    bonds: [[0, 1, 1], [1, 2, 3], [2, 3, 1]],
  },
  {
    id: 'methane',
    formula: 'CH4',
    atoms: [['C', 0, 0], ['H', 0, -1], ['H', 1, 0], ['H', 0, 1], ['H', -1, 0]],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]],
  },
  {
    id: 'ethylene',
    formula: 'C2H4',
    atoms: [['C', -0.6, 0], ['C', 0.6, 0], ['H', -1.2, -0.9], ['H', -1.2, 0.9], ['H', 1.2, -0.9], ['H', 1.2, 0.9]],
    bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]],
  },
  {
    id: 'urea',
    formula: 'CH4N2O',
    atoms: [
      ['C', 0, 0], ['O', 0, -1.1], ['N', -0.95, 0.55], ['N', 0.95, 0.55],
      ['H', -1.9, 0.05], ['H', -0.95, 1.6], ['H', 1.9, 0.05], ['H', 0.95, 1.6],
    ],
    bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [2, 4, 1], [2, 5, 1], [3, 6, 1], [3, 7, 1]],
  },
  {
    id: 'aceticAcid',
    formula: 'C2H4O2',
    atoms: [
      ['C', -0.6, 0], ['C', 0.6, 0], ['O', 1.2, -0.9], ['O', 1.2, 0.9], ['H', 2.2, 0.9],
      ['H', -1.6, 0], ['H', -0.6, -1], ['H', -0.6, 1],
    ],
    bonds: [[0, 1, 1], [1, 2, 2], [1, 3, 1], [3, 4, 1], [0, 5, 1], [0, 6, 1], [0, 7, 1]],
  },
  {
    id: 'glycine',
    formula: 'C2H5NO2',
    atoms: [
      ['N', -1, 0], ['C', 0, 0], ['C', 1, 0], ['O', 1, -1.1], ['O', 2, 0], ['H', 3, 0],
      ['H', -2, 0], ['H', -1, 1], ['H', 0, -1], ['H', 0, 1],
    ],
    bonds: [[0, 1, 1], [1, 2, 1], [2, 3, 2], [2, 4, 1], [4, 5, 1], [0, 6, 1], [0, 7, 1], [1, 8, 1], [1, 9, 1]],
  },
  {
    id: 'propane',
    formula: 'C3H8',
    atoms: [
      ['C', -1, 0], ['C', 0, 0], ['C', 1, 0],
      ['H', -2, 0], ['H', -1, -1], ['H', -1, 1], ['H', 0, -1], ['H', 0, 1], ['H', 2, 0], ['H', 1, -1], ['H', 1, 1],
    ],
    bonds: [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1], [1, 6, 1], [1, 7, 1], [2, 8, 1], [2, 9, 1], [2, 10, 1]],
  },
  {
    id: 'benzene',
    formula: 'C6H6',
    atoms: [
      ...[0, 1, 2, 3, 4, 5].map((i) => ['C', Math.cos(Math.PI / 6 + i * Math.PI / 3), Math.sin(Math.PI / 6 + i * Math.PI / 3)]),
      ...[0, 1, 2, 3, 4, 5].map((i) => ['H', 2 * Math.cos(Math.PI / 6 + i * Math.PI / 3), 2 * Math.sin(Math.PI / 6 + i * Math.PI / 3)]),
    ],
    bonds: [
      [0, 1, 2], [1, 2, 1], [2, 3, 2], [3, 4, 1], [4, 5, 2], [5, 0, 1],
      [0, 6, 1], [1, 7, 1], [2, 8, 1], [3, 9, 1], [4, 10, 1], [5, 11, 1],
    ],
  },
];

/* ---------- Building ---------- */

// A build: { atoms: [{ id, el, x, y }], bonds: [{ a, b, order }] }, where a
// and b are atom ids.

export function emptyBuild() {
  return { atoms: [], bonds: [] };
}

// A level's target as a build, so both can be compared the same way.
export function targetBuild(molecule) {
  return {
    atoms: molecule.atoms.map(([el, x, y], id) => ({ id, el, x, y })),
    bonds: molecule.bonds.map(([a, b, order]) => ({ a, b, order })),
  };
}

export function bondBetween(build, a, b) {
  return build.bonds.find((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a)) || null;
}

export function usedHands(build, id) {
  return build.bonds.reduce((sum, bond) => {
    if (bond.a === id || bond.b === id) {
      return sum + bond.order;
    }
    return sum;
  }, 0);
}

export function freeHands(build, id) {
  const atom = build.atoms.find((candidate) => candidate.id === id);
  if (!atom) {
    return 0;
  }
  return ELEMENTS[atom.el].hands - usedHands(build, id);
}

export function canBond(build, a, b) {
  return a !== b && freeHands(build, a) > 0 && freeHands(build, b) > 0;
}

// Join two atoms, or make their bond one step stronger. Returns a new build,
// or null when either atom has no free hand.
export function addBond(build, a, b) {
  if (!canBond(build, a, b)) {
    return null;
  }
  const existing = bondBetween(build, a, b);
  if (existing) {
    return {
      atoms: build.atoms,
      bonds: build.bonds.map((bond) => {
        if (bond === existing) {
          return { ...bond, order: bond.order + 1 };
        }
        return bond;
      }),
    };
  }
  return { atoms: build.atoms, bonds: [...build.bonds, { a, b, order: 1 }] };
}

// Make a bond one step weaker; a single bond comes apart.
export function weakenBond(build, a, b) {
  const existing = bondBetween(build, a, b);
  if (!existing) {
    return build;
  }
  if (existing.order === 1) {
    return { atoms: build.atoms, bonds: build.bonds.filter((bond) => bond !== existing) };
  }
  return {
    atoms: build.atoms,
    bonds: build.bonds.map((bond) => {
      if (bond === existing) {
        return { ...bond, order: bond.order - 1 };
      }
      return bond;
    }),
  };
}

export function removeAtom(build, id) {
  return {
    atoms: build.atoms.filter((atom) => atom.id !== id),
    bonds: build.bonds.filter((bond) => bond.a !== id && bond.b !== id),
  };
}

/* ---------- Checking ---------- */

export function countElements(atoms) {
  const counts = {};
  atoms.forEach((atom) => {
    counts[atom.el] = (counts[atom.el] || 0) + 1;
  });
  return counts;
}

// "C2H4O2" → { C: 2, H: 4, O: 2 }
export function parseFormula(formula) {
  const counts = {};
  const pattern = /([A-Z][a-z]?)(\d*)/g;
  let match = pattern.exec(formula);
  while (match) {
    let count = 1;
    if (match[2]) {
      count = Number(match[2]);
    }
    counts[match[1]] = (counts[match[1]] || 0) + count;
    match = pattern.exec(formula);
  }
  return counts;
}

// Formula parts for display: "H2O" → [['H', '2'], ['O', '']].
export function formulaParts(formula) {
  return [...formula.matchAll(/([A-Z][a-z]?)(\d*)/g)].map((match) => [match[1], match[2]]);
}

function neighbors(build) {
  const map = new Map(build.atoms.map((atom) => [atom.id, new Map()]));
  build.bonds.forEach((bond) => {
    map.get(bond.a).set(bond.b, bond.order);
    map.get(bond.b).set(bond.a, bond.order);
  });
  return map;
}

export function isConnected(build) {
  if (build.atoms.length === 0) {
    return false;
  }
  const links = neighbors(build);
  const seen = new Set([build.atoms[0].id]);
  const queue = [build.atoms[0].id];
  while (queue.length > 0) {
    const id = queue.shift();
    links.get(id).forEach((order, next) => {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  }
  return seen.size === build.atoms.length;
}

// Every atom joined up and every hand holding another.
export function isComplete(build) {
  return isConnected(build) && build.atoms.every((atom) => freeHands(build, atom.id) === 0);
}

function sameCounts(first, second) {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  return [...keys].every((key) => first[key] === second[key]);
}

// True when the build is the target molecule: the same atoms, joined the
// same way with the same kind of bonds. Positions don't matter. Molecules
// here are small, so a straightforward search is quick enough.
export function matches(build, target) {
  if (build.atoms.length !== target.atoms.length || build.bonds.length !== target.bonds.length) {
    return false;
  }
  if (!sameCounts(countElements(build.atoms), countElements(target.atoms))) {
    return false;
  }
  const builtLinks = neighbors(build);
  const targetLinks = neighbors(target);
  const builtElement = new Map(build.atoms.map((atom) => [atom.id, atom.el]));
  const hands = (links, id) => [...links.get(id).values()].reduce((sum, order) => sum + order, 0);

  // Visit target atoms so each one (after the first) has a placed neighbor.
  const order = [];
  const visited = new Set();
  target.atoms.forEach((start) => {
    if (visited.has(start.id)) {
      return;
    }
    visited.add(start.id);
    const queue = [start.id];
    while (queue.length > 0) {
      const id = queue.shift();
      order.push(target.atoms.find((atom) => atom.id === id));
      targetLinks.get(id).forEach((bondOrder, next) => {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      });
    }
  });

  const placed = new Map();
  const used = new Set();

  function fits(targetAtom, builtId) {
    if (used.has(builtId) || builtElement.get(builtId) !== targetAtom.el) {
      return false;
    }
    const targetBonds = targetLinks.get(targetAtom.id);
    const builtBonds = builtLinks.get(builtId);
    if (targetBonds.size !== builtBonds.size || hands(targetLinks, targetAtom.id) !== hands(builtLinks, builtId)) {
      return false;
    }
    for (const [otherTarget, bondOrder] of targetBonds) {
      if (placed.has(otherTarget) && builtBonds.get(placed.get(otherTarget)) !== bondOrder) {
        return false;
      }
    }
    return true;
  }

  function place(index) {
    if (index === order.length) {
      return true;
    }
    const targetAtom = order[index];
    for (const atom of build.atoms) {
      if (!fits(targetAtom, atom.id)) {
        continue;
      }
      placed.set(targetAtom.id, atom.id);
      used.add(atom.id);
      if (place(index + 1)) {
        return true;
      }
      placed.delete(targetAtom.id);
      used.delete(atom.id);
    }
    return false;
  }

  return place(0);
}

/* ---------- Saved progress ---------- */

// done: { [moleculeId]: 'easy' | 'hard' }. Hard beats easy.
export function markDone(done, moleculeId, mode) {
  if (done[moleculeId] === 'hard') {
    return done;
  }
  return { ...done, [moleculeId]: mode };
}

// Levels open one at a time: building one opens the next.
export function unlockedCount(done, molecules = MOLECULES) {
  let count = 1;
  while (count < molecules.length && done[molecules[count - 1].id]) {
    count += 1;
  }
  return count;
}

export function normalizeSave(raw) {
  const save = { mode: 'easy', level: 0, sound: true, done: {} };
  if (!raw || typeof raw !== 'object') {
    return save;
  }
  if (MODES.includes(raw.mode)) {
    save.mode = raw.mode;
  }
  if (typeof raw.sound === 'boolean') {
    save.sound = raw.sound;
  }
  if (raw.done && typeof raw.done === 'object') {
    MOLECULES.forEach((molecule) => {
      if (MODES.includes(raw.done[molecule.id])) {
        save.done[molecule.id] = raw.done[molecule.id];
      }
    });
  }
  if (Number.isInteger(raw.level) && raw.level >= 0 && raw.level < unlockedCount(save.done)) {
    save.level = raw.level;
  }
  return save;
}
