import { THREE, group, mesh, egg, box, rod, ink, material } from './model-kit.js';

const brass = '#b88d48',
  gold = '#e3c378',
  bronze = '#715936',
  patina = '#637665';
const bark = '#674e3b',
  cut = '#ccaa79',
  moss = '#718346',
  fern = '#91a65e';
const iron = '#546951',
  enamel = '#97a578',
  joint = '#435346';
const navy = '#2e415f',
  blue = '#576f98',
  cream = '#f6db9c';
const tau = Math.PI * 2;

function phase(p, start, end) {
  const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

function plinth(parent, width, height) {
  rod(parent, '#596458', [0, 0, 0], [0, height, 0], width, width * 1.14);
  rod(parent, '#81896c', [0, height, 0], [0, height + 0.06, 0], width * 1.04, width * 1.08);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.74,
      r = width * (0.69 + (i % 3) * 0.06);
    egg(
      parent,
      i % 2 ? moss : fern,
      r * Math.cos(a),
      height + 0.061,
      r * Math.sin(a),
      0.13,
      0.037,
      0.095,
    );
  }
}

function ring(parent, color, radius, wire, x, y, z) {
  return mesh(parent, new THREE.TorusGeometry(radius, wire, 6, 40), color, x, y, z);
}

function glint(parent, x, y, z, size) {
  const glow = group(parent, x, y, z);
  egg(glow, '#ffe6a7', 0, 0, 0, size * 0.24, size, size * 0.15);
  egg(glow, '#fff1c3', 0, 0, 0, size * 0.78, size * 0.2, size * 0.15);
  return glow;
}

function telescope() {
  const root = group();
  plinth(root, 0.68, 0.23);
  for (let i = 0; i < 3; i++) {
    const a = (i * tau) / 3 + 0.4;
    rod(root, bronze, [0.49 * Math.cos(a), 0.29, 0.49 * Math.sin(a)], [0, 1.12, 0], 0.048, 0.082);
  }
  const mount = group(root, 0, 1.3, 0);
  mount.rotation.y = -0.45;
  rod(mount, brass, [0, -0.27, 0], [0, 0, 0], 0.15);
  const tube = group(mount);
  for (const [left, right, r1, r2, color] of [
    [-0.93, -0.72, 0.092, 0.105, bronze],
    [-0.76, -0.36, 0.14, 0.13, brass],
    [-0.39, 0.49, 0.198, 0.158, patina],
    [0.43, 0.86, 0.235, 0.194, brass],
    [0.81, 0.91, 0.255, 0.255, gold],
  ])
    rod(tube, color, [left, 0, 0], [right, 0, 0], r1, r2);
  for (const x of [-0.74, -0.38, -0.09, 0.08, 0.44, 0.8]) {
    const r = x > 0.4 ? 0.234 : x < -0.4 ? 0.147 : 0.198;
    rod(tube, bronze, [x - 0.018, 0, 0], [x + 0.018, 0, 0], r);
  }
  rod(tube, '#477e89', [0.912, 0, 0], [0.924, 0, 0], 0.223);
  rod(tube, brass, [-0.22, 0.253, 0], [0.17, 0.253, 0], 0.044);
  rod(tube, bronze, [-0.12, 0.14, 0], [-0.12, 0.253, 0], 0.031);
  egg(mount, gold, 0, 0, 0.209, 0.116, 0.116, 0.046);
  const star = glint(tube, 0.93, 0.05, 0.12, 0.19);
  return {
    group: root,
    pose(p) {
      const turn = phase(p, 0.08, 0.78);
      tube.rotation.z = -0.13 + turn * 0.84;
      mount.rotation.y = -0.17 - turn * 0.39;
      star.scale.setScalar(phase(p, 0.63, 0.88) * (1.22 - 0.5 * phase(p, 0.88, 1)));
    },
  };
}

function orrery() {
  const root = group();
  plinth(root, 0.71, 0.17);
  rod(root, bronze, [0, 0.23, 0], [0, 0.32, 0], 0.57, 0.66);
  rod(root, brass, [0, 0.31, 0], [0, 0.45, 0], 0.45, 0.28);
  rod(root, bronze, [0, 0.43, 0], [0, 1.21, 0], 0.067);
  egg(root, gold, 0, 1.17, 0, 0.235, 0.235, 0.235);
  const arms = [];
  const metals = ['#aac1a9', '#ad6f4b', '#83a0b8'];
  for (let i = 0; i < 3; i++) {
    const r = 0.38 + i * 0.26;
    const orbit = group(root, 0, 1.17, 0);
    orbit.rotation.z = -0.2 + i * 0.18;
    const track = ring(orbit, brass, r, 0.018, 0, 0, 0);
    track.rotation.x = Math.PI / 2;
    const arm = group(orbit);
    rod(arm, bronze, [0, -0.105, 0], [r, 0.005, 0], 0.018);
    egg(arm, metals[i], r, 0.057, 0, 0.07 + i * 0.02, 0.07 + i * 0.02, 0.07 + i * 0.02);
    arms.push(arm);
  }
  const crown = ring(root, bronze, 0.79, 0.031, 0, 1.12, -0.06);
  crown.rotation.y = 0.52;
  const stars = group(root, -0.02, 0, 0.02);
  const points = [
    [-0.91, 1.78, -0.07],
    [-0.59, 1.91, -0.07],
    [-0.28, 1.84, -0.07],
    [0.04, 2.09, -0.07],
    [0.22, 2, -0.07],
  ];
  for (let i = 0; i < points.length; i++) {
    glint(stars, ...points[i], 0.048 + (i % 2) * 0.024);
    if (i) rod(stars, cream, points[i - 1], points[i], 0.009);
  }
  return {
    group: root,
    pose(p) {
      const turn = phase(p, 0.05, 0.88);
      arms.forEach((arm, i) => {
        arm.rotation.y = i * 1.8 + turn * (2.9 + i * 1.4);
      });
      stars.visible = p > 0.48;
      stars.position.y = -0.22 * (1 - phase(p, 0.48, 0.89));
    },
  };
}

function wingMesh(parent, shape, color, z) {
  return mesh(
    parent,
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.016,
      bevelEnabled: false,
      curveSegments: 14,
    }),
    color,
    0,
    0,
    z,
  );
}

function mothWing(parent, side) {
  const hinge = group(parent);
  const face = group(hinge);
  face.scale.x = side;
  const wing = new THREE.Shape();
  wing.moveTo(0.02, 0.06);
  wing.bezierCurveTo(0.26, 0.4, 0.65, 0.58, 0.87, 0.46);
  wing.bezierCurveTo(0.95, 0.29, 0.77, 0.03, 0.55, -0.03);
  wing.bezierCurveTo(0.71, -0.34, 0.53, -0.56, 0.43, -0.59);
  wing.quadraticCurveTo(0.33, -0.31, 0.19, -0.29);
  wing.quadraticCurveTo(0.04, -0.23, 0.02, 0.06);
  wingMesh(face, wing, navy, 0);
  const band = new THREE.Shape();
  band.moveTo(0.17, 0.09);
  band.quadraticCurveTo(0.53, 0.45, 0.83, 0.4);
  band.quadraticCurveTo(0.68, 0.12, 0.52, 0.06);
  band.quadraticCurveTo(0.31, 0.01, 0.17, 0.09);
  wingMesh(face, band, blue, 0.017);
  const moon = new THREE.Shape();
  moon.moveTo(0.62, 0.3);
  moon.bezierCurveTo(0.52, 0.24, 0.57, 0.12, 0.68, 0.16);
  moon.bezierCurveTo(0.55, 0.025, 0.44, 0.22, 0.62, 0.3);
  wingMesh(face, moon, cream, 0.036);
  for (const [x, y] of [
    [0.27, -0.12],
    [0.38, -0.18],
    [0.48, -0.24],
    [0.68, 0.34],
    [0.75, 0.32],
  ]) {
    egg(face, '#bcb4a1', x, y, 0.041, 0.028, 0.018, 0.006);
  }
  return hinge;
}

function moonMoth() {
  const root = group();
  egg(root, '#627560', -0.16, 0.23, -0.04, 0.79, 0.24, 0.47);
  egg(root, moss, -0.18, 0.34, 0.025, 0.73, 0.16, 0.46);
  const insect = group(root);
  const left = mothWing(insect, -1),
    right = mothWing(insect, 1);
  egg(insect, '#695b48', 0, -0.04, 0.07, 0.071, 0.245, 0.07);
  egg(insect, '#ccc3a2', 0, 0.115, 0.08, 0.09, 0.11, 0.08);
  for (const side of [-1, 1])
    ink(
      insect,
      bronze,
      [
        [side * 0.035, 0.18, 0.08],
        [side * 0.1, 0.31, 0.11],
        [side * 0.17, 0.35, 0.1],
      ],
      0.013,
    );
  return {
    group: root,
    pose(p, t) {
      const open = phase(p, 0.04, 0.41),
        flight = phase(p, 0.49, 1);
      const flap = open * (0.08 + 0.61 * flight) * Math.sin(t * 15);
      const angle = Math.max(0.02, 1.23 * (1 - open) + 0.19 + flap);
      left.rotation.y = angle;
      right.rotation.y = -angle;
      insect.position.set(
        -0.12 + 0.74 * flight,
        0.86 + 0.72 * flight + 0.035 * flight * Math.sin(t * 8),
        0.02 + 0.15 * flight,
      );
      insect.rotation.z = -0.27 * flight;
      insect.scale.setScalar(0.79 - flight * 0.19);
    },
  };
}

function paperMap() {
  const root = group();
  const log = rod(root, bark, [-1.13, 0.19, -0.29], [1.08, 0.32, -0.37], 0.24, 0.18);
  log.material = cedarPigment();
  for (let j = 0; j < 4; j++) {
    const a = 0.18 + j * 0.47,
      z = -0.32 + 0.224 * Math.sin(a);
    ink(
      root,
      '#8c704e',
      [
        [-1.02, 0.2 + 0.16 * Math.cos(a), z + 0.04],
        [-0.25, 0.24 + 0.195 * Math.cos(a), z],
        [0.32, 0.27 + 0.204 * Math.cos(a), z - 0.015],
        [1.02, 0.31 + 0.218 * Math.cos(a), z - 0.038],
      ],
      0.008,
    );
  }
  for (let i = 0; i < 7; i++) {
    const x = -0.89 + i * 0.29,
      y = 0.4 + (x + 1) * 0.05;
    egg(root, moss, x, y, -0.33, 0.22, 0.064, 0.16);
    if (i % 2) continue;
    rod(root, fern, [x, y, -0.33], [x + 0.03, y + 0.19, -0.33], 0.012);
    const petal = i % 4 ? '#728db7' : '#d28c56';
    for (let k = 0; k < 5; k++) {
      const a = (k * tau) / 5;
      egg(
        root,
        petal,
        x + 0.03 + 0.051 * Math.cos(a),
        y + 0.2 + 0.051 * Math.sin(a),
        -0.32,
        0.042,
        0.043,
        0.024,
      );
    }
    egg(root, cream, x + 0.03, y + 0.2, -0.29, 0.027, 0.024, 0.018);
  }
  const paper = group(root);
  const leaves = [];
  let prev = paper;
  const w = 0.47,
    h = 0.93;
  for (let i = 0; i < 4; i++) {
    const hinge = group(prev, i ? w : 0, 0, 0);
    leaves.push(hinge);
    box(hinge, i % 2 ? '#dec697' : '#ead4a4', w / 2, 0, 0, w, h, 0.026);
    // The road and river meet at the edges of every fold.
    const streamY = [0.2, 0.05, 0.14, -0.1, -0.2];
    ink(
      hinge,
      '#699499',
      [
        [0, streamY[i], 0.022],
        [w * 0.36, streamY[i] + 0.065, 0.022],
        [w * 0.63, streamY[i + 1] - 0.025, 0.022],
        [w, streamY[i + 1], 0.022],
      ],
      0.014,
    );
    ink(
      hinge,
      '#bc8d60',
      [
        [0, -0.15, 0.023],
        [w * 0.32, -0.22, 0.023],
        [w * 0.58, -0.12, 0.023],
        [w, -0.15, 0.023],
      ],
      0.009,
    );
    for (let j = 0; j < 3; j++) {
      const x = w * (0.2 + j * 0.28),
        y = 0.24 + (j % 2) * 0.05;
      const peak = new THREE.Shape();
      peak.moveTo(x - 0.057, y - 0.041);
      peak.lineTo(x + 0.055, y - 0.044);
      peak.lineTo(x + 0.002, y + 0.067);
      peak.closePath();
      wingMesh(hinge, peak, i % 2 ? '#718365' : '#879271', 0.016);
    }
    for (let row = 0; row < 2; row++)
      for (let j = 0; j < 4; j++) {
        const x = 0.046 + j * 0.111 + 0.015 * Math.sin(i * 4 + j);
        const y = -0.36 + row * 0.047 + 0.026 * Math.sin((j + i) * 2);
        const tree = new THREE.Shape();
        tree.moveTo(x - 0.024, y);
        tree.quadraticCurveTo(x - 0.027, y + 0.031, x, y + 0.05);
        tree.quadraticCurveTo(x + 0.031, y + 0.032, x + 0.025, y);
        tree.closePath();
        wingMesh(hinge, tree, ['#899366', '#828c69', '#728569'][(i + j + row) % 3], 0.019);
      }
    for (const y of [-0.412, 0.416]) rod(hinge, '#a49871', [0, y, 0.021], [w, y, 0.021], 0.004);
    prev = hinge;
  }
  return {
    group: root,
    pose(p) {
      const unfold = phase(p, 0.13, 0.91);
      paper.position.set(-0.25 - 0.69 * unfold, 0.56 + 0.4 * unfold, 0.07 + 0.12 * unfold);
      paper.rotation.x = -0.28 + 0.14 * unfold;
      leaves.forEach((leaf, i) => {
        if (!i) return;
        leaf.rotation.y = (i % 2 ? -1 : 1) * 2.97 * (1 - phase(p, 0.1 + i * 0.085, 0.66 + i * 0.08));
      });
    },
  };
}

let woodPaint;
function cedarPigment() {
  if (woodPaint) return woodPaint;
  const w = 256,
    h = 256,
    data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x / w) * tau,
        v = y / h;
      const grain = Math.sin(u * 37 + 1.8 * Math.sin(u * 4 + v * 6) + 0.55 * Math.sin(u * 9 - v * 21));
      const drift = Math.sin(u * 7 + v * 4 + Math.sin(u * 3 + v * 8));
      const fleck = Math.sin(x * 953.3 + y * 131.4);
      const value =
        0.87 + 0.04 * drift + 0.05 * fleck + 0.09 * grain - 0.13 * Math.pow(Math.max(0, grain), 8);
      const offset = (y * w + x) * 4;
      data.fill(Math.round(value * 249), offset, offset + 3);
      data[offset + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  woodPaint = material('#856b50').clone();
  woodPaint.map = tex;
  return woodPaint;
}

// A band of raised, twisting ribs breaks the cylinder silhouette. Short
// scars fork off each rib, leaving the front clear where the robot carves.
function cedar() {
  const root = group();
  const wood = new THREE.CylinderGeometry(0.53, 0.68, 2.04, 45, 8, true);
  const vertices = wood.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      y = vertices.getY(i),
      z = vertices.getZ(i);
    const a = Math.atan2(x, z),
      h = (y + 1.02) / 2.04;
    const rib = Math.pow(Math.max(0, Math.sin(9 * a + 2 * h + Math.sin(3 * a))), 4);
    const swell = 1 + rib * (0.05 + 0.17 * Math.pow(1 - h, 3));
    vertices.setXYZ(i, x * swell, y + Math.max(0, h - 0.86) * Math.sin(a * 5) * 0.32, z * swell);
  }
  wood.computeVertexNormals();
  const trunk = mesh(root, wood, bark, 0, 1.02, -0.14);
  trunk.material = cedarPigment();
  egg(root, cut, 0, 2.04, -0.14, 0.519, 0.063, 0.519);
  for (const radius of [0.12, 0.23, 0.34, 0.45]) {
    const growth = ring(
      root,
      '#ab885d',
      radius,
      0.01,
      0.017,
      2.108 - 0.054 * (radius / 0.52) ** 2,
      -0.14,
    );
    growth.rotation.x = Math.PI / 2;
    growth.scale.y = 0.95;
  }
  for (let i = 0; i < 18; i++) {
    const a = (tau * i) / 18;
    if (Math.abs(Math.cos(a)) < 0.43 && Math.sin(a) > 0) continue;
    const points = [
      [0.7, 0.01],
      [0.64, 0.55],
      [0.59, 1.34],
      [0.542, 2.03],
    ].map(([r, y], j) => [
      Math.cos(a + 0.04 * Math.sin(i + j)) * r,
      y,
      Math.sin(a + 0.04 * Math.sin(i + j)) * r - 0.14,
    ]);
    ink(root, i % 2 ? '#4b3c30' : '#87674b', points, 0.016 + (i % 3) * 0.006);
  }
  const stub = rod(root, bark, [-0.39, 1.28, -0.18], [-0.77, 1.67, -0.23], 0.15, 0.25);
  stub.material = trunk.material;
  rod(root, cut, [-0.77, 1.67, -0.23], [-0.78, 1.68, -0.232], 0.13);
  for (let i = 0; i < 7; i++) {
    const a = (tau * i) / 7;
    const rootlet = egg(
      root,
      i % 2 ? bark : moss,
      Math.cos(a) * 0.49,
      0.115,
      Math.sin(a) * 0.53 - 0.14,
      0.36,
      0.14,
      0.28,
    );
    rootlet.rotation.y = -a;
  }
  for (const direction of [-1, 1]) {
    ink(
      root,
      '#463d2e',
      [
        [-0.33, 1.13 - 0.15 * direction, 0.41],
        [-0.22, 1.13, 0.459],
        [-0.08, 1.13 + 0.16 * direction, 0.463],
      ],
      0.027,
    );
    ink(
      root,
      cut,
      [
        [-0.33, 1.14 - 0.15 * direction, 0.42],
        [-0.22, 1.14, 0.471],
        [-0.08, 1.14 + 0.16 * direction, 0.472],
      ],
      0.014,
    );
  }
  const arc = [];
  for (let i = 0; i <= 28; i++) {
    const a = (tau * i) / 28 + 0.92;
    const x = 0.215 + 0.116 * Math.cos(a);
    arc.push(new THREE.Vector3(x, 1.14 + 0.158 * Math.sin(a), Math.sqrt(0.625 ** 2 - x * x) - 0.112));
  }
  const curve = new THREE.CatmullRomCurve3(arc);
  const incision = mesh(root, new THREE.TubeGeometry(curve, 36, 0.02, 6, false), '#e3be84', 0, 0, 0);
  const tip = group(root);
  const finger = rod(tip, enamel, [0.22, 0.015, 0.17], [0.026, 0, 0.005], 0.055, 0.089);
  finger.rotation.z -= 0.025;
  egg(tip, joint, 0.225, 0.015, 0.17, 0.094, 0.089, 0.09);
  rod(tip, iron, [0.53, -0.11, 0.29], [0.23, 0.013, 0.17], 0.074, 0.113);
  const flakes = [];
  for (let i = 0; i < 6; i++)
    flakes.push(mesh(root, new THREE.TetrahedronGeometry(0.02 + (i % 3) * 0.006), cut, 0, 0, 0));
  return {
    group: root,
    pose(p) {
      const trace = phase(p, 0.19, 0.75);
      incision.geometry.setDrawRange(0, Math.floor(trace * 36) * 36);
      const at = curve.getPoint(trace);
      const retreat = 1 - phase(p, 0.03, 0.19) + phase(p, 0.76, 1);
      tip.visible = p > 0.01 && p < 0.99;
      tip.position.set(at.x + retreat * 0.46, at.y + retreat * 0.16, at.z + retreat * 0.22);
      flakes.forEach((chip, i) => {
        const age = (p - 0.24 - i * 0.062) / 0.33;
        chip.visible = age >= 0 && age <= 1;
        if (!chip.visible) return;
        chip.position.set(
          at.x + 0.12 * age * Math.sin(i * 2.9),
          at.y + 0.08 * age - 0.52 * age * age,
          at.z + 0.11 * age,
        );
        chip.rotation.z = age * (i + 1);
      });
    },
  };
}

function brassCoin(id) {
  const root = group();
  const palm = group(root);
  const plate = egg(palm, enamel, 0, 0.13, 0, 0.55, 0.12, 0.39);
  plate.rotation.z = 0.08;
  for (let i = 0; i < 3; i++) {
    const x = -0.33 + i * 0.29;
    egg(palm, joint, x, 0.17, -0.26, 0.11, 0.09, 0.095);
    rod(palm, iron, [x, 0.18, -0.26], [x - 0.015, 0.32, -0.39], 0.091, 0.099);
    rod(palm, enamel, [x - 0.015, 0.32, -0.39], [x - 0.02, 0.39, -0.53], 0.08, 0.094);
  }
  rod(palm, enamel, [-0.38, 0.13, 0.1], [-0.54, 0.27, 0.19], 0.095, 0.13);
  const money = group(root);
  const outline = new THREE.Shape();
  outline.absarc(0, 0, 0.35, 0, tau, false);
  const hole = new THREE.Path();
  hole.moveTo(-0.074, -0.074);
  hole.lineTo(-0.074, 0.074);
  hole.lineTo(0.074, 0.074);
  hole.lineTo(0.074, -0.074);
  hole.closePath();
  outline.holes.push(hole);
  mesh(
    money,
    new THREE.ExtrudeGeometry(outline, {
      depth: 0.037,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.005,
      bevelSegments: 1,
      curveSegments: 24,
    }),
    brass,
    0,
    0,
    -0.018,
  );
  for (const side of [-1, 1]) {
    const z = side * 0.029;
    ring(money, gold, 0.32, 0.009, 0, 0, z);
    if (id === 'coin1') {
      for (const x of [-0.12, 0, 0.12])
        egg(money, '#cfb479', x, 0.198 + Math.abs(x) * 0.2, z, 0.018, 0.032, 0.009);
    } else if (id === 'coin2') {
      ring(money, gold, 0.041, 0.008, 0, 0.194, z);
      for (let j = 0; j < 7; j++) {
        const a = ((j + 0.25) * tau) / 7;
        rod(
          money,
          gold,
          [0.062 * Math.cos(a), 0.194 + 0.062 * Math.sin(a), z],
          [0.087 * Math.cos(a), 0.194 + 0.087 * Math.sin(a), z],
          0.007,
        );
      }
    } else {
      ink(
        money,
        gold,
        [
          [-0.046, 0.15, z],
          [0.006, 0.19, z],
          [0.076, 0.25, z],
        ],
        0.01,
      );
      for (let j = 0; j < 3; j++) {
        const leaf = egg(money, gold, -0.002 + 0.019 * j, 0.18 + j * 0.019, z, 0.033, 0.012, 0.008);
        leaf.rotation.z = -0.23;
      }
    }
    for (const sign of [-1, 1]) {
      ink(
        money,
        bronze,
        [
          [sign * 0.1, -0.225, z],
          [sign * 0.149, -0.07, z],
          [sign * 0.205, 0.12, z],
        ],
        0.009,
      );
      for (let k = 0; k < 3; k++) {
        const leaf = egg(
          money,
          gold,
          sign * (0.147 + k * 0.021),
          -0.083 + k * 0.061,
          z,
          0.048,
          0.014,
          0.009,
        );
        leaf.rotation.z = sign * (0.7 + k * 0.14);
      }
    }
  }
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 0.1;
    const blade = egg(
      root,
      i % 2 ? moss : fern,
      x,
      0.12 + 0.04 * Math.sin(i),
      -0.09,
      0.023,
      0.13 + (i % 2) * 0.05,
      0.018,
    );
    blade.rotation.z = (i - 3) * 0.17;
  }
  const number = Number(id.slice(-1));
  const light = glint(money, -0.185, 0.214, 0.04, 0.11);
  return {
    group: root,
    pose(p, t) {
      const rise = phase(p, 0.08, 0.52),
        land = phase(p, 0.52, 0.9);
      const catchCoin = phase(p, 0.38, 0.88);
      palm.visible = p > 0.34;
      palm.position.set(0.74 * (1 - catchCoin), 0.38 * catchCoin, 0.5 * (1 - catchCoin));
      money.position.set(0.075 * Math.sin(Math.PI * rise), 0.4 + rise * 1.32 - 1.08 * land, 0.035);
      money.rotation.set(
        -land * 1.16,
        0.21 + (number - 2) * 0.12 + tau * phase(p, 0.13, 0.76),
        0.11 * Math.sin(tau * rise),
      );
      light.scale.setScalar(
        0.2 + 0.85 * Math.max(0, Math.sin(p * Math.PI)) + 0.12 * Math.sin(t * 4 + number),
      );
    },
  };
}

export function starModel(id) {
  let model;
  switch (id) {
    case 'scope':
      model = telescope();
      break;
    case 'stars':
      model = orrery();
      break;
    case 'moth':
      model = moonMoth();
      break;
    case 'map':
      model = paperMap();
      break;
    case 'tree':
      model = cedar();
      break;
    case 'coin1':
    case 'coin2':
    case 'coin3':
      model = brassCoin(id);
      break;
    default:
      return null;
  }
  model.pose(0, 0);
  return model;
}
