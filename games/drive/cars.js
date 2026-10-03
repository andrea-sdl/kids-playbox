// The three cars. Each body is a smooth side outline pushed out sideways
// with rounded edges, under a glass canopy, with clear-coat paint that
// reflects the sky. Lights are brighter than white, so they glow.
//
// Every car faces +z, sits on y = 0 and is about 4.6 m long.

import * as THREE from '../../vendor/three/three.min.js';
import { decalTexture, headlightTexture, softDotTexture } from './textures.js';

const DESIGNS = {
  // A low, wedge-shaped hypercar.
  comet: {
    body: [[-2.3, 0.26], [2.2, 0.26], [2.44, 0.4], [2.32, 0.56], [1.1, 0.76], [-0.2, 0.84], [-1.5, 0.86], [-2.3, 0.9], [-2.42, 0.55]],
    cabin: [[1.05, 0.74], [0.25, 1.1], [-0.75, 1.13], [-1.7, 0.84]],
    width: 2.02,
    cabinWidth: 1.46,
    wheel: 0.37,
    wheelBase: 1.45,
    track: 0.95,
    ride: 0,
    wing: false,
    underglow: '#35f2ff',
  },
  // A grand tourer with a long hood and a big rear wing.
  racer: {
    body: [[-2.35, 0.28], [2.25, 0.28], [2.47, 0.44], [2.37, 0.62], [0.8, 0.84], [-0.6, 0.9], [-1.7, 0.92], [-2.38, 0.98], [-2.46, 0.6]],
    cabin: [[0.72, 0.82], [-0.05, 1.2], [-0.95, 1.22], [-1.78, 0.9]],
    width: 1.96,
    cabinWidth: 1.42,
    wheel: 0.38,
    wheelBase: 1.5,
    track: 0.93,
    ride: 0,
    wing: true,
    underglow: '#ff3fa4',
  },
  // A tall off-road buggy with big wheels, a roof rack and a light bar.
  rover: {
    body: [[-2.1, 0.55], [2.0, 0.55], [2.26, 0.76], [2.16, 1.04], [1.0, 1.14], [-0.5, 1.16], [-1.9, 1.15], [-2.2, 1.05], [-2.26, 0.75]],
    cabin: [[0.92, 1.1], [0.45, 1.74], [-1.3, 1.78], [-1.72, 1.1]],
    width: 2.06,
    cabinWidth: 1.8,
    wheel: 0.52,
    wheelBase: 1.4,
    track: 1.02,
    ride: 0.15,
    wing: false,
    rack: true,
    underglow: '#ffd23f',
  },
};

// SVG path data for a car's side view (body and cabin), for the garage.
export function carOutline(design) {
  const spec = DESIGNS[design];
  const path = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L')}Z`;
  return { body: path(spec.body), cabin: path(spec.cabin), wheel: spec.wheel, wheelBase: spec.wheelBase, ride: spec.ride };
}

// The body's underside is a straight line; the rest is one smooth curve.
function bodyShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  shape.lineTo(points[1][0], points[1][1]);
  shape.splineThru(points.slice(2).map(([x, y]) => new THREE.Vector2(x, y)));
  shape.closePath();
  return shape;
}

// The canopy: a smooth dome over a straight base.
function cabinShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  shape.splineThru(points.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
  shape.closePath();
  return shape;
}

// Push a side outline out sideways into a solid, centered, facing +z.
function sideSolid(shape, width, bevel) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 6,
    curveSegments: 28,
  });
  geometry.translate(0, 0, -(width - bevel * 2) / 2);
  geometry.rotateY(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

const shared = {};

function sharedMaterials() {
  if (shared.glass) {
    return shared;
  }
  shared.glass = new THREE.MeshPhysicalMaterial({ color: 0x0a0c14, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8 });
  shared.tire = new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.85 });
  shared.rim = new THREE.MeshStandardMaterial({ color: 0xe2e6ee, metalness: 1, roughness: 0.18 });
  shared.dark = new THREE.MeshStandardMaterial({ color: 0x15161c, metalness: 0.5, roughness: 0.45 });
  shared.carbon = new THREE.MeshStandardMaterial({ color: 0x1b1d24, metalness: 0.3, roughness: 0.3 });
  shared.caliper = new THREE.MeshStandardMaterial({ color: 0xd8202a, metalness: 0.3, roughness: 0.4 });
  shared.headlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 7 });
  shared.taillight = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 6 });
  shared.flame = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  shared.shadow = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.6 });
  shared.beam = new THREE.MeshBasicMaterial({ map: headlightTexture(), color: new THREE.Color(1.1, 1.05, 0.95), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  shared.dot = softDotTexture();
  return shared;
}

// A soft dark patch right under the car, where the sun can't reach.
function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 64, 4, 32, 64, 60);
  gradient.addColorStop(0, 'rgba(0,0,0,0.75)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 128);
  return new THREE.CanvasTexture(canvas);
}

const RIM_COLORS = {
  silver: { color: 0xe2e6ee, metalness: 1, roughness: 0.18 },
  black: { color: 0x1b1c22, metalness: 0.7, roughness: 0.35 },
  gold: { color: 0xd8a830, metalness: 1, roughness: 0.22 },
  red: { color: 0xd0202c, metalness: 0.6, roughness: 0.3 },
};

// The paint's look: shiny clear coat, flat matte, or mirror chrome.
function paintMaterial(finish) {
  if (finish === 'matte') {
    return new THREE.MeshPhysicalMaterial({ metalness: 0.05, roughness: 0.72, clearcoat: 0, envMapIntensity: 0.6 });
  }
  if (finish === 'chrome') {
    return new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  }
  return new THREE.MeshPhysicalMaterial({ metalness: 0.45, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 });
}

// Racing stripes run the length of the car, so the paint texture only has
// to change across it: u goes from one side of the car (0) to the other (1).
function stripeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 4;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function paintStripes(texture, paint, stripes, stripeColor) {
  const ctx = texture.image.getContext('2d');
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, 256, 4);
  ctx.fillStyle = stripeColor;
  if (stripes === 'single') {
    ctx.fillRect(108, 0, 40, 4);
  }
  if (stripes === 'double') {
    ctx.fillRect(84, 0, 26, 4);
    ctx.fillRect(146, 0, 26, 4);
  }
  texture.needsUpdate = true;
}

function acrossUv(geometry, width) {
  const position = geometry.attributes.position;
  const uvs = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uvs[i * 2] = position.getX(i) / width + 0.5;
    uvs[i * 2 + 1] = 0.5;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

// The height of the top of the body at `along` meters (forward is +), read
// from the outline's top edge (from the nose back to the tail).
function topHeight(spec, along) {
  const top = spec.body.slice(2);
  for (let i = 0; i < top.length - 1; i += 1) {
    const [x1, y1] = top[i];
    const [x2, y2] = top[i + 1];
    if (along <= x1 && along >= x2) {
      return y1 + ((x1 - along) / (x1 - x2)) * (y2 - y1);
    }
  }
  return top[0][1];
}

// Side graphics: a flat sheet the shape of the car's side, laid just
// outside each flat side panel. One texture maps the car's length and
// height (meters) onto the canvas.
function sideGraphics(spec, kind, color) {
  const texture = decalTexture(kind, color);
  texture.repeat.set(1 / 5, 1 / 1.3);
  texture.offset.set(0.5, -0.1 / 1.3);
  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    roughness: 0.3,
    clearcoat: 1,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const shape = bodyShape(spec.body);
  const geometry = new THREE.ShapeGeometry(shape, 24);
  // Pull in a little from the edges, which are rounded on the body.
  geometry.translate(0, -0.6, 0);
  geometry.scale(0.97, 0.92, 1);
  geometry.translate(0, 0.6, 0);
  const sides = new THREE.Group();
  const right = new THREE.Mesh(geometry, material);
  right.rotation.y = -Math.PI / 2;
  right.position.x = -(spec.width / 2 + 0.004);
  const left = right.clone();
  left.scale.x = -1;
  left.position.x = spec.width / 2 + 0.004;
  sides.add(right, left);
  return sides;
}

// Something sticking out of the hood: a scoop, or a supercharger.
function hoodPart(spec, kind, paint, materials) {
  const along = (spec.body[3][0] + spec.cabin[0][0]) / 2;
  const front = topHeight(spec, along + 0.4);
  const back = topHeight(spec, along - 0.4);
  const part = new THREE.Group();
  part.position.set(0, topHeight(spec, along) + 0.1, along);
  part.rotation.x = Math.atan2(back - front, 0.8);
  if (kind === 'scoop') {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.13, 0.7), paint);
    scoop.position.y = 0.05;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.04), materials.dark);
    mouth.position.set(0, 0.06, 0.35);
    part.add(scoop, mouth);
    return part;
  }
  const blower = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.6), materials.rim);
  blower.position.y = 0.12;
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.42), materials.dark);
  intake.position.set(0, 0.34, -0.04);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.04), materials.carbon);
  mouth.position.set(0, 0.36, 0.18);
  const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 20), materials.dark);
  pulley.rotation.x = Math.PI / 2;
  pulley.position.set(0, 0.12, 0.33);
  part.add(blower, intake, mouth, pulley);
  return part;
}

function makeWheel(radius, materials) {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.78, radius * 0.24, 16, 40), materials.tire);
  tire.rotation.y = Math.PI / 2;
  // Wider along the axle.
  tire.scale.set(1, 1, 1.6);
  wheel.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, 0.26, 32), materials.rim);
  rim.rotation.z = Math.PI / 2;
  wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 0.28, 32), materials.dark);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  // Thin spokes, so you can see the wheels turn.
  for (let i = 0; i < 5; i += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, radius * 1.18, 0.06), materials.rim);
    spoke.rotation.x = (i / 5) * Math.PI;
    wheel.add(spoke);
  }
  return wheel;
}

// custom: { finish, stripes, stripeColor, rims, wing, glow } (see
// CUSTOM_OPTIONS in world.js). Returns { group, setColor, setHeadlights,
// emitters, update }.
export function buildCar(design, color, custom) {
  const spec = DESIGNS[design];
  const materials = { ...sharedMaterials() };
  materials.rim = new THREE.MeshStandardMaterial(RIM_COLORS[custom.rims]);
  const paint = paintMaterial(custom.finish);
  // Body panels: with stripes, the color comes from the stripe texture.
  const bodyPaint = paintMaterial(custom.finish);
  let stripes = null;
  function applyColor(next) {
    paint.color.set(next);
    if (custom.stripes === 'none') {
      bodyPaint.color.set(next);
      return;
    }
    paintStripes(stripes, next, custom.stripes, custom.stripeColor);
  }
  if (custom.stripes !== 'none') {
    stripes = stripeTexture();
    bodyPaint.map = stripes;
    bodyPaint.color.set(0xffffff);
  }
  applyColor(color);

  const group = new THREE.Group();
  // The body rolls on its own; the wheels stay put.
  const body = new THREE.Group();
  body.position.y = spec.ride;
  group.add(body);

  const shell = sideSolid(bodyShape(spec.body), spec.width, 0.16);
  acrossUv(shell, spec.width);
  body.add(new THREE.Mesh(shell, bodyPaint));
  if (custom.decal !== 'none') {
    body.add(sideGraphics(spec, custom.decal, custom.decalColor));
  }
  body.add(new THREE.Mesh(sideSolid(cabinShape(spec.cabin), spec.cabinWidth, 0.12), materials.glass));

  const front = Math.max(...spec.body.map(([x]) => x));
  const back = Math.min(...spec.body.map(([x]) => x));
  const lightY = spec.body[2][1] + 0.04;

  // Slim headlights, a light strip across the nose, and a full-width tail.
  [-1, 1].forEach((side) => {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.16), materials.headlight);
    headlight.position.set(side * (spec.width / 2 - 0.38), lightY + 0.06, front - 0.14);
    headlight.rotation.y = side * 0.28;
    body.add(headlight);
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.7, 0.03, 0.06), materials.headlight);
  strip.position.set(0, lightY - 0.04, front - 0.04);
  body.add(strip);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.24, 0.07, 0.06), materials.taillight);
  tail.position.set(0, spec.body[spec.body.length - 2][1] - 0.1, back + 0.05);
  body.add(tail);

  // Dark lower lip, side skirts and a rear diffuser.
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.06, 0.14, front - back - 0.4), materials.carbon);
  skirt.position.set(0, spec.body[0][1] + 0.03, (front + back) / 2);
  body.add(skirt);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.5, 0.22, 0.3), materials.carbon);
  diffuser.position.set(0, spec.body[0][1] + 0.08, back + 0.12);
  body.add(diffuser);
  // Mirrors.
  [-1, 1].forEach((side) => {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.18), paint);
    mirror.position.set(side * (spec.cabinWidth / 2 + 0.12), spec.cabin[0][1] + 0.12, spec.cabin[0][0] - 0.25);
    body.add(mirror);
  });

  const exhaustSpots = [];
  const flames = [];
  [-1, 1].forEach((side) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25, 16), materials.rim);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.45, spec.body[0][1] + 0.12, back);
    body.add(pipe);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 16, 1, true), materials.flame);
    // Wide at the pipe, pointing backward.
    flame.geometry.translate(0, 0.55, 0);
    flame.rotation.x = -Math.PI / 2;
    flame.position.copy(pipe.position);
    flame.position.z -= 0.12;
    flame.visible = false;
    body.add(flame);
    flames.push(flame);
    const spot = new THREE.Object3D();
    spot.position.set(side * 0.45, spec.body[0][1] + 0.12, back - 0.3);
    body.add(spot);
    exhaustSpots.push(spot);
  });

  // A rear wing: the car's own choice, none, a small lip, or a big wing.
  let wingStyle = custom.wing;
  if (wingStyle === 'auto') {
    wingStyle = spec.wing ? 'big' : 'none';
  }
  const tailTop = spec.body[spec.body.length - 2][1];
  if (wingStyle === 'small') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.3, 0.06, 0.3), materials.carbon);
    lip.position.set(0, tailTop + 0.08, back + 0.22);
    lip.rotation.x = -0.25;
    body.add(lip);
  }
  if (wingStyle === 'big') {
    const height = tailTop + 0.36;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.06, 0.44), materials.carbon);
    wing.position.set(0, height, back + 0.3);
    wing.rotation.x = -0.1;
    body.add(wing);
    [-1, 1].forEach((side) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.2), materials.carbon);
      strut.position.set(side * 0.55, height - 0.18, back + 0.32);
      body.add(strut);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.5), paint);
      plate.position.set(side * spec.width / 2, height + 0.03, back + 0.3);
      body.add(plate);
    });
  }

  if (custom.hood !== 'none') {
    body.add(hoodPart(spec, custom.hood, paint, materials));
  }

  if (spec.rack) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.6), materials.dark);
    rack.position.set(0, 1.88, -0.45);
    body.add(rack);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.1), materials.headlight);
    bar.position.set(0, 1.86, 0.4);
    body.add(bar);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(spec.width + 0.1, 0.22, 0.22), materials.dark);
    bumper.position.set(0, 0.62, front - 0.05);
    body.add(bumper);
  }

  // Wheels: the front pair steers, all spin; red brake calipers peek out.
  const wheels = [];
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([end, side]) => {
    const holder = new THREE.Group();
    holder.position.set(side * spec.track, spec.wheel, end * spec.wheelBase);
    const wheel = makeWheel(spec.wheel, materials);
    holder.add(wheel);
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.1, spec.wheel * 0.5, spec.wheel * 0.7), materials.caliper);
    caliper.position.set(side * -0.06, spec.wheel * 0.25, 0);
    holder.add(caliper);
    group.add(holder);
    wheels.push({ holder, wheel, front: end === 1 });
  });

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(spec.width + 0.8, front - back + 1), materials.shadow);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.04;
  group.add(blob);

  // Night extras: light thrown on the road ahead, and a neon underglow.
  const beamGeometry = new THREE.PlaneGeometry(11, 20);
  beamGeometry.translate(0, 10, 0);
  beamGeometry.rotateX(Math.PI / 2);
  const beams = new THREE.Mesh(beamGeometry, materials.beam);
  beams.position.set(0, 0.08, front - 0.3);
  beams.visible = false;
  group.add(beams);
  let glowColor = spec.underglow;
  if (custom.glow.startsWith('#')) {
    glowColor = custom.glow;
  }
  const glowMaterial = new THREE.MeshBasicMaterial({ map: materials.dot, color: new THREE.Color(glowColor).multiplyScalar(1.4), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(spec.width + 1.2, front - back + 1.2), glowMaterial);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.06;
  underglow.visible = false;
  group.add(underglow);

  group.traverse((child) => {
    if (child.isMesh && child !== blob && child !== beams && child !== underglow && !flames.includes(child)) {
      child.castShadow = true;
    }
  });

  let spin = 0;
  let roll = 0;
  const point = new THREE.Vector3();

  return {
    group,
    setColor(next) {
      applyColor(next);
    },
    // Night lights. A chosen underglow color shows everywhere; the car's
    // own ('auto') only at night, and 'off' never.
    setHeadlights(on) {
      beams.visible = on;
      underglow.visible = custom.glow !== 'off';
      if (custom.glow === 'auto') {
        underglow.visible = on;
      }
    },
    // Where particles come from, in world space: the rear tires (for
    // smoke and dust) and the exhausts (for nitro sparks).
    emitters(heading) {
      const rear = wheels.filter((wheel) => !wheel.front).map(({ holder }) => {
        holder.getWorldPosition(point);
        return { x: point.x, y: point.y - spec.wheel, z: point.z };
      });
      const exhausts = exhaustSpots.map((spot) => {
        spot.getWorldPosition(point);
        return { x: point.x, y: point.y, z: point.z, vx: -Math.sin(heading), vz: -Math.cos(heading) };
      });
      return { wheels: rear, exhausts };
    },
    // Wheels turn with speed, the front wheels steer, the body leans into
    // bends, and the exhausts flame while using nitro.
    update(dt, { speed = 0, steer = 0, nitro = false } = {}) {
      spin += (speed / spec.wheel) * dt;
      wheels.forEach(({ holder, wheel, front: isFront }) => {
        wheel.rotation.x = spin;
        if (isFront) {
          holder.rotation.y = -steer * 0.4;
        }
      });
      // Lean out of the bend (steering right drops the left side).
      const targetRoll = -steer * Math.min(1, speed / 30) * 0.06;
      roll += (targetRoll - roll) * Math.min(1, dt * 6);
      body.rotation.z = roll;
      flames.forEach((flame) => {
        flame.visible = nitro;
        flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
      });
    },
  };
}
