// The 3D world: sky, road, scenery and the points to collect, for each of
// the three scenarios. Everything is built in code (no image files), so it
// works offline and loads fast, then finished with shadows, glow (bloom)
// and sky reflections for a console-game look.

import * as THREE from '../../vendor/three/three.min.js';
import { CIRCUITS, ROAD_WIDTH, sampleTrack, sideMeters, snowiness } from './world.js';
import {
  beamTexture,
  checkerTexture,
  facadeTextures,
  fernTexture,
  frondTexture,
  groundDetail,
  random,
  roadTextures,
  softDotTexture,
  strataTexture,
  stripesTexture,
} from './textures.js';
import { createEffects } from './effects.js';

const HALF = ROAD_WIDTH / 2;

// Phones get smaller shadow maps, less smoothing and a lower top resolution;
// the resolution also adapts to keep the game smooth (see adapt()).
function pickQuality() {
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (small || touch) {
    return { name: 'low', maxRatio: Math.min(window.devicePixelRatio, 2), minRatio: 0.75, msaa: 2, shadowSize: 1024, sceneryShadows: false };
  }
  return { name: 'high', maxRatio: Math.min(window.devicePixelRatio, 2), minRatio: 1, msaa: 4, shadowSize: 2048, sceneryShadows: true };
}

// Sky, light and air for each place. The wasteland blends from `snow` to
// `desert` as the car drives on. Elevations are in degrees.
const LOOKS = {
  city: {
    top: '#0b0926', horizon: '#7a3672', bottom: '#1b1226', fog: '#2c1a3c', fogDensity: 0.0026,
    sunElevation: 3, sunAzimuth: 200, sunColor: '#ff9a5a', sunSize: 0.03, lightElevation: 55,
    sunPower: 1.1, hemiSky: '#7d6cff', hemiGround: '#2a1a36', hemiPower: 0.9,
    stars: 1, clouds: 0.15, bloom: 0.7, threshold: 0.9, exposure: 1.05,
  },
  jungle: {
    top: '#1559c4', horizon: '#9fd3ec', bottom: '#4d6e3c', fog: '#9ccbc0', fogDensity: 0.0026,
    sunElevation: 42, sunAzimuth: 130, sunColor: '#fff2d6', sunSize: 0.025, lightElevation: 42,
    sunPower: 3.2, hemiSky: '#c2e4ff', hemiGround: '#3a5a22', hemiPower: 1.25,
    stars: 0, clouds: 0.42, bloom: 0.35, threshold: 0.95, exposure: 1,
  },
  snow: {
    top: '#7a889d', horizon: '#d5dae1', bottom: '#c6ccd6', fog: '#c9cfd8', fogDensity: 0.0068,
    sunElevation: 22, sunAzimuth: 160, sunColor: '#eaf0ff', sunSize: 0.03, lightElevation: 40,
    sunPower: 1.4, hemiSky: '#e2e8f3', hemiGround: '#9aa3b2', hemiPower: 1.7,
    stars: 0, clouds: 1, bloom: 0.3, threshold: 1, exposure: 1,
  },
  desert: {
    top: '#3a7bc4', horizon: '#f0c590', bottom: '#c08648', fog: '#e6bf8e', fogDensity: 0.0026,
    sunElevation: 20, sunAzimuth: 230, sunColor: '#ffd8a2', sunSize: 0.03, lightElevation: 35,
    sunPower: 3, hemiSky: '#ffe2bd', hemiGround: '#a8703a', hemiPower: 1.1,
    stars: 0, clouds: 0.3, bloom: 0.4, threshold: 0.95, exposure: 1,
  },
};

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function direction(elevation, azimuth) {
  const up = THREE.MathUtils.degToRad(elevation);
  const around = THREE.MathUtils.degToRad(azimuth);
  return new THREE.Vector3(Math.cos(up) * Math.sin(around), Math.sin(up), Math.cos(up) * Math.cos(around));
}

/* ---------- Sky ---------- */

const SKY_VERTEX = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_Position.z = gl_Position.w;
  }
`;

// A gradient with a glowing sun, soft clouds and (at night) stars. The sun
// is brighter than white, so it blooms.
const SKY_FRAGMENT = `
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 bottom;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform float sunSize;
  uniform float stars;
  uniform float clouds;
  uniform float time;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += noise(p) * amplitude;
      p *= 2.1;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 color = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.75, h), 0.65)) : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
    float facing = max(dot(dir, sunDir), 0.0);
    // A warm haze around the sun, wide near the horizon.
    color += sunColor * (pow(facing, 6.0) * 0.45 + pow(facing, 60.0) * 0.8) * (1.0 - smoothstep(0.0, 0.6, h) * 0.4);
    float disc = smoothstep(cos(sunSize), cos(sunSize * 0.7), facing);
    color += sunColor * disc * 12.0;
    if (h > 0.0) {
      vec2 uv = dir.xz / (h + 0.18) * 1.6 + vec2(time * 0.004, 0.0);
      float shape = fbm(uv);
      float cover = smoothstep(0.55 - clouds * 0.35, 0.85, shape) * clouds * smoothstep(0.0, 0.25, h);
      vec3 cloudColor = mix(horizon * 1.05 + 0.05, vec3(1.0), 0.5) + sunColor * pow(facing, 4.0) * 0.4;
      color = mix(color, cloudColor, cover * 0.85);
      vec2 cell = floor(dir.xz / (h + 0.05) * 140.0);
      float star = step(0.9975, hash(cell)) * stars * smoothstep(0.1, 0.5, h) * (1.0 - cover);
      color += vec3(star * 2.0);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ---------- Geometry helpers ---------- */

// A strip that follows the road. Each edge is { side, up }: meters to the
// left of the middle, and meters above the road.
function ribbon(samples, length, first, second, metersPerTile = 16) {
  const count = samples.length;
  const positions = [];
  const uvs = [];
  const indices = [];
  // Flat strips face up whichever edge comes first.
  const flip = second.side < first.side;
  for (let i = 0; i <= count; i += 1) {
    const sample = samples[i % count];
    let distance = sample.s;
    if (i === count) {
      distance = length;
    }
    [first, second].forEach((edge, column) => {
      positions.push(sample.x + sample.nx * edge.side, sample.y + edge.up, sample.z + sample.nz * edge.side);
      uvs.push(column, distance / metersPerTile);
    });
    if (i < count && flip) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    if (i < count && !flip) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Many shapes merged into one mesh with per-piece colors: one draw call for
// a whole city block or forest. `shade` darkens undersides a little, a
// cheap stand-in for ambient occlusion.
class Batch {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = [];
    this.indices = [];
  }

  add(geometry, matrix, color, { uv = null, shade = false } = {}) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uvs = geometry.attributes.uv;
    const offset = this.positions.length / 3;
    const vector = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const tint = new THREE.Color(color);
    for (let i = 0; i < position.count; i += 1) {
      vector.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.positions.push(vector.x, vector.y, vector.z);
      vector.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      this.normals.push(vector.x, vector.y, vector.z);
      let light = 1;
      if (shade) {
        light = 0.62 + 0.38 * (vector.y * 0.5 + 0.5);
      }
      this.colors.push(tint.r * light, tint.g * light, tint.b * light);
      if (uvs && uv) {
        const mapped = uv(i, uvs.getX(i), uvs.getY(i));
        this.uvs.push(mapped[0], mapped[1]);
      } else if (uvs) {
        this.uvs.push(uvs.getX(i), uvs.getY(i));
      } else {
        this.uvs.push(0, 0);
      }
    }
    if (geometry.index) {
      for (let i = 0; i < geometry.index.count; i += 1) {
        this.indices.push(geometry.index.getX(i) + offset);
      }
    } else {
      for (let i = 0; i < position.count; i += 1) {
        this.indices.push(i + offset);
      }
    }
  }

  get empty() {
    return this.positions.length === 0;
  }

  mesh(material, { cast = false, receive = true } = {}) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
UNIT_BOX.translate(0, 0.5, 0);

function place(x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, tiltX = 0, tiltZ = 0) {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, tiltZ, 'YXZ')),
    new THREE.Vector3(sx, sy, sz),
  );
  return matrix;
}

// Box UVs in meters for a facade texture of 8 × 8 windows every `tile`
// meters; roofs and floors use the plain corner. `shift` picks a different
// part of the texture, so neighbors don't look alike.
function facadeUv(width, height, depth, tile, shift) {
  return (i, u, v) => {
    const face = Math.floor(i / 4);
    if (face === 2 || face === 3) {
      return [0.004, 0.004];
    }
    let across = width;
    if (face === 0 || face === 1) {
      across = depth;
    }
    return [shift + (u * across) / tile, (v * height) / tile];
  };
}

// Lumpy, smooth leaf clumps (a few shapes, reused). Phones get fewer
// triangles per clump.
function leafClumps(detail) {
  return [0, 1.7, 3.9].map((seed) => {
    const geometry = new THREE.IcosahedronGeometry(1, detail);
    const position = geometry.attributes.position;
    const vector = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      vector.fromBufferAttribute(position, i);
      // The bump depends only on the position, so the copies of a corner
      // shared by several faces move together and weld back into one.
      const bump = 0.86 + 0.16 * Math.sin(vector.x * 3.1 + seed) * Math.cos(vector.z * 2.7 + seed) + 0.08 * Math.sin(vector.y * 5 + seed * 2);
      vector.multiplyScalar(bump);
      position.setXYZ(i, vector.x, vector.y * 0.85, vector.z);
    }
    geometry.deleteAttribute('normal');
    const merged = mergeVertices(geometry);
    merged.computeVertexNormals();
    return merged;
  });
}

// Icosahedron vertices come split per face; welding them makes the
// computed normals smooth.
function mergeVertices(geometry) {
  const position = geometry.attributes.position;
  const map = new Map();
  const positions = [];
  const indices = [];
  for (let i = 0; i < position.count; i += 1) {
    const key = `${position.getX(i).toFixed(3)},${position.getY(i).toFixed(3)},${position.getZ(i).toFixed(3)}`;
    let index = map.get(key);
    if (index === undefined) {
      index = positions.length / 3;
      map.set(key, index);
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
    }
    indices.push(index);
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  return merged;
}

// Two crossed cards: grass clumps seen from any side.
function crossedCards(width, height) {
  const first = new THREE.PlaneGeometry(width, height);
  first.translate(0, height / 2, 0);
  const second = first.clone();
  second.rotateY(Math.PI / 2);
  const positions = [...first.attributes.position.array, ...second.attributes.position.array];
  const normals = [...first.attributes.normal.array, ...second.attributes.normal.array];
  const uvs = [...first.attributes.uv.array, ...second.attributes.uv.array];
  const indices = [...first.index.array, ...second.index.array.map((index) => index + 4)];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

// A palm frond: a long card that arches over and droops.
function frondGeometry() {
  const geometry = new THREE.PlaneGeometry(1.6, 6, 1, 8);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const along = (position.getY(i) + 3) / 6;
    position.setXYZ(i, position.getX(i), Math.sin(along * Math.PI * 0.75) * 2.2 - along * along * 1.2, along * 5.5);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* ---------- Where scenery can go ---------- */

// Answers "how far is the road?" quickly, for tracks of any length: road
// points are sorted into a grid of square cells, and only nearby cells are
// searched.
const CELL = 40;

class Clearance {
  constructor(samples) {
    this.cells = new Map();
    // Every few meters is enough to know if a spot is on the road.
    samples.forEach((sample, i) => {
      if (i % 3 !== 0) {
        return;
      }
      const key = this.key(Math.floor(sample.x / CELL), Math.floor(sample.z / CELL));
      if (!this.cells.has(key)) {
        this.cells.set(key, []);
      }
      this.cells.get(key).push(sample);
    });
    this.fallback = samples[0];
  }

  key(cx, cz) {
    return `${cx},${cz}`;
  }

  // Nearest road point to (x, z): { sample, distance }. Searches rings of
  // cells outward until nothing closer can be found.
  nearest(x, z) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = null;
    let bestDistance = Infinity;
    for (let ring = 0; ring < 400; ring += 1) {
      if (best && (ring - 1) * CELL > Math.sqrt(bestDistance)) {
        break;
      }
      for (let dx = -ring; dx <= ring; dx += 1) {
        for (let dz = -ring; dz <= ring; dz += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) {
            continue;
          }
          const cell = this.cells.get(this.key(cx + dx, cz + dz));
          if (!cell) {
            continue;
          }
          cell.forEach((sample) => {
            const distance = (sample.x - x) ** 2 + (sample.z - z) ** 2;
            if (distance < bestDistance) {
              best = sample;
              bestDistance = distance;
            }
          });
        }
      }
    }
    if (!best) {
      return { sample: this.fallback, distance: Infinity };
    }
    return { sample: best, distance: Math.sqrt(bestDistance) };
  }

  isClear(x, z, radius) {
    return this.nearest(x, z).distance > HALF + 3 + radius;
  }
}

// Spots on both sides of the road, every `step` meters, `from`–`to`
// meters beyond the edge. Spots that would sit on another part of the
// road are skipped.
function roadsideSpots(samples, clearance, rand, { step, from, to, radius, sides = [1, -1] }) {
  const spots = [];
  // Very long built tracks get their scenery spread out, so they stay quick.
  const spread = Math.max(1, samples[samples.length - 1].s / 2600);
  const stride = Math.max(1, Math.round((step * spread) / 2));
  for (let i = 0; i < samples.length; i += stride) {
    sides.forEach((side) => {
      const sample = samples[(i + Math.floor(rand() * stride)) % samples.length];
      const away = HALF + from + rand() * (to - from) + radius;
      const x = sample.x + sample.nx * side * away;
      const z = sample.z + sample.nz * side * away;
      if (clearance.isClear(x, z, radius)) {
        spots.push({ x, z, sample, side, yaw: Math.atan2(sample.dx, sample.dz) });
      }
    });
  }
  return spots;
}

// Bright colors for glowing things: above 1, so they bloom.
function glowColor(hex, strength) {
  return new THREE.Color(hex).multiplyScalar(strength);
}

/* ---------- Scenery for each scenario ---------- */

function buildCity(group, samples, clearance, groundY, quality, dot) {
  const rand = random(101);
  const facade = facadeTextures('city');
  const buildings = new Batch();
  const roofs = new Batch();
  const neon = new Batch();
  const tints = ['#c9c4e8', '#b8c4ea', '#d8c6d8', '#c2b8dc', '#aebde0', '#d4d0e6'];
  const neonColors = ['#ff3fa4', '#35f2ff', '#a45bff', '#ffd23f', '#39ff88'];
  const addBuilding = (spot, width, depth, height, withSign) => {
    const y = groundY(spot.x, spot.z) - 0.5;
    const shift = Math.floor(rand() * 8) / 8;
    buildings.add(UNIT_BOX, place(spot.x, y, spot.z, spot.yaw, width, height, depth), tints[Math.floor(rand() * tints.length)], { uv: facadeUv(width, height, depth, 24, shift) });
    // Rooftop machinery and the odd antenna with a red light.
    for (let i = 0; i < 3; i += 1) {
      roofs.add(UNIT_BOX, place(spot.x + (rand() - 0.5) * width * 0.6, y + height, spot.z + (rand() - 0.5) * depth * 0.6, spot.yaw, 2 + rand() * 3, 1 + rand() * 2, 2 + rand() * 3), '#4a4858', { shade: true });
    }
    if (rand() < 0.3) {
      roofs.add(UNIT_BOX, place(spot.x, y + height, spot.z, spot.yaw, 0.3, 8 + rand() * 8, 0.3), '#3a3846');
    }
    if (!withSign || rand() < 0.4) {
      return;
    }
    // A glowing sign on the side that faces the road.
    const front = width / 2 + 0.25;
    const signHeight = 2 + rand() * 4;
    neon.add(UNIT_BOX, place(
      spot.x - spot.sample.nx * spot.side * front,
      y + 5 + rand() * Math.max(1, height - signHeight - 8),
      spot.z - spot.sample.nz * spot.side * front,
      spot.yaw, 0.4, signHeight, Math.min(depth - 2, 6 + rand() * 6),
    ), glowColor(neonColors[Math.floor(rand() * neonColors.length)], 3));
  };
  roadsideSpots(samples, clearance, rand, { step: 26, from: 6, to: 14, radius: 12 }).forEach((spot) => {
    addBuilding(spot, 14 + rand() * 12, 14 + rand() * 14, 18 + rand() * 50, true);
  });
  roadsideSpots(samples, clearance, rand, { step: 34, from: 40, to: 80, radius: 16 }).forEach((spot) => {
    addBuilding(spot, 18 + rand() * 14, 18 + rand() * 14, 50 + rand() * 80, false);
  });
  group.add(buildings.mesh(new THREE.MeshStandardMaterial({
    map: facade.map,
    emissiveMap: facade.emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 1,
    roughness: 0.55,
    metalness: 0.1,
    vertexColors: true,
  }), { cast: quality.sceneryShadows }));
  group.add(roofs.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), { cast: quality.sceneryShadows }));
  group.add(neon.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));

  // Street lights, each with a warm pool of light on the road.
  const poles = new Batch();
  const bulbs = new Batch();
  const pools = new Batch();
  const poolShape = new THREE.PlaneGeometry(1, 1);
  poolShape.rotateX(-Math.PI / 2);
  roadsideSpots(samples, clearance, rand, { step: 34, from: 1.6, to: 1.6, radius: 0.3 }).forEach((spot) => {
    const y = spot.sample.y;
    poles.add(UNIT_BOX, place(spot.x, y, spot.z, spot.yaw, 0.3, 9, 0.3), '#2e2d3a');
    const armX = spot.x - spot.sample.nx * spot.side * 1.6;
    const armZ = spot.z - spot.sample.nz * spot.side * 1.6;
    poles.add(UNIT_BOX, place((spot.x + armX) / 2, y + 8.8, (spot.z + armZ) / 2, spot.yaw + Math.PI / 2, 0.2, 0.2, 3.2), '#2e2d3a');
    bulbs.add(UNIT_BOX, place(armX, y + 8.5, armZ, spot.yaw, 0.9, 0.2, 0.5), glowColor('#ffe2a8', 6));
    const poolX = spot.sample.x + spot.sample.nx * spot.side * (HALF - 3.5);
    const poolZ = spot.sample.z + spot.sample.nz * spot.side * (HALF - 3.5);
    pools.add(poolShape, place(poolX, y + 0.12, poolZ, spot.yaw, 13, 1, 13), '#ffcf8a');
  });
  group.add(poles.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 })));
  group.add(bulbs.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));
  const poolMesh = pools.mesh(new THREE.MeshBasicMaterial({
    map: dot, vertexColors: true, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  poolMesh.renderOrder = 1;
  group.add(poolMesh);
}

function buildJungle(group, samples, clearance, groundY, quality) {
  const rand = random(202);
  let detail = 2;
  if (quality.name === 'low') {
    detail = 1;
  }
  const clumps = leafClumps(detail);
  const trees = new Batch();
  const fronds = new Batch();
  const ferns = new Batch();
  const trunk = new THREE.CylinderGeometry(0.3, 0.55, 1, 10, 4);
  trunk.translate(0, 0.5, 0);
  const palmTrunk = new THREE.CylinderGeometry(0.22, 0.38, 1, 10, 6);
  palmTrunk.translate(0, 0.5, 0);
  const frond = frondGeometry();
  const card = crossedCards(2.6, 1.6);
  const greens = ['#2f8f2f', '#3fa53a', '#2a7a2c', '#4cb043', '#226b28', '#5aa83a'];

  const addTree = (x, y, z, scale) => {
    const height = (6 + rand() * 6) * scale;
    trees.add(trunk, place(x, y, z, rand() * 6, scale, height, scale, (rand() - 0.5) * 0.1), '#5b3b22', { shade: true });
    const blobs = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < blobs; i += 1) {
      const size = (2.4 + rand() * 2.2) * scale;
      trees.add(clumps[Math.floor(rand() * clumps.length)], place(
        x + (rand() - 0.5) * 3 * scale,
        y + height - 0.5 + rand() * 2.4 * scale,
        z + (rand() - 0.5) * 3 * scale,
        rand() * 6, size, size * 0.85, size,
      ), greens[Math.floor(rand() * greens.length)], { shade: true });
    }
  };
  const addPalm = (x, y, z, scale) => {
    const height = (8 + rand() * 5) * scale;
    const lean = (rand() - 0.5) * 0.4;
    const yaw = rand() * Math.PI * 2;
    trees.add(palmTrunk, place(x, y, z, yaw, scale, height, scale, lean), '#7a5a36', { shade: true });
    const topX = x + Math.sin(yaw) * Math.sin(lean) * height;
    const topZ = z + Math.cos(yaw) * Math.sin(lean) * height;
    const topY = y + height * Math.cos(lean);
    for (let i = 0; i < 8; i += 1) {
      fronds.add(frond, place(topX, topY, topZ, (i / 8) * Math.PI * 2 + rand() * 0.3, scale, scale, scale, -0.1 + rand() * 0.2), i % 2 ? '#ffffff' : '#d8f0c8');
    }
  };

  roadsideSpots(samples, clearance, rand, { step: 9, from: 2, to: 30, radius: 3 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z) - 0.2;
    if (rand() < 0.4) {
      addPalm(spot.x, y, spot.z, 0.8 + rand() * 0.5);
    } else {
      addTree(spot.x, y, spot.z, 0.8 + rand() * 0.6);
    }
  });
  roadsideSpots(samples, clearance, rand, { step: 18, from: 32, to: 110, radius: 4 }).forEach((spot) => {
    addTree(spot.x, groundY(spot.x, spot.z) - 0.2, spot.z, 1.2 + rand() * 0.8);
  });
  // Ferns and grass right along the roadside, and mossy rocks.
  const rock = new THREE.DodecahedronGeometry(1, 1);
  roadsideSpots(samples, clearance, rand, { step: 4, from: 0.4, to: 6, radius: 0.8 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z) - 0.05;
    const size = 0.7 + rand() * 0.9;
    if (rand() < 0.12) {
      trees.add(rock, place(spot.x, y - 0.3, spot.z, rand() * 6, size * 1.4, size, size * 1.2), '#7d8572', { shade: true });
      return;
    }
    ferns.add(card, place(spot.x, y, spot.z, rand() * 6, size, size, size), rand() < 0.5 ? '#ffffff' : '#cfe8b0');
  });
  const leafy = { roughness: 0.85, vertexColors: true };
  group.add(trees.mesh(new THREE.MeshStandardMaterial(leafy), { cast: true }));
  group.add(fronds.mesh(new THREE.MeshStandardMaterial({ ...leafy, map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide }), { cast: quality.sceneryShadows }));
  group.add(ferns.mesh(new THREE.MeshStandardMaterial({ ...leafy, map: fernTexture(), alphaTest: 0.4, side: THREE.DoubleSide })));

  // Ancient stone: gateways over the road and stepped temples in the trees.
  const stone = new Batch();
  const moss = new Batch();
  [0.2, 0.55, 0.82].forEach((t) => {
    const sample = samples[Math.floor(t * samples.length)];
    const yaw = Math.atan2(sample.dx, sample.dz);
    [-1, 1].forEach((side) => {
      const x = sample.x + sample.nx * side * (HALF + 2.2);
      const z = sample.z + sample.nz * side * (HALF + 2.2);
      stone.add(UNIT_BOX, place(x, sample.y - 1, z, yaw, 2.4, 12, 2.4), '#a59f88', { shade: true });
      stone.add(UNIT_BOX, place(x, sample.y + 11, z, yaw, 3, 1.2, 3), '#958f78', { shade: true });
    });
    stone.add(UNIT_BOX, place(sample.x, sample.y + 11.4, sample.z, yaw + Math.PI / 2, 2.2, 2, ROAD_WIDTH + 8), '#aea891', { shade: true });
    moss.add(UNIT_BOX, place(sample.x, sample.y + 13.3, sample.z, yaw + Math.PI / 2, 2.3, 0.25, ROAD_WIDTH + 7), '#4f8d3a');
  });
  roadsideSpots(samples, clearance, rand, { step: 260, from: 45, to: 70, radius: 26 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z) - 1;
    for (let level = 0; level < 6; level += 1) {
      const size = 36 - level * 5.5;
      stone.add(UNIT_BOX, place(spot.x, y + level * 4, spot.z, spot.yaw, size, 4, size), level % 2 ? '#a39c84' : '#948d76', { shade: true });
      moss.add(UNIT_BOX, place(spot.x, y + level * 4 + 4, spot.z, spot.yaw, size - 1, 0.3, size - 1), '#4a8a36');
    }
    stone.add(UNIT_BOX, place(spot.x, y + 24, spot.z, spot.yaw, 6, 6, 6), '#857e68', { shade: true });
  });
  group.add(stone.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { cast: true }));
  group.add(moss.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
}

function buildWasteland(group, samples, clearance, groundY, quality) {
  const rand = random(303);
  const ruinFacade = facadeTextures('ruin');
  const walls = new Batch();
  const plain = new Batch();
  const rocks = new Batch();
  const dune = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);

  const addRuin = (x, y, z, yaw, snowy) => {
    const tint = snowy ? ['#9aa0aa', '#b0b4bc', '#8c919a'] : ['#e0c4a4', '#d0b090', '#e8cfb0'];
    let width = 12 + rand() * 14;
    let depth = 12 + rand() * 12;
    let height = 10 + rand() * 30;
    let base = y - 0.5;
    const floors = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < floors; i += 1) {
      const shift = Math.floor(rand() * 8) / 8;
      walls.add(UNIT_BOX, place(x + (rand() - 0.5) * 3, base, z + (rand() - 0.5) * 3, yaw, width, height, depth, 0, (rand() - 0.5) * 0.06), tint[i % tint.length], { uv: facadeUv(width, height, depth, 22, shift) });
      if (snowy) {
        plain.add(UNIT_BOX, place(x, base + height, z, yaw, width * 0.94, 0.7, depth * 0.94), '#f4f7fb', { shade: true });
      }
      base += height;
      width *= 0.5 + rand() * 0.3;
      depth *= 0.5 + rand() * 0.3;
      height *= 0.4 + rand() * 0.4;
    }
  };
  const addWreck = (x, y, z, yaw) => {
    const rust = ['#7a3f22', '#5e4a3a', '#8c5a2e', '#4a5560'][Math.floor(rand() * 4)];
    const tilt = (rand() - 0.5) * 0.5;
    plain.add(UNIT_BOX, place(x, y, z, yaw, 2, 1, 4.4, 0, tilt), rust, { shade: true });
    plain.add(UNIT_BOX, place(x, y + 0.9, z - 0.3, yaw, 1.7, 0.7, 2.2, 0, tilt), '#2b2b30', { shade: true });
  };

  roadsideSpots(samples, clearance, rand, { step: 22, from: 5, to: 40, radius: 12 }).forEach((spot) => {
    const snowy = snowiness(spot.sample.t) > 0.5;
    const y = groundY(spot.x, spot.z);
    if (snowy) {
      addRuin(spot.x, y, spot.z, spot.yaw + (rand() - 0.5) * 0.3, true);
      return;
    }
    if (rand() < 0.3) {
      addRuin(spot.x, y, spot.z, spot.yaw, false);
      return;
    }
    const size = 10 + rand() * 18;
    plain.add(dune, place(spot.x, y - 1, spot.z, rand() * 6, size * 1.6, size * 0.35, size), '#e0ad6a');
  });
  const mesa = new THREE.CylinderGeometry(0.8, 1, 1, 14, 1);
  mesa.translate(0, 0.5, 0);
  roadsideSpots(samples, clearance, rand, { step: 120, from: 80, to: 160, radius: 30 }).forEach((spot) => {
    if (snowiness(spot.sample.t) > 0.5) {
      return;
    }
    const size = 20 + rand() * 25;
    const height = 25 + rand() * 40;
    rocks.add(mesa, place(spot.x, groundY(spot.x, spot.z) - 2, spot.z, rand() * 6, size, height, size), '#ffffff', { uv: (i, u, v) => [u * 4, v * height / 40] });
  });
  roadsideSpots(samples, clearance, rand, { step: 30, from: 0.8, to: 4, radius: 2.5 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z);
    if (rand() < 0.6) {
      addWreck(spot.x, y, spot.z, spot.yaw + (rand() - 0.5) * 1.5);
      return;
    }
    // A bent lamp post.
    plain.add(UNIT_BOX, place(spot.x, y, spot.z, spot.yaw, 0.3, 8, 0.3, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6), '#4a4744', { shade: true });
  });
  group.add(walls.mesh(new THREE.MeshStandardMaterial({ map: ruinFacade.map, vertexColors: true, roughness: 0.95 }), { cast: quality.sceneryShadows }));
  group.add(plain.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { cast: quality.sceneryShadows }));
  group.add(rocks.mesh(new THREE.MeshStandardMaterial({ map: strataTexture(), vertexColors: true, roughness: 1 })));
}

/* ---------- Points ---------- */

function gearGeometry() {
  const shape = new THREE.Shape();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i += 1) {
    const angle = (i / (teeth * 2)) * Math.PI * 2;
    const next = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? 1.25 : 0.95;
    if (i === 0) {
      shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    } else {
      shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    shape.lineTo(Math.cos(next) * radius, Math.sin(next) * radius);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.4, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 16 });
  geometry.translate(0, 0, -0.175);
  return geometry;
}

// Gold coins in the city, emeralds in the jungle, glowing gears in the
// wasteland. They reflect the sky and glow a little, so they bloom.
function pointLook(scenario) {
  if (scenario === 'jungle') {
    const geometry = new THREE.OctahedronGeometry(1.1, 0);
    geometry.scale(0.9, 1.5, 0.9);
    return {
      geometry,
      material: new THREE.MeshPhysicalMaterial({ color: 0x19e07a, emissive: 0x0bbf62, emissiveIntensity: 1.4, metalness: 0.1, roughness: 0.05, clearcoat: 1, flatShading: true }),
      glow: '#5dff9e',
    };
  }
  if (scenario === 'wasteland') {
    return {
      geometry: gearGeometry(),
      material: new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff5a00, emissiveIntensity: 1.3, metalness: 0.85, roughness: 0.28 }),
      glow: '#ffa040',
    };
  }
  const coin = new THREE.CylinderGeometry(1.15, 1.15, 0.24, 48);
  coin.rotateX(Math.PI / 2);
  return {
    geometry: coin,
    material: new THREE.MeshStandardMaterial({ color: 0xffcf3a, emissive: 0xffa800, emissiveIntensity: 0.9, metalness: 1, roughness: 0.18 }),
    glow: '#ffe066',
  };
}

/* ---------- The whole scene ---------- */

export function createScene(container) {
  const quality = pickQuality();
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  let pixelRatio = quality.maxRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2500);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
  scene.add(hemisphere);

  // The sun casts shadows in a box that follows the car.
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  let lightDirection = new THREE.Vector3(0.3, 1, 0.2).normalize();

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      sunSize: { value: 0.03 },
      stars: { value: 0 },
      clouds: { value: 0 },
      time: { value: 0 },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.FogExp2(0xffffff, 0.003);

  // Reflections on cars and coins come from the sky itself.
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environment = null;
  function updateEnvironment() {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial);
    envScene.add(envSky);
    if (scenarioName === 'city') {
      // A few neon blocks, so car paint picks up city colors.
      ['#ff3fa4', '#35f2ff', '#a45bff', '#ffd23f'].forEach((color, i) => {
        const block = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 2), new THREE.MeshBasicMaterial({ color: glowColor(color, 2.5) }));
        const angle = (i / 4) * Math.PI * 2;
        block.position.set(Math.sin(angle) * 40, 6, Math.cos(angle) * 40);
        block.lookAt(0, 6, 0);
        envScene.add(block);
      });
    }
    const next = pmrem.fromScene(envScene, 0, 0.1, 200).texture;
    if (environment) {
      environment.dispose();
    }
    environment = next;
    scene.environment = environment;
    envSky.geometry.dispose();
  }

  // Post-processing: smooth edges (multisampling), then glow (bloom) on
  // anything brighter than white, then tone mapping.
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.msaa });
  const composer = new THREE.EffectComposer(renderer, target);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.4, 0.9);
  composer.addPass(bloom);
  composer.addPass(new THREE.OutputPass());
  composer.setPixelRatio(pixelRatio);

  // Snow for the wasteland: soft flakes in a box that follows the camera.
  const dot = softDotTexture();
  const flakeCount = 2400;
  const flakePositions = new Float32Array(flakeCount * 3);
  const flakeRand = random(9);
  for (let i = 0; i < flakeCount; i += 1) {
    flakePositions[i * 3] = (flakeRand() - 0.5) * 120;
    flakePositions[i * 3 + 1] = flakeRand() * 50;
    flakePositions[i * 3 + 2] = (flakeRand() - 0.5) * 120;
  }
  const flakeGeometry = new THREE.BufferGeometry();
  flakeGeometry.setAttribute('position', new THREE.BufferAttribute(flakePositions, 3));
  const flakeMaterial = new THREE.PointsMaterial({ color: 0xffffff, map: dot, size: 0.45, transparent: true, opacity: 0, depthWrite: false });
  const flakes = new THREE.Points(flakeGeometry, flakeMaterial);
  flakes.frustumCulled = false;
  scene.add(flakes);

  const effects = createEffects(scene, dot);
  const beamMap = beamTexture();

  let world = null;
  let track = null;
  let scenarioName = 'city';
  let points = [];
  let pointGlow = '#ffffff';
  let width = 1;
  let height = 1;

  function disposeWorld() {
    if (!world) {
      return;
    }
    scene.remove(world);
    world.traverse((object) => {
      if (object.geometry && object.geometry !== UNIT_BOX) {
        object.geometry.dispose();
      }
      if (object.material) {
        [object.material].flat().forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value && value.isTexture && value !== dot && value !== beamMap) {
              value.dispose();
            }
          });
          material.dispose();
        });
      }
    });
    world = null;
    points = [];
  }

  function applyLook(look) {
    const uniforms = skyMaterial.uniforms;
    uniforms.top.value.set(look.top);
    uniforms.horizon.value.set(look.horizon);
    uniforms.bottom.value.set(look.bottom);
    uniforms.sunDir.value.copy(direction(look.sunElevation, look.sunAzimuth));
    uniforms.sunColor.value.set(look.sunColor);
    uniforms.sunSize.value = look.sunSize;
    uniforms.stars.value = look.stars;
    uniforms.clouds.value = look.clouds;
    scene.fog.color.set(look.fog);
    scene.fog.density = look.fogDensity;
    lightDirection = direction(look.lightElevation, look.sunAzimuth);
    sun.color.set(look.sunColor);
    sun.intensity = look.sunPower;
    hemisphere.color.set(look.hemiSky);
    hemisphere.groundColor.set(look.hemiGround);
    hemisphere.intensity = look.hemiPower;
    bloom.strength = look.bloom;
    bloom.threshold = look.threshold;
    renderer.toneMappingExposure = look.exposure;
  }

  function blendLooks(first, second, amount) {
    const blended = {};
    Object.keys(first).forEach((key) => {
      if (typeof first[key] === 'number') {
        blended[key] = first[key] + (second[key] - first[key]) * amount;
        return;
      }
      blended[key] = `#${new THREE.Color(first[key]).lerp(new THREE.Color(second[key]), amount).getHexString()}`;
    });
    return blended;
  }

  function sharpen(object) {
    object.traverse((child) => {
      if (!child.material) {
        return;
      }
      [child.material].flat().forEach((material) => {
        ['map', 'roughnessMap', 'emissiveMap'].forEach((key) => {
          if (material[key]) {
            material[key].anisotropy = anisotropy;
          }
        });
      });
    });
  }

  // Ground height: just under the road near it, rolling hills further out.
  function groundHeight(x, z, sample, distance) {
    let hills = 0;
    if (scenarioName === 'jungle') {
      hills = 7 + Math.sin(x * 0.012) * 6 + Math.cos(z * 0.015) * 5 + Math.sin((x + z) * 0.03) * 2;
    }
    if (scenarioName === 'wasteland') {
      hills = 2 + Math.sin(x * 0.02) * 3 + Math.cos(z * 0.017) * 3;
    }
    const near = sample.y - 0.45;
    const blend = smoothstep(HALF + 3, 90, distance);
    return near + (hills - near) * blend - (scenarioName === 'city' ? 0.05 : 0);
  }

  function buildGround(group, samples, clearance) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    samples.forEach((sample) => {
      minX = Math.min(minX, sample.x);
      maxX = Math.max(maxX, sample.x);
      minZ = Math.min(minZ, sample.z);
      maxZ = Math.max(maxZ, sample.z);
    });
    const size = Math.max(maxX - minX, maxZ - minZ) + 1400;
    // About one ground point every 14 m, so it hugs the road on big tracks.
    const segments = Math.min(280, Math.max(160, Math.round(size / 14)));
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const position = geometry.attributes.position;
    const colors = [];
    const rand = random(5);
    let base = new THREE.Color('#3e3c48');
    if (scenarioName === 'jungle') {
      base = new THREE.Color('#4f8a32');
    }
    const sand = new THREE.Color('#e3b277');
    const snow = new THREE.Color('#f2f6fb');
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const { sample, distance } = clearance.nearest(x, z);
      position.setY(i, groundHeight(x, z, sample, distance));
      let color = base.clone();
      if (scenarioName === 'wasteland') {
        color = sand.clone().lerp(snow, snowiness(sample.t));
      }
      // Darker near the road (worn, shaded) and patchy further out.
      const shade = (0.88 + rand() * 0.16) * (0.8 + 0.2 * smoothstep(HALF, HALF + 12, distance));
      colors.push(color.r * shade, color.g * shade, color.b * shade);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    let kind = 'paving';
    if (scenarioName === 'jungle') {
      kind = 'grass';
    }
    if (scenarioName === 'wasteland') {
      kind = 'drift';
    }
    const detail = groundDetail(kind);
    detail.repeat.set(size / 10, size / 10);
    const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: detail, vertexColors: true, roughness: 0.95 }));
    ground.receiveShadow = true;
    group.add(ground);
  }

  function buildRoad(group, samples, length) {
    const textures = roadTextures(scenarioName);
    const surface = new THREE.MeshStandardMaterial({
      map: textures.map,
      roughnessMap: textures.roughnessMap,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.6,
    });
    const road = new THREE.Mesh(ribbon(samples, length, { side: HALF, up: 0.05 }, { side: -HALF, up: 0.05 }), surface);
    road.receiveShadow = true;
    group.add(road);

    // A skirt below the edges hides any gap to the ground on slopes.
    const skirtMaterial = new THREE.MeshStandardMaterial({ color: scenarioName === 'jungle' ? 0x6e4426 : 0x2c2c33, side: THREE.DoubleSide, roughness: 1 });
    [1, -1].forEach((side) => {
      group.add(new THREE.Mesh(ribbon(samples, length, { side: side * (HALF + 1.2), up: 0.06 }, { side: side * (HALF + 1.6), up: -2 }), skirtMaterial));
    });

    // Striped curbs, then a low barrier with a glowing (city) or plain top.
    let stripes = stripesTexture('#f4f4f4', '#e3242b');
    let barrierColor = 0xb4b8c4;
    let topMaterial = new THREE.MeshBasicMaterial({ color: glowColor('#35f2ff', 3) });
    if (scenarioName === 'jungle') {
      stripes = stripesTexture('#e8d9a8', '#3f7d2c');
      barrierColor = 0x9a8a68;
      topMaterial = new THREE.MeshStandardMaterial({ color: 0x6a9a4a, roughness: 0.9 });
    }
    if (scenarioName === 'wasteland') {
      stripes = stripesTexture('#d9d2c0', '#2b2b2b');
      barrierColor = 0x8a5a3a;
      topMaterial = new THREE.MeshStandardMaterial({ color: 0xd07a3a, roughness: 0.5, metalness: 0.6 });
    }
    const curbMaterial = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 });
    const barrierMaterial = new THREE.MeshStandardMaterial({ color: barrierColor, side: THREE.DoubleSide, roughness: 0.7, metalness: scenarioName === 'wasteland' ? 0.5 : 0.1 });
    [1, -1].forEach((side) => {
      const curb = new THREE.Mesh(ribbon(samples, length, { side: side * HALF, up: 0.09 }, { side: side * (HALF + 1.2), up: 0.09 }, 4), curbMaterial);
      curb.receiveShadow = true;
      group.add(curb);
      const barrier = new THREE.Mesh(ribbon(samples, length, { side: side * (HALF + 1.2), up: 0 }, { side: side * (HALF + 1.2), up: 1 }), barrierMaterial);
      barrier.receiveShadow = true;
      group.add(barrier);
      group.add(new THREE.Mesh(ribbon(samples, length, { side: side * (HALF + 1.2), up: 1 }, { side: side * (HALF + 1.45), up: 1 }), topMaterial));
    });

    // The start line and a gantry over it with a glowing checkered banner.
    const start = samples[0];
    const yaw = Math.atan2(start.dx, start.dz);
    const lineGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, 2.4);
    lineGeometry.rotateX(-Math.PI / 2);
    const line = new THREE.Mesh(lineGeometry, new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.6 }));
    line.rotation.y = yaw;
    line.position.set(start.x, start.y + 0.08, start.z);
    line.receiveShadow = true;
    group.add(line);
    const gantry = new Batch();
    [1, -1].forEach((side) => {
      gantry.add(UNIT_BOX, place(start.x + start.nx * side * (HALF + 2), start.y - 0.5, start.z + start.nz * side * (HALF + 2), yaw, 1, 10, 1), '#2b2b35', { shade: true });
    });
    gantry.add(UNIT_BOX, place(start.x, start.y + 8.5, start.z, yaw + Math.PI / 2, 1.2, 2, ROAD_WIDTH + 5), '#2b2b35', { shade: true });
    group.add(gantry.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }), { cast: true }));
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH + 4, 1.6),
      new THREE.MeshBasicMaterial({ map: checkerTexture(), color: new THREE.Color(1.6, 1.6, 1.6), side: THREE.DoubleSide }),
    );
    banner.rotation.y = yaw;
    banner.position.set(start.x, start.y + 9.5, start.z);
    group.add(banner);
  }

  function buildPoints(group, placed) {
    const { geometry, material, glow } = pointLook(scenarioName);
    pointGlow = glow;
    const beamMaterial = new THREE.MeshBasicMaterial({ map: beamMap, color: glowColor(glow, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const beamGeometry = new THREE.CylinderGeometry(0.6, 0.6, 26, 16, 1, true);
    beamGeometry.translate(0, 13, 0);
    points = placed.map((point) => {
      const sample = track.samples[point.index];
      const side = sideMeters(point.side);
      const holder = new THREE.Group();
      holder.position.set(sample.x + sample.nx * side, sample.y + 1.5, sample.z + sample.nz * side);
      const shape = new THREE.Mesh(geometry, material);
      shape.castShadow = true;
      holder.add(shape);
      // Each point fades on its own, so each needs its own glow material.
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: glowColor(glow, 0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      halo.scale.setScalar(4);
      holder.add(halo);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.y = -1.5;
      holder.add(beam);
      group.add(holder);
      return { holder, shape, halo, collected: false, pop: 0 };
    });
  }

  function setRatio(ratio) {
    pixelRatio = ratio;
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    composer.setSize(width, height);
    effects.resize(height * ratio);
  }

  let frameAverage = 16;
  let lastAdapt = 0;

  return {
    renderer,
    camera,
    scene,
    effects,
    quality: quality.name,

    // Builds a scenario, on its own circuit or on a built track's points.
    // Returns the track samples and length.
    setScenario(name, points = CIRCUITS[name]) {
      disposeWorld();
      scenarioName = name;
      track = sampleTrack(points);
      if (name === 'wasteland') {
        applyLook(LOOKS.snow);
      } else {
        applyLook(LOOKS[name]);
      }
      updateEnvironment();
      world = new THREE.Group();
      const clearance = new Clearance(track.samples);
      const groundY = (x, z) => {
        const { sample, distance } = clearance.nearest(x, z);
        return groundHeight(x, z, sample, distance);
      };
      buildGround(world, track.samples, clearance);
      buildRoad(world, track.samples, track.length);
      if (name === 'city') {
        buildCity(world, track.samples, clearance, groundY, quality, dot);
      }
      if (name === 'jungle') {
        buildJungle(world, track.samples, clearance, groundY, quality);
      }
      if (name === 'wasteland') {
        buildWasteland(world, track.samples, clearance, groundY, quality);
      }
      sharpen(world);
      scene.add(world);
      return track;
    },

    // City nights need headlights; so does the snowstorm.
    get headlights() {
      return scenarioName === 'city';
    },

    // What the wheels kick up here: smoke, dust, sand or snow.
    groundKind(t) {
      if (scenarioName === 'jungle') {
        return 'dust';
      }
      if (scenarioName === 'wasteland') {
        return snowiness(t) > 0.5 ? 'snow' : 'sand';
      }
      return 'smoke';
    },

    setPoints(placed) {
      points.forEach((point) => world.remove(point.holder));
      buildPoints(world, placed);
    },

    collectPoint(index) {
      const point = points[index];
      if (point && !point.collected) {
        point.collected = true;
        point.pop = 0.001;
        const at = point.holder.position;
        effects.burst(at.x, at.y, at.z, glowColor(pointGlow, 2));
      }
    },

    pointPosition(index) {
      return points[index]?.holder.position;
    },

    // The shadow box and sun follow the car.
    follow(x, y, z) {
      sun.target.position.set(x, y, z);
      sun.position.set(x + lightDirection.x * 150, y + lightDirection.y * 150, z + lightDirection.z * 150);
    },

    // Spin and bob the points, play the collect pop, follow the weather.
    animate(dt, time, carT, cameraPosition) {
      skyMaterial.uniforms.time.value = time;
      points.forEach((point, i) => {
        if (point.collected && point.pop === 0) {
          return;
        }
        point.shape.rotation.y = time * 2.2 + i;
        point.shape.position.y = Math.sin(time * 3 + i) * 0.3;
        if (point.pop > 0) {
          // Shrink and fly up (growing would fill the camera).
          point.pop += dt * 3;
          point.holder.scale.setScalar(Math.max(0.01, 1 - point.pop * 0.9));
          point.holder.position.y += dt * 9;
          point.halo.material.opacity = Math.max(0, 0.6 - point.pop);
          if (point.pop >= 1) {
            point.holder.visible = false;
            point.pop = 0;
          }
        }
      });
      if (scenarioName === 'wasteland') {
        const amount = snowiness(carT);
        applyLook(blendLooks(LOOKS.desert, LOOKS.snow, amount));
        flakeMaterial.opacity = amount;
        flakes.visible = amount > 0.01;
        const positions = flakeGeometry.attributes.position;
        for (let i = 0; i < flakeCount; i += 1) {
          let y = positions.getY(i) - dt * 4;
          if (y < 0) {
            y += 50;
          }
          positions.setY(i, y);
          positions.setX(i, positions.getX(i) + Math.sin(time + i) * dt * 0.6);
        }
        positions.needsUpdate = true;
        flakes.position.set(cameraPosition.x, cameraPosition.y - 15, cameraPosition.z);
      } else {
        flakes.visible = false;
      }
      sky.position.copy(cameraPosition);
      effects.update(dt);
    },

    // Keeps the game smooth: lowers the resolution when frames are slow,
    // raises it again when there's room.
    adapt(frameMs) {
      frameAverage += (frameMs - frameAverage) * 0.05;
      const now = performance.now();
      if (now - lastAdapt < 1500) {
        return;
      }
      if (frameAverage > 24 && pixelRatio > quality.minRatio) {
        lastAdapt = now;
        setRatio(Math.max(quality.minRatio, pixelRatio - 0.25));
        return;
      }
      if (frameAverage < 14 && pixelRatio < quality.maxRatio) {
        lastAdapt = now;
        setRatio(Math.min(quality.maxRatio, pixelRatio + 0.25));
      }
    },

    resize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      effects.resize(height * pixelRatio);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    render() {
      composer.render();
    },
  };
}
