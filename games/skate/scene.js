// The 3D world for each hill: the sky, the endless slope with its track,
// the jumps, ledges and rails on it, the scenery beside it (trees, fences,
// gates, houses, a viaduct, a ski lift) and, far below, the sea. All of it
// is built here from simple shapes. What it is covered with comes from
// pictures made for the game (art/): photo-like ground, rock, track and
// wood, cut-outs of trees, bushes and flowers stood upright, and a painting
// of the far coast and clouds. If a picture is missing, a surface drawn in
// code stands in for it. Surfaces have bumps (normal maps),
// the sky lights and reflects on everything, and the picture is finished
// like a film: glow, sun shafts, lens flares and color grading (see
// gfx/post.js).
//
// The hill is one lap that repeats (see world.js). The lap is built once
// and shown several times in a row, each copy DROP meters lower, moving
// along with the rider. The sea and the far hills stay the same distance
// away, so the ride never reaches the bottom.

import * as THREE from '../../vendor/three/three.min.js';
import { DROP, HALF_WIDTH, LAP, buildHill } from './world.js';
import {
  groundTexture,
  letterTexture,
  rampTexture,
  random,
  softDotTexture,
  trackTexture,
  windowsTexture,
} from './textures.js';
import { createEffects } from './effects.js';
import { createPipeline } from '../../gfx/post.js';
import { createSky, skyDirection } from '../../gfx/sky.js';
import { createSea } from '../../gfx/sea.js';
import { matchTiling, normalMapFrom } from '../../gfx/surface.js';

function pickQuality() {
  const small = Math.min(window.screen.width, window.screen.height) < 700;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (small || touch) {
    return { name: 'low', maxRatio: Math.min(window.devicePixelRatio, 2), minRatio: 0.75, shadowSize: 1024, msaa: 2, laps: 3, plants: 0.5 };
  }
  return { name: 'high', maxRatio: Math.min(window.devicePixelRatio, 2), minRatio: 1, shadowSize: 2048, msaa: 4, laps: 4, plants: 1 };
}

// Sky, light and air for each hill, then the lens and the film: glow
// (bloom, threshold), sun shafts (rays, rayFloor), flares, and the color
// grade (saturation, contrast, tint for bright parts, shadowTint for dark
// ones). Elevations are in degrees; the rider looks toward azimuth 0.
const LOOKS = {
  meadow: {
    top: '#1458d2', horizon: '#b9e0ff', bottom: '#8fc4f2', fog: '#bfdcf6', fogDensity: 0.00072,
    sunElevation: 46, sunAzimuth: 52, sunColor: '#fff4e0', sunSize: 0.028, disc: 9, sunPower: 3,
    hemiSky: '#c4e2ff', hemiGround: '#7ba05c', hemiPower: 1.05, clouds: 0.6, exposure: 0.94,
    bloom: 0.34, threshold: 1, radius: 0.55, rays: 0.3, rayFloor: 2.4, flare: 0.8,
    vignette: 0.26, grain: 0.02, aberration: 0.008, saturation: 1.22, contrast: 1.06, tint: '#fffaf0', shadowTint: '#000612',
  },
  sea: {
    top: '#1559d8', horizon: '#a8dcff', bottom: '#7fbdf0', fog: '#b4daf8', fogDensity: 0.0007,
    sunElevation: 40, sunAzimuth: -48, sunColor: '#fff6e6', sunSize: 0.028, disc: 9, sunPower: 2.9,
    hemiSky: '#bfe2ff', hemiGround: '#7d8f78', hemiPower: 1, clouds: 0.55, exposure: 0.95,
    bloom: 0.36, threshold: 0.98, radius: 0.55, rays: 0.32, rayFloor: 2.3, flare: 0.9,
    vignette: 0.26, grain: 0.02, aberration: 0.008, saturation: 1.2, contrast: 1.05, tint: '#fffaf0', shadowTint: '#000612',
  },
  mountain: {
    top: '#2f78dc', horizon: '#dcebfa', bottom: '#b9cfe8', fog: '#dde9f6', fogDensity: 0.00085,
    sunElevation: 27, sunAzimuth: 40, sunColor: '#fff2dc', sunSize: 0.03, disc: 9, sunPower: 2.4,
    hemiSky: '#dfeaff', hemiGround: '#8c9ab4', hemiPower: 0.9, clouds: 0.34, exposure: 0.84,
    bloom: 0.3, threshold: 1.3, radius: 0.55, rays: 0.3, rayFloor: 2.6, flare: 0.9,
    vignette: 0.3, grain: 0.022, aberration: 0.01, saturation: 1.1, contrast: 1.07, tint: '#fff8f0', shadowTint: '#000814',
  },
  // Sunset over the gulf.
  desert: {
    top: '#3a5fc0', horizon: '#ffc58a', bottom: '#f0a070', fog: '#f0c09a', fogDensity: 0.0007,
    sunElevation: 13, sunAzimuth: -28, sunColor: '#ffb066', sunSize: 0.036, disc: 8, sunPower: 3.1,
    hemiSky: '#ffd9b8', hemiGround: '#b0703f', hemiPower: 1, clouds: 0.3, exposure: 1,
    bloom: 0.3, threshold: 1.15, radius: 0.6, rays: 0.3, rayFloor: 2.8, flare: 0.9,
    vignette: 0.32, grain: 0.025, aberration: 0.012, saturation: 1.18, contrast: 1.07, tint: '#fff0d8', shadowTint: '#0a0400',
  },
};

// What each hill is made of. `seaSide` is the side the ground falls away
// on (1 is +x, the left of the screen); the other side is a bank that
// rises. `shoulder` is how far the gentle ground reaches before the cliff.
const STYLES = {
  meadow: {
    seaSide: 1, shoulder: 30, bank: 0.3, seaBelow: 520, kind: 'dust',
    ground: ['#86d456', '#4fa73c'], far: '#3f8a45', rock: ['#b3a88e', '#8b8371'],
    flowers: ['#ff9ad1', '#c9a4ff', '#ffe98a', '#ffffff'],
    sea: '#0a3f9e', shallow: '#2fb7c9', land: '#5aa35a', cliff: ['#ece6d6', '#cfc5ae'],
    trees: 150, treeHeight: 9, edge: 'fence', gate: 'timber',
    piece: { side: '#8a6a45', top: '#c9a878', metal: '#cfd5de', rail: '#f4f4f0', post: '#8a6a45', log: '#7a5534' },
    roughness: 0.95, trackRoughness: 0.95,
  },
  sea: {
    seaSide: -1, shoulder: 7, bank: 0.42, seaBelow: 480, kind: 'dust',
    ground: ['#7ccb55', '#56a844'], far: '#4b9050', rock: ['#b9ad95', '#93897a'],
    flowers: ['#ffb6d0', '#ffffff'],
    sea: '#093c9c', shallow: '#35c2cf', land: '#5fa466', cliff: ['#efe9da', '#d3c9b3'],
    trees: 120, treeHeight: 9, edge: 'guard', gate: 'torii',
    piece: { side: '#8ec1ea', top: '#f3eee2', metal: '#f4f6f8', rail: '#e04a3a', post: '#e8e8e2', log: '#8a5a3a' },
    roughness: 0.95, trackRoughness: 0.93,
  },
  mountain: {
    seaSide: 1, shoulder: 24, bank: 0.36, seaBelow: 560, kind: 'snow',
    ground: ['#f6f9fe', '#dfe8f4'], far: '#c9d6e8', rock: ['#7f8898', '#5f6878'],
    sea: '#0b3d66', shallow: '#4f9db8', land: '#b8c6da',
    trees: 190, treeHeight: 10, edge: 'net', gate: 'arch',
    piece: { side: '#dfe7f2', top: '#3a8dff', metal: '#2f7bff', rail: '#ff5fb4', post: '#ff7a1a', log: '#6b4a30' },
    roughness: 0.7, trackRoughness: 0.6,
  },
  desert: {
    seaSide: -1, shoulder: 20, bank: 0.38, seaBelow: 500, kind: 'sand',
    ground: ['#e3b77c', '#cf9a5e'], far: '#b96e43', rock: ['#c0703f', '#9c5632'],
    sea: '#1b4f8c', shallow: '#3fb0b0', land: '#b8714a', cliff: ['#d08a58', '#a85e38'],
    trees: 70, treeHeight: 5, edge: 'rope', gate: 'stone',
    piece: { side: '#c48f55', top: '#d7aa70', metal: '#9a6a3c', rail: '#7a4a28', post: '#7a5230', log: '#8a6038' },
    roughness: 1, trackRoughness: 0.95,
  },
};

// The pictures each hill uses (files in art/, without the ending).
const ART = {
  meadow: {
    ground: 'tile-grass', track: 'tile-dirt', rock: 'tile-limestone', ramp: 'tile-planks', pano: 'pano-meadow',
    wall: 'tile-stonewall', roof: 'tile-roof',
    trees: ['cut-oak', 'cut-oak', 'cut-cypress'], bushes: ['cut-bush'], flowers: ['cut-pink', 'cut-lilac', 'cut-daisy', 'cut-grass'],
  },
  sea: {
    ground: 'tile-grass', track: 'tile-asphalt', rock: 'tile-limestone', ramp: 'tile-planks', pano: 'pano-coast',
    wall: 'tile-stonewall', roof: 'tile-roof',
    trees: ['cut-pine', 'cut-pine', 'cut-cherry', 'cut-cypress'], bushes: ['cut-bush'], flowers: ['cut-pink', 'cut-daisy', 'cut-grass'],
  },
  mountain: {
    ground: 'tile-snow', track: 'tile-corduroy', rock: 'tile-granite', pano: 'pano-fjord',
    trees: ['cut-snowpine'], bushes: [], flowers: [],
  },
  desert: {
    ground: 'tile-sand', track: 'tile-reddirt', rock: 'tile-sandstone', ramp: 'tile-sandstone', pano: 'pano-canyon',
    wall: 'tile-sandstone',
    trees: ['cut-cactus'], bushes: ['cut-drybush'], flowers: ['cut-drybush'],
  },
};

const LETTER_COLORS = ['#ff3fa4', '#ffd23f', '#35f2ff', '#7cff6a', '#ff8a3a'];
const TURN = (Math.PI * 2) / LAP;
// The hillside is a sheet of points: across the strip, then further and
// further out on both sides (meters past the strip's edge).
const OUT = [0.8, 2, 4, 7, 11, 16, 22, 30, 40, 54, 72, 96, 128];
const ACROSS = [
  ...OUT.map((s) => -HALF_WIDTH - s).reverse(),
  -9, -6, -3, 0, 3, 6, 9,
  ...OUT.map((s) => HALF_WIDTH + s),
];
const ROW = 2;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/* ---------- Building helpers ---------- */

// Many shapes merged into one mesh with a color per shape: one draw call.
class Props {
  constructor() {
    this.parts = [];
  }

  // `shade` darkens the underside of the shape (0 to 1). `tile` lays a
  // repeating picture over it, one copy every `tile` meters, whichever
  // way each face points (for walls and roofs).
  add(geometry, matrix, color, shade = 0, tile = 0) {
    const part = geometry.clone();
    const heights = geometry.attributes.position;
    part.applyMatrix4(matrix);
    const tint = new THREE.Color(color);
    const count = part.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const light = 1 - shade * (0.5 - heights.getY(i));
      colors[i * 3] = tint.r * light;
      colors[i * 3 + 1] = tint.g * light;
      colors[i * 3 + 2] = tint.b * light;
    }
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (tile > 0) {
      const at = part.attributes.position;
      const facing = part.attributes.normal;
      const uv = new Float32Array(count * 2);
      for (let i = 0; i < count; i += 1) {
        const nx = Math.abs(facing.getX(i));
        const ny = Math.abs(facing.getY(i));
        const nz = Math.abs(facing.getZ(i));
        let across = at.getX(i);
        let up = at.getY(i);
        if (ny > nx && ny > nz) {
          up = at.getZ(i);
        } else if (nx > nz) {
          across = at.getZ(i);
        }
        uv[i * 2] = across / tile;
        uv[i * 2 + 1] = up / tile;
      }
      part.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
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

// Simple shapes, kept low on triangles: thousands of them make the scenery.
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const CONE = new THREE.ConeGeometry(0.5, 1, 7);
const BLADE = new THREE.ConeGeometry(0.5, 1, 4);
const ROOF = new THREE.ConeGeometry(0.72, 1, 4);
ROOF.rotateY(Math.PI / 4);
const SPHERE = new THREE.SphereGeometry(0.5, 9, 6);
const SHARED = new Set([BOX, CYLINDER, CONE, BLADE, ROOF, SPHERE]);

const UP = new THREE.Vector3(0, 1, 0);
const beamMiddle = new THREE.Vector3();
const beamAlong = new THREE.Vector3();

// A bar from a to b: `across` wide and `tall` thick. For bars that run
// mostly down the hill, `tall` is the up-and-down size.
function beam(a, b, across, tall = across) {
  beamAlong.copy(b).sub(a);
  const length = beamAlong.length();
  quaternion.setFromUnitVectors(UP, beamAlong.normalize());
  return new THREE.Matrix4().compose(beamMiddle.copy(a).add(b).multiplyScalar(0.5), quaternion, scaleVector.set(across, length, tall));
}

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

/* ---------- The scene ---------- */

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
  const camera = new THREE.PerspectiveCamera(60, 1, 0.2, 8000);

  const hemisphere = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 300 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  let lightDirection = new THREE.Vector3(0.3, 1, 0.2).normalize();

  const sky = createSky(1800, { detail: quality.name === 'high' });
  const skyMaterial = sky.material;
  scene.add(sky.mesh);
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

  // The scene is drawn with smooth edges (multisampling) into a bright
  // picture, then finished: glow, sun shafts, flares and the color grade.
  const pipeline = createPipeline(renderer, scene, camera, {
    full: quality.name === 'high',
    msaa: quality.msaa,
    halfBloom: quality.name === 'low',
  });

  const dot = softDotTexture();
  const effects = createEffects(scene, dot);

  // In the air: snow in the mountains, cherry petals by the sea, blowing
  // sand in the desert, drifting seeds over the meadow. Points in a box
  // that follows the camera.
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
    meadow: { color: '#ffffff', size: 0.16, fall: 0.3, drift: 1.6, opacity: 0.85 },
    mountain: { color: '#ffffff', size: 0.38, fall: 2.6, drift: 0.6, opacity: 0.95 },
    sea: { color: '#ffb7d2', size: 0.3, fall: 1.1, drift: 2.2, opacity: 0.95 },
    desert: { color: '#f3d29b', size: 0.14, fall: 0.2, drift: 7, opacity: 0.6 },
  };

  // Pictures are fetched once and kept. One that fails to load comes back
  // as null, and the code-drawn stand-in is used instead.
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

  // All the pictures of a hill, by what they are for.
  async function loadArt(name) {
    const entries = await Promise.all(Object.entries(ART[name]).map(async ([key, value]) => {
      if (Array.isArray(value)) {
        return [key, (await Promise.all(value.map(loadImage))).filter(Boolean)];
      }
      return [key, await loadImage(value)];
    }));
    return Object.fromEntries(entries);
  }

  let art = {};
  let building = 0;
  let world = null;
  let scenarioName = 'meadow';
  let hill = null;
  let style = null;
  let slots = [];
  let backdrop = null;
  let shownLap = null;
  let letters = [];
  let sea = null;
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
    slots = [];
    backdrop = null;
    shownLap = null;
    letters = [];
    sea = null;
  }

  function applyLook(look) {
    sky.apply(look);
    pipeline.look(look);
    pipeline.setSun(sky.sunDirection);
    scene.fog.color.set(look.fog);
    scene.fog.density = look.fogDensity;
    lightDirection = skyDirection(look.sunElevation, look.sunAzimuth);
    sun.color.set(look.sunColor);
    sun.intensity = look.sunPower;
    hemisphere.color.set(look.hemiSky);
    hemisphere.groundColor.set(look.hemiGround);
    hemisphere.intensity = look.hemiPower;
    renderer.toneMappingExposure = look.exposure;
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
    return own(made);
  }

  // Bumps worked out from a surface's own picture, tiled the same way.
  function bumpsOf(map, strength = 2.5) {
    const size = { width: Math.min(512, map.image.width), height: Math.min(512, map.image.height) };
    const bumps = matchTiling(normalMapFrom(map.image, { strength, size }), map);
    bumps.anisotropy = anisotropy;
    return own(bumps);
  }

  /* ---------- The hillside ---------- */

  // Lumps and hollows that match up where one lap meets the next.
  function rough(x, z) {
    return Math.sin(x * 0.11 + Math.sin(TURN * 5 * z) * 1.7) * 0.5
      + Math.sin(TURN * 13 * z + x * 0.05) * 0.3
      + Math.sin(x * 0.31 + TURN * 29 * z) * 0.2;
  }

  // The height of the ground anywhere on the first lap: the strip itself,
  // a shoulder and then a cliff on the sea side, a rising bank on the other.
  function ground(x, z) {
    const u = x - hill.center(z);
    const s = Math.abs(u) - HALF_WIDTH;
    const base = hill.base(z);
    if (s <= 0) {
      return base;
    }
    const lumps = rough(x, z) * Math.min(1, s / 10);
    if (Math.sign(u) === style.seaSide) {
      let y = base - s * 0.1 + lumps * 1.6;
      if (s > style.shoulder) {
        // The cliff, with ledges and gullies cut into it.
        const drop = (s - style.shoulder) ** 1.35 * 1.3;
        y -= drop * (1 + 0.16 * Math.sin(TURN * 17 * z + x * 0.08) + 0.1 * Math.sin(TURN * 41 * z));
      }
      return y;
    }
    return base + s * style.bank + s * s * 0.0035 + lumps * 2.4;
  }

  const paintA = new THREE.Color();
  const paintB = new THREE.Color();

  function paint(x, z, color) {
    const u = x - hill.center(z);
    const s = Math.abs(u) - HALF_WIDTH;
    const n = rough(x * 1.7 + 40, z) * 0.5 + 0.5;
    color.set(style.ground[0]).lerp(paintA.set(style.ground[1]), n);
    if (style.flowers && s > 1.5) {
      // Drifts of flowers.
      const patch = Math.sin(x * 0.09 + Math.sin(TURN * 7 * z) * 2.4) * Math.sin(TURN * 11 * z + x * 0.04);
      if (patch > 0.3) {
        const pick = style.flowers[Math.floor(n * 7.9) % style.flowers.length];
        color.lerp(paintB.set(pick), Math.min(0.7, (patch - 0.3) * 3));
      }
    }
    if (Math.sign(u) === style.seaSide) {
      color.lerp(paintA.set(style.rock[n > 0.5 ? 0 : 1]), smoothstep(style.shoulder - 2, style.shoulder + 9, s));
    } else {
      color.lerp(paintA.set(style.far), smoothstep(26, 100, s) * 0.85);
    }
    // A photo of the ground has its own colors: only tint it lightly.
    if (art.ground) {
      color.lerp(paintA.set('#ffffff'), 0.72);
    }
  }

  function buildTerrain(group) {
    const rows = LAP / ROW;
    const cols = ACROSS.length;
    const count = (rows + 1) * cols;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    const color = new THREE.Color();
    for (let r = 0; r <= rows; r += 1) {
      const z = r * ROW;
      const middle = hill.center(z);
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        const x = middle + ACROSS[c];
        positions[i * 3] = x;
        positions[i * 3 + 1] = ground(x, z);
        positions[i * 3 + 2] = z;
        paint(x, z, color);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        uvs[i * 2] = x / 8;
        uvs[i * 2 + 1] = z / 8;
      }
    }
    const indices = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols - 1; c += 1) {
        const a = r * cols + c;
        const b = a + cols;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    // The first and last rows are the same ground: give them the same
    // light, so no line shows where laps meet.
    const normal = geometry.attributes.normal;
    for (let c = 0; c < cols; c += 1) {
      const last = rows * cols + c;
      const nx = normal.getX(c) + normal.getX(last);
      const ny = normal.getY(c) + normal.getY(last);
      const nz = normal.getZ(c) + normal.getZ(last);
      const length = Math.hypot(nx, ny, nz);
      normal.setXYZ(c, nx / length, ny / length, nz / length);
      normal.setXYZ(last, nx / length, ny / length, nz / length);
    }
    const map = art.ground ? picture(art.ground) : texture(groundTexture(scenarioName));
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, map, normalMap: bumpsOf(map, 3), roughness: style.roughness, envMapIntensity: 0.5,
    });
    rockOnSteepGround(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Where the ground is steep nothing grows: it shows bare rock. With a
  // picture of rock, that is laid on the cliff face; without one, layers
  // and cracks are worked out.
  function rockOnSteepGround(material) {
    const light = new THREE.Color(style.rock[0]);
    const dark = new THREE.Color(style.rock[1]);
    const rockMap = art.rock ? picture(art.rock) : null;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.rockLight = { value: light };
      shader.uniforms.rockDark = { value: dark };
      shader.uniforms.rockMap = { value: rockMap };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRockAt;\nvarying float vRockUp;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvRockUp = normalize(mat3(modelMatrix) * objectNormal).y;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockAt = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          ${rockMap ? '#define ROCK_PICTURE' : ''}
          uniform vec3 rockLight;
          uniform vec3 rockDark;
          uniform sampler2D rockMap;
          varying vec3 vRockAt;
          varying float vRockUp;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float steep = 1.0 - smoothstep(0.5, 0.72, vRockUp);
          #ifdef ROCK_PICTURE
            // The cliff runs along z, so the picture is laid along z and up.
            vec3 rock = texture2D(rockMap, vec2(vRockAt.z + vRockAt.x * 0.4, vRockAt.y) * 0.03).rgb;
            rock *= 0.82 + 0.3 * texture2D(rockMap, vec2(vRockAt.z, vRockAt.y) * 0.006).g;
          #else
            float sway = sin(vRockAt.x * 0.07 + vRockAt.z * 0.05) * 2.5 + sin(vRockAt.z * 0.021) * 4.0 + sin(vRockAt.x * 0.31 + vRockAt.z * 0.27) * 0.8;
            float layer = vRockAt.y * 0.5 + sway;
            float strata = smoothstep(0.1, 0.9, abs(fract(layer * 0.37) - 0.5) * 2.0) * 0.45 + (sin(layer * 2.3 + sin(layer * 0.7) * 2.0) * 0.5 + 0.5) * 0.35 + 0.1;
            float cracks = smoothstep(0.9, 1.0, sin(vRockAt.x * 0.9 + sin(vRockAt.y * 0.4) * 2.0) * sin(vRockAt.z * 0.8 + vRockAt.y * 0.3));
            vec3 rock = mix(rockDark, rockLight, strata) * (1.0 - cracks * 0.45);
          #endif
          diffuseColor.rgb = mix(diffuseColor.rgb, rock, steep);`);
    };
    material.customProgramCacheKey = () => `hill-rock-${rockMap ? 'picture' : 'drawn'}`;
  }

  // The strip the rider goes down, laid just above the hillside.
  function buildTrack(group) {
    const rows = LAP / ROW;
    const across = 6;
    const half = HALF_WIDTH + 1.5;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let r = 0; r <= rows; r += 1) {
      const z = r * ROW;
      const middle = hill.center(z);
      for (let c = 0; c <= across; c += 1) {
        const x = middle - half + (c / across) * half * 2;
        // Barely above the hillside, or it would cover a thin snowboard.
        positions.push(x, ground(x, z) + 0.012, z);
        uvs.push(c / across, z / 16);
      }
    }
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < across; c += 1) {
        const a = r * (across + 1) + c;
        const b = a + across + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const map = texture(trackTexture(scenarioName, { ground: art.ground, track: art.track }));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      map, normalMap: bumpsOf(map, 2.2), roughness: style.trackRoughness, envMapIntensity: 0.35,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
    mesh.receiveShadow = true;
    mesh.renderOrder = -1;
    group.add(mesh);
  }

  /* ---------- Scenery ---------- */

  // Plants are pictures stood upright: each one is two or three sheets
  // crossed, so it looks full from every side. `spots` are
  // [{ x, y, z, tall, turn }]; all of one picture's plants are one mesh.
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
      map, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.3, color: '#d9d9d9',
    }));
    mesh.receiveShadow = false;
    mesh.castShadow = shadows;
    if (shadows) {
      // Shadows in the shape of the leaves, not of the sheets.
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.4 });
    }
    return mesh;
  }

  // Shares `spots` out between a few pictures and adds one mesh for each.
  function plant(group, pictures, spots, sheets, shadows) {
    pictures.forEach((image, i) => {
      const mine = spots.filter((unused, k) => k % pictures.length === i);
      if (mine.length > 0) {
        group.add(standing(image, mine, sheets, shadows));
      }
    });
  }

  // Calls `each(x, y, z, s)` at `count` places beside the strip, between
  // `from` and `to` meters past its edge. `side`: 'sea', 'bank' or 'both'.
  function scatter(rand, count, from, to, side, each) {
    for (let i = 0; i < count; i += 1) {
      const z = rand() * LAP;
      const s = from + rand() * (to - from);
      let sign = style.seaSide;
      if (side === 'bank' || (side === 'both' && rand() < 0.5)) {
        sign = -style.seaSide;
      }
      const x = hill.center(z) + sign * (HALF_WIDTH + s);
      each(x, ground(x, z), z, s);
    }
  }

  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();

  // A point beside the strip: `out` meters past the edge on `side`.
  function beside(target, z, side, out, lift = 0) {
    const x = hill.center(z) + side * (HALF_WIDTH + out);
    return target.set(x, ground(x, z) + lift, z);
  }

  // The color of a piece of stonework: its own when drawn plain, nearly
  // white under a picture of stones, which has colors of its own.
  function stone(color) {
    return art.wall ? '#e8e8e8' : color;
  }

  // What marks the edges: a wooden fence, a guardrail and a stone wall,
  // safety nets, or posts with a rope.
  function buildEdges(props, walls) {
    const colors = style.piece;
    const span = 4;
    for (let z = 0; z < LAP; z += span) {
      [-1, 1].forEach((side) => {
        const seaward = side === style.seaSide;
        const post = beside(pointA, z, side, 0.9);
        if (style.edge === 'fence') {
          props.add(CYLINDER, place(post.x, post.y + 0.55, post.z, 0, 0.16, 1.1, 0.16), colors.post);
          [0.45, 0.9].forEach((up) => {
            props.add(BOX, beam(beside(pointA, z, side, 0.9, up), beside(pointB, z + span, side, 0.9, up), 0.06, 0.12), colors.post);
          });
        }
        if (style.edge === 'guard' && seaward) {
          props.add(BOX, place(post.x, post.y + 0.35, post.z, 0, 0.1, 0.7, 0.14), '#8d939c');
          props.add(BOX, beam(beside(pointA, z, side, 0.82, 0.55), beside(pointB, z + span, side, 0.82, 0.55), 0.05, 0.3), colors.post);
        }
        if (style.edge === 'guard' && !seaward) {
          walls.add(BOX, beam(beside(pointA, z, side, 1, 0.45), beside(pointB, z + span + 0.05, side, 1, 0.45), 0.55, 1.1), stone(z % 8 === 0 ? '#b9b2a3' : '#a9a294'), 0, 2.5);
        }
        if (style.edge === 'net') {
          props.add(CYLINDER, place(post.x, post.y + 0.7, post.z, 0, 0.09, 1.4, 0.09), colors.post);
          props.add(BOX, beam(beside(pointA, z, side, 0.9, 0.75), beside(pointB, z + span, side, 0.9, 0.75), 0.03, 0.9), z % 8 === 0 ? '#ff7a1a' : '#ff9440');
        }
        if (style.edge === 'rope') {
          props.add(CYLINDER, place(post.x, post.y + 0.45, post.z, 0, 0.18, 0.9, 0.18), colors.post);
          props.add(BOX, beam(beside(pointA, z, side, 0.9, 0.78), beside(pointB, z + span, side, 0.9, 0.78), 0.05, 0.05), '#e8d8b0');
        }
      });
    }
  }

  // A gate over the strip.
  function gate(props, z) {
    const half = HALF_WIDTH + 1.8;
    const middle = hill.center(z);
    const y = hill.base(z) - 0.4;
    const left = middle - half;
    const right = middle + half;
    if (style.gate === 'torii') {
      [left, right].forEach((x) => props.add(CYLINDER, place(x, y + 4.6, z, 0, 0.75, 9.2, 0.75), '#e0402e'));
      props.add(BOX, place(middle, y + 9.4, z, 0, half * 2 + 5, 0.75, 1), '#1f1f24');
      props.add(BOX, place(middle, y + 8.9, z, 0, half * 2 + 4, 0.5, 0.8), '#e0402e');
      props.add(BOX, place(middle, y + 7.3, z, 0, half * 2 + 1.5, 0.5, 0.6), '#e0402e');
      props.add(BOX, place(middle, y + 8.1, z, 0, 1, 1.3, 0.3), '#2e6b4f');
    }
    if (style.gate === 'timber') {
      [left, right].forEach((x) => props.add(CYLINDER, place(x, y + 3.6, z, 0, 0.5, 7.2, 0.5), '#7a5534'));
      props.add(CYLINDER, beam(pointA.set(left - 1, y + 7, z), pointB.set(right + 1, y + 7, z), 0.45), '#8a6a45');
      // Bunting.
      const flags = ['#ff5fb4', '#ffd23f', '#35c8ff', '#7cff6a', '#ff7a1a'];
      for (let i = 0; i < 15; i += 1) {
        const t = (i + 0.5) / 15;
        const sag = Math.sin(t * Math.PI) * 1.2;
        props.add(BLADE, place(left + (right - left) * t, y + 6.3 - sag, z, 0, 0.7, -0.9, 0.08), flags[i % flags.length]);
      }
    }
    if (style.gate === 'arch') {
      [left, right].forEach((x, i) => props.add(CYLINDER, place(x, y + 3.5, z, 0, 1.5, 7, 1.5), i ? '#e3242b' : '#2f6bff'));
      props.add(CYLINDER, beam(pointA.set(left - 0.6, y + 7.2, z), pointB.set(right + 0.6, y + 7.2, z), 1.5), '#f4f6fa');
      props.add(BOX, place(middle, y + 7.2, z + 0.78, 0, 6, 0.9, 0.05), '#ffd23f');
    }
    if (style.gate === 'stone') {
      [left - 0.6, right + 0.6].forEach((x) => {
        props.add(BOX, place(x, y + 4, z, 0, 2.4, 8, 2.4), '#d2a46c');
        props.add(BOX, place(x, y + 8.2, z, 0, 3, 0.6, 3), '#c9995e');
      });
      props.add(BOX, place(middle, y + 9.2, z, 0, half * 2 + 5, 1.5, 2.6), '#c9995e');
      props.add(BOX, place(middle, y + 10.2, z, 0, half * 2 + 2, 0.6, 2), '#d9b07a');
    }
  }

  // Building fronts: windows sit back in the wall, and their glass is
  // smooth and mirror-like while the wall stays rough.
  function frontsMaterial() {
    const fronts = windowsTexture('house');
    const map = texture(fronts.map);
    const finish = texture(fronts.finish);
    return new THREE.MeshStandardMaterial({
      vertexColors: true, map, normalMap: bumpsOf(texture(fronts.height), 3),
      roughnessMap: finish, metalnessMap: finish, roughness: 1, metalness: 1, envMapIntensity: 1.3,
    });
  }

  function house(props, houses, tiles, rand, x, y, z, walls, roofs) {
    const w = 6 + rand() * 4;
    const d = 5 + rand() * 4;
    const h = 5 + rand() * 3.5;
    const yaw = (rand() - 0.5) * 0.5;
    houses.add(buildingGeometry(w, h + 4, d), place(x, y + h / 2 - 2, z, yaw), walls[Math.floor(rand() * walls.length)]);
    tiles.add(ROOF, place(x, y + h + 1.2, z, yaw, w * 1.08, 2.6, d * 1.08), art.roof ? '#ffffff' : roofs[Math.floor(rand() * roofs.length)], 0, 3);
    props.add(BOX, place(x + w * 0.25, y + h + 1.6, z, yaw, 0.7, 1.8, 0.7), '#b9b2a3');
  }

  // A stone viaduct along the bank, with a train on it.
  function buildViaduct(props, walls) {
    const side = -style.seaSide;
    const out = 58;
    const top = (z) => beside(pointA, z, side, out).y + 17;
    for (let z = 0; z < LAP; z += 16) {
      const foot = beside(pointA, z, side, out);
      const x = foot.x;
      const deck = top(z);
      const tall = deck - foot.y + 6;
      walls.add(BOX, place(x, deck - tall / 2, z, 0, 3.4, tall, 3), stone(z % 32 === 0 ? '#cfc6b2' : '#c3baa6'), 0, 5);
      const next = pointB.set(hill.center(z + 16) + side * (HALF_WIDTH + out), top(z + 16), z + 16);
      const here = new THREE.Vector3(x, deck, z);
      walls.add(BOX, beam(here, next, 5, 1.4), stone('#d6cdb9'), 0, 5);
      // The arch under each span: two leaning stones meeting in the middle.
      const crown = here.clone().lerp(next, 0.5);
      crown.y -= 1.4;
      walls.add(BOX, beam(new THREE.Vector3(x, deck - 7, z + 1.5), crown, 3, 1.6), stone('#bdb4a0'), 0, 5);
      walls.add(BOX, beam(new THREE.Vector3(next.x, next.y - 7, z + 14.5), crown, 3, 1.6), stone('#bdb4a0'), 0, 5);
      [-2.4, 2.4].forEach((edge) => {
        walls.add(BOX, beam(new THREE.Vector3(x + edge, deck + 1, z), new THREE.Vector3(next.x + edge, next.y + 1, z + 16), 0.3, 0.8), stone('#c9c0ac'), 0, 5);
      });
    }
    // The train: an engine and four cars.
    for (let i = 0; i < 5; i += 1) {
      const from = 210 + i * 15;
      const a = new THREE.Vector3(hill.center(from) + side * (HALF_WIDTH + out), top(from) + 2.5, from);
      const b = new THREE.Vector3(hill.center(from + 13.5) + side * (HALF_WIDTH + out), top(from + 13.5) + 2.5, from + 13.5);
      props.add(BOX, beam(a, b, 3, 3.2), i === 4 ? '#1d3fa8' : '#2a55c8');
      a.y += 1.7;
      b.y += 1.7;
      props.add(BOX, beam(a, b, 2.6, 0.3), '#dfe6f4');
      a.y -= 1.2;
      b.y -= 1.2;
      props.add(BOX, beam(a, b, 3.06, 0.9), '#bfe2ff');
    }
  }

  // A chairlift up the bank.
  function buildLift(props) {
    const side = -style.seaSide;
    const out = 22;
    const tops = [];
    for (let z = 20; z <= LAP + 20; z += 62) {
      const foot = beside(pointA, z, side, out);
      props.add(CYLINDER, place(foot.x, foot.y + 6.5, z, 0, 0.7, 13, 0.7), '#c9cfd8');
      props.add(BOX, place(foot.x, foot.y + 13, z, 0, 6.5, 0.4, 0.5), '#c9cfd8');
      tops.push(new THREE.Vector3(foot.x, foot.y + 13, z));
    }
    for (let i = 1; i < tops.length; i += 1) {
      [-2.8, 2.8].forEach((offset, k) => {
        const a = tops[i - 1].clone().setX(tops[i - 1].x + offset);
        const b = tops[i].clone().setX(tops[i].x + offset);
        props.add(CYLINDER, beam(a, b, 0.08), '#2a2a30');
        for (let c = 0; c < 3; c += 1) {
          const at = a.clone().lerp(b, (c + 0.5 * (k + 0.5)) / 3);
          props.add(BOX, place(at.x, at.y - 1.2, at.z, 0, 0.06, 2.4, 0.06), '#3a3f4a');
          props.add(BOX, place(at.x, at.y - 2.5, at.z, 0, 1.8, 0.12, 0.6), k ? '#ff5fb4' : '#35c8ff');
          props.add(BOX, place(at.x, at.y - 2.1, at.z - 0.3, 0, 1.8, 0.9, 0.08), k ? '#ff5fb4' : '#35c8ff');
        }
      });
    }
  }

  // Poles with wires along the road.
  function buildPoles(props) {
    const side = -style.seaSide;
    const tops = [];
    for (let z = 8; z <= LAP + 8; z += 32) {
      const foot = beside(pointA, z, side, 3.2);
      props.add(CYLINDER, place(foot.x, foot.y + 4.4, z, 0, 0.24, 8.8, 0.24), '#8b8f96');
      props.add(BOX, place(foot.x, foot.y + 8.3, z, 0, 2.2, 0.15, 0.15), '#5a5e66');
      tops.push(new THREE.Vector3(foot.x, foot.y + 8.3, z));
    }
    for (let i = 1; i < tops.length; i += 1) {
      [-0.9, 0.9].forEach((offset) => {
        const a = tops[i - 1].clone().setX(tops[i - 1].x + offset);
        const b = tops[i].clone().setX(tops[i].x + offset);
        props.add(CYLINDER, beam(a, b, 0.05), '#2a2a30');
      });
    }
  }

  // Everything that stands beside the strip. `far` things are shown on
  // every copy of the lap; `near` ones only close to the rider.
  function buildScenery(far, near) {
    const rand = random(31 + hill.spec.seed);
    const big = new Props();
    const small = new Props();
    // Stonework and roof tiles get their own pictures.
    const walls = new Props();
    const tiles = new Props();
    const plants = quality.plants;

    const sheets = quality.name === 'high' ? 3 : 2;
    const turn = () => rand() * Math.PI;
    const trees = [];
    scatter(rand, Math.round(style.trees * plants), 4, 95, 'bank', (x, y, z, s) => trees.push({ x, y: y - 0.4, z, tall: style.treeHeight * (0.75 + rand() * 0.6) + s * 0.03, turn: turn() }));
    scatter(rand, Math.round(style.trees * 0.2 * plants), 4, style.shoulder, 'sea', (x, y, z) => trees.push({ x, y: y - 0.4, z, tall: style.treeHeight * (0.6 + rand() * 0.4), turn: turn() }));
    plant(far, art.trees || [], trees, sheets, true);
    const bushes = [];
    scatter(rand, Math.round(90 * plants), 2, 40, 'both', (x, y, z) => bushes.push({ x, y: y - 0.15, z, tall: 1.2 + rand() * 1.3, turn: turn() }));
    plant(far, art.bushes || [], bushes, 2, true);
    // Flowers and tall grass, thick beside the strip.
    const flowers = [];
    scatter(rand, Math.round(1500 * plants), 0.5, 22, 'both', (x, y, z) => flowers.push({ x, y: y - 0.05, z, tall: 0.5 + rand() * 0.75, turn: turn() }));
    plant(near, art.flowers || [], flowers, 2, false);
    // Boulders.
    scatter(rand, Math.round(60 * plants), 1.5, 40, 'both', (x, y, z) => {
      const size = 0.6 + rand() * 1.8;
      big.add(SPHERE, place(x, y + size * 0.2, z, rand() * 3, size * 1.5, size, size * 1.2), style.rock[rand() < 0.5 ? 0 : 1]);
    });
    [150, 370, 590].forEach((z) => gate(big, z));

    if (scenarioName === 'meadow') {
      buildViaduct(big, walls);
      const houses = new Props();
      scatter(rand, 9, 26, 46, 'bank', (x, y, z) => house(big, houses, tiles, rand, x, y, z, ['#f6f3ea', '#f1e3c8'], ['#c8553f', '#a8483a', '#7a5a48']));
      far.add(houses.mesh(frontsMaterial()));
      // White stones like the ones on the trail.
      scatter(rand, Math.round(40 * plants), 0.6, 8, 'both', (x, y, z) => {
        const size = 0.3 + rand() * 0.5;
        small.add(SPHERE, place(x, y + size * 0.25, z, rand() * 3, size * 1.6, size, size * 1.2), '#f1efe8');
      });
    }
    if (scenarioName === 'sea') {
      buildPoles(big);
      const houses = new Props();
      scatter(rand, 34, 12, 70, 'bank', (x, y, z) => house(big, houses, tiles, rand, x, y, z, ['#f6f3ea', '#f1e3c8', '#e6eef6'], ['#3f6fd8', '#d9483b', '#2fa59a', '#e8873a', '#5a5a6e']));
      far.add(houses.mesh(frontsMaterial()));
    }
    if (scenarioName === 'mountain') {
      buildLift(big);
      // A lodge, and flags down the run.
      const lodge = beside(pointA, 300, -style.seaSide, 34).clone();
      big.add(BOX, place(lodge.x, lodge.y + 2, lodge.z, 0, 14, 8, 10), '#8a5a3a');
      big.add(ROOF, place(lodge.x, lodge.y + 7.6, lodge.z, 0, 15.5, 3.6, 11.5), '#f4f8fd');
      big.add(BOX, place(lodge.x + style.seaSide * 7.05, lodge.y + 3, lodge.z, 0, 0.2, 2.4, 5), '#ffd27a');
      const flags = ['#ff5fb4', '#35c8ff', '#ffd23f', '#7cff6a'];
      for (let z = 30; z < LAP; z += 40) {
        [-1, 1].forEach((side) => {
          const at = beside(pointA, z, side, 2.2);
          small.add(CYLINDER, place(at.x, at.y + 1.5, z, 0, 0.08, 3, 0.08), '#3a3f4a');
          small.add(BOX, place(at.x - side * 0.55, at.y + 2.6, z, 0, 1.1, 0.7, 0.04), flags[(z / 40) % flags.length | 0]);
        });
      }
    }
    if (scenarioName === 'desert') {
      // Red rock towers on the bank, and ruined columns by the track.
      scatter(rand, 26, 26, 110, 'bank', (x, y, z) => {
        const wide = 8 + rand() * 16;
        const tall = 14 + rand() * 34;
        walls.add(CYLINDER, place(x, y + tall / 2 - 3, z, rand() * 3, wide, tall, wide * (0.7 + rand() * 0.4)), stone(style.rock[rand() < 0.5 ? 0 : 1]), 0.35, 14);
        big.add(CYLINDER, place(x, y + tall - 2.6, z, rand() * 3, wide * 0.8, 1.2, wide * 0.7), '#d18a54');
      });
      for (let z = 100; z < LAP; z += 54) {
        const at = beside(pointA, z, style.seaSide, 3 + (z % 3));
        const tall = 3 + rand() * 5;
        walls.add(CYLINDER, place(at.x, at.y + tall / 2, z, 0, 1.3, tall, 1.3), stone('#d9b07a'), 0.3, 4);
        big.add(BOX, place(at.x, at.y + tall + 0.2, z, 0, 1.7, 0.4, 1.7), '#c9995e');
      }
    }

    buildEdges(small, walls);
    [[walls, art.wall, 0.95], [tiles, art.roof, 0.8]].forEach(([props, image, roughness]) => {
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness });
      if (image) {
        material.map = picture(image);
        material.normalMap = bumpsOf(material.map, 3);
      }
      const mesh = props.mesh(material);
      if (mesh) {
        far.add(mesh);
      }
    });

    const bigMesh = big.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    if (bigMesh) {
      far.add(bigMesh);
    }
    const smallMesh = small.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 }));
    if (smallMesh) {
      near.add(smallMesh);
    }
  }

  /* ---------- Things to trick on ---------- */

  // The top of a piece, following the slope under it, and a skirt down to
  // the ground around it.
  function pieceGeometry(piece) {
    const along = piece.type === 'kicker' ? 10 : 2;
    const top = [];
    const uvs = [];
    const indices = [];
    const inset = 0.999;
    const point = (i, j) => {
      const u = (-piece.l / 2 + (piece.l * i) / along) * inset;
      const v = (j === 0 ? -1 : 1) * (piece.w / 2) * inset;
      const x = piece.x + piece.sin * u + piece.cos * v;
      const z = piece.z + piece.cos * u - piece.sin * v;
      return [x, hill.height(x, z), z];
    };
    for (let i = 0; i <= along; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        top.push(...point(i, j));
        uvs.push((j * piece.w) / 4, ((i / along) * piece.l) / 4);
      }
      if (i > 0) {
        const a = (i - 1) * 2;
        if (piece.cos >= 0) {
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        } else {
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    const surface = new THREE.BufferGeometry();
    surface.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
    surface.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    surface.setIndex(indices);
    surface.computeVertexNormals();

    // The outline, walked once around.
    const outline = [];
    for (let i = 0; i <= along; i += 1) {
      outline.push(point(i, 0));
    }
    for (let i = along; i >= 0; i -= 1) {
      outline.push(point(i, 1));
    }
    const walls = [];
    for (let i = 0; i < outline.length; i += 1) {
      const [ax, ay, az] = outline[i];
      const [bx, by, bz] = outline[(i + 1) % outline.length];
      const aLow = hill.base(az) - 0.4;
      const bLow = hill.base(bz) - 0.4;
      walls.push(ax, ay, az, bx, by, bz, ax, aLow, az, bx, by, bz, bx, bLow, bz, ax, aLow, az);
    }
    const skirt = new THREE.BufferGeometry();
    skirt.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3));
    skirt.computeVertexNormals();
    return { surface, skirt };
  }

  function buildPieces(group) {
    const colors = style.piece;
    const ramp = art.ramp ? picture(art.ramp) : texture(rampTexture(scenarioName));
    const tops = [];
    const skirts = [];
    const trim = new Props();
    const corner = (piece, u, v, lift = 0) => {
      const x = piece.x + piece.sin * u + piece.cos * v;
      const z = piece.z + piece.cos * u - piece.sin * v;
      return new THREE.Vector3(x, hill.base(z) + lift, z);
    };
    hill.pieces.forEach((piece) => {
      if (piece.type === 'rail') {
        const a = new THREE.Vector3(...piece.a);
        const b = new THREE.Vector3(...piece.b);
        trim.add(CYLINDER, beam(a, b, 0.11), colors.rail);
        const posts = Math.round(piece.l / 4);
        for (let i = 0; i <= posts; i += 1) {
          const at = a.clone().lerp(b, i / posts);
          const foot = hill.base(at.z);
          trim.add(CYLINDER, place(at.x, (at.y + foot) / 2 - 0.1, at.z, 0, 0.09, at.y - foot + 0.2, 0.09), colors.rail);
        }
        return;
      }
      if (piece.style === 'log') {
        // A tree trunk lying down the hill.
        const radius = piece.h / 2 + 0.03;
        trim.add(CYLINDER, beam(corner(piece, -piece.l / 2, 0, piece.h - radius), corner(piece, piece.l / 2, 0, piece.h - radius), radius * 2), colors.log);
        [-1, 1].forEach((end) => {
          const at = corner(piece, (end * piece.l) / 2, 0, piece.h - radius);
          trim.add(CYLINDER, beam(at, at.clone().setZ(at.z + end * 0.02), radius * 1.7), '#d9b98a');
        });
        return;
      }
      const made = pieceGeometry(piece);
      tops.push(made.surface);
      skirts.push(made.skirt);
      if (piece.type === 'box') {
        // Metal edges to grind along.
        const edges = piece.w <= 1.3 ? [0] : [-1, 1];
        edges.forEach((side) => {
          const v = side * (piece.w / 2 - 0.03);
          trim.add(BOX, beam(corner(piece, -piece.l / 2, v, piece.h), corner(piece, piece.l / 2, v, piece.h), piece.w <= 1.3 ? piece.w + 0.04 : 0.08, 0.06), colors.metal);
        });
      } else {
        const lip = piece.l / 2 - 0.02;
        trim.add(CYLINDER, beam(corner(piece, lip, -piece.w / 2, piece.h), corner(piece, lip, piece.w / 2, piece.h), 0.1), colors.metal);
      }
    });
    if (tops.length > 0) {
      const top = new THREE.Mesh(THREE.mergeGeometries(tops), new THREE.MeshStandardMaterial({
        map: ramp, normalMap: bumpsOf(ramp), roughness: scenarioName === 'mountain' ? 0.6 : 0.8, side: THREE.DoubleSide,
      }));
      const side = new THREE.Mesh(THREE.mergeGeometries(skirts), new THREE.MeshStandardMaterial({ color: colors.side, roughness: 0.9, side: THREE.DoubleSide }));
      [top, side].forEach((mesh) => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      });
      [...tops, ...skirts].forEach((geometry) => geometry.dispose());
    }
    const trimMesh = trim.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: scenarioName === 'desert' ? 0 : 0.55 }));
    if (trimMesh) {
      group.add(trimMesh);
    }
  }

  /* ---------- Far away ---------- */

  // The sea far below and, beyond it, the painted coast and clouds. This
  // all moves along with the rider, so it never gets nearer.
  function buildBackdrop(group) {
    const look = LOOKS[scenarioName];
    const seaY = -style.seaBelow;

    // With a painting behind it, the sea fades into the painting's own
    // sea, and mirrors the painting's sky.
    const tones = art.pano ? paintingTones(art.pano) : { sea: look.fog, horizon: look.horizon, top: look.top };
    scene.fog.color.set(look.fog).lerp(paintA.set(tones.horizon), 0.6);
    sea = createSea(7400, { detail: quality.name === 'high' });
    sea.apply({
      deep: style.sea, shallow: style.shallow, haze: tones.sea, top: tones.top, horizon: tones.horizon,
      sunColor: look.sunColor, sunDirection: skyDirection(look.sunElevation, look.sunAzimuth),
      shoreSide: style.seaSide, shoreDistance: HALF_WIDTH + style.shoulder + 80, hazeDensity: 0.00021,
    });
    sea.mesh.position.y = seaY;
    group.add(sea.mesh);

    // The hill going on up behind, for when the view turns that way.
    const behind = new THREE.Mesh(CONE, new THREE.MeshStandardMaterial({ color: new THREE.Color(style.far).lerp(paintA.set(tones.horizon), 0.5), roughness: 1, fog: false }));
    behind.position.set(-style.seaSide * 500, 700, -2300);
    behind.scale.set(5200, 2600, 4200);
    group.add(behind);
    if (art.pano) {
      group.add(farView(art.pano, seaY));
    }
  }

  // The colors of a painting's sea, of its sky just above the horizon and
  // of the top of its sky.
  function paintingTones(image) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 16;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, 8, 16);
    const row = (y) => {
      const data = ctx.getImageData(0, y, 8, 1).data;
      const sum = [0, 0, 0];
      for (let i = 0; i < data.length; i += 4) {
        sum[0] += data[i];
        sum[1] += data[i + 1];
        sum[2] += data[i + 2];
      }
      return `#${new THREE.Color().setRGB(sum[0] / 2040, sum[1] / 2040, sum[2] / 2040, THREE.SRGBColorSpace).getHexString()}`;
    };
    return { sea: row(14), horizon: row(12), top: row(1) };
  }

  // The painting of the far coast and the clouds, on a curved wall beyond
  // the sea. One copy of the picture faces the rider; mirrored copies
  // carry it on to both sides, and its edges fade into the sky.
  function farView(image, seaY) {
    const radius = 6000;
    // In the paintings the sea's horizon is this share of the way up; it
    // has to sit level with the rider's eyes.
    const horizonAt = 0.135;
    const tall = (style.seaBelow - 30) / horizonAt;
    // Half the angle one copy of the picture covers.
    const spread = (tall * image.width) / image.height / radius / 2;
    const columns = 48;
    const heights = [0, 0.02, 0.2, 0.5, 0.82, 1];
    const positions = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    for (let c = 0; c <= columns; c += 1) {
      const t = c / columns;
      const angle = spread * 2 * (1 - 2 * t);
      heights.forEach((v, r) => {
        positions.push(Math.sin(angle) * radius, seaY + v * tall, Math.cos(angle) * radius);
        uvs.push(-0.5 + 2 * t, v);
        const sides = Math.min(smoothstep(0, 0.1, t), smoothstep(1, 0.9, t));
        const fade = sides * (r === 0 ? 0 : 1) * (1 - smoothstep(0.8, 1, v));
        colors.push(1.12, 1.12, 1.12, fade);
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

  /* ---------- Letters ---------- */

  function buildLetters(word) {
    letters = hill.letters.map((spot, i) => {
      const map = own(letterTexture(word[i], LETTER_COLORS[i % LETTER_COLORS.length]));
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: new THREE.Color(1.3, 1.3, 1.3), transparent: true, depthWrite: false }));
      sprite.position.set(spot.x, spot.y, spot.z);
      sprite.scale.setScalar(1.7);
      world.add(sprite);
      return { sprite, spot, base: spot.y, collected: false, pop: 0, color: LETTER_COLORS[i % LETTER_COLORS.length] };
    });
  }

  // Each letter floats at its place on the lap ahead: once the rider has
  // passed it, it waits on the next lap.
  function placeLetters(riderZ) {
    letters.forEach((letter) => {
      if (letter.collected) {
        return;
      }
      const lap = Math.ceil((riderZ - 14 - letter.spot.z) / LAP);
      letter.base = letter.spot.y - lap * DROP;
      letter.sprite.position.x = letter.spot.x;
      letter.sprite.position.z = letter.spot.z + lap * LAP;
    });
  }

  // Lines the copies of the lap up from the one behind the rider onward.
  function placeLaps(lap) {
    shownLap = lap;
    slots.forEach((slot) => {
      slot.group.position.set(0, -(lap + slot.offset) * DROP, (lap + slot.offset) * LAP);
    });
  }

  function buildWorld(word) {
    world = new THREE.Group();
    const far = new THREE.Group();
    const near = new THREE.Group();
    buildTerrain(far);
    buildTrack(far);
    buildScenery(far, near);
    buildPieces(near);
    // One copy behind the rider, the one they are on, and the ones ahead.
    // Only the first two ahead need the small things.
    for (let offset = -1; offset < quality.laps; offset += 1) {
      const group = new THREE.Group();
      const hillside = offset === 0 ? far : far.clone();
      if (offset !== 0 && offset !== 1) {
        hillside.traverse((object) => {
          object.castShadow = false;
        });
      }
      group.add(hillside);
      if (offset === 0 || offset === 1) {
        group.add(offset === 0 ? near : near.clone());
      }
      world.add(group);
      slots.push({ offset, group });
    }
    backdrop = new THREE.Group();
    buildBackdrop(backdrop);
    world.add(backdrop);
    buildLetters(word);
    placeLaps(0);
    scene.add(world);
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

  let frameAverage = 16;
  let lastAdapt = 0;
  let filmTime = 0;

  return {
    renderer,
    camera,
    scene,
    effects,

    // Builds a hill; resolves with its riding data (see world.js), or
    // with null if another hill was asked for while this one was loading.
    async setScenario(name, word) {
      building += 1;
      const mine = building;
      const loaded = await loadArt(name);
      if (mine !== building) {
        return null;
      }
      disposeWorld();
      art = loaded;
      scenarioName = name;
      style = STYLES[name];
      hill = buildHill(name);
      applyLook(LOOKS[name]);
      updateEnvironment();
      buildWorld(word);
      const air = WEATHER[name];
      weather.visible = Boolean(air);
      if (air) {
        weatherMaterial.color.set(air.color);
        weatherMaterial.size = air.size;
        weatherMaterial.opacity = air.opacity;
      }
      return hill;
    },

    // Shows the letters again, with new faces if the word changed.
    resetLetters(word) {
      letters.forEach(({ sprite }) => {
        world.remove(sprite);
        sprite.material.map.dispose();
        owned.delete(sprite.material.map);
        sprite.material.dispose();
      });
      buildLetters(word);
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

    // What the board or wheels kick up here.
    groundKind() {
      return style.kind;
    },

    // The sun, its shadows, the laps and the far view follow the rider.
    follow(x, y, z) {
      sun.target.position.set(x, y, z);
      sun.position.set(x + lightDirection.x * 120, y + lightDirection.y * 120, z + lightDirection.z * 120);
      const lap = hill.lapOf(z);
      if (lap !== shownLap) {
        placeLaps(lap);
      }
      placeLetters(z);
      backdrop.position.set(x, y, z);
    },

    animate(dt, time, cameraPosition) {
      sky.setTime(time);
      filmTime = time;
      sky.mesh.position.copy(cameraPosition);
      sea.update(time, backdrop.position);
      letters.forEach((letter, i) => {
        if (letter.collected && letter.pop === 0) {
          return;
        }
        letter.sprite.position.y = letter.base + Math.sin(time * 2.5 + i) * 0.25;
        letter.sprite.scale.setScalar(1.7 + Math.sin(time * 4 + i) * 0.08);
        if (letter.pop > 0) {
          letter.pop += dt * 3;
          letter.sprite.scale.setScalar(Math.max(0.01, 1.7 * (1 - letter.pop)));
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
      if (frameAverage > 28 && pipeline.bloomOn && now - lastAdapt > 3000) {
        lastAdapt = now;
        pipeline.dropBloom();
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

    render() {
      pipeline.render(filmTime);
    },
  };
}
