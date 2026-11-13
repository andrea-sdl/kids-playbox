// The rider and what they ride: a skateboard, a snowboard or a bicycle.
//
// The rider is one continuous body, not a set of loose parts. A skeleton
// of bones sits inside it, and every point of the skin and the clothes
// follows the bones near it, so knees, elbows, wrists and the waist bend as
// one smooth surface. The body is shaped ring by ring from tables of real
// proportions (about seven and a half heads tall): shoulders wider than
// hips, a chest, shoulder blades, thighs, calves and tapering forearms.
// Clothes are a second layer with thickness, hems and folds. The rider
// has one build for everyone and a kawaii head: bigger than life, round,
// with dot eyes, pink cheeks and a small smile, and hair with volume. Hands have fingers that close around the bars or the board.
//
// Each frame the pose is worked out the same way as before: two-bone IK
// keeps the feet on the board or pedals and sends the hands where the pose
// wants them. The joints it finds then place the bones.
//
// A board points along +z (the way of travel) and the rider stands
// sideways on it, facing +x, looking ahead over the front shoulder. On the
// bicycle the rider faces the way of travel, standing on the pedals with
// their hands on the bars.

import * as THREE from '../../vendor/three/three.min.js';
import { boardTexture, bumpTexture } from './textures.js';
import { normalMapFrom } from '../../gfx/surface.js';

const THIGH = 0.44;
const SHIN = 0.44;
const UPPER_ARM = 0.29;
const FOREARM = 0.28;
// How high the ankle joint is above the sole of the shoe.
const ANKLE = 0.085;
// Height of the board's top, and how far apart the feet are.
const DECK = { skate: 0.1, snow: 0.045, bike: 0 };
const FEET = { skate: 0.25, snow: 0.29, bike: 0.13 };
// The bicycle, a hardtail mountain bike, seen from its left side:
// [forward, up] in meters. The fork runs straight down the steering axis
// from `headLow` (the fork's crown) to the front axle.
const WHEEL = 0.33;
const BIKE = {
  rear: [-0.5, WHEEL], front: [0.6, WHEEL], crank: [0, 0.3], seat: [-0.2, 0.8],
  head: [0.334, 0.901], headLow: [0.389, 0.783], bar: [0.385, 1], grip: 0.27, pedal: 0.17,
};

/* ---------- The body's measurements ---------- */

// The body is built standing straight with its arms down (the "rest"
// pose), then the bones move it. Heights here are in that pose.
const REST_HIPS = 1;
// Half the distance between the hip joints, and between the shoulders.
// One build for every rider: athletic, and neither a girl's nor a boy's.
const HIP = 0.095;
const SHOULDER = 0.185;
// Above the hips: where the spine bends, the chest, and the head's middle.
const WAIST_Y = 0.18;
const CHEST_Y = 0.48;
const HEAD_Y = 0.215;
const REST_HEAD = REST_HIPS + CHEST_Y + HEAD_Y;
// The head is shown bigger than life, the kawaii way, and lifted a little
// so the bigger chin clears the shoulders.
const HEAD_SIZE = 1.5;
const HEAD_LIFT = 0.046;

// The trunk from the crotch to the neck: [height above the hips, half
// width, how far the front is from the spine, how far the back is].
const TORSO = [
  [-0.105, 0.075, 0.06, 0.07],
  [-0.06, 0.15, 0.092, 0.112],
  [0, 0.166, 0.1, 0.12],
  [0.06, 0.16, 0.102, 0.108],
  [0.12, 0.146, 0.098, 0.09],
  [0.19, 0.138, 0.095, 0.084],
  [0.27, 0.15, 0.106, 0.09],
  [0.35, 0.168, 0.122, 0.1],
  [0.42, 0.186, 0.12, 0.108],
  [0.475, 0.19, 0.098, 0.102],
  [0.505, 0.17, 0.082, 0.09],
  [0.53, 0.105, 0.07, 0.076],
  [0.545, 0.075, 0.06, 0.064],
  [0.57, 0.056, 0.054, 0.056],
];
// An arm from just above the shoulder to the wrist, and a leg from inside
// the hip to the ankle: [distance down, front, back, outer side, inner side].
const ARM = [
  [-0.05, 0.01, 0.01, 0.01, 0.01],
  [-0.042, 0.03, 0.03, 0.03, 0.03],
  [-0.02, 0.046, 0.048, 0.045, 0.045],
  [0.02, 0.056, 0.058, 0.058, 0.05],
  [0.07, 0.054, 0.056, 0.058, 0.048],
  [0.13, 0.05, 0.049, 0.048, 0.045],
  [0.2, 0.046, 0.046, 0.043, 0.042],
  [0.26, 0.041, 0.042, 0.041, 0.04],
  [0.29, 0.039, 0.043, 0.041, 0.04],
  [0.33, 0.044, 0.042, 0.046, 0.042],
  [0.39, 0.043, 0.039, 0.044, 0.04],
  [0.47, 0.034, 0.032, 0.035, 0.033],
  [0.54, 0.029, 0.028, 0.026, 0.025],
  [0.585, 0.029, 0.028, 0.021, 0.02],
];
const LEG = [
  [-0.07, 0.03, 0.03, 0.03, 0.03],
  [-0.04, 0.075, 0.08, 0.075, 0.07],
  [0, 0.09, 0.098, 0.09, 0.082],
  [0.06, 0.092, 0.094, 0.09, 0.082],
  [0.14, 0.088, 0.086, 0.084, 0.078],
  [0.24, 0.078, 0.075, 0.074, 0.07],
  [0.34, 0.066, 0.062, 0.062, 0.06],
  [0.41, 0.058, 0.054, 0.056, 0.055],
  [0.44, 0.058, 0.052, 0.055, 0.054],
  [0.48, 0.052, 0.054, 0.053, 0.052],
  [0.55, 0.046, 0.064, 0.056, 0.052],
  [0.62, 0.043, 0.06, 0.052, 0.048],
  [0.72, 0.038, 0.044, 0.042, 0.04],
  [0.81, 0.034, 0.036, 0.035, 0.034],
  [0.87, 0.034, 0.038, 0.034, 0.034],
  [0.9, 0.03, 0.03, 0.03, 0.03],
];

// The bones. Each side has eight, after the three in the middle.
const HIPS = 0;
const CHEST = 1;
const HEAD = 2;
const UPPER = 0;
const FORE = 1;
const HAND = 2;
const KNUCKLES = 3;
const FINGERS = 4;
const THIGH_BONE = 5;
const SHIN_BONE = 6;
const FOOT = 7;
const BONES = 19;

function boneOf(side, part) {
  return 3 + (side > 0 ? 8 : 0) + part;
}

const UP = new THREE.Vector3(0, 1, 0);

/* ---------- Pictures ---------- */

// Detail a shape can't give comes from pictures in art/: the weave of
// cloth and the strands of hair (gray, so the chosen colors tint
// them). They load once, in the background. A rider built before they
// arrive starts with its drawn-in-code look and is dressed again when
// they do; if one never arrives, the rider simply stays as it was.
const PICTURES = ['rider-twill', 'rider-knit', 'rider-fleece', 'rider-shell', 'rider-hair'];
const pictures = {};
const fitting = new Set();
let asked = false;

function askPictures() {
  if (asked || typeof Image === 'undefined') {
    return;
  }
  asked = true;
  PICTURES.forEach((name) => {
    const image = new Image();
    image.onload = () => {
      pictures[name] = image;
      fitting.forEach((dress) => dress());
    };
    image.src = new URL(`./art/${name}.webp`, import.meta.url).href;
  });
}

// The color skin really has under the sun: the shop's swatch is the lit
// color, so the surface itself is a little darker and richer.
function skinTone(color) {
  const tone = new THREE.Color(color);
  // Pale swatches need the most taking down; dark ones are nearly right.
  const pale = smooth(0.08, 0.6, tone.g);
  return tone.setRGB(tone.r * (0.92 - 0.18 * pale), tone.g * (0.82 - 0.32 * pale), tone.b * (0.74 - 0.38 * pale));
}

// A gray detail picture as a repeating surface, and the bumps in it.
function detailTextures(image, strength) {
  const map = new THREE.Texture(image);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;
  return { map, bumps: normalMapFrom(image, { strength }) };
}

function smooth(from, to, value) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

// A row of a measurement table at any height in between its rows.
function measure(table, at) {
  if (at <= table[0][0]) {
    return table[0];
  }
  for (let i = 1; i < table.length; i += 1) {
    if (at <= table[i][0]) {
      const a = table[i - 1];
      const b = table[i];
      const t = smooth(0, 1, (at - a[0]) / (b[0] - a[0]));
      return a.map((value, k) => value + (b[k] - value) * t);
    }
  }
  return table[table.length - 1];
}

function mat(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...options });
}

function shadowed(mesh) {
  mesh.castShadow = true;
  return mesh;
}

// A ball squashed into any rounded shape.
function blob(sx, sy, sz, material, segments = 14) {
  const mesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.round(segments * 0.7)), material));
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

const tmp = new THREE.Vector3();

function placeLimb(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  tmp.copy(b).sub(a).normalize();
  mesh.quaternion.setFromUnitVectors(UP, tmp);
}

// Where the middle joint (knee, elbow) goes so the bones reach the target,
// bending toward `pole`. Writes the joint and the reached end.
const ikDir = new THREE.Vector3();
const ikBend = new THREE.Vector3();

function twoBone(root, target, first, second, pole, joint, end) {
  ikDir.copy(target).sub(root);
  const distance = Math.min(first + second - 0.001, Math.max(Math.abs(first - second) + 0.01, ikDir.length()));
  ikDir.normalize();
  const angle = Math.acos(Math.min(1, Math.max(-1, (first * first + distance * distance - second * second) / (2 * first * distance))));
  ikBend.copy(pole).addScaledVector(ikDir, -pole.dot(ikDir)).normalize();
  joint.copy(root).addScaledVector(ikDir, first * Math.cos(angle)).addScaledVector(ikBend, first * Math.sin(angle));
  end.copy(root).addScaledVector(ikDir, distance);
}

// Joins the plain meshes right inside a group into one mesh per material,
// so a bike frame is a few things to draw instead of dozens.
function fuse(group) {
  const sets = new Map();
  [...group.children].forEach((child) => {
    if (!child.isMesh || Array.isArray(child.material)) {
      return;
    }
    child.updateMatrix();
    // Some shapes share their corner points and some don't; joined ones
    // must all be the same kind.
    const own = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
    const piece = own.applyMatrix4(child.matrix);
    if (!sets.has(child.material)) {
      sets.set(child.material, []);
    }
    sets.get(child.material).push(piece);
    group.remove(child);
  });
  sets.forEach((pieces, material) => {
    group.add(shadowed(new THREE.Mesh(THREE.mergeGeometries(pieces), material)));
    pieces.forEach((piece) => piece.dispose());
  });
}

/* ---------- Sculpting ---------- */

// How many times the cloth weave repeats per meter.
const WEAVE = 36;
const AXIS_X = [1, 0, 0];
const AXIS_Z = [0, 0, 1];
const edgeA = new THREE.Vector3();
const edgeB = new THREE.Vector3();

function asWeights(weights, x, y, z) {
  if (typeof weights === 'number') {
    return [[weights, 1]];
  }
  if (typeof weights === 'function') {
    return weights(x, y, z);
  }
  return weights;
}

// Collects the points and triangles of everything made of one material,
// each point knowing its color and which bones it follows.
class Sculpt {
  constructor() {
    this.position = [];
    this.color = [];
    this.uv = [];
    // Where the cloth's weave falls: kept apart from `uv`, so a printed
    // top can carry its picture and still have a weave.
    this.weave = [];
    this.bones = [];
    this.weights = [];
    this.index = [];
    this.seams = [];
  }

  vertex(x, y, z, color, u, v, weights, weaveU = u, weaveV = v) {
    const i = this.position.length / 3;
    this.position.push(x, y, z);
    this.color.push(color.r, color.g, color.b);
    this.uv.push(u, v);
    this.weave.push(weaveU, weaveV);
    const list = asWeights(weights, x, y, z);
    for (let k = 0; k < 4; k += 1) {
      this.bones.push(list[k] ? list[k][0] : 0);
      this.weights.push(list[k] ? list[k][1] : 0);
    }
    return i;
  }

  // Turns the triangles added since `start` to face away from `center`,
  // judging by the triangle at `probe`.
  faceOut(start, probe, center) {
    const [a, b, c] = [0, 1, 2].map((k) => this.index[probe + k] * 3);
    const p = this.position;
    edgeA.set(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
    edgeB.set(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]);
    edgeA.cross(edgeB);
    const out = edgeA.x * (p[a] - center[0]) + edgeA.y * (p[a + 1] - center[1]) + edgeA.z * (p[a + 2] - center[2]);
    if (out < 0) {
      for (let k = start; k < this.index.length; k += 3) {
        [this.index[k + 1], this.index[k + 2]] = [this.index[k + 2], this.index[k + 1]];
      }
    }
  }

  // A tube through a list of rings. A ring has a middle (`at`), and how
  // far it reaches (`r`): one number, or [front, back, +side, -side] along
  // its two axes `u` and `v` (x and z unless given).
  // `map` places a picture on it instead of the cloth weave: a fixed spot
  // [u, v], or (share of the way around, ring) => [u, v].
  tube(rings, { around = 16, color, weights, capStart = false, capEnd = false, map = null } = {}) {
    const spot = (share, ring) => (typeof map === 'function' ? map(share, ring) : map);
    const first = this.position.length / 3;
    const start = this.index.length;
    const row = around + 1;
    let run = 0;
    rings.forEach((ring, i) => {
      if (i > 0) {
        run += Math.hypot(ring.at[0] - rings[i - 1].at[0], ring.at[1] - rings[i - 1].at[1], ring.at[2] - rings[i - 1].at[2]);
      }
      const r = typeof ring.r === 'number' ? [ring.r, ring.r, ring.r, ring.r] : ring.r;
      const u = ring.u || AXIS_X;
      const v = ring.v || AXIS_Z;
      const girth = (r[0] + r[1] + r[2] + r[3]) * 1.6;
      for (let j = 0; j <= around; j += 1) {
        const angle = (j / around) * Math.PI * 2;
        const cu = Math.cos(angle);
        const cv = Math.sin(angle);
        const pu = cu * (cu >= 0 ? r[0] : r[1]);
        const pv = cv * (cv >= 0 ? r[2] : r[3]);
        const woven = [(j / around) * girth * WEAVE, run * WEAVE];
        const [tu, tv] = map ? spot(j / around, ring) : woven;
        this.vertex(
          ring.at[0] + u[0] * pu + v[0] * pv, ring.at[1] + u[1] * pu + v[1] * pv, ring.at[2] + u[2] * pu + v[2] * pv,
          ring.color || color, tu, tv, ring.weights || weights, woven[0], woven[1],
        );
      }
      this.seams.push([first + i * row, first + i * row + around]);
      if (i > 0) {
        for (let j = 0; j < around; j += 1) {
          const a = first + (i - 1) * row + j;
          const c = a + row;
          this.index.push(a, c, a + 1, a + 1, c, c + 1);
        }
      }
    });
    const cap = (ring, base, flip) => {
      const [tu, tv] = map ? spot(0.5, ring) : [0, 0];
      const middle = this.vertex(ring.at[0], ring.at[1], ring.at[2], ring.color || color, tu, tv, ring.weights || weights);
      for (let j = 0; j < around; j += 1) {
        this.index.push(middle, base + j + (flip ? 1 : 0), base + j + (flip ? 0 : 1));
      }
    };
    if (capStart) {
      cap(rings[0], first, false);
    }
    if (capEnd) {
      cap(rings[rings.length - 1], first + (rings.length - 1) * row, true);
    }
    // Judge by a ring with some width to it.
    let wide = 1;
    for (let i = 1; i < rings.length - 1; i += 1) {
      const size = (ring) => (typeof ring.r === 'number' ? ring.r : ring.r[0] + ring.r[2]);
      if (size(rings[i]) > size(rings[wide])) {
        wide = i;
      }
    }
    const probe = start + (wide - 1) * around * 6 + 3;
    const [a, b] = [rings[wide - 1].at, rings[wide].at];
    this.faceOut(start, probe, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
  }

  // A tube along a curved line through `points`: a lock of hair, a strap,
  // a finger. `radius` is a number or (0 to 1 along it) => a number or
  // [across, tall]; `tall` is measured toward `up`.
  path(points, radius, { around = 8, steps = points.length * 3, up = [0, 1, 0], ...options } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const rings = [];
    const lift = new THREE.Vector3();
    const across = new THREE.Vector3();
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const at = curve.getPoint(t);
      const along = curve.getTangent(t);
      lift.fromArray(up);
      lift.addScaledVector(along, -lift.dot(along));
      if (lift.lengthSq() < 1e-6) {
        lift.set(1, 0, 0).addScaledVector(along, -along.x);
      }
      lift.normalize();
      across.crossVectors(lift, along);
      const size = typeof radius === 'function' ? radius(t) : radius;
      const [wide, tall] = typeof size === 'number' ? [size, size] : size;
      rings.push({ at: at.toArray(), u: across.toArray(), v: lift.toArray(), r: [wide, wide, tall, tall] });
    }
    this.tube(rings, { around, capStart: true, capEnd: true, ...options });
  }

  // A sheet of points, `rows` by `cols`, from make(row, col) => { at,
  // color }. `center` is a point inside the shape it wraps around.
  grid(rows, cols, make, { weights, center, wrap = true } = {}) {
    const first = this.position.length / 3;
    const start = this.index.length;
    for (let i = 0; i <= rows; i += 1) {
      for (let j = 0; j <= cols; j += 1) {
        const made = make(i, j);
        this.vertex(made.at[0], made.at[1], made.at[2], made.color, (j / cols) * 12, (i / rows) * 6, weights);
      }
      if (wrap) {
        this.seams.push([first + i * (cols + 1), first + i * (cols + 1) + cols]);
      }
      if (i > 0) {
        for (let j = 0; j < cols; j += 1) {
          const a = first + (i - 1) * (cols + 1) + j;
          const c = a + cols + 1;
          this.index.push(a, c, a + 1, a + 1, c, c + 1);
        }
      }
    }
    const probe = start + (Math.floor(rows / 2) * cols + Math.floor(cols / 4)) * 6;
    this.faceOut(start, probe, center);
  }

  // Any ready-made shape, moved into place by `matrix`.
  solid(geometry, matrix, color, weights) {
    const first = this.position.length / 3;
    const place = geometry.attributes.position;
    for (let i = 0; i < place.count; i += 1) {
      tmp.fromBufferAttribute(place, i).applyMatrix4(matrix);
      this.vertex(tmp.x, tmp.y, tmp.z, color, 0, 0, weights);
    }
    if (geometry.index) {
      for (let i = 0; i < geometry.index.count; i += 1) {
        this.index.push(first + geometry.index.getX(i));
      }
    } else {
      for (let i = 0; i < place.count; i += 1) {
        this.index.push(first + i);
      }
    }
    geometry.dispose();
  }

  // A ball stretched to `size`, at `at`, turned by `turn` (x, y, z angles).
  ball(at, size, color, weights, { segments = 10, turn = [0, 0, 0] } = {}) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...turn)),
      new THREE.Vector3(...size),
    );
    this.solid(new THREE.SphereGeometry(1, segments, Math.max(4, Math.round(segments * 0.7))), matrix, color, weights);
  }

  // A box with rounded edges. `soft` is how finely the edges are rounded;
  // 0 leaves them sharp, for small things nobody sees up close.
  block(at, size, color, weights, turn = [0, 0, 0], soft = 2) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...at),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...turn)),
      new THREE.Vector3(1, 1, 1),
    );
    const round = Math.min(size[0], size[1], size[2]) * 0.3;
    const shape = soft > 0 ? new THREE.RoundedBoxGeometry(size[0], size[1], size[2], soft, round) : new THREE.BoxGeometry(size[0], size[1], size[2]);
    this.solid(shape, matrix, color, weights);
  }

  get empty() {
    return this.index.length === 0;
  }

  // The finished mesh, ready to be bound to a skeleton.
  mesh(material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geometry.setAttribute('uv1', new THREE.Float32BufferAttribute(this.weave, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.bones, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.weights, 4));
    geometry.setIndex(this.index);
    geometry.computeVertexNormals();
    // Where a tube's surface meets itself, share the light across the join.
    const normal = geometry.attributes.normal;
    this.seams.forEach(([a, b]) => {
      tmp.set(normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b)).normalize();
      normal.setXYZ(a, tmp.x, tmp.y, tmp.z);
      normal.setXYZ(b, tmp.x, tmp.y, tmp.z);
    });
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.castShadow = true;
    // Its bones move it far from where it was built.
    mesh.frustumCulled = false;
    return mesh;
  }
}

/* ---------- The board ---------- */

// A rounded-end board seen from above, pushed up into a thin slab, with
// the nose and tail bent up.
function boardGeometry(width, length, thickness, kick) {
  const shape = new THREE.Shape();
  const r = width / 2;
  const half = length / 2 - r;
  shape.moveTo(-r, -half);
  shape.lineTo(-r, half);
  shape.absarc(0, half, r, Math.PI, 0, true);
  shape.lineTo(r, -half);
  shape.absarc(0, -half, r, 0, Math.PI, true);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 10 });
  // Shape x stays x, shape y becomes -z, depth becomes up.
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i += 1) {
    const z = position.getZ(i);
    position.setY(i, position.getY(i) + kick(Math.abs(z)));
    uv.setXY(i, 0.5 + position.getX(i) / width, 0.5 - z / length);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildBoard(type, look, owned) {
  const group = new THREE.Group();
  const texture = boardTexture(look.deck, look.graphic, look.graphicColor);
  owned.push(texture);
  const face = mat('#ffffff', { map: texture, roughness: 0.45 });
  const edge = mat(new THREE.Color(look.deck).multiplyScalar(0.7), { roughness: 0.5 });
  if (type === 'skate') {
    const deck = new THREE.Mesh(boardGeometry(0.21, 0.82, 0.02, (z) => Math.max(0, z - 0.27) * 0.5), [face, edge]);
    deck.position.y = 0.075;
    group.add(shadowed(deck));
    const metal = mat('#b9bec7', { metalness: 0.8, roughness: 0.35 });
    const wheel = mat(look.wheels, { roughness: 0.5 });
    const wheelGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.032, 14);
    wheelGeometry.rotateZ(Math.PI / 2);
    [-0.21, 0.21].forEach((z) => {
      const truck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.04), metal);
      truck.position.set(0, 0.044, z);
      group.add(shadowed(truck));
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.07), metal);
      base.position.set(0, 0.064, z);
      group.add(base);
      [-0.088, 0.088].forEach((x) => {
        const w = new THREE.Mesh(wheelGeometry, wheel);
        w.position.set(x, 0.032, z);
        group.add(shadowed(w));
      });
    });
  } else {
    const deck = new THREE.Mesh(boardGeometry(0.28, 1.45, 0.018, (z) => Math.max(0, z - 0.58) ** 2 * 1.1), [face, edge]);
    deck.position.y = 0.006;
    group.add(shadowed(deck));
    const strap = mat(look.wheels, { roughness: 0.6 });
    const dark = mat('#26262e', { roughness: 0.7 });
    [-FEET.snow, FEET.snow].forEach((z) => {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.13), dark);
      plate.position.set(0, 0.034, z);
      group.add(plate);
      const highback = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.13), strap);
      highback.position.set(-0.12, 0.11, z);
      highback.rotation.z = 0.18;
      group.add(shadowed(highback));
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.14), strap);
      band.position.set(0.05, 0.1, z);
      group.add(band);
    });
  }
  fuse(group);
  return group;
}

/* ---------- The bicycle ---------- */

// A straight tube between two points, `radius` thick at a and `radiusEnd`
// at b.
function tube(a, b, radius, material, radiusEnd = radius, sides = 8) {
  const length = a.distanceTo(b);
  const mesh = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radiusEnd, radius, length, sides), material));
  placeLimb(mesh, a, b);
  return mesh;
}

// A flat ring standing on its edge, like a brake disc, a cog or a rim: a
// hole `inner` across, `outer` to its edge, `thick` from side to side.
function ring(at, inner, outer, thick, material, sides = 20) {
  const half = thick / 2;
  const outline = [[inner, -half], [outer, -half], [outer, half], [inner, half], [inner, -half]].map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(outline, sides);
  geometry.rotateX(Math.PI / 2);
  const mesh = shadowed(new THREE.Mesh(geometry, material));
  mesh.position.copy(at);
  return mesh;
}

// A thin hose or cable hanging through some points.
function hose(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 4, radius, 5), material));
}

function slab(at, size, material, turn = 0) {
  const mesh = shadowed(new THREE.Mesh(new THREE.RoundedBoxGeometry(size[0], size[1], size[2], 1, Math.min(...size) * 0.3), material));
  mesh.position.copy(at);
  mesh.rotation.z = turn;
  return mesh;
}

// How thick the tire is, and how far its tread blocks stick out.
const TIRE = 0.034;
const TREAD = 0.007;

// A wheel: a fat tire with rows of tread blocks, a deep rim, laced spokes,
// a hub and a brake disc on the left (-z) side.
function buildWheel(paints) {
  const { rubber, rim, metal } = paints;
  const wheel = new THREE.Group();
  const middle = new THREE.Vector3();
  wheel.add(shadowed(new THREE.Mesh(new THREE.TorusGeometry(WHEEL - TREAD - TIRE, TIRE, 8, 36), rubber)));
  // Tread: a block down the middle, then a pair on the shoulders, in turn.
  const block = new THREE.BoxGeometry(0.03, TREAD * 2.4, 0.017);
  const steps = 36;
  for (let k = 0; k < steps; k += 1) {
    const angle = (k / steps) * Math.PI * 2;
    const lanes = k % 2 ? [-0.023, 0.023] : [0];
    lanes.forEach((z) => {
      const out = WHEEL - TREAD * 1.2 - (z === 0 ? 0 : 0.011);
      const knob = new THREE.Mesh(block, rubber);
      knob.position.set(Math.cos(angle) * out, Math.sin(angle) * out, z);
      knob.rotation.set(0, 0, angle - Math.PI / 2);
      knob.rotateX(z === 0 ? 0 : Math.sign(z) * 0.5);
      wheel.add(knob);
    });
  }
  const rimEdge = WHEEL - TREAD - TIRE * 1.75;
  wheel.add(ring(middle, rimEdge - 0.032, rimEdge, 0.03, rim, 36));
  // The hub, its two flanges, and spokes laced from them to the rim.
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.12, 12), metal);
  axle.rotation.x = Math.PI / 2;
  wheel.add(axle);
  [-0.038, 0.038].forEach((z) => wheel.add(ring(new THREE.Vector3(0, 0, z), 0.012, 0.036, 0.005, metal, 16)));
  const spokes = 24;
  for (let k = 0; k < spokes; k += 1) {
    const side = k % 2 ? 1 : -1;
    const from = (k / spokes) * Math.PI * 2;
    const to = from + (k % 4 < 2 ? 0.55 : -0.55);
    const a = new THREE.Vector3(Math.cos(from) * 0.033, Math.sin(from) * 0.033, side * 0.038);
    const b = new THREE.Vector3(Math.cos(to) * (rimEdge - 0.03), Math.sin(to) * (rimEdge - 0.03), 0);
    const spoke = tube(a, b, 0.0022, metal, 0.0022, 4);
    spoke.castShadow = false;
    wheel.add(spoke);
  }
  // The brake disc, on its six-armed carrier.
  wheel.add(ring(new THREE.Vector3(0, 0, -0.05), 0.062, 0.088, 0.003, metal, 24));
  for (let k = 0; k < 6; k += 1) {
    const angle = (k / 6) * Math.PI * 2;
    const a = new THREE.Vector3(Math.cos(angle) * 0.02, Math.sin(angle) * 0.02, -0.05);
    const b = new THREE.Vector3(Math.cos(angle + 0.5) * 0.066, Math.sin(angle + 0.5) * 0.066, -0.05);
    wheel.add(tube(a, b, 0.005, metal, 0.004, 4));
  }
  fuse(wheel);
  return wheel;
}

// The bike points along +x, with its chain on the right (+z). It comes in
// two parts that both turn around the steering axis: the front (bars,
// fork, front wheel) for steering and barspins, and the rest for tailwhips.
function buildBike(look) {
  const root = new THREE.Group();
  const both = { side: THREE.DoubleSide };
  const paint = new THREE.MeshPhysicalMaterial({ color: look.deck, roughness: 0.3, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const metal = mat('#c3c8d0', { roughness: 0.32, metalness: 0.85, ...both });
  const rubber = mat('#19191d', { roughness: 0.94 });
  const rim = mat(look.wheels, { roughness: 0.38, metalness: 0.55, ...both });
  // Black anodized parts: bars, stem, cranks, fork lowers, saddle.
  const dark = mat('#202026', { roughness: 0.5, metalness: 0.35, ...both });
  const gold = mat('#c79a45', { roughness: 0.28, metalness: 0.85 });
  const paints = { rubber, rim, metal };
  const pivot = new THREE.Vector3(BIKE.head[0], BIKE.head[1], 0);
  // Points are given on the bike, then moved so the pivot is the origin.
  const at = (x, y, z = 0) => new THREE.Vector3(x, y, z).sub(pivot);
  const between = (a, b, share) => a.clone().lerp(b, share);
  const steerAxis = at(...BIKE.head).sub(at(...BIKE.headLow)).normalize();
  const frame = new THREE.Group();
  const steer = new THREE.Group();
  frame.position.copy(pivot);
  steer.position.copy(pivot);
  root.add(frame, steer);

  const [seatX, seatY] = BIKE.seat;
  const [crankX, crankY] = BIKE.crank;
  const [rearX, rearY] = BIKE.rear;
  const crank = at(crankX, crankY);
  const seatTop = at(seatX, seatY - 0.07);
  const headTop = at(...BIKE.head);
  const headLow = at(...BIKE.headLow);
  // Where the sloping top tube and the seat stays meet the seat tube.
  const join = between(crank, seatTop, 0.74);
  const topFront = between(headLow, headTop, 0.72).add(new THREE.Vector3(-0.012, 0, 0));
  const downFront = between(headLow, headTop, 0.2).add(new THREE.Vector3(-0.014, 0, 0));

  // The frame: a thick down tube, a sloping top tube with a brace up to
  // the seat tube, and thin stays back to the rear axle.
  frame.add(tube(headLow, headTop, 0.031, paint, 0.026, 14));
  frame.add(tube(crank, downFront, 0.031, paint, 0.027, 12));
  frame.add(tube(join, topFront, 0.019, paint, 0.022, 12));
  frame.add(tube(crank, seatTop, 0.02, paint, 0.018, 12));
  frame.add(tube(between(join, topFront, 0.2), between(join, seatTop, 0.8), 0.011, paint));
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.09, 14), paint);
  shell.rotation.x = Math.PI / 2;
  shell.position.copy(crank);
  frame.add(shadowed(shell));
  [-1, 1].forEach((side) => {
    const axle = at(rearX, rearY, side * 0.066);
    frame.add(tube(axle, at(crankX + 0.01, crankY, side * 0.04), 0.011, paint, 0.014));
    frame.add(tube(axle, join.clone().setZ(side * 0.022), 0.009, paint, 0.011));
    frame.add(slab(axle, [0.045, 0.05, 0.008], dark));
  });
  // Dark bands of lettering along the tubes.
  frame.add(tube(between(crank, downFront, 0.28), between(crank, downFront, 0.74), 0.0312, dark, 0.0298, 12));
  frame.add(tube(between(join, topFront, 0.34), between(join, topFront, 0.7), 0.0206, dark, 0.0214, 12));

  // The seatpost and saddle.
  frame.add(tube(seatTop, at(seatX - 0.014, seatY + 0.035), 0.0125, dark));
  frame.add(tube(seatTop.clone().add(new THREE.Vector3(0.002, -0.012, 0)), seatTop.clone().add(new THREE.Vector3(-0.001, 0.008, 0)), 0.023, dark));
  const saddle = blob(0.105, 0.02, 0.064, dark, 12);
  saddle.position.copy(at(seatX - 0.055, seatY + 0.06));
  const nose = blob(0.1, 0.017, 0.026, dark, 10);
  nose.position.copy(at(seatX + 0.045, seatY + 0.056));
  frame.add(saddle, nose);

  // The drivetrain, on the right: cranks and flat pedals (the front foot's
  // is forward), a chainring, a stack of cogs, a derailleur and the chain.
  [-1, 1].forEach((side) => {
    const hub = at(crankX, crankY, side * 0.075);
    const pedal = at(crankX + side * BIKE.pedal, crankY, side * 0.08);
    frame.add(tube(hub, pedal, 0.014, dark, 0.01, 8));
    frame.add(tube(pedal, pedal.clone().setZ(side * 0.14), 0.006, metal, 0.006, 6));
    frame.add(slab(pedal.clone().setZ(side * 0.14), [0.1, 0.016, 0.095], dark));
  });
  frame.add(tube(at(crankX, crankY, -0.082), at(crankX, crankY, 0.082), 0.013, metal));
  const chainZ = 0.052;
  frame.add(ring(at(crankX, crankY, chainZ), 0.06, 0.088, 0.005, dark, 24));
  for (let k = 0; k < 4; k += 1) {
    const angle = (k / 4) * Math.PI * 2 + 0.4;
    frame.add(tube(at(crankX, crankY, chainZ), at(crankX + Math.cos(angle) * 0.066, crankY + Math.sin(angle) * 0.066, chainZ), 0.008, dark, 0.006, 5));
  }
  [0.078, 0.069, 0.06, 0.051, 0.042, 0.034].forEach((size, k) => {
    frame.add(ring(at(rearX, rearY, 0.03 + k * 0.0052), 0.02, size, 0.0032, metal, 16));
  });
  const upperPulley = at(rearX + 0.012, rearY - 0.085, chainZ - 0.004);
  const lowerPulley = at(rearX + 0.055, rearY - 0.175, chainZ - 0.004);
  frame.add(slab(at(rearX + 0.004, rearY - 0.045, chainZ + 0.012), [0.04, 0.05, 0.022], dark));
  frame.add(tube(upperPulley, lowerPulley, 0.009, dark, 0.009, 6));
  frame.add(ring(upperPulley, 0.004, 0.02, 0.008, dark, 12), ring(lowerPulley, 0.004, 0.02, 0.008, dark, 12));
  const link = mat('#8d8f96', { roughness: 0.45, metalness: 0.8 });
  const chain = (a, b) => {
    const run = tube(a, b, 0.0045, link, 0.0045, 4);
    run.castShadow = false;
    frame.add(run);
  };
  chain(at(crankX, crankY + 0.088, chainZ), at(rearX, rearY + 0.05, chainZ - 0.006));
  chain(at(crankX, crankY - 0.088, chainZ), lowerPulley.clone().add(new THREE.Vector3(0, -0.02, 0)));
  chain(lowerPulley.clone().add(new THREE.Vector3(0.02, 0, 0)), upperPulley.clone().add(new THREE.Vector3(0.02, 0, 0)));
  chain(upperPulley.clone().add(new THREE.Vector3(-0.02, 0, 0)), at(rearX - 0.03, rearY - 0.04, chainZ - 0.006));

  // The rear brake, and its hose along the frame.
  frame.add(slab(at(rearX + 0.06, rearY + 0.072, -0.052), [0.05, 0.036, 0.03], dark, 0.6));
  frame.add(hose([
    downFront.clone().add(new THREE.Vector3(0.01, -0.035, -0.03)),
    between(crank, downFront, 0.5).add(new THREE.Vector3(0.012, -0.03, -0.022)),
    at(crankX + 0.03, crankY + 0.03, -0.04),
    at(rearX + 0.26, rearY + 0.02, -0.05),
    at(rearX + 0.075, rearY + 0.085, -0.055),
  ], 0.0038, rubber));
  const rear = buildWheel(paints);
  rear.position.copy(at(rearX, rearY));
  frame.add(rear);

  // The front: spacers and a short stem up to a wide flat bar, with
  // lock-on grips and brake levers.
  const bar = at(...BIKE.bar);
  const stemFoot = headTop.clone().addScaledVector(steerAxis, 0.05);
  steer.add(tube(headTop, stemFoot, 0.019, dark, 0.019, 12));
  steer.add(tube(stemFoot.clone().addScaledVector(steerAxis, -0.012), bar, 0.02, dark, 0.018, 10));
  steer.add(slab(bar.clone().add(new THREE.Vector3(0.012, 0, 0)), [0.022, 0.044, 0.05], dark));
  const reach = BIKE.grip + 0.075;
  steer.add(tube(bar.clone().setZ(-reach), bar.clone().setZ(reach), 0.0125, dark));
  [-1, 1].forEach((side) => {
    const z = (out) => bar.clone().setZ(side * out);
    steer.add(tube(z(BIKE.grip - 0.07), z(BIKE.grip + 0.07), 0.0178, rubber, 0.0178, 12));
    [BIKE.grip - 0.075, BIKE.grip + 0.073].forEach((out) => steer.add(tube(z(out - 0.005), z(out + 0.005), 0.0195, metal, 0.0195, 12)));
    // The lever: a clamp inboard of the grip, and a blade under the fingers.
    const clamp = z(BIKE.grip - 0.1).add(new THREE.Vector3(0.018, -0.008, 0));
    steer.add(slab(clamp, [0.04, 0.026, 0.026], dark));
    steer.add(tube(clamp.clone().add(new THREE.Vector3(0.016, -0.006, 0)), z(BIKE.grip + 0.03).add(new THREE.Vector3(0.052, -0.02, 0)), 0.0058, metal, 0.0045, 6));
  });

  // The suspension fork: a crown, gold upper legs that slide into thick
  // lowers, an arch over the tire and the front brake.
  const axleFront = at(...BIKE.front);
  steer.add(tube(headLow.clone().setZ(-0.082), headLow.clone().setZ(0.082), 0.024, dark, 0.024, 12));
  steer.add(slab(headLow, [0.06, 0.04, 0.07], dark, Math.atan2(steerAxis.x, steerAxis.y) * -1));
  const legs = [-1, 1].map((side) => {
    const top = headLow.clone().setZ(side * 0.066);
    const foot = axleFront.clone().setZ(side * 0.066);
    steer.add(tube(top, between(top, foot, 0.34), 0.0165, gold, 0.0165, 12));
    steer.add(tube(between(top, foot, 0.26), foot, 0.025, dark, 0.021, 12));
    steer.add(tube(between(top, foot, 0.25), between(top, foot, 0.275), 0.0265, rubber, 0.0265, 12));
    steer.add(slab(foot.clone().addScaledVector(steerAxis, -0.012), [0.04, 0.05, 0.022], dark, Math.atan2(steerAxis.x, steerAxis.y) * -1));
    return { top, foot };
  });
  const forward = new THREE.Vector3(steerAxis.y, -steerAxis.x, 0);
  const archAt = (leg) => between(leg.top, leg.foot, 0.29).addScaledVector(forward, 0.02);
  steer.add(hose([
    archAt(legs[0]),
    between(legs[0].top, legs[0].foot, 0.22).setZ(-0.03).addScaledVector(forward, 0.05),
    between(legs[0].top, legs[0].foot, 0.22).setZ(0.03).addScaledVector(forward, 0.05),
    archAt(legs[1]),
  ], 0.012, dark));
  steer.add(slab(between(legs[0].top, legs[0].foot, 0.8).addScaledVector(forward, -0.038).setZ(-0.056), [0.036, 0.05, 0.03], dark, Math.atan2(steerAxis.x, steerAxis.y) * -1));
  // Hoses droop from the levers: one to the front brake, one to the frame.
  const lever = (side) => bar.clone().setZ(side * (BIKE.grip - 0.1)).add(new THREE.Vector3(0.04, -0.01, 0));
  steer.add(hose([
    lever(-1),
    bar.clone().add(new THREE.Vector3(0.13, -0.07, -0.12)),
    headLow.clone().add(new THREE.Vector3(0.09, -0.03, -0.085)),
    between(legs[0].top, legs[0].foot, 0.5).addScaledVector(forward, -0.03).setZ(-0.075),
    between(legs[0].top, legs[0].foot, 0.76).addScaledVector(forward, -0.04).setZ(-0.06),
  ], 0.0038, rubber));
  steer.add(hose([
    lever(1),
    bar.clone().add(new THREE.Vector3(0.14, -0.06, 0.1)),
    headTop.clone().add(new THREE.Vector3(0.075, -0.05, 0.03)),
    between(headLow, headTop, 0.3).add(new THREE.Vector3(0.036, 0, 0.012)),
  ], 0.0038, rubber));
  const front = buildWheel(paints);
  front.position.copy(axleFront);
  steer.add(front);

  fuse(frame);
  fuse(steer);
  return { root, frame, steer, steerAxis, pivot, wheels: [front, rear] };
}

/* ---------- The body ---------- */

function trunkWeights(y) {
  const t = smooth(0.08, 0.3, y);
  return [[HIPS, 1 - t], [CHEST, t]];
}

// The same for any point in the rest pose, for things stuck on the trunk.
function onTrunk(x, y) {
  return trunkWeights(y - REST_HIPS);
}

function armWeights(side, t) {
  if (t > 0.5) {
    const v = smooth(0.53, 0.6, t);
    return [[boneOf(side, FORE), 1 - v], [boneOf(side, HAND), v]];
  }
  const u = smooth(0.235, 0.345, t);
  return [[boneOf(side, UPPER), 1 - u], [boneOf(side, FORE), u]];
}

function legWeights(side, t) {
  if (t > 0.7) {
    const v = smooth(0.8, 0.9, t);
    return [[boneOf(side, SHIN_BONE), 1 - v], [boneOf(side, FOOT), v]];
  }
  const u = smooth(0.385, 0.5, t);
  return [[boneOf(side, THIGH_BONE), 1 - u], [boneOf(side, SHIN_BONE), u]];
}

// A turned-in edge, so cloth has thickness where it ends.
function lip(ring, depth = 0.012) {
  const r = (typeof ring.r === 'number' ? [ring.r, ring.r, ring.r, ring.r] : ring.r).map((value) => Math.max(0.004, value - depth));
  return { ...ring, r };
}

// Part of the trunk, from one height to another (above the hips), `pad`
// thicker than the body and never thinner than `least` [side, front, back].
function trunk(sculpt, { from, to, pad = 0, least = [0, 0, 0], color, tint = () => color, shape = () => 1, lipStart = false, lipEnd = false, capStart = false, map = null }) {
  const rings = [];
  const count = Math.max(2, Math.round((to - from) / 0.02));
  for (let i = 0; i <= count; i += 1) {
    const y = from + ((to - from) * i) / count;
    const [, side, front, back] = measure(TORSO, y);
    const more = shape(y);
    // Loose clothes hang straight from the chest down, not at the shoulders.
    const hang = 1 - smooth(0.3, 0.44, y);
    const wide = Math.max(side + pad, least[0] * hang) * more;
    rings.push({
      at: [0, REST_HIPS + y, 0],
      r: [Math.max(front + pad, least[1] * hang) * more, Math.max(back + pad, least[2] * hang) * more, wide, wide],
      weights: trunkWeights(y),
      color: tint(y),
      // How far up this part it is, for placing a print.
      share: i / count,
    });
  }
  if (lipStart) {
    rings.unshift(lip(rings[0]));
  }
  if (lipEnd) {
    rings.push(lip(rings[rings.length - 1]));
  }
  sculpt.tube(rings, { around: 24, color, capStart, map });
}

// Part of an arm or a leg, from `from` to `to` meters down it.
function limb(sculpt, table, origin, side, weights, { from, to, pad = 0, least = 0, color, tint = () => color, shape = () => 1, lipStart = false, lipEnd = false, capStart = false, capEnd = false, map = null }) {
  const rings = [];
  const count = Math.max(2, Math.round((to - from) / 0.02));
  for (let i = 0; i <= count; i += 1) {
    const t = from + ((to - from) * i) / count;
    const [, front, back, outer, inner] = measure(table, t);
    const more = shape(t);
    // The rounded top of a limb stays small, so it closes.
    const fit = (value) => Math.max(value + pad, t > 0.02 ? least : 0) * more;
    rings.push({
      at: [origin[0], origin[1] - t, origin[2]],
      r: [fit(front), fit(back), fit(side > 0 ? outer : inner), fit(side > 0 ? inner : outer)],
      weights: weights(side, t),
      color: tint(t),
    });
  }
  if (lipStart) {
    rings.unshift(lip(rings[0]));
  }
  if (lipEnd) {
    rings.push(lip(rings[rings.length - 1]));
  }
  sculpt.tube(rings, { around: 16, color, capStart, capEnd, map });
}

// Soft folds in cloth around a height, fading out `reach` away from it.
function folds(at, reach, depth, rate = 110) {
  return (t) => 1 + depth * Math.sin(t * rate) * (1 - smooth(0, reach, Math.abs(t - at)));
}

function shade(color, amount) {
  return new THREE.Color(color).multiplyScalar(amount);
}

const WHITE = new THREE.Color('#f1f1ec');
const DARK = new THREE.Color('#22222a');
const PLAIN = new THREE.Color('#ffffff');
// Where on the print's picture the sleeves, hem and collar take their
// color from, and where the body's part of it starts.
const PRINT_TRIM = [0.5, 0.02];
const PRINT_FOOT = 0.06;

// The print on a jersey or a T-shirt, wrapped once around the body: the
// chest is at the left and right edges of the picture and the back is in
// the middle. Bold slanted shards and a bolt in two tones made from the
// top's own color. A strip along the bottom is the color of the sleeves,
// hem and collar. `full` prints the chest too; otherwise only the back,
// with a small mark on the chest.
function printTexture(color, full) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const css = (tone) => `#${tone.getHexString()}`;
  const base = new THREE.Color(color);
  const hsl = base.getHSL({});
  // A dark tone from across the color wheel (teal for an orange jersey),
  // and a brighter, warmer one. Grays and whites get a dark blue instead.
  // It is kept dark and strong so it never looks like bare skin.
  const deep = hsl.s < 0.15 ? new THREE.Color('#24405e') : new THREE.Color().setHSL((hsl.h + 0.42) % 1, 0.55, 0.2);
  const bright = base.clone().offsetHSL(0.07, 0.05, hsl.l > 0.6 ? -0.2 : 0.16);
  const pale = base.clone().lerp(new THREE.Color('#fff6dc'), 0.78);
  ctx.fillStyle = css(base);
  ctx.fillRect(0, 0, size, size);
  const body = size * (1 - PRINT_FOOT);
  const shard = (middle, points, tone) => {
    ctx.fillStyle = css(tone);
    ctx.beginPath();
    points.forEach(([x, y]) => ctx.lineTo(middle + x * size, y * body));
    ctx.fill();
  };
  const panel = (middle) => {
    shard(middle, [[-0.25, 0.42], [-0.11, 0.1], [0.02, 0.1], [-0.17, 0.62]], bright);
    shard(middle, [[-0.2, 0.98], [-0.04, 0.98], [0.22, 0.26], [0.07, 0.26]], deep);
    shard(middle, [[0, 0.98], [0.11, 0.98], [0.25, 0.52], [0.2, 0.42]], bright);
    shard(middle, [[-0.25, 0.14], [-0.04, 0.06], [0.25, 0.1], [0.25, 0.19], [-0.02, 0.15], [-0.25, 0.24]], deep);
    shard(middle, [[0.03, 0.3], [0.13, 0.3], [0.04, 0.52], [0.11, 0.52], [-0.08, 0.88], [-0.02, 0.61], [-0.09, 0.61]], pale);
  };
  if (full) {
    panel(0);
    panel(size);
  } else {
    shard(size * 0.92, [[-0.04, 0.2], [0.03, 0.2], [0.01, 0.26], [0.04, 0.26], [-0.03, 0.36], [-0.01, 0.29], [-0.05, 0.29]], deep);
  }
  panel(size / 2);
  // The collar and the strip the sleeves and hem are cut from.
  ctx.fillStyle = css(deep);
  ctx.fillRect(0, 0, size, size * 0.022);
  ctx.fillRect(0, body, size, size - body);
  // The knit: fine specks, and soft folds running down.
  let seed = 11;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 9000; i += 1) {
    ctx.fillStyle = next() < 0.5 ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(next() * size, next() * size, 2, 2);
  }
  for (let i = 0; i < 14; i += 1) {
    const x = next() * size;
    const fold = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
    fold.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fold.addColorStop(0.5, 'rgba(0, 0, 0, 0.1)');
    fold.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fold;
    ctx.fillRect(x - 14, size * 0.45, 28, size * 0.5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function buildBody(kit, look, board) {
  const { skin, cloth, print, gear } = kit;
  // A hoodie or a jacket is made of its own cloth.
  const upper = kit.top;
  const bike = board === 'bike';
  const skinColor = skinTone(look.skin);
  const top = new THREE.Color(look.topColor);
  const topTrim = shade(look.topColor, 0.72);
  const bottom = new THREE.Color(look.bottomColor);
  const bottomTrim = shade(look.bottomColor, 0.7);
  const shoulderY = REST_HIPS + CHEST_Y + 0.02;
  const hipY = REST_HIPS - 0.02;

  // Skin: the base of the neck and the neck itself, the arms and the legs.
  trunk(skin, { from: 0.42, to: 0.57, color: skinColor });
  skin.tube([
    { at: [0, REST_HIPS + 0.5, 0], r: [0.058, 0.062, 0.058, 0.058], weights: CHEST },
    { at: [0.004, REST_HIPS + 0.54, 0], r: [0.054, 0.056, 0.053, 0.053], weights: [[CHEST, 0.8], [HEAD, 0.2]] },
    { at: [0.008, REST_HIPS + 0.575, 0], r: [0.051, 0.053, 0.05, 0.05], weights: [[CHEST, 0.45], [HEAD, 0.55]] },
    { at: [0.01, REST_HIPS + 0.615, 0], r: [0.05, 0.052, 0.05, 0.05], weights: HEAD },
  ], { around: 16, color: skinColor });
  [-1, 1].forEach((side) => {
    // The shoulders are always under a sleeve.
    limb(skin, ARM, [0, shoulderY, side * SHOULDER], side, armWeights, { from: look.top === 'tee' ? 0.07 : 0.42, to: 0.585, color: skinColor });
    limb(skin, LEG, [0, hipY, side * HIP], side, legWeights, { from: 0.1, to: 0.9, color: skinColor, capEnd: true });
  });

  // The top. A hoodie hangs loose and boxy, a jacket a little less, a
  // T-shirt follows the body.
  const fit = {
    tee: { pad: 0.007, hem: 0.04, least: [0, 0, 0], crease: 0.006, sleeve: 0.006 },
    hoodie: { pad: 0.02, hem: -0.025, least: [0.172, 0.118, 0.106], crease: 0.02, sleeve: 0.02 },
    jacket: { pad: 0.015, hem: -0.015, least: [0.164, 0.11, 0.098], crease: 0.016, sleeve: 0.015 },
  }[look.top];
  const tee = look.top === 'tee';
  const frontAt = (y) => Math.max(measure(TORSO, y)[2] + fit.pad, y < 0.4 ? fit.least[1] : 0);
  const neckline = tee ? 0.538 : 0.55;
  // A T-shirt carries a print, so it is drawn from its picture; the other
  // tops are plain upper.
  trunk(tee ? print : upper, {
    from: fit.hem, to: neckline, pad: fit.pad, least: fit.least, color: tee ? PLAIN : top, lipStart: true, lipEnd: true,
    shape: folds(0.17, 0.14, fit.crease, 90),
    tint: (y) => {
      if (tee) {
        return PLAIN;
      }
      return y < fit.hem + 0.04 ? topTrim : top;
    },
    map: tee ? (share, ring) => [share, PRINT_FOOT + (1 - PRINT_FOOT) * ring.share] : null,
  });
  [-1, 1].forEach((side) => {
    const origin = [0, shoulderY, side * SHOULDER];
    if (tee) {
      limb(print, ARM, origin, side, armWeights, {
        from: -0.05, to: 0.17, pad: fit.sleeve + 0.002, least: 0.052, color: PLAIN, lipEnd: true, capStart: true,
        shape: folds(0.12, 0.06, 0.02, 150),
        map: PRINT_TRIM,
      });
      return;
    }
    limb(upper, ARM, origin, side, armWeights, {
      from: -0.05, to: 0.56, pad: fit.sleeve, least: 0.04, color: top, lipEnd: true, capStart: true,
      shape: folds(0.29, 0.1, 0.035, 130),
      tint: (t) => (t > 0.515 ? topTrim : top),
    });
  });
  if (look.top === 'hoodie') {
    // The hood lying on the back, a pouch pocket and two drawstrings.
    upper.ball([-0.1, REST_HIPS + 0.535, 0], [0.062, 0.09, 0.118], top, CHEST, { segments: 14, turn: [0, 0, 0.35] });
    upper.ball([-0.05, REST_HIPS + 0.56, 0], [0.085, 0.03, 0.1], topTrim, CHEST, { segments: 12 });
    upper.block([frontAt(0.15) - 0.002, REST_HIPS + 0.15, 0], [0.016, 0.1, 0.2], topTrim, onTrunk);
    [-1, 1].forEach((side) => {
      upper.path([[frontAt(0.52) - 0.004, REST_HIPS + 0.53, side * 0.03], [frontAt(0.47) + 0.004, REST_HIPS + 0.47, side * 0.034], [frontAt(0.4) + 0.004, REST_HIPS + 0.4, side * 0.03]], 0.0042, { around: 6, color: WHITE, weights: CHEST });
    });
  }
  if (look.top === 'jacket') {
    // A stand-up collar, a zip down the front and two chest pockets.
    upper.tube([
      { at: [0.004, REST_HIPS + 0.535, 0], r: [0.075, 0.078, 0.078, 0.078] },
      { at: [0.008, REST_HIPS + 0.6, 0], r: [0.068, 0.07, 0.068, 0.068] },
      { at: [0.008, REST_HIPS + 0.6, 0], r: [0.058, 0.06, 0.058, 0.058] },
    ], { around: 18, color: topTrim, weights: CHEST });
    const zip = [];
    for (let y = fit.hem + 0.01; y <= 0.56; y += 0.05) {
      zip.push([frontAt(y) + 0.001, REST_HIPS + y, 0]);
    }
    upper.path(zip, [0.007, 0.004], { around: 6, up: [1, 0, 0], color: new THREE.Color('#d9dce2'), weights: onTrunk });
    [-1, 1].forEach((side) => {
      upper.block([frontAt(0.38) - 0.012, REST_HIPS + 0.38, side * 0.088], [0.014, 0.02, 0.075], topTrim, CHEST);
    });
  }

  // The bottoms: the seat, a waistband, then the legs.
  const cut = {
    // Baggy cargo shorts, down to the knee.
    shorts: { pad: 0.02, to: 0.425, least: 0.086, loose: 0.012 },
    pants: { pad: 0.01, to: 0.86, least: 0.046, loose: 0 },
    baggy: { pad: 0.026, to: 0.875, least: 0.074, loose: 0.03 },
  }[look.bottom];
  trunk(cloth, {
    from: -0.105, to: 0.135, pad: cut.pad, color: bottom, capStart: true, lipEnd: true,
    tint: (y) => (y > 0.1 ? bottomTrim : bottom),
  });
  const seat = measure(TORSO, -0.01)[3] + cut.pad;
  [-1, 1].forEach((side) => {
    // Back pockets.
    cloth.block([-seat + 0.004, REST_HIPS - 0.01, side * 0.075], [0.012, 0.085, 0.075], bottomTrim, HIPS);
    limb(cloth, LEG, [0, hipY, side * HIP], side, legWeights, {
      from: -0.04, to: cut.to, pad: cut.pad, least: cut.least, color: bottom, lipEnd: true,
      shape: (t) => folds(0.44, 0.1, 0.03 + cut.loose, 120)(t) * (1 + cut.loose * 1.5 * Math.sin(t * 150) * smooth(0.68, 0.86, t)),
      tint: (t) => (t > cut.to - 0.03 ? bottomTrim : bottom),
    });
    if (look.bottom === 'shorts') {
      // Cargo pockets on the thighs, each with a flap, and a seam down
      // the outside of the leg.
      const outer = measure(LEG, 0.25)[3] + cut.pad;
      const thigh = boneOf(side, THIGH_BONE);
      cloth.block([-0.004, hipY - 0.27, side * (HIP + outer + 0.002)], [0.1, 0.12, 0.02], bottom, thigh, [0, 0, 0], 1);
      cloth.block([-0.004, hipY - 0.215, side * (HIP + outer + 0.008)], [0.108, 0.036, 0.018], bottomTrim, thigh, [0, 0, 0], 1);
      cloth.block([-0.004, hipY - 0.228, side * (HIP + outer + 0.018)], [0.016, 0.012, 0.006], DARK, thigh, [0, 0, 0], 0);
      cloth.path([[0, hipY - 0.03, side * (HIP + outer - 0.004)], [0, hipY - 0.12, side * (HIP + outer + 0.002)], [0, hipY - 0.2, side * (HIP + outer + 0.004)]], [0.004, 0.003], { around: 4, color: bottomTrim, weights: thigh, up: [0, 0, 1] });
    }
    if (look.bottom === 'shorts' && board !== 'snow') {
      // Socks to the middle of the calf, with two stripes: dark on a
      // bike, white on a skateboard.
      const sock = bike ? DARK : WHITE;
      const stripe = new THREE.Color(look.topColor);
      limb(cloth, LEG, [0, hipY, side * HIP], side, legWeights, {
        from: 0.63, to: 0.875, pad: 0.005, color: sock, lipStart: true,
        tint: (t) => ((t > 0.665 && t < 0.69) || (t > 0.705 && t < 0.73) ? stripe : sock),
      });
    }
    if (look.bottom === 'shorts' && bike) {
      // Knee pads: a stretch sleeve with a hard cup over the kneecap.
      const pad = shade('#22222a', 1.25);
      limb(gear, LEG, [0, hipY, side * HIP], side, legWeights, { from: 0.37, to: 0.575, pad: 0.009, color: DARK, lipStart: true, lipEnd: true });
      const both = [[boneOf(side, THIGH_BONE), 0.5], [boneOf(side, SHIN_BONE), 0.5]];
      gear.ball([0.064, hipY - 0.455, side * HIP], [0.026, 0.066, 0.052], pad, both, { segments: 12 });
      gear.ball([0.07, hipY - 0.41, side * HIP], [0.016, 0.022, 0.04], DARK, [[boneOf(side, THIGH_BONE), 1]], { segments: 8 });
      gear.ball([0.066, hipY - 0.51, side * HIP], [0.016, 0.026, 0.04], DARK, [[boneOf(side, SHIN_BONE), 1]], { segments: 8 });
    }
  });
}

/* ---------- The head ---------- */

function bump(y, z, atY, atZ, tall, wide) {
  return Math.exp(-(((y - atY) / tall) ** 2) - ((z - atZ) / wide) ** 2);
}

// A point on the head, from how far down from the crown it is (`polar`)
// and how far around from the front (`around`), `lift` above the skin. The
// head is round and soft, with full cheeks and a small chin: a cute
// cartoon head, not a lifelike one.
function headPoint(polar, around, lift = 0) {
  const ring = Math.sin(polar);
  const dx = ring * Math.cos(around);
  const dy = Math.cos(polar);
  const dz = ring * Math.sin(around);
  let x = dx * (dx >= 0 ? 0.098 : 0.104) - 0.006;
  const y = dy * 0.1175;
  let z = dz * 0.09;
  const low = smooth(0.005, 0.1175, -y);
  z *= 1 - 0.1 * low - 0.16 * low ** 3;
  if (x < 0) {
    x *= 1 - 0.36 * low;
  }
  const front = smooth(0.1, 0.5, dx);
  x += front * (
    0.02 * smooth(0.03, 0.11, -y)
    + 0.004 * bump(y, z, -0.022, 0, 0.012, 0.01)
    + 0.004 * (bump(y, z, -0.03, 0.05, 0.026, 0.026) + bump(y, z, -0.03, -0.05, 0.026, 0.026))
    + 0.004 * bump(y, z, -0.1, 0, 0.016, 0.022)
  );
  return [x + dx * lift, y + dy * lift, z + dz * lift];
}

// A point on the front of the head, from how high it is (from the head's
// middle) and how far to the side, `lift` above the skin.
function onFace(up, side, lift = 0.001) {
  return onHead(headPoint(Math.acos(up / 0.1175), Math.atan2(side, 0.085), lift));
}

// The same point in the rest pose.
function onHead(point) {
  return [point[0], point[1] + REST_HEAD, point[2]];
}

// Around the head, with more columns over the face than the back.
function faceAround(share) {
  const s = share * 2 - 1;
  return Math.PI * Math.sign(s) * Math.abs(s) ** 1.35;
}

// How far down from the crown the hair grows, by how far around from the
// nose: the forehead, the temples, over the ears and down to the nape.
const HAIRLINE = [[0, 57], [40, 58], [68, 72], [90, 88], [112, 110], [150, 126], [180, 130]];

function hairline(around) {
  const degrees = Math.abs(around) * (180 / Math.PI);
  for (let i = 1; i < HAIRLINE.length; i += 1) {
    if (degrees <= HAIRLINE[i][0]) {
      const [a0, p0] = HAIRLINE[i - 1];
      const [a1, p1] = HAIRLINE[i];
      return (p0 + (p1 - p0) * smooth(a0, a1, degrees)) * (Math.PI / 180);
    }
  }
  return 130 * (Math.PI / 180);
}

// A cap of something lying on the head: hair, a hat, a helmet. `reach`
// says how far down it comes at each place around, `lift` how thick it is.
function scalp(sculpt, color, { reach, lift, from = 0, rows = 14, cols = 40 }) {
  sculpt.grid(rows, cols, (i, j) => {
    const around = faceAround(j / cols);
    const polar = from + (reach(around) - from) * (i / rows);
    return { at: onHead(headPoint(polar, around, lift(polar, around, i / rows))), color };
  }, { weights: HEAD, center: [0, REST_HEAD, 0] });
}

function buildHead(kit, look) {
  const { skin, face, eyes } = kit;
  const skinColor = skinTone(look.skin);
  // A simple cute face, the same for every rider: two big shiny dot eyes
  // set low and wide, pink cheeks and a small smile.
  const blush = skinTone(look.skin).lerp(new THREE.Color('#ff6f91'), 0.55);
  [-1, 1].forEach((side) => {
    const eye = onFace(-0.012, side * 0.036, 0.0005);
    eyes.ball(eye, [0.005, 0.0165, 0.0125], new THREE.Color('#1d1626'), HEAD, { segments: 14, turn: [0, side * -0.38, 0] });
    eyes.ball([eye[0] + 0.0042, eye[1] + 0.0066, eye[2] + 0.0038], [0.002, 0.0046, 0.0038], new THREE.Color('#ffffff'), HEAD, { segments: 8 });
    eyes.ball([eye[0] + 0.0046, eye[1] - 0.006, eye[2] - 0.0034], [0.0012, 0.0022, 0.002], new THREE.Color('#ffffff'), HEAD, { segments: 6 });
    face.ball(onFace(-0.036, side * 0.056, -0.002), [0.004, 0.0085, 0.0135], blush, HEAD, { segments: 10, turn: [0, side * -0.55, 0] });
  });
  eyes.path([onFace(-0.04, -0.011), onFace(-0.0455, 0), onFace(-0.04, 0.011)], 0.0016, { around: 6, color: new THREE.Color('#8a3b4a'), weights: HEAD });
  face.grid(44, 52, (i, j) => ({
    at: onHead(headPoint((i / 44) * Math.PI, faceAround(j / 52))),
    color: skinColor.clone(),
  }), { weights: HEAD, center: [0, REST_HEAD, 0] });
  // Ears, each with its darker hollow.
  [-1, 1].forEach((side) => {
    skin.ball([-0.012, REST_HEAD - 0.004, side * 0.0745], [0.017, 0.03, 0.008], skinColor, HEAD, { segments: 12, turn: [side * 0.18, side * -0.28, 0.15] });
    skin.ball([-0.009, REST_HEAD - 0.004, side * 0.0795], [0.009, 0.019, 0.005], skinTone(look.skin).multiplyScalar(0.72), HEAD, { segments: 8, turn: [side * 0.25, side * -0.35, 0.15] });
  });
}

/* ---------- Hair, hats and glasses ---------- */

// A picture of fine lines, for the shine of combed hair.
function strandTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  let seed = 7;
  for (let x = 0; x < 64; x += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const tone = 70 + (seed / 2147483648) * 150;
    ctx.fillStyle = `rgb(${tone}, ${tone}, ${tone})`;
    ctx.fillRect(x, 0, 1, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// A lock of hair: thick at the root, thin and flat at the tip.
function lock(hair, color, points, thick, tip = 0.25) {
  hair.path(points.map(onHead), (t) => [thick * (1 - t * (1 - tip)), thick * 0.6 * (1 - t * (1 - tip))], { around: 6, color, weights: HEAD, up: [1, 0, 0] });
}

function buildHair(kit, look) {
  const { hair } = kit;
  const color = new THREE.Color(look.hairColor);
  const dark = shade(look.hairColor, 0.78);
  const pick = (k) => (k % 2 ? dark : color);
  const hat = look.hat;
  const covered = hat !== 'none';
  const style = look.hair;
  const cropped = style === 'buzz' || style === 'mohawk';
  // The hair on the scalp: thick and wavy, or a short stubble.
  const body = { short: 0.016, long: 0.017, ponytail: 0.011, curly: 0.012, mohawk: 0.0035, buzz: 0.0045 }[style];
  scalp(hair, cropped ? dark : color, {
    reach: (around) => hairline(around) + (style === 'long' ? 0.12 * smooth(1.2, 2.2, Math.abs(around)) : 0),
    lift: (polar, around, share) => {
      const edge = 0.25 + 0.75 * smooth(1, 0.8, share);
      const wave = cropped ? 0 : 0.0028 * Math.sin(around * 23 + polar * 5) + 0.002 * Math.sin(around * 9 - polar * 11);
      return (covered ? Math.min(body, 0.008) : body) * edge + wave * edge;
    },
    rows: 16,
    cols: 48,
  });

  if (style === 'short' && !covered) {
    // Tousled: layers of locks that lift off the head and fall every
    // which way, mostly swept to one side, with a loose fringe that
    // stops short of the brows.
    let seed = 11;
    const chance = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let k = 0; k < 96; k += 1) {
      const around = ((k * 2.399) % (Math.PI * 2)) - Math.PI;
      const edge = hairline(around);
      const polar = 0.06 + ((k * 0.618) % 1) * (edge - 0.1);
      const front = Math.abs(around) < 1.1 && polar > edge - 0.34;
      // Which way the lock runs: around the head and a little down.
      const sweep = (0.3 + chance() * 0.35) * (chance() < 0.82 ? 1 : -1) / Math.max(0.45, Math.sin(polar));
      const down = front ? 0.1 + chance() * 0.08 : (chance() - 0.35) * 0.3;
      const lift = 0.02 + chance() * 0.018;
      const at = (step, raise) => {
        const point = headPoint(Math.min(polar + down * step, edge + (front ? 0.07 : 0.02)), around + sweep * step, raise);
        return [point[0], point[1], point[2]];
      };
      lock(hair, pick(k), [at(0, 0.008), at(0.5, lift), at(1, lift * 0.75)], 0.012 + chance() * 0.006, 0.22);
    }
  }
  if (style === 'long') {
    // A curtain of hair from the temples around the back, falling to the
    // shoulders, with a few loose locks over it.
    const fall = (around, share, lift) => {
      const edge = hairline(around);
      if (share < 0.3) {
        return headPoint(edge - 0.3 + (share / 0.3) * 0.36, around, lift);
      }
      const from = headPoint(edge + 0.06, around, lift);
      const down = (share - 0.3) / 0.7;
      const swell = 1 + 0.1 * Math.sin(down * Math.PI) - 0.08 * down;
      return [from[0] * swell - 0.012 * down, from[1] - down * (from[1] + 0.215 + 0.012 * Math.sin(around * 7)), from[2] * swell];
    };
    const sweep = (share) => {
      const angle = 1.15 + share * (Math.PI * 2 - 2.3);
      return angle > Math.PI ? angle - Math.PI * 2 : angle;
    };
    hair.grid(12, 44, (i, j) => {
      const around = sweep(j / 44);
      return { at: onHead(fall(around, i / 12, 0.019 + 0.003 * Math.sin(j * 2.3))), color: j % 5 === 0 ? dark : color };
    }, { weights: HEAD, center: [0, REST_HEAD - 0.05, 0], wrap: false });
    for (let k = 0; k < 16; k += 1) {
      const around = sweep((k + 0.5) / 16);
      lock(hair, pick(k), [0.05, 0.35, 0.65, 0.97].map((share) => fall(around, share, 0.026)), 0.013, 0.3);
    }
  }
  if (style === 'ponytail') {
    // Pulled back and plaited into a long braid down the middle of the
    // back. Its top follows the head; the rest lies on the back, so it
    // stays put when the rider bends over the bars.
    const from = [-0.1, -0.05];
    const links = 17;
    hair.ball(onHead([from[0], from[1] + 0.012, 0]), [0.024, 0.024, 0.03], dark, HEAD, { segments: 10 });
    for (let k = 0; k <= links; k += 1) {
      const share = k / links;
      const y = REST_HEAD + from[1] - share * 0.4;
      const back = measure(TORSO, Math.min(0.56, y - REST_HIPS))[3];
      const lying = smooth(0.02, 0.3, share);
      const x = from[0] + (-(back + 0.034) - from[0]) * lying;
      const follow = smooth(0.08, 0.34, share);
      const size = 1 - 0.35 * share;
      const weave = k % 2 ? 1 : -1;
      hair.ball([x, y, weave * 0.008 * size], [0.019 * size, 0.021, 0.022 * size], pick(k), [[HEAD, 1 - follow], [CHEST, follow]], { segments: 8, turn: [weave * 0.55, 0, 0] });
      if (k === links) {
        // A band, then the loose end.
        hair.ball([x, y - 0.012, 0], [0.013, 0.008, 0.013], new THREE.Color('#d8452e'), CHEST, { segments: 8 });
        hair.ball([x + 0.002, y - 0.04, 0], [0.012, 0.03, 0.013], color, CHEST, { segments: 8 });
      }
    }
  }
  if (style === 'curly') {
    // A mass of tight curls, all over the scalp.
    for (let k = 0; k < 110; k += 1) {
      const around = ((k * 2.399) % (Math.PI * 2)) - Math.PI;
      const polar = 0.08 + ((k * 0.618) % 1) * (hairline(around) - 0.12);
      if (covered && polar < 1.2) {
        continue;
      }
      const size = 0.019 + (k % 4) * 0.0032;
      const at = headPoint(polar, around, 0.012 + (k % 3) * 0.005);
      hair.ball(onHead(at), [size, size, size], pick(k), HEAD, { segments: 7 });
    }
  }
  if (style === 'mohawk' && hat !== 'helmet' && hat !== 'beanie') {
    // A crest of spikes from the forehead to the nape.
    for (let k = 0; k < 11; k += 1) {
      const polar = -0.85 + k * 0.27;
      const around = polar < 0 ? 0 : Math.PI;
      const root = headPoint(Math.abs(polar), around, 0);
      const tip = headPoint(Math.abs(polar), around, 0.085 - Math.abs(k - 5) * 0.006);
      hair.path([onHead(root), onHead([(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, 0]), onHead(tip)], (t) => [0.02 * (1 - t * 0.9), 0.011 * (1 - t * 0.8)], { around: 6, color: pick(k), weights: HEAD, up: [0, 0, 1] });
    }
  }
}

function buildHat(kit, look) {
  const { gear, gloss, cloth } = kit;
  const color = new THREE.Color(look.hatColor);
  const trim = shade(look.hatColor, 0.7);
  const hat = look.hat;
  const degrees = Math.PI / 180;
  if (hat === 'cap' || hat === 'backCap') {
    // Six panels with a button on top, and a curved brim.
    const way = hat === 'cap' ? 1 : -1;
    scalp(cloth, color, {
      reach: () => 80 * degrees,
      lift: (polar, around) => 0.016 + 0.0016 * Math.cos(around * 6) - 0.004 * smooth(1.1, 1.4, polar),
      rows: 12,
    });
    cloth.ball(onHead([0, 0.135, 0]), [0.011, 0.006, 0.011], trim, HEAD, { segments: 8 });
    cloth.grid(5, 14, (i, j) => {
      const around = (j / 14 - 0.5) * 1.9;
      const root = headPoint(76 * degrees, around, 0.016);
      const out = (i / 5) * 0.082 * (1 - 0.35 * (around / 0.95) ** 2);
      return { at: onHead([way * (root[0] + out), root[1] - 0.004 - out * 0.22 - 0.012 * (around / 0.95) ** 2, root[2]]), color: i === 5 ? trim : color };
    }, { weights: HEAD, center: [0, REST_HEAD - 0.5, 0], wrap: false });
    // The band around the back, with its gap and strap.
    cloth.path([-1, -0.5, 0, 0.5, 1].map((s) => {
      const p = headPoint(80 * degrees, Math.PI + s * 0.5, 0.017);
      return onHead([way * p[0], p[1], p[2]]);
    }), [0.003, 0.008], { around: 6, color: trim, weights: HEAD });
  }
  if (hat === 'beanie') {
    // A knitted hat with a turned-up, ribbed cuff and a bobble.
    scalp(cloth, color, {
      reach: (around) => (88 + 8 * smooth(0.6, 1.6, Math.abs(around))) * degrees,
      lift: (polar, around) => 0.018 + 0.012 * smooth(0.5, 0, polar) + 0.0012 * Math.sin(around * 40),
      rows: 14,
    });
    scalp(cloth, trim, {
      from: 62 * degrees,
      reach: (around) => (89 + 8 * smooth(0.6, 1.6, Math.abs(around))) * degrees,
      lift: (polar, around, share) => 0.022 + 0.004 * Math.sin(share * Math.PI) + 0.0022 * Math.sin(around * 44),
      rows: 5,
    });
    cloth.ball(onHead([-0.005, 0.158, 0]), [0.03, 0.028, 0.03], WHITE, HEAD, { segments: 10 });
  }
  if (hat === 'helmet') {
    // A skate helmet: a hard shell with vents, a rim, a short visor and
    // straps that meet under the chin.
    const reach = (around) => (64 + 40 * smooth(0.5, 1.5, Math.abs(around)) + 8 * smooth(2, 3, Math.abs(around))) * degrees;
    scalp(gloss, color, { reach, lift: (polar, around, share) => 0.03 - 0.008 * smooth(0.8, 1, share), rows: 16, cols: 44 });
    const rim = [];
    for (let k = 0; k <= 40; k += 1) {
      const around = (k / 40) * Math.PI * 2 - Math.PI;
      rim.push(onHead(headPoint(reach(around), around, 0.021)));
    }
    gear.path(rim, 0.0058, { around: 6, steps: 80, color: DARK, weights: HEAD });
    // Long vents: three rows on each side from the front to the crown,
    // and two at the back.
    const vents = [];
    for (let k = 0; k < 12; k += 1) {
      const side = k % 2 ? 1 : -1;
      vents.push([side * (0.3 + Math.floor(k / 4) * 0.72), 0.28 + Math.floor((k % 4) / 2) * 0.4]);
    }
    vents.push([Math.PI - 0.5, 0.95], [-Math.PI + 0.5, 0.95]);
    vents.forEach(([around, polar]) => {
      const a = headPoint(polar, around, 0.0305);
      const b = headPoint(polar + 0.27, around, 0.0305);
      gear.path([onHead(a), onHead(b)], [0.0075, 0.002], { around: 6, steps: 3, color: DARK, weights: HEAD, up: [a[0], a[1], a[2]] });
    });
    gloss.grid(3, 10, (i, j) => {
      const around = (j / 10 - 0.5) * 1.5;
      const root = headPoint(62 * degrees, around, 0.03);
      const out = (i / 3) * 0.036;
      return { at: onHead([root[0] + out, root[1] - 0.006 - out * 0.3, root[2]]), color: trim };
    }, { weights: HEAD, center: [0, REST_HEAD - 0.5, 0], wrap: false });
    [-1, 1].forEach((side) => {
      const from = headPoint(96 * degrees, side * 1.25, 0.012);
      const back = headPoint(104 * degrees, side * 1.95, 0.012);
      const chin = [0.045, -0.128, side * 0.012];
      gear.path([onHead(from), onHead([0.03, -0.07, side * 0.066]), onHead(chin)], [0.002, 0.007], { around: 4, color: DARK, weights: HEAD, up: [0, 0, 1] });
      gear.path([onHead(back), onHead([0.012, -0.06, side * 0.074]), onHead([0.03, -0.07, side * 0.066])], [0.002, 0.006], { around: 4, color: DARK, weights: HEAD, up: [0, 0, 1] });
    });
    gear.block(onHead([0.045, -0.128, 0]), [0.014, 0.008, 0.03], DARK, HEAD);
  }
}

function buildGlasses(kit, look) {
  const { gear, gloss } = kit;
  if (look.glasses === 'shades') {
    // Two dark lenses in a frame, with arms back to the ears.
    const frame = new THREE.Color('#15151a');
    [-1, 1].forEach((side) => {
      gloss.ball(onHead([0.091, 0.008, side * 0.032]), [0.0045, 0.018, 0.0255], new THREE.Color('#0c0c12'), HEAD, { segments: 14, turn: [0, side * -0.22, 0] });
      const ring = [];
      for (let k = 0; k <= 12; k += 1) {
        const angle = (k / 12) * Math.PI * 2;
        ring.push(onHead([0.0905 - Math.abs(Math.sin(angle)) * 0.0005 - (side * Math.sin(angle) > 0 ? 0.006 * Math.abs(Math.sin(angle)) : 0), 0.008 + Math.cos(angle) * 0.019, side * 0.032 + Math.sin(angle) * 0.0265]));
      }
      gear.path(ring, 0.0022, { around: 5, steps: 24, color: frame, weights: HEAD, capStart: false, capEnd: false });
      gear.path([onHead([0.083, 0.014, side * 0.06]), onHead([0.03, 0.016, side * 0.079]), onHead([-0.02, 0.012, side * 0.08])], [0.0018, 0.0035], { around: 4, color: frame, weights: HEAD });
    });
    gear.path([onHead([0.094, 0.014, -0.008]), onHead([0.098, 0.016, 0]), onHead([0.094, 0.014, 0.008])], 0.0022, { around: 5, color: frame, weights: HEAD });
  }
  if (look.glasses === 'goggles') {
    // One wide mirrored lens in a soft frame, on a strap around the head.
    const thick = look.hat === 'helmet' ? 0.034 : 0.022;
    const strap = [];
    for (let k = 0; k <= 32; k += 1) {
      const around = (k / 32) * Math.PI * 2 - Math.PI;
      const front = smooth(1.2, 0.5, Math.abs(around));
      strap.push(onHead(headPoint(Math.acos(0.012 / 0.1175) - 0.02, around, thick * (1 - front) + 0.012 * front)));
    }
    gear.path(strap, [0.0025, 0.016], { around: 6, steps: 64, color: DARK, weights: HEAD });
    gear.grid(6, 16, (i, j) => {
      const around = (j / 16 - 0.5) * 1.75;
      const p = headPoint(1.36 + (i / 6) * 0.42, around, 0.012 + 0.004 * Math.sin((i / 6) * Math.PI));
      return { at: onHead(p), color: DARK };
    }, { weights: HEAD, center: [0, REST_HEAD, 0], wrap: false });
    gloss.grid(5, 14, (i, j) => {
      const around = (j / 14 - 0.5) * 1.5;
      const p = headPoint(1.4 + (i / 5) * 0.33, around, 0.018 + 0.003 * Math.sin((i / 5) * Math.PI));
      return { at: onHead(p), color: new THREE.Color('#ff9a2a') };
    }, { weights: HEAD, center: [0, REST_HEAD, 0], wrap: false });
  }
}

/* ---------- Hands and shoes ---------- */

// A hand at the end of an arm hanging down: a palm, four fingers that
// bend at two joints, and a thumb. Gloves are the same, thicker.
function buildHand(sculpt, side, color, thick = 1) {
  const gloved = thick > 1;
  const hand = boneOf(side, HAND);
  const knuckles = boneOf(side, KNUCKLES);
  const tips = boneOf(side, FINGERS);
  const wrist = REST_HIPS + CHEST_Y + 0.02 - UPPER_ARM - FOREARM;
  const z = side * SHOULDER;
  const palm = [[0.012, 0.028, 0.02], [-0.02, 0.034, 0.0165], [-0.05, 0.041, 0.0145], [-0.084, 0.04, 0.0125], [-0.096, 0.035, 0.0095]];
  sculpt.tube(palm.map(([down, wide, deep]) => ({ at: [0, wrist + down, z], r: [wide * thick, wide * thick, deep * thick, deep * thick] })), { around: 12, color, weights: hand, capEnd: true });
  [[0.03, 0.07, 0.0088], [0.0105, 0.078, 0.009], [-0.0095, 0.072, 0.0085], [-0.029, 0.058, 0.0078]].forEach(([x, long, radius]) => {
    const rings = [0, 0.2, 0.4, 0.5, 0.6, 0.8, 0.94, 1].map((share) => {
      const bend = smooth(0.4, 0.6, share);
      let weights = [[knuckles, 1 - bend], [tips, bend]];
      if (share === 0) {
        weights = [[hand, 0.5], [knuckles, 0.5]];
      }
      const r = radius * thick * (1 - share * 0.2) * (share === 1 ? 0.55 : 1);
      return { at: [x, wrist - 0.09 - share * long, z], r, weights };
    });
    sculpt.tube(rings, { around: 8, color, capEnd: true });
  });
  sculpt.path([[0.03, wrist - 0.028, z - side * 0.004], [0.052, wrist - 0.058, z - side * 0.013], [0.058, wrist - 0.09, z - side * 0.02]], (t) => (0.0118 - t * 0.0036) * thick, { around: 8, color, weights: hand });
  if (gloved) {
    // The cuff, wide on a snow mitt and close on a riding glove.
    const cuff = thick > 1.2 ? 0.04 : 0.032;
    sculpt.tube([0.035, 0.03, -0.012].map((down, k) => ({ at: [0, wrist + down, z], r: [cuff - k * 0.002, cuff - k * 0.002, cuff - 0.006 - k * 0.002, cuff - 0.006 - k * 0.002] })), { around: 12, color, weights: hand });
  }
}

// How tall a shoe is over the sole, and how wide, from heel to toe:
// [forward of the ankle, height, half width].
const SHOE = [[-0.088, 0.03, 0.012], [-0.08, 0.074, 0.034], [-0.05, 0.083, 0.043], [-0.012, 0.081, 0.046], [0.03, 0.07, 0.048], [0.07, 0.053, 0.05], [0.11, 0.041, 0.05], [0.15, 0.034, 0.046], [0.18, 0.026, 0.034], [0.193, 0.012, 0.015]];

// A sneaker, or a snowboard boot: a shaped sole with a rubber toe, the
// upper, a padded collar, a tongue with laces, a heel tab and a stripe.
function buildShoe(kit, side, boot, look, trail = false) {
  const { gear } = kit;
  const foot = boneOf(side, FOOT);
  const upper = new THREE.Color(look.shoes);
  const trim = shade(look.shoes, 0.68);
  const z = side * HIP;
  const ground = REST_HIPS - 0.02 - THIGH - SHIN - ANKLE;
  const thick = boot ? 0.034 : 0.026;
  const top = ground + thick;
  const grow = boot ? 1.14 : 1;
  const along = [0, 1, 0];
  // A trail shoe has a dark sole with lugs under it; a sneaker a white one.
  const sole = trail ? DARK : WHITE;
  gear.tube(SHOE.map(([x, , wide]) => ({ at: [x * grow, top, z], u: along, r: [0.003, thick, (wide + 0.004) * grow, (wide + 0.004) * grow] })), { around: 14, color: sole, weights: foot, capStart: true, capEnd: true });
  if (trail) {
    [-0.07, -0.04, -0.01, 0.05, 0.08, 0.11, 0.14, 0.17].forEach((x, i) => {
      gear.block([x, ground + 0.002, z], [0.018, 0.01, i > 6 ? 0.06 : 0.088], DARK, foot, [0, 0, 0], 0);
    });
  }
  gear.tube(SHOE.map(([x, tall, wide], i) => ({
    at: [x * grow, top, z], u: along, r: [tall * grow, 0.004, wide * grow, wide * grow], color: i >= SHOE.length - 3 && !boot ? sole : upper,
  })), { around: 14, color: upper, weights: foot, capStart: true, capEnd: true });
  // The padded collar around the ankle, and a tab at the heel.
  const collar = [];
  for (let k = 0; k <= 12; k += 1) {
    const angle = (k / 12) * Math.PI * 2;
    collar.push([-0.028 * grow + Math.cos(angle) * 0.04 * grow, top + 0.083 * grow, z + Math.sin(angle) * 0.04 * grow]);
  }
  gear.path(collar, 0.012, { around: 6, steps: 24, color: trim, weights: foot, capStart: false, capEnd: false });
  gear.block([-0.083 * grow, top + 0.085 * grow, z], [0.008, 0.03, 0.024], trim, foot);
  // The tongue and the laces over it.
  gear.block([0.03 * grow, top + 0.078 * grow, z], [0.08, 0.016, 0.046], trim, foot, [0, 0, -0.42]);
  [0.03, 0.052, 0.074, 0.096, 0.118].forEach((x, i) => {
    const tall = measure(SHOE.map(([at, height]) => [at, height]), x)[1];
    gear.block([x * grow, top + (tall + 0.006) * grow + (i === 0 ? 0.006 : 0), z], [0.008, 0.006, 0.058], WHITE, foot, [0, i % 2 ? 0.25 : -0.25, 0]);
  });
  [-1, 1].forEach((flank) => {
    gear.block([0.02 * grow, top + 0.04 * grow, z + flank * 0.0475 * grow], [0.085, 0.012, 0.004], WHITE, foot, [0, 0, 0.5]);
  });
  if (boot) {
    // A boot comes up the shin, with two straps.
    gear.tube([0.06, 0.1, 0.15, 0.2, 0.215].map((up, k) => ({ at: [-0.026, top + up, z], r: k === 4 ? 0.05 : 0.06 + (k === 3 ? 0.002 : 0) })), { around: 14, color: upper, weights: [[boneOf(side, SHIN_BONE), 0.5], [foot, 0.5]] });
    [0.115, 0.17].forEach((up) => {
      gear.tube([up - 0.013, up, up + 0.013].map((y, k) => ({ at: [-0.026, top + y, z], r: k === 1 ? 0.068 : 0.062 })), { around: 14, color: trim, weights: [[boneOf(side, SHIN_BONE), 0.5], [foot, 0.5]] });
    });
  }
}

/* ---------- The whole rider ---------- */

const aimUp = new THREE.Vector3();
const aimSide = new THREE.Vector3();
const aimFront = new THREE.Vector3();
const aimBasis = new THREE.Matrix4();

// Points a bone from one joint at the next, with `normal` (the axis the
// limb bends around) fixing how it is rolled about its own length.
function aim(bone, from, to, normal) {
  aimUp.copy(from).sub(to).normalize();
  aimSide.copy(normal).addScaledVector(aimUp, -normal.dot(aimUp)).normalize();
  aimFront.crossVectors(aimUp, aimSide);
  aimBasis.makeBasis(aimFront, aimUp, aimSide);
  bone.position.copy(from);
  bone.quaternion.setFromRotationMatrix(aimBasis);
}

// The axis a limb bends around, from its three joints. Arms fold toward
// their front and legs toward their back, so one is the other's opposite.
// A straight limb has no such axis: keep the last one.
function bendAxis(normal, a, b, c, backward) {
  edgeA.copy(b).sub(a);
  edgeB.copy(c).sub(b);
  if (backward) {
    edgeB.cross(edgeA);
  } else {
    edgeB.crossVectors(edgeA, edgeB);
  }
  if (edgeB.lengthSq() > 1e-4) {
    normal.lerp(edgeB.normalize(), 0.5).normalize();
  }
}

// Builds a rider in their clothes on their board or bike. `update` poses
// them.
export function buildRider(look, board) {
  const owned = [];
  const bike = board === 'bike';
  const snow = board === 'snow';
  const group = new THREE.Group();
  // `spinner` spins and flips. On a bike everything inside is built facing
  // +x, then turned to face the way of travel and leaned into turns.
  const spinner = new THREE.Group();
  group.add(spinner);
  let body = spinner;
  const tilt = new THREE.Group();
  if (bike) {
    const turned = new THREE.Group();
    turned.rotation.y = -Math.PI / 2;
    turned.add(tilt);
    spinner.add(turned);
    body = tilt;
  }
  const boardHolder = new THREE.Group();
  const boardSpin = new THREE.Group();
  const deckY = DECK[board];
  const ride = bike ? buildBike(look) : null;
  if (bike) {
    body.add(ride.root);
  } else {
    const boardMesh = buildBoard(board, look, owned);
    // Spin the board around its middle.
    boardSpin.position.y = deckY / 2;
    boardMesh.position.y = -deckY / 2;
    boardSpin.add(boardMesh);
    boardHolder.add(boardSpin);
    body.add(boardHolder);
  }

  // Cloth has a fine weave that catches the light; hair has strands.
  const grain = bumpTexture(19);
  const weave = normalMapFrom(grain.image, { strength: 1.6, size: { width: 128, height: 128 } });
  const lines = strandTexture();
  const strands = normalMapFrom(lines.image, { strength: 2.4 });
  owned.push(grain, weave, lines, strands);
  // Skin has a soft sheen at its edges, like light through a cheek.
  const skinLook = () => new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.62, sheen: 0.1, sheenRoughness: 0.5, envMapIntensity: 0.35,
    sheenColor: skinTone(look.skin).lerp(new THREE.Color('#ff7a5a'), 0.5),
  });
  const materials = {
    skin: skinLook(),
    face: skinLook(),
    // The eyes are glossy, so they catch a glint.
    eyes: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, normalMap: weave, side: THREE.DoubleSide }),
    top: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: look.top === 'jacket' ? 0.6 : 0.92, normalMap: weave, side: THREE.DoubleSide }),
    gear: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, side: THREE.DoubleSide }),
    gloss: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.14, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }),
    hair: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, normalMap: strands, side: THREE.DoubleSide }),
    // A printed jersey or T-shirt: its colors come from a picture.
    print: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }),
  };
  if (look.top === 'tee') {
    materials.print.map = printTexture(look.topColor, bike);
    owned.push(materials.print.map);
  }
  const kit = { skin: new Sculpt(), face: new Sculpt(), eyes: new Sculpt(), cloth: new Sculpt(), top: new Sculpt(), gear: new Sculpt(), gloss: new Sculpt(), hair: new Sculpt(), print: new Sculpt() };
  buildBody(kit, look, board);
  buildHead(kit, look);
  buildHair(kit, look);
  buildHat(kit, look);
  buildGlasses(kit, look);
  [-1, 1].forEach((side) => {
    // Thick mitts in the snow, full-finger gloves on a bike, bare hands
    // on a skateboard.
    if (snow || bike) {
      buildHand(kit.gear, side, DARK, snow ? 1.32 : 1.12);
    } else {
      buildHand(kit.skin, side, skinTone(look.skin));
    }
    buildShoe(kit, side, snow, look, bike);
  });

  // The bones, standing in the rest pose the body was built in.
  const bones = Array.from({ length: BONES }, () => new THREE.Bone());
  const shoulderY = REST_HIPS + CHEST_Y + 0.02;
  const hipY = REST_HIPS - 0.02;
  bones[HIPS].position.set(0, REST_HIPS, 0);
  bones[CHEST].position.set(0, REST_HIPS + CHEST_Y, 0);
  bones[HEAD].position.set(0, REST_HEAD, 0);
  [-1, 1].forEach((side) => {
    const bone = (part) => bones[boneOf(side, part)];
    bone(UPPER).position.set(0, shoulderY, side * SHOULDER);
    bone(FORE).position.set(0, shoulderY - UPPER_ARM, side * SHOULDER);
    bone(HAND).position.set(0, shoulderY - UPPER_ARM - FOREARM, side * SHOULDER);
    // The finger joints hang from the hand, so they move with it.
    bone(KNUCKLES).position.set(0, -0.09, 0);
    bone(FINGERS).position.set(0, -0.036, 0);
    bone(HAND).add(bone(KNUCKLES));
    bone(KNUCKLES).add(bone(FINGERS));
    bone(THIGH_BONE).position.set(0, hipY, side * HIP);
    bone(SHIN_BONE).position.set(0, hipY - THIGH, side * HIP);
    bone(FOOT).position.set(0, hipY - THIGH - SHIN, side * HIP);
  });
  bones.forEach((bone) => {
    if (!bone.parent) {
      body.add(bone);
    }
  });
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const meshes = {};
  Object.entries(kit).forEach(([name, sculpt]) => {
    if (sculpt.empty) {
      materials[name].dispose();
      return;
    }
    const mesh = sculpt.mesh(materials[name]);
    body.add(mesh);
    mesh.bind(skeleton);
    meshes[name] = mesh;
  });

  // Puts on whichever pictures have arrived and aren't on yet.
  const worn = new Set();
  function dress() {
    const fresh = (name) => pictures[name] && !worn.has(name) && worn.add(name);
    // A printed top keeps its picture and only takes the knit's bumps,
    // laid by the weave's own coordinates.
    if (meshes.print && fresh('rider-knit')) {
      const { map, bumps } = detailTextures(pictures['rider-knit'], 1.8);
      map.dispose();
      bumps.channel = 1;
      owned.push(bumps);
      materials.print.normalMap = bumps;
      materials.print.needsUpdate = true;
    }
    const upperCloth = look.top === 'jacket' ? 'rider-shell' : 'rider-fleece';
    [['rider-twill', 'cloth', 2.2, 1.3], [upperCloth, 'top', 2.4, 1.3], ['rider-hair', 'hair', 2.6, 1.45]].forEach(([name, part, strength, lift]) => {
      const material = materials[part];
      if (!meshes[part] || !fresh(name)) {
        return;
      }
      const { map, bumps } = detailTextures(pictures[name], strength);
      owned.push(map, bumps);
      material.map = map;
      material.normalMap = bumps;
      // The picture is gray: brighten, so colors stay as chosen.
      material.color.setScalar(lift);
      material.needsUpdate = true;
    });
  }
  askPictures();
  dress();
  fitting.add(dress);

  // The pose is worked out on these, then copied to the bones.
  const hips = new THREE.Object3D();
  const waist = new THREE.Object3D();
  waist.position.y = WAIST_Y;
  const chest = new THREE.Object3D();
  chest.position.y = CHEST_Y - WAIST_Y;
  const head = new THREE.Object3D();
  head.position.y = HEAD_Y;
  // Sideways on a board, the head turns to look where it's going.
  head.rotation.y = bike ? 0 : -1.05;
  const chestMatrix = new THREE.Matrix4();
  const headMatrix = new THREE.Matrix4();
  const unused = new THREE.Vector3();
  const legs = [-1, 1].map((side) => ({ side, hip: new THREE.Vector3(), knee: new THREE.Vector3(), ankle: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1), turn: new THREE.Euler() }));
  const arms = [-1, 1].map((side) => ({ side, shoulder: new THREE.Vector3(), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1), curl: 0.25, grip: null }));

  // Smoothed pose values.
  const now = { hipY: bike ? 0.98 : 0.86, hipX: -0.2, lean: bike ? 0.75 : 0.15, roll: 0, twist: 0, lift: 0, feet: 0, spin: 0, bail: 0, side: 0, crouch: 0, table: 0 };
  const hands = [new THREE.Vector3(0.1, 0.95, -0.5), new THREE.Vector3(0.1, 0.95, 0.5)];
  const handGoal = [new THREE.Vector3(), new THREE.Vector3()];
  const feetNow = [new THREE.Vector3(-BIKE.pedal, 0.39, -FEET.bike), new THREE.Vector3(BIKE.pedal, 0.39, FEET.bike)];
  const footGoal = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const flipQ = new THREE.Quaternion();
  const spinQ = new THREE.Quaternion();
  const fall = new THREE.Quaternion();
  const pivot = new THREE.Vector3(0, 0.9, 0);
  const rotatedPivot = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const barAxis = new THREE.Vector3();
  const along = new THREE.Vector3();
  const feetZ = FEET[board];

  function approach(key, target, rate, dt) {
    now[key] += (target - now[key]) * Math.min(1, dt * rate);
  }

  // Applies the spin and flip (and the tip-over of a fall) to the body,
  // turning it around a point near the hips.
  function turnBody() {
    if (now.bail > 0.001) {
      // Tip over sideways, then lie there.
      axis.set(0, 0, -1);
      fall.setFromAxisAngle(axis, now.bail * Math.PI * 0.5);
      flipQ.premultiply(fall);
    }
    spinner.quaternion.copy(spinQ).multiply(flipQ);
    rotatedPivot.copy(pivot).applyQuaternion(flipQ).applyQuaternion(spinQ);
    if (flipQ.w < 0.99999) {
      spinner.position.copy(pivot).applyQuaternion(spinQ).sub(rotatedPivot);
      // Lying on its side, the body rests a shoulder's width off the ground.
      spinner.position.y -= now.bail * 0.68;
    } else {
      spinner.position.set(0, 0, 0);
    }
  }

  // Works out where the chest and head are from the hips and the spine.
  function settleSpine() {
    hips.updateMatrix();
    waist.updateMatrix();
    chest.updateMatrix();
    head.updateMatrix();
    chestMatrix.multiplyMatrices(hips.matrix, waist.matrix).multiply(chest.matrix);
    headMatrix.multiplyMatrices(chestMatrix, head.matrix);
  }

  // Copies the finished pose onto the bones. `dt` smooths the fingers.
  const headUp = new THREE.Vector3();
  function driveBones(dt) {
    bones[HIPS].position.copy(hips.position);
    bones[HIPS].quaternion.copy(hips.quaternion);
    chestMatrix.decompose(bones[CHEST].position, bones[CHEST].quaternion, unused);
    headMatrix.decompose(bones[HEAD].position, bones[HEAD].quaternion, unused);
    bones[HEAD].scale.setScalar(HEAD_SIZE);
    bones[HEAD].position.addScaledVector(headUp.set(0, 1, 0).applyQuaternion(bones[HEAD].quaternion), HEAD_LIFT);
    legs.forEach((leg) => {
      const bone = (part) => bones[boneOf(leg.side, part)];
      bendAxis(leg.normal, leg.hip, leg.knee, leg.ankle, true);
      aim(bone(THIGH_BONE), leg.hip, leg.knee, leg.normal);
      aim(bone(SHIN_BONE), leg.knee, leg.ankle, leg.normal);
      bone(FOOT).position.copy(leg.ankle);
      bone(FOOT).quaternion.setFromEuler(leg.turn);
    });
    arms.forEach((arm) => {
      const bone = (part) => bones[boneOf(arm.side, part)];
      bendAxis(arm.normal, arm.shoulder, arm.elbow, arm.wrist, false);
      aim(bone(UPPER), arm.shoulder, arm.elbow, arm.normal);
      aim(bone(FORE), arm.elbow, arm.wrist, arm.normal);
      bone(HAND).position.copy(arm.wrist);
      if (arm.grip) {
        // Wrapped around a bar: the knuckles line up with it, thumbs in,
        // and the palm rests on top.
        aimFront.copy(arm.grip).multiplyScalar(-arm.side);
        along.copy(arm.elbow).sub(arm.wrist);
        aimUp.copy(along).addScaledVector(aimFront, -along.dot(aimFront)).normalize();
        aimSide.crossVectors(aimFront, aimUp);
        aimBasis.makeBasis(aimFront, aimUp, aimSide);
        bone(HAND).quaternion.setFromRotationMatrix(aimBasis);
      } else {
        bone(HAND).quaternion.copy(bone(FORE).quaternion);
      }
      arm.curl += (arm.close - arm.curl) * Math.min(1, dt * 16);
      bone(KNUCKLES).rotation.x = arm.side * arm.curl * 1.25;
      bone(FINGERS).rotation.x = arm.side * arm.curl * 1.4;
    });
  }

  // The bicycle: standing on the pedals, hands on the bars, leaning into
  // turns; in the air the bars or the frame spin, the feet or hands come
  // off, or the whole bike flips.
  function poseBike(dt, pose) {
    const { state } = pose;
    const grab = state === 'air' ? pose.grab : null;
    const flip = state === 'air' ? pose.flip : null;
    const move = flip?.move || null;
    let hipX = -0.2;
    let hipY = 0.98;
    let lean = 0.75;
    if (state === 'air') {
      hipX = -0.24;
      hipY = 1.02;
      lean = 0.62;
    }
    if (grab === 'nohander') {
      lean = 0.3;
    }
    if (grab === 'superman') {
      hipX = -0.42;
      lean = 1.25;
    }
    if (move === 'tailwhip') {
      hipY = 1.1;
    }
    hipY -= pose.land * 0.2;
    approach('hipX', hipX, 10, dt);
    approach('hipY', hipY, 12, dt);
    approach('lean', lean, 10, dt);
    approach('roll', state === 'ride' ? pose.steer * 0.24 : 0, 8, dt);
    approach('twist', state === 'ride' ? pose.steer * 0.3 : 0, 8, dt);
    approach('table', grab === 'tabletop' ? 1 : 0, 10, dt);
    approach('bail', pose.bail, 10, dt);

    spinQ.setFromAxisAngle(UP, pose.spin);
    flipQ.identity();
    if (move === 'backflip' || move === 'frontflip') {
      axis.set(move === 'backflip' ? -1 : 1, 0, 0);
      flipQ.setFromAxisAngle(axis, Math.PI * 2 * flip.progress);
    }
    turnBody();

    tilt.rotation.x = now.roll;
    ride.root.rotation.set(now.table * 1.15, 0, 0);
    ride.root.position.set(0, now.table * 0.22, 0);
    let bars = -now.twist;
    if (move === 'barspin') {
      bars += Math.PI * 2 * flip.progress;
    }
    if (move === 'xup') {
      bars += Math.sin(Math.PI * flip.progress) * 2.5;
    }
    ride.steer.quaternion.setFromAxisAngle(ride.steerAxis, bars);
    ride.frame.quaternion.setFromAxisAngle(ride.steerAxis, move === 'tailwhip' ? Math.PI * 2 * flip.progress : 0);
    ride.wheels.forEach((wheel) => {
      wheel.rotation.z -= ((pose.speed || 0) * dt) / WHEEL;
    });

    // The back rounds over the bars, and the head lifts to look ahead.
    hips.position.set(now.hipX, now.hipY, 0);
    hips.rotation.set(0, 0, -now.lean * 0.72);
    waist.rotation.set(0, 0, -now.lean * 0.28);
    head.rotation.z = now.lean * 0.82;
    settleSpine();

    // Legs: feet on the pedals, unless a trick takes them off.
    legs.forEach((leg, i) => {
      const { side } = leg;
      leg.hip.set(0, -0.02, side * HIP).applyMatrix4(hips.matrix);
      footGoal.set(side * BIKE.pedal - 0.04, BIKE.crank[1] + 0.012 + ANKLE, side * FEET.bike);
      footGoal.applyEuler(ride.root.rotation).add(ride.root.position);
      if (grab === 'superman') {
        footGoal.set(-1.3, 1.02, side * 0.12);
      }
      if (grab === 'nofooter') {
        footGoal.set(0.08, 0.5, side * 0.62);
      }
      if (grab === 'cancan' && side > 0) {
        footGoal.set(0.12, 0.78, -0.42);
      }
      if (move === 'tailwhip') {
        footGoal.set(side * 0.06, 0.72, side * 0.17);
      }
      if (state === 'bail') {
        footGoal.set(0.3 + side * 0.2, 0.3, side * 0.3);
      }
      feetNow[i].lerp(footGoal, Math.min(1, dt * 16));
      pole.set(1, 0.4, side * 0.3);
      twoBone(leg.hip, feetNow[i], THIGH, SHIN, pole, leg.knee, leg.ankle);
      leg.turn.set(0, 0, grab === 'superman' ? -1.2 : 0);
    });

    // Arms: hands on the grips, unless a trick lets go.
    arms.forEach((arm, i) => {
      const { side } = arm;
      const goal = handGoal[i];
      arm.shoulder.set(0, 0.02, side * SHOULDER).applyMatrix4(chestMatrix);
      goal.set(BIKE.bar[0], BIKE.bar[1], side * BIKE.grip).sub(ride.pivot);
      goal.applyQuaternion(ride.steer.quaternion).add(ride.pivot);
      goal.applyEuler(ride.root.rotation).add(ride.root.position);
      // The wrist sits behind and above the bar, so the fist is around it.
      along.copy(arm.shoulder).sub(goal).normalize();
      goal.addScaledVector(along, 0.062);
      goal.y += 0.03;
      let holding = true;
      if (grab === 'nohander') {
        goal.set(-0.05, 1.6, side * 0.66);
        holding = false;
      }
      if (move === 'barspin') {
        goal.set(0.28, 1.25, side * 0.36);
        holding = false;
      }
      if (state === 'bail') {
        goal.set(0.4, 0.9, side * 0.45);
        holding = false;
      }
      hands[i].lerp(goal, Math.min(1, dt * 18));
      pole.set(-0.2, -1, side * 0.7);
      twoBone(arm.shoulder, hands[i], UPPER_ARM, FOREARM, pole, arm.elbow, arm.wrist);
      arm.close = holding ? 0.95 : 0.2;
      arm.grip = null;
      if (holding) {
        barAxis.set(0, 0, 1).applyQuaternion(ride.steer.quaternion).applyEuler(ride.root.rotation);
        arm.grip = barAxis.clone();
      }
    });
    driveBones(dt);
  }

  // pose: { state: ride | air | grind | bail, steer, spin, flip, grab,
  // side, land (0–1 squash), bail (0–1), speed, time }
  function update(dt, pose) {
    if (bike) {
      poseBike(dt, pose);
      return;
    }
    const { state } = pose;
    let hipY = 0.86 - Math.abs(pose.steer) * 0.04;
    let lean = 0.14;
    let lift = 0;
    let feet = 0;
    const grab = state === 'air' ? pose.grab : null;
    if (state === 'air') {
      hipY = 0.74;
      lean = 0.22;
    }
    if (state === 'grind') {
      hipY = 0.78;
      lean = 0.2;
    }
    if (grab) {
      hipY = 0.6;
      lean = 0.62;
      lift = 0.3;
    }
    hipY -= pose.land * 0.22;
    const flip = state === 'air' ? pose.flip : null;
    const skateFlip = flip && board === 'skate';
    if (skateFlip) {
      feet = Math.sin(Math.PI * flip.progress) * 0.3;
      hipY += feet * 0.2;
    }
    approach('hipY', hipY, 12, dt);
    approach('lean', lean - pose.steer * 0.12 * (state === 'ride' ? 1 : 0), 10, dt);
    approach('roll', state === 'ride' ? pose.steer * 0.12 : 0, 8, dt);
    approach('twist', pose.steer * 0.25, 6, dt);
    approach('lift', lift, 14, dt);
    approach('feet', feet, 30, dt);
    approach('side', pose.side ? 1 : 0, 12, dt);
    approach('bail', pose.bail, 10, dt);

    // Spins, and the whole-body flips of a snowboard.
    spinQ.setFromAxisAngle(UP, pose.spin + now.side * (Math.PI / 2));
    flipQ.identity();
    if (flip && snow) {
      const turn = Math.PI * 2 * flip.progress;
      const axes = {
        backflip: [0, 0, 1],
        frontflip: [0, 0, -1],
        wildcat: [-1, 0, 0],
        rodeo: [0.6, 0.55, 0.6],
        misty: [-0.6, 0.55, 0.6],
      };
      axis.fromArray(axes[flip.move]).normalize();
      flipQ.setFromAxisAngle(axis, turn);
    }
    turnBody();

    // The board: lifted for grabs, flipped under the feet for skate tricks,
    // tipped with the turn.
    boardHolder.position.set(0, now.lift, 0);
    boardSpin.rotation.set(0, 0, 0);
    boardHolder.rotation.set(0, 0, now.roll);
    if (skateFlip) {
      const turn = Math.PI * 2 * flip.progress;
      boardHolder.position.y += Math.sin(Math.PI * flip.progress) * 0.12;
      if (flip.move === 'kickflip') {
        boardSpin.rotation.z = turn;
      }
      if (flip.move === 'heelflip') {
        boardSpin.rotation.z = -turn;
      }
      if (flip.move === 'shove') {
        boardSpin.rotation.y = turn / 2;
      }
      if (flip.move === 'varial') {
        boardSpin.rotation.set(0, turn / 2, turn, 'YXZ');
      }
      if (flip.move === 'treflip') {
        boardSpin.rotation.set(0, turn, turn, 'YXZ');
      }
      if (flip.move === 'impossible') {
        boardSpin.rotation.x = turn;
      }
    }
    if (grab === 'method') {
      boardHolder.rotation.x = 0.5;
      boardHolder.position.x = -0.15;
    }
    if (grab === 'nose') {
      boardHolder.rotation.x = -0.35;
    }
    if (grab === 'tail') {
      boardHolder.rotation.x = 0.35;
    }

    // The body: most of the lean is at the hips, the rest in the back, and
    // the head stays level.
    hips.position.set(-0.03, now.hipY + now.lift * 0.4, 0);
    hips.rotation.set(0, now.twist * 0.5, -now.lean * 0.75);
    waist.rotation.set(0, now.twist * 0.5, -now.lean * 0.25);
    head.rotation.z = now.lean * 0.7;
    settleSpine();

    // Legs: feet on the board.
    legs.forEach((leg) => {
      leg.hip.set(0, -0.02, leg.side * HIP).applyMatrix4(hips.matrix);
      footGoal.set(-0.045, deckY + ANKLE + (snow ? 0.02 : 0) + now.feet, leg.side * feetZ);
      footGoal.applyEuler(boardHolder.rotation).add(boardHolder.position);
      pole.set(1, 0.1, leg.side * 0.35);
      twoBone(leg.hip, footGoal, THIGH, SHIN, pole, leg.knee, leg.ankle);
      leg.turn.copy(boardHolder.rotation);
    });

    // Arms: out for balance, up in the air, or grabbing the board.
    const swing = Math.sin(pose.time * 2.2) * 0.04;
    arms.forEach((arm, i) => {
      const { side } = arm;
      const goal = handGoal[i];
      arm.close = 0.22;
      arm.grip = null;
      if (state === 'air') {
        goal.set(0.15, 1.45, side * 0.62);
      } else if (state === 'grind') {
        goal.set(0.05, 1.18, side * 0.72);
      } else if (state === 'bail') {
        goal.set(0.4, 0.9, side * 0.45);
        arm.close = 0.05;
      } else {
        goal.set(0.12 - side * 0.05, 0.92 + swing * side, side * 0.5 + pose.steer * 0.1);
      }
      if (grab) {
        const boardY = now.lift + deckY + 0.07;
        const front = side > 0;
        const grabs = {
          indy: front ? null : [0.16, boardY, 0.02],
          melon: front ? [-0.16, boardY, 0.08] : null,
          method: front ? [-0.3, boardY + 0.15, 0.05] : null,
          nose: front ? [0, boardY + 0.05, 0.4] : null,
          tail: front ? null : [0, boardY + 0.05, -0.4],
        };
        const reach = grabs[grab];
        if (reach) {
          goal.fromArray(reach);
          arm.close = 0.85;
        } else {
          goal.set(0.1, 1.35, side * 0.7);
        }
      }
      hands[i].lerp(goal, Math.min(1, dt * 14));
      arm.shoulder.set(0, 0.02, side * SHOULDER).applyMatrix4(chestMatrix);
      pole.set(-0.35, -1, side * 0.6);
      twoBone(arm.shoulder, hands[i], UPPER_ARM, FOREARM, pole, arm.elbow, arm.wrist);
    });
    driveBones(dt);
  }

  // A point on the board (meters along it) in world space, for sparks and spray.
  const boardPoint = new THREE.Vector3();
  function boardWorld(z, y = 0) {
    if (bike) {
      boardPoint.set(z, y, 0);
      ride.root.updateWorldMatrix(true, false);
      return boardPoint.applyMatrix4(ride.root.matrixWorld);
    }
    boardPoint.set(0, y, z);
    boardSpin.updateWorldMatrix(true, false);
    return boardPoint.applyMatrix4(boardSpin.matrixWorld);
  }

  update(0, { state: 'ride', steer: 0, spin: 0, flip: null, grab: null, side: false, land: 0, bail: 0, time: 0 });
  // Start with the pose already settled, not easing in from the rest pose.
  arms.forEach((arm, i) => {
    hands[i].copy(handGoal[i]);
    arm.curl = arm.close;
  });
  update(0, { state: 'ride', steer: 0, spin: 0, flip: null, grab: null, side: false, land: 0, bail: 0, time: 0 });

  return {
    group,
    update,
    boardWorld,
    length: { skate: 0.82, snow: 1.45, bike: 1.2 }[board],
    dispose() {
      fitting.delete(dress);
      group.traverse((object) => {
        object.geometry?.dispose();
        [object.material].flat().forEach((material) => material?.dispose());
      });
      skeleton.dispose();
      owned.forEach((texture) => texture.dispose());
    },
  };
}
