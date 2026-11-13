// The three cars, modeled after the design sheets in art-src/drive-refs.
// Each body is lofted: a row of cross-sections from tail to nose (how high
// the floor, the shoulder and the top are, and how wide it is), joined
// into one smooth skin. Fenders swell over the wheels, and the wheel
// arches are cut into the skin, so the tires sit inside the body. The
// cabin is a second loft with its glass set between painted pillars.
// Everything else (splitter, skirts, diffuser, lights, vents, wings, the
// buggy's cage, rack, bull bar and suspension) is built from small parts
// joined per material, so a car costs only a few draw calls. Clear-coat
// paint and glass reflect the sky, and lights are brighter than white, so
// they glow. At night real headlights shine on the road.
//
// Every car faces +z, sits on y = 0 and is about 4.7 m long.

import * as THREE from '../../vendor/three/three.min.js';
import { decalTexture, headlightTexture, softDotTexture } from './textures.js';

// hull: cross-sections from tail to nose, [z, floor, shoulder, top, half
// width]. cabin: [z, roof, half width at its base, half width at the roof].
// glass: where the windshield ends and the rear window starts, and where
// the pillars between side windows are. fenders: swellings over the wheels.
const DESIGNS = {
  // A low, wide, wedge-shaped mid-engine hypercar.
  comet: {
    hull: [
      [-2.25, 0.38, 0.8, 0.84, 0.9], [-2.1, 0.25, 0.86, 0.92, 0.98], [-1.4, 0.2, 0.86, 0.96, 1.01], [-0.5, 0.19, 0.82, 0.97, 0.99],
      [0.4, 0.19, 0.74, 0.8, 0.96], [1.0, 0.19, 0.66, 0.7, 0.93], [1.5, 0.19, 0.58, 0.6, 0.9], [2.1, 0.21, 0.44, 0.45, 0.76], [2.45, 0.27, 0.34, 0.35, 0.5],
    ],
    cabin: [[-1.25, 0.98, 0.62, 0.46], [-0.75, 1.08, 0.7, 0.54], [-0.3, 1.13, 0.73, 0.56], [0.2, 1.1, 0.73, 0.55], [0.75, 0.93, 0.68, 0.5], [1.12, 0.74, 0.58, 0.46]],
    glass: { front: 0.2, back: -0.75, pillars: [-0.3], rear: false },
    intakes: [{ from: -0.98, to: -0.42, low: 0.4, high: 0.74, slant: -0.55, depth: 0.09 }],
    fenders: [{ z: 1.4, lift: 0.14, bulge: 0.03, reach: 0.48 }, { z: -1.4, lift: 0.02, bulge: 0.03, reach: 0.6 }],
    wheel: 0.345, tire: 0.3, wheelBase: 1.4, ride: 0, wing: false, underglow: '#35f2ff',
  },
  // A front-engine grand tourer race car: long hood, cabin set back, wide
  // fenders, a splitter, side exhausts and a big wing.
  racer: {
    hull: [
      [-2.4, 0.42, 0.84, 0.9, 0.84], [-2.2, 0.27, 0.9, 0.98, 0.95], [-1.45, 0.21, 0.88, 1.0, 0.98], [-0.6, 0.2, 0.82, 0.92, 0.95],
      [0.4, 0.2, 0.8, 0.88, 0.94], [1.45, 0.2, 0.76, 0.86, 0.95], [2.1, 0.23, 0.66, 0.74, 0.88], [2.45, 0.32, 0.52, 0.58, 0.68],
    ],
    cabin: [[-1.95, 0.98, 0.52, 0.36], [-1.5, 1.07, 0.64, 0.46], [-0.9, 1.2, 0.72, 0.54], [-0.4, 1.21, 0.73, 0.55], [0.1, 1.08, 0.7, 0.52], [0.55, 0.87, 0.62, 0.48]],
    glass: { front: -0.4, back: -0.9, pillars: [-0.66], rear: true },
    fenders: [{ z: 1.45, lift: 0.06, bulge: 0.05, reach: 0.55 }, { z: -1.45, lift: 0.07, bulge: 0.07, reach: 0.6 }],
    wheel: 0.365, tire: 0.32, wheelBase: 1.45, ride: 0, wing: true, underglow: '#ff3fa4',
  },
  // A tall off-road buggy: huge knobby tires outside the body, long
  // suspension, a roll cage, a roof rack with a light bar, a bull bar and
  // a spare wheel on the back.
  rover: {
    hull: [
      [-1.95, 0.8, 1.2, 1.24, 0.7], [-1.7, 0.68, 1.28, 1.32, 0.78], [-0.9, 0.64, 1.3, 1.34, 0.82], [0.6, 0.64, 1.28, 1.34, 0.82],
      [1.3, 0.66, 1.2, 1.3, 0.8], [1.9, 0.72, 1.08, 1.16, 0.74], [2.1, 0.82, 0.98, 1.02, 0.64],
    ],
    cabin: [[-1.3, 1.36, 0.7, 0.6], [-1.0, 1.78, 0.75, 0.67], [-0.75, 1.86, 0.77, 0.69], [0.1, 1.86, 0.77, 0.69], [0.55, 1.8, 0.77, 0.69], [0.98, 1.34, 0.75, 0.69]],
    glass: { front: 0.5, back: -0.85, pillars: [-0.15], rear: true },
    fenders: [],
    wheel: 0.56, tire: 0.42, wheelBase: 1.42, track: 1.13, ride: 0, wing: false, buggy: true, underglow: '#ffd23f',
  },
};

function smooth(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// A smooth curve through rows of numbers, read at any z (the first number
// of each row). Rows must be in order of z.
function sampler(keys) {
  const last = keys.length - 1;
  return (z) => {
    const at = Math.min(keys[last][0], Math.max(keys[0][0], z));
    let i = 0;
    while (i < last - 1 && at > keys[i + 1][0]) {
      i += 1;
    }
    const a = keys[Math.max(0, i - 1)];
    const b = keys[i];
    const c = keys[i + 1];
    const d = keys[Math.min(last, i + 2)];
    const span = c[0] - b[0];
    const t = (at - b[0]) / span;
    const t2 = t * t;
    const t3 = t2 * t;
    return b.map((value, k) => {
      if (k === 0) {
        return at;
      }
      const in1 = ((c[k] - a[k]) / (c[0] - a[0])) * span;
      const in2 = ((d[k] - b[k]) / (d[0] - b[0])) * span;
      return (2 * t3 - 3 * t2 + 1) * value + (t3 - 2 * t2 + t) * in1 + (-2 * t3 + 3 * t2) * c[k] + (t3 - t2) * in2;
    });
  };
}

// The body's measures at any z: its sections, plus the fenders.
function hullAt(spec) {
  const sample = sampler(spec.hull);
  return (z) => {
    const [, floor, belt, top, half] = sample(z);
    let lift = 0;
    let bulge = 0;
    spec.fenders.forEach((fender) => {
      const near = Math.exp(-(((z - fender.z) / fender.reach) ** 2));
      lift += fender.lift * near;
      bulge += fender.bulge * near;
    });
    return { floor, belt: belt + lift, top, half: half + bulge, humped: lift > 0.012 };
  };
}

// How round the shoulder (where the side meets the top) is.
function shoulderOf(section) {
  return Math.min(0.09, (section.belt - section.floor) * 0.28);
}

// How far out the side of the body is at a height.
function sideOf(section, y) {
  const sill = section.half * 0.92;
  const s = Math.min(1, Math.max(0, (y - section.floor) / (section.belt - shoulderOf(section) - section.floor)));
  return sill + (section.half - sill) * smooth(0, 0.5, s);
}

// How high the top of the body is, `x` meters from the middle.
function deckOf(section, x) {
  const reach = section.half - shoulderOf(section);
  if (Math.abs(x) >= reach) {
    return section.belt;
  }
  const t = 1 - Math.abs(x) / reach;
  if (section.humped || section.belt > section.top) {
    return section.top + (section.belt - section.top) * (1 - smooth(0, 0.5, t));
  }
  return section.belt + (section.top - section.belt) * (1 - (1 - t) * (1 - t));
}

// The points of one half of a cross-section, from the middle of the floor
// out, up the side, around the shoulder and across the top to the middle.
const FLOOR_STEPS = 5;
const SIDE_STEPS = 18;
const SHOULDER_STEPS = 5;
const DECK_STEPS = 14;

function halfSection(section) {
  const { floor, belt, top, half } = section;
  const sill = half * 0.92;
  const r = shoulderOf(section);
  const points = [];
  for (let i = 0; i <= FLOOR_STEPS; i += 1) {
    points.push({ x: (sill * i) / FLOOR_STEPS, y: floor, kind: 'floor', shade: true });
  }
  for (let i = 1; i <= SIDE_STEPS; i += 1) {
    const s = i / SIDE_STEPS;
    // The lowest band of the side is a dark sill, as on the design sheets.
    points.push({ x: sill + (half - sill) * smooth(0, 0.5, s), y: floor + (belt - r - floor) * s, kind: 'side', shade: i <= 2 });
  }
  for (let i = 1; i <= SHOULDER_STEPS; i += 1) {
    const angle = (i / SHOULDER_STEPS) * (Math.PI / 2);
    points.push({ x: half - r + r * Math.cos(angle), y: belt - r + r * Math.sin(angle), kind: 'shoulder' });
  }
  for (let i = 1; i <= DECK_STEPS; i += 1) {
    const t = i / DECK_STEPS;
    // A fender stands up as a hump beside a lower hood; elsewhere the top
    // is a gentle dome.
    let y = belt + (top - belt) * (1 - (1 - t) * (1 - t));
    if (section.humped || belt > top) {
      y = top + (belt - top) * (1 - smooth(0, 0.5, t));
    }
    points.push({ x: (half - r) * (1 - t), y, kind: 'deck' });
  }
  return points;
}

// Triangles (not indexed) from a grid of points: rows[r][c] = { x, y, z,
// shade }. `closed` joins the last column back to the first. `keep(r, c)`
// can leave squares out. Gives positions, a paint UV across the car, and a
// color per corner (white, or dark where `shade` is set).
function skin(rows, width, { closed = false, keep = () => true } = {}) {
  const positions = [];
  const uvs = [];
  const colors = [];
  const columns = rows[0].length;
  const put = (p) => {
    positions.push(p.x, p.y, p.z);
    uvs.push(p.x / width + 0.5, 0.5);
    const light = p.shade ? 0.02 : 1;
    colors.push(light, light, light);
  };
  for (let r = 0; r < rows.length - 1; r += 1) {
    for (let c = 0; c < (closed ? columns : columns - 1); c += 1) {
      if (!keep(r, c)) {
        continue;
      }
      const next = (c + 1) % columns;
      const a = rows[r][c];
      const b = rows[r + 1][c];
      const d = rows[r][next];
      const e = rows[r + 1][next];
      [a, d, b, b, d, e].forEach(put);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// A flat lid over the end of a loft.
function cap(ring, width) {
  const center = { x: 0, y: ring.reduce((sum, p) => sum + p.y, 0) / ring.length, z: ring[0].z };
  return skin([ring, ring.map(() => center)], width, { closed: true });
}

const HULL_STATIONS = 116;

// The body: its skin, with the wheel arches cut in. `arches` are
// [{ z, y, radius, inner }]: inside the circle the skin is pushed in to
// `inner` and painted dark, and the skin's points near the circle are
// moved onto it, so the edge of the arch is clean.
function buildHull(spec, arches) {
  const at = hullAt(spec);
  const back = spec.hull[0][0];
  const front = spec.hull[spec.hull.length - 1][0];
  const rows = [];
  for (let s = 0; s <= HULL_STATIONS; s += 1) {
    const z = back + ((front - back) * s) / HULL_STATIONS;
    const half = halfSection(at(z));
    const ring = [...half, ...half.slice(1, -1).reverse().map((p) => ({ ...p, x: -p.x }))].map((p) => ({ ...p, z }));
    ring.forEach((p) => {
      if (p.kind !== 'side' && p.kind !== 'floor') {
        return;
      }
      // Intakes: slanted openings pushed into the side, dark inside.
      (spec.intakes || []).forEach((intake) => {
        const slid = p.z - intake.slant * (p.y - intake.low);
        if (p.kind === 'side' && p.y > intake.low && p.y < intake.high && slid > intake.from && slid < intake.to) {
          p.x -= Math.sign(p.x) * intake.depth;
          p.shade = true;
        }
      });
      arches.forEach((arch) => {
        const dz = p.z - arch.z;
        const dy = p.y - arch.y;
        const distance = Math.hypot(dz, dy);
        if (p.kind === 'side' && Math.abs(distance - arch.radius) < 0.032 && Math.abs(p.x) > arch.inner) {
          p.z = arch.z + (dz / distance) * arch.radius;
          p.y = arch.y + (dy / distance) * arch.radius;
        } else if (distance < arch.radius && Math.abs(p.x) > arch.inner) {
          p.x = Math.sign(p.x) * arch.inner;
          p.shade = true;
        }
      });
    });
    rows.push(ring);
  }
  const parts = [skin(rows, spec.width, { closed: true }), cap(rows[0].slice().reverse(), spec.width), cap(rows[rows.length - 1], spec.width)];
  const geometry = THREE.mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return { geometry, at, back, front, sideX: (z, y) => sideOf(at(z), y) };
}

const CABIN_STATIONS = 46;
const CABIN_SIDE = 8;
const CABIN_CORNER = 4;
const CABIN_ROOF = 8;

// The cabin: a painted frame (pillars, roof, sills) and the glass in it.
function buildCabin(spec, hull) {
  const sample = sampler(spec.cabin);
  const back = spec.cabin[0][0];
  const front = spec.cabin[spec.cabin.length - 1][0];
  const rows = [];
  const tall = [];
  for (let s = 0; s <= CABIN_STATIONS; s += 1) {
    const z = back + ((front - back) * s) / CABIN_STATIONS;
    const [, roof, halfBase, halfRoof] = sample(z);
    const base = Math.min(hull.at(z).belt - 0.05, roof - 0.02);
    const corner = Math.min(0.09, (roof - base) * 0.4);
    const half = [];
    for (let i = 0; i <= CABIN_SIDE; i += 1) {
      const t = i / CABIN_SIDE;
      half.push({ x: halfBase + (halfRoof - halfBase) * t, y: base + (roof - corner - base) * t });
    }
    for (let i = 1; i <= CABIN_CORNER; i += 1) {
      const angle = (i / CABIN_CORNER) * (Math.PI / 2);
      half.push({ x: halfRoof - corner + corner * Math.cos(angle), y: roof - corner + corner * Math.sin(angle) });
    }
    for (let i = 1; i <= CABIN_ROOF; i += 1) {
      const t = i / CABIN_ROOF;
      half.push({ x: (halfRoof - corner) * (1 - t), y: roof + 0.025 * (1 - (1 - t) * (1 - t)) });
    }
    rows.push([...half, ...half.slice(0, -1).reverse().map((p) => ({ ...p, x: -p.x }))].map((p) => ({ ...p, z })));
    tall.push(roof - base);
  }
  const columns = rows[0].length;
  const perHalf = CABIN_SIDE + CABIN_CORNER + CABIN_ROOF;
  const { glass } = spec;
  // Which squares of the skin are glass: side windows between the sill,
  // the roof rail and the pillars; the windshield and the rear window
  // between the corner pillars.
  const isGlass = (r, c) => {
    const z = (rows[r][0].z + rows[r + 1][0].z) / 2;
    const fromEdge = Math.min(c, columns - 2 - c);
    if (Math.min(tall[r], tall[r + 1]) < 0.16 || r < 1 || r > CABIN_STATIONS - 2) {
      return false;
    }
    if (fromEdge < CABIN_SIDE) {
      return fromEdge >= 1 && fromEdge < CABIN_SIDE - 1 && glass.pillars.every((pillar) => Math.abs(z - pillar) > 0.045);
    }
    if (fromEdge <= CABIN_SIDE + CABIN_CORNER) {
      return false;
    }
    return z > glass.front + 0.04 || (glass.rear && z < glass.back - 0.04);
  };
  const frame = skin(rows, spec.width, { keep: (r, c) => !isGlass(r, c) });
  const panes = skin(rows, spec.width, { keep: isGlass });
  panes.deleteAttribute('color');
  return { frame, panes, sample, back, front, perHalf };
}


// The widest each car gets, for laying paint across it.
Object.values(DESIGNS).forEach((spec) => {
  spec.width = Math.max(...spec.hull.map(([, , , , half]) => half)) * 2 + 0.2;
});

// SVG path data for a car's side view (body and cabin), for the garage.
export function carOutline(design) {
  const spec = DESIGNS[design];
  const at = hullAt(spec);
  const back = spec.hull[0][0];
  const front = spec.hull[spec.hull.length - 1][0];
  const steps = 24;
  const along = Array.from({ length: steps + 1 }, (unused, i) => back + ((front - back) * i) / steps);
  const body = [...along.map((z) => [z, at(z).floor]), ...along.slice().reverse().map((z) => [z, Math.max(at(z).belt, at(z).top)])];
  const roof = sampler(spec.cabin);
  const cabinBack = spec.cabin[0][0];
  const cabinFront = spec.cabin[spec.cabin.length - 1][0];
  const cabin = Array.from({ length: 13 }, (unused, i) => cabinFront + ((cabinBack - cabinFront) * i) / 12).map((z) => [z, roof(z)[1]]);
  cabin.push([cabinBack, at(cabinBack).belt - 0.03], [cabinFront, at(cabinFront).belt - 0.03]);
  const path = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L')}Z`;
  return { body: path(body), cabin: path(cabin), wheel: spec.wheel, wheelBase: spec.wheelBase, ride: spec.ride };
}

// Smooth shading that keeps sharp edges sharp: every corner takes the
// average direction of the faces around it that face nearly the same way.
function smoothNormals(source, creaseDegrees = 42) {
  const geometry = source.index ? source.toNonIndexed() : source;
  const position = geometry.attributes.position;
  const faces = position.count / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const faceNormals = [];
  const around = new Map();
  for (let face = 0; face < faces; face += 1) {
    a.fromBufferAttribute(position, face * 3);
    b.fromBufferAttribute(position, face * 3 + 1);
    c.fromBufferAttribute(position, face * 3 + 2);
    // Left unnormalized, so big faces count for more.
    const weighted = b.clone().sub(a).cross(c.clone().sub(a));
    faceNormals.push({ weighted, unit: weighted.clone().normalize() });
    [a, b, c].forEach((corner) => {
      const key = `${corner.x.toFixed(3)},${corner.y.toFixed(3)},${corner.z.toFixed(3)}`;
      if (!around.has(key)) {
        around.set(key, []);
      }
      around.get(key).push(face);
    });
  }
  const limit = Math.cos(THREE.MathUtils.degToRad(creaseDegrees));
  const normals = new Float32Array(position.count * 3);
  const sum = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    a.fromBufferAttribute(position, i);
    const own = faceNormals[Math.floor(i / 3)].unit;
    sum.set(0, 0, 0);
    around.get(`${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`).forEach((face) => {
      if (faceNormals[face].unit.dot(own) > limit) {
        sum.add(faceNormals[face].weighted);
      }
    });
    sum.normalize();
    normals[i * 3] = sum.x;
    normals[i * 3 + 1] = sum.y;
    normals[i * 3 + 2] = sum.z;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}


const shared = {};

// A fine weave for carbon fibre parts.
function carbonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#17181d';
  ctx.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      ctx.fillStyle = (x + y) % 2 ? '#2a2c34' : '#0e0f13';
      ctx.fillRect(x * 8 + 1, y * 8 + 1, 6, 6);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sharedMaterials() {
  if (shared.glass) {
    return shared;
  }
  // Glass and lights sit right on the skin: `onSkin` keeps them from
  // flickering against it.
  const onSkin = { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 };
  shared.glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c14, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, ...onSkin });
  shared.plate = new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.5, emissive: 0x333330 });
  shared.chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 1, roughness: 0.15 });
  shared.mirror = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, metalness: 1, roughness: 0.05 });
  shared.tire = new THREE.MeshStandardMaterial({ color: 0x101013, roughness: 0.92 });
  // The brake: a steel disc and a red caliper, in one mesh.
  shared.brake = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.4 });
  shared.dark = new THREE.MeshStandardMaterial({ color: 0x0c0d11, metalness: 0.4, roughness: 0.55 });
  shared.carbon = new THREE.MeshStandardMaterial({ color: 0xffffff, map: carbonTexture(), metalness: 0.35, roughness: 0.32 });
  shared.spring = new THREE.MeshStandardMaterial({ color: 0xd8202a, metalness: 0.5, roughness: 0.35 });
  shared.headlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 4.5 });
  // Not too bright, or the red washes out to orange or white.
  shared.taillight = new THREE.MeshStandardMaterial({ color: 0xa8000e, emissive: 0xff0022, emissiveIntensity: 1.6 });
  shared.amber = new THREE.MeshStandardMaterial({ color: 0xffa020, emissive: 0xff8a10, emissiveIntensity: 1.6 });
  shared.flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  shared.shadow = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.6 });
  shared.beam = new THREE.MeshBasicMaterial({ map: headlightTexture(), color: new THREE.Color(1.1, 1.05, 0.95), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  shared.dot = softDotTexture();
  return shared;
}

// A soft dark patch right under the car, where the sun can't reach.
function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 64, 4, 32, 64, 60);
  gradient.addColorStop(0, 'rgba(0,0,0,0.75)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 128);
  return new THREE.CanvasTexture(canvas);
}

const RIM_COLORS = {
  silver: { color: 0xe2e6ee, metalness: 1, roughness: 0.18 },
  black: { color: 0x1b1c22, metalness: 0.7, roughness: 0.35 },
  gold: { color: 0xd8a830, metalness: 1, roughness: 0.22 },
  red: { color: 0xd0202c, metalness: 0.6, roughness: 0.3 },
};

// The paint's look: shiny clear coat, flat matte, or mirror chrome.
function paintMaterial(finish) {
  if (finish === 'matte') {
    return new THREE.MeshPhysicalMaterial({ metalness: 0.05, roughness: 0.72, clearcoat: 0, envMapIntensity: 0.6 });
  }
  if (finish === 'chrome') {
    return new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  }
  return new THREE.MeshPhysicalMaterial({ metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 });
}

// Racing stripes run the length of the car, so the paint texture only has
// to change across it: u goes from one side of the car (0) to the other (1).
function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 4;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function paintStripes(texture, paint, stripes, stripeColor) {
  const ctx = texture.image.getContext('2d');
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, 256, 4);
  ctx.fillStyle = stripeColor;
  if (stripes === 'single') {
    ctx.fillRect(108, 0, 40, 4);
  }
  if (stripes === 'double') {
    ctx.fillRect(84, 0, 26, 4);
    ctx.fillRect(146, 0, 26, 4);
  }
  texture.needsUpdate = true;
}


/* ---------- Small parts ---------- */

const UP = new THREE.Vector3(0, 1, 0);
const partMatrix = new THREE.Matrix4();
const partTurn = new THREE.Quaternion();
const partEuler = new THREE.Euler();
const partAt = new THREE.Vector3();
const partSize = new THREE.Vector3(1, 1, 1);

// Collects small parts by material and joins each lot into one mesh.
function partsBin() {
  const lots = new Map();
  const add = (geometry, material, matrix = null) => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) {
      part.applyMatrix4(matrix);
    }
    Object.keys(part.attributes).forEach((name) => {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') {
        part.deleteAttribute(name);
      }
    });
    if (!lots.has(material)) {
      lots.set(material, []);
    }
    lots.get(material).push(part);
  };
  return {
    add,
    // A box, placed by its middle and turned (x, y, z turns in radians).
    box(material, width, height, length, x, y, z, turn = [0, 0, 0]) {
      partTurn.setFromEuler(partEuler.set(turn[0], turn[1], turn[2]));
      add(BOX, material, partMatrix.compose(partAt.set(x, y, z), partTurn, partSize.set(width, height, length)));
    },
    // A round bar from a to b ([x, y, z] each).
    tube(material, a, b, radius, sides = TUBE) {
      const from = new THREE.Vector3(...a);
      const along = new THREE.Vector3(...b).sub(from);
      const length = along.length();
      partTurn.setFromUnitVectors(UP, along.normalize());
      add(sides, material, partMatrix.compose(from.addScaledVector(along, length / 2), partTurn, partSize.set(radius * 2, length, radius * 2)));
    },
    // A ball squashed to any size.
    ball(material, width, height, length, x, y, z) {
      partTurn.identity();
      add(BALL, material, partMatrix.compose(partAt.set(x, y, z), partTurn, partSize.set(width, height, length)));
    },
    // One mesh per material, added to `group`. Returns the meshes.
    into(group) {
      const meshes = [];
      lots.forEach((parts, material) => {
        const mesh = new THREE.Mesh(THREE.mergeGeometries(parts), material);
        parts.forEach((part) => part.dispose());
        group.add(mesh);
        meshes.push(mesh);
      });
      lots.clear();
      return meshes;
    },
  };
}

// Lays a thin slab on top of the body at (x, z), tilted to follow the
// surface there. `yaw` turns it; `lift` raises it off the paint.
function lay(bin, hull, material, width, length, x, z, { yaw = 0, lift = 0.008, thick = 0.014 } = {}) {
  const here = hull.at(z);
  const pitch = -Math.atan2(deckOf(hull.at(z + 0.08), x) - deckOf(hull.at(z - 0.08), x), 0.16);
  const roll = Math.atan2(deckOf(here, x + 0.04) - deckOf(here, x - 0.04), 0.08);
  bin.box(material, width, thick, length, x, deckOf(here, x) + lift, z, [pitch, yaw, roll]);
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const TUBE = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const ROUND = new THREE.CylinderGeometry(0.5, 0.5, 1, 22);
const BALL = new THREE.SphereGeometry(0.5, 14, 10);

/* ---------- Wheels ---------- */

// A wheel in three meshes: the tire and the rim, which spin, and the
// brake, which stays put. `knobby` gives the buggy's tread blocks.
function makeWheel(radius, width, side, materials, knobby) {
  const half = width / 2;
  const rubber = partsBin();
  const metal = partsBin();
  const rimRadius = radius * (knobby ? 0.52 : 0.66);
  // The tire: a tread with rounded shoulders and a bulging sidewall,
  // turned around the axle.
  const profile = [[rimRadius / radius, -0.92], [0.8, -1], [0.93, -0.94], [1, -0.72], [1, 0.72], [0.93, 0.94], [0.8, 1], [rimRadius / radius, 0.92]]
    .map(([out, across]) => new THREE.Vector2(out * radius, across * half));
  const lathe = new THREE.LatheGeometry(profile, 40);
  lathe.rotateZ(Math.PI / 2);
  rubber.add(lathe, materials.tire);
  if (knobby) {
    const count = 20;
    for (let i = 0; i < count; i += 1) {
      [-1, 1].forEach((row) => {
        const angle = ((i + (row > 0 ? 0.5 : 0)) / count) * Math.PI * 2;
        const y = Math.cos(angle) * radius * 1.02;
        const z = Math.sin(angle) * radius * 1.02;
        rubber.box(materials.tire, half * 0.82, radius * 0.1, radius * 0.17, row * half * 0.48, y, z, [angle, 0, 0]);
        // Lugs wrapping onto the sidewall.
        rubber.box(materials.tire, half * 0.3, radius * 0.16, radius * 0.13, row * half * 0.98, Math.cos(angle) * radius * 0.93, Math.sin(angle) * radius * 0.93, [angle, 0, 0]);
      });
    }
  } else {
    // Grooves around a road tire.
    [-0.36, 0, 0.36].forEach((across) => {
      const groove = new THREE.TorusGeometry(radius * 1.001, 0.008, 4, 40);
      groove.rotateY(Math.PI / 2);
      groove.translate(across * half, 0, 0);
      rubber.add(groove, materials.dark);
    });
  }
  // The rim: a barrel, a lip, and spokes set near the outer face.
  const barrel = new THREE.CylinderGeometry(rimRadius, rimRadius, width * 0.86, 30, 1, true);
  barrel.rotateZ(Math.PI / 2);
  metal.add(barrel, materials.rim);
  const face = side * half * (knobby ? 0.5 : 0.78);
  const lip = new THREE.TorusGeometry(rimRadius, radius * 0.035, 8, 36);
  lip.rotateY(Math.PI / 2);
  lip.translate(side * half * 0.9, 0, 0);
  metal.add(lip, materials.rim);
  const spokes = knobby ? 6 : 10;
  for (let i = 0; i < spokes; i += 1) {
    const angle = (i / spokes) * Math.PI * 2;
    // Road wheels have thin spokes in pairs that lean toward each other.
    const leanTo = knobby ? 0 : (i % 2 ? 0.12 : -0.12);
    const middle = rimRadius * 0.56;
    const thick = knobby ? radius * 0.2 : radius * 0.075;
    metal.box(materials.rim, 0.03, rimRadius * 0.95, thick, face, Math.cos(angle + leanTo) * middle, Math.sin(angle + leanTo) * middle, [angle + leanTo, 0, 0]);
  }
  metal.tube(materials.rim, [face - side * 0.05, 0, 0], [face + side * 0.03, 0, 0], rimRadius * 0.24, ROUND);
  if (knobby) {
    // A ring of bolts holding the tire on.
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      metal.ball(materials.rim, 0.05, 0.05, 0.05, side * half * 0.93, Math.cos(angle) * rimRadius * 0.96, Math.sin(angle) * rimRadius * 0.96);
    }
  }
  const spin = new THREE.Group();
  rubber.into(spin);
  metal.into(spin);

  // The brake, colored per corner: steel disc, red caliper.
  const disc = new THREE.CylinderGeometry(rimRadius * 0.8, rimRadius * 0.8, 0.03, 26).toNonIndexed();
  disc.rotateZ(Math.PI / 2);
  disc.translate(side * half * 0.25, 0, 0);
  const caliper = new THREE.BoxGeometry(0.09, rimRadius * 0.5, rimRadius * 0.85).toNonIndexed();
  caliper.translate(side * half * 0.25, rimRadius * 0.52, 0);
  caliper.rotateX(-0.9);
  const tint = (geometry, color) => {
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      color.toArray(colors, i);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  };
  const brake = new THREE.Mesh(THREE.mergeGeometries([tint(disc, new THREE.Color(0x8d929c)), tint(caliper, new THREE.Color(0xd8202a))]), materials.brake);
  return { spin, brake };
}

/* ---------- Extras from the garage ---------- */

// Side graphics: a sheet that follows each side of the body, a hair
// outside it. One texture maps the car's length and height (meters) onto
// the canvas. Nothing is drawn over the wheel arches.
function sideGraphics(spec, hull, arches, kind, color) {
  const texture = decalTexture(kind, color);
  texture.repeat.set(1 / 5, 1 / 1.3);
  texture.offset.set(0.5, -0.1 / 1.3);
  const material = new THREE.MeshPhysicalMaterial({
    map: texture, transparent: true, roughness: 0.3, clearcoat: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const sides = new THREE.Group();
  const steps = 60;
  const levels = 10;
  [-1, 1].forEach((side) => {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= steps; i += 1) {
      const z = hull.back + 0.12 + ((hull.front - hull.back - 0.3) * i) / steps;
      const section = hull.at(z);
      for (let k = 0; k <= levels; k += 1) {
        const y = section.floor + 0.06 + ((section.belt - shoulderOf(section) - section.floor - 0.08) * k) / levels;
        positions.push(side * (sideOf(section, y) + 0.008), y, z);
        uvs.push(z, y);
      }
    }
    for (let i = 0; i < steps; i += 1) {
      for (let k = 0; k < levels; k += 1) {
        const a = i * (levels + 1) + k;
        const z = positions[a * 3 + 2];
        const y = positions[a * 3 + 1];
        if (arches.some((arch) => Math.hypot(z - arch.z, y - arch.y) < arch.radius + 0.06)) {
          continue;
        }
        indices.push(a, a + 1, a + levels + 1, a + 1, a + levels + 2, a + levels + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    sides.add(new THREE.Mesh(geometry, material));
  });
  return sides;
}

// Something sticking out of the hood: a scoop, or a supercharger.
function hoodPart(spec, hull, cabinFront, kind, paint, materials) {
  const along = (cabinFront + hull.front - 0.5) / 2;
  const height = (z) => hull.at(z).top;
  const part = new THREE.Group();
  part.position.set(0, height(along) + 0.04, along);
  part.rotation.x = Math.atan2(height(along - 0.4) - height(along + 0.4), 0.8);
  if (kind === 'scoop') {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.13, 0.7), paint);
    scoop.position.y = 0.05;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.04), materials.dark);
    mouth.position.set(0, 0.06, 0.35);
    part.add(scoop, mouth);
    return part;
  }
  const blower = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.6), materials.rim);
  blower.position.y = 0.12;
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.42), materials.dark);
  intake.position.set(0, 0.34, -0.04);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.04), materials.carbon);
  mouth.position.set(0, 0.36, 0.18);
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 20), materials.dark);
  pulley.rotation.x = Math.PI / 2;
  pulley.position.set(0, 0.12, 0.33);
  part.add(blower, intake, mouth, pulley);
  return part;
}

/* ---------- What makes each car itself ---------- */

// Parts both road cars have: a splitter under the nose, side skirts, a
// diffuser with fins, mirrors on stalks and a number plate.
function roadCarParts(bin, spec, hull, cabin, paint, materials) {
  const { front, back } = hull;
  const nose = hull.at(front - 0.25);
  bin.box(materials.carbon, nose.half * 2 + 0.22, 0.035, 0.5, 0, nose.floor - 0.02, front - 0.2);
  [-1, 1].forEach((side) => {
    // Skirt between the wheels, and a small fin at each end of the splitter.
    const middle = hull.at(0);
    bin.box(materials.carbon, 0.1, 0.07, spec.wheelBase * 2 - spec.wheel * 2.5, side * (middle.half * 0.93 + 0.02), middle.floor + 0.01, 0);
    bin.box(materials.carbon, 0.03, 0.12, 0.3, side * (nose.half + 0.08), nose.floor + 0.04, front - 0.26);
    // Mirror: a painted shell on a stalk, glass facing back.
    const z = spec.glass.front + 0.25;
    const [, roof, halfBase] = cabin.sample(z);
    const y = Math.min(roof - 0.08, hull.at(z).belt + 0.1);
    bin.box(materials.dark, 0.2, 0.025, 0.05, side * (halfBase + 0.08), y - 0.02, z);
    bin.ball(paint, 0.2, 0.11, 0.13, side * (halfBase + 0.2), y + 0.01, z);
    bin.box(materials.mirror, 0.16, 0.08, 0.01, side * (halfBase + 0.2), y + 0.01, z - 0.062);
  });
  const tail = hull.at(back + 0.1);
  bin.box(materials.carbon, tail.half * 1.7, 0.2, 0.42, 0, tail.floor + 0.02, back + 0.14, [0.22, 0, 0]);
  for (let i = -3; i <= 3; i += 1) {
    bin.box(materials.dark, 0.025, 0.2, 0.46, i * tail.half * 0.24, tail.floor - 0.02, back + 0.1, [0.22, 0, 0]);
  }
  bin.box(materials.plate, 0.36, 0.1, 0.012, 0, tail.floor + 0.24, back - 0.012);
}

function cometParts(bin, spec, hull, cabin, paint, materials) {
  const { front, back } = hull;
  roadCarParts(bin, spec, hull, cabin, paint, materials);
  // The nose: a dark mouth with a mesh, and blade headlights up on the
  // front fenders.
  const nose = hull.at(front - 0.12);
  bin.box(materials.dark, nose.half * 1.5, 0.11, 0.06, 0, nose.floor + 0.09, front - 0.04);
  [-1, 1].forEach((side) => {
    // A dark housing with a long blade of light and a short one.
    const x = side * hull.at(front - 0.6).half * 0.64;
    lay(bin, hull, materials.dark, 0.16, 0.4, x, front - 0.6, { yaw: side * 0.5 });
    lay(bin, hull, materials.headlight, 0.045, 0.34, x + side * 0.03, front - 0.6, { yaw: side * 0.5, lift: 0.016 });
    lay(bin, hull, materials.headlight, 0.1, 0.03, x - side * 0.04, front - 0.46, { yaw: side * 0.5, lift: 0.016 });
    // Tail: the end of the light bar is thicker.
    const rear = hull.at(back + 0.04);
    bin.box(materials.taillight, 0.26, 0.06, 0.03, side * rear.half * 0.72, rear.belt - 0.11, back - 0.018);
    bin.box(materials.dark, 0.3, 0.2, 0.03, side * rear.half * 0.6, rear.floor + 0.2, back - 0.014);
  });
  // Louvres over the engine.
  for (let i = 0; i < 6; i += 1) {
    lay(bin, hull, materials.dark, 0.8, 0.11, 0, -1.3 - i * 0.15, { lift: 0.012 });
  }
  // The tail: a dark panel with one light bar right across it.
  const rear = hull.at(back + 0.04);
  bin.box(materials.dark, rear.half * 1.82, 0.2, 0.02, 0, rear.belt - 0.12, back - 0.008);
  bin.box(materials.taillight, rear.half * 1.74, 0.028, 0.03, 0, rear.belt - 0.11, back - 0.02);
  return { exhausts: [[-0.16, rear.floor + 0.2], [0.16, rear.floor + 0.2]] };
}

function racerParts(bin, spec, hull, cabin, paint, materials) {
  const { front, back } = hull;
  roadCarParts(bin, spec, hull, cabin, paint, materials);
  // The nose: a wide grille, slanted headlights on the fenders, and two
  // small wings (canards) on each corner.
  const nose = hull.at(front - 0.08);
  bin.box(materials.dark, nose.half * 1.7, 0.2, 0.05, 0, nose.floor + 0.15, front - 0.02);
  bin.box(materials.carbon, nose.half * 1.74, 0.02, 0.07, 0, nose.floor + 0.15, front - 0.01);
  [-1, 1].forEach((side) => {
    const z = front - 0.5;
    const section = hull.at(z);
    lay(bin, hull, materials.dark, 0.2, 0.42, side * section.half * 0.7, z, { yaw: side * 0.42 });
    lay(bin, hull, materials.headlight, 0.1, 0.32, side * section.half * 0.7, z + 0.02, { yaw: side * 0.42, lift: 0.016 });
    [0, 1].forEach((k) => {
      bin.box(materials.carbon, 0.2, 0.012, 0.16, side * (hull.sideX(front - 0.35, 0.4 + k * 0.12) + 0.08), nose.floor + 0.14 + k * 0.13, front - 0.36, [0.25, 0, side * -0.2]);
    });
    // Hood vents, and three slanted vents behind each front wheel.
    for (let i = 0; i < 3; i += 1) {
      const vz = 1.25 - i * 0.14;
      lay(bin, hull, materials.dark, 0.3, 0.07, side * 0.3, vz, { yaw: side * 0.25, lift: 0.01 });
      const sz = 0.88 - i * 0.11;
      bin.box(materials.dark, 0.02, 0.2, 0.05, side * (hull.sideX(sz, 0.6) + 0.004), 0.6, sz, [-0.45, 0, 0]);
    }
    // Twin exhaust tips out of the side, in front of the rear wheel.
    [0, 0.13].forEach((offset) => {
      const z2 = -0.72 - offset;
      const x = hull.sideX(z2, 0.26);
      bin.tube(materials.chrome, [side * (x - 0.1), 0.25, z2], [side * (x + 0.07), 0.24, z2 - 0.03], 0.05, ROUND);
      bin.tube(materials.dark, [side * (x + 0.06), 0.24, z2 - 0.03], [side * (x + 0.075), 0.24, z2 - 0.032], 0.04, ROUND);
    });
    // Tail lights: a slim blade each side, turned down at its outer end.
    const rear = hull.at(back + 0.05);
    bin.box(materials.dark, 0.5, 0.11, 0.03, side * rear.half * 0.55, rear.belt - 0.1, back - 0.01);
    bin.box(materials.taillight, 0.44, 0.03, 0.03, side * rear.half * 0.55, rear.belt - 0.08, back - 0.022);
    bin.box(materials.taillight, 0.03, 0.09, 0.03, side * (rear.half * 0.55 + 0.21), rear.belt - 0.11, back - 0.022);
    bin.box(materials.dark, 0.1, 0.24, 0.03, side * rear.half * 0.86, rear.floor + 0.3, back - 0.012);
  });
  // A ducktail lip across the tail.
  const rear = hull.at(back + 0.12);
  bin.box(paint, rear.half * 1.8, 0.035, 0.2, 0, rear.belt + 0.035, back + 0.12, [-0.3, 0, 0]);
  return { exhausts: [[-0.4, rear.floor + 0.12], [0.4, rear.floor + 0.12]] };
}

function roverParts(bin, spec, hull, cabin, paint, materials) {
  const { front, back } = hull;
  const cage = materials.dark;
  const roof = 1.9;
  [-1, 1].forEach((side) => {
    // Roll cage: up the windshield pillar, along the roof, down behind
    // the cabin and back to the tail, with a brace.
    const x = side * 0.8;
    bin.tube(cage, [x, 1.3, 1.02], [x * 0.92, roof, 0.5], 0.035);
    bin.tube(cage, [x * 0.92, roof, 0.5], [x * 0.92, roof, -0.95], 0.035);
    bin.tube(cage, [x * 0.92, roof, -0.95], [x, 1.25, -1.9], 0.035);
    bin.tube(cage, [x * 0.92, roof - 0.02, -0.4], [x, 1.3, -1.25], 0.03);
    // Roof rack rails and its feet.
    bin.tube(cage, [side * 0.66, roof + 0.16, 0.45], [side * 0.66, roof + 0.16, -1.0], 0.025);
    [0.4, -0.3, -0.95].forEach((z) => bin.tube(cage, [side * 0.66, roof, z], [side * 0.66, roof + 0.16, z], 0.02));
    // Fender flares over the wheels, and a step tube between them.
    [1, -1].forEach((end) => {
      const z = end * spec.wheelBase;
      for (let i = 0; i < 7; i += 1) {
        const angle = -0.95 + (i / 6) * 1.9;
        const reach = spec.wheel + 0.13;
        bin.box(materials.dark, 0.34, 0.05, reach * 0.36, side * (spec.track - 0.12), spec.wheel + Math.cos(angle) * reach, z + Math.sin(angle) * reach, [angle, 0, 0]);
      }
      // Suspension: two arms and a red coil spring over a damper.
      const hub = [side * (spec.track - 0.24), spec.wheel, z];
      bin.tube(materials.chrome, [side * 0.5, 0.74, z + 0.22], hub, 0.03);
      bin.tube(materials.chrome, [side * 0.5, 0.74, z - 0.22], hub, 0.03);
      bin.tube(materials.chrome, [side * 0.45, 1.0, z], [hub[0], spec.wheel + 0.2, z], 0.025);
      const top = [side * 0.62, 1.22, z];
      const low = [side * (spec.track - 0.34), spec.wheel + 0.12, z];
      bin.tube(materials.dark, top, low, 0.025);
      for (let i = 0; i < 7; i += 1) {
        const t = 0.12 + i * 0.11;
        const ring = new THREE.TorusGeometry(0.07, 0.016, 6, 14);
        partTurn.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(low[0] - top[0], low[1] - top[1], 0).normalize());
        bin.add(ring, materials.spring, partMatrix.compose(partAt.set(top[0] + (low[0] - top[0]) * t, top[1] + (low[1] - top[1]) * t, z), partTurn, partSize.set(1, 1, 1)));
      }
    });
    bin.tube(cage, [side * 0.92, 0.6, 0.75], [side * 0.92, 0.6, -0.75], 0.04);
    [0.6, -0.6].forEach((z) => bin.tube(cage, [side * 0.8, 0.7, z], [side * 0.92, 0.6, z], 0.03));
    // Headlights: an angular frame of light, with a dark middle.
    const nose = hull.at(front - 0.12);
    bin.box(materials.headlight, 0.3, 0.1, 0.04, side * nose.half * 0.62, nose.belt - 0.1, front - 0.05, [0.2, side * 0.25, 0]);
    bin.box(materials.dark, 0.22, 0.05, 0.045, side * nose.half * 0.62, nose.belt - 0.1, front - 0.045, [0.2, side * 0.25, 0]);
    bin.box(materials.amber, 0.12, 0.035, 0.03, side * nose.half * 0.62, nose.belt - 0.24, front - 0.02);
    // Two round lamps on the bull bar.
    bin.tube(materials.dark, [side * 0.2, 0.98, front + 0.2], [side * 0.2, 0.98, front + 0.3], 0.1, ROUND);
    bin.tube(materials.headlight, [side * 0.2, 0.98, front + 0.3], [side * 0.2, 0.98, front + 0.315], 0.085, ROUND);
    // Tail lights: a C of red light on each corner, and a marker below.
    const rear = hull.at(back + 0.08);
    const lx = side * (rear.half + 0.02);
    bin.box(materials.dark, 0.22, 0.3, 0.05, lx, 1.12, back + 0.02);
    bin.box(materials.taillight, 0.2, 0.035, 0.05, lx, 1.24, back - 0.012);
    bin.box(materials.taillight, 0.2, 0.035, 0.05, lx, 1.0, back - 0.012);
    bin.box(materials.taillight, 0.035, 0.27, 0.05, lx + side * 0.085, 1.12, back - 0.012);
    bin.box(materials.taillight, 0.14, 0.05, 0.03, side * 0.5, 0.78, back - 0.2);
    // Mirrors, and vents in the rear flanks.
    bin.box(cage, 0.16, 0.2, 0.06, side * 0.92, 1.5, 0.9);
    bin.box(materials.mirror, 0.13, 0.16, 0.01, side * 0.92, 1.5, 0.868);
    for (let i = 0; i < 4; i += 1) {
      bin.box(materials.dark, 0.02, 0.035, 0.3, side * (hull.sideX(-1.2, 1.0 + i * 0.06) + 0.004), 1.0 + i * 0.065, -1.2, [0.25, 0, 0]);
    }
  });
  // Roof rack: cross bars and a basket rim, with a light bar in front.
  [0.45, 0.1, -0.25, -0.6, -1.0].forEach((z) => bin.tube(cage, [-0.66, roof + 0.16, z], [0.66, roof + 0.16, z], 0.022));
  bin.tube(cage, [-0.8 * 0.92, roof, 0.5], [0.8 * 0.92, roof, 0.5], 0.035);
  bin.tube(cage, [-0.8 * 0.92, roof, -0.95], [0.8 * 0.92, roof, -0.95], 0.035);
  bin.box(cage, 1.36, 0.1, 0.09, 0, roof + 0.09, 0.56);
  for (let i = 0; i < 8; i += 1) {
    bin.box(materials.headlight, 0.13, 0.06, 0.02, -0.56 + i * 0.16, roof + 0.09, 0.61);
  }
  // Bull bar: a hoop, two uprights and a skid plate tucked under the nose.
  const bar = front + 0.2;
  bin.tube(cage, [-0.5, 1.12, bar], [0.5, 1.12, bar], 0.04);
  bin.tube(cage, [-0.62, 0.78, bar], [0.62, 0.78, bar], 0.045);
  [-1, 1].forEach((side) => {
    bin.tube(cage, [side * 0.5, 1.12, bar], [side * 0.62, 0.78, bar], 0.04);
    bin.tube(cage, [side * 0.62, 0.78, bar], [side * 0.6, 0.82, front - 0.25], 0.04);
    bin.tube(cage, [side * 0.34, 1.12, bar], [side * 0.34, 0.78, bar], 0.03);
  });
  bin.box(materials.chrome, 0.9, 0.03, 0.5, 0, 0.66, front, [-0.6, 0, 0]);
  // Rear bumper tube and a skid plate.
  bin.tube(cage, [-0.72, 0.82, back - 0.16], [0.72, 0.82, back - 0.16], 0.045);
  [-1, 1].forEach((side) => bin.tube(cage, [side * 0.6, 0.82, back - 0.16], [side * 0.6, 0.86, back + 0.3], 0.04));
  bin.box(materials.chrome, 0.8, 0.03, 0.4, 0, 0.7, back + 0.05, [0.6, 0, 0]);
  // The hood: a raised panel with a dark vent.
  lay(bin, hull, paint, 0.7, 0.6, 0, 1.5, { thick: 0.04, lift: 0.015 });
  lay(bin, hull, materials.dark, 0.44, 0.22, 0, 1.42, { lift: 0.045 });
  return { exhausts: [[-0.3, 0.72], [0.3, 0.72]], spare: [0, 1.32, back - 0.24] };
}

/* ---------- Building a car ---------- */

// custom: { finish, stripes, stripeColor, decal, decalColor, rims, wing,
// hood, glow } (see CUSTOM_OPTIONS in world.js). Returns { group, setColor,
// setHeadlights, emitters, update }. setHeadlights(on, real): `real` adds a
// true spotlight (not on phones).
export function buildCar(design, color, custom) {
  const spec = DESIGNS[design];
  const materials = { ...sharedMaterials() };
  materials.rim = new THREE.MeshStandardMaterial({ ...RIM_COLORS[custom.rims], side: THREE.DoubleSide });
  // Small painted parts (mirrors, wing plates) take the plain color.
  const paint = paintMaterial(custom.finish);
  paint.side = THREE.DoubleSide;
  // The body and cabin: with stripes, the color comes from the stripe
  // texture. Dark corners (inside the wheel arches) come from the skin.
  const bodyPaint = paintMaterial(custom.finish);
  bodyPaint.vertexColors = true;
  bodyPaint.side = THREE.DoubleSide;
  let stripes = null;
  function applyColor(next) {
    paint.color.set(next);
    if (custom.stripes === 'none') {
      bodyPaint.color.set(next);
      return;
    }
    paintStripes(stripes, next, custom.stripes, custom.stripeColor);
  }
  if (custom.stripes !== 'none') {
    stripes = stripeTexture();
    bodyPaint.map = stripes;
    bodyPaint.color.set(0xffffff);
  }
  applyColor(color);

  const group = new THREE.Group();
  // The body rolls on its own; the wheels stay put.
  const body = new THREE.Group();
  body.position.y = spec.ride;
  group.add(body);

  // Where the wheels are. On the road cars they sit just inside the
  // body's sides, in arches cut into the skin; the buggy's stand outside.
  const measure = hullAt(spec);
  const axles = [1, -1].map((end) => {
    const z = end * spec.wheelBase;
    const track = spec.track || measure(z).half - spec.tire / 2 - 0.012;
    return { end, z, track };
  });
  const arches = spec.buggy ? [] : axles.map(({ z, track }) => ({ z, y: spec.wheel, radius: spec.wheel * 1.09, inner: track - spec.tire / 2 - 0.07 }));
  const hull = buildHull(spec, arches);
  const cabin = buildCabin(spec, hull);
  const { front, back } = hull;
  const shell = THREE.mergeGeometries([hull.geometry, cabin.frame]);
  hull.geometry.dispose();
  cabin.frame.dispose();
  body.add(new THREE.Mesh(smoothNormals(shell, 38), bodyPaint));
  const glassMesh = new THREE.Mesh(smoothNormals(cabin.panes, 38), materials.glass);
  body.add(glassMesh);
  if (custom.decal !== 'none') {
    body.add(sideGraphics(spec, hull, arches, custom.decal, custom.decalColor));
  }

  const bin = partsBin();
  const makers = { comet: cometParts, racer: racerParts, rover: roverParts };
  const made = makers[design](bin, spec, hull, cabin, paint, materials);
  const tailTop = hull.at(back + 0.25).belt;

  // A rear wing: the car's own choice, none, a small lip, or a big wing
  // on two posts with painted end plates.
  let wingStyle = custom.wing;
  if (wingStyle === 'auto') {
    wingStyle = spec.wing ? 'big' : 'none';
  }
  if (wingStyle === 'small') {
    bin.box(materials.carbon, hull.at(back + 0.2).half * 1.7, 0.04, 0.3, 0, tailTop + 0.09, back + 0.2, [-0.25, 0, 0]);
  }
  if (wingStyle === 'big') {
    const height = tailTop + (spec.buggy ? 0.75 : 0.42);
    const span = hull.at(back + 0.3).half * 2 + 0.06;
    bin.box(materials.carbon, span, 0.035, 0.42, 0, height, back + 0.2, [-0.12, 0, 0]);
    bin.box(materials.carbon, span, 0.02, 0.12, 0, height + 0.06, back + 0.02, [-0.5, 0, 0]);
    [-1, 1].forEach((side) => {
      // Posts that reach up and back from the deck.
      bin.box(materials.carbon, 0.035, 0.07, height - tailTop + 0.2, side * 0.45, (height + tailTop) / 2, back + 0.42, [-1.0, 0, 0]);
      bin.box(paint, 0.025, 0.18, 0.44, side * (span / 2), height + 0.03, back + 0.2);
    });
  }

  // Exhausts, with flames while using nitro.
  const exhaustSpots = [];
  const flames = [];
  made.exhausts.forEach(([x, y]) => {
    bin.tube(materials.chrome, [x, y, back + 0.16], [x, y, back - 0.06], 0.07, ROUND);
    bin.tube(materials.dark, [x, y, back - 0.06], [x, y, back - 0.065], 0.055, ROUND);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 16, 1, true), materials.flame);
    // Wide at the pipe, pointing backward.
    flame.geometry.translate(0, 0.55, 0);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, y, back - 0.1);
    flame.visible = false;
    body.add(flame);
    flames.push(flame);
    const spot = new THREE.Object3D();
    spot.position.set(x, y, back - 0.3);
    body.add(spot);
    exhaustSpots.push(spot);
  });
  const trim = bin.into(body);

  if (custom.hood !== 'none') {
    body.add(hoodPart(spec, hull, cabin.front, custom.hood, paint, materials));
  }

  // Wheels: the front pair steers, all spin; the brakes stay put.
  const wheels = [];
  axles.forEach(({ end, z, track }) => {
    [1, -1].forEach((side) => {
      const holder = new THREE.Group();
      holder.position.set(side * track, spec.wheel, z);
      const { spin, brake } = makeWheel(spec.wheel, spec.tire, side, materials, Boolean(spec.buggy));
      holder.add(spin, brake);
      group.add(holder);
      wheels.push({ holder, wheel: spin, front: end === 1 });
    });
  });
  if (made.spare) {
    // The spare wheel, bolted flat against the back.
    const { spin } = makeWheel(spec.wheel * 0.94, spec.tire, 1, materials, true);
    spin.rotation.y = Math.PI / 2;
    spin.position.set(...made.spare);
    body.add(spin);
  }

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(spec.width + 0.8, front - back + 1), materials.shadow);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.04;
  group.add(blob);

  // Night extras: light thrown on the road ahead, and a neon underglow.
  const beamGeometry = new THREE.PlaneGeometry(11, 20);
  beamGeometry.translate(0, 10, 0);
  beamGeometry.rotateX(Math.PI / 2);
  const beams = new THREE.Mesh(beamGeometry, materials.beam);
  beams.position.set(0, 0.08, front - 0.3);
  beams.visible = false;
  group.add(beams);
  const lamp = new THREE.SpotLight(0xfff1d8, 110, 80, 0.6, 0.75, 1.25);
  lamp.position.set(0, 0.75, front - 0.2);
  lamp.target.position.set(0, -0.6, front + 20);
  lamp.visible = false;
  group.add(lamp, lamp.target);
  let glowColor = spec.underglow;
  if (custom.glow.startsWith('#')) {
    glowColor = custom.glow;
  }
  const glowMaterial = new THREE.MeshBasicMaterial({ map: materials.dot, color: new THREE.Color(glowColor).multiplyScalar(1.4), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(spec.width + 1.2, front - back + 1.2), glowMaterial);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.06;
  underglow.visible = false;
  group.add(underglow);

  group.traverse((child) => {
    if (child.isMesh && child !== blob && child !== beams && child !== underglow && !flames.includes(child)) {
      child.castShadow = true;
    }
  });
  // Glass and lights throw no shadow worth drawing.
  [glassMesh, ...trim.filter((mesh) => mesh.material !== materials.dark && mesh.material !== materials.carbon && mesh.material !== paint)].forEach((mesh) => {
    mesh.castShadow = false;
  });

  let spin = 0;
  let roll = 0;
  const point = new THREE.Vector3();

  return {
    group,
    setColor(next) {
      applyColor(next);
    },
    // Night lights. A chosen underglow color shows everywhere; the car's
    // own ('auto') only at night, and 'off' never.
    setHeadlights(on, real = false) {
      beams.visible = on;
      lamp.visible = on && real;
      beams.material.opacity = lamp.visible ? 0.3 : 0.55;
      underglow.visible = custom.glow !== 'off';
      if (custom.glow === 'auto') {
        underglow.visible = on;
      }
    },
    // Where particles come from, in world space: the rear tires (for
    // smoke and dust) and the exhausts (for nitro sparks).
    emitters(heading) {
      const rear = wheels.filter((wheel) => !wheel.front).map(({ holder }) => {
        holder.getWorldPosition(point);
        return { x: point.x, y: point.y - spec.wheel, z: point.z };
      });
      const exhausts = exhaustSpots.map((spot) => {
        spot.getWorldPosition(point);
        return { x: point.x, y: point.y, z: point.z, vx: -Math.sin(heading), vz: -Math.cos(heading) };
      });
      return { wheels: rear, exhausts };
    },
    // Wheels turn with speed, the front wheels steer, the body leans into
    // bends, and the exhausts flame while using nitro.
    update(dt, { speed = 0, steer = 0, nitro = false } = {}) {
      spin += (speed / spec.wheel) * dt;
      wheels.forEach(({ holder, wheel, front: isFront }) => {
        wheel.rotation.x = spin;
        if (isFront) {
          holder.rotation.y = -steer * 0.4;
        }
      });
      // Lean out of the bend (steering right drops the left side).
      const targetRoll = -steer * Math.min(1, speed / 30) * 0.06;
      roll += (targetRoll - roll) * Math.min(1, dt * 6);
      body.rotation.z = roll;
      flames.forEach((flame) => {
        flame.visible = nitro;
        flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
      });
    },
  };
}
