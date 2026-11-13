// The hill, the rider's clothes and ride, and saved settings, kept free of
// Three.js so they can be tested.
//
// The hill is one long steep slope that always goes down, toward +z. It is
// built as a lap that repeats: after LAP meters the same ground comes again,
// DROP meters lower, so the ride never ends and the join can't be seen. The
// rideable strip follows a winding center line and is HALF_WIDTH wide on
// each side. Jumps, ledges, tables and rails sit on it. The ground height
// at any point is the slope plus the highest piece there, which is all the
// riding needs.

export const SCENARIOS = ['meadow', 'sea', 'mountain', 'desert'];
// What to ride: a skateboard, a snowboard or a bicycle.
export const BOARDS = ['skate', 'snow', 'bike'];
// A two-minute session with a score to beat, or riding with no clock.
export const MODES = ['session', 'free'];
export const SESSION_SECONDS = 120;
// Steering: the two arrow buttons, or tilting the phone.
export const CONTROLS = ['buttons', 'tilt'];

export const LAP = 640;
// How steep the hill is on average: meters down per meter forward.
export const SLOPE = 0.3;
export const DROP = LAP * SLOPE;
export const HALF_WIDTH = 9;
// Nothing to hit this close to the ends of a lap, so laps join cleanly.
const CLEAR_START = 70;
const CLEAR_END = 40;

// The letters to collect on each ride.
export const WORDS = { skate: 'SKATE', snow: 'BOARD', bike: 'RIDER' };

/* ---------- Clothes and board ---------- */

const SKINS = ['#f6d3b3', '#eabb94', '#c98c62', '#9a623c', '#5e3a22'];
const HAIR_COLORS = ['#2a1b12', '#6b3e1f', '#c98a3c', '#f3d36b', '#d9452b', '#3a7bff', '#ff5fb4', '#f2f2f2'];
const CLOTH_COLORS = ['#e3242b', '#ff7a1a', '#ffd23f', '#3fbf5f', '#2f9bff', '#2440a8', '#8b3dff', '#ff5fb4', '#f2f2f2', '#2a2a33', '#8a5a3a', '#c9b48a', '#7fd8ff'];
const BOARD_COLORS = ['#e3242b', '#ff7a1a', '#ffd23f', '#3fbf5f', '#2f9bff', '#8b3dff', '#ff5fb4', '#f2f2f2', '#2a2a33', '#c8a36a'];
const DETAIL_COLORS = ['#ffffff', '#16161c', '#ffd23f', '#e3242b', '#35f2ff', '#2f9bff', '#ff5fb4', '#3fbf5f'];

// Every choice in the shop. The first value is the default.
// Rider keys come first, then the keys for the board or bike.
export const RIDER_OPTIONS = {
  skin: SKINS,
  hair: ['short', 'long', 'ponytail', 'curly', 'mohawk', 'buzz'],
  hairColor: HAIR_COLORS,
  hat: ['none', 'cap', 'backCap', 'beanie', 'helmet'],
  hatColor: ['#e3242b', '#2f9bff', '#ffd23f', '#2a2a33', '#f2f2f2', '#3fbf5f', '#ff5fb4', '#ff7a1a'],
  glasses: ['none', 'shades', 'goggles'],
  top: ['tee', 'hoodie', 'jacket'],
  topColor: CLOTH_COLORS,
  bottom: ['shorts', 'pants', 'baggy'],
  bottomColor: ['#2440a8', '#2a2a33', '#8a5a3a', '#c9b48a', '#3fbf5f', '#e3242b', '#8b3dff', '#f2f2f2', '#7fd8ff'],
  shoes: ['#f2f2f2', '#16161c', '#e3242b', '#2f9bff', '#ffd23f', '#3fbf5f', '#ff5fb4'],
};

export const BOARD_OPTIONS = {
  deck: BOARD_COLORS,
  graphic: ['none', 'stripes', 'flames', 'stars', 'checker', 'bolt', 'wave'],
  graphicColor: DETAIL_COLORS,
  // Wheels on a skateboard or a bike, bindings on a snowboard.
  wheels: ['#f2f2f2', '#ffd23f', '#e3242b', '#2f9bff', '#3fbf5f', '#ff5fb4', '#16161c'],
};

export const LOOK_OPTIONS = { ...RIDER_OPTIONS, ...BOARD_OPTIONS };

// Ready-made looks: one tap sets everything (and what to ride).
export const PRESETS = [
  {
    id: 'street',
    board: 'skate',
    look: { skin: '#eabb94', hair: 'short', hairColor: '#6b3e1f', hat: 'backCap', hatColor: '#e3242b', glasses: 'none', top: 'tee', topColor: '#f2f2f2', bottom: 'pants', bottomColor: '#2440a8', shoes: '#16161c', deck: '#e3242b', graphic: 'flames', graphicColor: '#ffd23f', wheels: '#f2f2f2' },
  },
  {
    id: 'pro',
    board: 'skate',
    look: { skin: '#9a623c', hair: 'curly', hairColor: '#2a1b12', hat: 'helmet', hatColor: '#2a2a33', glasses: 'shades', top: 'jacket', topColor: '#ff7a1a', bottom: 'baggy', bottomColor: '#2a2a33', shoes: '#f2f2f2', deck: '#2a2a33', graphic: 'bolt', graphicColor: '#35f2ff', wheels: '#ffd23f' },
  },
  {
    id: 'shredder',
    board: 'snow',
    look: { skin: '#f6d3b3', hair: 'long', hairColor: '#f3d36b', hat: 'beanie', hatColor: '#3fbf5f', glasses: 'goggles', top: 'jacket', topColor: '#8b3dff', bottom: 'baggy', bottomColor: '#7fd8ff', shoes: '#16161c', deck: '#2f9bff', graphic: 'stars', graphicColor: '#ffffff', wheels: '#ff5fb4' },
  },
  {
    id: 'nomad',
    board: 'snow',
    look: { skin: '#c98c62', hair: 'ponytail', hairColor: '#2a1b12', hat: 'none', hatColor: '#f2f2f2', glasses: 'shades', top: 'hoodie', topColor: '#c9b48a', bottom: 'shorts', bottomColor: '#8a5a3a', shoes: '#e3242b', deck: '#c8a36a', graphic: 'stripes', graphicColor: '#e3242b', wheels: '#16161c' },
  },
  {
    id: 'trail',
    board: 'bike',
    look: { skin: '#eabb94', hair: 'short', hairColor: '#6b3e1f', hat: 'helmet', hatColor: '#f2f2f2', glasses: 'shades', top: 'tee', topColor: '#7fd8ff', bottom: 'shorts', bottomColor: '#2a2a33', shoes: '#16161c', deck: '#3fbf5f', graphic: 'none', graphicColor: '#ffffff', wheels: '#16161c' },
  },
  {
    id: 'anime',
    board: 'skate',
    look: { skin: '#f6d3b3', hair: 'mohawk', hairColor: '#3a7bff', hat: 'none', hatColor: '#f2f2f2', glasses: 'none', top: 'hoodie', topColor: '#ff5fb4', bottom: 'shorts', bottomColor: '#2a2a33', shoes: '#ffd23f', deck: '#f2f2f2', graphic: 'wave', graphicColor: '#2f9bff', wheels: '#ff5fb4' },
  },
];

export function defaultLook() {
  return Object.fromEntries(Object.entries(LOOK_OPTIONS).map(([key, values]) => [key, values[0]]));
}

// A preset's full look: anything it leaves out goes back to the default.
export function presetLook(preset) {
  return { ...defaultLook(), ...preset.look };
}

/* ---------- The hill ---------- */

// Each hill's shape. `rolls` make the slope steeper and gentler along the
// way: [how many per lap, height in meters, where it starts]. `bends` move
// the center line left and right the same way. `seed` picks where the
// pieces go. Whole numbers per lap keep the ends of a lap matching.
export const HILLS = {
  // A green meadow above a bay.
  meadow: { seed: 11, rolls: [[3, 5, 0.4], [7, 1.4, 2.1]], bends: [[1, 9, 0], [3, 4, 1.3]] },
  // A coast road along a cliff.
  sea: { seed: 23, rolls: [[2, 7, 1.2], [5, 2, 0.3]], bends: [[2, 8, 0.6], [5, 2.5, 2]] },
  // A ski run down to a fjord.
  mountain: { seed: 37, rolls: [[4, 4.2, 2.6], [9, 1, 0.9]], bends: [[1, 7, 2.2], [4, 3.5, 0.2]] },
  // A canyon track at sunset.
  desert: { seed: 52, rolls: [[3, 5.5, 3.3], [8, 1.2, 1.5]], bends: [[2, 9, 1.1], [3, 3, 2.9]] },
};

const TURN = (Math.PI * 2) / LAP;

function wave(list, z) {
  let sum = 0;
  for (const [count, size, start] of list) {
    sum += size * Math.sin(TURN * count * z + start);
  }
  return sum;
}

function waveSlope(list, z) {
  let sum = 0;
  for (const [count, size, start] of list) {
    sum += size * TURN * count * Math.cos(TURN * count * z + start);
  }
  return sum;
}

// The same "random" numbers every time, so a hill is always the same.
function dice(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/* ---------- Pieces ---------- */

// Every piece sits `u` meters left of the center line at `z`, and faces
// `yaw`: its length runs along (sin yaw, cos yaw), the way a rider goes to
// use it. Heights are above the slope.
//   kicker – a ramp rising along its length to height h, then a drop
//   box    – a flat-topped block; its top edges can be ground
//   rail   – a bar `l` meters long, `from` high at its start and `to` at
//            its end; only for grinding
function kicker(u, z, w, l, h, yaw = 0) {
  return { type: 'kicker', u, z, yaw, w, l, h };
}

function box(u, z, w, l, h, style = 'box') {
  return { type: 'box', u, z, yaw: 0, w, l, h, style };
}

function rail(u, z, l, from, to = from) {
  return { type: 'rail', u, z, l, from, to };
}

// A low block with a little ramp onto it, so rolling straight at it rides
// up on top instead of crashing.
function ledge(u, z, w, l, h, style) {
  return [kicker(u, z + 1.25, w + 0.4, 2.5, h), box(u, z + 2.5 + l / 2, w, l, h, style)];
}

// Things to trick on. Each takes where it starts, how far off center, and
// the dice, and gives its pieces, how long it is, how much clear ground it
// needs after it, and where a letter could float.
export const FEATURES = {
  jump: (z, u, roll) => {
    const h = 1.5 + roll() * 0.6;
    return { pieces: [kicker(u, z + 3, 5, 6, h)], length: 6, after: 16, letter: [u, 3, z + 14], reach: 2.5 };
  },
  twin: (z, u) => ({
    pieces: [kicker(u - 3.5, z + 2.5, 4, 5, 1.2), kicker(u + 3.5, z + 3, 4, 6, 2.1)],
    length: 6, after: 18, letter: [u + 3.5, 3.4, z + 16], reach: 5.5,
  }),
  rail: (z, u) => ({ pieces: [rail(u, z, 24, 0.6, 0.5)], length: 24, after: 0, letter: [u, 1.9, z + 12], reach: 0.5 }),
  jumpRail: (z, u) => ({
    pieces: [kicker(u, z + 2.5, 4, 5, 1.2), rail(u, z + 10, 24, 1.3, 0.7)],
    length: 34, after: 0, letter: [u, 2.5, z + 20], reach: 2,
  }),
  ledge: (z, u) => ({ pieces: ledge(u, z, 1.2, 14, 0.5, 'box'), length: 16.5, after: 0, letter: [u, 1.9, z + 10], reach: 0.8 }),
  log: (z, u) => ({ pieces: ledge(u, z, 0.8, 10, 0.45, 'log'), length: 12.5, after: 0, letter: [u, 1.8, z + 8], reach: 0.6 }),
  table: (z, u) => ({
    pieces: [kicker(u, z + 2.5, 6, 5, 1.3), box(u, z + 8.5, 6, 7, 1.3, 'deck'), kicker(u, z + 14.5, 6, 5, 1.3, Math.PI)],
    length: 17, after: 4, letter: [u, 3.3, z + 8.5], reach: 3,
  }),
  benches: (z, u) => ({
    pieces: [...ledge(u - 4, z, 0.8, 5, 0.45, 'bench'), ...ledge(u, z + 10, 0.8, 5, 0.45, 'bench'), ...ledge(u + 4, z + 20, 0.8, 5, 0.45, 'bench')],
    length: 27.5, after: 0, letter: [u, 1.8, z + 14], reach: 4.6,
  }),
};

const DECK = ['jump', 'rail', 'ledge', 'table', 'jumpRail', 'twin', 'log', 'benches', 'jump', 'rail'];

// Lays features down a lap, one after another with room between them.
function layout(seed) {
  const roll = dice(seed);
  const order = [...DECK];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(roll() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const pieces = [];
  const spots = [];
  let z = CLEAR_START;
  for (let i = 0; ; i += 1) {
    const feature = FEATURES[order[i % order.length]];
    // Far enough from the edges that the whole thing fits on the strip.
    const probe = feature(0, 0, () => 0);
    const room = HALF_WIDTH - 1.5 - probe.reach;
    const u = (roll() * 2 - 1) * room;
    const made = feature(z, u, roll);
    if (z + made.length + made.after > LAP - CLEAR_END) {
      break;
    }
    // Remember where the feature starts, to turn it along the strip later.
    const frame = { z, u, length: made.length };
    pieces.push(...made.pieces.map((piece) => ({ ...piece, frame })));
    spots.push({ at: made.letter, frame });
    z += made.length + made.after + 24 + roll() * 12;
  }
  return { pieces, spots };
}

/* ---------- Ground height ---------- */

// The piece's own coordinates: u along its length, v across it.
function local(piece, x, z) {
  const dx = x - piece.x;
  const dz = z - piece.z;
  return { u: dx * piece.sin + dz * piece.cos, v: dx * piece.cos - dz * piece.sin };
}

export function kickerHeight(h, t) {
  return h * t ** 1.5;
}

// Height above the slope and steepness (rise per meter along its length)
// of a piece at a point, or null off the piece.
function pieceSurface(piece, x, z) {
  if (Math.abs(x - piece.x) > piece.reach || Math.abs(z - piece.z) > piece.reach) {
    return null;
  }
  const { u, v } = local(piece, x, z);
  if (Math.abs(u) > piece.l / 2 || Math.abs(v) > piece.w / 2) {
    return null;
  }
  if (piece.type === 'kicker') {
    const t = (u + piece.l / 2) / piece.l;
    return { h: kickerHeight(piece.h, t), rise: (1.5 * piece.h * Math.sqrt(t)) / piece.l };
  }
  return { h: piece.h, rise: 0 };
}

const CELL = 20;

// The ready-to-ride hill: ground height, slopes, rails and edges. Every z
// works, however far down: the lap just repeats.
export function buildHill(name) {
  const spec = HILLS[name];
  const base = (z) => -SLOPE * z + wave(spec.rolls, z);
  const baseSlope = (z) => -SLOPE + waveSlope(spec.rolls, z);
  const center = (z) => wave(spec.bends, z);
  // The heading that follows the strip's bends at z.
  const direction = (z) => Math.atan(waveSlope(spec.bends, z));
  const made = layout(spec.seed);

  // A feature is laid out straight, then turned to point the way the
  // strip runs there, so a rider following the bends stays lined up with
  // it. This gives the world place of a point of a feature.
  function turned(frame, u, z) {
    const yaw = direction(frame.z + frame.length / 2);
    const across = u - frame.u;
    const along = z - frame.z;
    return {
      yaw,
      x: center(frame.z) + frame.u + across * Math.cos(yaw) + along * Math.sin(yaw),
      z: frame.z + along * Math.cos(yaw) - across * Math.sin(yaw),
    };
  }

  // Pieces get their place on the first lap.
  const pieces = made.pieces.map((piece) => {
    if (piece.type === 'rail') {
      const a = turned(piece.frame, piece.u, piece.z);
      const b = turned(piece.frame, piece.u, piece.z + piece.l);
      return { ...piece, a: [a.x, base(a.z) + piece.from, a.z], b: [b.x, base(b.z) + piece.to, b.z] };
    }
    const at = turned(piece.frame, piece.u, piece.z);
    const yaw = piece.yaw + at.yaw;
    return {
      ...piece,
      x: at.x,
      z: at.z,
      yaw,
      sin: Math.sin(yaw),
      cos: Math.cos(yaw),
      reach: Math.hypot(piece.w, piece.l) / 2 + 0.01,
    };
  });
  const solid = pieces.filter((piece) => piece.type !== 'rail');
  const cells = Array.from({ length: Math.ceil(LAP / CELL) }, () => []);
  solid.forEach((piece) => {
    const from = Math.max(0, Math.floor((piece.z - piece.reach) / CELL));
    const to = Math.min(cells.length - 1, Math.floor((piece.z + piece.reach) / CELL));
    for (let i = from; i <= to; i += 1) {
      cells[i].push(piece);
    }
  });

  // Rails, and the top edges of boxes. Narrow boxes are ground along the
  // middle; wide ones along both long edges.
  const rails = [];
  pieces.forEach((piece) => {
    if (piece.type === 'rail') {
      rails.push(makeRail(piece.a, piece.b, 'rail'));
    }
    if (piece.type === 'box') {
      const offsets = piece.w <= 1.3 ? [0] : [piece.w / 2 - 0.05, -piece.w / 2 + 0.05];
      offsets.forEach((v) => {
        const [from, to] = [-piece.l / 2, piece.l / 2].map((u) => {
          const x = piece.x + piece.sin * u + piece.cos * v;
          const z = piece.z + piece.cos * u - piece.sin * v;
          return [x, base(z) + piece.h, z];
        });
        rails.push(makeRail(from, to, 'ledge'));
      });
    }
  });

  // The best piece under a point of the first lap.
  function pieceAt(x, z) {
    let best = null;
    let on = null;
    for (const piece of cells[Math.min(cells.length - 1, Math.floor(z / CELL))]) {
      const found = pieceSurface(piece, x, z);
      if (found && (!best || found.h > best.h)) {
        best = found;
        on = piece;
      }
    }
    return best ? { ...best, piece: on } : null;
  }

  function lapOf(z) {
    return Math.floor(z / LAP);
  }

  function height(x, z) {
    const lap = lapOf(z);
    const within = z - lap * LAP;
    return base(within) - lap * DROP + (pieceAt(x, within)?.h || 0);
  }

  // Height and slope (gx, gz: rise per meter along x and z).
  function surface(x, z) {
    const lap = lapOf(z);
    const within = z - lap * LAP;
    const found = pieceAt(x, within);
    const slope = baseSlope(within);
    if (!found) {
      return { h: base(within) - lap * DROP, gx: 0, gz: slope };
    }
    return {
      h: base(within) - lap * DROP + found.h,
      gx: found.piece.sin * found.rise,
      gz: slope + found.piece.cos * found.rise,
    };
  }

  // How far left and right the rider may go at z.
  function edges(z) {
    const middle = center(z);
    return { min: middle - HALF_WIDTH, max: middle + HALF_WIDTH };
  }

  // The rails of the lap that z is on, in world coordinates.
  const shifted = new Map();
  function railsAt(z) {
    const lap = lapOf(z);
    if (lap === 0) {
      return rails;
    }
    if (!shifted.has(lap)) {
      if (shifted.size > 3) {
        shifted.clear();
      }
      shifted.set(lap, rails.map((rail) => ({
        ...rail,
        ay: rail.ay - lap * DROP, by: rail.by - lap * DROP,
        az: rail.az + lap * LAP, bz: rail.bz + lap * LAP,
      })));
    }
    return shifted.get(lap);
  }

  // Five letters, spread down the lap.
  const letters = Array.from({ length: 5 }, (unused, i) => {
    const spot = made.spots[Math.round((i * (made.spots.length - 1)) / 4)];
    const [u, up, z] = spot.at;
    const at = turned(spot.frame, u, z);
    return { x: at.x, y: base(at.z) + up, z: at.z };
  });

  const startZ = 24;
  return {
    name,
    spec,
    pieces,
    rails,
    base,
    baseSlope,
    center,
    direction,
    height,
    surface,
    edges,
    railsAt,
    lapOf,
    letters,
    start: { x: center(startZ), z: startZ, heading: 0 },
  };
}

function makeRail(a, b, kind) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dy, dz);
  const flat = Math.hypot(dx, dz);
  return {
    kind,
    ax: a[0], ay: a[1], az: a[2],
    bx: b[0], by: b[1], bz: b[2],
    length,
    flat,
    dx: dx / length, dy: dy / length, dz: dz / length,
  };
}

/* ---------- Scores and saved settings ---------- */

// Stars for a session: a good score, a great score, and every letter.
export const SCORE_GOALS = [5000, 20000];

export function starsFor(score, letters, total) {
  return SCORE_GOALS.filter((goal) => score >= goal).length + (letters >= total ? 1 : 0);
}

export function formatClock(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// Scores from before the hill (version 1) were for another game.
const SAVE_VERSION = 2;

export function normalizeSave(raw) {
  const save = { version: SAVE_VERSION, scenario: 'meadow', board: 'skate', mode: 'session', control: 'buttons', look: defaultLook(), sound: true, music: true, best: {}, stars: {} };
  if (!raw || typeof raw !== 'object') {
    return save;
  }
  if (SCENARIOS.includes(raw.scenario)) {
    save.scenario = raw.scenario;
  }
  if (BOARDS.includes(raw.board)) {
    save.board = raw.board;
  }
  if (MODES.includes(raw.mode)) {
    save.mode = raw.mode;
  }
  if (CONTROLS.includes(raw.control)) {
    save.control = raw.control;
  }
  if (typeof raw.sound === 'boolean') {
    save.sound = raw.sound;
  }
  if (typeof raw.music === 'boolean') {
    save.music = raw.music;
  }
  if (raw.look && typeof raw.look === 'object') {
    Object.entries(LOOK_OPTIONS).forEach(([key, values]) => {
      if (values.includes(raw.look[key])) {
        save.look[key] = raw.look[key];
      }
    });
  }
  ['best', 'stars'].forEach((field) => {
    if (raw.version !== SAVE_VERSION || !raw[field] || typeof raw[field] !== 'object') {
      return;
    }
    SCENARIOS.forEach((scenario) => {
      const value = raw[field][scenario];
      if (Number.isInteger(value) && value > 0) {
        save[field][scenario] = field === 'stars' ? Math.min(3, value) : value;
      }
    });
  });
  return save;
}
