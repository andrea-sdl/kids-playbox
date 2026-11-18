import { THREE, group as groupAt, mesh, egg, box, rod, ink } from './model-kit.js';

const tau = Math.PI * 2;
const walnut = 0x614337;
const honey = 0xe0ad62;
const charcoal = 0x263637;
const cedar = 0x78533a;
const indigo = 0x3d5875;

function segment(progress, start, end) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

// The profile starts at the base and turns around the vertical axis.
function vessel(parent, points, color, x, y, z) {
  const geo = new THREE.LatheGeometry(
    points.map(([r, h]) => new THREE.Vector2(r, h)),
    36,
  );
  return mesh(parent, geo, color, x, y, z);
}

function torusAt(parent, x, y, z, radius, thickness, color) {
  return mesh(parent, new THREE.TorusGeometry(radius, thickness, 7, 32), color, x, y, z);
}

function groundLeaves(parent, x, y, z, size) {
  for (let i = 0; i < 5; i++) {
    const leaf = egg(
      parent,
      i % 2 ? 0x79935e : 0x5c7c51,
      x + size * (i - 2) * 0.16,
      y + size * 0.12,
      z + 0.04 * Math.sin(i),
      size * 0.1,
      size * 0.23,
      size * 0.05,
    );
    leaf.rotation.z = (2 - i) * 0.32;
  }
}
function glassBell(group) {
  rod(group, cedar, [-0.96, 0, -0.14], [-0.88, 1.76, -0.14], 0.135);
  rod(group, cedar, [-0.88, 1.7, -0.14], [-0.55, 2.07, -0.12], 0.14);
  rod(group, walnut, [-0.55, 2.07, -0.12], [0.34, 2.18, -0.1], 0.095);
  groundLeaves(group, -0.68, 1.92, -0.12, 0.8);
  const hanger = groupAt(group, 0.09, 2.15, -0.1);
  rod(hanger, honey, [0, 0, 0], [0, -0.3, 0], 0.014);
  const shell = vessel(
    hanger,
    [
      [0.45, -0.92],
      [0.49, -0.78],
      [0.43, -0.54],
      [0.27, -0.37],
      [0.07, -0.31],
    ],
    0x9cdddc,
    0,
    0,
    0,
  );
  shell.material = shell.material.clone();
  shell.material.transparent = true;
  shell.material.opacity = 0.42;
  shell.material.depthWrite = false;
  const lip = torusAt(hanger, 0, -0.92, 0, 0.45, 0.023, 0xbad5c3);
  lip.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const azimuth = (i * tau) / 5;
    const petal = egg(
      hanger,
      indigo,
      Math.sin(azimuth) * 0.47,
      -0.77,
      Math.cos(azimuth) * 0.47,
      0.046,
      0.095,
      0.017,
    );
    petal.rotation.set(0, azimuth, -0.45 + i * 0.15);
  }
  const clapper = groupAt(hanger, 0, -0.35, 0);
  rod(clapper, walnut, [0, 0, 0], [0, -0.59, 0], 0.014);
  egg(clapper, 0xd79253, 0, -0.55, 0, 0.085, 0.105, 0.085);
  const strip = groupAt(clapper, 0, -0.63, 0);
  box(strip, 0xefdfad, 0, -0.29, 0, 0.23, 0.57, 0.021);
  ink(
    strip,
    indigo,
    [
      [-0.065, -0.46, 0.014],
      [0.025, -0.29, 0.014],
      [0.04, -0.16, 0.014],
    ],
    0.009,
  );
  for (let i = 0; i < 3; i++) {
    const flower = egg(strip, indigo, 0.027 - i * 0.025, -0.2 - i * 0.073, 0.018, 0.036, 0.016, 0.009);
    flower.rotation.z = i % 2 ? -0.6 : 0.6;
  }
  return (p, time) => {
    const swing = Math.sin(p * tau * 1.65) * Math.sin(p * Math.PI);
    hanger.rotation.z = swing * 0.42 + Math.sin(time * 0.85) * 0.026;
    clapper.rotation.z = -swing * 0.19;
    strip.rotation.z = Math.sin(p * tau * 2.1) * Math.sin(p * Math.PI) * 0.95;
  };
}

function hollowOwl(group) {
  const trunk = vessel(
    group,
    [
      [0.61, 0],
      [0.63, 0.13],
      [0.65, 0.35],
      [0.59, 0.81],
      [0.56, 1.48],
      [0.49, 1.82],
      [0.4, 1.97],
      [0.18, 2.02],
      [0.006, 1.99],
    ],
    cedar,
    0,
    0,
    -0.25,
  );
  trunk.scale.set(1.16, 1, 0.57);
  for (let i = 0; i < 13; i++) {
    const a = i * 2.399,
      ca = Math.cos(a),
      sa = Math.sin(a);
    const bark = rod(
      group,
      i % 2 ? 0x77503a : 0x8a6145,
      [ca * 0.71, 0.11, sa * 0.35 - 0.25],
      [ca * 0.59, 1.72 + (i % 4) * 0.05, sa * 0.29 - 0.25],
      0.028,
      0.05,
    );
    bark.rotation.z += Math.sin(i * 0.72) * 0.016;
  }
  rod(group, cedar, [-0.45, 1.57, -0.2], [-0.83, 1.92, -0.28], 0.065, 0.14);
  egg(group, 0x658052, -0.51, 1.84, -0.12, 0.23, 0.08, 0.14);
  egg(group, 0x77905c, 0.2, 1.98, -0.22, 0.29, 0.07, 0.17);
  egg(group, 0x342c28, 0, 1.08, 0.1, 0.57, 0.68, 0.11);
  for (const side of [-1, 1]) {
    rod(group, walnut, [side * 0.78, 0.06, 0.08], [side * 0.58, 0.57, 0.04], 0.12);
    ink(
      group,
      0x93684b,
      [
        [side * 0.59, 0.2, 0.12],
        [side * 0.63, 0.76, 0.1],
        [side * 0.53, 1.53, 0.05],
      ],
      0.045,
    );
  }
  groundLeaves(group, -0.55, 0.1, 0.31, 0.8);
  const perch = groupAt(group, 0, 0.49, 0.21);
  egg(perch, 0xa88864, 0, 0.29, 0, 0.34, 0.39, 0.255);
  egg(perch, 0xd2b796, 0, 0.27, 0.15, 0.28, 0.29, 0.15);
  const head = groupAt(perch, 0, 0.61, 0);
  egg(head, 0xa48766, 0, 0, 0, 0.38, 0.29, 0.28);
  const pupils = [],
    wings = [];
  for (const side of [-1, 1]) {
    egg(head, 0xdec8a2, side * 0.162, -0.002, 0.18, 0.18, 0.19, 0.105);
    const eye = groupAt(head, side * 0.145, 0.028, 0.275);
    egg(eye, 0x465e7e, 0, 0, 0, 0.082, 0.084, 0.041);
    egg(eye, charcoal, -0.006, 0.006, 0.024, 0.048, 0.054, 0.025);
    egg(eye, 0xffedcb, -0.018, 0.026, 0.049, 0.016, 0.016, 0.008);
    pupils.push(eye);
    const wing = groupAt(perch, side * 0.27, 0.49, 0);
    const feather = egg(wing, 0x876747, side * 0.024, -0.18, 0.018, 0.105, 0.26, 0.16);
    feather.rotation.z = side * 0.12;
    for (let k = 0; k < 4; k++) {
      const primary = egg(
        wing,
        k % 2 ? 0x8b7158 : 0x725b44,
        side * (k * 0.036 - 0.036),
        -0.28 - k * 0.024,
        0.082 - k * 0.018,
        0.041,
        0.19,
        0.061,
      );
      primary.rotation.z = side * (0.16 - k * 0.12);
    }
    wings.push(wing);
    egg(perch, honey, side * 0.13, -0.01, 0.11, 0.075, 0.04, 0.11);
    for (let i = 0; i < 3; i++) {
      egg(
        perch,
        0xa08461,
        side * (0.07 + 0.045 * (i % 2)),
        0.2 + 0.082 * i,
        0.283,
        0.025,
        0.041,
        0.012,
      ).rotation.z = side * -0.42;
    }
  }
  const beak = mesh(head, new THREE.ConeGeometry(0.068, 0.14, 5), 0xc69854, 0, -0.076, 0.257);
  beak.rotation.z = Math.PI;
  return (p, time) => {
    const call = Math.sin(Math.PI * segment(p, 0.28, 0.83));
    perch.position.y = 0.45 + 0.16 * segment(p, 0.1, 0.42);
    perch.position.z = 0.16 + 0.16 * segment(p, 0.08, 0.5);
    head.rotation.z = Math.sin(time * 0.9) * 0.035 + call * 0.13;
    pupils.forEach((eye) => {
      eye.scale.y = 0.19 + 0.81 * segment(p, 0.03, 0.32);
    });
    wings[0].rotation.z = -1.48 * call;
    wings[1].rotation.z = 1.48 * call;
    beak.scale.y = 1 + call * 0.38;
  };
}

function porcelainPods(group) {
  rod(group, 0x657747, [-0.16, 0.02, 0], [-0.13, 0.73, 0], 0.055);
  const petals = [],
    dust = [];
  [
    [-0.6, 0.87, -0.09, 0.73],
    [0.04, 0.93, 0.1, 1],
    [0.65, 0.81, -0.06, 0.66],
  ].forEach(([x, y, z, scale], n) => {
    rod(group, 0x708351, [-0.13, 0.59, 0], [x, y, z], 0.04);
    const pod = groupAt(group, x, y, z);
    pod.scale.setScalar(scale);
    for (let k = 0; k < 5; k++) {
      const socket = groupAt(pod);
      socket.rotation.y = (tau * k) / 5;
      const hinge = groupAt(socket, 0, 0, 0.03);
      const lobe = egg(hinge, 0xf0dfb7, 0, 0.28, 0.105, 0.135, 0.32, 0.09);
      lobe.rotation.x = -0.2;
      egg(hinge, indigo, 0, 0.25, 0.18, 0.041, 0.066, 0.018).rotation.z = 0.32;
      if (n === 1) petals.push(hinge);
    }
    groundLeaves(group, x * 0.7, y - 0.32, z, 0.69);
  });
  for (let i = 0; i < 28; i++) {
    const radius = 0.018 + (i % 5) * 0.004;
    dust.push(egg(group, i % 3 ? 0xf8d278 : 0xffe9af, 0, 1.33, 0.1, radius, radius, radius));
  }
  return (p) => {
    const burst = segment(p, 0.26, 0.88);
    petals.forEach((part, i) => {
      part.rotation.x = segment(p, 0.19 + i * 0.018, 0.51 + i * 0.012) * 0.99;
    });
    dust.forEach((grain, i) => {
      grain.visible = p > 0.29 && p < 0.98;
      const theta = i * 2.399;
      const drift = (0.22 + (i % 7) * 0.105) * burst;
      grain.position.set(
        0.04 + Math.cos(theta) * drift,
        1.3 + burst * (1.55 + (i % 4) * 0.11) - burst * burst * 1.42,
        0.1 + Math.sin(theta) * drift,
      );
      const radius = 0.018 + (i % 5) * 0.004;
      grain.scale.setScalar(radius * Math.sin(segment(p, 0.28, 0.98) * Math.PI));
    });
  };
}

function mapleLetter(group) {
  vessel(
    group,
    [
      [0.47, 0],
      [0.49, 0.08],
      [0.37, 0.15],
      [0.36, 1.43],
      [0.44, 1.48],
      [0.44, 1.55],
      [0.36, 1.59],
      [0.28, 1.68],
      [0, 1.71],
    ],
    0x547b77,
    0,
    0,
    0,
  );
  for (const y of [0.22, 1.43]) {
    const rim = torusAt(group, 0, y, 0, 0.37, 0.022, 0x9b8866);
    rim.rotation.x = Math.PI / 2;
  }
  box(group, 0x9a7b55, 0, 1.19, 0.35, 0.51, 0.145, 0.05);
  box(group, 0x322f2c, 0, 1.2, 0.384, 0.43, 0.09, 0.026);
  box(group, 0x476d69, 0, 0.63, 0.345, 0.4, 0.56, 0.05);
  egg(group, honey, 0.123, 0.65, 0.38, 0.029, 0.029, 0.02);
  groundLeaves(group, -0.38, 0.09, 0.14, 0.82);
  const flag = groupAt(group, 0.36, 1.08, 0.04);
  rod(flag, walnut, [0, 0, 0], [0, 0.49, 0], 0.028);
  box(flag, 0xd8734b, 0.1, 0.46, 0, 0.22, 0.17, 0.052);
  const leaf = groupAt(group);
  const map = [
    [0, -0.15],
    [-0.07, -0.1],
    [-0.19, -0.11],
    [-0.14, -0.03],
    [-0.24, 0.06],
    [-0.13, 0.06],
    [-0.14, 0.16],
    [-0.05, 0.1],
    [0, 0.28],
    [0.055, 0.105],
    [0.16, 0.17],
    [0.14, 0.065],
    [0.24, 0.08],
    [0.14, -0.02],
    [0.18, -0.1],
    [0.06, -0.085],
    [0, -0.15],
  ];
  const outline = new THREE.Shape();
  outline.moveTo(...map[0]);
  map.slice(1).forEach((v) => outline.lineTo(...v));
  mesh(leaf, new THREE.ExtrudeGeometry(outline, { depth: 0.018, bevelEnabled: false }), 0xc95031);
  ink(
    leaf,
    honey,
    [
      [0, -0.24, 0.015],
      [0, -0.08, 0.024],
      [0.004, 0.19, 0.02],
    ],
    0.011,
  );
  return (p) => {
    const approach = segment(p, 0.05, 0.65),
      enter = segment(p, 0.61, 0.79);
    leaf.visible = p < 0.8;
    leaf.position.set(
      -0.67 * (1 - approach),
      1.19 + (1 - approach) * 0.71,
      0.5 + 0.18 * Math.sin(approach * Math.PI) - enter * 0.23,
    );
    leaf.rotation.set(
      -enter * 1.4,
      Math.sin(approach * tau) * 0.5,
      -0.64 * (1 - approach) + approach * 1.52,
    );
    leaf.scale.setScalar(1 - enter * 0.81);
    flag.rotation.z = (-Math.PI / 2) * (1 - segment(p, 0.68, 0.94));
  };
}
function mendedQuilt(group) {
  const frame = groupAt(group, 0, 0.94, 0);
  frame.rotation.x = -0.3;
  rod(group, walnut, [-1.03, 0.05, -0.12], [-1.03, 1.67, -0.12], 0.054);
  rod(group, walnut, [1.03, 0.05, -0.12], [1.03, 1.67, -0.12], 0.054);
  rod(group, cedar, [-1.2, 1.65, -0.12], [1.2, 1.65, -0.12], 0.068);
  const fabric = new THREE.PlaneGeometry(1.96, 1.42, 30, 20).toNonIndexed();
  const coords = fabric.attributes.position;
  const colors = [];
  const fabricColors = [0x385471, 0x486280, 0x536e84, 0x405873];
  function depth(x, y) {
    return 0.12 * Math.sin(x * 7 + y * 1.15) + 0.055 * Math.cos(y * 4 - x * 4);
  }
  for (let i = 0; i < coords.count; i += 3) {
    const x = (coords.getX(i) + coords.getX(i + 1) + coords.getX(i + 2)) / 3;
    const y = (coords.getY(i) + coords.getY(i + 1) + coords.getY(i + 2)) / 3;
    const checker = Math.floor(((x + 0.98) / 1.96) * 6) + 3 * Math.floor(((y + 0.71) / 1.42) * 5);
    const dye = new THREE.Color(fabricColors[checker % 4]);
    for (let j = i; j < i + 3; j++) {
      coords.setZ(j, depth(coords.getX(j), coords.getY(j)));
      colors.push(dye.r, dye.g, dye.b);
    }
  }
  fabric.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  fabric.computeVertexNormals();
  const cloth = mesh(frame, fabric, 0xffffff);
  cloth.material = cloth.material.clone();
  cloth.material.vertexColors = true;
  cloth.material.side = THREE.DoubleSide;
  for (const y of [-0.52, 0.49]) {
    const hem = [];
    for (let i = 0; i < 24; i++) {
      const x = -0.96 + (i * 1.92) / 23;
      hem.push([x, y, depth(x, y) + 0.012]);
    }
    ink(frame, 0xa9b7ae, hem, 0.012);
  }
  // One embroidered surface carries all rows of sashiko waves in the folds.
  const waves = [];
  for (let row = 0; row < 3; row++) {
    for (let motif = 0; motif < 6; motif++) {
      for (let j = 0; j < 12; j++) {
        const baseX = -0.8 + motif * 0.32,
          baseY = 0.26 - row * 0.36;
        for (const angle of [(Math.PI * j) / 12, (Math.PI * (j + 0.75)) / 12]) {
          const x = baseX + 0.14 * Math.cos(angle),
            y = baseY + 0.13 * Math.sin(angle);
          waves.push(x, y, depth(x, y) + 0.018);
        }
      }
    }
  }
  const needlework = new THREE.BufferGeometry();
  needlework.setAttribute('position', new THREE.Float32BufferAttribute(waves, 3));
  frame.add(new THREE.LineSegments(needlework, new THREE.LineBasicMaterial({ color: 0xb7c1a7 })));
  const stitches = [];
  for (let i = 0; i < 7; i++) {
    const x = -0.43 + i * 0.14,
      y = -0.1 + 0.04 * Math.sin(i * 0.96);
    stitches.push(
      ink(
        frame,
        0xcf6650,
        [
          [x - 0.032, y - 0.066, depth(x, y) + 0.04],
          [x, y, depth(x, y) + 0.055],
          [x + 0.03, y + 0.062, depth(x, y) + 0.032],
        ],
        0.025,
      ),
    );
  }
  const thread = groupAt(frame, -0.41, -0.12, 0.152);
  ink(
    thread,
    0xee8563,
    [
      [0, 0, 0],
      [0.12, 0.3, 0.06],
      [0.29, 0.39, 0.07],
      [0.43, 0.26, 0.08],
      [0.37, 0.12, 0.1],
      [0.19, 0.18, 0.11],
      [0.22, 0.27, 0.11],
      [0.43, 0.19, 0.12],
      [0.62, 0.04, 0.09],
    ],
    0.026,
  );
  return (p) => {
    const pull = segment(p, 0.17, 0.89);
    thread.position.x = -0.41 + pull * 0.83;
    thread.scale.setScalar(1 - pull);
    thread.rotation.z = Math.sin(pull * Math.PI) * 0.39;
    thread.visible = pull < 0.997;
    stitches.forEach((stitch, i) => {
      stitch.visible = pull > (i + 1) / 8;
    });
    frame.rotation.x = -0.3 + Math.sin(p * Math.PI) * 0.073;
  };
}

function rootMusicBox(group) {
  group.rotation.y = -0.28;
  const caseColor = 0x795940;
  box(group, caseColor, 0, 0.3, 0.025, 1.48, 0.4, 0.9);
  box(group, honey, 0, 0.535, 0.025, 1.53, 0.08, 0.95);
  box(group, 0x434a40, 0, 0.578, 0.02, 1.4, 0.042, 0.82);
  const lid = groupAt(group, 0, 0.55, -0.4);
  box(lid, caseColor, 0, 0.41, 0, 1.49, 0.83, 0.085);
  box(lid, 0x9a7851, 0, 0.41, 0.049, 1.31, 0.67, 0.025);
  for (const side of [-1, 1]) {
    rod(group, 0x786d50, [side * 0.57, 0.58, -0.15], [side * 0.57, 0.85, -0.15], 0.062);
    egg(group, 0x5b4634, side * 0.53, 0.098, 0.33, 0.11, 0.09, 0.09);
  }
  box(group, 0x9c7955, 0, 0.32, 0.484, 1.28, 0.238, 0.017);
  box(group, 0xa38452, 0, 0.46, 0.502, 0.15, 0.15, 0.036);
  egg(group, walnut, 0, 0.45, 0.524, 0.024, 0.032, 0.015);
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.2;
    egg(lid, 0xb1a076, x, 0.47, 0.073, 0.082, 0.024, 0.011).rotation.z = i % 2 ? 0.55 : -0.55;
  }
  const barrel = groupAt(group, 0, 0.86, -0.13);
  const drum = mesh(barrel, new THREE.CylinderGeometry(0.237, 0.237, 0.96, 28), 0xbf9453);
  drum.rotation.z = Math.PI / 2;
  for (let i = 0; i < 22; i++) {
    const angle = i * 2.399,
      x = -0.43 + ((i * 7) % 15) * 0.061;
    egg(barrel, 0xe7bf72, x, 0.237 * Math.cos(angle), 0.237 * Math.sin(angle), 0.026, 0.033, 0.033);
  }
  const tongues = [];
  for (let i = 0; i < 9; i++) {
    const finger = groupAt(group, -0.48 + i * 0.12, 0.66, 0.32);
    box(finger, 0xc2bc9f, 0, 0.022, -0.115, 0.07, 0.032, 0.29 + (i % 4) * 0.014);
    tongues.push(finger);
  }
  const key = groupAt(group, 0.88, 0.85, -0.13);
  rod(key, honey, [-0.31, 0, 0], [0, 0, 0], 0.043);
  for (const side of [-1, 1]) {
    const bow = torusAt(key, 0, side * 0.082, 0, 0.09, 0.029, honey);
    bow.rotation.y = Math.PI / 2 - 0.28;
  }
  groundLeaves(group, -0.7, 0.09, 0.31, 0.8);
  return (p) => {
    const turn = segment(p, 0.075, 0.84);
    key.rotation.x = turn * tau * 1.2;
    barrel.rotation.x = turn * tau * 1.6;
    lid.rotation.x = -0.1 - segment(p, 0, 0.27) * 0.31;
    tongues.forEach((finger, i) => {
      const note = Math.max(0, 1 - Math.abs(p - (0.3 + i * 0.055)) / 0.06);
      finger.rotation.x = -0.32 * note;
    });
  };
}

function lastTea(group) {
  vessel(
    group,
    [
      [0.82, 0.025],
      [0.84, 0.054],
      [0.81, 0.13],
      [0.73, 0.16],
    ],
    0xa46b44,
    0,
    0,
    0,
  );
  const kettle = groupAt(group, -0.31, 0.13, -0.21);
  vessel(
    kettle,
    [
      [0.25, 0],
      [0.38, 0.12],
      [0.4, 0.3],
      [0.31, 0.48],
      [0.23, 0.51],
    ],
    0x56635b,
    0,
    0,
    0,
  );
  egg(kettle, 0x48564e, 0, 0.51, 0, 0.25, 0.053, 0.25);
  egg(kettle, 0xb99558, 0, 0.59, 0, 0.068, 0.054, 0.068);
  ink(
    kettle,
    walnut,
    [
      [-0.28, 0.36, 0],
      [-0.34, 0.71, 0],
      [-0.18, 0.89, 0],
      [0.12, 0.9, 0],
      [0.3, 0.72, 0],
      [0.29, 0.39, 0],
    ],
    0.042,
  );
  rod(kettle, 0x687970, [-0.31, 0.28, 0], [-0.55, 0.42, 0.02], 0.102);
  rod(kettle, 0x687970, [-0.53, 0.41, 0.02], [-0.64, 0.55, 0.035], 0.076);
  vessel(
    group,
    [
      [0.28, 0.001],
      [0.3, 0.02],
      [0.35, 0.063],
      [0.32, 0.075],
      [0.18, 0.038],
      [0.01, 0.036],
    ],
    0xd1c1a1,
    0.43,
    0.15,
    0.25,
  );
  const cup = groupAt(group, 0.43, 0.194, 0.25);
  vessel(
    cup,
    [
      [0.115, 0],
      [0.132, 0.04],
      [0.154, 0.056],
      [0.191, 0.26],
      [0.184, 0.275],
      [0.159, 0.264],
      [0.139, 0.1],
      [0.015, 0.084],
    ],
    0xe3d0ac,
    0,
    0,
    0,
  );
  const liquid = mesh(cup, new THREE.CylinderGeometry(0.159, 0.159, 0.009, 32), 0x986b32, 0, 0.237, 0);
  const collar = torusAt(cup, 0, 0.235, 0, 0.182, 0.009, indigo);
  collar.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.257;
    egg(cup, indigo, 0.157 * Math.sin(a), 0.134, 0.157 * Math.cos(a), 0.031, 0.051, 0.017).rotation.y =
      a;
  }
  const wrist = groupAt(group, 0.91, 0.39, 0.26);
  const palm = egg(wrist, 0x89a68c, 0.115, 0, 0, 0.26, 0.16, 0.19);
  palm.rotation.z = 0.16;
  const knuckle = torusAt(wrist, 0.28, -0.015, 0, 0.143, 0.034, 0x4e675b);
  knuckle.rotation.y = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const z = 0.137 - i * 0.118;
    rod(wrist, 0x819782, [0.045, -0.015, z], [-0.1, -0.062, z + 0.016], 0.059);
    rod(wrist, 0x70917d, [-0.1, -0.062, z + 0.016], [-0.177, -0.143, z + 0.024], 0.05);
  }
  const plumes = [];
  for (let i = 0; i < 3; i++) {
    plumes.push(
      ink(
        cup,
        0xeae4ce,
        [
          [0, 0, 0],
          [-0.025, 0.095, 0],
          [0.025, 0.17, 0],
          [0.016, 0.24, 0],
        ],
        0.009,
      ),
    );
  }
  return (p, time) => {
    const grasp = segment(p, 0.03, 0.22),
      lift = segment(p, 0.23, 0.55) - segment(p, 0.7, 0.96);
    cup.position.set(0.43 - lift * 0.21, 0.194 + lift * 0.9, 0.25 + lift * 0.11);
    cup.rotation.z = lift * 0.39;
    wrist.position.set(0.91 - 0.24 * grasp - lift * 0.21, 0.39 + lift * 0.9, 0.26 + lift * 0.11);
    wrist.rotation.z = lift * 0.39;
    wrist.visible = p > 0.025 && p < 0.99;
    liquid.position.y = 0.237 - segment(p, 0.56, 0.72) * 0.044;
    plumes.forEach((plume, i) => {
      const phase = (time * 0.48 + i / 3) % 1;
      plume.position.set(0.04 * Math.sin(phase * tau + i), 0.27 + phase * 0.21, 0.018 * i);
      plume.scale.setScalar(0.32 + 0.68 * Math.sin(phase * Math.PI));
    });
  };
}

const makers = {
  bell: glassBell,
  owl: hollowOwl,
  pods: porcelainPods,
  letter: mapleLetter,
  quilt: mendedQuilt,
  song: rootMusicBox,
  tea: lastTea,
};

export function woodModel(id) {
  if (!Object.hasOwn(makers, id)) return null;
  const group = new THREE.Group();
  const pose = makers[id](group);
  pose(0, 0);
  return { group, pose };
}
