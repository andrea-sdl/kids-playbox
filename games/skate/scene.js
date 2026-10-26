// The 3D world for each park: sky, the park itself (floor, quarter pipes,
// ramps, boxes, stairs, rails, fences) and everything around it, from city
// blocks to an anime seaside town, snowy peaks and a desert oasis. All of
// it is built in code, so it works offline.

import * as THREE from '../../vendor/three/three.min.js';
import { HALF_D, HALF_W, QP_HEIGHT, QP_RADIUS, QP_TOP, buildPark, kickerHeight } from './world.js';
import {
  bumpTexture,
  floorTexture,
  graffitiTexture,
  letterTexture,
  rampTexture,
  random,
  softDotTexture,
  windowsTexture,
} from './textures.js';
import { createEffects } from './effects.js';

function pickQuality() {
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (small || touch) {
    return { maxRatio: Math.min(window.devicePixelRatio, 2), minRatio: 0.75, shadowSize: 1024, antialias: false };
  }
  return { maxRatio: Math.min(window.devicePixelRatio, 2), minRatio: 1, shadowSize: 2048, antialias: true };
}

// Sky, light and air for each park. Elevations are in degrees.
const LOOKS = {
  city: {
    top: '#3b7fd6', horizon: '#cfe6f7', bottom: '#8f949c', fog: '#cddceb', fogDensity: 0.0032,
    sunElevation: 38, sunAzimuth: 210, sunColor: '#fff0d8', sunSize: 0.03, sunPower: 2.8,
    hemiSky: '#cfe2ff', hemiGround: '#6e6a66', hemiPower: 1.15, clouds: 0.35, exposure: 1,
  },
  sea: {
    top: '#1559d8', horizon: '#a8dcff', bottom: '#1d6fd6', fog: '#a9d6fa', fogDensity: 0.0007,
    sunElevation: 50, sunAzimuth: 200, sunColor: '#fff6e6', sunSize: 0.028, sunPower: 2.5,
    hemiSky: '#bfe2ff', hemiGround: '#6f8f5a', hemiPower: 1.05, clouds: 0.6, exposure: 0.95,
  },
  mountain: {
    top: '#3f86dc', horizon: '#e2eef9', bottom: '#d5dfec', fog: '#e4edf6', fogDensity: 0.0016,
    sunElevation: 30, sunAzimuth: 150, sunColor: '#fff6ea', sunSize: 0.03, sunPower: 2.4,
    hemiSky: '#dfeaff', hemiGround: '#7d8ba3', hemiPower: 0.95, clouds: 0.3, exposure: 0.88,
  },
  desert: {
    top: '#2b78cf', horizon: '#ffe2b4', bottom: '#d6a565', fog: '#f1d6a8', fogDensity: 0.0019,
    sunElevation: 48, sunAzimuth: 230, sunColor: '#ffe6bf', sunSize: 0.032, sunPower: 3.2,
    hemiSky: '#ffe8c8', hemiGround: '#b57d43', hemiPower: 1.15, clouds: 0.18, exposure: 1,
  },
};

// The park's own colors: the sides of ramps and boxes, box tops, metal
// edges, rails and fences.
const PALETTES = {
  city: { side: '#a8a49d', top: '#cfccc6', coping: '#cfd5de', rail: '#ffd23f', fence: '#6d7380', post: '#55595f' },
  sea: { side: '#8ec1ea', top: '#f3eee2', coping: '#f4f6f8', rail: '#e04a3a', fence: '#f7f7f2', post: '#f7f7f2' },
  mountain: { side: '#dfe7f2', top: '#3a8dff', coping: '#2f7bff', rail: '#ff5fb4', fence: '#ff7a1a', post: '#3a3f4a' },
  desert: { side: '#c48f55', top: '#d7aa70', coping: '#9a6a3c', rail: '#7a4a28', fence: '#c9a26a', post: '#6b4423' },
};

const LETTER_COLORS = ['#ff3fa4', '#ffd23f', '#35f2ff', '#7cff6a', '#ff8a3a'];

function direction(elevation, azimuth) {
  const up = THREE.MathUtils.degToRad(elevation);
  const around = THREE.MathUtils.degToRad(azimuth);
  return new THREE.Vector3(Math.cos(up) * Math.sin(around), Math.sin(up), Math.cos(up) * Math.cos(around));
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
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

const SKY_FRAGMENT = `
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 bottom;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform float sunSize;
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
    vec3 color = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.7, h), 0.6)) : mix(horizon, bottom, smoothstep(0.0, -0.15, h));
    float facing = max(dot(dir, sunDir), 0.0);
    color += sunColor * (pow(facing, 8.0) * 0.35 + pow(facing, 80.0) * 0.6);
    float disc = smoothstep(cos(sunSize), cos(sunSize * 0.7), facing);
    color += sunColor * disc * 6.0;
    if (h > 0.0) {
      vec2 uv = dir.xz / (h + 0.2) * 1.4 + vec2(time * 0.005, 0.0);
      float shape = fbm(uv);
      float cover = smoothstep(0.58 - clouds * 0.3, 0.8, shape) * clouds * smoothstep(0.0, 0.2, h);
      // Bright tops, soft blue-gray bellies: cartoon clouds.
      vec3 cloudColor = mix(vec3(0.82, 0.88, 0.96), vec3(1.0), smoothstep(0.55, 0.85, shape));
      color = mix(color, cloudColor, cover);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ---------- Building helpers ---------- */

// Many shapes merged into one mesh with a color per shape: one draw call.
class Props {
  constructor() {
    this.parts = [];
  }

  add(geometry, matrix, color) {
    const part = geometry.clone();
    part.applyMatrix4(matrix);
    const tint = new THREE.Color(color);
    const count = part.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!part.attributes.uv) {
      part.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    this.parts.push(part);
  }

  mesh(material, { cast = true, receive = true } = {}) {
    if (this.parts.length === 0) {
      return null;
    }
    const indexed = this.parts.map((part) => (part.index ? part : indexedCopy(part)));
    const geometry = THREE.mergeGeometries(indexed);
    this.parts.forEach((part) => part.dispose());
    indexed.forEach((part) => part.dispose());
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    return mesh;
  }
}

function indexedCopy(geometry) {
  const copy = geometry.clone();
  const count = copy.attributes.position.count;
  copy.setIndex([...Array(count).keys()]);
  return copy;
}

const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const euler = new THREE.Euler();
const scaleVector = new THREE.Vector3();
const spot = new THREE.Vector3();

function place(x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1, tilt = 0) {
  euler.set(tilt, yaw, 0, 'YXZ');
  quaternion.setFromEuler(euler);
  return matrix.compose(spot.set(x, y, z), quaternion, scaleVector.set(sx, sy, sz)).clone();
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const CONE = new THREE.ConeGeometry(0.5, 1, 10);
const ROOF = new THREE.ConeGeometry(0.72, 1, 4);
ROOF.rotateY(Math.PI / 4);
const SPHERE = new THREE.SphereGeometry(0.5, 12, 8);
const SHARED = new Set([BOX, CYLINDER, CONE, ROOF, SPHERE]);

// A box with windows that repeat every 4 m across and 3.5 m up.
function buildingGeometry(width, height, depth) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.attributes.uv;
  const spans = [depth, depth, 0, 0, width, width];
  for (let face = 0; face < 6; face += 1) {
    for (let i = face * 4; i < face * 4 + 4; i += 1) {
      if (spans[face] === 0) {
        uv.setXY(i, 0.03, 0.97);
      } else {
        uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(spans[face] / 4)), uv.getY(i) * Math.max(1, Math.round(height / 3.5)));
      }
    }
  }
  return geometry;
}

// A strip from a list of 2D profile points (d outward, h up), run along a
// line from `start` to `end` (in meters along the side).
function profileStrip(profile, start, end, uvScale = 4) {
  const positions = [];
  const uvs = [];
  const indices = [];
  let arc = 0;
  profile.forEach(([d, h], i) => {
    if (i > 0) {
      arc += Math.hypot(d - profile[i - 1][0], h - profile[i - 1][1]);
    }
    positions.push(start, h, d, end, h, d);
    uvs.push(start / uvScale, arc / uvScale, end / uvScale, arc / uvScale);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/* ---------- The scene ---------- */

export function createScene(container) {
  const quality = pickQuality();
  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
  let pixelRatio = quality.maxRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 3200);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 300 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
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
      clouds: { value: 0 },
      time: { value: 0 },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.FogExp2(0xffffff, 0.003);

  // Reflections on water, metal and boards come from the sky itself.
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environment = null;
  function updateEnvironment() {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial);
    envScene.add(envSky);
    const next = pmrem.fromScene(envScene, 0, 0.1, 200).texture;
    environment?.dispose();
    environment = next;
    scene.environment = environment;
    envSky.geometry.dispose();
  }

  const dot = softDotTexture();
  const effects = createEffects(scene, dot);

  // Weather: snow in the mountains, cherry petals by the sea, blowing sand
  // in the desert. Points in a box that follows the camera.
  const weatherCount = 1400;
  const weatherPositions = new Float32Array(weatherCount * 3);
  const weatherRand = random(9);
  for (let i = 0; i < weatherCount; i += 1) {
    weatherPositions[i * 3] = (weatherRand() - 0.5) * 90;
    weatherPositions[i * 3 + 1] = weatherRand() * 40;
    weatherPositions[i * 3 + 2] = (weatherRand() - 0.5) * 90;
  }
  const weatherGeometry = new THREE.BufferGeometry();
  weatherGeometry.setAttribute('position', new THREE.BufferAttribute(weatherPositions, 3));
  const weatherMaterial = new THREE.PointsMaterial({ color: 0xffffff, map: dot, size: 0.4, transparent: true, opacity: 0.9, depthWrite: false });
  const weather = new THREE.Points(weatherGeometry, weatherMaterial);
  weather.frustumCulled = false;
  scene.add(weather);
  const WEATHER = {
    mountain: { color: '#ffffff', size: 0.38, fall: 2.6, drift: 0.6, opacity: 0.95 },
    sea: { color: '#ffb7d2', size: 0.3, fall: 1.1, drift: 2.2, opacity: 0.95 },
    desert: { color: '#f3d29b', size: 0.14, fall: 0.2, drift: 7, opacity: 0.6 },
  };

  let world = null;
  let scenarioName = 'city';
  let park = null;
  let letters = [];
  let water = [];
  let width = 1;
  let height = 1;
  const owned = new Set();

  function own(thing) {
    owned.add(thing);
    return thing;
  }

  function texture(made, repeatX = 1, repeatY = repeatX) {
    made.repeat.set(repeatX, repeatY);
    made.anisotropy = anisotropy;
    return own(made);
  }

  function disposeWorld() {
    if (!world) {
      return;
    }
    scene.remove(world);
    world.traverse((object) => {
      if (object.geometry && !SHARED.has(object.geometry)) {
        object.geometry.dispose();
      }
      [object.material].flat().forEach((material) => material?.dispose());
    });
    owned.forEach((thing) => thing.dispose());
    owned.clear();
    world = null;
    letters = [];
    water = [];
  }

  function applyLook(look) {
    const uniforms = skyMaterial.uniforms;
    uniforms.top.value.set(look.top);
    uniforms.horizon.value.set(look.horizon);
    uniforms.bottom.value.set(look.bottom);
    uniforms.sunDir.value.copy(direction(look.sunElevation, look.sunAzimuth));
    uniforms.sunColor.value.set(look.sunColor);
    uniforms.sunSize.value = look.sunSize;
    uniforms.clouds.value = look.clouds;
    scene.fog.color.set(look.fog);
    scene.fog.density = look.fogDensity;
    lightDirection = direction(look.sunElevation, look.sunAzimuth);
    sun.color.set(look.sunColor);
    sun.intensity = look.sunPower;
    hemisphere.color.set(look.hemiSky);
    hemisphere.groundColor.set(look.hemiGround);
    hemisphere.intensity = look.hemiPower;
    renderer.toneMappingExposure = look.exposure;
  }

  /* ---------- The park ---------- */

  function surfaceMaterial(map, options = {}) {
    return new THREE.MeshStandardMaterial({ map, roughness: 0.85, ...options });
  }

  function buildPark3d(group) {
    const palette = PALETTES[scenarioName];
    const ramp = texture(rampTexture(scenarioName));
    const rampMat = surfaceMaterial(ramp, { roughness: scenarioName === 'mountain' ? 0.6 : 0.8 });
    const sideMat = new THREE.MeshStandardMaterial({ color: palette.side, roughness: 0.9 });
    const topMat = new THREE.MeshStandardMaterial({ color: palette.top, roughness: 0.7 });
    const metal = new THREE.MeshStandardMaterial({ color: palette.coping, roughness: 0.3, metalness: 0.85 });
    const railMat = new THREE.MeshStandardMaterial({ color: palette.rail, roughness: 0.35, metalness: scenarioName === 'desert' ? 0 : 0.5 });

    // The floor, including under the quarter pipes.
    const floorSize = { x: (HALF_W + QP_TOP + 3) * 2, z: (HALF_D + QP_TOP + 3) * 2 };
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(floorSize.x, floorSize.z),
      surfaceMaterial(texture(floorTexture(scenarioName), floorSize.x / 8, floorSize.z / 8), { roughness: scenarioName === 'mountain' ? 0.55 : 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    // Quarter pipes: the curve, a deck on top and a back wall.
    const steps = 16;
    const angleTop = Math.asin(QP_TOP / QP_RADIUS);
    const profile = [];
    for (let i = 0; i <= steps; i += 1) {
      const angle = (i / steps) * angleTop;
      profile.push([QP_RADIUS * Math.sin(angle), QP_RADIUS * (1 - Math.cos(angle))]);
    }
    const deck = [[QP_TOP, QP_HEIGHT], [QP_TOP + 3, QP_HEIGHT], [QP_TOP + 3, 0]];
    const sides = park.spec.sides;
    const FRAMES = {
      north: { edge: HALF_D, span: HALF_W, before: 'east', after: 'west', yaw: Math.PI },
      south: { edge: HALF_D, span: HALF_W, before: 'west', after: 'east', yaw: 0 },
      west: { edge: HALF_W, span: HALF_D, before: 'north', after: 'south', yaw: -Math.PI / 2 },
      east: { edge: HALF_W, span: HALF_D, before: 'south', after: 'north', yaw: Math.PI / 2 },
    };
    park.quarterPipes.forEach((side) => {
      const frame = FRAMES[side];
      const reach = (neighbor) => (sides[neighbor] === 'qp' ? QP_TOP + 3 : 0);
      const start = -frame.span - reach(frame.before);
      const end = frame.span + reach(frame.after);
      // Built facing +z (outward), then turned to its side.
      const holder = new THREE.Group();
      holder.rotation.y = frame.yaw;
      const curve = new THREE.Mesh(profileStrip(profile, start, end), rampMat);
      const top = new THREE.Mesh(profileStrip(deck, start, end), sideMat);
      [curve, top].forEach((mesh) => {
        mesh.position.z = frame.edge;
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        holder.add(mesh);
      });
      const coping = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, end - start, 10), metal);
      coping.rotation.z = Math.PI / 2;
      coping.position.set((start + end) / 2, QP_HEIGHT, frame.edge + QP_TOP);
      holder.add(coping);
      // Closed ends where the wall meets a fence.
      [[frame.before, start], [frame.after, end]].forEach(([neighbor, at]) => {
        if (sides[neighbor] === 'qp') {
          return;
        }
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        profile.forEach(([d, h]) => shape.lineTo(d, h));
        shape.lineTo(QP_TOP + 3, QP_HEIGHT);
        shape.lineTo(QP_TOP + 3, 0);
        shape.lineTo(0, 0);
        const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: palette.side, roughness: 0.9, side: THREE.DoubleSide }));
        // Shape x is outward (z here), shape y is up.
        cap.rotation.y = -Math.PI / 2;
        cap.position.set(at, 0, frame.edge);
        holder.add(cap);
      });
      group.add(holder);
    });

    // Ramps, boxes, stairs and rails.
    park.pieces.forEach((piece) => {
      if (piece.type === 'kicker') {
        group.add(kickerMesh(piece, rampMat, sideMat, metal));
      }
      if (piece.type === 'box') {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(piece.w, piece.h, piece.l), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
        mesh.position.set(piece.x, piece.h / 2, piece.z);
        mesh.rotation.y = piece.yaw;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        if (piece.grind) {
          [-1, 1].forEach((side) => {
            const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, piece.l), metal);
            edge.position.set(side * (piece.w / 2 - 0.02), piece.h - 0.02, 0);
            mesh.add(edge);
          });
        }
      }
      if (piece.type === 'stairs') {
        const tread = piece.l / piece.steps;
        for (let k = 0; k < piece.steps - 1; k += 1) {
          const rise = piece.top * (1 - (k + 1) / piece.steps);
          const step = new THREE.Mesh(new THREE.BoxGeometry(piece.w, rise, tread), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
          const u = -piece.l / 2 + (k + 0.5) * tread;
          step.position.set(piece.x + piece.sin * u, rise / 2, piece.z + piece.cos * u);
          step.rotation.y = piece.yaw;
          step.castShadow = true;
          step.receiveShadow = true;
          group.add(step);
        }
      }
      if (piece.type === 'rail') {
        group.add(railMesh(piece, railMat));
      }
    });

    buildFences(group, palette);
  }

  function kickerMesh(piece, rampMat, sideMat, metal) {
    const holder = new THREE.Group();
    holder.position.set(piece.x, 0, piece.z);
    holder.rotation.y = piece.yaw;
    const segments = 12;
    const positions = [];
    const uvs = [];
    const indices = [];
    const outline = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const u = -piece.l / 2 + t * piece.l;
      const h = kickerHeight(piece.h, t);
      outline.push([u, h]);
      positions.push(-piece.w / 2, h, u, piece.w / 2, h, u);
      uvs.push(0, t * piece.l / 4, piece.w / 4, t * piece.l / 4);
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const surface = new THREE.BufferGeometry();
    surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    surface.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    surface.setIndex(indices);
    surface.computeVertexNormals();
    const top = new THREE.Mesh(surface, rampMat);
    top.castShadow = true;
    top.receiveShadow = true;
    holder.add(top);
    const shape = new THREE.Shape();
    shape.moveTo(-piece.l / 2, 0);
    outline.forEach(([u, h]) => shape.lineTo(u, h));
    shape.lineTo(piece.l / 2, 0);
    const sideGeometry = new THREE.ShapeGeometry(shape);
    const sideMaterial = sideMat.clone();
    sideMaterial.side = THREE.DoubleSide;
    [-1, 1].forEach((side) => {
      const wall = new THREE.Mesh(sideGeometry, sideMaterial);
      // Shape x runs along the ramp (local z).
      wall.rotation.y = -Math.PI / 2;
      wall.position.x = (side * piece.w) / 2;
      wall.castShadow = true;
      holder.add(wall);
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(piece.w, piece.h), sideMaterial);
    back.position.set(0, piece.h / 2, piece.l / 2);
    holder.add(back);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, piece.w, 8), metal);
    lip.rotation.z = Math.PI / 2;
    lip.position.set(0, piece.h, piece.l / 2);
    holder.add(lip);
    return holder;
  }

  function railMesh(piece, railMat) {
    const holder = new THREE.Group();
    const a = new THREE.Vector3(...piece.a);
    const b = new THREE.Vector3(...piece.b);
    const length = a.distanceTo(b);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, length, 10), railMat);
    bar.position.copy(a).add(b).multiplyScalar(0.5);
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    bar.castShadow = true;
    holder.add(bar);
    const posts = Math.max(2, Math.round(length / 3) + 1);
    for (let i = 0; i < posts; i += 1) {
      const point = a.clone().lerp(b, (i + 0.5) / posts);
      const ground = park.height(point.x + 0.01, point.z + 0.01);
      const tall = point.y - ground;
      if (tall < 0.1) {
        continue;
      }
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, tall, 8), railMat);
      post.position.set(point.x, ground + tall / 2, point.z);
      post.castShadow = true;
      holder.add(post);
    }
    return holder;
  }

  // Fences along the open sides. By the sea it's a railing (its top bar is
  // a rail to grind); in the mountains an orange safety net.
  function buildFences(group, palette) {
    const props = new Props();
    const sides = park.spec.sides;
    const lines = {
      north: [[-HALF_W, -HALF_D], [HALF_W, -HALF_D]],
      south: [[-HALF_W, HALF_D], [HALF_W, HALF_D]],
      west: [[-HALF_W, -HALF_D], [-HALF_W, HALF_D]],
      east: [[HALF_W, -HALF_D], [HALF_W, HALF_D]],
    };
    Object.entries(sides).forEach(([side, kind]) => {
      if (kind !== 'fence') {
        return;
      }
      const [[ax, az], [bx, bz]] = lines[side];
      const length = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(bx - ax, bz - az);
      const posts = Math.round(length / 2.4);
      for (let i = 0; i <= posts; i += 1) {
        const t = i / posts;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        props.add(CYLINDER, place(x, 0.5, z, 0, 0.08, 1, 0.08), palette.post);
      }
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      if (scenarioName === 'mountain') {
        props.add(BOX, place(mx, 0.55, mz, yaw, 0.04, 0.8, length), palette.fence);
      } else if (scenarioName !== 'sea') {
        props.add(BOX, place(mx, 1, mz, yaw, 0.08, 0.08, length), palette.fence);
        props.add(BOX, place(mx, 0.55, mz, yaw, 0.05, 0.05, length), palette.fence);
      } else {
        props.add(BOX, place(mx, 0.5, mz, yaw, 0.04, 0.04, length), palette.fence);
      }
    });
    const mesh = props.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }));
    if (mesh) {
      group.add(mesh);
    }
  }

  /* ---------- Around the park ---------- */

  // How far outside the park (with its quarter pipe decks) a point is.
  function outside(x, z) {
    const sides = park.spec.sides;
    const margin = (side) => (sides[side] === 'qp' ? QP_TOP + 3 : 0) + 3;
    const dx = Math.max(0, x - HALF_W - margin('east'), -x - HALF_W - margin('west'));
    const dz = Math.max(0, z - HALF_D - margin('south'), -z - HALF_D - margin('north'));
    return Math.hypot(dx, dz);
  }

  const COAST = (x) => 116 + 22 * Math.sin(x / 60) + 9 * Math.sin(x / 23 + 1);
  const SEA_LEVEL = -40;
  const OASIS = { x: 100, z: 4 };

  function terrainHeight(x, z) {
    const o = outside(x, z);
    if (o <= 0) {
      return -0.05;
    }
    if (scenarioName === 'city') {
      return -0.04;
    }
    if (scenarioName === 'sea') {
      let y = 0;
      const top = HALF_D + 5;
      if (z > top) {
        const t = (z - top) / (COAST(x) - top);
        y = t <= 1 ? SEA_LEVEL * t ** 1.2 : SEA_LEVEL - (t - 1) * 30;
        y += Math.sin(x * 0.07) * 2 * Math.max(0, t * (1 - t));
      }
      if (z < top) {
        const back = Math.max(0, -z - HALF_D - 12);
        y += back * 0.32 + Math.sin(x * 0.03) * Math.min(8, back * 0.15) + Math.max(0, Math.abs(x) - HALF_W - 12) * 0.18;
      }
      return y;
    }
    if (scenarioName === 'mountain') {
      return o * 0.16 + o * o * 0.0011 + (Math.sin(x * 0.04) * Math.cos(z * 0.035) + 1) * Math.min(1, o / 30) * 3;
    }
    // Desert dunes, flattened into a hollow at the oasis.
    const dunes = (Math.sin(x * 0.035 + Math.sin(z * 0.02) * 2.2) * 0.5 + 0.5) * 6 + (Math.cos(z * 0.03 + x * 0.012) * 0.5 + 0.5) * 4;
    let y = dunes * smoothstep(0, 40, o);
    const fromOasis = Math.hypot(x - OASIS.x, z - OASIS.z);
    y += (-1.6 - y) * smoothstep(34, 16, fromOasis);
    return y;
  }

  function terrainColor(x, z, y, color) {
    const o = outside(x, z);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.13) * 0.5 + 0.5;
    if (scenarioName === 'city') {
      color.set(o < 6 ? '#a7a49c' : '#55565c');
      if (o >= 6 && (Math.abs(x) % 60 < 1.2 || Math.abs(z) % 60 < 1.2)) {
        color.set('#d8d6cc');
      }
      return;
    }
    if (scenarioName === 'sea') {
      if (o < 4) {
        color.set('#dcd3bf');
      } else if (y < SEA_LEVEL + 3) {
        color.set('#f1e0b0');
      } else {
        color.set('#76c455').lerp(new THREE.Color('#4f9e3e'), n);
      }
      return;
    }
    if (scenarioName === 'mountain') {
      color.set('#f4f8fd').lerp(new THREE.Color('#d7e2f0'), n * 0.8);
      return;
    }
    const fromOasis = Math.hypot(x - OASIS.x, z - OASIS.z);
    color.set('#e8c48c').lerp(new THREE.Color('#d6a466'), n);
    if (fromOasis < 30) {
      color.lerp(new THREE.Color('#6fb04a'), smoothstep(30, 22, fromOasis));
    }
  }

  function buildTerrain(group) {
    const size = 1700;
    const geometry = new THREE.PlaneGeometry(size, size, 200, 200);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = terrainHeight(x, z);
      position.setY(i, y);
      terrainColor(x, z, y, color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const bump = texture(bumpTexture(5), 60);
    const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, bumpMap: bump, bumpScale: 0.6 }));
    ground.receiveShadow = true;
    // Keep it under the park's floor.
    ground.position.y = -0.01;
    group.add(ground);
  }

  function addWater(group, y, size, color, shape = null) {
    const bump = texture(bumpTexture(77), size / 40);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.06, metalness: 0.1, bumpMap: bump, bumpScale: 0.25 });
    const mesh = new THREE.Mesh(shape || new THREE.PlaneGeometry(size, size), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    mesh.receiveShadow = true;
    group.add(mesh);
    water.push(bump);
    return mesh;
  }

  // A soft pile of spheres: a cloud, a bush or a cherry tree's blossoms.
  function puffs(props, rand, x, y, z, radius, count, color, squash = 1) {
    for (let i = 0; i < count; i += 1) {
      const angle = rand() * Math.PI * 2;
      const out = rand() * radius * 0.7;
      const size = radius * (0.55 + rand() * 0.5);
      props.add(SPHERE, place(x + Math.cos(angle) * out, y + (rand() - 0.3) * radius * 0.5 * squash, z + Math.sin(angle) * out, 0, size * 2, size * 2 * squash, size * 2), color);
    }
  }

  function scatter(rand, count, near, far, test = () => true) {
    const spots = [];
    let tries = 0;
    while (spots.length < count && tries < count * 20) {
      tries += 1;
      const x = (rand() - 0.5) * far * 2;
      const z = (rand() - 0.5) * far * 2;
      const o = outside(x, z);
      if (o < near || o > far || !test(x, z)) {
        continue;
      }
      spots.push([x, terrainHeight(x, z), z]);
    }
    return spots;
  }

  function buildCity(group, props, rand) {
    // Blocks of buildings on a street grid.
    const buildings = new Props();
    const shades = ['#f3e6d0', '#d9e3ee', '#f2d4c4', '#e4e0d6', '#cfd8c8', '#f6efe0', '#c8d2e0'];
    for (let gx = -6; gx <= 6; gx += 1) {
      for (let gz = -6; gz <= 6; gz += 1) {
        const cx = gx * 60 + 30;
        const cz = gz * 60 + 30;
        if (outside(cx, cz) < 22) {
          continue;
        }
        for (let k = 0; k < 2; k += 1) {
          const w = 16 + rand() * 18;
          const d = 16 + rand() * 18;
          const h = 10 + rand() * (outside(cx, cz) < 120 ? 26 : 50);
          const x = cx + (k - 0.5) * 24 + (rand() - 0.5) * 6;
          const z = cz + (rand() - 0.5) * 20;
          if (outside(x, z) < 14) {
            continue;
          }
          buildings.add(buildingGeometry(w, h, d), place(x, h / 2, z), shades[Math.floor(rand() * shades.length)]);
          buildings.add(BOX, place(x, h + 0.4, z, 0, w * 0.4, 0.8, d * 0.4), '#9aa0a8');
        }
      }
    }
    const facade = texture(windowsTexture('city'));
    const mesh = buildings.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, map: facade, roughness: 0.6 }), { cast: false });
    group.add(mesh);
    // Street lamps and trees in planters around the plaza.
    for (let i = 0; i < 16; i += 1) {
      const t = i / 16;
      const x = -HALF_W - 6 + t * (HALF_W * 2 + 12);
      [HALF_D + 6, -HALF_D - QP_TOP - 6].forEach((z) => {
        if (i % 2 === 0) {
          props.add(CYLINDER, place(x, 2.5, z, 0, 0.15, 5, 0.15), '#3a3f48');
          props.add(BOX, place(x, 5.05, z, 0, 0.9, 0.18, 0.35), '#3a3f48');
        } else {
          props.add(BOX, place(x, 0.4, z, 0, 1.6, 0.8, 1.6), '#9c958a');
          props.add(CYLINDER, place(x, 1.6, z, 0, 0.25, 2, 0.25), '#6b4a2f');
          puffs(props, rand, x, 3.4, z, 1.6, 5, '#4f9a3c');
        }
      });
    }
    // A graffiti wall past the street side.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 0.5), [
      new THREE.MeshStandardMaterial({ color: '#8f8a84' }), new THREE.MeshStandardMaterial({ color: '#8f8a84' }),
      new THREE.MeshStandardMaterial({ color: '#8f8a84' }), new THREE.MeshStandardMaterial({ color: '#8f8a84' }),
      new THREE.MeshStandardMaterial({ color: '#8f8a84' }), new THREE.MeshStandardMaterial({ map: texture(graffitiTexture()) }),
    ]);
    wall.position.set(10, 2, HALF_D + 10);
    wall.rotation.y = Math.PI;
    wall.castShadow = true;
    group.add(wall);
    // Traffic cones by the fence.
    for (let i = 0; i < 5; i += 1) {
      props.add(CONE, place(HALF_W + 2, 0.35, -20 + i * 9, 0, 0.45, 0.7, 0.45), '#ff7a1a');
    }
  }

  function buildSea(group, props, rand) {
    addWater(group, SEA_LEVEL, 3000, '#1867d8');
    // Little houses down the hill, with blue, red and teal roofs.
    const houses = new Props();
    const roofs = ['#3f6fd8', '#d9483b', '#2fa59a', '#e8873a', '#5a5a6e'];
    scatter(rand, 70, 14, 260, (x, z) => terrainHeight(x, z) > SEA_LEVEL + 4).forEach(([x, y, z]) => {
      const w = 6 + rand() * 4;
      const d = 5 + rand() * 4;
      const h = 4 + rand() * 3;
      const yaw = Math.round(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.3;
      houses.add(buildingGeometry(w, h, d), place(x, y + h / 2 - 0.5, z, yaw), rand() < 0.7 ? '#f6f3ea' : '#f1e3c8');
      props.add(ROOF, place(x, y + h + 1.1, z, yaw, w * 1.05, 2.4, d * 1.05), roofs[Math.floor(rand() * roofs.length)]);
    });
    group.add(houses.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, map: texture(windowsTexture('house')), roughness: 0.75 })));
    // Cherry trees around the park and on the hills.
    scatter(rand, 60, 2, 140, (x, z) => terrainHeight(x, z) > SEA_LEVEL + 6).forEach(([x, y, z]) => {
      props.add(CYLINDER, place(x, y + 1.5, z, 0, 0.35, 3, 0.35), '#6b4636');
      puffs(props, rand, x, y + 4, z, 2.2, 6, rand() < 0.5 ? '#ffb6d0' : '#ff9ec2', 0.8);
    });
    // Utility poles with wires along the road down the hill.
    const poles = [];
    for (let i = 0; i < 9; i += 1) {
      const z = HALF_D + 8 + i * 9;
      const x = -HALF_W - 4 + Math.sin(i * 0.6) * 6;
      const y = terrainHeight(x, z);
      props.add(CYLINDER, place(x, y + 4.5, z, 0, 0.22, 9, 0.22), '#8b8f96');
      props.add(BOX, place(x, y + 8.4, z, 0, 2.2, 0.15, 0.15), '#5a5e66');
      poles.push([x, y + 8.4, z]);
    }
    for (let i = 1; i < poles.length; i += 1) {
      const [ax, ay, az] = poles[i - 1];
      const [bx, by, bz] = poles[i];
      [-0.9, 0.9].forEach((offset) => {
        const a = new THREE.Vector3(ax + offset, ay, az);
        const b = new THREE.Vector3(bx + offset, by, bz);
        const length = a.distanceTo(b);
        const wire = new THREE.Matrix4().compose(
          a.clone().add(b).multiplyScalar(0.5),
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()),
          new THREE.Vector3(0.04, length, 0.04),
        );
        props.add(CYLINDER, wire, '#2a2a30');
      });
    }
    // A red torii gate overlooking the sea, and another up the hill.
    [[-HALF_W + 4, HALF_D + 3, 0], [0, -HALF_D - QP_TOP - 14, 0]].forEach(([x, z, yaw]) => {
      const y = terrainHeight(x, z) + 0.05;
      [-2.2, 2.2].forEach((side) => props.add(CYLINDER, place(x + side, y + 2.6, z, yaw, 0.45, 5.2, 0.45), '#e0402e'));
      props.add(BOX, place(x, y + 5.3, z, yaw, 7.4, 0.5, 0.6), '#1f1f24');
      props.add(BOX, place(x, y + 4.6, z, yaw, 6, 0.35, 0.4), '#e0402e');
    });
    // A lighthouse on the cape, islands and sailboats.
    const cape = [170, 0, COAST(170) - 6];
    cape[1] = terrainHeight(cape[0], cape[2]);
    props.add(CYLINDER, place(cape[0], cape[1] + 7, cape[2], 0, 3, 14, 3), '#f7f7f2');
    props.add(CYLINDER, place(cape[0], cape[1] + 10, cape[2], 0, 3.05, 1.6, 3.05), '#e0402e');
    props.add(CYLINDER, place(cape[0], cape[1] + 15, cape[2], 0, 2, 2, 2), '#ffe9a0');
    props.add(CONE, place(cape[0], cape[1] + 17, cape[2], 0, 3, 2, 3), '#e0402e');
    [[-260, 330, 60], [180, 420, 45], [420, 300, 70], [-80, 520, 90]].forEach(([x, z, r]) => {
      puffs(props, rand, x, SEA_LEVEL, z, r, 5, '#5aa448', 0.45);
    });
    for (let i = 0; i < 6; i += 1) {
      const x = -200 + rand() * 400;
      const z = 190 + rand() * 200;
      props.add(BOX, place(x, SEA_LEVEL + 0.4, z, 0.3, 1.4, 0.8, 4), '#f7f7f2');
      props.add(CONE, place(x, SEA_LEVEL + 3.2, z + 0.4, 0.3, 2.6, 4.6, 0.2), '#ffffff');
    }
    // Big summer clouds over the sea.
    const clouds = new Props();
    for (let i = 0; i < 7; i += 1) {
      const angle = -0.9 + (i / 6) * 1.8;
      const distance = 560 + rand() * 260;
      puffs(clouds, rand, Math.sin(angle) * distance, 90 + rand() * 70, Math.cos(angle) * distance, 40 + rand() * 30, 9, '#ffffff', 0.7);
    }
    const cloudMesh = clouds.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: '#dbe9ff', emissiveIntensity: 0.35, fog: false }), { cast: false, receive: false });
    group.add(cloudMesh);
    // A vending machine by the stairs.
    const machine = HALF_W + QP_TOP + 1.5;
    props.add(BOX, place(machine, QP_HEIGHT + 1, -10, 0, 0.9, 2, 1.2), '#e8f0ff');
    props.add(BOX, place(machine - 0.46, QP_HEIGHT + 1.2, -10, 0, 0.05, 1.2, 1), '#3fa0ff');
  }

  function pine(props, rand, x, y, z, scale) {
    props.add(CYLINDER, place(x, y + 1 * scale, z, 0, 0.5 * scale, 2 * scale, 0.5 * scale), '#5b3b26');
    for (let k = 0; k < 3; k += 1) {
      const size = (3.6 - k * 0.9) * scale;
      const at = y + (2.2 + k * 1.8) * scale;
      props.add(CONE, place(x, at, z, rand() * 3, size, 3 * scale, size), k === 0 ? '#245c3c' : '#2c6b45');
      props.add(CONE, place(x, at + 0.9 * scale, z, 0, size * 0.55, 1.2 * scale, size * 0.55), '#f4f8fd');
    }
  }

  function buildMountain(group, props, rand) {
    // Peaks all around, with snowy tops.
    const peaks = new Props();
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2 + rand() * 0.3;
      const distance = 480 + rand() * 300;
      const tall = 160 + rand() * 220;
      const wide = tall * (1 + rand() * 0.6);
      const x = Math.sin(angle) * distance;
      const z = Math.cos(angle) * distance;
      peaks.add(CONE, place(x, tall / 2 - 10, z, rand() * 3, wide, tall, wide), '#7d8796');
      peaks.add(CONE, place(x, tall - 10 - tall * 0.2, z, 0, wide * 0.42, tall * 0.4 + 2, wide * 0.42), '#f4f8fd');
    }
    group.add(peaks.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), { cast: false }));
    // Pine forest.
    scatter(rand, 160, 4, 220).forEach(([x, y, z]) => pine(props, rand, x, y, z, 0.8 + rand() * 0.8));
    // A wooden lodge with a snowy roof.
    const lodge = [16, terrainHeight(16, HALF_D + 18), HALF_D + 18];
    props.add(BOX, place(lodge[0], lodge[1] + 2.5, lodge[2], 0, 14, 5, 9), '#8a5a3a');
    props.add(ROOF, place(lodge[0], lodge[1] + 6.5, lodge[2], 0, 15, 3.4, 10.5), '#f4f8fd');
    props.add(BOX, place(lodge[0], lodge[1] + 1.6, lodge[2] - 4.55, 0, 2, 3, 0.2), '#ffd27a');
    // Ski lift towers going up the hill.
    for (let i = 0; i < 7; i += 1) {
      const x = -30 + i * 2;
      const z = -HALF_D - 30 - i * 28;
      const y = terrainHeight(x, z);
      props.add(CYLINDER, place(x, y + 6, z, 0, 0.6, 12, 0.6), '#c9cfd8');
      props.add(BOX, place(x, y + 12, z, 0.07, 6, 0.4, 0.4), '#c9cfd8');
    }
    // Flags at the top of the quarter pipes.
    const colors = ['#ff5fb4', '#35c8ff', '#ffd23f', '#7cff6a'];
    for (let i = 0; i < 8; i += 1) {
      const x = -30 + i * 8.5;
      const z = -HALF_D - QP_TOP - 1.5;
      props.add(CYLINDER, place(x, QP_HEIGHT + 1.5, z, 0, 0.08, 3, 0.08), '#3a3f4a');
      props.add(BOX, place(x + 0.6, QP_HEIGHT + 2.6, z, 0, 1.2, 0.8, 0.04), colors[i % colors.length]);
    }
  }

  function palm(props, rand, x, y, z, scale) {
    let px = x;
    let py = y;
    let pz = z;
    const lean = rand() * Math.PI * 2;
    const bend = 0.12 + rand() * 0.15;
    for (let k = 0; k < 6; k += 1) {
      const nx = px + Math.cos(lean) * bend * k * scale;
      const nz = pz + Math.sin(lean) * bend * k * scale;
      props.add(CYLINDER, place(nx, py + 0.9 * scale, nz, 0, (0.55 - k * 0.04) * scale, 1.9 * scale, (0.55 - k * 0.04) * scale), k % 2 ? '#8a6038' : '#9c6e42');
      px = nx;
      pz = nz;
      py += 1.8 * scale;
    }
    for (let k = 0; k < 7; k += 1) {
      const angle = (k / 7) * Math.PI * 2;
      props.add(BOX, place(px + Math.cos(angle) * 1.6 * scale, py + 0.2, pz + Math.sin(angle) * 1.6 * scale, -angle + Math.PI / 2, 0.9 * scale, 0.12, 3.6 * scale, 0.35), k % 2 ? '#3f9a3a' : '#4fae46');
    }
    props.add(SPHERE, place(px, py, pz, 0, 0.8 * scale, 0.8 * scale, 0.8 * scale), '#6b4a2a');
  }

  function buildDesert(group, props, rand) {
    // The oasis: a pond with palm trees, reeds and a few tents.
    const pond = new THREE.CircleGeometry(17, 40);
    const waterMesh = addWater(group, -0.4, 60, '#27a5b8', pond);
    waterMesh.position.set(OASIS.x, -0.4, OASIS.z);
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2 + rand() * 0.3;
      const r = 19 + rand() * 7;
      const x = OASIS.x + Math.cos(angle) * r;
      const z = OASIS.z + Math.sin(angle) * r;
      palm(props, rand, x, terrainHeight(x, z), z, 0.9 + rand() * 0.5);
    }
    for (let i = 0; i < 24; i += 1) {
      const angle = rand() * Math.PI * 2;
      const r = 16 + rand() * 3;
      const x = OASIS.x + Math.cos(angle) * r;
      const z = OASIS.z + Math.sin(angle) * r;
      puffs(props, rand, x, terrainHeight(x, z) + 0.4, z, 0.9, 3, '#5c9a3a');
    }
    ['#e3242b', '#f2f2f2', '#2f6bff'].forEach((color, i) => {
      const x = OASIS.x - 22 + i * 7;
      const z = OASIS.z + 30;
      props.add(CONE, place(x, terrainHeight(x, z) + 2, z, i, 6, 4, 6), color);
    });
    // Ruined columns and an arch near the park.
    for (let i = 0; i < 10; i += 1) {
      const x = -HALF_W - QP_TOP - 8 + (i % 2) * -6;
      const z = -40 + i * 9;
      const tall = 3 + rand() * 6;
      props.add(CYLINDER, place(x, terrainHeight(x, z) + tall / 2, z, 0, 1.4, tall, 1.4), '#d9b07a');
    }
    [[-12, -HALF_D - QP_TOP - 9]].forEach(([x, z]) => {
      const y = terrainHeight(x, z);
      props.add(BOX, place(x - 4, y + 4, z, 0, 2, 8, 2), '#d2a46c');
      props.add(BOX, place(x + 4, y + 4, z, 0, 2, 8, 2), '#d2a46c');
      props.add(BOX, place(x, y + 8.6, z, 0, 11, 1.4, 2.2), '#c9995e');
    });
    // Flat-topped mesas far away, and two pyramids.
    const far = new Props();
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2 + rand() * 0.4;
      const distance = 520 + rand() * 250;
      const tall = 50 + rand() * 70;
      const wide = 80 + rand() * 120;
      far.add(CYLINDER, place(Math.sin(angle) * distance, tall / 2, Math.cos(angle) * distance, 0, wide, tall, wide * 0.7), i % 2 ? '#c27a45' : '#b5693a');
    }
    [[-420, -380, 140], [-300, -470, 90]].forEach(([x, z, size]) => {
      far.add(ROOF, place(x, size / 2, z, 0.4, size * 1.4, size, size * 1.4), '#e0b277');
    });
    group.add(far.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), { cast: false }));
    // A few scrubby bushes on the dunes.
    scatter(rand, 50, 10, 200).forEach(([x, y, z]) => puffs(props, rand, x, y + 0.3, z, 0.8, 3, '#8a9a4a'));
  }

  function buildSurroundings(group) {
    buildTerrain(group);
    const props = new Props();
    const rand = random(31);
    if (scenarioName === 'city') {
      buildCity(group, props, rand);
    }
    if (scenarioName === 'sea') {
      buildSea(group, props, rand);
    }
    if (scenarioName === 'mountain') {
      buildMountain(group, props, rand);
    }
    if (scenarioName === 'desert') {
      buildDesert(group, props, rand);
    }
    const mesh = props.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
    if (mesh) {
      group.add(mesh);
    }
  }

  /* ---------- Letters ---------- */

  function buildLetters(group, word) {
    letters = park.letters.map((spot, i) => {
      const map = own(letterTexture(word[i], LETTER_COLORS[i % LETTER_COLORS.length]));
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
      sprite.position.set(spot.x, spot.y, spot.z);
      sprite.scale.setScalar(1.5);
      group.add(sprite);
      return { sprite, base: spot.y, collected: false, pop: 0, color: LETTER_COLORS[i % LETTER_COLORS.length] };
    });
  }

  function setRatio(ratio) {
    pixelRatio = ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    effects.resize(height * ratio);
  }

  let frameAverage = 16;
  let lastAdapt = 0;

  return {
    renderer,
    camera,
    scene,
    effects,

    // Builds a park; returns its riding data (see world.js).
    setScenario(name, word) {
      disposeWorld();
      scenarioName = name;
      park = buildPark(name);
      applyLook(LOOKS[name]);
      updateEnvironment();
      world = new THREE.Group();
      buildPark3d(world);
      buildSurroundings(world);
      buildLetters(world, word);
      const style = WEATHER[name];
      weather.visible = Boolean(style);
      if (style) {
        weatherMaterial.color.set(style.color);
        weatherMaterial.size = style.size;
        weatherMaterial.opacity = style.opacity;
      }
      scene.add(world);
      return park;
    },

    // Shows the letters again, with new faces if the word changed.
    resetLetters(word) {
      letters.forEach(({ sprite }) => {
        world.remove(sprite);
        sprite.material.map.dispose();
        owned.delete(sprite.material.map);
        sprite.material.dispose();
      });
      buildLetters(world, word);
    },

    letterPosition(index) {
      const letter = letters[index];
      return letter && !letter.collected ? letter.sprite.position : null;
    },

    collectLetter(index) {
      const letter = letters[index];
      if (letter && !letter.collected) {
        letter.collected = true;
        letter.pop = 0.001;
        const at = letter.sprite.position;
        effects.burst(at.x, at.y, at.z, letter.color);
      }
    },

    // What the board kicks up here.
    groundKind() {
      return { city: 'dust', sea: 'dust', mountain: 'snow', desert: 'sand' }[scenarioName];
    },

    // The shadow box and sun follow the rider.
    follow(x, y, z) {
      sun.target.position.set(x, y, z);
      sun.position.set(x + lightDirection.x * 120, y + lightDirection.y * 120, z + lightDirection.z * 120);
    },

    animate(dt, time, cameraPosition) {
      skyMaterial.uniforms.time.value = time;
      sky.position.copy(cameraPosition);
      water.forEach((map, i) => {
        map.offset.x = (time * 0.006 * (i + 1)) % 1;
        map.offset.y = (time * 0.004) % 1;
      });
      letters.forEach((letter, i) => {
        if (letter.collected && letter.pop === 0) {
          return;
        }
        letter.sprite.position.y = letter.base + Math.sin(time * 2.5 + i) * 0.25;
        letter.sprite.scale.setScalar(1.5 + Math.sin(time * 4 + i) * 0.08);
        if (letter.pop > 0) {
          letter.pop += dt * 3;
          letter.sprite.scale.setScalar(Math.max(0.01, 1.5 * (1 - letter.pop)));
          letter.sprite.material.opacity = Math.max(0, 1 - letter.pop);
          if (letter.pop >= 1) {
            letter.sprite.visible = false;
            letter.pop = 0;
          }
        }
      });
      const style = WEATHER[scenarioName];
      if (style) {
        const positions = weatherGeometry.attributes.position;
        for (let i = 0; i < weatherCount; i += 1) {
          let y = positions.getY(i) - dt * style.fall * (0.7 + (i % 5) * 0.12);
          if (y < 0) {
            y += 40;
          }
          positions.setY(i, y);
          let x = positions.getX(i) + (Math.sin(time * 0.8 + i) * 0.5 + (scenarioName === 'desert' ? 1 : 0.3)) * style.drift * dt;
          if (x > 45) {
            x -= 90;
          }
          positions.setX(i, x);
        }
        positions.needsUpdate = true;
        weather.position.set(cameraPosition.x, cameraPosition.y - (scenarioName === 'desert' ? 6 : 15), cameraPosition.z);
      }
      effects.update(dt);
    },

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
      effects.resize(height * pixelRatio);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },

    render() {
      renderer.render(scene, camera);
    },
  };
}
