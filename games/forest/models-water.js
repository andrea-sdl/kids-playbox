// The old railway and water garden share a small palette of iron, lichen,
// faded red lacquer and the warm colour of the paper in the station clock.
import { THREE as T, group, mesh, egg, box, rod, ink } from './model-kit.js';

const iron = 0x39494a;
const rust = 0x966642;
const ivory = 0xf3deb0;
const vermilion = 0xad4c3c;
const gold = 0xf2bf62;
const water = 0x487d79;
const TAU = Math.PI * 2;

function eased(value, start = 0, end = 1) {
  const t = T.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

// Folded ticket, fins, and the fox's ears have a drawn edge and two
// differently coloured faces. Sharing a point keeps the folds watertight.
function facet(parent, points, colour) {
  const vertices = [];
  for (let i = 1; i < points.length - 1; i++) {
    vertices.push(...points[0], ...points[i], ...points[i + 1]);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  return mesh(parent, geo, colour);
}

function ring(parent, x, y, z, radius, thickness, colour) {
  const geo = new T.TorusGeometry(radius, thickness, 6, 40);
  return mesh(parent, geo, colour, x, y, z);
}

function railwayBoat() {
  const root = new T.Group();
  const pool = egg(root, water, 0, 0.09, 0, 1.41, 0.11, 0.78);
  pool.rotation.y = -0.12;
  for (const z of [-0.43, 0.44]) {
    const rail = box(root, rust, 0, 0.115, z, 2.32, 0.08, 0.06);
    rail.rotation.y = -0.12;
  }
  const boat = group(root);
  const left = [-0.81, 0.4, 0],
    right = [0.81, 0.4, 0];
  for (const side of [-1, 1]) {
    const front = side * 0.34;
    const bottom = [-0.37, 0, front * 0.57];
    const keel = [0.37, 0, front * 0.57];
    const seam = [0, 0.28, front];
    facet(boat, [left, bottom, seam], ivory);
    facet(boat, [bottom, keel, right, seam], side > 0 ? 0xd9b77e : 0xc29a6c);
    facet(boat, [left, seam, [-0.12, 0.78, 0]], 0xf7e7c3);
    facet(boat, [[-0.12, 0.78, 0], seam, right], side > 0 ? 0xe3ce94 : 0xad8052);
    ink(boat, iron, [left, bottom, keel, right], 0.009);
    ink(boat, rust, [left, seam, right], 0.009);
  }
  // Two faded station stripes follow the lower fold.
  facet(
    boat,
    [
      [-0.57, 0.245, 0.139],
      [-0.48, 0.154, 0.165],
      [-0.43, 0.158, 0.192],
      [-0.52, 0.25, 0.164],
    ],
    vermilion,
  );
  facet(
    boat,
    [
      [-0.48, 0.253, 0.188],
      [-0.395, 0.17, 0.212],
      [-0.37, 0.185, 0.228],
      [-0.449, 0.257, 0.199],
    ],
    vermilion,
  );
  const wakes = [-1, 1].map((side) =>
    ink(
      root,
      0xb0c7a4,
      [
        [-0.68, 0.22, 0.04 * side],
        [-0.92, 0.218, 0.15 * side],
        [-1.2, 0.214, 0.3 * side],
      ],
      0.012,
    ),
  );
  return {
    group: root,
    pose(progress, time) {
      const drift = eased(progress, 0.15, 1);
      boat.position.set(-0.32 + drift * 0.89, 0.22 + 0.026 * Math.sin(time * 2.1), 0.16 - drift * 0.41);
      boat.rotation.set(0.042 * Math.sin(time * 2), 0.12 + drift * 0.4, 0.035 * Math.cos(time * 2.3));
      wakes.forEach((wake) => {
        wake.visible = progress > 0.14;
        wake.position.x = 0.48 * drift;
        wake.scale.z = 0.6 + drift;
      });
    },
  };
}

function semaphore() {
  const root = new T.Group();
  box(root, 0x696f5c, 0, 0.1, 0, 0.57, 0.2, 0.49);
  rod(root, rust, [0, 0.19, 0], [0, 2.14, 0], 0.071, 0.105);
  for (const y of [0.48, 0.73, 0.98, 1.23]) {
    box(root, iron, -0.16, y, 0, 0.29, 0.037, 0.05);
  }
  rod(root, iron, [-0.31, 0.24, 0], [-0.31, 1.33, 0], 0.021);
  const pivot = group(root, 0, 1.58, 0.045);
  box(pivot, 0xdfb882, -0.52, 0, 0, 1.12, 0.185, 0.074);
  box(pivot, vermilion, -0.52, 0, 0.041, 0.91, 0.124, 0.027);
  box(pivot, ivory, -0.81, 0, 0.065, 0.14, 0.154, 0.021);
  egg(pivot, iron, 0, 0, 0.08, 0.094, 0.094, 0.035);
  const lamp = group(root, 0.1, 1.88, 0.055);
  box(lamp, iron, 0, 0, 0, 0.33, 0.48, 0.18);
  for (const y of [-0.113, 0.113]) {
    ring(lamp, 0, y, 0.116, 0.085, 0.018, rust);
    egg(lamp, y > 0 ? 0x673531 : 0x62553c, 0, y, 0.108, 0.078, 0.078, 0.025);
    box(lamp, iron, 0, y + 0.089, 0.155, 0.207, 0.027, 0.16);
  }
  const light = group(lamp, 0, -0.113, 0.134);
  egg(light, 0xffc454, 0, 0, 0, 0.074, 0.074, 0.019);
  box(root, iron, 0.1, 0.54, 0.055, 0.34, 0.17, 0.15);
  for (const x of [-0.045, 0.225]) egg(root, rust, x, 0.54, 0.146, 0.027, 0.027, 0.019);
  const pin = group(root, 0.21, 0.54, 0.13);
  rod(pin, iron, [0, 0, 0], [0.26, 0.31, 0.09], 0.025);
  egg(pin, vermilion, 0.26, 0.31, 0.09, 0.056, 0.051, 0.052);
  return {
    group: root,
    pose(progress) {
      const lifted = eased(progress, 0.14, 0.74);
      pivot.rotation.z = 0.82 - 1.37 * lifted;
      pin.rotation.z = -0.58 + 1.08 * eased(progress, 0.02, 0.35);
      light.visible = progress > 0.59;
      light.scale.setScalar(0.74 + 0.26 * lifted);
    },
  };
}

function lanternFloat() {
  const root = new T.Group();
  const globe = group(root, 0, 1.02, 0);
  const globeShape = new T.SphereGeometry(0.59, 36, 22);
  // A thin front shell lets the animated insects show through the glass.
  const glass = new T.Mesh(
    globeShape,
    new T.MeshPhongMaterial({
      color: 0x68a18b,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      shininess: 38,
      specular: 0xb6d9b0,
    }),
  );
  // Two reflected slivers of sky make the glass read even in shade.
  ink(
    globe,
    0xd8e6c6,
    [
      [-0.38, 0.19, 0.414],
      [-0.31, 0.31, 0.388],
      [-0.2, 0.39, 0.398],
    ],
    0.012,
  );
  ink(
    globe,
    0xa3c8b2,
    [
      [0.28, -0.32, 0.406],
      [0.34, -0.27, 0.4],
      [0.38, -0.22, 0.396],
    ],
    0.008,
  );
  glass.renderOrder = 2;
  globe.add(glass);
  for (const height of [-0.27, 0.23]) {
    const belt = ring(globe, 0, height, 0, Math.sqrt(0.59 * 0.59 - height * height), 0.016, 0x84694a);
    belt.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 5; i++) {
    const az = (i * TAU) / 5;
    const line = [];
    for (let j = 0; j <= 10; j++) {
      const a = (Math.PI * j) / 10;
      line.push([
        0.594 * Math.sin(a) * Math.cos(az),
        0.599 * Math.cos(a),
        0.594 * Math.sin(a) * Math.sin(az),
      ]);
    }
    ink(globe, 0x88734d, line, 0.021);
  }
  rod(globe, rust, [0, 0.55, 0], [0, 0.76, 0], 0.065, 0.1);
  const loop = ring(globe, 0, 0.87, 0, 0.124, 0.028, 0x8f774f);
  loop.rotation.y = 0.23;
  const insects = Array.from({ length: 12 }, (_, i) => {
    const fly = group(root);
    egg(fly, 0xf9cc60, 0, 0, 0, 0.033, 0.032, 0.029);
    for (const side of [-1, 1]) {
      const wing = egg(fly, 0xd6dcad, side * 0.03, 0.018, 0, 0.035, 0.011, 0.018);
      wing.rotation.z = side * 0.48;
    }
    return fly;
  });
  return {
    group: root,
    pose(progress, time) {
      globe.rotation.z = 0.036 * Math.sin(time * 1.45);
      insects.forEach((fly, i) => {
        const angle = i * 2.4 + time * (0.52 + i * 0.024);
        const ingress = eased(progress, i * 0.031, 0.6 + i * 0.031);
        const orbit = 1.02 - ingress * (0.62 + 0.1 * Math.sin(i * 3));
        fly.position.set(
          orbit * Math.cos(angle),
          1 + (0.55 - 0.16 * ingress) * Math.sin(angle * 1.37 + i),
          orbit * 0.52 * Math.sin(angle),
        );
        fly.scale.setScalar(0.65 + 0.38 * (0.5 + 0.5 * Math.sin(time * 4 + i)));
      });
    },
  };
}

function silverClock() {
  const root = new T.Group();
  const clock = group(root, 0.12, 0.88, -0.04);
  clock.rotation.set(-0.24, -0.19, -0.14);
  const disk = mesh(clock, new T.CylinderGeometry(0.64, 0.64, 0.095, 40), iron);
  disk.rotation.x = Math.PI / 2;
  const face = mesh(clock, new T.CylinderGeometry(0.584, 0.584, 0.055, 40), 0xc9c6a5, 0, 0, 0.06);
  face.rotation.x = Math.PI / 2;
  ring(clock, 0, 0, 0.091, 0.59, 0.034, rust);
  for (let i = 0; i < 12; i++) {
    const angle = (TAU * i) / 12;
    const tick = box(
      clock,
      iron,
      Math.sin(angle) * 0.483,
      Math.cos(angle) * 0.483,
      0.103,
      0.03,
      i % 3 === 0 ? 0.12 : 0.065,
      0.011,
    );
    tick.rotation.z = -angle;
  }
  const minutes = group(clock, 0, 0, 0.128);
  box(minutes, iron, 0, 0.19, 0, 0.035, 0.42, 0.014);
  const hours = group(clock, 0, 0, 0.117);
  hours.rotation.z = 2.08;
  box(hours, 0x846344, 0, 0.115, 0, 0.049, 0.27, 0.014);
  egg(clock, rust, 0, 0, 0.141, 0.051, 0.052, 0.017);
  // The fins use the same root shape as the tail so the turn reads in silhouette.
  const fish = group(root);
  egg(fish, 0x90a696, 0, 0, 0, 0.42, 0.153, 0.147);
  egg(fish, 0xb9c7b2, 0.18, -0.044, 0.014, 0.24, 0.097, 0.123);
  egg(fish, 0x8a9d92, 0.255, 0.022, 0, 0.22, 0.14, 0.135);
  for (const side of [-1, 1]) {
    egg(fish, 0xd9c08c, 0.341, 0.051, side * 0.115, 0.047, 0.05, 0.025);
    egg(fish, iron, 0.35, 0.052, side * 0.139, 0.029, 0.033, 0.012);
    ink(
      fish,
      0x536963,
      [
        [0.254, 0.102, 0.104 * side],
        [0.215, 0.021, 0.144 * side],
        [0.237, -0.079, 0.11 * side],
      ],
      0.009,
    );
    facet(
      fish,
      [
        [0.004, 0.011, 0.13 * side],
        [-0.138, -0.138, 0.235 * side],
        [-0.139, -0.043, 0.143 * side],
      ],
      0x8caa9a,
    );
    for (let i = 0; i < 5; i++) {
      const x = -0.19 + i * 0.067;
      ink(
        fish,
        0xb8c4a4,
        [
          [x, 0.078, 0.117 * side],
          [x - 0.02, 0.041, 0.136 * side],
          [x, 0.017, 0.147 * side],
        ],
        0.006,
      );
    }
  }
  facet(
    fish,
    [
      [-0.23, 0.109, 0],
      [-0.15, 0.256, 0],
      [0.15, 0.119, 0],
    ],
    0x698d80,
  );
  const tail = group(fish, -0.33, 0, 0);
  facet(
    tail,
    [
      [0.025, 0.06, 0],
      [-0.23, 0.17, 0],
      [-0.17, 0.007, 0],
      [-0.24, -0.16, 0],
      [0.025, -0.052, 0],
    ],
    0x92ab9c,
  );
  const bubbles = Array.from({ length: 5 }, (_, i) =>
    ring(root, 0, 0, 0, 0.013 + i * 0.003, 0.004, 0xb6d6cb),
  );
  return {
    group: root,
    pose(progress, time) {
      const phase = 2.91 + TAU * eased(progress, 0.02, 0.96);
      fish.position.set(
        0.14 + 0.81 * Math.cos(phase),
        0.96 + 0.51 * Math.sin(phase),
        0.21 + 0.19 * Math.cos(phase),
      );
      const dx = -0.81 * Math.sin(phase),
        dy = 0.51 * Math.cos(phase),
        dz = -0.19 * Math.sin(phase);
      fish.rotation.order = 'YXZ';
      fish.rotation.y = Math.atan2(-dz, dx);
      fish.rotation.z = Math.atan2(dy, Math.hypot(dx, dz));
      tail.rotation.y = 0.36 * Math.sin(time * 6.2);
      minutes.rotation.z = -0.41 - TAU * eased(progress, 0.09, 0.96);
      bubbles.forEach((bubble, i) => {
        const rise = (time * 0.43 + i * 0.2) % 1;
        bubble.position.set(0.76 + 0.07 * Math.sin(time + i), 0.39 + rise * 0.94, 0.29);
        bubble.visible = progress > 0.19 && rise < 0.86;
      });
    },
  };
}

function incenseFox() {
  const root = new T.Group();
  const clay = 0xe8d6b3;
  const plinth = box(root, 0x6d6752, 0, 0.1, 0, 1.54, 0.2, 1.02);
  plinth.rotation.y = -0.11;
  const fox = group(root, 0, 0.22, 0);
  fox.rotation.y = -0.24;
  egg(fox, clay, 0.14, 0.43, 0, 0.58, 0.46, 0.35);
  egg(fox, ivory, -0.23, 0.65, 0.12, 0.28, 0.4, 0.25);
  egg(fox, clay, -0.3, 1.03, 0.1, 0.34, 0.27, 0.26);
  egg(fox, ivory, -0.49, 0.985, 0.245, 0.28, 0.133, 0.151);
  egg(fox, iron, -0.714, 1.01, 0.27, 0.054, 0.045, 0.062);
  for (const side of [-1, 1]) {
    const ear = group(fox, -0.26, 1.18, 0.1 + side * 0.143);
    const A = [-0.14, 0.012, 0.03],
      B = [0.12, 0.003, 0.06],
      C = [0.023, 0.307, 0],
      D = [0.0, 0.013, -0.09];
    facet(ear, [A, B, C], clay);
    facet(ear, [B, D, C], 0xc3ad89);
    facet(ear, [D, A, C], clay);
    facet(
      ear,
      [
        [-0.078, 0.055, 0.028],
        [0.065, 0.059, 0.04],
        [0.022, 0.23, 0.016],
      ],
      vermilion,
    );
  }
  ink(
    fox,
    0x704b3c,
    [
      [-0.554, 1.057, 0.257],
      [-0.48, 1.091, 0.315],
      [-0.406, 1.078, 0.347],
    ],
    0.012,
  );
  ink(
    fox,
    vermilion,
    [
      [-0.524, 1.112, 0.245],
      [-0.457, 1.16, 0.287],
      [-0.398, 1.145, 0.307],
    ],
    0.013,
  );
  for (const z of [-0.12, 0.19]) egg(fox, clay, -0.31, 0.09, z, 0.18, 0.09, 0.127);
  // The ceramic tail wraps toward the paws, running under the painted blossom.
  ink(
    fox,
    clay,
    [
      [0.42, 0.55, -0.11],
      [0.67, 0.38, 0.02],
      [0.53, 0.205, 0.245],
      [0.18, 0.15, 0.37],
      [-0.07, 0.19, 0.349],
    ],
    0.15,
  );
  egg(fox, ivory, -0.07, 0.19, 0.35, 0.16, 0.124, 0.115);
  for (let i = 0; i < 5; i++) {
    const angle = (i * TAU) / 5;
    const petal = egg(
      fox,
      vermilion,
      0.13 + 0.074 * Math.cos(angle),
      0.49 + 0.073 * Math.sin(angle),
      0.345,
      0.053,
      0.031,
      0.012,
    );
    petal.rotation.z = angle;
  }
  egg(fox, gold, 0.13, 0.49, 0.365, 0.028, 0.028, 0.01);
  const vent = ring(fox, 0.32, 0.818, 0.01, 0.069, 0.017, rust);
  vent.rotation.x = Math.PI / 2;
  const smoke = group(fox, 0.32, 0.83, 0.01);
  const curls = [
    [
      [0, 0, 0],
      [0.03, 0.14, 0.015],
      [-0.05, 0.26, 0.02],
      [0.01, 0.38, 0],
    ],
    [
      [0.01, 0.38, 0],
      [0.19, 0.49, 0.005],
      [0.18, 0.62, -0.015],
      [0.02, 0.68, 0],
    ],
    [
      [0.02, 0.68, 0],
      [-0.19, 0.74, 0.03],
      [-0.22, 0.92, 0.02],
      [-0.1, 1.01, 0],
    ],
    [
      [-0.1, 1.01, 0],
      [0.09, 1.08, -0.02],
      [0.21, 1.2, -0.01],
      [0.17, 1.28, 0.01],
    ],
  ];
  const wisps = curls.map((path, i) => ink(smoke, 0xc8d1b7, path, 0.018 + i * 0.002));
  return {
    group: root,
    pose(progress, time) {
      wisps.forEach((wisp, i) => {
        wisp.visible = progress > i * 0.18 + 0.08;
      });
      smoke.rotation.z = 0.09 * Math.sin(time * 1.6);
      smoke.rotation.y = 0.23 * Math.sin(time * 0.84);
      smoke.scale.set(1, 0.36 + 0.62 * eased(progress, 0.05, 0.93), 1);
    },
  };
}

function singingStairs() {
  const root = new T.Group();
  const lamps = [];
  for (let i = 0; i < 4; i++) {
    const level = (i + 1) * 0.22;
    const x = -0.22 + 0.13 * i,
      z = 0.61 - i * 0.35;
    // Each stair is an irregular extruded slab with a mossy cap.
    const outline = new T.Shape();
    outline.moveTo(-0.89, -0.24);
    outline.lineTo(-0.73, -0.32);
    outline.lineTo(0.72, -0.3);
    outline.lineTo(0.91, -0.13);
    outline.lineTo(0.84, 0.21);
    outline.lineTo(0.66, 0.28);
    outline.lineTo(-0.74, 0.27);
    outline.lineTo(-0.91, 0.13);
    outline.closePath();
    const slab = new T.ExtrudeGeometry(outline, {
      depth: level,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.025,
    });
    const stair = mesh(root, slab, 0x637468, x, 0, z);
    stair.rotation.x = -Math.PI / 2;
    const moss = egg(root, 0x85954f, x - 0.52, level + 0.022, z, 0.27, 0.055, 0.17);
    moss.rotation.y = 0.37 * i;
    const light = group(root, x, level + 0.034, z);
    const vein = [
      [-0.65, 0, 0.185],
      [-0.47, 0, 0.193],
      [-0.26, 0, 0.172],
      [0.04, 0, 0.204],
      [0.28, 0, 0.192],
      [0.6, 0, 0.155],
    ];
    ink(light, gold, vein, 0.018);
    for (let k = 0; k < 3; k++)
      egg(light, 0xffdfa0, -0.49 + k * 0.4, 0.013, 0.03 * Math.cos(k + i), 0.031, 0.01, 0.022);
    lamps.push(light);
  }
  const foot = group(root, -0.42, 0, 0.76);
  const shell = egg(foot, 0x839682, -0.045, 0.24, 0, 0.235, 0.29, 0.205);
  shell.rotation.z = 0.12;
  const cuff = ring(foot, -0.051, 0.37, 0.016, 0.176, 0.026, iron);
  cuff.rotation.x = Math.PI / 2;
  for (const x of [-0.115, 0.067]) egg(foot, rust, x, 0.28, 0.18, 0.028, 0.028, 0.018);
  egg(foot, iron, 0.01, 0.128, 0.087, 0.246, 0.145, 0.226);
  for (const x of [-0.12, 0.075]) {
    egg(foot, 0xaabc9a, x, 0.082, 0.187, 0.129, 0.091, 0.159);
  }
  return {
    group: root,
    pose(progress, time) {
      const contact = eased(progress, 0.06, 0.38);
      foot.position.y = 0.25 + 0.39 * (1 - contact) + 0.028 * Math.sin(time * 0.8) * (1 - contact);
      foot.rotation.x = -0.17 * (1 - contact);
      lamps.forEach((light, i) => {
        light.visible = progress > 0.32 + i * 0.145;
      });
    },
  };
}

const makers = {
  boat: railwayBoat,
  signal: semaphore,
  float: lanternFloat,
  carp: silverClock,
  fox: incenseFox,
  stairs: singingStairs,
};
export function waterModel(id) {
  const make = makers[id];
  if (!make) return null;
  const model = make();
  model.pose(0, 0);
  return model;
}
