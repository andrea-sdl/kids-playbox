import { THREE } from './model-kit.js';
import { places, road, doors, clamp, memoryLength } from './world.js';
import {
  valleyFloor,
  span,
  tileWidth,
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
const templeFloor = 0.065;

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

export function createRenderer(canvas, spots, ways) {
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
  const box = new THREE.Vector3(),
    aim = new THREE.Vector3();
  const ray = new THREE.Raycaster(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let room = 'meadow',
    width = 0,
    height = 0,
    aspect = 1;
  let walkBlend = 0;
  let lastTime = 0;
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
      const active = id === film?.kind;
      const found = state.found.has(id);
      model.group.visible =
        (!film || active || film.kind === 'ship' || film.kind === 'ending') &&
        (active || !(id.startsWith('coin') && found));
      if (!model.group.visible) continue;
      const progress = active ? clamp(film.age / memoryLength, 0, 1) : Number(found);
      model.pose(progress, time);
    }
    const groveVisible = chunks.get('grove')?.part.visible;
    const launch = film?.kind === 'ship';
    ship.group.visible = Boolean(
      groveVisible && (launch || !state.found.has('ship')) && (!film || launch),
    );
    shipShadow.visible = ship.group.visible;
    if (!ship.group.visible) return;
    const age = launch ? film.age : 0;
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
  function poseActors(state, motion, film, time, dt) {
    const finale = film?.kind === 'ending',
      launch = film?.kind === 'ship';
    const close = film && !finale && !launch;
    const age = film?.age ?? 0;
    const x = worldX(state.room, state.x);
    const z = laneDepth(state.y);
    const lift = finale ? Math.max(0, age - 2.15) ** 1.6 : 0;
    const flight = smooth((age - 2) / 0.8) * Number(finale);
    const player = guardian.group;
    player.visible = !close;
    walkBlend = THREE.MathUtils.damp(walkBlend, Number(motion.walking && !film), 13, dt);
    player.position.set(x + flight * Math.max(0, age - 3) * 1.4, templeFloor + lift, z);
    const crouch = finale ? 1 - smooth((age - 0.4) / 1.8) : smooth((motion.kneel - time) / 1.4);
    guardian.pose({
      phase: motion.stride * 3.8,
      walk: walkBlend,
      facing: motion.facing,
      crouch,
      flight,
      time,
    });
    shadow.position.set(x, 0.095, z);
    shadow.visible = player.visible && lift < 5;
    shadow.material.opacity = 0.28 / (1 + lift * 0.6);
    for (const [i, bird] of birds.entries()) {
      const friend = i === 0;
      bird.group.visible =
        !close &&
        state.room !== 'hearth' &&
        (friend || launch || state.room === 'meadow' || state.room === 'ridge');
      if (!bird.group.visible) continue;
      const b = time * (friend ? 0.63 : 0.27) + i * 0.79;
      if (friend) {
        bird.group.position.set(
          player.position.x + Math.sin(b) * 2.8,
          player.position.y + 3.65 + Math.cos(b * 2.2) * 0.38,
          z - 0.8 + Math.cos(b) * 0.9,
        );
      } else {
        const flee = launch ? Math.max(0, age - 0.7) : 0;
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
  function updateSpots(state, time, motion) {
    for (const button of spots.children) {
      const id = button.dataset.id;
      const model = memories.get(id);
      if (model) box.copy(model.anchor);
      else if (id === 'ship') box.copy(ship.group.position).y += 1.65;
      else box.set(worldX('falls', 0.565), 1.8, -3.4);
      project(button, box);
      if (id.startsWith('coin'))
        button.classList.toggle('glint', motion.walking && Math.sin(time * 3.7 + box.x * 4) > 0.62);
    }
    const door = doors[state.room];
    if (door && ways.firstChild) {
      box.set(worldX(state.room, door.x), 1.75, state.room === 'hearth' ? -7.8 : -2.7);
      project(ways.firstChild, box);
    }
  }
  function project(button, anchor) {
    aim.copy(anchor).project(camera);
    button.hidden = Math.abs(aim.x) > 1.03 || Math.abs(aim.y) > 1;
    if (button.hidden) return;
    button.style.left = (aim.x + 1) * 50 + '%';
    button.style.top = (1 - aim.y) * 50 + '%';
  }
  function render(state, motion, film, time) {
    size();
    const dt = clamp(time - lastTime, 0, 0.12);
    lastTime = time;
    room = state.room;
    const close = film && memoryRoom(film.kind) && film.kind !== 'ship';
    const place = close ? memoryRoom(film.kind) : state.room;
    const x = worldX(state.room, state.x);
    const realHeight = place === 'hearth' ? 11.6 : 14.5;
    frame(x, place === 'hearth' ? 3.65 : 4.35, 0, realHeight);
    let focus = x;
    if (close) {
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
    } else if (film?.kind === 'ship') {
      focus = worldX('grove', 0.71);
      const rise = smooth((film.age - 0.65) / 1.45);
      if (film.age < 0.9) frame(focus - 0.33, 1.02, -1.35, Math.max(2.35, 3 / aspect), 0.5, 3.6, 0.12);
      else
        frame(focus + 0.3 + rise * 0.85, 1.6 + rise * 1.9, -1.8, Math.max(6.4 + rise * 3, 5 / aspect));
    } else if (film?.kind === 'ending') {
      const age = film.age,
        lift = Math.max(0, age - 2.15) ** 1.6;
      focus = x + smooth((age - 2) / 0.8) * Math.max(0, age - 3) * 1.4;
      frame(focus, 2.2 + lift * 0.91, laneDepth(state.y), 7.2 + smooth((age - 2.4) / 2.8) * 7);
    } else if (place === 'hearth') {
      focus = clamp(x, Math.min(14, camera.right), Math.max(14, 28 - camera.right));
      frame(focus, 3.65, 0, realHeight);
    }
    showGround(place, focus, time);
    interests(state, film, time);
    poseActors(state, motion, film, time, dt);
    if (!film) updateSpots(state, time, motion);

    gpu.render(scene, camera);
  }
  return {
    render,
    point(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          (2 * (clientX - rect.left)) / rect.width - 1,
          1 - (2 * (clientY - rect.top)) / rect.height,
        ),
        camera,
      );
      ray.ray.intersectPlane(plane, box);
      return { x: (box.x - startX(room)) / tileWidth, y: 0.82 + box.z / 34 };
    },
  };
}
