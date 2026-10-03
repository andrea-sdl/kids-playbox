// The 3D world: sky, road, scenery and the points to collect, for each of
// the three scenarios. Everything is made from simple shapes and small
// canvas textures, so it works offline and loads fast.

import * as THREE from '../../vendor/three/three.min.js';
import { CIRCUITS, ROAD_WIDTH, sampleTrack, sideMeters, snowiness } from './world.js';

const HALF = ROAD_WIDTH / 2;

// Colors and light for each scenario. The wasteland blends from `snow` to
// `desert` as the car drives on.
const LOOKS = {
  city: {
    skyTop: '#1a0b3d', skyMid: '#7a2a7a', skyLow: '#ff8a4c', fog: '#3a1d55', fogNear: 60, fogFar: 520,
    ground: '#2a2833', sun: '#ffb27a', sunPower: 1.8, sky: '#8c7cff', groundLight: '#2b1d3a', hemiPower: 1.1, exposure: 1.05,
  },
  jungle: {
    skyTop: '#2f86d6', skyMid: '#8fd0ee', skyLow: '#e8f3d0', fog: '#a9d3a6', fogNear: 50, fogFar: 420,
    ground: '#3f7d2c', sun: '#fff1cc', sunPower: 2.6, sky: '#cfeaff', groundLight: '#3d5a24', hemiPower: 1.3, exposure: 1,
  },
  snow: {
    skyTop: '#6c7a8e', skyMid: '#a9b4c2', skyLow: '#d9dee5', fog: '#c3cad3', fogNear: 30, fogFar: 300,
    ground: '#e9eef4', sun: '#dfe8ff', sunPower: 1.2, sky: '#d4dcea', groundLight: '#8d97a6', hemiPower: 1.6, exposure: 1,
  },
  desert: {
    skyTop: '#5d8fc4', skyMid: '#e6b97e', skyLow: '#f6c98a', fog: '#e8bd86', fogNear: 60, fogFar: 520,
    ground: '#d9a25e', sun: '#ffd9a0', sunPower: 2.4, sky: '#ffe2b8', groundLight: '#a8703a', hemiPower: 1.2, exposure: 1,
  },
};

// Small seeded random numbers, so a scenario looks the same every time.
function random(seed) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/* ---------- Canvas textures ---------- */

function canvasTexture(width, height, draw, repeat = true) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  texture.anisotropy = 4;
  return texture;
}

function speckle(ctx, width, height, colors, count, size, rand) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(rand() * width, rand() * height, size * (0.5 + rand()), size * (0.5 + rand()));
  }
}

// The road surface, across (u) and along (v, one tile every 16 m).
function roadTexture(scenario) {
  const rand = random(7);
  return canvasTexture(256, 512, (ctx, w, h) => {
    if (scenario === 'jungle') {
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, ['#7a4c2a', '#9b6a40', '#6e4426', '#a77748'], 2600, 4, rand);
      // Two worn tire tracks.
      ctx.fillStyle = 'rgba(60, 35, 18, 0.35)';
      ctx.fillRect(w * 0.25, 0, w * 0.12, h);
      ctx.fillRect(w * 0.63, 0, w * 0.12, h);
      ctx.fillStyle = 'rgba(70, 110, 40, 0.5)';
      ctx.fillRect(0, 0, 10, h);
      ctx.fillRect(w - 10, 0, 10, h);
      return;
    }
    let base = '#3a3a44';
    let flecks = ['#34343d', '#42424c', '#2f2f37', '#4a4a55'];
    if (scenario === 'wasteland') {
      base = '#55534f';
      flecks = ['#4b4945', '#605d58', '#43413d', '#6a665f'];
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, flecks, 3000, 3, rand);
    if (scenario === 'wasteland') {
      // Cracks, and faded lines.
      ctx.strokeStyle = 'rgba(25, 22, 20, 0.7)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i += 1) {
        let x = rand() * w;
        let y = rand() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let step = 0; step < 6; step += 1) {
          x += (rand() - 0.5) * 50;
          y += (rand() - 0.2) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(230, 220, 190, 0.35)';
      ctx.fillRect(w / 2 - 4, 0, 8, h * 0.4);
      ctx.fillRect(10, 0, 6, h);
      ctx.fillRect(w - 16, 0, 6, h);
      return;
    }
    // City: crisp white edges and a dashed middle line.
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(8, 0, 7, h);
    ctx.fillRect(w - 15, 0, 7, h);
    ctx.fillRect(w / 2 - 4, 0, 8, h * 0.45);
  });
}

function stripesTexture(first, second) {
  return canvasTexture(16, 64, (ctx, w, h) => {
    ctx.fillStyle = first;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = second;
    ctx.fillRect(0, 0, w, h / 2);
  });
}

function checkerTexture() {
  return canvasTexture(128, 32, (ctx, w, h) => {
    const size = 8;
    for (let x = 0; x < w; x += size) {
      for (let y = 0; y < h; y += size) {
        ctx.fillStyle = (x / size + y / size) % 2 === 0 ? '#ffffff' : '#111111';
        ctx.fillRect(x, y, size, size);
      }
    }
  });
}

// Building walls: a grid of windows. The "lit" version only has the bright
// windows, used as the glow.
function windowTextures() {
  const rand = random(11);
  const lit = [];
  for (let i = 0; i < 64; i += 1) {
    lit.push(rand() < 0.42);
  }
  const draw = (glowOnly) => (ctx, w, h) => {
    ctx.fillStyle = glowOnly ? '#000000' : '#8d8a9a';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const on = lit[row * 8 + col];
        if (glowOnly && !on) {
          continue;
        }
        let color = '#1c2233';
        if (on) {
          color = ['#ffd98a', '#ffe9b8', '#9fe3ff', '#ffc070'][(row + col) % 4];
        }
        ctx.fillStyle = color;
        ctx.fillRect(col * 16 + 3, row * 16 + 4, 10, 9);
      }
    }
    // The bottom-left corner stays plain wall, for roofs.
    ctx.fillStyle = glowOnly ? '#000000' : '#8d8a9a';
    ctx.fillRect(0, 0, 3, 3);
  };
  return { map: canvasTexture(128, 128, draw(false)), glow: canvasTexture(128, 128, draw(true)) };
}

function glowTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }, false);
}

function beamTexture() {
  return canvasTexture(4, 64, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }, false);
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

// Many boxes (or other shapes) merged into one mesh with per-piece colors:
// one draw call for a whole city block or forest.
class Batch {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = [];
    this.indices = [];
  }

  add(geometry, matrix, color, uvScale = null) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    const offset = this.positions.length / 3;
    const vector = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const tint = new THREE.Color(color);
    for (let i = 0; i < position.count; i += 1) {
      vector.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.positions.push(vector.x, vector.y, vector.z);
      vector.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
      this.normals.push(vector.x, vector.y, vector.z);
      this.colors.push(tint.r, tint.g, tint.b);
      if (uv && uvScale) {
        const scaled = uvScale(i, uv.getX(i), uv.getY(i));
        this.uvs.push(scaled[0], scaled[1]);
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

  mesh(material) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    return new THREE.Mesh(geometry, material);
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

/* ---------- Where scenery can go ---------- */

class Clearance {
  constructor(samples) {
    // Every few meters is enough to know if a spot is on the road.
    this.points = samples.filter((sample, i) => i % 3 === 0);
  }

  // Nearest road point to (x, z): { sample, distance }.
  nearest(x, z) {
    let best = null;
    let bestDistance = Infinity;
    this.points.forEach((sample) => {
      const distance = (sample.x - x) ** 2 + (sample.z - z) ** 2;
      if (distance < bestDistance) {
        best = sample;
        bestDistance = distance;
      }
    });
    return { sample: best, distance: Math.sqrt(bestDistance) };
  }

  isClear(x, z, radius) {
    return this.points.every((sample) => (sample.x - x) ** 2 + (sample.z - z) ** 2 > (HALF + 3 + radius) ** 2);
  }
}

// Spots on both sides of the road, every `step` meters, `from`–`to`
// meters beyond the edge. Spots that would sit on another part of the
// road are skipped.
function roadsideSpots(samples, clearance, rand, { step, from, to, radius, sides = [1, -1] }) {
  const spots = [];
  const stride = Math.max(1, Math.round(step / 2));
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

/* ---------- Scenery for each scenario ---------- */

function buildCity(group, samples, clearance, groundY) {
  const rand = random(101);
  const windows = windowTextures();
  windows.map.repeat.set(1, 1);
  const buildings = new Batch();
  const tints = ['#6b6f9a', '#7a6a9a', '#5f7aa0', '#8a7aa8', '#68608a', '#7d8ab0'];
  const neon = new Batch();
  const neonColors = ['#ff3fa4', '#35f2ff', '#a45bff', '#ffd23f', '#39ff88'];
  const addBuilding = (spot, width, depth, height, withSign) => {
    const y = groundY(spot.x, spot.z) - 0.5;
    buildings.add(UNIT_BOX, place(spot.x, y, spot.z, spot.yaw, width, height, depth), tints[Math.floor(rand() * tints.length)], (i, u, v) => {
      // Faces 2 and 3 are the roof and floor: plain wall color.
      const face = Math.floor(i / 4);
      if (face === 2 || face === 3) {
        return [0.005, 0.005];
      }
      let across = width;
      if (face === 0 || face === 1) {
        across = depth;
      }
      return [u * across / 9, v * height / 9];
    });
    if (!withSign || rand() < 0.45) {
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
    ), neonColors[Math.floor(rand() * neonColors.length)]);
  };
  roadsideSpots(samples, clearance, rand, { step: 26, from: 6, to: 14, radius: 12 }).forEach((spot) => {
    addBuilding(spot, 14 + rand() * 12, 14 + rand() * 14, 18 + rand() * 50, true);
  });
  roadsideSpots(samples, clearance, rand, { step: 34, from: 40, to: 80, radius: 16 }).forEach((spot) => {
    addBuilding(spot, 18 + rand() * 14, 18 + rand() * 14, 50 + rand() * 80, false);
  });
  const buildingMaterial = new THREE.MeshLambertMaterial({
    map: windows.map,
    emissiveMap: windows.glow,
    emissive: 0xffffff,
    emissiveIntensity: 1.1,
    vertexColors: true,
  });
  group.add(buildings.mesh(buildingMaterial));

  // Street lights along both edges.
  const poles = new Batch();
  const bulbs = new Batch();
  roadsideSpots(samples, clearance, rand, { step: 36, from: 1.6, to: 1.6, radius: 0.3 }).forEach((spot) => {
    const y = spot.sample.y;
    poles.add(UNIT_BOX, place(spot.x, y, spot.z, spot.yaw, 0.3, 9, 0.3), '#3b3a48');
    const armX = spot.x - spot.sample.nx * spot.side * 1.6;
    const armZ = spot.z - spot.sample.nz * spot.side * 1.6;
    poles.add(UNIT_BOX, place((spot.x + armX) / 2, y + 8.8, (spot.z + armZ) / 2, spot.yaw + Math.PI / 2, 0.2, 0.2, 3.2), '#3b3a48');
    bulbs.add(UNIT_BOX, place(armX, y + 8.5, armZ, spot.yaw, 0.9, 0.25, 0.5), '#fff3c8');
  });
  group.add(poles.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
  group.add(bulbs.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  group.add(neon.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
}

function addTree(batch, rand, x, y, z, scale) {
  const trunk = new THREE.CylinderGeometry(0.35, 0.6, 1, 6);
  trunk.translate(0, 0.5, 0);
  const height = (6 + rand() * 6) * scale;
  batch.add(trunk, place(x, y, z, 0, scale, height, scale), '#5b3b22');
  const leaves = new THREE.IcosahedronGeometry(1, 0);
  const greens = ['#2f8f2f', '#3fa53a', '#2a7a2c', '#4cb043', '#226b28'];
  const blobs = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < blobs; i += 1) {
    const size = (2.6 + rand() * 2.2) * scale;
    batch.add(leaves, place(
      x + (rand() - 0.5) * 2.5 * scale,
      y + height - 0.5 + rand() * 2 * scale,
      z + (rand() - 0.5) * 2.5 * scale,
      rand() * 6, size, size * 0.8, size,
    ), greens[Math.floor(rand() * greens.length)]);
  }
}

function addPalm(batch, rand, x, y, z, scale) {
  const height = (8 + rand() * 5) * scale;
  const lean = (rand() - 0.5) * 0.4;
  const yaw = rand() * Math.PI * 2;
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 1, 6);
  trunk.translate(0, 0.5, 0);
  batch.add(trunk, place(x, y, z, yaw, scale, height, scale, lean), '#7a5a36');
  const topX = x + Math.sin(yaw) * Math.sin(lean) * height;
  const topZ = z + Math.cos(yaw) * Math.sin(lean) * height;
  const leaf = new THREE.ConeGeometry(0.9, 6, 4);
  leaf.translate(0, 3, 0);
  for (let i = 0; i < 7; i += 1) {
    batch.add(leaf, place(topX, y + height * Math.cos(lean), topZ, (i / 7) * Math.PI * 2 + rand() * 0.3, scale, scale, scale * 0.35, 1.9 + rand() * 0.4), i % 2 ? '#3d9a35' : '#2f8a2c');
  }
}

function buildJungle(group, samples, clearance, groundY) {
  const rand = random(202);
  const plants = new Batch();
  roadsideSpots(samples, clearance, rand, { step: 9, from: 2, to: 30, radius: 3 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z) - 0.2;
    if (rand() < 0.4) {
      addPalm(plants, rand, spot.x, y, spot.z, 0.8 + rand() * 0.5);
    } else {
      addTree(plants, rand, spot.x, y, spot.z, 0.8 + rand() * 0.6);
    }
  });
  roadsideSpots(samples, clearance, rand, { step: 16, from: 32, to: 110, radius: 4 }).forEach((spot) => {
    addTree(plants, rand, spot.x, groundY(spot.x, spot.z) - 0.2, spot.z, 1.2 + rand() * 0.8);
  });
  // Bushes and rocks right at the roadside.
  const bush = new THREE.IcosahedronGeometry(1, 0);
  const rock = new THREE.DodecahedronGeometry(1, 0);
  roadsideSpots(samples, clearance, rand, { step: 7, from: 0.6, to: 3, radius: 1 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z);
    const size = 0.8 + rand() * 1.3;
    if (rand() < 0.3) {
      plants.add(rock, place(spot.x, y, spot.z, rand() * 6, size, size * 0.7, size), '#7d8572');
      return;
    }
    plants.add(bush, place(spot.x, y, spot.z, rand() * 6, size * 1.3, size, size * 1.3), rand() < 0.5 ? '#3a9a3a' : '#57b84a');
  });
  group.add(plants.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

  // Ancient stone: gateways over the road and stepped temples in the trees.
  const stone = new Batch();
  [0.2, 0.55, 0.82].forEach((t) => {
    const sample = samples[Math.floor(t * samples.length)];
    const yaw = Math.atan2(sample.dx, sample.dz);
    [-1, 1].forEach((side) => {
      const x = sample.x + sample.nx * side * (HALF + 2.2);
      const z = sample.z + sample.nz * side * (HALF + 2.2);
      stone.add(UNIT_BOX, place(x, sample.y - 1, z, yaw, 2.4, 12, 2.4), '#9b9580');
      stone.add(UNIT_BOX, place(x, sample.y + 11, z, yaw, 3, 1.2, 3), '#8a846f');
    });
    stone.add(UNIT_BOX, place(sample.x, sample.y + 11.4, sample.z, yaw + Math.PI / 2, 2.2, 2, ROAD_WIDTH + 8), '#a49e88');
    stone.add(UNIT_BOX, place(sample.x, sample.y + 10.9, sample.z, yaw + Math.PI / 2, 1, 0.6, ROAD_WIDTH + 4), '#4f8d3a');
  });
  roadsideSpots(samples, clearance, rand, { step: 260, from: 45, to: 70, radius: 26 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z) - 1;
    for (let level = 0; level < 6; level += 1) {
      const size = 36 - level * 5.5;
      stone.add(UNIT_BOX, place(spot.x, y + level * 4, spot.z, spot.yaw, size, 4, size), level % 2 ? '#a39c84' : '#948d76');
    }
    stone.add(UNIT_BOX, place(spot.x, y + 24, spot.z, spot.yaw, 6, 6, 6), '#857e68');
  });
  group.add(stone.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
}

function addRuin(batch, rand, x, y, z, yaw, snowy) {
  const wall = snowy ? ['#4c4f57', '#5d5f66', '#45464d'] : ['#9a7a5a', '#86684c', '#a88866'];
  let width = 12 + rand() * 14;
  let depth = 12 + rand() * 12;
  let height = 10 + rand() * 30;
  let base = y - 0.5;
  const floors = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < floors; i += 1) {
    batch.add(UNIT_BOX, place(x + (rand() - 0.5) * 3, base, z + (rand() - 0.5) * 3, yaw, width, height, depth, 0, (rand() - 0.5) * 0.06), wall[i % wall.length]);
    if (snowy) {
      batch.add(UNIT_BOX, place(x, base + height, z, yaw, width * 0.92, 0.6, depth * 0.92), '#f4f7fb');
    }
    base += height;
    width *= 0.5 + rand() * 0.3;
    depth *= 0.5 + rand() * 0.3;
    height *= 0.4 + rand() * 0.4;
  }
}

function addWreck(batch, rand, x, y, z, yaw) {
  const rust = ['#7a3f22', '#5e4a3a', '#8c5a2e', '#4a5560'][Math.floor(rand() * 4)];
  const tilt = (rand() - 0.5) * 0.5;
  batch.add(UNIT_BOX, place(x, y, z, yaw, 2, 1, 4.4, 0, tilt), rust);
  batch.add(UNIT_BOX, place(x, y + 0.9, z - 0.3, yaw, 1.7, 0.7, 2.2, 0, tilt), '#2b2b30');
}

function buildWasteland(group, samples, clearance, groundY) {
  const rand = random(303);
  const ruins = new Batch();
  roadsideSpots(samples, clearance, rand, { step: 22, from: 5, to: 40, radius: 12 }).forEach((spot) => {
    const snowy = snowiness(spot.sample.t) > 0.5;
    const y = groundY(spot.x, spot.z);
    if (snowy) {
      addRuin(ruins, rand, spot.x, y, spot.z, spot.yaw + (rand() - 0.5) * 0.3, true);
      return;
    }
    // The desert: tall rock mesas, broken pylons and sand dunes.
    if (rand() < 0.3) {
      addRuin(ruins, rand, spot.x, y, spot.z, spot.yaw, false);
      return;
    }
    const dune = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const size = 10 + rand() * 18;
    ruins.add(dune, place(spot.x, y - 1, spot.z, rand() * 6, size * 1.6, size * 0.35, size), '#d6a15c');
  });
  const mesa = new THREE.CylinderGeometry(0.8, 1, 1, 7);
  mesa.translate(0, 0.5, 0);
  roadsideSpots(samples, clearance, rand, { step: 120, from: 80, to: 160, radius: 30 }).forEach((spot) => {
    if (snowiness(spot.sample.t) > 0.5) {
      return;
    }
    const size = 20 + rand() * 25;
    ruins.add(mesa, place(spot.x, groundY(spot.x, spot.z) - 2, spot.z, rand() * 6, size, 25 + rand() * 40, size), '#b5653a');
  });
  roadsideSpots(samples, clearance, rand, { step: 30, from: 0.8, to: 4, radius: 2.5 }).forEach((spot) => {
    const y = groundY(spot.x, spot.z);
    if (rand() < 0.6) {
      addWreck(ruins, rand, spot.x, y, spot.z, spot.yaw + (rand() - 0.5) * 1.5);
      return;
    }
    // A bent lamp post.
    ruins.add(UNIT_BOX, place(spot.x, y, spot.z, spot.yaw, 0.3, 8, 0.3, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6), '#4a4744');
  });
  group.add(ruins.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
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
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
  geometry.translate(0, 0, -0.175);
  return geometry;
}

// The look of the points: gold coins in the city, emeralds in the jungle,
// glowing gears in the wasteland.
function pointLook(scenario) {
  if (scenario === 'jungle') {
    const geometry = new THREE.OctahedronGeometry(1.1, 0);
    geometry.scale(0.9, 1.5, 0.9);
    return {
      geometry,
      material: new THREE.MeshStandardMaterial({ color: 0x19e07a, emissive: 0x08a050, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.1, flatShading: true }),
      glow: 0x5dff9e,
    };
  }
  if (scenario === 'wasteland') {
    return {
      geometry: gearGeometry(),
      material: new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xc04a00, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.3 }),
      glow: 0xffa040,
    };
  }
  const coin = new THREE.CylinderGeometry(1.15, 1.15, 0.24, 32);
  coin.rotateX(Math.PI / 2);
  return {
    geometry: coin,
    material: new THREE.MeshStandardMaterial({ color: 0xffcf3a, emissive: 0x9a6a00, emissiveIntensity: 0.7, metalness: 1, roughness: 0.22 }),
    glow: 0xffe066,
  };
}

/* ---------- The whole scene ---------- */

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.3, 2500);

  // Studio light for reflections on the car paint.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-200, 300, 150);
  scene.add(sun);

  // The sky: a big sphere, colored from top to horizon.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color() },
      middle: { value: new THREE.Color() },
      low: { value: new THREE.Color() },
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 middle; uniform vec3 low; varying vec3 vDir; void main() { float h = vDir.y; vec3 color = h > 0.12 ? mix(middle, top, smoothstep(0.12, 0.6, h)) : mix(low, middle, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(color, 1.0); }',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMaterial);
  scene.add(sky);
  scene.fog = new THREE.Fog(0xffffff, 60, 500);

  // Snow for the wasteland: a box of flakes that follows the camera.
  const flakeCount = 1500;
  const flakePositions = new Float32Array(flakeCount * 3);
  const flakeRand = random(9);
  for (let i = 0; i < flakeCount; i += 1) {
    flakePositions[i * 3] = (flakeRand() - 0.5) * 120;
    flakePositions[i * 3 + 1] = flakeRand() * 50;
    flakePositions[i * 3 + 2] = (flakeRand() - 0.5) * 120;
  }
  const flakeGeometry = new THREE.BufferGeometry();
  flakeGeometry.setAttribute('position', new THREE.BufferAttribute(flakePositions, 3));
  const flakeMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0, depthWrite: false });
  const flakes = new THREE.Points(flakeGeometry, flakeMaterial);
  flakes.frustumCulled = false;
  scene.add(flakes);

  const glowMap = glowTexture();
  const beamMap = beamTexture();

  let world = null;
  let track = null;
  let look = LOOKS.city;
  let scenarioName = 'city';
  let points = [];

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
            if (value && value.isTexture && value !== glowMap && value !== beamMap) {
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

  function applyLook(next) {
    look = next;
    skyMaterial.uniforms.top.value.set(next.skyTop);
    skyMaterial.uniforms.middle.value.set(next.skyMid);
    skyMaterial.uniforms.low.value.set(next.skyLow);
    scene.fog.color.set(next.fog);
    scene.fog.near = next.fogNear;
    scene.fog.far = next.fogFar;
    sun.color.set(next.sun);
    sun.intensity = next.sunPower;
    hemisphere.color.set(next.sky);
    hemisphere.groundColor.set(next.groundLight);
    hemisphere.intensity = next.hemiPower;
    renderer.toneMappingExposure = next.exposure;
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
    const segments = 140;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const position = geometry.attributes.position;
    const colors = [];
    const rand = random(5);
    const base = new THREE.Color(look.ground);
    const sand = new THREE.Color(LOOKS.desert.ground);
    const snow = new THREE.Color(LOOKS.snow.ground);
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const { sample, distance } = clearance.nearest(x, z);
      const y = groundHeight(x, z, sample, distance);
      position.setY(i, y);
      let color = base.clone();
      if (scenarioName === 'wasteland') {
        color = sand.clone().lerp(snow, snowiness(sample.t));
      }
      const shade = 0.9 + rand() * 0.18;
      colors.push(color.r * shade, color.g * shade, color.b * shade);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const ground = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
    group.add(ground);
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

  function buildRoad(group, samples, length) {
    const surface = new THREE.MeshStandardMaterial({ map: roadTexture(scenarioName), roughness: 0.85, metalness: 0 });
    group.add(new THREE.Mesh(ribbon(samples, length, { side: HALF, up: 0.05 }, { side: -HALF, up: 0.05 }), surface));

    // A skirt below the edges hides any gap to the ground on slopes.
    const skirtMaterial = new THREE.MeshLambertMaterial({ color: scenarioName === 'jungle' ? 0x6e4426 : 0x2c2c33, side: THREE.DoubleSide });
    [1, -1].forEach((side) => {
      group.add(new THREE.Mesh(ribbon(samples, length, { side: side * (HALF + 1.2), up: 0.06 }, { side: side * (HALF + 1.6), up: -2 }), skirtMaterial));
    });

    // Striped curbs, then a low barrier with a glowing (city) or plain top.
    let stripes = stripesTexture('#ffffff', '#e3242b');
    let barrierColor = 0x9aa0ad;
    let topColor = 0x35f2ff;
    if (scenarioName === 'jungle') {
      stripes = stripesTexture('#e8d9a8', '#3f7d2c');
      barrierColor = 0x8a7a5a;
      topColor = 0x7cc46a;
    }
    if (scenarioName === 'wasteland') {
      stripes = stripesTexture('#d9d2c0', '#2b2b2b');
      barrierColor = 0x7a5238;
      topColor = 0xd07a3a;
    }
    const curbMaterial = new THREE.MeshLambertMaterial({ map: stripes });
    const barrierMaterial = new THREE.MeshLambertMaterial({ color: barrierColor, side: THREE.DoubleSide });
    let topMaterial = new THREE.MeshLambertMaterial({ color: topColor });
    if (scenarioName === 'city') {
      topMaterial = new THREE.MeshBasicMaterial({ color: topColor, toneMapped: false });
    }
    [1, -1].forEach((side) => {
      group.add(new THREE.Mesh(ribbon(samples, length, { side: side * HALF, up: 0.09 }, { side: side * (HALF + 1.2), up: 0.09 }, 4), curbMaterial));
      group.add(new THREE.Mesh(ribbon(samples, length, { side: side * (HALF + 1.2), up: 0 }, { side: side * (HALF + 1.2), up: 1 }), barrierMaterial));
      group.add(new THREE.Mesh(ribbon(samples, length, { side: side * (HALF + 1.2), up: 1 }, { side: side * (HALF + 1.45), up: 1 }), topMaterial));
    });

    // The start line and a gantry over it.
    const start = samples[0];
    const yaw = Math.atan2(start.dx, start.dz);
    const lineGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, 2.4);
    lineGeometry.rotateX(-Math.PI / 2);
    const line = new THREE.Mesh(lineGeometry, new THREE.MeshLambertMaterial({ map: checkerTexture() }));
    line.rotation.y = yaw;
    line.position.set(start.x, start.y + 0.08, start.z);
    group.add(line);
    const gantry = new Batch();
    [1, -1].forEach((side) => {
      gantry.add(UNIT_BOX, place(start.x + start.nx * side * (HALF + 2), start.y - 0.5, start.z + start.nz * side * (HALF + 2), yaw, 1, 10, 1), '#2b2b35');
    });
    gantry.add(UNIT_BOX, place(start.x, start.y + 8.5, start.z, yaw + Math.PI / 2, 1.2, 2, ROAD_WIDTH + 5), '#2b2b35');
    group.add(gantry.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH + 4, 1.6), new THREE.MeshBasicMaterial({ map: checkerTexture(), toneMapped: false, side: THREE.DoubleSide }));
    banner.rotation.y = yaw;
    banner.position.set(start.x, start.y + 9.5, start.z);
    group.add(banner);
  }

  function buildPoints(group, placed) {
    const { geometry, material, glow } = pointLook(scenarioName);
    const glowMaterial = new THREE.SpriteMaterial({ map: glowMap, color: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 });
    const beamMaterial = new THREE.MeshBasicMaterial({ map: beamMap, color: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const beamGeometry = new THREE.CylinderGeometry(0.6, 0.6, 26, 12, 1, true);
    beamGeometry.translate(0, 13, 0);
    points = placed.map((point) => {
      const sample = track.samples[point.index];
      const side = sideMeters(point.side);
      const holder = new THREE.Group();
      holder.position.set(sample.x + sample.nx * side, sample.y + 1.5, sample.z + sample.nz * side);
      const shape = new THREE.Mesh(geometry, material);
      holder.add(shape);
      const halo = new THREE.Sprite(glowMaterial);
      halo.scale.setScalar(5);
      holder.add(halo);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.y = -1.5;
      holder.add(beam);
      group.add(holder);
      return { holder, shape, halo, collected: false, pop: 0 };
    });
  }

  return {
    renderer,
    camera,
    scene,

    // Builds a scenario. Returns the track samples and length.
    setScenario(name) {
      disposeWorld();
      scenarioName = name;
      track = sampleTrack(CIRCUITS[name]);
      if (name === 'wasteland') {
        applyLook(LOOKS.snow);
      } else {
        applyLook(LOOKS[name]);
      }
      world = new THREE.Group();
      const clearance = new Clearance(track.samples);
      const groundY = (x, z) => {
        const { sample, distance } = clearance.nearest(x, z);
        return groundHeight(x, z, sample, distance);
      };
      buildGround(world, track.samples, clearance);
      buildRoad(world, track.samples, track.length);
      if (name === 'city') {
        buildCity(world, track.samples, clearance, groundY);
      }
      if (name === 'jungle') {
        buildJungle(world, track.samples, clearance, groundY);
      }
      if (name === 'wasteland') {
        buildWasteland(world, track.samples, clearance, groundY);
      }
      scene.add(world);
      return track;
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
      }
    },

    pointPosition(index) {
      return points[index]?.holder.position;
    },

    // Spin and bob the points, play the collect pop, follow the weather.
    animate(dt, time, carT, cameraPosition) {
      points.forEach((point, i) => {
        if (point.collected && point.pop === 0) {
          return;
        }
        point.shape.rotation.y = time * 2.2 + i;
        point.shape.position.y = Math.sin(time * 3 + i) * 0.3;
        if (point.pop > 0) {
          point.pop += dt * 3;
          point.holder.scale.setScalar(1 + point.pop * 1.5);
          point.holder.position.y += dt * 6;
          point.halo.material.opacity = Math.max(0, 0.85 - point.pop);
          if (point.pop >= 1) {
            point.holder.visible = false;
            point.pop = 0;
            point.halo.material.opacity = 0.85;
          }
        }
      });
      if (scenarioName === 'wasteland') {
        const amount = snowiness(carT);
        applyLook(blendLooks(LOOKS.desert, LOOKS.snow, amount));
        flakeMaterial.opacity = amount * 0.9;
        flakes.visible = amount > 0.01;
        const positions = flakeGeometry.attributes.position;
        for (let i = 0; i < flakeCount; i += 1) {
          let y = positions.getY(i) - dt * 4;
          if (y < 0) {
            y += 50;
          }
          positions.setY(i, y);
        }
        positions.needsUpdate = true;
        flakes.position.set(cameraPosition.x, cameraPosition.y - 15, cameraPosition.z);
      } else {
        flakes.visible = false;
      }
      sky.position.copy(cameraPosition);
    },

    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    render() {
      renderer.render(scene, camera);
    },
  };
}
