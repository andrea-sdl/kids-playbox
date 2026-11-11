// The 3D scene: baseplate, lawn, hills and clouds, sky, sun and moon,
// blocks, the "ghost" preview, camera controls and picking. The sky lights
// and reflects on the blocks, textured blocks have bumps worked out from
// their pictures, and the picture is finished like a photo: glow, sun
// shafts, a lens flare and color grading (see gfx/post.js). Renders only
// when something changes, to save battery.

import * as THREE from '../../vendor/three/three.min.js';
import { GRID, footprint, sunForHour } from './world.js';
import { CELL_HEIGHT, geometryFor } from './shapes.js';
import { createPipeline } from '../../gfx/post.js';
import { normalMapFrom } from '../../gfx/surface.js';

const HALF = GRID / 2;

const TEXTURE_ROUGHNESS = {
  brick: 0.9, stone: 0.95, wood: 0.7, marble: 0.25, metal: 0.35, fabric: 1, tiles: 0.3, leaves: 0.85,
};

// How deep each texture's bumps look.
const TEXTURE_BUMPS = {
  brick: 3.2, stone: 3.4, wood: 1.6, marble: 0.5, metal: 1.2, fabric: 2.6, tiles: 2.8, leaves: 3,
};

// Grass for the lawn, drawn in code: soft patches and many short blades.
function grassPicture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#69a94a';
  ctx.fillRect(0, 0, size, size);
  // A fixed sequence of numbers, so the lawn looks the same every visit.
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 60; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const radius = 40 + rand() * 90;
    // Drawn at every edge too, so the picture repeats without a seam.
    [-size, 0, size].forEach((dx) => {
      [-size, 0, size].forEach((dy) => {
        const patch = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
        patch.addColorStop(0, rand() < 0.5 ? 'rgba(40, 90, 30, 0.09)' : 'rgba(150, 200, 90, 0.08)');
        patch.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = patch;
        ctx.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
      });
    });
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 9000; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const green = 110 + Math.floor(rand() * 110);
    ctx.strokeStyle = `rgba(${Math.floor(green * 0.5)}, ${green}, ${Math.floor(green * 0.3)}, 0.7)`;
    ctx.lineWidth = 1 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 6, y - 4 - rand() * 9);
    ctx.stroke();
  }
  return canvas;
}

// A soft dark ring for under the baseplate: where it meets the lawn.
function shadePicture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const shade = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
  shade.addColorStop(0, 'rgba(0, 20, 0, 0.55)');
  shade.addColorStop(0.72, 'rgba(0, 20, 0, 0.42)');
  shade.addColorStop(1, 'rgba(0, 20, 0, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 256, 256);
  return canvas;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

export function createScene(container, { onReady } = {}) {
  // Phones get the short version of the finishing pass, and smaller shadows.
  const phone = Math.min(window.screen.width, window.screen.height) < 700 || window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe8ff, 60, 160);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(15, 9, 21);

  const pipeline = createPipeline(renderer, scene, camera, { full: !phone, msaa: phone ? 2 : 4, halfBloom: phone });

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 5;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.screenSpacePanning = true;

  /* ---------- Sky, sun, moon, stars ---------- */

  const sky = new THREE.Sky();
  sky.scale.setScalar(4000);
  const skyUniforms = sky.material.uniforms;
  skyUniforms.turbidity.value = 6;
  skyUniforms.rayleigh.value = 2.2;
  skyUniforms.mieCoefficient.value = 0.005;
  skyUniforms.mieDirectionalG.value = 0.8;
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  // Smaller shadow maps on phones: cheaper, and the screen is small anyway.
  let shadowSize = 2048;
  if (phone) {
    shadowSize = 1024;
  }
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const moon = new THREE.DirectionalLight(0x9db8ff, 0);
  scene.add(moon);

  const hemisphere = new THREE.HemisphereLight(0xcfe8ff, 0x4a6b3a, 1);
  scene.add(hemisphere);

  // A soft light from behind the viewer, so the sides you look at are never
  // too dark to see their colors.
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(0.3, 0.6, 1);
  camera.add(fill);
  scene.add(camera);

  // The moon, opposite the sun: brighter than white, so it glows.
  const moonDisc = new THREE.Mesh(
    new THREE.SphereGeometry(26, 24, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.8, 2.1), fog: false }),
  );
  scene.add(moonDisc);

  // The sky also lights the blocks and shows in their shine. It is redrawn
  // into a small all-around picture a moment after the time changes.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  const skyCopy = new THREE.Mesh(sky.geometry, sky.material);
  skyCopy.scale.setScalar(100);
  skyScene.add(skyCopy);
  let environment = null;
  let environmentTimer = null;

  function updateEnvironment() {
    const next = pmrem.fromScene(skyScene, 0.03, 0.1, 200).texture;
    environment?.dispose();
    environment = next;
    scene.environment = environment;
    requestRender();
  }

  function scheduleEnvironment() {
    clearTimeout(environmentTimer);
    environmentTimer = setTimeout(updateEnvironment, 140);
  }

  const starPositions = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    starPositions[i * 3] = 1500 * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = 1500 * Math.cos(phi);
    starPositions[i * 3 + 2] = 1500 * Math.sin(phi) * Math.sin(theta);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  /* ---------- Ground: a studded baseplate on a big lawn ---------- */

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const grass = new THREE.CanvasTexture(grassPicture());
  grass.colorSpace = THREE.SRGBColorSpace;
  const grassBumps = normalMapFrom(grass.image, { strength: 3 });
  [grass, grassBumps].forEach((texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(110, 110);
    texture.anisotropy = anisotropy;
  });
  const lawn = new THREE.Mesh(
    new THREE.CircleGeometry(400, 64),
    new THREE.MeshStandardMaterial({ map: grass, normalMap: grassBumps, roughness: 1, envMapIntensity: 0.4 }),
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = -0.21;
  lawn.receiveShadow = true;
  scene.add(lawn);

  // The grass is darker right around the plate.
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID * 1.55, GRID * 1.55),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadePicture()), transparent: true, depthWrite: false }),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = -0.2;
  scene.add(shade);

  // Far away: rolling hills in the haze, and a few clouds that take the
  // color of the sun.
  const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x5c9a48, roughness: 1, envMapIntensity: 0.3 });
  const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, fog: false, envMapIntensity: 0.6 });
  const blob = new THREE.SphereGeometry(1, 20, 12);
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2 + Math.sin(i * 7.3) * 0.2;
    const far = 96 + ((i * 37) % 50);
    const hill = new THREE.Mesh(blob, hillMaterial);
    hill.position.set(Math.cos(angle) * far, -3, Math.sin(angle) * far);
    hill.scale.set(26 + ((i * 13) % 22), 9 + ((i * 5) % 9), 22 + ((i * 11) % 18));
    scene.add(hill);
  }
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + 0.4;
    const far = 230 + ((i * 53) % 120);
    for (let k = 0; k < 5; k += 1) {
      const puff = new THREE.Mesh(blob, cloudMaterial);
      const size = 16 + ((i * 7 + k * 5) % 14);
      puff.position.set(Math.cos(angle) * far + (k - 2) * 15, 80 + ((i * 17) % 40) + (k % 2) * 5, Math.sin(angle) * far + ((k * 9) % 12));
      puff.scale.set(size, size * 0.55, size * 0.8);
      scene.add(puff);
    }
  }

  const plateMaterial = new THREE.MeshPhysicalMaterial({ color: 0x3fa34d, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(GRID, 0.2, GRID), plateMaterial);
  plate.position.y = -0.1;
  plate.receiveShadow = true;
  plate.userData.isGround = true;
  scene.add(plate);

  const plateStuds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 16), plateMaterial, GRID * GRID);
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let x = 0; x < GRID; x += 1) {
    for (let z = 0; z < GRID; z += 1) {
      matrix.makeTranslation(x - HALF + 0.5, 0.07, z - HALF + 0.5);
      plateStuds.setMatrixAt(index, matrix);
      index += 1;
    }
  }
  plateStuds.receiveShadow = true;
  plateStuds.castShadow = true;
  scene.add(plateStuds);

  /* ---------- Materials and textures ---------- */

  const textureLoader = new THREE.TextureLoader();
  const textures = new Map();
  const materials = new Map();

  // If a texture can't load (e.g. offline before it was saved), fall back
  // to plain color instead of showing black blocks.
  function dropTexture(name) {
    materials.forEach((material, key) => {
      if (key.endsWith(`-${name}`)) {
        material.map = null;
        material.needsUpdate = true;
      }
    });
    requestRender();
  }

  const bumps = new Map();

  // Once a texture's picture is here, its bumps are worked out from it and
  // given to every material that uses it.
  function addBumps(name, texture) {
    const normalMap = normalMapFrom(texture.image, { strength: TEXTURE_BUMPS[name], size: { width: 512, height: 512 } });
    normalMap.anisotropy = texture.anisotropy;
    bumps.set(name, normalMap);
    materials.forEach((material, key) => {
      if (key.endsWith(`-${name}`)) {
        material.normalMap = normalMap;
        material.needsUpdate = true;
      }
    });
    requestRender();
  }

  function loadTexture(name) {
    if (!textures.has(name)) {
      const texture = textureLoader.load(`art/tex-${name}.webp`, (loaded) => addBumps(name, loaded), undefined, () => dropTexture(name));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures.set(name, texture);
    }
    return textures.get(name);
  }

  function materialFor(color, texture) {
    const key = `${color}-${texture}`;
    if (!materials.has(key)) {
      let material = null;
      if (texture) {
        let metalness = 0;
        if (texture === 'metal') {
          metalness = 0.6;
        }
        material = new THREE.MeshStandardMaterial({
          color,
          map: loadTexture(texture),
          normalMap: bumps.get(texture) || null,
          roughness: TEXTURE_ROUGHNESS[texture],
          metalness,
        });
      } else {
        // Shiny toy plastic, with a clear glossy coat that shows the sky.
        material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.14 });
      }
      materials.set(key, material);
    }
    return materials.get(key);
  }

  /* ---------- Blocks ---------- */

  const blockGroup = new THREE.Group();
  scene.add(blockGroup);
  const meshes = new Map(); // id -> mesh
  const animations = [];

  function placeMesh(mesh, block) {
    const [width, depth] = footprint(block.shape, block.rotation);
    mesh.position.set(block.x - HALF + width / 2, block.y * CELL_HEIGHT, block.z - HALF + depth / 2);
    mesh.rotation.y = -block.rotation * (Math.PI / 2);
  }

  function addBlock(id, block, { animate = false } = {}) {
    const studs = !block.texture;
    const mesh = new THREE.Mesh(geometryFor(block.shape, studs), materialFor(block.color, block.texture));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.blockId = id;
    placeMesh(mesh, block);
    blockGroup.add(mesh);
    meshes.set(id, mesh);
    if (animate) {
      animations.push({ mesh, start: performance.now(), y: mesh.position.y });
    }
    requestRender();
  }

  function removeBlock(id) {
    const mesh = meshes.get(id);
    if (!mesh) {
      return;
    }
    blockGroup.remove(mesh);
    meshes.delete(id);
    requestRender();
  }

  function updateBlock(id, block) {
    const mesh = meshes.get(id);
    if (!mesh) {
      return;
    }
    mesh.geometry = geometryFor(block.shape, !block.texture);
    mesh.material = materialFor(block.color, block.texture);
    requestRender();
  }

  function clearBlocks() {
    blockGroup.clear();
    meshes.clear();
    requestRender();
  }

  // Blocks drop in with a little bounce.
  function runAnimations(now) {
    for (let i = animations.length - 1; i >= 0; i -= 1) {
      const animation = animations[i];
      const t = Math.min(1, (now - animation.start) / 280);
      const drop = (1 - t) ** 2 * 1.5;
      const squash = 1 + Math.sin(t * Math.PI) * 0.06;
      animation.mesh.position.y = animation.y + drop;
      animation.mesh.scale.set(squash, 1 / squash, squash);
      if (t >= 1) {
        animation.mesh.position.y = animation.y;
        animation.mesh.scale.set(1, 1, 1);
        animations.splice(i, 1);
      }
    }
  }

  /* ---------- Ghost preview ---------- */

  const ghostMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
  const ghost = new THREE.Mesh(geometryFor('brick', true), ghostMaterial);
  ghost.visible = false;
  scene.add(ghost);

  function setGhost(block, valid) {
    if (!block) {
      if (ghost.visible) {
        ghost.visible = false;
        requestRender();
      }
      return;
    }
    ghost.geometry = geometryFor(block.shape, !block.texture);
    // Red when the block doesn't fit there.
    ghostMaterial.color.set('#ff3b3b');
    ghostMaterial.opacity = 0.35;
    if (valid) {
      ghostMaterial.color.set(block.color);
      ghostMaterial.opacity = 0.5;
    }
    placeMesh(ghost, block);
    ghost.position.y += 0.01;
    ghost.visible = true;
    requestRender();
  }

  /* ---------- Picking ---------- */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function cellOfPoint(point) {
    return [Math.floor(point.x + HALF), Math.floor(point.y / CELL_HEIGHT), Math.floor(point.z + HALF)];
  }

  // What is under the screen point: the block hit (if any), and the empty
  // cell next to the face that was hit (where a new block would go).
  function pick(clientX, clientY) {
    // Blocks still dropping in would be hit in the wrong place: land them.
    runAnimations(Number.POSITIVE_INFINITY);
    // The camera and blocks may have moved since the last frame was drawn.
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([...blockGroup.children, plate, plateStuds], false);
    if (hits.length === 0) {
      return null;
    }
    const hit = hits[0];
    const blockId = hit.object.userData.blockId ?? null;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (blockId === null) {
      // Ground or baseplate stud: build on the plate.
      const cell = cellOfPoint(hit.point);
      cell[1] = 0;
      return { blockId: null, cell };
    }
    // Snap the face direction to the nearest axis and step into the next cell.
    let axis = 'x';
    ['y', 'z'].forEach((key) => {
      if (Math.abs(normal[key]) > Math.abs(normal[axis])) {
        axis = key;
      }
    });
    const step = { x: 0, y: 0, z: 0 };
    step[axis] = Math.sign(normal[axis]);
    const inside = hit.point.clone().addScaledVector(normal, -0.02);
    const insideCell = cellOfPoint(inside);
    const cell = [insideCell[0] + step.x, insideCell[1] + step.y, insideCell[2] + step.z];
    return { blockId, cell };
  }

  /* ---------- Time of day ---------- */

  const sunDirection = new THREE.Vector3();
  const warm = new THREE.Color(0xffa25c);
  const white = new THREE.Color(0xfff4e0);
  const daySky = new THREE.Color(0xcfe8ff);
  const nightSky = new THREE.Color(0x3a4a8a);
  const dayGround = new THREE.Color(0x4a6b3a);
  const nightGround = new THREE.Color(0x1c2a3a);
  const sunsetGlow = new THREE.Color(0xffa27a);

  function setTime(hour) {
    const { elevation, azimuth, daylight } = sunForHour(hour);
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    sunDirection.setFromSphericalCoords(1, phi, theta);
    skyUniforms.sunPosition.value.copy(sunDirection);

    sun.position.copy(sunDirection).multiplyScalar(60);
    sun.intensity = 2.6 * Math.max(0, Math.min(1, (elevation + 2) / 12));
    // Low sun is warm and orange; high sun is white.
    sun.color.copy(warm).lerp(white, Math.min(1, Math.max(0, elevation / 35)));
    sun.castShadow = elevation > 0;

    moon.position.copy(sunDirection).multiplyScalar(-60);
    moon.intensity = 1.4 * (1 - daylight);
    moonDisc.position.copy(sunDirection).multiplyScalar(-1400);
    moonDisc.visible = daylight < 0.6;

    // Nights are moonlit, not black, so building still works. (The sky's
    // own light comes on top of these, see updateEnvironment.)
    hemisphere.intensity = mix(1.35, 1.05, daylight);
    fill.intensity = mix(0.45, 0.65, daylight);
    // The day sky is very bright, so a little of it goes a long way.
    scene.environmentIntensity = mix(0.35, 0.07, Math.min(1, daylight / 0.3));
    scheduleEnvironment();
    hemisphere.color.copy(nightSky).lerp(daySky, daylight);
    hemisphere.groundColor.copy(nightGround).lerp(dayGround, daylight);
    // Around sunrise and sunset, everything gets a warm glow.
    const glow = Math.max(0, 1 - Math.abs(elevation - 2) / 14);
    hemisphere.color.lerp(sunsetGlow, glow * 0.6);

    scene.fog.color.copy(nightSky).lerp(daySky, daylight);
    starMaterial.opacity = Math.max(0, 1 - daylight / 0.35);
    renderer.toneMappingExposure = mix(0.7, 0.85, daylight);
    // The lens: more glow at night and at sunset, shafts while the sun is up.
    pipeline.setSun(sunDirection);
    pipeline.look({
      // By day this sky is many times brighter than white, so only the
      // sun itself may glow. At night the moon, the stars and the shine
      // on the blocks do.
      bloom: mix(0.45, 0.25, daylight) + glow * 0.2,
      threshold: mix(1.2, 40, Math.min(1, daylight / 0.3)),
      radius: 0.55,
      rays: 0.3 * Math.min(1, Math.max(0, (elevation + 2) / 10)),
      rayFloor: 30,
      flare: 0.7,
      sunColor: `#${sun.color.getHexString()}`,
      vignette: mix(0.32, 0.26, daylight),
      grain: 0.018,
      aberration: 0.006,
      saturation: 1.1,
      contrast: 1.05,
      tint: glow > 0.3 ? '#fff0dc' : '#fffaf2',
      shadowTint: daylight > 0.5 ? '#00030a' : '#02041a',
    });
    requestRender();
  }

  /* ---------- Camera zoom ---------- */

  function zoomBy(factor) {
    const offset = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    offset.setLength(distance);
    camera.position.copy(controls.target).add(offset);
    requestRender();
  }

  /* ---------- Render loop ---------- */

  let needsRender = true;

  function requestRender() {
    needsRender = true;
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height, false);
    pipeline.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    requestRender();
  }

  new ResizeObserver(resize).observe(container);
  controls.addEventListener('change', requestRender);

  function loop(now) {
    requestAnimationFrame(loop);
    const moved = controls.update();
    if (animations.length > 0) {
      runAnimations(now);
      needsRender = true;
    }
    if (!needsRender && !moved) {
      return;
    }
    needsRender = false;
    // The same film grain every time: the picture only changes when the
    // scene does.
    pipeline.render(0);
  }

  resize();
  // Portrait screens see less of the plate, so start further back.
  if (camera.aspect < 1) {
    zoomBy(1.6);
  }
  requestAnimationFrame(loop);
  if (onReady) {
    onReady();
  }

  return {
    canvas: renderer.domElement,
    addBlock,
    removeBlock,
    updateBlock,
    clearBlocks,
    setGhost,
    pick,
    setTime,
    zoomBy,
  };
}
