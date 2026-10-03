// Tracks people build from road pieces. Kept free of the page so it can be
// tested.
//
// A track is { id, name, scenario, pieces }, where pieces is a string:
//   S – a straight, 30 m
//   L – a 45° curve to the left
//   R – a 45° curve to the right
// The track starts at (0, 0) heading along +x. Whatever the pieces, the
// end is joined back to the start by a smooth stretch of road (shown dashed
// in the builder), so every track is a loop. A track is drivable when it
// is long enough, never crosses itself and has no bend that's too tight.

import { ROAD_WIDTH, SCENARIOS, sampleTrack } from './world.js';

export const PIECES = ['S', 'L', 'R'];
export const STRAIGHT_LENGTH = 30;
export const CURVE_RADIUS = 50;
export const CURVE_ANGLE = Math.PI / 4;
export const MIN_LENGTH = 300;
export const MAX_PIECES = 4000;
export const NAME_LENGTH = 32;
const CONTROL_SPACING = 10;
const TIGHTEST_RADIUS = 28;

// Points along the pieces, every few meters: [x, z, y]. Also returns where
// the road ends and which way it points (heading: radians, 0 = +x; turning
// left lowers it, matching the road's left side in world.js).
export function piecePath(pieces) {
  let x = 0;
  let z = 0;
  let heading = 0;
  const points = [[0, 0, 0]];
  [...pieces].forEach((piece) => {
    if (piece === 'S') {
      const steps = Math.round(STRAIGHT_LENGTH / CONTROL_SPACING);
      for (let i = 0; i < steps; i += 1) {
        x += Math.cos(heading) * (STRAIGHT_LENGTH / steps);
        z += Math.sin(heading) * (STRAIGHT_LENGTH / steps);
        points.push([x, z, 0]);
      }
      return;
    }
    // Turn around a center point beside the road.
    const side = piece === 'L' ? -1 : 1;
    const centerX = x - Math.sin(heading) * CURVE_RADIUS * side;
    const centerZ = z + Math.cos(heading) * CURVE_RADIUS * side;
    const steps = 4;
    for (let i = 1; i <= steps; i += 1) {
      const turned = heading + side * CURVE_ANGLE * (i / steps);
      points.push([
        centerX + Math.sin(turned) * CURVE_RADIUS * side,
        centerZ - Math.cos(turned) * CURVE_RADIUS * side,
        0,
      ]);
    }
    heading += side * CURVE_ANGLE;
    x = points[points.length - 1][0];
    z = points[points.length - 1][1];
  });
  return { points, end: { x, z, heading } };
}

// The road from the end back to the start: the shortest path made of
// arcs (radius RETURN_RADIUS) and straights that leaves the end going the
// way it points and arrives at the start pointing along +x ("Dubins
// paths"). Its bends are never tighter than that radius, so any track can
// close; it only fails if it runs into the road already built.
const RETURN_RADIUS = 45;
const TAU = Math.PI * 2;

function wrap(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

// The six ways to join two headings with turns (L, R) and a straight (S).
// Each returns the lengths of its three parts (in radians or radii), or
// null if it can't be done. a, b: start and end angles; d: distance.
const WORDS = {
  LSL(a, b, d, sa, sb, ca, cb) {
    const p2 = 2 + d * d - 2 * Math.cos(a - b) + 2 * d * (sa - sb);
    if (p2 < 0) {
      return null;
    }
    const turn = Math.atan2(cb - ca, d + sa - sb);
    return [wrap(-a + turn), Math.sqrt(p2), wrap(b - turn)];
  },
  RSR(a, b, d, sa, sb, ca, cb) {
    const p2 = 2 + d * d - 2 * Math.cos(a - b) + 2 * d * (sb - sa);
    if (p2 < 0) {
      return null;
    }
    const turn = Math.atan2(ca - cb, d - sa + sb);
    return [wrap(a - turn), Math.sqrt(p2), wrap(-b + turn)];
  },
  LSR(a, b, d, sa, sb, ca, cb) {
    const p2 = -2 + d * d + 2 * Math.cos(a - b) + 2 * d * (sa + sb);
    if (p2 < 0) {
      return null;
    }
    const p = Math.sqrt(p2);
    const turn = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p);
    return [wrap(-a + turn), p, wrap(-wrap(b) + turn)];
  },
  RSL(a, b, d, sa, sb, ca, cb) {
    const p2 = d * d - 2 + 2 * Math.cos(a - b) - 2 * d * (sa + sb);
    if (p2 < 0) {
      return null;
    }
    const p = Math.sqrt(p2);
    const turn = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p);
    return [wrap(a - turn), p, wrap(b - turn)];
  },
  RLR(a, b, d, sa, sb, ca, cb) {
    const value = (6 - d * d + 2 * Math.cos(a - b) + 2 * d * (sa - sb)) / 8;
    if (Math.abs(value) > 1) {
      return null;
    }
    const p = wrap(TAU - Math.acos(value));
    const t = wrap(a - Math.atan2(ca - cb, d - sa + sb) + p / 2);
    return [t, p, wrap(a - b - t + p)];
  },
  LRL(a, b, d, sa, sb, ca, cb) {
    const value = (6 - d * d + 2 * Math.cos(a - b) + 2 * d * (-sa + sb)) / 8;
    if (Math.abs(value) > 1) {
      return null;
    }
    const p = wrap(TAU - Math.acos(value));
    const t = wrap(-a - Math.atan2(ca - cb, d + sa - sb) + p / 2);
    return [t, p, wrap(wrap(b) - a - t + p)];
  },
};

export function closingPath(end) {
  if (Math.hypot(end.x, end.z) < 1 && Math.abs(Math.sin(end.heading)) < 0.01 && Math.cos(end.heading) > 0) {
    return [];
  }
  // Work in the usual math orientation (y = -z, angles counterclockwise),
  // where a left turn raises the angle; then map back.
  const fromX = end.x / RETURN_RADIUS;
  const fromY = -end.z / RETURN_RADIUS;
  const fromAngle = -end.heading;
  const dx = -fromX;
  const dy = -fromY;
  const d = Math.hypot(dx, dy);
  const theta = wrap(Math.atan2(dy, dx));
  const a = wrap(fromAngle - theta);
  const b = wrap(0 - theta);
  const args = [a, b, d, Math.sin(a), Math.sin(b), Math.cos(a), Math.cos(b)];
  let best = null;
  Object.entries(WORDS).forEach(([word, solve]) => {
    const parts = solve(...args);
    if (!parts) {
      return;
    }
    const total = parts[0] + parts[1] + parts[2];
    if (!best || total < best.total) {
      best = { word, parts, total };
    }
  });
  // Walk the path, dropping a point every few meters.
  let x = fromX;
  let y = fromY;
  let angle = fromAngle;
  const step = CONTROL_SPACING / RETURN_RADIUS;
  const points = [];
  [...best.word].forEach((kind, i) => {
    const length = best.parts[i];
    const count = Math.max(1, Math.ceil(length / step));
    for (let j = 0; j < count; j += 1) {
      const move = length / count;
      if (kind === 'S') {
        x += Math.cos(angle) * move;
        y += Math.sin(angle) * move;
      } else if (kind === 'L') {
        x += Math.sin(angle + move) - Math.sin(angle);
        y += -Math.cos(angle + move) + Math.cos(angle);
        angle += move;
      } else {
        x += -Math.sin(angle - move) + Math.sin(angle);
        y += Math.cos(angle - move) - Math.cos(angle);
        angle -= move;
      }
      points.push([x * RETURN_RADIUS, -y * RETURN_RADIUS, 0]);
    }
  });
  // The last point is the start itself, already in the track.
  points.pop();
  return points;
}

// All the control points of the loop (pieces, then the way back).
export function trackPoints(pieces) {
  const { points, end } = piecePath(pieces);
  // A shape that already ends on the start would repeat that point.
  if (points.length > 1 && Math.hypot(end.x, end.z) < 1) {
    points.pop();
  }
  return [...points, ...closingPath(end)];
}

export function piecesLength(pieces) {
  return [...pieces].reduce((sum, piece) => sum + (piece === 'S' ? STRAIGHT_LENGTH : CURVE_RADIUS * CURVE_ANGLE), 0);
}

// Is the track drivable? Returns { ok, problem, spot, length }, where
// problem is 'empty', 'short', 'crossing' or 'tight', and spot is where.
export function checkTrack(pieces) {
  if (pieces.length === 0) {
    return { ok: false, problem: 'empty', spot: null, length: 0 };
  }
  const points = trackPoints(pieces);
  if (points.length < 4) {
    return { ok: false, problem: 'short', spot: null, length: piecesLength(pieces) };
  }
  const { samples, length } = sampleTrack(points);
  if (length < MIN_LENGTH) {
    return { ok: false, problem: 'short', spot: null, length };
  }
  const tight = samples.find((sample) => Math.abs(sample.curve) > 1 / TIGHTEST_RADIUS);
  if (tight) {
    return { ok: false, problem: 'tight', spot: { x: tight.x, z: tight.z }, length };
  }
  // Parts of the road far apart along it must be far apart on the ground.
  const count = samples.length;
  const apart = Math.ceil(60 / 2);
  for (let i = 0; i < count; i += 3) {
    for (let j = i + apart; j < count - apart + i; j += 3) {
      const a = samples[i];
      const b = samples[j % count];
      if (Math.hypot(a.x - b.x, a.z - b.z) < ROAD_WIDTH * 1.6) {
        return { ok: false, problem: 'crossing', spot: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, length };
      }
    }
  }
  return { ok: true, problem: null, spot: null, length };
}

/* ---------- Saving and sharing ---------- */

export function cleanName(name, fallback) {
  const text = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_LENGTH);
  return text || fallback;
}

export function normalizeTrack(raw, fallbackName = 'My track') {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  if (typeof raw.pieces !== 'string' || !/^[SLR]*$/.test(raw.pieces) || raw.pieces.length > MAX_PIECES) {
    return null;
  }
  if (!SCENARIOS.includes(raw.scenario)) {
    return null;
  }
  let id = raw.id;
  if (typeof id !== 'string' || !/^t[a-z0-9]{1,20}$/.test(id)) {
    id = newTrackId();
  }
  return { id, name: cleanName(raw.name, fallbackName), scenario: raw.scenario, pieces: raw.pieces };
}

// Saved tracks: valid ones only, each id once.
export function normalizeTracks(list, fallbackName = 'My track') {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  return list.slice(0, 200).map((raw) => normalizeTrack(raw, fallbackName)).filter((track) => {
    if (!track || seen.has(track.id)) {
      return false;
    }
    seen.add(track.id);
    return true;
  });
}

let lastId = 0;

export function newTrackId(now = Date.now()) {
  lastId = Math.max(lastId + 1, now);
  return `t${lastId.toString(36)}`;
}

// A short code to paste anywhere: PBT1|city|SSLRL…|My%20track
export function trackCode(track) {
  return ['PBT1', track.scenario, track.pieces, encodeURIComponent(track.name)].join('|');
}

// A track file is plain JSON.
export function trackFile(track) {
  return `${JSON.stringify({ format: 'playbox-track', version: 1, name: track.name, scenario: track.scenario, pieces: track.pieces }, null, 2)}\n`;
}

// Reads a track from a code or a file's text. Returns a track (with a new
// id) or null.
export function readTrack(text, fallbackName = 'My track') {
  const trimmed = String(text ?? '').trim();
  if (trimmed.startsWith('PBT1|')) {
    const [, scenario, pieces, name = ''] = trimmed.split('|');
    let decoded = '';
    try {
      decoded = decodeURIComponent(name);
    } catch {
      decoded = '';
    }
    return normalizeTrack({ scenario, pieces, name: decoded }, fallbackName);
  }
  try {
    const data = JSON.parse(trimmed);
    if (!data || data.format !== 'playbox-track') {
      return null;
    }
    return normalizeTrack({ scenario: data.scenario, pieces: data.pieces, name: data.name }, fallbackName);
  } catch {
    return null;
  }
}

export function fileName(track) {
  const slug = track.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'track';
  return `${slug}.playbox-track.json`;
}
