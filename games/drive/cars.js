// The three cars. Each body starts as a smooth side outline pushed out
// sideways with rounded edges, then it is sculpted: narrower at the nose
// and tail, tucked in at the sills and the roof, with a hump over each
// wheel. The cabin is painted like the body, with a windshield, a rear
// window and side windows set into it; lights, the grille, door lines,
// vents and the number plate are thin sheets laid on the car's skin, so
// they follow its curves. Clear-coat paint and glass reflect the sky, and
// lights are brighter than white, so they glow. At night real headlights
// shine on the road.
//
// Every car faces +z, sits on y = 0 and is about 4.6 m long.

import * as THREE from '../../vendor/three/three.min.js';
import { decalTexture, headlightTexture, softDotTexture } from './textures.js';

const DESIGNS = {
  // A low, wedge-shaped hypercar.
  comet: {
    body: [[-2.3, 0.26], [2.2, 0.26], [2.44, 0.4], [2.32, 0.56], [1.1, 0.76], [-0.2, 0.84], [-1.5, 0.86], [-2.3, 0.9], [-2.42, 0.55]],
    cabin: [[1.05, 0.74], [0.25, 1.1], [-0.75, 1.13], [-1.7, 0.84]],
    width: 2.02,
    cabinWidth: 1.46,
    wheel: 0.37,
    wheelBase: 1.45,
    track: 0.95,
    ride: 0,
    wing: false,
    underglow: '#35f2ff',
  },
  // A grand tourer with a long hood and a big rear wing.
  racer: {
    body: [[-2.35, 0.28], [2.25, 0.28], [2.47, 0.44], [2.37, 0.62], [0.8, 0.84], [-0.6, 0.9], [-1.7, 0.92], [-2.38, 0.98], [-2.46, 0.6]],
    cabin: [[0.72, 0.82], [-0.05, 1.2], [-0.95, 1.22], [-1.78, 0.9]],
    width: 1.96,
    cabinWidth: 1.42,
    wheel: 0.38,
    wheelBase: 1.5,
    track: 0.93,
    ride: 0,
    wing: true,
    underglow: '#ff3fa4',
  },
  // A tall off-road buggy with big wheels, a roof rack and a light bar.
  rover: {
    body: [[-2.1, 0.55], [2.0, 0.55], [2.26, 0.76], [2.16, 1.04], [1.0, 1.14], [-0.5, 1.16], [-1.9, 1.15], [-2.2, 1.05], [-2.26, 0.75]],
    cabin: [[0.92, 1.1], [0.45, 1.74], [-1.3, 1.78], [-1.72, 1.1]],
    width: 2.06,
    cabinWidth: 1.8,
    wheel: 0.52,
    wheelBase: 1.4,
    track: 1.02,
    ride: 0.15,
    wing: false,
    rack: true,
    underglow: '#ffd23f',
  },
};

// SVG path data for a car's side view (body and cabin), for the garage.
export function carOutline(design) {
  const spec = DESIGNS[design];
  const path = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L')}Z`;
  return { body: path(spec.body), cabin: path(spec.cabin), wheel: spec.wheel, wheelBase: spec.wheelBase, ride: spec.ride };
}

// The body's underside is a straight line; the rest is one smooth curve.
function bodyShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  shape.lineTo(points[1][0], points[1][1]);
  shape.splineThru(points.slice(2).map(([x, y]) => new THREE.Vector2(x, y)));
  shape.closePath();
  return shape;
}

// The canopy: a smooth dome over a straight base.
function cabinShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  shape.splineThru(points.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
  shape.closePath();
  return shape;
}

// Push a side outline out sideways into a solid, centered, facing +z.
function sideSolid(shape, width, bevel) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 6,
    curveSegments: 28,
  });
  geometry.translate(0, 0, -(width - bevel * 2) / 2);
  geometry.rotateY(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function smooth(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// The ends, floor and shoulder line of a car, read from its outline.
function measure(spec) {
  const along = spec.body.map(([x]) => x);
  const up = spec.body.map(([, y]) => y);
  return { front: Math.max(...along), back: Math.min(...along), floor: Math.min(...up), belt: Math.max(...up) };
}

// How wide the car is at a spot, as a share of its full width. Seen from
// above it narrows toward the nose and a little toward the tail; seen from
// the front it tucks in at the sills and above the shoulders.
function widthShare(spec, along, up) {
  const { front, back, floor, belt } = measure(spec);
  const t = (along - back) / (front - back);
  const nose = smooth(0.62, 1, t);
  const tail = 1 - smooth(0, 0.24, t);
  const plan = 1 - 0.17 * nose * nose - 0.07 * tail;
  const sill = 1 - smooth(floor, floor + 0.22, up);
  const shoulder = smooth(belt - 0.3, belt + 0.02, up);
  return plan * (1 - 0.05 * sill - 0.045 * shoulder);
}

// Squeeze a part (already in the car's own space) to the car's shape.
// `lean` pulls the top in more: the canopy leans toward its roof.
function sculpt(geometry, spec, lean = null) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const up = position.getY(i);
    let share = widthShare(spec, position.getZ(i), up);
    if (lean) {
      share *= 1 - lean.amount * smooth(lean.from, lean.to, up);
    }
    position.setX(i, position.getX(i) * share);
  }
  position.needsUpdate = true;
  return geometry;
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

// How much bigger than its outline a solid is, from its rounded edges
// (see sideSolid).
const BODY_EDGE = 0.16;
const CABIN_EDGE = 0.12;
const EDGE_GROWS = 0.85;

// The points of an outline, in order and close together, each pushed
// outward by `grow`. Each point is { along, up }: meters toward the nose,
// and meters above the ground.
function outlinePoints(shape, grow) {
  const raw = shape.getPoints(40);
  // Long straight parts get points in between.
  const points = [];
  raw.forEach((point, i) => {
    const next = raw[(i + 1) % raw.length];
    const steps = Math.max(1, Math.ceil(point.distanceTo(next) / 0.04));
    for (let k = 0; k < steps; k += 1) {
      points.push(point.clone().lerp(next, k / steps));
    }
  });
  let area = 0;
  points.forEach((point, i) => {
    const next = points[(i + 1) % points.length];
    area += point.x * next.y - next.x * point.y;
  });
  const turn = Math.sign(area) || 1;
  return points.map((point, i) => {
    const before = points[(i - 1 + points.length) % points.length];
    const after = points[(i + 1) % points.length];
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    return {
      along: point.x + ((after.y - before.y) / length) * turn * grow,
      up: point.y - ((after.x - before.x) / length) * turn * grow,
    };
  });
}

// The longest unbroken stretch of an outline that passes a test.
function stretch(points, test) {
  let best = [];
  let current = [];
  points.forEach((point) => {
    if (test(point)) {
      current.push(point);
      return;
    }
    if (current.length > best.length) {
      best = current;
    }
    current = [];
  });
  if (current.length > best.length) {
    best = current;
  }
  return best;
}

// The highest or lowest an outline gets at a spot along the car.
function edgeAt(points, along, pick) {
  let found = null;
  points.forEach((point, i) => {
    const next = points[(i + 1) % points.length];
    if ((point.along - along) * (next.along - along) > 0 || point.along === next.along) {
      return;
    }
    const up = point.up + ((along - point.along) / (next.along - point.along)) * (next.up - point.up);
    if (found === null || pick(up, found) === up) {
      found = up;
    }
  });
  return found;
}

function sheet(positions, columns) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const indices = [];
  const rows = positions.length / 3 / columns;
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      indices.push(a, a + 1, a + columns, a + 1, a + columns + 1, a + columns);
    }
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// A strip laid along a stretch of the car's skin, from `left` to `right`
// across the car (shares of its half width there: -1 is one side, 1 the
// other). `half(along, up)` gives the half width.
function skinStrip(points, half, left, right) {
  const columns = 5;
  const positions = [];
  points.forEach((point) => {
    for (let column = 0; column < columns; column += 1) {
      const share = left + ((right - left) * column) / (columns - 1);
      positions.push(share * half(point.along, point.up), point.up, point.along);
    }
  });
  return sheet(positions, columns);
}

// A sheet laid on a flat side of the car, between two spots along it, from
// low(along) up to high(along).
function sidePatch(side, from, to, low, high, half) {
  const columns = 5;
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / 0.06));
  const positions = [];
  for (let i = 0; i <= steps; i += 1) {
    const along = from + ((to - from) * i) / steps;
    const bottom = low(along);
    const top = Math.max(bottom, high(along));
    for (let column = 0; column < columns; column += 1) {
      const up = bottom + ((top - bottom) * column) / (columns - 1);
      positions.push(side * (half(along, up) + 0.006), up, along);
    }
  }
  return sheet(positions, columns);
}

const shared = {};

function sharedMaterials() {
  if (shared.glass) {
    return shared;
  }
  // Details are thin sheets just above the skin: `onSkin` keeps them from
  // flickering against it.
  const onSkin = { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 };
  shared.glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c14, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, ...onSkin });
  shared.seam = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 1, ...onSkin });
  shared.housing = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.25, metalness: 0.4, ...onSkin });
  shared.plate = new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.5, emissive: 0x333330, ...onSkin });
  shared.chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 1, roughness: 0.15 });
  shared.mirror = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, metalness: 1, roughness: 0.05 });
  shared.tire = new THREE.MeshStandardMaterial({ color: 0x121215, roughness: 0.9 });
  shared.disc = new THREE.MeshStandardMaterial({ color: 0x8d929c, metalness: 0.9, roughness: 0.42 });
  shared.arch = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 1 });
  shared.rim = new THREE.MeshStandardMaterial({ color: 0xe2e6ee, metalness: 1, roughness: 0.18 });
  shared.dark = new THREE.MeshStandardMaterial({ color: 0x15161c, metalness: 0.5, roughness: 0.45 });
  shared.carbon = new THREE.MeshStandardMaterial({ color: 0x1b1d24, metalness: 0.3, roughness: 0.3 });
  shared.caliper = new THREE.MeshStandardMaterial({ color: 0xd8202a, metalness: 0.3, roughness: 0.4 });
  shared.headlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 4.5, ...onSkin });
  // Not too bright, or the red washes out to orange or white.
  shared.taillight = new THREE.MeshStandardMaterial({ color: 0xa8000e, emissive: 0xff0022, emissiveIntensity: 1.35, ...onSkin });
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

function acrossUv(geometry, width) {
  const position = geometry.attributes.position;
  const uvs = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uvs[i * 2] = position.getX(i) / width + 0.5;
    uvs[i * 2 + 1] = 0.5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

// The height of the top of the body at `along` meters (forward is +), read
// from the outline's top edge (from the nose back to the tail).
function topHeight(spec, along) {
  const top = spec.body.slice(2);
  for (let i = 0; i < top.length - 1; i += 1) {
    const [x1, y1] = top[i];
    const [x2, y2] = top[i + 1];
    if (along <= x1 && along >= x2) {
      return y1 + ((x1 - along) / (x1 - x2)) * (y2 - y1);
    }
  }
  return top[0][1];
}

// Side graphics: a flat sheet the shape of the car's side, laid just
// outside each flat side panel. One texture maps the car's length and
// height (meters) onto the canvas.
function sideGraphics(spec, kind, color) {
  const texture = decalTexture(kind, color);
  texture.repeat.set(1 / 5, 1 / 1.3);
  texture.offset.set(0.5, -0.1 / 1.3);
  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    roughness: 0.3,
    clearcoat: 1,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const sides = new THREE.Group();
  [-1, 1].forEach((side) => {
    const geometry = new THREE.ShapeGeometry(bodyShape(spec.body), 28);
    // Pull in a little from the edges, which are rounded on the body.
    geometry.translate(0, -0.6, 0);
    geometry.scale(0.97, 0.92, 1);
    geometry.translate(0, 0.6, 0);
    // The outline is drawn from the side: along the car, and up. Lay it
    // just outside the body's side, which curves.
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const along = position.getX(i);
      const up = position.getY(i);
      position.setXYZ(i, side * ((spec.width / 2) * widthShare(spec, along, up) + 0.006), up, along);
    }
    geometry.computeVertexNormals();
    sides.add(new THREE.Mesh(geometry, material));
  });
  return sides;
}

// Something sticking out of the hood: a scoop, or a supercharger.
function hoodPart(spec, kind, paint, materials) {
  const along = (spec.body[3][0] + spec.cabin[0][0]) / 2;
  const front = topHeight(spec, along + 0.4);
  const back = topHeight(spec, along - 0.4);
  const part = new THREE.Group();
  part.position.set(0, topHeight(spec, along) + 0.1, along);
  part.rotation.x = Math.atan2(back - front, 0.8);
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

function makeWheel(radius, side, materials) {
  const wheel = new THREE.Group();
  const half = radius * 0.36;
  // The tire: a flat tread with rounded shoulders, turned around the axle.
  const outline = [[0.6, -1], [0.9, -1], [1, -0.7], [1, 0.7], [0.9, 1], [0.6, 1]].map(([out, across]) => new THREE.Vector2(out * radius, across * half));
  const tire = new THREE.Mesh(new THREE.LatheGeometry(outline, 40), materials.tire);
  tire.rotation.z = Math.PI / 2;
  wheel.add(tire);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, half * 1.9, 32, 1, true), materials.rim);
  barrel.rotation.z = Math.PI / 2;
  wheel.add(barrel);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.62, radius * 0.035, 8, 40), materials.rim);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = side * half * 0.95;
  wheel.add(lip);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 0.04, 32), materials.disc);
  disc.rotation.z = Math.PI / 2;
  wheel.add(disc);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.15, radius * 0.18, half * 1.5, 20), materials.rim);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  // Five twin spokes near the outer face, so you can see the wheels turn.
  const spoke = new THREE.BoxGeometry(0.05, radius * 0.5, 0.035);
  spoke.translate(0, radius * 0.38, 0);
  for (let i = 0; i < 5; i += 1) {
    const pair = new THREE.Group();
    [-0.045, 0.045].forEach((offset) => {
      const bar = new THREE.Mesh(spoke, materials.rim);
      bar.position.set(side * half * 0.62, 0, offset);
      pair.add(bar);
    });
    pair.rotation.x = (i / 5) * Math.PI * 2;
    wheel.add(pair);
  }
  return wheel;
}

// A rounded arch over a wheel, so the tire sits in the body, not under it.
function fender(radius, paint) {
  const geometry = new THREE.CylinderGeometry(radius * 1.2, radius * 1.2, 0.52, 28, 1, true, 0, Math.PI);
  geometry.rotateZ(Math.PI / 2);
  return new THREE.Mesh(geometry, paint);
}

// custom: { finish, stripes, stripeColor, rims, wing, glow } (see
// CUSTOM_OPTIONS in world.js). Returns { group, setColor, setHeadlights,
// emitters, update }. setHeadlights(on, real): `real` adds a true spotlight
// (not on phones).
export function buildCar(design, color, custom) {
  const spec = DESIGNS[design];
  const materials = { ...sharedMaterials() };
  materials.rim = new THREE.MeshStandardMaterial({ ...RIM_COLORS[custom.rims], side: THREE.DoubleSide });
  const paint = paintMaterial(custom.finish);
  // The wheel arches are thin shells, seen from both sides.
  paint.side = THREE.DoubleSide;
  // Body panels: with stripes, the color comes from the stripe texture.
  const bodyPaint = paintMaterial(custom.finish);
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

  const { front, back, floor, belt } = measure(spec);
  // UVs first (stripes run straight down the car), then the sculpting.
  const outline = sideSolid(bodyShape(spec.body), spec.width, BODY_EDGE);
  acrossUv(outline, spec.width);
  body.add(new THREE.Mesh(smoothNormals(sculpt(outline, spec)), bodyPaint));
  if (custom.decal !== 'none') {
    body.add(sideGraphics(spec, custom.decal, custom.decalColor));
  }
  // The cabin is painted like the body (stripes run over its roof too).
  const roof = Math.max(...spec.cabin.map(([, y]) => y));
  const lean = { amount: 0.2, from: belt - 0.1, to: roof };
  const canopy = sideSolid(cabinShape(spec.cabin), spec.cabinWidth, CABIN_EDGE);
  acrossUv(canopy, spec.width);
  body.add(new THREE.Mesh(smoothNormals(sculpt(canopy, spec, lean)), bodyPaint));

  // Half the width of the body and of the cabin at any spot.
  const bodyHalf = (along, up) => (spec.width / 2) * widthShare(spec, along, up);
  const cabinHalf = (along, up) => (spec.cabinWidth / 2) * widthShare(spec, along, up) * (1 - lean.amount * smooth(lean.from, lean.to, up));
  // The skin of the body and of the cabin, seen from the side: their
  // outlines, grown by their rounded edges. `skin` is a hair above the
  // paint; `above` a hair above that, for a detail on top of a detail.
  const skin = outlinePoints(bodyShape(spec.body), BODY_EDGE * EDGE_GROWS + 0.006);
  const above = outlinePoints(bodyShape(spec.body), BODY_EDGE * EDGE_GROWS + 0.014);
  const roofSkin = outlinePoints(cabinShape(spec.cabin), CABIN_EDGE * EDGE_GROWS + 0.006);
  const bodyEdge = outlinePoints(bodyShape(spec.body), 0);
  const cabinEdge = outlinePoints(cabinShape(spec.cabin), 0);
  // Sheets of the same material are joined into one mesh at the end, so
  // all these details cost only a few draw calls.
  const sheets = new Map();
  const trim = [];
  const laid = (geometry, material) => {
    if (!sheets.has(material)) {
      sheets.set(material, []);
    }
    sheets.get(material).push(geometry);
  };
  // The same strip on both sides of the car.
  const pair = (points, half, from, to, material) => {
    laid(skinStrip(points, half, from, to), material);
    laid(skinStrip(points, half, -to, -from), material);
  };

  // Glass: the windshield and the rear window follow the roofline, and
  // two side windows a side sit in the cabin's flat flanks, with a pillar
  // between them.
  const [cabinFront, roofFront, roofBack, cabinBack] = spec.cabin.map(([x]) => x);
  const overBody = (point) => point.up > edgeAt(bodyEdge, point.along, Math.max) + 0.06;
  laid(skinStrip(stretch(roofSkin, (point) => point.along > roofFront + 0.04 && point.along < cabinFront && overBody(point)), cabinHalf, -0.8, 0.8), materials.glass);
  laid(skinStrip(stretch(roofSkin, (point) => point.along < roofBack - 0.04 && point.along > cabinBack && overBody(point)), cabinHalf, -0.8, 0.8), materials.glass);
  const sill = (along) => Math.max(edgeAt(cabinEdge, along, Math.min), edgeAt(bodyEdge, along, Math.max) + BODY_EDGE * EDGE_GROWS) + 0.035;
  const header = (along) => edgeAt(cabinEdge, along, Math.max) - 0.05;
  const pillar = (roofFront + roofBack) / 2;
  [-1, 1].forEach((side) => {
    laid(sidePatch(side, cabinFront - 0.16, pillar + 0.045, sill, header, cabinHalf), materials.glass);
    laid(sidePatch(side, pillar - 0.045, cabinBack + 0.16, sill, header, cabinHalf), materials.glass);
  });

  // The nose: headlights in dark housings, and a grille below them.
  const lightY = spec.body[2][1] + 0.04;
  const onNose = (point) => point.along > front - 0.7;
  const onTail = (point) => point.along < back + 0.7;
  pair(stretch(skin, (point) => onNose(point) && point.up > lightY - 0.06 && point.up < lightY + 0.13), bodyHalf, 0.3, 0.8, materials.housing);
  pair(stretch(above, (point) => onNose(point) && point.up > lightY - 0.03 && point.up < lightY + 0.1), bodyHalf, 0.36, 0.76, materials.headlight);
  laid(skinStrip(stretch(above, (point) => onNose(point) && point.up > lightY - 0.045 && point.up < lightY - 0.02), bodyHalf, -0.28, 0.28), materials.headlight);
  laid(skinStrip(stretch(skin, (point) => onNose(point) && point.up > floor + 0.02 && point.up < lightY - 0.09), bodyHalf, -0.56, 0.56), materials.seam);

  // The tail: a light bar from side to side in a dark housing, brighter
  // blocks at its ends, and a number plate below.
  const tailTop = spec.body[spec.body.length - 2][1];
  laid(skinStrip(stretch(skin, (point) => onTail(point) && point.up > tailTop - 0.3 && point.up < tailTop - 0.04), bodyHalf, -0.82, 0.82), materials.housing);
  laid(skinStrip(stretch(above, (point) => onTail(point) && point.up > tailTop - 0.2 && point.up < tailTop - 0.15), bodyHalf, -0.78, 0.78), materials.taillight);
  pair(stretch(above, (point) => onTail(point) && point.up > tailTop - 0.26 && point.up < tailTop - 0.08), bodyHalf, 0.46, 0.78, materials.taillight);
  laid(skinStrip(stretch(skin, (point) => onTail(point) && point.up > floor + 0.1 && point.up < floor + 0.26), bodyHalf, -0.2, 0.2), materials.plate);

  // The hood: two creases, and a pair of vents when nothing else is on it.
  const hood = (point) => point.along > cabinFront + 0.12 && point.along < front - 0.4 && point.up > lightY + 0.12;
  pair(stretch(skin, hood), bodyHalf, 0.5, 0.515, materials.seam);
  if (custom.hood === 'none' && front - cabinFront > 1.1) {
    pair(stretch(skin, (point) => hood(point) && point.along < cabinFront + 0.62 && point.along > cabinFront + 0.3), bodyHalf, 0.14, 0.4, materials.seam);
  }

  // The sides: the lines of a door, its handle, and a vent behind the
  // front wheel.
  const bodyTop = (along) => edgeAt(bodyEdge, along, Math.max) - 0.07;
  const doorFront = cabinFront - 0.1;
  const doorBack = pillar - 0.5;
  [-1, 1].forEach((side) => {
    [doorFront, doorBack].forEach((along) => {
      laid(sidePatch(side, along - 0.007, along + 0.007, () => floor + 0.14, bodyTop, bodyHalf), materials.seam);
    });
    laid(sidePatch(side, doorBack, doorFront, () => floor + 0.14, () => floor + 0.152, bodyHalf), materials.seam);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.16), materials.chrome);
    const handleUp = bodyTop(doorBack + 0.2) - 0.07;
    handle.position.set(side * (bodyHalf(doorBack + 0.2, handleUp) + 0.008), handleUp, doorBack + 0.2);
    body.add(handle);
    trim.push(handle);
    const ventFrom = spec.wheelBase - spec.wheel * 1.55;
    laid(sidePatch(side, ventFrom - 0.3, ventFrom, () => floor + 0.2, (along) => floor + 0.2 + (ventFrom - along) * 0.55, bodyHalf), materials.seam);
  });
  // Thin sheets and small trim throw no shadow worth drawing.
  const noShadow = [];
  sheets.forEach((geometries, material) => {
    const mesh = new THREE.Mesh(THREE.mergeGeometries(geometries), material);
    noShadow.push(mesh);
    body.add(mesh);
    geometries.forEach((geometry) => geometry.dispose());
  });

  // Dark lower lip, side skirts and a rear diffuser.
  const skirtShape = new THREE.BoxGeometry(spec.width - 0.02, 0.14, front - back - 0.4, 1, 1, 16);
  skirtShape.translate(0, floor + 0.03, (front + back) / 2);
  body.add(new THREE.Mesh(sculpt(skirtShape, spec), materials.carbon));
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.5, 0.22, 0.3), materials.carbon);
  diffuser.position.set(0, spec.body[0][1] + 0.08, back + 0.12);
  body.add(diffuser);
  for (let i = 0; i < 5; i += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.34), materials.dark);
    fin.position.set((i - 2) * 0.22, floor + 0.04, back + 0.1);
    body.add(fin);
    trim.push(fin);
  }
  // Mirrors: a painted shell on a stalk, with the glass facing back.
  [-1, 1].forEach((side) => {
    const along = cabinFront - 0.3;
    const up = sill(along) + 0.07;
    const out = cabinHalf(along, up);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.05), materials.dark);
    stalk.position.set(side * (out + 0.06), up - 0.02, along);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), paint);
    shell.scale.set(0.11, 0.065, 0.075);
    shell.position.set(side * (out + 0.16), up + 0.01, along);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 16), materials.mirror);
    glass.scale.set(0.09, 0.05, 1);
    glass.rotation.y = Math.PI;
    glass.position.set(side * (out + 0.16), up + 0.01, along - 0.06);
    body.add(stalk, shell, glass);
    trim.push(stalk, glass);
  });

  const exhaustSpots = [];
  const flames = [];
  [-1, 1].forEach((side) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 16), materials.rim);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.45, spec.body[0][1] + 0.12, back);
    body.add(pipe);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 16, 1, true), materials.flame);
    // Wide at the pipe, pointing backward.
    flame.geometry.translate(0, 0.55, 0);
    flame.rotation.x = -Math.PI / 2;
    flame.position.copy(pipe.position);
    flame.position.z -= 0.12;
    flame.visible = false;
    body.add(flame);
    flames.push(flame);
    const spot = new THREE.Object3D();
    spot.position.set(side * 0.45, spec.body[0][1] + 0.12, back - 0.3);
    body.add(spot);
    exhaustSpots.push(spot);
  });

  // A rear wing: the car's own choice, none, a small lip, or a big wing.
  let wingStyle = custom.wing;
  if (wingStyle === 'auto') {
    wingStyle = spec.wing ? 'big' : 'none';
  }
  if (wingStyle === 'small') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.3, 0.06, 0.3), materials.carbon);
    lip.position.set(0, tailTop + 0.08, back + 0.22);
    lip.rotation.x = -0.25;
    body.add(lip);
  }
  if (wingStyle === 'big') {
    const height = tailTop + 0.36;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.06, 0.44), materials.carbon);
    wing.position.set(0, height, back + 0.3);
    wing.rotation.x = -0.1;
    body.add(wing);
    [-1, 1].forEach((side) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.2), materials.carbon);
      strut.position.set(side * 0.55, height - 0.18, back + 0.32);
      body.add(strut);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.5), paint);
      plate.position.set(side * spec.width / 2, height + 0.03, back + 0.3);
      body.add(plate);
    });
  }

  if (custom.hood !== 'none') {
    body.add(hoodPart(spec, custom.hood, paint, materials));
  }

  if (spec.rack) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.6), materials.dark);
    rack.position.set(0, 1.88, -0.45);
    body.add(rack);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.1), materials.headlight);
    bar.position.set(0, 1.86, 0.4);
    body.add(bar);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(bodyHalf(front, lightY) * 2 + 0.1, 0.22, 0.22), materials.dark);
    bumper.position.set(0, 0.62, front - 0.05);
    body.add(bumper);
  }

  // Wheels: the front pair steers, all spin; red brake calipers peek out.
  const wheels = [];
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([end, side]) => {
    const holder = new THREE.Group();
    holder.position.set(side * spec.track, spec.wheel, end * spec.wheelBase);
    const wheel = makeWheel(spec.wheel, side, materials);
    holder.add(wheel);
    const hump = fender(spec.wheel, paint);
    hump.position.set(side * (spec.track - 0.09), spec.wheel - spec.ride, end * spec.wheelBase);
    body.add(hump);
    // A dark wheel well behind the tire.
    const well = new THREE.Mesh(new THREE.CircleGeometry(spec.wheel * 1.12, 28), materials.arch);
    well.rotation.y = side * Math.PI / 2;
    well.position.set(side * ((spec.width / 2) * widthShare(spec, end * spec.wheelBase, spec.wheel) + 0.005), spec.wheel - spec.ride, end * spec.wheelBase);
    body.add(well);
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.1, spec.wheel * 0.5, spec.wheel * 0.7), materials.caliper);
    caliper.position.set(side * -0.06, spec.wheel * 0.25, 0);
    holder.add(caliper);
    group.add(holder);
    wheels.push({ holder, wheel, front: end === 1 });
  });

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
  [...noShadow, ...trim].forEach((mesh) => {
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
