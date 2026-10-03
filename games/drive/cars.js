// The three cars, built from simple shapes: a side outline pushed out into
// a body with rounded edges, a dark glass cabin, wheels and lights. Shiny
// clear-coat paint reflects the scene's environment light.
//
// Every car faces +z, sits on y = 0 and is about 4.6 m long.

import * as THREE from '../../vendor/three/three.min.js';

const DESIGNS = {
  // A low, wedge-shaped hypercar.
  comet: {
    body: [[-2.3, 0.28], [2.2, 0.28], [2.42, 0.42], [2.3, 0.58], [1.0, 0.8], [-1.5, 0.86], [-2.32, 0.92], [-2.4, 0.55]],
    cabin: [[0.95, 0.78], [0.2, 1.1], [-0.75, 1.12], [-1.65, 0.86]],
    width: 2.0,
    cabinWidth: 1.5,
    wheel: 0.37,
    wheelBase: 1.45,
    track: 0.95,
    ride: 0,
    wing: false,
  },
  // A grand tourer with a long hood and a big rear wing.
  racer: {
    body: [[-2.35, 0.3], [2.25, 0.3], [2.45, 0.46], [2.35, 0.62], [0.7, 0.86], [-1.7, 0.9], [-2.38, 0.98], [-2.45, 0.6]],
    cabin: [[0.65, 0.84], [-0.05, 1.2], [-0.95, 1.22], [-1.75, 0.9]],
    width: 1.95,
    cabinWidth: 1.45,
    wheel: 0.38,
    wheelBase: 1.5,
    track: 0.93,
    ride: 0,
    wing: true,
  },
  // A tall off-road buggy with big wheels, a roof rack and a light bar.
  rover: {
    body: [[-2.1, 0.55], [2.0, 0.55], [2.25, 0.75], [2.15, 1.05], [1.0, 1.15], [-1.9, 1.15], [-2.2, 1.05], [-2.25, 0.75]],
    cabin: [[0.9, 1.12], [0.45, 1.75], [-1.3, 1.78], [-1.7, 1.12]],
    width: 2.05,
    cabinWidth: 1.8,
    wheel: 0.52,
    wheelBase: 1.4,
    track: 1.02,
    ride: 0.15,
    wing: false,
    rack: true,
  },
};

// SVG path data for a car's side view (body and cabin), for the garage.
export function carOutline(design) {
  const spec = DESIGNS[design];
  const path = (points) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${(-y).toFixed(2)}`).join('L')}Z`;
  return { body: path(spec.body), cabin: path(spec.cabin), wheel: spec.wheel, wheelBase: spec.wheelBase, ride: spec.ride };
}

function outline(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  return shape;
}

// Push a side outline out sideways into a solid, centered, facing +z.
function sideSolid(points, width, bevel) {
  const geometry = new THREE.ExtrudeGeometry(outline(points), {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 4,
    curveSegments: 4,
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
  shared.glass = new THREE.MeshPhysicalMaterial({ color: 0x10131c, metalness: 0.2, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.6 });
  shared.tire = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.9 });
  shared.rim = new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 1, roughness: 0.25 });
  shared.dark = new THREE.MeshStandardMaterial({ color: 0x1d1f26, metalness: 0.4, roughness: 0.5 });
  shared.headlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 2.5 });
  shared.taillight = new THREE.MeshStandardMaterial({ color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 2.2 });
  shared.flame = new THREE.MeshBasicMaterial({ color: 0x66c8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  shared.shadow = new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false });
  return shared;
}

// A soft dark blob under the car (cheaper than real shadows).
function shadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 64, 4, 32, 64, 60);
  gradient.addColorStop(0, 'rgba(0,0,0,0.65)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 128);
  return new THREE.CanvasTexture(canvas);
}

function makeWheel(radius, materials) {
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.32, 24), materials.tire);
  tire.rotation.z = Math.PI / 2;
  wheel.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, 0.34, 20), materials.rim);
  rim.rotation.z = Math.PI / 2;
  wheel.add(rim);
  // Five dark spokes, so you can see the wheels turn.
  for (let i = 0; i < 5; i += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.36, radius * 1.1, 0.07), materials.dark);
    spoke.rotation.x = (i / 5) * Math.PI;
    wheel.add(spoke);
  }
  return wheel;
}

// Returns { group, paint, update(dt, { speed, steer, nitro }) }.
export function buildCar(design, color) {
  const spec = DESIGNS[design];
  const materials = sharedMaterials();
  const paint = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.35,
    roughness: 0.38,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 0.8,
  });

  const group = new THREE.Group();
  // The body rolls and pitches on its own; the wheels stay put.
  const body = new THREE.Group();
  body.position.y = spec.ride;
  group.add(body);

  body.add(new THREE.Mesh(sideSolid(spec.body, spec.width, 0.14), paint));
  const cabin = new THREE.Mesh(sideSolid(spec.cabin, spec.cabinWidth, 0.1), materials.glass);
  body.add(cabin);

  const front = Math.max(...spec.body.map(([x]) => x));
  const back = Math.min(...spec.body.map(([x]) => x));
  const lightY = spec.body[2][1] + 0.06;

  // Headlights and a full-width tail light strip.
  [-1, 1].forEach((side) => {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.12), materials.headlight);
    headlight.position.set(side * (spec.width / 2 - 0.35), lightY, front - 0.08);
    headlight.rotation.y = side * 0.25;
    body.add(headlight);
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.3, 0.09, 0.08), materials.taillight);
  tail.position.set(0, spec.body[spec.body.length - 2][1] - 0.12, back + 0.02);
  body.add(tail);

  // A dark lower lip all around, and exhausts.
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 0.1, 0.16, front - back - 0.3), materials.dark);
  skirt.position.set(0, spec.body[0][1] + 0.04, (front + back) / 2);
  body.add(skirt);

  const flames = [];
  [-1, 1].forEach((side) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 12), materials.rim);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.45, spec.body[0][1] + 0.12, back);
    body.add(pipe);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1, 12, 1, true), materials.flame);
    // Wide at the pipe, pointing backward.
    flame.geometry.translate(0, 0.5, 0);
    flame.rotation.x = -Math.PI / 2;
    flame.position.copy(pipe.position);
    flame.position.z -= 0.12;
    flame.visible = false;
    body.add(flame);
    flames.push(flame);
  });

  if (spec.wing) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.06, 0.42), paint);
    wing.position.set(0, 1.28, back + 0.3);
    wing.rotation.x = -0.08;
    body.add(wing);
    [-1, 1].forEach((side) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.18), materials.dark);
      strut.position.set(side * 0.55, 1.1, back + 0.32);
      body.add(strut);
    });
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

  // Wheels: front pair steers, all spin.
  const wheels = [];
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([end, side]) => {
    const holder = new THREE.Group();
    holder.position.set(side * spec.track, spec.wheel, end * spec.wheelBase);
    const wheel = makeWheel(spec.wheel, materials);
    holder.add(wheel);
    group.add(holder);
    wheels.push({ holder, wheel, front: end === 1 });
  });

  const blob = new THREE.Mesh(new THREE.PlaneGeometry(spec.width + 1.2, front - back + 1.4), materials.shadow);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  group.add(blob);

  let spin = 0;
  let roll = 0;

  return {
    group,
    paint,
    setColor(next) {
      paint.color.set(next);
    },
    // Wheels turn with speed, the front wheels steer, the body leans into
    // bends, and the exhausts flame while using nitro.
    update(dt, { speed = 0, steer = 0, nitro = false } = {}) {
      spin += (speed / spec.wheel) * dt;
      wheels.forEach(({ holder, wheel, front: isFront }) => {
        wheel.rotation.x = spin;
        if (isFront) {
          holder.rotation.y = steer * 0.4;
        }
      });
      const targetRoll = -steer * Math.min(1, speed / 30) * 0.07;
      roll += (targetRoll - roll) * Math.min(1, dt * 6);
      body.rotation.z = roll;
      flames.forEach((flame) => {
        flame.visible = nitro;
        flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
      });
    },
  };
}
