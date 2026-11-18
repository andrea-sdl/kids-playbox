// All foliage is solid geometry. Several forked boughs share a small library
// of painted leaf sprays, with a different silhouette and tilt on each bough.
import * as T from '../../vendor/three/three.min.js';

const tau = Math.PI * 2;
const ink = ['#443d35', '#5b5041', '#6b5b48', '#786448', '#867150', '#99815d'];
const moss = ['#505a37', '#647443', '#839050', '#9ca25b'];
const granite = ['#515952', '#667268', '#788076', '#8e9682'];
const grass = ['#536a3d', '#74894b', '#83924e', '#96a158', '#adb567', '#b4a562'];
const colourCache = new Map();
const leafMeshes = new Map();

function colour(hex) {
  if (!colourCache.has(hex)) colourCache.set(hex, new T.Color(hex));
  return colourCache.get(hex);
}

function random(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(1664525, n) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function choose(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

class Paint {
  constructor() {
    this.position = [];
    this.colours = [];
    this.uv = [];
    this.baseY = 0;
    this.mist = 0;
  }

  triangle(a, b, c, pigment) {
    const { r, g, b: blue } = colour(pigment);
    const lift = this.baseY;
    this.position.push(a[0], a[1] + lift, a[2], b[0], b[1] + lift, b[2], c[0], c[1] + lift, c[2]);
    const red = r + (0.24 - r) * this.mist;
    const green = g + (0.38 - g) * this.mist;
    const skyBlue = blue + (0.39 - blue) * this.mist;
    this.colours.push(red, green, skyBlue, red, green, skyBlue, red, green, skyBlue);
  }

  geometry() {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(this.position, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(this.colours, 3));
    if (this.uv.length) geo.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}

const pigment = new T.MeshLambertMaterial({
  vertexColors: true,
  side: T.DoubleSide,
  emissive: '#292821',
  emissiveIntensity: 0.2,
});

// A ribbon of folded leaves makes a scalloped and porous outer edge. Each
// spray has three branchlets. The leaves share a crease and two paint tones.
const leafPaint = {
  woodland: ['#36584a', '#4d6e46', '#648345', '#78944b', '#98a859', '#b4b972'],
  cedar: ['#294f48', '#3a6452', '#507854', '#618656', '#83a16b', '#a6ae74'],
  orchard: ['#577249', '#678951', '#7f9b5d', '#a2ac6d', '#c8c992', '#e3d9ab'],
  thicket: ['#435c40', '#55733e', '#6e884c', '#859b54', '#a6af63', '#b8b979'],
};

// One folded surface carries a hand-sized twig of smaller painted leaves.
// Each individual mark tapers at both ends, with a lit half and a midrib.
// Cutting away the spaces between leaves keeps distant crowns airy.
function leafMarks() {
  const size = 128,
    bytes = new Uint8Array(size * size * 4),
    rng = random(19042);
  function mark(ax, ay, bx, by, radius, value) {
    const dx = bx - ax,
      dy = by - ay,
      lengthSq = dx * dx + dy * dy;
    const width = Math.sqrt(lengthSq);
    const ymin = Math.max(0, Math.floor(Math.min(ay, by) - radius));
    const ymax = Math.min(size - 1, Math.ceil(Math.max(ay, by) + radius));
    for (let y = ymin; y <= ymax; y++) {
      const xmin = Math.max(0, Math.floor(Math.min(ax, bx) - radius));
      const xmax = Math.min(size - 1, Math.ceil(Math.max(ax, bx) + radius));
      for (let x = xmin; x <= xmax; x++) {
        const u = ((x - ax) * dx + (y - ay) * dy) / lengthSq;
        if (u <= 0 || u >= 1) continue;
        const across = ((x - ax) * dy - (y - ay) * dx) / width;
        const edge = radius * (1 - Math.abs(u * 2 - 1) ** 1.65);
        if (Math.abs(across) > edge) continue;
        const hue = value + (across > 0 ? 7 : -10) + (Math.abs(across) < 0.45 ? 12 : 0);
        const offset = (y * size + x) * 4;
        bytes[offset] = hue;
        bytes[offset + 1] = hue;
        bytes[offset + 2] = hue - 4;
        bytes[offset + 3] = 255;
      }
    }
  }
  mark(3, 64, 124, 64, 2.4, 179);
  for (let i = 0; i < 10; i++) {
    const x = 10 + i * 10;
    const rise = 5 + Math.sin(((i + 1) * Math.PI) / 11) * 38;
    for (const sign of [-1, 1]) {
      const tipx = Math.min(121, x + 10 + 12 * rng()),
        tipy = 64 + sign * (rise + 4 * rng());
      mark(x, 64, tipx, tipy, 1.5, 180);
      for (let j = 0; j < 4; j++) {
        const u = 0.17 + j * 0.19;
        const lx = x + (tipx - x) * u,
          ly = 64 + (tipy - 64) * u;
        const a = sign * (0.33 + j * 0.16 + rng() * 0.48);
        const length = 8 + rng() * 11;
        mark(
          lx,
          ly,
          lx + length * Math.cos(a),
          ly + length * Math.sin(a),
          2.7 + rng() * 2.3,
          211 + Math.floor(rng() * 33),
        );
      }
      mark(tipx - 4, tipy - sign * 5, tipx + 8, tipy + sign * 9, 3.9, 232);
    }
  }
  // The solid texel is for flower petals painted on the same 3D sprig.
  bytes.set([255, 255, 255, 255], 0);
  const texture = new T.DataTexture(bytes, size, size);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
const foliagePaint = pigment.clone();
foliagePaint.map = leafMarks();
foliagePaint.alphaTest = 0.4;
foliagePaint.alphaToCoverage = true;

function foldedLeaf(paint, x, y, z, len, width, angle, lift, twist, dark, light, textured = false) {
  const dx = Math.cos(angle),
    dz = Math.sin(angle);
  const root = [x, y, z];
  const tip = [x + len * dx, y + lift, z + len * dz];
  const cx = x + len * dx * 0.48,
    cz = z + len * dz * 0.48;
  const left = [cx - width * dz, y + lift * 0.43 - width * 0.32 + twist, cz + width * dx];
  const right = [cx + width * dz, y + lift * 0.43 - width * 0.32 - twist, cz - width * dx];
  paint.triangle(root, left, tip, dark);
  paint.triangle(root, tip, right, light);
  if (textured) paint.uv.push(0, 0.5, 0.5, 1, 1, 0.5, 0, 0.5, 1, 0.5, 0.5, 0);
}

function leafSpray(type, variant) {
  const key = type + variant;
  if (leafMeshes.has(key)) return leafMeshes.get(key);
  const rng = random(4811 + variant * 211 + type.charCodeAt(0) * 991);
  const palette = leafPaint[type];
  const paint = new Paint();
  const length = type === 'cedar' ? 0.52 : 0.6;
  for (let stem = 0; stem < 6; stem++) {
    const angle = (tau * (stem + rng() * 0.6)) / 6;
    const reach = 0.58 + rng() * 0.52;
    const rise = 0.08 + rng() * 0.36;
    const cx = Math.cos(angle),
      cz = Math.sin(angle);
    const baseY = -0.09 + rng() * 0.16;
    paint.triangle(
      [-0.02, baseY - 0.02, 0],
      [0.02, baseY + 0.02, 0],
      [reach * cx, baseY + rise, reach * cz],
      palette[1],
    );
    paint.uv.push(0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    for (let node = 0; node < 3; node++) {
      const t = (node + 0.35) / 3;
      const a = reach * t;
      for (const side of [-1, 1]) {
        const leafAngle = angle + side * (0.55 + rng() * 0.6);
        const size = length * (1.25 - 0.45 * t + 0.35 * rng());
        const shade = Math.min(4, Math.floor(1.7 * t + 2.6 * rng()));
        foldedLeaf(
          paint,
          cx * a,
          baseY + rise * t,
          cz * a,
          size,
          size * (0.22 + rng() * 0.2),
          leafAngle,
          size * (0.36 - 0.77 * rng()),
          size * (0.32 - rng() * 0.65),
          palette[shade],
          palette[shade + 1],
          true,
        );
      }
      if (type === 'orchard' && node === 2) {
        const petals = ['#e7e5c7', '#fcf3dc', '#efddbe', '#f1caba'];
        for (let i = 0; i < 5; i++) {
          const flowerAngle = (tau * i) / 5 + angle;
          foldedLeaf(
            paint,
            cx * a,
            baseY + rise * t + 0.24,
            cz * a,
            0.21,
            0.11,
            flowerAngle,
            0.12,
            0.034,
            choose(rng, petals),
            '#fff1cf',
          );
          for (let vertex = 0; vertex < 6; vertex++) paint.uv.push(0.5 / 128, 0.5 / 128);
        }
      }
    }
  }
  const result = paint.geometry();
  leafMeshes.set(key, result);
  return result;
}

// Tapered rings follow each bend in the branch. Uneven ridges at the base
// become shallow bark flutes near the tips. One side catches the dawn light.
function barkGrain() {
  const size = 192;
  const rgba = new Uint8Array(size * size * 4);
  const rng = random(4923);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (y / size) * tau;
      const curl = x + 2.7 * Math.sin(t + x * 0.23) + 1.2 * Math.sin(2 * t + x * 0.35);
      const furrow = Math.sin(curl * 0.47 + 1.39 * Math.sin(curl * 0.71));
      const fibre = Math.sin(curl * 2.74 + 0.37 * Math.sin(t * 5));
      let v = 206 + furrow * 15 + fibre * 10 + rng() * 11;
      if (furrow < -0.82 && Math.sin(t * 3 + curl) > 0.2) v -= 32;
      const j = (y * size + x) * 4;
      rgba[j] = v + 4;
      rgba[j + 1] = v;
      rgba[j + 2] = v - 6;
      rgba[j + 3] = 255;
    }
  }
  const tex = new T.DataTexture(rgba, size, size);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.magFilter = T.LinearFilter;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = T.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
const woodyPaint = pigment.clone();
woodyPaint.map = barkGrain();

function branch(paint, path, rng, bark = ink, sides = 8) {
  const phase = rng() * tau;
  const ridges = Array.from({ length: sides }, () => 0.76 + rng() * 0.41);
  const rings = path.map(([x, y, z, radius], j) => {
    const ring = [];
    const from = path[Math.max(0, j - 1)],
      to = path[Math.min(path.length - 1, j + 1)];
    const tangent = new T.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
    const normal = new T.Vector3(0, 0, 1).cross(tangent);
    if (normal.lengthSq() < 0.005) normal.set(1, 0, 0);
    normal.normalize();
    const binormal = new T.Vector3().crossVectors(tangent, normal);
    for (let k = 0; k < sides; k++) {
      const a = phase + (tau * k) / sides + 0.045 * j;
      const r = radius * ridges[k];
      const u = r * Math.cos(a),
        v = r * Math.sin(a);
      ring.push([
        x + u * normal.x + v * binormal.x,
        y + u * normal.y + v * binormal.y,
        z + u * normal.z + v * binormal.z,
      ]);
    }
    return ring;
  });
  for (let i = 1; i < rings.length; i++) {
    const lower = rings[i - 1],
      upper = rings[i];
    for (let k = 0; k < sides; k++) {
      const next = (k + 1) % sides;
      const lit = 0.5 + 0.44 * Math.cos(phase + (k * tau) / sides + 0.5);
      const shade = Math.min(bark.length - 1, Math.floor(lit * (bark.length - 1) + 0.6 * rng()));
      paint.triangle(lower[k], lower[next], upper[k], bark[shade]);
      paint.triangle(lower[next], upper[next], upper[k], bark[shade]);
      const u = (k / sides) * tau * path[0][3],
        around = ((k + 1) / sides) * tau * path[0][3];
      const v = (i - 1) * 0.8,
        along = i * 0.8;
      paint.uv.push(u, v, around, v, u, along, around, v, around, along, u, along);
      if (i < 3 && path[0][3] > 0.35) {
        const a = new T.Vector3(...lower[k]),
          b = new T.Vector3(...lower[next]);
        const c = new T.Vector3(...upper[k]),
          d = new T.Vector3(...upper[next]);
        const width = 0.05 + rng() * 0.1;
        paint.triangle(
          a.clone().lerp(b, 0.19).toArray(),
          a
            .clone()
            .lerp(b, 0.19 + width)
            .toArray(),
          c.lerp(d, 0.26).toArray(),
          choose(rng, ['#695b46', '#907a55', '#556249']),
        );
        paint.uv.push(u, v, around, v, u, along);
      }
    }
  }
}

const profiles = {
  meadow: [3, 4, 6, 'woodland'],
  ridge: [2, 3, 5, 'woodland'],
  roots: [15, 8, 13, 'cedar'],
  grove: [12, 8, 12, 'cedar'],
  orchard: [11, 3.1, 5, 'orchard'],
  house: [7, 5, 8, 'woodland'],
  causeway: [3, 4, 6, 'woodland'],
  marsh: [5, 4, 7, 'woodland'],
  viaduct: [2, 4, 6, 'woodland'],
  observatory: [6, 5, 8, 'woodland'],
  gorge: [3, 5, 8, 'woodland'],
  falls: [8, 6, 10, 'cedar'],
};

function oldTree(paint, addSpray, rng, x, z, h, kind) {
  const r = h * (0.044 + rng() * 0.034);
  const lean = h * (rng() - 0.48) * (kind === 'orchard' ? 0.83 : 0.47);
  const tilt = (rng() - 0.5) * h * 0.24;
  const trunk = [
    [x, -0.08, z, r * 1.55],
    [x - lean * 0.09, h * 0.16, z + tilt * 0.1, r],
    [x + lean * 0.25, h * 0.37, z + tilt * 0.34, r * 0.83],
    [x + lean * 0.49, h * 0.58, z + tilt * 0.62, r * 0.63],
    [x + lean * 0.83, h * 0.77, z + tilt * 0.87, r * 0.38],
    [x + lean, h, z + tilt, 0.04],
  ];
  branch(paint, trunk, rng, ink, 10);
  const turn = rng() * tau;
  for (let root = 0; root < 5; root++) {
    const angle = turn + (root * tau) / 5,
      extend = r * (2.2 + rng() * 1.8);
    const dx = Math.cos(angle) * extend,
      dz = Math.sin(angle) * extend;
    branch(
      paint,
      [
        [x, h * 0.13, z, r * 0.43],
        [x + dx * 0.32, h * 0.04, z + dz * 0.38, r * 0.45],
        [x + dx, 0.015, z + dz, 0.05],
      ],
      rng,
      moss,
      6,
    );
  }
  const crownBase = 0.31 + rng() * 0.21;
  const spread = 0.82 + rng() * 0.47;
  const count = 7 + Math.floor(rng() * 3);
  for (let b = 0; b < count; b++) {
    const t = b / count,
      y = h * (crownBase + (0.91 - crownBase) * t);
    const angle = turn + b * 2.4 + rng() * 0.48;
    const length =
      h * spread * (0.22 + 0.15 * rng()) * (1 - 0.59 * t) * (1 + 0.16 * Math.cos(angle - turn));
    const dx = Math.cos(angle) * length,
      dz = Math.sin(angle) * length;
    const bx = x + lean * (0.3 + t * 0.6),
      bz = z + tilt * (0.32 + t * 0.62);
    const elbow = [bx + dx * 0.49, y + h * 0.04, bz + dz * 0.43];
    const end = [bx + dx, y + h * (0.09 + rng() * 0.11), bz + dz];
    branch(
      paint,
      [
        [bx, y, bz, r * 0.42],
        [...elbow, r * 0.23],
        [...end, 0.032],
      ],
      rng,
      ink,
      6,
    );
    for (const fork of [-1, 1]) {
      const sx = end[0] + (fork * dz * 0.42 - dx * 0.17);
      const sz = end[2] - (fork * dx * 0.42 + dz * 0.12);
      const sy = end[1] + rng() * 0.22 * length;
      branch(
        paint,
        [
          [...elbow, r * 0.14],
          [sx, sy, sz, 0.014],
        ],
        rng,
        ink,
        4,
      );
      const layers = paint.mist > 0.13 && b % 2 === 0 ? 1 : 2;
      for (let layer = 0; layer < layers; layer++) {
        const scale = h * (0.16 + 0.1 * rng()) * (1 - 0.38 * t);
        addSpray(
          kind,
          sx + dx * layer * 0.14,
          sy + scale * layer * 0.2,
          sz + dz * layer * 0.14,
          scale,
          angle + fork * 0.75 + layer * 1.8,
          rng() * 0.7 - 0.26,
          0.73 + 0.23 * t + layer * 0.12,
        );
      }
    }
  }
  addSpray(kind, x + lean, h, z + tilt, h * 0.13, turn, 0.4, 1.06);
}

function rock(paint, rng, x, z, size) {
  const rotation = tau * rng();
  const base = [],
    rim = [],
    cap = [];
  const h = size * (0.34 + 0.4 * rng());
  for (let i = 0; i < 8; i++) {
    const a = (tau * i) / 8 + rotation,
      r = size * (0.77 + 0.29 * rng());
    const dx = Math.cos(a) * r,
      dz = Math.sin(a) * r * 0.65;
    base.push([x + dx, -0.045, z + dz]);
    rim.push([x + dx * 0.94, h * (0.26 + 0.31 * rng()), z + dz * 0.94]);
    cap.push([x + dx * 0.53, h * (0.68 + 0.27 * rng()), z + dz * 0.51]);
  }
  const summit = [x - size * 0.14, h, z - size * 0.08];
  for (let i = 0; i < 8; i++) {
    const k = (i + 1) % 8;
    paint.triangle(base[i], base[k], rim[i], granite[i % 3]);
    paint.triangle(base[k], rim[k], rim[i], granite[i % 3]);
    paint.triangle(rim[i], rim[k], cap[i], choose(rng, granite));
    paint.triangle(rim[k], cap[k], cap[i], choose(rng, moss));
    paint.triangle(cap[i], cap[k], summit, choose(rng, moss));
  }
}

export function woodland(room, index, span, elevation = () => 0) {
  const group = new T.Group();
  group.name = 'Vegetation · ' + room;
  const profile = profiles[room];
  if (!profile) return group;
  const [count, low, high, kind] = profile;
  const rng = random(34088 + index * 7901),
    paint = new Paint(),
    wood = new Paint(),
    instances = new Map();
  const location = new T.Object3D();
  let rootY = 0;
  let mist = 0;
  function addSpray(type, x, y, z, scale, yaw, roll, value) {
    const shape = leafSpray(type, Math.floor(rng() * 3));
    if (!instances.has(shape)) instances.set(shape, []);
    location.position.set(x, y + rootY, z);
    location.rotation.set(roll, yaw, rng() * 0.55 - 0.25);
    location.scale.set(scale * (1 + rng() * 0.27), scale * 0.83, scale);
    location.updateMatrix();
    instances.get(shape).push([location.matrix.clone(), value, mist]);
  }
  const open = count < 6;
  const bridge = room === 'viaduct';
  const onDeck = (x, z) => bridge && (Math.abs(z) < 3.8 || (x > span * 0.14 && x < span * 0.86));
  for (let i = 0; i < count; i++) {
    let x = ((i + 0.15 + rng() * 0.7) * span) / count;
    if (bridge) x = (i === 0 ? 0.04 + rng() * 0.04 : 0.92 + rng() * 0.04) * span;
    // Nearer trees frame the edges of shady rooms. Open areas keep the
    // center of the valley and the distant landmarks visible.
    let z = -9 - rng() * 14;
    if (!open && (i === 0 || i === count - 1)) z = -4.6 - rng() * 2;
    if (open && x > span * 0.18 && x < span * 0.82) z -= 8;
    rootY = wood.baseY = elevation(x, z);
    const depth = Math.min(1, Math.max(0, (-z - 6) / 17));
    mist = wood.mist = depth * 0.44;
    oldTree(wood, addSpray, rng, x, z, (low + rng() * (high - low)) * (1 - 0.48 * depth), kind);
  }
  const brushCount = open ? 32 : 71;
  for (let i = 0; i < brushCount; i++) {
    const x = rng() * span,
      z = -3.2 - rng() * (open ? 13 : 9);
    if (onDeck(x, z)) continue;
    rootY = elevation(x, z);
    mist = Math.max(0, -z - 5) * 0.025;
    const size = 0.25 + rng() * (open ? 0.63 : 1.07);
    for (let tier = 0; tier < 3; tier++) {
      addSpray(
        'thicket',
        x + 0.08 * tier,
        size * (0.18 + 0.22 * tier),
        z - 0.08 * tier,
        size * (1.04 - 0.16 * tier),
        rng() * tau,
        rng() * 0.8 - 0.32,
        0.7 + 0.16 * tier,
      );
    }
  }
  for (let i = 0; i < 44; i++) {
    const x = rng() * span,
      z = -1.8 - rng() * 4.7;
    if (onDeck(x, z)) continue;
    paint.baseY = elevation(x, z);
    rock(paint, rng, x, z, 0.06 + rng() ** 2 * 0.58);
  }
  // Leave the walking line open and keep foreground flowers below the knees.
  for (let clump = 0; clump < 178; clump++) {
    const x = rng() * span,
      z = rng() < 0.33 ? 1.85 + rng() * 1.2 : -1.5 - rng() * 4.2;
    if (onDeck(x, z)) continue;
    paint.baseY = elevation(x, z);
    const height = 0.1 + rng() * 0.23;
    const blades = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < blades; i++) {
      const dx = rng() * 0.27 - 0.135,
        dz = rng() * 0.24 - 0.12;
      const bottom = [x + dx, 0, z + dz],
        shoulder = [x + dx * 1.2 + 0.015, height * 0.55, z + dz];
      const right = [x + dx + 0.026, 0, z + dz + 0.01],
        tip = [x + dx * 1.7, height * (0.7 + rng() * 0.65), z + dz * 1.65];
      const shade = choose(rng, grass);
      paint.triangle(bottom, right, shoulder, shade);
      paint.triangle(bottom, shoulder, tip, shade);
    }
    if (clump % 5 === 0) {
      const petal = choose(rng, ['#839cbc', '#b0bde0', '#e6a954', '#e7d8ab', '#cd9658']);
      const top = [x, height * 1.4, z];
      paint.triangle([x, 0, z], [x + 0.018, 0, z], top, grass[1]);
      for (let j = 0; j < 5; j++) {
        const a = (tau * j) / 5;
        foldedLeaf(paint, x, top[1], z, 0.043, 0.019, a, 0.026, 0.008, petal, petal);
      }
    }
  }
  const solid = new T.Mesh(paint.geometry(), pigment);
  group.add(solid, new T.Mesh(wood.geometry(), woodyPaint));
  for (const [geo, entries] of instances) {
    const mesh = new T.InstancedMesh(geo, foliagePaint, entries.length);
    entries.forEach(([matrix, shade, mist], i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, new T.Color(shade + mist * 0.48, shade + mist * 0.82, shade + mist * 1.96));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}
