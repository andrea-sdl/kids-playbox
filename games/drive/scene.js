// The 3D world: sky, road, scenery and the points to collect, for each of
// the three scenarios. The shapes are built in code. What covers them comes
// from pictures made for the game (art/): photo-like roads and ground,
// building fronts, cut-outs of trees, plants, wrecks and ruins stood
// upright, and a painting of the far skyline or hills all around. A world
// drawn in code shows first, so the game starts at once and still works
// if a picture is missing; the pictures are laid over it as they arrive.
// Surfaces have bumps (normal maps) and wet
// or shiny spots, the sky lights and reflects on everything, and the picture
// is finished like a film: glow, sun shafts, lens flares, speed blur and
// color grading (see gfx/post.js).

import * as THREE from '../../vendor/three/three.min.js';
import { CIRCUITS, ROAD_WIDTH, sampleTrack, sideMeters, snowiness } from './world.js';
import {
  beamTexture,
  boostTexture,
  checkerTexture,
  facadeFromPicture,
  facadeTextures,
  fernTexture,
  frondTexture,
  groundDetail,
  random,
  roadTextures,
  signTexture,
  softDotTexture,
  strataTexture,
  stripesTexture,
} from './textures.js';
import { createEffects } from './effects.js';
import { createPipeline } from '../../gfx/post.js';
import { createSky, skyDirection } from '../../gfx/sky.js';
import { matchTiling, normalMapFrom } from '../../gfx/surface.js';

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

// Sky, light and air for each place, then the lens and the film: glow
// (bloom, threshold), sun shafts (rays, rayFloor), flares, and the color
// grade (saturation, contrast, tint for bright parts, shadowTint for dark
// ones). The wasteland blends from `snow` to `desert` as the car drives on.
// Elevations are in degrees.
const LOOKS = {
  city: {
    top: '#07061c', horizon: '#8a3a78', bottom: '#1b1226', fog: '#2a1a40', fogDensity: 0.0024,
    sunElevation: 3, sunAzimuth: 200, sunColor: '#ff9a5a', sunSize: 0.03, disc: 10, lightElevation: 55,
    sunPower: 1.0, hemiSky: '#7d6cff', hemiGround: '#2a1a36', hemiPower: 0.85,
    stars: 1, moon: 1, clouds: 0.2, bloom: 0.62, threshold: 0.92, radius: 0.6, exposure: 1.08,
    rays: 0.25, rayFloor: 1.4, flare: 0.5, vignette: 0.42, grain: 0.04, aberration: 0.02,
    saturation: 1.16, contrast: 1.08, tint: '#fff2fb', shadowTint: '#04061a',
  },
  // Late afternoon: low golden light through the mist.
  jungle: {
    top: '#3d6fc0', horizon: '#ffc78a', bottom: '#4d6e3c', fog: '#d9c9a0', fogDensity: 0.0026,
    sunElevation: 13, sunAzimuth: 130, sunColor: '#ffd9a0', sunSize: 0.03, disc: 10, lightElevation: 34,
    sunPower: 3.2, hemiSky: '#ffe6c4', hemiGround: '#3a5a22', hemiPower: 1.1,
    stars: 0, moon: 0, clouds: 0.46, bloom: 0.42, threshold: 0.95, radius: 0.5, exposure: 1,
    rays: 0.5, rayFloor: 1.8, flare: 0.9, vignette: 0.34, grain: 0.028, aberration: 0.012,
    saturation: 1.16, contrast: 1.07, tint: '#fff2dc', shadowTint: '#060a02',
  },
  snow: {
    top: '#74839a', horizon: '#d5dae1', bottom: '#c6ccd6', fog: '#c9cfd8', fogDensity: 0.0066,
    sunElevation: 22, sunAzimuth: 160, sunColor: '#eaf0ff', sunSize: 0.03, disc: 6, lightElevation: 40,
    sunPower: 1.5, hemiSky: '#e2e8f3', hemiGround: '#9aa3b2', hemiPower: 1.6,
    stars: 0, moon: 0, clouds: 1, bloom: 0.34, threshold: 1, radius: 0.5, exposure: 1,
    rays: 0.2, rayFloor: 1.6, flare: 0.3, vignette: 0.36, grain: 0.035, aberration: 0.012,
    saturation: 0.96, contrast: 1.06, tint: '#f4f8ff', shadowTint: '#02050c',
  },
  desert: {
    top: '#2f72c0', horizon: '#f4c890', bottom: '#c08648', fog: '#e0a878', fogDensity: 0.0019,
    sunElevation: 16, sunAzimuth: 230, sunColor: '#ffd29a', sunSize: 0.032, disc: 12, lightElevation: 32,
    sunPower: 3.1, hemiSky: '#ffe2bd', hemiGround: '#a8703a', hemiPower: 1.05,
    stars: 0, moon: 0, clouds: 0.3, bloom: 0.32, threshold: 1.05, radius: 0.55, exposure: 0.9,
    rays: 0.35, rayFloor: 2.2, flare: 0.9, vignette: 0.36, grain: 0.03, aberration: 0.014,
    saturation: 1.12, contrast: 1.08, tint: '#fff1dc', shadowTint: '#0a0402',
  },
};

// The pictures each scenario uses (files in art/, without the ending).
const ART = {
  city: {
    pano: 'pano-city', road: 'road-wet', ground: 'ground-city', facades: ['facade-a', 'facade-b'],
    palms: ['cut-palm'], bushes: ['cut-flowerbush'],
  },
  jungle: {
    pano: 'pano-jungle', road: 'road-jungle', ground: 'ground-jungle',
    trees: ['cut-jungletree', 'cut-palm', 'cut-jungletree'], giants: ['cut-jungletree'], plants: ['cut-fern', 'cut-flowerbush', 'cut-fern'],
    falls: 'cut-waterfall', ruins: ['cut-ruinhead'],
  },
  wasteland: {
    pano: 'pano-snow', panoDesert: 'pano-desert', road: 'road-desert', roadSnow: 'road-snow', ground: 'ground-snow',
    wall: 'tile-ruin', rock: 'tile-redrock',
    deadTrees: ['cut-deadtree'], wrecks: ['cut-wreck'], towers: ['cut-ruin'], overpasses: ['cut-overpass'],
    cacti: ['cut-cactus', 'cut-drybush', 'cut-cactus'], spires: ['cut-spire'], pylons: ['cut-pylon'], desertRuins: ['cut-desertruin'],
  },
};

// How high up each painting its horizon is, and how much of its height is
// used: the top is left to the real sky where that has a sun to show.
const PAINTINGS = {
  'pano-city': { horizonAt: 0.12, keep: 1 },
  'pano-jungle': { horizonAt: 0.36, keep: 1 },
  'pano-snow': { horizonAt: 0.2, keep: 0.85 },
  'pano-desert': { horizonAt: 0.14, keep: 0.62 },
};

// Boost pads glow cyan in the neon city, amber elsewhere.
const BOOST_GLOW = { city: '#35e8ff', jungle: '#ffb020', wasteland: '#ffa01e' };

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

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

// The same, split into square chunks of ground. Each chunk is its own mesh,
// so the GPU can skip chunks the camera (or the shadow box) can't see,
// instead of drawing a whole forest every frame.
const CHUNK = 160;

class ChunkedBatch {
  constructor() {
    this.chunks = new Map();
  }

  add(geometry, matrix, color, options) {
    const x = Math.floor(matrix.elements[12] / CHUNK);
    const z = Math.floor(matrix.elements[14] / CHUNK);
    const key = `${x},${z}`;
    if (!this.chunks.has(key)) {
      this.chunks.set(key, new Batch());
    }
    this.chunks.get(key).add(geometry, matrix, color, options);
  }

  mesh(material, options) {
    const group = new THREE.Group();
    this.chunks.forEach((batch) => group.add(batch.mesh(material, options)));
    return group;
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

function buildCity(group, samples, clearance, groundY, quality, dot, beamMap) {
  const rand = random(101);
  const facade = facadeTextures('city');
  const buildings = new ChunkedBatch();
  // The tall towers further back are their own batch, so they can wear a
  // different front.
  const towers = new ChunkedBatch();
  const roofs = new ChunkedBatch();
  const neon = new ChunkedBatch();
  const signs = new ChunkedBatch();
  const signShape = new THREE.PlaneGeometry(1, 1);
  const tints = ['#c9c4e8', '#b8c4ea', '#d8c6d8', '#c2b8dc', '#aebde0', '#d4d0e6'];
  const neonColors = ['#ff3fa4', '#35f2ff', '#a45bff', '#ffd23f', '#39ff88'];
  const addBuilding = (batch, spot, width, depth, height, withSign) => {
    const y = groundY(spot.x, spot.z) - 0.5;
    const shift = Math.floor(rand() * 8) / 8;
    const tint = tints[Math.floor(rand() * tints.length)];
    batch.add(UNIT_BOX, place(spot.x, y, spot.z, spot.yaw, width, height, depth), tint, { uv: facadeUv(width, height, depth, 24, shift) });
    // Tall towers step in near the top.
    let top = y + height;
    let topWidth = width;
    let topDepth = depth;
    if (height > 40 && rand() < 0.6) {
      const more = height * (0.18 + rand() * 0.2);
      topWidth = width * 0.66;
      topDepth = depth * 0.66;
      batch.add(UNIT_BOX, place(spot.x, top, spot.z, spot.yaw, topWidth, more, topDepth), tint, { uv: facadeUv(topWidth, more, topDepth, 24, shift) });
      // A glowing band where the tower steps in.
      neon.add(UNIT_BOX, place(spot.x, top - 0.1, spot.z, spot.yaw, topWidth + 0.5, 0.35, topDepth + 0.5), glowColor(neonColors[Math.floor(rand() * neonColors.length)], 2.2));
      top += more;
    }
    // Rooftop machinery and the odd antenna with a red light.
    for (let i = 0; i < 3; i += 1) {
      roofs.add(UNIT_BOX, place(spot.x + (rand() - 0.5) * topWidth * 0.6, top, spot.z + (rand() - 0.5) * topDepth * 0.6, spot.yaw, 2 + rand() * 3, 1 + rand() * 2, 2 + rand() * 3), '#4a4858', { shade: true });
    }
    if (rand() < 0.35) {
      const mast = 8 + rand() * 8;
      roofs.add(UNIT_BOX, place(spot.x, top, spot.z, spot.yaw, 0.3, mast, 0.3), '#3a3846');
      neon.add(UNIT_BOX, place(spot.x, top + mast, spot.z, spot.yaw, 0.7, 0.7, 0.7), glowColor('#ff2a3a', 5));
    }
    if (!withSign || rand() < 0.4) {
      return;
    }
    const front = width / 2 + 0.25;
    // A billboard with a neon picture, facing the road.
    if (rand() < 0.45) {
      const wide = Math.min(depth - 2, 9 + rand() * 5);
      const tall = wide / 2;
      const cell = Math.floor(rand() * 8);
      signs.add(signShape, place(
        spot.x - spot.sample.nx * spot.side * (front + 0.1),
        y + 7 + tall / 2 + rand() * Math.max(1, Math.min(22, height - tall - 12)),
        spot.z - spot.sample.nz * spot.side * (front + 0.1),
        Math.atan2(-spot.side * spot.sample.nx, -spot.side * spot.sample.nz), wide, tall, 1,
      ), glowColor('#ffffff', 2.4), { uv: (i, u, v) => [((cell % 4) + u) / 4, (Math.floor(cell / 4) + v) / 2] });
      return;
    }
    // Or a glowing strip.
    const signHeight = 2 + rand() * 4;
    neon.add(UNIT_BOX, place(
      spot.x - spot.sample.nx * spot.side * front,
      y + 5 + rand() * Math.max(1, height - signHeight - 8),
      spot.z - spot.sample.nz * spot.side * front,
      spot.yaw, 0.4, signHeight, Math.min(depth - 2, 6 + rand() * 6),
    ), glowColor(neonColors[Math.floor(rand() * neonColors.length)], 3));
  };
  roadsideSpots(samples, clearance, rand, { step: 26, from: 6, to: 14, radius: 12 }).forEach((spot) => {
    addBuilding(buildings, spot, 14 + rand() * 12, 14 + rand() * 14, 18 + rand() * 50, true);
  });
  roadsideSpots(samples, clearance, rand, { step: 34, from: 40, to: 80, radius: 16 }).forEach((spot) => {
    addBuilding(towers, spot, 18 + rand() * 14, 18 + rand() * 14, 50 + rand() * 80, false);
  });
  const fronts = [buildings, towers].map((batch) => {
    const material = new THREE.MeshStandardMaterial({
      map: facade.map,
      emissiveMap: facade.emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: 1.25,
      normalMap: facade.normalMap,
      roughnessMap: facade.finishMap,
      metalnessMap: facade.finishMap,
      roughness: 1,
      metalness: 1,
      envMapIntensity: 1.4,
      vertexColors: true,
    });
    group.add(batch.mesh(material, { cast: quality.sceneryShadows }));
    return material;
  });
  group.add(roofs.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), { cast: quality.sceneryShadows }));
  group.add(signs.mesh(new THREE.MeshBasicMaterial({ map: signTexture(), vertexColors: true })));

  // Street lights, each with a cone of light in the haze and a warm pool
  // of light on the road.
  const poles = new ChunkedBatch();
  const bulbs = new ChunkedBatch();
  const pools = new ChunkedBatch();
  const cones = new ChunkedBatch();
  // Narrow at the lamp, wide at the road. Turned over so the bright end
  // of the beam picture is at the lamp.
  const cone = new THREE.CylinderGeometry(4.6, 0.35, 8.4, 14, 1, true);
  cone.rotateX(Math.PI);
  cone.translate(0, -4.2, 0);
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
    cones.add(cone, place(armX, y + 8.4, armZ, spot.yaw), '#ffd9a0');
  });

  // Planters along the road, for palms and flowering bushes.
  const planters = [];
  const extra = random(151);
  roadsideSpots(samples, clearance, extra, { step: 46, from: 3.4, to: 3.4, radius: 0.6 }).forEach((spot) => {
    const y = spot.sample.y;
    poles.add(UNIT_BOX, place(spot.x, y - 0.3, spot.z, spot.yaw, 2.2, 1, 2.2), '#3b3948', { shade: true });
    neon.add(UNIT_BOX, place(spot.x, y + 0.62, spot.z, spot.yaw, 2.3, 0.08, 2.3), glowColor(neonColors[Math.floor(extra() * 2)], 1.6));
    planters.push({ x: spot.x, y: y + 0.6, z: spot.z });
  });

  // An elevated rail along the first half of the lap: pillars, a beam
  // with a glowing strip under it, and a train of lit cars.
  const railTops = [];
  for (let i = Math.floor(samples.length * 0.04); i < samples.length * 0.5; i += 14) {
    const sample = samples[i];
    const x = sample.x - sample.nx * (HALF + 5.2);
    const z = sample.z - sample.nz * (HALF + 5.2);
    if (clearance.isClear(x, z, 1)) {
      poles.add(UNIT_BOX, place(x, sample.y - 0.5, z, Math.atan2(sample.dx, sample.dz), 1.3, 14.5, 1.3), '#2b2a36', { shade: true });
      railTops.push(new THREE.Vector3(x, sample.y + 14, z));
    } else {
      railTops.push(null);
    }
  }
  const span = (from, to, wide, thick, lift) => {
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    return place((from.x + to.x) / 2, (from.y + to.y) / 2 + lift, (from.z + to.z) / 2, Math.atan2(to.x - from.x, to.z - from.z), wide, thick, flat + 0.4, -Math.atan2(to.y - from.y, flat));
  };
  railTops.forEach((top, i) => {
    const next = railTops[i + 1];
    if (!top || !next) {
      return;
    }
    poles.add(UNIT_BOX, span(top, next, 2.6, 1.1, 0), '#33323f', { shade: true });
    neon.add(UNIT_BOX, span(top, next, 0.3, 0.16, -0.2), glowColor(i % 2 ? '#35f2ff' : '#ff3fa4', 2.6));
    // Train cars on a stretch of it.
    if (i % 9 > 1 && i % 9 < 6) {
      poles.add(UNIT_BOX, span(top, next, 2.4, 2.6, 1.15), '#c9d2e6', { shade: true });
      neon.add(UNIT_BOX, span(top, next, 2.46, 0.7, 2.3), glowColor('#ffe9b0', 2.2));
    }
  });

  // Neon gateways over the road, every few hundred meters.
  const total = samples[samples.length - 1].s;
  const gates = Math.max(2, Math.round(total / 260));
  for (let i = 0; i < gates; i += 1) {
    const sample = samples[Math.floor(((i + 0.5) / gates) * samples.length)];
    const yaw = Math.atan2(sample.dx, sample.dz);
    const color = neonColors[i % neonColors.length];
    [-1, 1].forEach((side) => {
      const x = sample.x + sample.nx * side * (HALF + 2.4);
      const z = sample.z + sample.nz * side * (HALF + 2.4);
      poles.add(UNIT_BOX, place(x, sample.y - 0.5, z, yaw, 0.7, 11.5, 0.7), '#25242e');
      neon.add(UNIT_BOX, place(x - sample.nx * side * 0.42, sample.y + 0.6, z - sample.nz * side * 0.42, yaw, 0.14, 9.6, 0.14), glowColor(color, 3));
    });
    poles.add(UNIT_BOX, place(sample.x, sample.y + 10.6, sample.z, yaw + Math.PI / 2, 0.8, 0.9, ROAD_WIDTH + 5.6), '#25242e');
    neon.add(UNIT_BOX, place(sample.x, sample.y + 10.3, sample.z, yaw + Math.PI / 2, 0.2, 0.2, ROAD_WIDTH + 3.6), glowColor(color, 3.4));
    // A hologram of rings floating over every other gateway.
    if (i % 2 === 0) {
      [[7, 0.22, 0.2], [4.6, 0.16, -0.5]].forEach(([radius, thick, lean], k) => {
        const ring = new THREE.TorusGeometry(radius, thick, 8, 44);
        neon.add(ring, place(sample.x, sample.y + 21, sample.z, yaw + lean, 1, 1, 1, 0.5 * (k ? -1 : 1)), glowColor(k ? '#ff3fa4' : '#35f2ff', 1.5));
        ring.dispose();
      });
    }
  }
  group.add(neon.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));
  if (quality.name === 'high') {
    const coneMesh = cones.mesh(new THREE.MeshBasicMaterial({
      map: beamMap, vertexColors: true, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }), { receive: false });
    coneMesh.renderOrder = 3;
    group.add(coneMesh);
  }
  group.add(poles.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 })));
  group.add(bulbs.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));
  const poolMesh = pools.mesh(new THREE.MeshBasicMaterial({
    map: dot, vertexColors: true, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  poolMesh.renderOrder = 1;
  group.add(poolMesh);
  return { fronts, planters };
}

function buildJungle(group, samples, clearance, groundY, quality) {
  const rand = random(202);
  let detail = 2;
  if (quality.name === 'low') {
    detail = 1;
  }
  const clumps = leafClumps(detail);
  // The trees, palms and ferns drawn in code stand in until the pictures
  // of real ones arrive; where each one stands is kept for those.
  const standIn = new THREE.Group();
  const near = [];
  const far = [];
  const edge = [];
  const trees = new ChunkedBatch();
  const fronds = new ChunkedBatch();
  const ferns = new ChunkedBatch();
  const trunk = new THREE.CylinderGeometry(0.3, 0.55, 1, 10, 4);
  trunk.translate(0, 0.5, 0);
  const palmTrunk = new THREE.CylinderGeometry(0.22, 0.38, 1, 10, 6);
  palmTrunk.translate(0, 0.5, 0);
  const frond = frondGeometry();
  const card = crossedCards(2.6, 1.6);
  const greens = ['#2f8f2f', '#3fa53a', '#2a7a2c', '#4cb043', '#226b28', '#5aa83a'];
  let sprays = 7;
  if (quality.name === 'low') {
    sprays = 0;
  }

  const addTree = (x, y, z, scale) => {
    const height = (6 + rand() * 6) * scale;
    trees.add(trunk, place(x, y, z, rand() * 6, scale, height, scale, (rand() - 0.5) * 0.1), '#5b3b22', { shade: true });
    const blobs = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < blobs; i += 1) {
      const size = (2.4 + rand() * 2.2) * scale;
      const cx = x + (rand() - 0.5) * 3 * scale;
      const cy = y + height - 0.5 + rand() * 2.4 * scale;
      const cz = z + (rand() - 0.5) * 3 * scale;
      trees.add(clumps[Math.floor(rand() * clumps.length)], place(cx, cy, cz, rand() * 6, size, size * 0.85, size), greens[Math.floor(rand() * greens.length)], { shade: true });
      // Sprays of leaves poke out of each clump, so its edge isn't smooth.
      for (let k = 0; k < sprays; k += 1) {
        const around = rand() * Math.PI * 2;
        const lift = (rand() - 0.25) * 0.8;
        const reach = size * 0.82;
        const spray = size * (0.4 + rand() * 0.3);
        ferns.add(card, place(
          cx + Math.cos(around) * reach * Math.cos(lift),
          cy + Math.sin(lift) * reach * 0.8 - spray * 0.2,
          cz + Math.sin(around) * reach * Math.cos(lift),
          rand() * 6, spray, spray, spray, (rand() - 0.5) * 1.2, (rand() - 0.5) * 1.2,
        ), rand() < 0.5 ? '#e4f5c4' : '#a9d58a');
      }
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
    near.push({ x: spot.x, y, z: spot.z });
    if (rand() < 0.4) {
      addPalm(spot.x, y, spot.z, 0.8 + rand() * 0.5);
    } else {
      addTree(spot.x, y, spot.z, 0.8 + rand() * 0.6);
    }
  });
  roadsideSpots(samples, clearance, rand, { step: 18, from: 32, to: 110, radius: 4 }).forEach((spot) => {
    far.push({ x: spot.x, y: groundY(spot.x, spot.z) - 0.2, z: spot.z });
    addTree(spot.x, groundY(spot.x, spot.z) - 0.2, spot.z, 1.2 + rand() * 0.8);
  });
  // Ferns and grass right along the roadside, and mossy rocks.
  const rock = new THREE.DodecahedronGeometry(1, 1);
  const rocks = new ChunkedBatch();
  roadsideSpots(samples, clearance, rand, { step: 4, from: 0.4, to: 6, radius: 0.8 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z) - 0.05;
    const size = 0.7 + rand() * 0.9;
    if (rand() < 0.12) {
      rocks.add(rock, place(spot.x, y - 0.3, spot.z, rand() * 6, size * 1.4, size, size * 1.2), '#7d8572', { shade: true });
      return;
    }
    edge.push({ x: spot.x, y, z: spot.z });
    ferns.add(card, place(spot.x, y, spot.z, rand() * 6, size, size, size), rand() < 0.5 ? '#ffffff' : '#cfe8b0');
  });
  const leafy = { roughness: 0.85, vertexColors: true };
  standIn.add(trees.mesh(new THREE.MeshStandardMaterial(leafy), { cast: quality.sceneryShadows }));
  standIn.add(fronds.mesh(new THREE.MeshStandardMaterial({ ...leafy, map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide }), { cast: quality.sceneryShadows }));
  standIn.add(ferns.mesh(new THREE.MeshStandardMaterial({ ...leafy, map: fernTexture(), alphaTest: 0.4, side: THREE.DoubleSide })));
  group.add(standIn);
  group.add(rocks.mesh(new THREE.MeshStandardMaterial(leafy), { cast: quality.sceneryShadows }));

  // Ancient stone: gateways over the road and stepped temples in the trees.
  const stone = new ChunkedBatch();
  const moss = new ChunkedBatch();
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
  // A rope bridge high over the road: posts, sagging planks and ropes.
  const bridgeAt = samples[Math.floor(samples.length * 0.44)];
  const across = { x: bridgeAt.nx, z: bridgeAt.nz };
  const bridgeYaw = Math.atan2(bridgeAt.dx, bridgeAt.dz);
  const reach = HALF + 4;
  const deck = (f) => bridgeAt.y + 10.5 - Math.sin(f * Math.PI) * 1.6;
  [-1, 1].forEach((side) => {
    [-1.1, 1.1].forEach((along) => {
      stone.add(UNIT_BOX, place(bridgeAt.x + across.x * side * reach + bridgeAt.dx * along, bridgeAt.y - 1, bridgeAt.z + across.z * side * reach + bridgeAt.dz * along, bridgeYaw, 0.6, 13.6, 0.6), '#6b4a2c', { shade: true });
    });
  });
  const planks = 26;
  for (let i = 0; i < planks; i += 1) {
    const f = (i + 0.5) / planks;
    const out = (f * 2 - 1) * reach;
    const x = bridgeAt.x + across.x * out;
    const z = bridgeAt.z + across.z * out;
    stone.add(UNIT_BOX, place(x, deck(f), z, bridgeYaw, 2 * reach / planks - 0.12, 0.12, 2), i % 2 ? '#8a6238' : '#7a5530', { shade: true });
    [-1, 1].forEach((along) => {
      stone.add(UNIT_BOX, place(x + bridgeAt.dx * along, deck(f) + 1.15, z + bridgeAt.dz * along, bridgeYaw, 2 * reach / planks + 0.05, 0.07, 0.07), '#d6c59a');
      if (i % 3 === 0) {
        stone.add(UNIT_BOX, place(x + bridgeAt.dx * along, deck(f), z + bridgeAt.dz * along, bridgeYaw, 0.05, 1.2, 0.05), '#d6c59a');
      }
    });
  }
  group.add(stone.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { cast: quality.sceneryShadows }));
  group.add(moss.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

  // Where the waterfall and the overgrown gateways (pictures) will stand.
  const extra = random(252);
  const fallsAt = samples[Math.floor(samples.length * 0.3)];
  const fallsOut = HALF + 46;
  const falls = {
    x: fallsAt.x + fallsAt.nx * fallsOut, z: fallsAt.z + fallsAt.nz * fallsOut,
    y: groundY(fallsAt.x + fallsAt.nx * fallsOut, fallsAt.z + fallsAt.nz * fallsOut) - 3,
    turn: Math.atan2(fallsAt.dz, fallsAt.dx),
  };
  const ruins = roadsideSpots(samples, clearance, extra, { step: 150, from: 7, to: 16, radius: 5 }).map((spot) => ({
    x: spot.x, y: groundY(spot.x, spot.z) - 0.6, z: spot.z, turn: Math.atan2(spot.sample.dz, spot.sample.dx) + (extra() - 0.5) * 0.5,
  }));
  return { standIn, near, far, edge, falls, ruins };
}

function buildWasteland(group, samples, clearance, groundY, quality) {
  const rand = random(303);
  const ruinFacade = facadeTextures('ruin');
  const walls = new ChunkedBatch();
  const plain = new ChunkedBatch();
  const rocks = new ChunkedBatch();
  // Box wrecks stand in until the pictures of real ones arrive.
  const standIn = new THREE.Group();
  const boxWrecks = new ChunkedBatch();
  const wrecks = [];
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
    boxWrecks.add(UNIT_BOX, place(x, y, z, yaw, 2, 1, 4.4, 0, tilt), rust, { shade: true });
    boxWrecks.add(UNIT_BOX, place(x, y + 0.9, z - 0.3, yaw, 1.7, 0.7, 2.2, 0, tilt), '#2b2b30', { shade: true });
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
      wrecks.push({ x: spot.x, y: y - 0.25, z: spot.z, turn: Math.atan2(spot.sample.dz, spot.sample.dx) + (rand() - 0.5) * 0.5, snowy: snowiness(spot.sample.t) > 0.5 });
      addWreck(spot.x, y, spot.z, spot.yaw + (rand() - 0.5) * 1.5);
      return;
    }
    // A bent lamp post.
    plain.add(UNIT_BOX, place(spot.x, y, spot.z, spot.yaw, 0.3, 8, 0.3, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6), '#4a4744', { shade: true });
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: ruinFacade.map,
    normalMap: ruinFacade.normalMap,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: ruinFacade.finishMap,
    metalnessMap: ruinFacade.finishMap,
    roughness: 1,
    metalness: 1,
    vertexColors: true,
  });
  group.add(walls.mesh(wallMaterial, { cast: quality.sceneryShadows }));
  group.add(plain.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { cast: quality.sceneryShadows }));
  standIn.add(boxWrecks.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { cast: quality.sceneryShadows }));
  group.add(standIn);
  const strata = strataTexture();
  const rockMaterial = new THREE.MeshStandardMaterial({ map: strata, normalMap: normalMapFrom(strata.image, { strength: 4 }), vertexColors: true, roughness: 1 });
  group.add(rocks.mesh(rockMaterial));

  // Where the pictures will stand: dead trees, broken towers and fallen
  // overpasses in the snow; cacti, rock spires, pylons and buried ruins
  // in the desert.
  const extra = random(353);
  const turnOf = (spot) => Math.atan2(spot.sample.dz, spot.sample.dx);
  const split = (spots) => ({
    snow: spots.filter((spot) => snowiness(spot.sample.t) > 0.5),
    sand: spots.filter((spot) => snowiness(spot.sample.t) <= 0.5),
  });
  const at = (spot, sink = 0.3) => ({ x: spot.x, y: groundY(spot.x, spot.z) - sink, z: spot.z, turn: turnOf(spot) + (extra() - 0.5) * 0.4 });
  const small = split(roadsideSpots(samples, clearance, extra, { step: 12, from: 3, to: 34, radius: 2 }));
  const big = split(roadsideSpots(samples, clearance, extra, { step: 70, from: 42, to: 105, radius: 14 }));
  const beside = split(roadsideSpots(samples, clearance, extra, { step: 130, from: 13, to: 20, radius: 7 }));
  const midway = split(roadsideSpots(samples, clearance, extra, { step: 95, from: 16, to: 42, radius: 8 }));
  return {
    standIn,
    wrecks,
    wallMaterial,
    rockMaterial,
    deadTrees: small.snow.map((spot) => at(spot)),
    cacti: small.sand.map((spot) => at(spot)),
    towers: big.snow.map((spot) => at(spot, 2)),
    spires: big.sand.map((spot) => at(spot, 2)),
    overpasses: beside.snow.map((spot) => at(spot, 1)),
    pylons: beside.sand.map((spot) => at(spot, 0.5)),
    desertRuins: midway.sand.map((spot) => at(spot, 1.2)),
  };
}

/* ---------- Points ---------- */

// Glowing orbs of energy with a ring around them: gold in the city, amber
// in the jungle and the wasteland. They are brighter than white, so they
// bloom.
function pointLook(scenario) {
  const orb = new THREE.SphereGeometry(0.95, 28, 18);
  const ring = new THREE.TorusGeometry(1.35, 0.07, 8, 40);
  ring.rotateX(1.15);
  const geometry = THREE.mergeGeometries([orb, ring]);
  orb.dispose();
  ring.dispose();
  const tones = {
    city: { color: 0xffd04a, emissive: 0xffa200, glow: '#ffd866' },
    jungle: { color: 0xffbe3a, emissive: 0xff8c00, glow: '#ffc04a' },
    wasteland: { color: 0xffae32, emissive: 0xff7a00, glow: '#ffa63a' },
  }[scenario];
  return {
    geometry,
    material: new THREE.MeshStandardMaterial({ color: tones.color, emissive: tones.emissive, emissiveIntensity: scenario === 'city' ? 1.2 : 1.9, metalness: 0.2, roughness: 0.22 }),
    glow: tones.glow,
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
  renderer.info.autoReset = false;
  container.append(renderer.domElement);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  // The fog hides everything past about a kilometer, so nothing further is
  // drawn (the sky is pinned to the far edge, so it still shows).
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 1100);

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

  const sky = createSky(1500, { detail: quality.name === 'high' });
  const skyMaterial = sky.material;
  scene.add(sky.mesh);
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

  // The scene is drawn with smooth edges (multisampling) into a bright
  // picture, then finished: glow, sun shafts, flares and the color grade.
  const pipeline = createPipeline(renderer, scene, camera, {
    full: quality.name === 'high',
    msaa: quality.msaa,
    halfBloom: quality.name === 'low',
  });

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

  // Pictures are fetched once and kept. One that fails to load comes back
  // as null, and the part drawn in code stays.
  const images = new Map();
  function loadImage(name) {
    if (!images.has(name)) {
      images.set(name, new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = new URL(`./art/${name}.webp`, import.meta.url).href;
      }));
    }
    return images.get(name);
  }

  // All the pictures of a scenario, by what they are for.
  async function loadArt(name) {
    const entries = await Promise.all(Object.entries(ART[name]).map(async ([key, value]) => {
      if (Array.isArray(value)) {
        return [key, (await Promise.all(value.map(loadImage))).filter(Boolean)];
      }
      return [key, await loadImage(value)];
    }));
    return Object.fromEntries(entries);
  }

  // A picture as a surface. Repeats are mirrored, so no seam shows even
  // if the picture's edges don't match.
  function picture(image, wrap = THREE.MirroredRepeatWrapping) {
    const made = new THREE.Texture(image);
    made.colorSpace = THREE.SRGBColorSpace;
    made.wrapS = wrap;
    made.wrapT = wrap;
    made.anisotropy = anisotropy;
    made.needsUpdate = true;
    return made;
  }

  function bumpsOf(map, strength) {
    const size = { width: Math.min(512, map.image.width), height: Math.min(512, map.image.height) };
    const bumps = matchTiling(normalMapFrom(map.image, { strength, size }), map);
    bumps.anisotropy = anisotropy;
    return bumps;
  }

  let world = null;
  let track = null;
  // This scenario's own copy of the looks: a painting changes the sky's
  // colors to match itself.
  let looks = LOOKS;
  let building = 0;
  let built = null;
  let roadSurface = null;
  let groundMesh = null;
  let farViews = [];
  let scenarioName = 'city';
  let points = [];
  let pointGlow = '#ffffff';
  let boosts = [];
  let boostMap = null;
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
      object.customDepthMaterial?.dispose();
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
    built = null;
    roadSurface = null;
    groundMesh = null;
    farViews = [];
    points = [];
    boosts = [];
  }

  function applyLook(look) {
    sky.apply(look);
    pipeline.look(look);
    pipeline.setSun(sky.sunDirection);
    scene.fog.color.set(look.fog);
    scene.fog.density = look.fogDensity;
    lightDirection = skyDirection(look.lightElevation, look.sunAzimuth);
    sun.color.set(look.sunColor);
    sun.intensity = look.sunPower;
    hemisphere.color.set(look.hemiSky);
    hemisphere.groundColor.set(look.hemiGround);
    hemisphere.intensity = look.hemiPower;
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
        ['map', 'roughnessMap', 'emissiveMap', 'normalMap'].forEach((key) => {
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
      // The hills rise with the road, so a climb is up a real hillside.
      hills = sample.y * 0.8 + 7 + Math.sin(x * 0.012) * 6 + Math.cos(z * 0.015) * 5 + Math.sin((x + z) * 0.03) * 2;
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
    const bumps = matchTiling(normalMapFrom(detail.image, { strength: kind === 'paving' ? 2.5 : 3.5 }), detail);
    const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: detail, normalMap: bumps, vertexColors: true, roughness: kind === 'paving' ? 0.8 : 0.95 }));
    ground.receiveShadow = true;
    ground.userData.tiles = size / 10;
    groundMesh = ground;
    group.add(ground);
  }

  function buildRoad(group, samples, length) {
    const textures = roadTextures(scenarioName);
    const surface = new THREE.MeshStandardMaterial({
      map: textures.map,
      roughnessMap: textures.roughnessMap,
      normalMap: textures.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 1,
      metalness: 0,
      envMapIntensity: scenarioName === 'city' ? 1.5 : 0.7,
    });
    roadSurface = surface;
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
    const beamMaterial = new THREE.MeshBasicMaterial({ map: beamMap, color: glowColor(glow, 1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
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
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: glowColor(glow, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      halo.scale.setScalar(5.5);
      holder.add(halo);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.y = -1.5;
      holder.add(beam);
      group.add(holder);
      return { holder, shape, halo, collected: false, pop: 0 };
    });
  }

  // Boost pads: glowing strips of chevrons flat on the road.
  function buildBoosts(group, placed) {
    boostMap?.dispose();
    boostMap = boostTexture();
    boostMap.repeat.set(1, 1.5);
    const geometry = new THREE.PlaneGeometry(6, 10);
    geometry.rotateX(-Math.PI / 2);
    boosts = placed.map((boost) => {
      const sample = track.samples[boost.index];
      const side = sideMeters(boost.side);
      const material = new THREE.MeshBasicMaterial({
        map: boostMap,
        color: glowColor(BOOST_GLOW[scenarioName], 2.2),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pad = new THREE.Mesh(geometry, material);
      pad.position.set(sample.x + sample.nx * side, sample.y + 0.14, sample.z + sample.nz * side);
      pad.rotation.y = Math.atan2(sample.dx, sample.dz);
      pad.renderOrder = 2;
      group.add(pad);
      return { pad, flash: 0 };
    });
  }

  /* ---------- Pictures over the world ---------- */

  function swapMaps(material, maps) {
    Object.entries(maps).forEach(([key, map]) => {
      material[key]?.dispose();
      material[key] = map;
    });
    material.needsUpdate = true;
  }

  // Cut-outs stood upright: each is one sheet, or two or three crossed so
  // it looks full from every side. `spots` are [{ x, y, z, tall, turn }];
  // all of one picture's cut-outs are one mesh.
  function standing(image, spots, sheets, shadows) {
    const wide = image.width / image.height;
    const positions = [];
    const uvs = [];
    const normals = [];
    const indices = [];
    spots.forEach(({ x, y, z, tall, turn }) => {
      const half = (tall * wide) / 2;
      for (let k = 0; k < sheets; k += 1) {
        const angle = turn + (k * Math.PI) / sheets;
        const dx = Math.cos(angle) * half;
        const dz = Math.sin(angle) * half;
        const base = positions.length / 3;
        positions.push(x - dx, y, z - dz, x + dx, y, z + dz, x - dx, y + tall, z - dz, x + dx, y + tall, z + dz);
        uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
        // Lit as if facing up: the shading is already in the picture.
        normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    const map = picture(image, THREE.ClampToEdgeWrapping);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      map, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.3, color: scenarioName === 'city' ? '#ffffff' : '#d9d9d9',
    }));
    mesh.receiveShadow = false;
    mesh.castShadow = shadows && quality.sceneryShadows;
    if (mesh.castShadow) {
      // Shadows in the shape of the leaves, not of the sheets.
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.4 });
    }
    return mesh;
  }

  // Stands `spots` up as cut-outs, shared out between a few pictures.
  // `size` gives each one's height from a number between 0 and 1.
  function plant(pictures, spots, size, { sheets = 2, shadows = true, spin = true } = {}) {
    if (!pictures || pictures.length === 0 || spots.length === 0) {
      return;
    }
    const rand = random(77 + spots.length);
    // Phones get every other one.
    const kept = quality.name === 'low' ? spots.filter((unused, i) => i % 2 === 0) : spots;
    pictures.forEach((image, i) => {
      const mine = kept.filter((unused, k) => k % pictures.length === i).map((spot) => ({
        ...spot, tall: size(rand()), turn: spin ? rand() * Math.PI : spot.turn,
      }));
      if (mine.length > 0) {
        world.add(standing(image, mine, sheets, shadows));
      }
    });
  }

  // The colors of a painting: its sky just above the horizon, and the top
  // of the part of it that is used.
  function paintingTones(image, { horizonAt, keep }) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 32;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, 8, 32);
    const row = (share) => {
      const data = ctx.getImageData(0, Math.min(31, Math.max(0, Math.round((1 - share) * 31))), 8, 1).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < data.length; i += 4) {
        sum[0] += data[i];
        sum[1] += data[i + 1];
        sum[2] += data[i + 2];
      }
      return `#${new THREE.Color().setRGB(sum[0] / 2040, sum[1] / 2040, sum[2] / 2040, THREE.SRGBColorSpace).getHexString()}`;
    };
    return { horizon: row(horizonAt + 0.06), top: row(keep - 0.12) };
  }

  // A painting of the far skyline or hills, on a round wall beyond
  // everything, that moves along with the camera. Mirrored copies of the
  // picture carry it all the way around, and its top fades into the sky.
  function farView(image, name) {
    const { horizonAt, keep } = PAINTINGS[name];
    const radius = 900;
    const around = Math.PI * 2 * radius;
    const wide = image.width / image.height;
    // An even number of copies, so the mirrored ends meet.
    const copies = Math.max(2, 2 * Math.round(around / (wide * 470) / 2));
    const tall = around / copies / wide;
    const columns = 72;
    const heights = [0, horizonAt, horizonAt + (keep - horizonAt) * 0.72, keep];
    const positions = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    for (let c = 0; c <= columns; c += 1) {
      const angle = (c / columns) * Math.PI * 2;
      heights.forEach((v, r) => {
        positions.push(Math.sin(angle) * radius, (v - horizonAt) * tall, Math.cos(angle) * radius);
        uvs.push((c / columns) * copies, v);
        colors.push(1, 1, 1, r === heights.length - 1 ? 0 : 1);
      });
    }
    for (let c = 0; c < columns; c += 1) {
      for (let r = 0; r < heights.length - 1; r += 1) {
        const a = c * heights.length + r;
        const b = a + heights.length;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    const map = picture(image);
    map.wrapT = THREE.ClampToEdgeWrapping;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      map, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    }));
    mesh.frustumCulled = false;
    mesh.renderOrder = -2;
    return mesh;
  }

  // The far view, and the sky and haze recolored to match it.
  function paintFarView(image, name, lookName) {
    if (!image) {
      return null;
    }
    const mesh = farView(image, name);
    world.add(mesh);
    const tones = paintingTones(image, PAINTINGS[name]);
    const look = looks[lookName];
    // The sky above the painting carries on in the color of its top edge.
    look.horizon = `#${new THREE.Color(tones.top).lerp(new THREE.Color(tones.horizon), 0.25).getHexString()}`;
    look.top = tones.top;
    look.bottom = tones.horizon;
    look.fog = `#${new THREE.Color(look.fog).lerp(new THREE.Color(tones.horizon), 0.4).getHexString()}`;
    // The painting has its own clouds.
    look.clouds *= 0.35;
    return mesh;
  }

  // Lays the pictures over the world that was drawn in code.
  function dress(art) {
    const samples = track.samples;
    if (scenarioName === 'wasteland') {
      farViews = [
        { mesh: paintFarView(art.pano, 'pano-snow', 'snow'), snowy: true },
        { mesh: paintFarView(art.panoDesert, 'pano-desert', 'desert'), snowy: false },
      ].filter((view) => view.mesh);
    } else {
      farViews = [{ mesh: paintFarView(art.pano, ART[scenarioName].pano, scenarioName), snowy: null }].filter((view) => view.mesh);
      applyLook(looks[scenarioName]);
    }
    updateEnvironment();

    if (art.road) {
      const textures = roadTextures(scenarioName, art.road);
      swapMaps(roadSurface, textures);
      // A photo's grain is finer than drawn stone chips: gentler bumps.
      roadSurface.normalScale.set(0.45, 0.45);
    }
    if (art.roadSnow) {
      // Snow lies over the first half of the wasteland's road: a second
      // road surface on top, see-through where the desert begins.
      const geometry = ribbon(samples, track.length, { side: HALF, up: 0.065 }, { side: -HALF, up: 0.065 });
      const fade = [];
      for (let i = 0; i <= samples.length; i += 1) {
        // Thin, patchy snow: the asphalt still shows through.
        const amount = snowiness(samples[i % samples.length].t) * 0.5;
        fade.push(1.25, 1.25, 1.3, amount, 1.25, 1.25, 1.3, amount);
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(fade, 4));
      const textures = roadTextures('snowroad', art.roadSnow);
      const cover = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        ...textures, roughness: 1, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
      cover.receiveShadow = true;
      world.add(cover);
    }
    if (art.ground && groundMesh) {
      const map = picture(art.ground);
      map.repeat.set(groundMesh.userData.tiles, groundMesh.userData.tiles);
      swapMaps(groundMesh.material, { map, normalMap: bumpsOf(map, 3) });
      if (scenarioName !== 'wasteland') {
        // A photo of the ground has its own colors: only tint it lightly.
        const colors = groundMesh.geometry.attributes.color;
        for (let i = 0; i < colors.count; i += 1) {
          colors.setXYZ(i, colors.getX(i) * 0.3 + 0.66, colors.getY(i) * 0.3 + 0.66, colors.getZ(i) * 0.3 + 0.66);
        }
        colors.needsUpdate = true;
      }
    }

    if (scenarioName === 'city') {
      built.fronts.forEach((material, i) => {
        const image = art.facades[i % Math.max(1, art.facades.length)];
        if (!image) {
          return;
        }
        swapMaps(material, { ...facadeFromPicture(image), normalMap: null, roughnessMap: null, metalnessMap: null });
        material.roughness = 0.45;
        material.metalness = 0.25;
        material.emissiveIntensity = 1.05;
      });
      plant(art.palms, built.planters.filter((unused, i) => i % 2 === 0), (r) => 9 + r * 4, { sheets: 2 });
      plant(art.bushes, built.planters.filter((unused, i) => i % 2 === 1), (r) => 1.8 + r * 0.8, { sheets: 2, shadows: false });
    }
    if (scenarioName === 'jungle') {
      if (art.trees.length > 0 && art.plants.length > 0) {
        world.remove(built.standIn);
        dispose(built.standIn);
      }
      plant(art.trees, built.near, (r) => 11 + r * 9, { sheets: quality.name === 'high' ? 3 : 2 });
      plant(art.giants, built.far, (r) => 20 + r * 14, { sheets: 2 });
      plant(art.plants, built.edge, (r) => 1.3 + r * 1.6, { sheets: 2, shadows: false });
      plant(art.ruins, built.ruins, (r) => 8 + r * 3, { sheets: 1, spin: false });
      if (art.falls) {
        world.add(standing(art.falls, [{ ...built.falls, tall: 52 }], 1, false));
      }
    }
    if (scenarioName === 'wasteland') {
      if (art.wall) {
        const map = picture(art.wall);
        swapMaps(built.wallMaterial, { map, normalMap: bumpsOf(map, 3), roughnessMap: null, metalnessMap: null });
        built.wallMaterial.metalness = 0;
        built.wallMaterial.roughness = 0.95;
      }
      if (art.rock) {
        const map = picture(art.rock);
        swapMaps(built.rockMaterial, { map, normalMap: bumpsOf(map, 4) });
      }
      if (art.wrecks.length > 0) {
        world.remove(built.standIn);
        dispose(built.standIn);
      }
      plant(art.wrecks, built.wrecks, (r) => 1.7 + r * 0.5, { sheets: 1, spin: false });
      plant(art.deadTrees, built.deadTrees, (r) => 6 + r * 6, { sheets: 2 });
      plant(art.towers, built.towers, (r) => 34 + r * 26, { sheets: 1, spin: false, shadows: false });
      plant(art.overpasses, built.overpasses, (r) => 13 + r * 4, { sheets: 1, spin: false });
      plant(art.cacti, built.cacti, (r) => 2 + r * 5, { sheets: 2 });
      plant(art.spires, built.spires, (r) => 24 + r * 24, { sheets: 2, shadows: false });
      plant(art.pylons, built.pylons, (r) => 24 + r * 6, { sheets: 1, spin: false });
      plant(art.desertRuins, built.desertRuins, (r) => 8 + r * 6, { sheets: 1, spin: false });
    }
    sharpen(world);
  }

  function dispose(object) {
    object.traverse((child) => {
      child.geometry?.dispose();
      [child.material].flat().forEach((material) => {
        if (!material) {
          return;
        }
        Object.values(material).forEach((value) => {
          if (value && value.isTexture) {
            value.dispose();
          }
        });
        material.dispose();
      });
    });
  }

  function setRatio(ratio) {
    pixelRatio = ratio;
    renderer.setPixelRatio(ratio);
    pipeline.setPixelRatio(ratio);
    effects.resize(height * ratio);
    // Changing the size empties the canvas: draw again at once, or the
    // game flashes blank for a frame.
    pipeline.render(filmTime);
  }

  // When a device is still slow at the lowest resolution, the glow goes
  // first, then the shadows.
  let effectsLevel = 2;

  function dropEffect() {
    if (effectsLevel === 2) {
      pipeline.dropBloom();
    }
    if (effectsLevel === 1) {
      sun.castShadow = false;
    }
    effectsLevel -= 1;
  }

  let frameAverage = 16;
  let lastAdapt = 0;
  let filmTime = 0;

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
      building += 1;
      const mine = building;
      scenarioName = name;
      looks = JSON.parse(JSON.stringify(LOOKS));
      track = sampleTrack(points);
      if (name === 'wasteland') {
        applyLook(looks.snow);
      } else {
        applyLook(looks[name]);
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
        built = buildCity(world, track.samples, clearance, groundY, quality, dot, beamMap);
      }
      if (name === 'jungle') {
        built = buildJungle(world, track.samples, clearance, groundY, quality);
      }
      if (name === 'wasteland') {
        built = buildWasteland(world, track.samples, clearance, groundY, quality);
      }
      sharpen(world);
      scene.add(world);
      // The pictures go on as soon as they are here (at once, the second
      // time), unless another scenario was built meanwhile.
      loadArt(name).then((art) => {
        if (mine === building && world) {
          dress(art);
        }
      });
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

    setBoosts(placed) {
      boosts.forEach(({ pad }) => {
        world.remove(pad);
        pad.material.dispose();
      });
      buildBoosts(world, placed);
    },

    // A pad flashes when driven over.
    hitBoost(index) {
      if (boosts[index]) {
        boosts[index].flash = 1;
      }
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

    // 0 to 1: how hard the edges of the picture streak (nitro).
    setRush(amount) {
      pipeline.setSpeed(amount * 0.16);
    },

    // The shadow box and sun follow the car.
    follow(x, y, z) {
      sun.target.position.set(x, y, z);
      sun.position.set(x + lightDirection.x * 150, y + lightDirection.y * 150, z + lightDirection.z * 150);
    },

    // Spin and bob the points, play the collect pop, follow the weather.
    animate(dt, time, carT, cameraPosition) {
      sky.setTime(time);
      filmTime = time;
      if (boostMap) {
        boostMap.offset.y = (boostMap.offset.y + dt * 1.6) % 1;
      }
      boosts.forEach((boost) => {
        if (boost.flash <= 0) {
          return;
        }
        boost.flash = Math.max(0, boost.flash - dt * 2);
        boost.pad.material.color.copy(glowColor(BOOST_GLOW[scenarioName], 2.2 + boost.flash * 2.2));
      });
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
        applyLook(blendLooks(looks.desert, looks.snow, amount));
        farViews.forEach((view) => {
          view.mesh.material.opacity = view.snowy ? amount : 1 - amount;
          view.mesh.visible = view.mesh.material.opacity > 0.01;
        });
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
      sky.mesh.position.copy(cameraPosition);
      farViews.forEach((view) => view.mesh.position.copy(cameraPosition));
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
      if (frameAverage > 28 && effectsLevel > 0 && now - lastAdapt > 3000) {
        lastAdapt = now;
        dropEffect();
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
      pipeline.setSize(width, height);
      effects.resize(height * pixelRatio);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    // Counted over the whole frame (scene, shadows and glow passes).
    render() {
      renderer.info.reset();
      pipeline.render(filmTime);
    },

    // For the ?stats overlay.
    stats() {
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        ratio: pixelRatio,
        bloom: pipeline.bloomOn,
        shadows: sun.castShadow,
      };
    },
  };
}
