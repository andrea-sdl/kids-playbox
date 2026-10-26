// The four parks, the rider's clothes and board, and saved settings, kept
// free of Three.js so they can be tested.
//
// A park is a flat floor inside a rectangle. Some sides end in a quarter
// pipe (a curved wall to ride up and fly out of), the others in a fence.
// Ramps, boxes, stairs and rails sit on the floor. The ground height at any
// point is the highest of all those shapes, which is all the riding needs.

export const SCENARIOS = ['city', 'sea', 'mountain', 'desert'];
export const BOARDS = ['skate', 'snow'];
// A two-minute session with a score to beat, or riding with no clock.
export const MODES = ['session', 'free'];
export const SESSION_SECONDS = 120;

// The floor is 84 × 64 m.
export const HALF_W = 42;
export const HALF_D = 32;
// Quarter pipes: a circle's curve, cut just before it turns straight up.
export const QP_RADIUS = 5;
export const QP_TOP = QP_RADIUS * 0.97;
export const QP_HEIGHT = QP_RADIUS - Math.sqrt(QP_RADIUS ** 2 - QP_TOP ** 2);
// Riding past this far up a quarter pipe sends the rider flying.
export const VERT_D = QP_RADIUS * 0.93;

// The letters to collect in each park, by board.
export const WORDS = { skate: 'SKATE', snow: 'BOARD' };

/* ---------- Clothes and board ---------- */

const SKINS = ['#f6d3b3', '#eabb94', '#c98c62', '#9a623c', '#5e3a22'];
const HAIR_COLORS = ['#2a1b12', '#6b3e1f', '#c98a3c', '#f3d36b', '#d9452b', '#3a7bff', '#ff5fb4', '#f2f2f2'];
const CLOTH_COLORS = ['#e3242b', '#ff7a1a', '#ffd23f', '#3fbf5f', '#2f9bff', '#2440a8', '#8b3dff', '#ff5fb4', '#f2f2f2', '#2a2a33', '#8a5a3a', '#c9b48a', '#7fd8ff'];
const BOARD_COLORS = ['#e3242b', '#ff7a1a', '#ffd23f', '#3fbf5f', '#2f9bff', '#8b3dff', '#ff5fb4', '#f2f2f2', '#2a2a33', '#c8a36a'];
const DETAIL_COLORS = ['#ffffff', '#16161c', '#ffd23f', '#e3242b', '#35f2ff', '#2f9bff', '#ff5fb4', '#3fbf5f'];

// Every choice in the shop. The first value is the default.
// Rider keys come first, then board keys.
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
  // Wheels on a skateboard, bindings on a snowboard.
  wheels: ['#f2f2f2', '#ffd23f', '#e3242b', '#2f9bff', '#3fbf5f', '#ff5fb4', '#16161c'],
};

export const LOOK_OPTIONS = { ...RIDER_OPTIONS, ...BOARD_OPTIONS };

// Ready-made looks: one tap sets everything (and the board type).
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

/* ---------- Park pieces ---------- */

// Every piece sits at (x, z) and faces `yaw`: its length runs along
// (sin yaw, cos yaw), the way a rider goes to use it.
//   kicker – a ramp rising along its length to height h, then a drop
//   box    – a flat-topped block; its top edges can be ground
//   stairs – steps going down along its length, from `top` to the floor
//   rail   – a bar from a to b, [x, y, z] each; only for grinding
function kicker(x, z, yaw, w, l, h) {
  return { type: 'kicker', x, z, yaw, w, l, h };
}

function box(x, z, yaw, w, l, h, grind = true) {
  return { type: 'box', x, z, yaw, w, l, h, grind };
}

function rail(a, b) {
  return { type: 'rail', a, b };
}

function along(x, z, yaw, u, v = 0) {
  return [x + Math.sin(yaw) * u + Math.cos(yaw) * v, z + Math.cos(yaw) * u - Math.sin(yaw) * v];
}

// A box with a ramp up on one end and a ramp down on the other.
function funbox(x, z, yaw, { w, top, h, ramp }) {
  const [ax, az] = along(x, z, yaw, -(top + ramp) / 2);
  const [bx, bz] = along(x, z, yaw, (top + ramp) / 2);
  return [
    kicker(ax, az, yaw, w, ramp, h),
    box(x, z, yaw, w, top, h),
    kicker(bx, bz, yaw + Math.PI, w, ramp, h),
  ];
}

// A ramp up to a platform, then stairs down, with a handrail beside them.
// (x, z) is the top of the stairs.
function stairSet(x, z, yaw, { w, top, deck, run, steps, ramp }) {
  const [px, pz] = along(x, z, yaw, -deck / 2);
  const [sx, sz] = along(x, z, yaw, run / 2);
  const [rx, rz] = along(x, z, yaw, -deck - ramp / 2);
  const side = w / 2 - 0.45;
  const [ax, az] = along(x, z, yaw, 0.1, side);
  const [bx, bz] = along(x, z, yaw, run + 0.6, side);
  const railHeight = 0.8;
  return [
    kicker(rx, rz, yaw, w, ramp, top),
    box(px, pz, yaw, w, deck, top, false),
    { type: 'stairs', x: sx, z: sz, yaw, w, l: run, top, steps },
    rail([ax, top + railHeight, az], [bx, railHeight - (0.6 / run) * top, bz]),
  ];
}

const PI = Math.PI;

// Sides: north is -z, south +z, west -x, east +x.
export const PARKS = {
  // A city plaza: quarter pipes on two sides, the street on the others.
  city: {
    sides: { north: 'qp', west: 'qp', south: 'fence', east: 'fence' },
    start: { x: 0, z: 24, heading: PI },
    pieces: [
      ...funbox(0, 2, PI, { w: 6, top: 6, h: 1, ramp: 3.5 }),
      rail([-14, 0.7, 14], [-14, 0.7, -6]),
      box(14, 6, 0, 1, 14, 0.5),
      kicker(-28, 20, PI, 4, 3.5, 1.3),
      kicker(30, -16, -PI / 2, 4, 3.5, 1.2),
      ...stairSet(-22, -14, PI / 2, { w: 6, top: 1.5, deck: 6, run: 4, steps: 5, ramp: 5 }),
      box(8, 27, PI / 2, 0.7, 3.5, 0.45),
      box(-8, 27, PI / 2, 0.7, 3.5, 0.45),
    ],
    letters: [[0, 3.4, 2], [-14, 2.2, 4], [6, 6, -36.4], [-15, 2.8, -14], [23, 3.2, -16]],
  },
  // A park on a hill above the sea. The sea side has a railing to grind.
  sea: {
    sides: { north: 'qp', west: 'qp', east: 'qp', south: 'fence' },
    start: { x: -30, z: 24, heading: PI / 2 },
    pieces: [
      kicker(-12, 2, 0, 4, 3.5, 1.2),
      kicker(12, 2, 0, 4, 3.5, 1.2),
      ...funbox(0, 14, PI / 2, { w: 5, top: 5, h: 0.9, ramp: 3 }),
      box(-26, -8, 0, 1, 12, 0.55),
      ...stairSet(22, -14, 0, { w: 6, top: 1.5, deck: 6, run: 4, steps: 5, ramp: 5 }),
      box(-24, 22, PI / 2, 0.7, 3.5, 0.45),
      rail([-38, 1, HALF_D], [38, 1, HALF_D]),
    ],
    letters: [[0, 3.2, 14], [46.4, 6, 0], [20, 2.4, 31.6], [22, 2.6, -8], [-12, 3.2, 9]],
  },
  // A snow park in a valley: a big jump, rails, boxes and a log.
  mountain: {
    sides: { north: 'qp', west: 'qp', east: 'qp', south: 'fence' },
    start: { x: 0, z: 24, heading: PI },
    pieces: [
      kicker(0, 6, PI, 6, 5, 1.8),
      kicker(-20, 12, PI, 4, 3.5, 1.2),
      rail([20, 0.8, 18], [20, 0.8, -2]),
      box(-20, -10, PI, 1, 10, 0.6),
      box(10, -20, PI / 2, 0.9, 10, 0.5),
      ...funbox(28, -6, PI, { w: 5, top: 5, h: 1, ramp: 3.5 }),
    ],
    letters: [[0, 4.6, -3], [20, 2, 8], [-46.4, 6, 0], [-20, 2, -10], [28, 3.2, -6]],
  },
  // Sand dunes with stone ruins; an oasis lies beyond the fence.
  desert: {
    sides: { north: 'qp', west: 'qp', south: 'fence', east: 'fence' },
    start: { x: 0, z: 22, heading: PI },
    pieces: [
      kicker(0, 8, PI, 5, 4, 1.4),
      ...stairSet(-20, -6, PI / 2, { w: 6, top: 1.5, deck: 6, run: 4, steps: 5, ramp: 5 }),
      rail([14, 0.7, 18], [14, 0.7, -2]),
      box(28, -10, 0, 1.2, 10, 0.55),
      ...funbox(8, -20, PI / 2, { w: 5, top: 5, h: 0.9, ramp: 3.5 }),
      kicker(-28, 20, PI, 4, 3.5, 1.2),
    ],
    letters: [[0, 4, 0], [14, 2, 8], [-46.4, 6, -8], [-14, 2.8, -6], [8, 3.2, -20]],
  },
};

/* ---------- Ground height ---------- */

function prepare(piece) {
  const prepared = { ...piece, sin: Math.sin(piece.yaw || 0), cos: Math.cos(piece.yaw || 0) };
  if (piece.type !== 'rail') {
    prepared.reach = Math.hypot(piece.w, piece.l) / 2 + 0.01;
  }
  return prepared;
}

// The piece's own coordinates: u along its length, v across it.
function local(piece, x, z) {
  const dx = x - piece.x;
  const dz = z - piece.z;
  return { u: dx * piece.sin + dz * piece.cos, v: dx * piece.cos - dz * piece.sin };
}

export function kickerHeight(h, t) {
  return h * t ** 1.5;
}

// Height and slope (rise per meter along u) of a piece at a point.
function pieceSurface(piece, x, z) {
  if (piece.type === 'rail' || Math.abs(x - piece.x) > piece.reach || Math.abs(z - piece.z) > piece.reach) {
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
  return { h: pieceHeight(piece, x, z), rise: 0 };
}

function pieceHeight(piece, x, z) {
  if (piece.type === 'rail' || Math.abs(x - piece.x) > piece.reach || Math.abs(z - piece.z) > piece.reach) {
    return 0;
  }
  const { u, v } = local(piece, x, z);
  if (Math.abs(u) > piece.l / 2 || Math.abs(v) > piece.w / 2) {
    return 0;
  }
  if (piece.type === 'kicker') {
    return kickerHeight(piece.h, (u + piece.l / 2) / piece.l);
  }
  if (piece.type === 'stairs') {
    const step = Math.min(piece.steps - 1, Math.floor(((u + piece.l / 2) / piece.l) * piece.steps));
    return piece.top * (1 - (step + 1) / piece.steps);
  }
  return piece.h;
}

// Steepness of a quarter pipe (rise per meter outward), capped near the top.
export function qpRise(d) {
  if (d <= 0 || d >= QP_TOP) {
    return 0;
  }
  return Math.min(4.2, d / Math.sqrt(QP_RADIUS ** 2 - d ** 2));
}

// Height of a quarter pipe at `d` meters past the edge of the floor.
export function qpHeight(d) {
  if (d <= 0) {
    return 0;
  }
  if (d >= QP_TOP) {
    return QP_HEIGHT;
  }
  return QP_RADIUS - Math.sqrt(QP_RADIUS ** 2 - d ** 2);
}

const SIDE_INFO = {
  north: { nx: 0, nz: -1, edge: -HALF_D },
  south: { nx: 0, nz: 1, edge: HALF_D },
  west: { nx: -1, nz: 0, edge: -HALF_W },
  east: { nx: 1, nz: 0, edge: HALF_W },
};

// How far past a side's edge a point is (negative inside the floor).
function past(side, x, z) {
  const info = SIDE_INFO[side];
  return (info.nx * x + info.nz * z) - Math.abs(info.edge);
}

// The ready-to-ride park: ground height, slopes, rails and limits.
export function buildPark(name) {
  const spec = PARKS[name];
  const pieces = spec.pieces.map(prepare);
  const solid = pieces.filter((piece) => piece.type !== 'rail');
  const quarterPipes = Object.keys(spec.sides).filter((side) => spec.sides[side] === 'qp');

  // Rails, and the top edges of boxes. Narrow boxes are ground along the
  // middle; wide ones along both long edges.
  const rails = [];
  pieces.forEach((piece) => {
    if (piece.type === 'rail') {
      rails.push(makeRail(piece.a, piece.b, 'rail'));
    }
    if (piece.type === 'box' && piece.grind) {
      const offsets = piece.w <= 1.3 ? [0] : [piece.w / 2 - 0.05, -piece.w / 2 + 0.05];
      offsets.forEach((v) => {
        const [ax, az] = along(piece.x, piece.z, piece.yaw, -piece.l / 2, v);
        const [bx, bz] = along(piece.x, piece.z, piece.yaw, piece.l / 2, v);
        rails.push(makeRail([ax, piece.h, az], [bx, piece.h, bz], 'ledge'));
      });
    }
  });

  // How far the rider may go: up to the top of a quarter pipe, or to the fence.
  const limit = (side) => (spec.sides[side] === 'qp' ? QP_TOP - 0.1 : -0.6);
  const bounds = {
    minX: -HALF_W - limit('west'),
    maxX: HALF_W + limit('east'),
    minZ: -HALF_D - limit('north'),
    maxZ: HALF_D + limit('south'),
  };

  function height(x, z) {
    let h = 0;
    quarterPipes.forEach((side) => {
      h = Math.max(h, qpHeight(past(side, x, z)));
    });
    for (const piece of solid) {
      const value = pieceHeight(piece, x, z);
      if (value > h) {
        h = value;
      }
    }
    return h;
  }

  // Height and slope (gx, gz: rise per meter along x and z). Flat tops and
  // stairs count as flat, so their edges don't tip the rider.
  function surface(x, z) {
    let best = { h: 0, gx: 0, gz: 0 };
    quarterPipes.forEach((side) => {
      const d = past(side, x, z);
      const h = qpHeight(d);
      if (h > best.h) {
        const rise = qpRise(d);
        best = { h, gx: SIDE_INFO[side].nx * rise, gz: SIDE_INFO[side].nz * rise };
      }
    });
    for (const piece of solid) {
      const found = pieceSurface(piece, x, z);
      if (found && found.h > best.h) {
        best = { h: found.h, gx: piece.sin * found.rise, gz: piece.cos * found.rise };
      }
    }
    return best;
  }

  // The quarter pipe the point is on, if any: how far up it, and which way
  // is "out" (toward the wall).
  function quarterPipeAt(x, z) {
    let best = null;
    quarterPipes.forEach((side) => {
      const d = past(side, x, z);
      if (d > 0 && (!best || d > best.d)) {
        best = { side, d, nx: SIDE_INFO[side].nx, nz: SIDE_INFO[side].nz };
      }
    });
    return best;
  }

  return {
    name,
    spec,
    pieces,
    rails,
    bounds,
    quarterPipes,
    height,
    surface,
    quarterPipeAt,
    letters: spec.letters.map(([x, y, z]) => ({ x, y, z })),
    start: { ...spec.start },
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

export function normalizeSave(raw) {
  const save = { scenario: 'city', board: 'skate', mode: 'session', look: defaultLook(), sound: true, music: true, best: {}, stars: {} };
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
    if (!raw[field] || typeof raw[field] !== 'object') {
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
