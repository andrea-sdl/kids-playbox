import { THREE } from './model-kit.js';
import { places, road, clamp, memoryLength } from './world.js';
import {
  valleyFloor,
  span,
  startX,
  worldX,
  laneDepth,
  height as groundHeight,
} from './ground.js';
import { dawnSky } from './dawn-sky.js';
import { woodland } from './woodland.js';
import { landmark } from './landmarks.js';
import { batchLandmark } from './static-batch.js';
import { discovery, memoryRoom } from './discoveries.js';
import { guardianModel, shipModel, birdModel } from './models-guardian.js';

const smooth = (x) => THREE.MathUtils.smoothstep(x, 0, 1);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function contactShadow(width, depth) {
  const geometry = new THREE.CircleGeometry(1, 32);
  geometry.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x273a38,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(geometry, mat);
  shadow.scale.set(width, 1, depth);
  return shadow;
}

export function createDiscoveryRenderer(canvas) {
  const gpu = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  const stage = canvas.parentElement;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#5d5143');
  scene.fog = new THREE.Fog('#bbbcb0', 37, 89);
  const camera = new THREE.OrthographicCamera(-12, 12, 7.5, -7.5, 0.1, 145);
  scene.add(new THREE.HemisphereLight(0xfff1de, 0x8e9e92, 1.65));
  const morning = new THREE.DirectionalLight(0xffdda4, 2.08);
  morning.position.set(-12, 15, 8);
  scene.add(morning);
  const sky = dawnSky(),
    ground = valleyFloor(),
    guardian = guardianModel(),
    ship = shipModel();
  const shadow = contactShadow(0.95, 0.4),
    shipShadow = contactShadow(1.75, 0.6);
  const birds = Array.from({ length: 6 }, () => birdModel());
  scene.add(
    sky.group,
    ground.group,
    guardian.group,
    shadow,
    ship.group,
    shipShadow,
    ...birds.map((b) => b.group),
  );
  const chunks = new Map(),
    memories = new Map();
  let width = 0, height = 0, aspect = 1;
  function build(name) {
    const part = new THREE.Group();
    const architecture = batchLandmark(landmark(name));
    architecture.position.x = worldX(name, 0.5);
    part.add(architecture);
    if (name !== 'hearth') {
      const plants = woodland(name, road.indexOf(name), span, (x, z) =>
        groundHeight(startX(name) + x, z),
      );
      plants.position.x = startX(name);
      part.add(plants);
    }
    for (const id of Object.keys(places[name].points)) {
      if (id === 'ship' || id === 'passage') continue;
      const model = discovery(id);
      memories.set(id, model);
      part.add(model.group);
    }
    scene.add(part);
    const chunk = { part, architecture };
    chunks.set(name, chunk);
    return chunk;
  }
  function showGround(name, cameraX, time) {
    const inside = name === 'hearth';
    sky.group.visible = ground.group.visible = !inside;
    sky.update(cameraX, time);
    ground.update(time);
    for (const place of [...road, 'hearth']) {
      const visible = inside
        ? place === 'hearth'
        : place !== 'hearth' && Math.abs(worldX(place, 0.5) - cameraX) < camera.right + span * 1.08;
      if (!visible && !chunks.has(place)) continue;
      const chunk = chunks.get(place) || build(place);
      chunk.part.visible = visible;
      if (visible) chunk.architecture.userData.update?.(time);
    }
  }

  function size() {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    aspect = w / h;
    gpu.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5, 2048 / w));
    gpu.setSize(w, h, false);
  }
  function frame(x, y, z, vertical, dx = 0, dz = 30, tilt = 0.17) {
    const half = vertical / 2;
    camera.top = half;
    camera.bottom = -half;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.position.set(x + dx, y + dz * tilt, z + dz);
    camera.lookAt(x, y, z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }
  function interests(state, film, time) {
    for (const [id, model] of memories) {
      const part = chunks.get(model.room).part;
      if (!part.visible) continue;
      const active = id === film.kind;
      const found = state.found.has(id);
      model.group.visible = active || film.kind === 'ship';
      if (!model.group.visible) continue;
      model.pose(active ? clamp(film.age / memoryLength, 0, 1) : Number(found), time);
    }
    shipShadow.visible = ship.group.visible = film.kind === 'ship';
    if (!ship.group.visible) return;
    const age = film.age;
    const lift = smooth((age - 1.05) / 2.28);
    const burst = Math.max(age - 3.48, 0) ** 2;
    ship.group.position.set(
      worldX('grove', 0.71) + burst * 3.15,
      0.05 + lift * 1.45 + burst * 3.25,
      -1.95,
    );
    ship.pose({ step: state.shipStep, age, time });
    shipShadow.position.set(worldX('grove', 0.71), 0.018, -1.95);
    shipShadow.material.opacity = 0.25 * (1 - lift * 0.75);
  }
  function poseLaunch(film, time) {
    const launch = film.kind === 'ship';
    const player = guardian.group;
    player.visible = shadow.visible = launch;
    const x = worldX('grove', 0.575);
    const z = laneDepth(0.824);
    if (launch) {
      player.position.set(x, 0.065, z);
      guardian.pose({ phase: 0, walk: 0, facing: 1, crouch: 0, flight: 0, time });
      shadow.position.set(x, 0.095, z);
    }
    for (const [i, bird] of birds.entries()) {
      bird.group.visible = launch;
      if (!launch) continue;
      const friend = i === 0;
      const b = time * (friend ? 0.63 : 0.27) + i * 0.79;
      if (friend) {
        bird.group.position.set(
          player.position.x + Math.sin(b) * 2.8,
          player.position.y + 3.65 + Math.cos(b * 2.2) * 0.38,
          z - 0.8 + Math.cos(b) * 0.9,
        );
      } else {
        const flee = Math.max(0, film.age - 0.7);
        bird.group.position.set(
          x + (i - 3) * 1.73 + Math.sin(b) * 3 + flee * 2.7,
          4.9 + i * 0.43 + Math.sin(b * 0.88) * 0.47 + flee * 1.55,
          -5 - i * 0.8,
        );
      }
      bird.group.rotation.y = Math.cos(b) < 0 ? Math.PI - 0.35 : 0.35;
      bird.group.rotation.z = Math.cos(b * 2.2) * 0.14;
      bird.group.scale.setScalar(friend ? 1.55 : 1.15);
      bird.pose(time + i * 0.44);
    }
  }
  function render(state, film, time) {
    size();
    const place = memoryRoom(film.kind);
    let focus;
    if (film.kind !== 'ship') {
      if (!chunks.has(place)) build(place);
      const item = memories.get(film.kind);
      const p = clamp(film.age / memoryLength, 0, 1);
      focus = item.center.x;
      const orbit = reduced.matches ? 0 : (p - 0.5) * 0.72;
      frame(
        focus,
        item.center.y,
        item.center.z,
        Math.max(item.shotHeight, item.shotWidth / aspect),
        orbit,
        4.5,
        place === 'marsh' ? 0.07 : 0.19,
      );
    } else {
      focus = worldX('grove', 0.71);
      const rise = smooth((film.age - 0.65) / 1.45);
      if (film.age < 0.9) frame(focus - 0.33, 1.02, -1.35, Math.max(2.35, 3 / aspect), 0.5, 3.6, 0.12);
      else
        frame(focus + 0.3 + rise * 0.85, 1.6 + rise * 1.9, -1.8, Math.max(6.4 + rise * 3, 5 / aspect));
    }
    showGround(place, focus, time);
    interests(state, film, time);
    poseLaunch(film, time);
    gpu.render(scene, camera);
  }
  return { render };
}
