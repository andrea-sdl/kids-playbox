// Circuits, point placement and saved settings, kept free of Three.js so
// they can be tested.
//
// A circuit is a closed loop through a few control points [x, z, y] in
// meters. It is smoothed into evenly spaced samples, and everything else
// (the road, the scenery, the car's position) is worked out from those.

export const ROAD_WIDTH = 18;
export const SAMPLE_SPACING = 2;

export const SCENARIOS = ['city', 'jungle', 'wasteland'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const CARS = ['comet', 'racer', 'rover'];
// Steering: on-screen buttons, or tilting the phone like a wheel.
export const CONTROLS = ['buttons', 'tilt'];

// Car extras. 'auto' keeps each car's own look (the Racer's wing, the city
// underglow at night).
export const CUSTOM_OPTIONS = {
  finish: ['gloss', 'matte', 'chrome'],
  stripes: ['none', 'single', 'double'],
  stripeColor: ['#ffffff', '#16161c', '#ffd23f', '#e3242b', '#35f2ff', '#2f6bff'],
  decal: ['none', 'swirl', 'tribal', 'flames'],
  decalColor: ['#2f6bff', '#16161c', '#ffffff', '#8b3dff', '#39ff88', '#ff3fa4'],
  rims: ['silver', 'black', 'gold', 'red'],
  wing: ['auto', 'none', 'small', 'big'],
  hood: ['none', 'scoop', 'blower'],
  glow: ['auto', 'off', '#35f2ff', '#2f6bff', '#ff3fa4', '#39ff88', '#ffd23f'],
};

export const PAINTS = ['#e3242b', '#1e6fff', '#ffc21a', '#19c37d', '#8b3dff', '#ff6a00', '#f2f2f2', '#1b1b22', '#c9ced6', '#7dff3a', '#ff4fc8'];

// Ready-made looks in the style of early-2000s street racers: paint plus
// extras. Picking one sets everything; it can still be changed after.
export const PRESETS = [
  {
    id: 'muscle',
    paint: '#1b1b22',
    custom: { finish: 'gloss', stripes: 'none', decal: 'none', rims: 'black', wing: 'none', hood: 'blower', glow: 'off' },
  },
  {
    id: 'silverGt',
    paint: '#c9ced6',
    custom: { finish: 'gloss', stripes: 'double', stripeColor: '#2f6bff', decal: 'swirl', decalColor: '#2f6bff', rims: 'silver', wing: 'big', hood: 'none', glow: '#2f6bff' },
  },
  {
    id: 'limeTuner',
    paint: '#7dff3a',
    custom: { finish: 'gloss', stripes: 'none', decal: 'tribal', decalColor: '#8b3dff', rims: 'silver', wing: 'big', hood: 'scoop', glow: '#39ff88' },
  },
  {
    id: 'orangeRocket',
    paint: '#ff6a00',
    custom: { finish: 'gloss', stripes: 'none', decal: 'tribal', decalColor: '#16161c', rims: 'silver', wing: 'big', hood: 'scoop', glow: 'off' },
  },
  {
    id: 'neonPink',
    paint: '#ff4fc8',
    custom: { finish: 'gloss', stripes: 'single', stripeColor: '#ffffff', decal: 'swirl', decalColor: '#ffffff', rims: 'silver', wing: 'small', hood: 'none', glow: '#ff3fa4' },
  },
];

// A preset's full set of extras: anything it leaves out goes back to the
// first (plain) choice.
export function presetCustom(preset) {
  return Object.fromEntries(Object.entries(CUSTOM_OPTIONS).map(([key, values]) => [key, preset.custom[key] ?? values[0]]));
}

export const CIRCUITS = {
  // A neon city at dusk: long avenues, a hairpin and a chicane.
  city: [
    [0, 0, 0], [200, 0, 0], [300, -60, 2], [400, 0, 4], [420, 140, 4], [330, 230, 2],
    [180, 200, 0], [80, 280, 0], [-60, 300, 3], [-180, 240, 3], [-200, 100, 0], [-120, 20, 0],
  ],
  // Winding jungle roads over hills.
  jungle: [
    [0, 0, 0], [160, -30, 4], [260, 40, 10], [240, 180, 16], [310, 260, 14], [300, 350, 10], [200, 390, 6],
    [60, 330, 2], [-40, 400, 8], [-200, 360, 14], [-260, 220, 10], [-230, 100, 4], [-180, 10, 0], [-90, -25, 0],
  ],
  // A snowy, ruined city first, then long desert straights over dunes.
  wasteland: [
    [0, 0, 0], [220, 0, 0], [300, 80, 2], [260, 200, 4], [120, 240, 2], [60, 360, 0], [120, 480, 6],
    [300, 520, 10], [480, 440, 4], [520, 240, 8], [460, 60, 2], [380, -100, 0], [200, -160, 0], [40, -150, 0], [-30, -80, 0],
  ],
};

// How snowy the wasteland is at a point on the lap (0 to 1): snow in the
// ruined city, sand in the desert, with a short blend between them.
export function snowiness(t) {
  const lap = ((t % 1) + 1) % 1;
  if (lap < 0.36) {
    return 1;
  }
  if (lap < 0.46) {
    return 1 - (lap - 0.36) / 0.1;
  }
  if (lap < 0.9) {
    return 0;
  }
  return (lap - 0.9) / 0.1;
}

/* ---------- Smoothing the circuit ---------- */

function catmullRom(p0, p1, p2, p3, u) {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

function smoothPoint(points, position) {
  const count = points.length;
  const index = Math.floor(position);
  const u = position - index;
  const at = (offset) => points[(index + offset + count) % count];
  return [0, 1, 2].map((axis) => catmullRom(at(-1)[axis], at(0)[axis], at(1)[axis], at(2)[axis], u));
}

// Evenly spaced samples around the loop. Each has a position, the road
// direction (dx, dz), the left-hand side (nx, nz), how much the road turns
// (curve: radians per meter, positive to the left) and its lap fraction t.
export function sampleTrack(points, spacing = SAMPLE_SPACING) {
  const fine = [];
  const steps = points.length * 80;
  for (let i = 0; i < steps; i += 1) {
    fine.push(smoothPoint(points, (i / steps) * points.length));
  }
  const lengths = [0];
  for (let i = 1; i <= steps; i += 1) {
    const a = fine[i - 1];
    const b = fine[i % steps];
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths[steps];
  const count = Math.round(total / spacing);
  const samples = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    const distance = (i / count) * total;
    while (lengths[cursor + 1] < distance) {
      cursor += 1;
    }
    const span = lengths[cursor + 1] - lengths[cursor];
    const u = span > 0 ? (distance - lengths[cursor]) / span : 0;
    const a = fine[cursor];
    const b = fine[(cursor + 1) % steps];
    samples.push({
      x: a[0] + (b[0] - a[0]) * u,
      z: a[1] + (b[1] - a[1]) * u,
      y: a[2] + (b[2] - a[2]) * u,
      t: i / count,
      s: distance,
    });
  }
  samples.forEach((sample, i) => {
    const next = samples[(i + 1) % count];
    const prev = samples[(i - 1 + count) % count];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const length = Math.hypot(dx, dz) || 1;
    sample.dx = dx / length;
    sample.dz = dz / length;
    sample.nx = sample.dz;
    sample.nz = -sample.dx;
  });
  samples.forEach((sample, i) => {
    const next = samples[(i + 1) % count];
    const prev = samples[(i - 1 + count) % count];
    const before = Math.atan2(sample.dz, sample.dx) - Math.atan2(prev.dz, prev.dx);
    const after = Math.atan2(next.dz, next.dx) - Math.atan2(sample.dz, sample.dx);
    const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
    sample.curve = -(wrap(before) + wrap(after)) / (2 * spacing);
  });
  return { samples, length: total };
}

/* ---------- Finding the car on the road ---------- */

// The sample nearest to (x, z), searching around a known index first (the
// car never jumps far between frames).
export function nearestSample(samples, x, z, hint = 0, reach = 30) {
  const count = samples.length;
  let best = hint;
  let bestDistance = Infinity;
  for (let offset = -reach; offset <= reach; offset += 1) {
    const index = (hint + offset + count) % count;
    const sample = samples[index];
    const distance = (sample.x - x) ** 2 + (sample.z - z) ** 2;
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

// Meters to the left (+) or right (−) of the middle of the road.
export function sideOffset(sample, x, z) {
  return (x - sample.x) * sample.nx + (z - sample.z) * sample.nz;
}

// Laps go up when the car crosses the start line going forward.
export function lapChange(previousIndex, index, count) {
  if (previousIndex > count * 0.8 && index < count * 0.2) {
    return 1;
  }
  if (previousIndex < count * 0.2 && index > count * 0.8) {
    return -1;
  }
  return 0;
}

/* ---------- Points to collect ---------- */

const POINT_COUNTS = { easy: 16, medium: 22, hard: 28 };

// Where the points sit is what makes a level harder:
//   easy   – in the middle of the road, just keep driving
//   medium – drifting from side to side, gentle steering
//   hard   – near the edges: the inside of bends and quick zigzags
// Returns [{ index, side }], side from −1 (right edge) to 1 (left edge).
export function placePoints(samples, difficulty) {
  const count = POINT_COUNTS[difficulty];
  const total = samples.length;
  const points = [];
  for (let i = 0; i < count; i += 1) {
    // Leave the start straight empty, so the first point comes after a run-up.
    const index = Math.round(total * (0.05 + (0.93 * i) / count)) % total;
    let side = 0;
    if (difficulty === 'medium') {
      side = 0.5 * Math.sin(i * 1.7);
    }
    if (difficulty === 'hard') {
      const curve = samples[index].curve;
      if (Math.abs(curve) > 0.004) {
        side = 0.82 * Math.sign(curve);
      } else if (i % 2 === 0) {
        side = 0.82;
      } else {
        side = -0.82;
      }
    }
    points.push({ index, side });
  }
  return points;
}

export function pointCount(difficulty) {
  return POINT_COUNTS[difficulty];
}

// Boost pads: about one every BOOST_SPACING meters, each moved to the
// straightest bit of road nearby (boosting into a bend would be no fun),
// in the middle, left or right lane in turn. Returns [{ index, side }].
export const BOOST_SPACING = 220;
const BOOST_SIDES = [0, 0.45, -0.45];

export function placeBoosts(samples) {
  const total = samples.length;
  const length = total * SAMPLE_SPACING;
  const count = Math.max(2, Math.round(length / BOOST_SPACING));
  const reach = Math.round(40 / SAMPLE_SPACING);
  const boosts = [];
  for (let i = 0; i < count; i += 1) {
    // Start a little after the line, like the points.
    const center = Math.round(total * (0.08 + (0.9 * i) / count));
    let best = center;
    for (let offset = -reach; offset <= reach; offset += 1) {
      const index = (center + offset + total) % total;
      if (Math.abs(samples[index].curve) < Math.abs(samples[best % total].curve)) {
        best = index;
      }
    }
    boosts.push({ index: best % total, side: BOOST_SIDES[i % BOOST_SIDES.length] });
  }
  return boosts;
}

// Meters from the middle of the road for a point's side value.
export function sideMeters(side) {
  return side * (ROAD_WIDTH / 2 - 2.2);
}

/* ---------- Times and saved settings ---------- */

export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = String(whole % 60).padStart(2, '0');
  const tenths = Math.floor((Math.max(0, seconds) * 10) % 10);
  return `${minutes}:${rest}.${tenths}`;
}

// Best times are kept per track and level. Built tracks use their id.
export function bestKey(scenario, difficulty, trackId = null) {
  if (trackId) {
    return `track-${trackId}-${difficulty}`;
  }
  return `${scenario}-${difficulty}`;
}

const TRACK_ID = /^t[a-z0-9]{1,20}$/;
const TRACK_BEST = /^track-t[a-z0-9]{1,20}-(easy|medium|hard)$/;

export function normalizeSave(raw) {
  // track: the id of a built track being driven, or null for the scenario's own.
  const custom = Object.fromEntries(Object.entries(CUSTOM_OPTIONS).map(([key, values]) => [key, values[0]]));
  const save = { scenario: 'city', difficulty: 'easy', car: 'comet', paint: PAINTS[0], custom, control: 'buttons', sound: true, music: true, track: null, best: {} };
  if (!raw || typeof raw !== 'object') {
    return save;
  }
  if (SCENARIOS.includes(raw.scenario)) {
    save.scenario = raw.scenario;
  }
  if (DIFFICULTIES.includes(raw.difficulty)) {
    save.difficulty = raw.difficulty;
  }
  if (CARS.includes(raw.car)) {
    save.car = raw.car;
  }
  if (PAINTS.includes(raw.paint)) {
    save.paint = raw.paint;
  }
  if (typeof raw.sound === 'boolean') {
    save.sound = raw.sound;
  }
  if (typeof raw.music === 'boolean') {
    save.music = raw.music;
  }
  if (CONTROLS.includes(raw.control)) {
    save.control = raw.control;
  }
  if (raw.custom && typeof raw.custom === 'object') {
    Object.entries(CUSTOM_OPTIONS).forEach(([key, values]) => {
      if (values.includes(raw.custom[key])) {
        save.custom[key] = raw.custom[key];
      }
    });
  }
  if (typeof raw.track === 'string' && TRACK_ID.test(raw.track)) {
    save.track = raw.track;
  }
  if (raw.best && typeof raw.best === 'object') {
    Object.entries(raw.best).forEach(([key, value]) => {
      const builtIn = SCENARIOS.some((scenario) => DIFFICULTIES.some((difficulty) => key === bestKey(scenario, difficulty)));
      if (!builtIn && !TRACK_BEST.test(key)) {
        return;
      }
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        save.best[key] = value;
      }
    });
  }
  return save;
}
