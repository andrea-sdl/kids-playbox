// Room-scale structures. Their front edges face the walking path at +Z.
import { THREE as T, group, mesh, box, rod, ink } from './model-kit.js';

const timber = '#574132';
const joinery = '#322d29';
const paper = '#d9c89f';
const bronze = '#99805a';
const wall = '#bb9969';
const moss = '#65794c';
const stone = ['#757a68', '#7e8270', '#676d60', '#93927b', '#858775'];
const bricks = ['#9f745d', '#ad8060', '#865f50', '#bd916e', '#9b725a'];
const TAU = Math.PI * 2;

function variation(index) {
  const sample = Math.sin(index * 78.233 + 16.43) * 43758.5453;
  return sample - Math.floor(sample);
}

// Periodic noise lets mineral inclusions cross the texture seam.
function mineral(u, v, tilesX, tilesY) {
  const x = u * tilesX,
    y = v * tilesY,
    ix = Math.floor(x),
    iy = Math.floor(y);
  const fractX = x - ix,
    fractY = y - iy;
  const nx = fractX * fractX * (3 - 2 * fractX),
    ny = fractY * fractY * (3 - 2 * fractY);
  const at = (a, b) =>
    variation((((a % tilesX) + tilesX) % tilesX) * 113 + (((b % tilesY) + tilesY) % tilesY) * 369);
  const lower = T.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), nx);
  const upper = T.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), nx);
  return T.MathUtils.lerp(lower, upper, ny);
}

// A small repeatable material grain. The dark marks run along the straw
// and wood fibres, while tatami has a cross-woven rush pattern.
const finishes = new Map();
function surface(base, grain) {
  const key = base + grain;
  if (finishes.has(key)) return finishes.get(key);
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = variation(y * size + x);
      let value = 0.91 + n * 0.07;
      if (grain === 'straw') {
        const stalk = (x + Math.round(Math.sin(y / 18 + x / 20))) % 4;
        value = 0.82 + variation(x) * 0.18 + n * 0.06 - (stalk === 0 ? 0.22 : 0);
      }
      if (grain === 'timber') {
        const ring = Math.sin(x * 0.48 + Math.sin(y / 31) + Math.sin(x / 8 + y / 25));
        value = 0.86 + ring * 0.07 + n * 0.09;
      }
      if (grain === 'tatami') value = 0.82 + ((y % 7) / 7) * 0.14 + (x % 16 < 2 ? -0.07 : 0) + n * 0.05;
      if (grain === 'rock') {
        const u = x / size,
          v = y / size,
          chip = mineral(u, v, 15, 26),
          cloud = mineral(u, v, 4, 5);
        const dipping = v + 0.025 * Math.sin(u * TAU) + 0.044 * (cloud - 0.5);
        const fault = Math.abs(Math.sin((dipping + 0.022 * chip) * TAU * 5));
        value =
          0.69 + 0.17 * cloud + 0.17 * chip + n * 0.08 - (fault < 0.16 ? 0.12 * (1 - fault / 0.16) : 0);
      }
      const j = (y * size + x) * 4;
      data.fill(Math.round(Math.min(1, value) * 255), j, j + 3);
      data[j + 3] = 255;
    }
  }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  const mat = new T.MeshLambertMaterial({ color: base, map: texture });
  finishes.set(key, mat);
  return mat;
}

function boards(parent, base, x, y, z, width, height, depth, grain = 'timber') {
  const part = box(parent, base, x, y, z, width, height, depth);
  part.material = surface(base, grain);
  return part;
}

function beam(parent, from, to, w, d = w, color = timber) {
  const a = new T.Vector3(...from),
    b = new T.Vector3(...to);
  const mid = a.clone().lerp(b, 0.5);
  const part = boards(parent, color, mid.x, mid.y, mid.z, w, a.distanceTo(b), d);
  part.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.sub(a).normalize());
  return part;
}

function shoji(parent, x, y, z, w, h, columns = 4) {
  box(parent, paper, x, y, z, w, h, 0.11);
  for (let i = 0; i <= columns; i++) {
    const end = i === 0 || i === columns;
    box(
      parent,
      end ? joinery : timber,
      x - w / 2 + (w * i) / columns,
      y,
      z + 0.075,
      end ? 0.1 : 0.047,
      h,
      0.075,
    );
  }
  for (let i = 0; i <= 6; i++) {
    const end = i === 0 || i === 6;
    box(
      parent,
      end ? joinery : timber,
      x,
      y - h / 2 + (h * i) / 6,
      z + 0.08,
      w,
      end ? 0.1 : 0.043,
      0.065,
    );
  }
}

function faced(parent, outline, depth, x, y, z, color) {
  const shape = new T.Shape();
  outline.forEach(([u, v], i) => (i ? shape.lineTo(u, v) : shape.moveTo(u, v)));
  shape.closePath();
  return mesh(parent, new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), color, x, y, z);
}

function gassho(parent) {
  const h = group(parent, 5.65, 0, -6.8);
  h.rotation.y = -0.42;
  // Raised floor on fieldstone piers. The veranda drops straight to the path.
  for (let i = 0; i <= 7; i++) {
    box(h, stone[i % stone.length], -4.92 + i * 1.4, 0.26, 2.77, 0.74, 0.49, 0.74);
  }
  boards(h, timber, 0, 0.58, 0, 10.8, 0.3, 5.9);
  box(h, wall, 0, 2.12, -0.22, 9.7, 2.82, 4.8);
  const front = 2.22;
  for (let i = 0; i < 22; i++)
    boards(h, i % 4 === 0 ? '#897150' : '#756048', -5.16 + i * 0.49, 0.77, 2.82, 0.465, 0.15, 1.35);
  for (const [x, z] of [
    [-4.85, front],
    [-3.1, front],
    [-1.4, front],
    [1.55, front],
    [3.2, front],
    [4.85, front],
    [-4.85, -2.55],
    [4.85, -2.55],
  ]) {
    boards(h, joinery, x, 2.13, z, 0.2, 2.82, 0.24);
  }
  for (const y of [1.12, 3.23, 3.57]) boards(h, timber, 0, y, front + 0.05, 10.13, 0.18, 0.25);
  for (const x of [-3.95, -2.25, 2.37, 4.04]) shoji(h, x, 2.18, front + 0.16, 1.48, 1.86, 3);
  box(h, '#3b342e', 0.65, 2.06, front + 0.16, 1.82, 2.38, 0.17);
  box(h, '#242a29', 0.72, 2.13, front + 0.27, 1.43, 2.2, 0.05);
  for (let i = 0; i < 3; i++) {
    box(h, stone[3 - i], 0.65, 0.12 + i * 0.13, 4.11 - i * 0.36, 2.6 - i * 0.14, 0.24 + i * 0.13, 0.69);
  }
  for (let i = 0; i < 22; i++) {
    const z = -2.64 + i * 0.227;
    boards(h, i % 3 ? '#917b59' : '#9f8d68', 4.94, 1.87, z, 0.16, 1.94, 0.211);
  }
  for (const z of [-2.23, -0.74, 0.75]) {
    const sideWindow = group(h, 5.04, 2.26, z);
    sideWindow.rotation.y = Math.PI / 2;
    shoji(sideWindow, 0, 0, 0, 1.19, 1.37, 3);
  }
  for (const x of [-4.02, -2.95, 2.93, 4.02]) {
    rod(h, '#79684b', [x, 1.04, 3.41], [x, 1.52, 3.41], 0.055, 0.064);
  }
  for (const x of [-3.52, 3.48]) boards(h, '#836d49', x, 1.43, 3.41, 1.18, 0.11, 0.11);
  // End gable under a 55-degree thatched roof. Its short timber braces
  // follow the load path from the ridge to both top plates.
  faced(
    h,
    [
      [-4.82, 3.48],
      [4.82, 3.48],
      [0, 10.34],
    ],
    4.92,
    0,
    0,
    -2.61,
    wall,
  );
  for (const z of [-2.73, 2.42]) {
    beam(h, [-4.85, 3.48, z], [0, 10.42, z], 0.21, 0.23, joinery);
    beam(h, [4.85, 3.48, z], [0, 10.42, z], 0.21, 0.23, joinery);
  }
  for (const [y, len] of [
    [4.43, 8.26],
    [6.08, 5.74],
    [7.75, 3.64],
  ])
    boards(h, timber, 0, y, 2.48, len, 0.2, 0.22);
  shoji(h, 0, 5.24, 2.56, 2.58, 1.37, 6);
  shoji(h, 0, 7.01, 2.55, 1.37, 1.25, 3);
  for (const side of [-1, 1]) {
    const eave = new T.Vector3(side * 5.65, 3.03, 0);
    const ridge = new T.Vector3(side * 0.08, 10.68, 0);
    const slope = ridge.clone().sub(eave);
    // Overlapping rows of cut straw create the scalloped edge of each course.
    for (let row = 0; row < 7; row++) {
      const middle = eave.clone().addScaledVector(slope, (row + 0.5) / 7);
      const panel = boards(
        h,
        ['#a9915a', '#a48c57', '#aa925b'][row % 3],
        middle.x + side * 0.18,
        middle.y,
        0,
        0.52,
        slope.length() / 7 + 0.23,
        6.83,
        'straw',
      );
      panel.rotation.z = Math.atan2(-slope.x, slope.y);
      const lower = eave.clone().addScaledVector(slope, row / 7);
      const upper = eave.clone().addScaledVector(slope, (row + 1) / 7);
      beam(
        h,
        [lower.x + side * 0.21, lower.y - 0.06, 3.42],
        [upper.x + side * 0.21, upper.y + 0.06, 3.42],
        0.31,
        0.28,
        '#b69a64',
      );
    }
    const straws = [];
    for (let i = 0; i < 560; i++) {
      const t = variation(i + 41) * 0.98,
        z = (variation(i + 1111) - 0.5) * 6.77;
      const start = eave.clone().addScaledVector(slope, t);
      const end = eave
        .clone()
        .addScaledVector(slope, Math.min(1, t + 0.025 + variation(i + 21) * 0.064));
      // Stalks lie on the exposed face, parallel to the fall of the roof.
      const liftX = side * 0.417,
        liftY = 0.17,
        width = 0.013 + variation(i + 38) * 0.017;
      straws.push(
        start.x + liftX,
        start.y + liftY,
        z - width,
        start.x + liftX,
        start.y + liftY,
        z + width,
        end.x + liftX,
        end.y + liftY,
        z + (variation(i + 3) - 0.5) * 0.044,
      );
    }
    const brush = new T.BufferGeometry();
    brush.setAttribute('position', new T.Float32BufferAttribute(straws, 3));
    brush.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array((straws.length / 3) * 2), 2));
    brush.computeVertexNormals();
    mesh(h, brush, '#b29c6e');
    for (let i = 0; i < 66; i++) {
      const z = -3.38 + i * 0.103;
      const drop = 0.1 + variation(i) * 0.19;
      rod(
        h,
        i % 3 ? '#947647' : '#c1a264',
        [side * 5.67, 3.28, z],
        [side * (5.78 + drop * 0.3), 3.01 - drop, z + 0.025],
        0.052,
        0.013,
      );
    }
  }
  boards(h, '#87704a', 0, 10.68, 0, 0.79, 0.46, 7.04, 'straw');
  for (let i = 0; i < 9; i++) {
    const z = -3.22 + i * 0.8;
    beam(h, [-0.36, 10.6, z], [0.19, 11.05, z], 0.09, 0.15);
    beam(h, [0.36, 10.6, z], [-0.19, 11.05, z], 0.09, 0.15);
  }
}

function hearth(parent) {
  const floor = group(parent);
  box(floor, '#5e4b38', 0, -0.22, -1.6, 40, 0.4, 16);
  // Dark silk borders separate the alternating orientations of the rush mats.
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 9; col++) {
      const x = (col - 4) * 4.4,
        z = -6.55 + row * 4.45;
      boards(floor, '#4a5242', x, -0.02, z, 4.37, 0.07, 4.41);
      for (const side of [-1, 1]) {
        const mat = boards(
          floor,
          (row + col) % 3 === 0 ? '#bdab7a' : '#c6b585',
          x + side * 1.07,
          0.02,
          z,
          2.07,
          0.04,
          4.23,
          'tatami',
        );
        if ((row + col) % 2) {
          mat.position.set(x, 0.02, z + side * 1.07);
          mat.rotation.y = Math.PI / 2;
        }
      }
    }
  }
  box(parent, '#8d7659', 0, 3.64, -9.3, 40, 7.3, 0.4);
  for (let i = 0; i < 10; i++) {
    const x = -18 + i * 4;
    if (i === 2 || i === 3) {
      box(parent, '#34392f', x, 2.61, -8.98, 3.64, 4.76, 0.23);
      for (let k = 0; k < 6; k++)
        boards(parent, '#554b37', x - 1.55 + k * 0.61, 2.62, -8.78, 0.13, 4.74, 0.1);
    } else shoji(parent, x, 2.63, -9.0, 3.73, 4.65, 5);
    boards(parent, timber, x + 1.97, 4.1, -8.77, 0.29, 8.2, 0.38);
  }
  for (const y of [0.31, 5.07, 6.84]) boards(parent, joinery, 0, y, -8.74, 40, 0.29, 0.42);
  // The rear half of the pitched ceiling is in view past the struts.
  for (let i = 0; i < 28; i++) {
    const x = -19.29 + i * 1.43;
    const plank = boards(parent, i % 3 ? '#6c5541' : '#785e44', x, 8.91, -6.37, 1.42, 0.14, 7.5);
    plank.rotation.x = -0.577;
  }
  for (let i = -2; i <= 2; i++) {
    const x = i * 7.65;
    boards(parent, timber, x, 7.5, -3.54, 0.34, 0.45, 10.9);
    beam(parent, [x, 7.0, -8.91], [x, 10.46, -3.64], 0.25, 0.29);
    beam(parent, [x, 10.46, -3.64], [x, 7.03, 1.54], 0.25, 0.29);
  }
  for (const [y, z] of [
    [8.05, -7.4],
    [9.0, -5.96],
    [10.22, -3.58],
    [8.97, -1.61],
  ]) {
    boards(parent, joinery, 0, y, z, 40, 0.25, 0.28);
  }
  // The suspended kettle hangs from the hollow bamboo hook over the irori.
  const x = 1.1,
    z = -5.88;
  box(parent, timber, x, 0.15, z, 3.32, 0.25, 2.34);
  box(parent, '#49453a', x, 0.29, z, 2.96, 0.1, 2.0);
  for (let i = 0; i < 6; i++) {
    beam(
      parent,
      [x - 0.8 + i * 0.15, 0.41, z - 0.34],
      [x - 0.07 + i * 0.17, 0.41, z + 0.39],
      0.11,
      0.13,
      '#4e3d2d',
    );
  }
  rod(parent, bronze, [x, 7.47, z], [x, 3.45, z], 0.072, 0.075);
  rod(parent, joinery, [x, 3.48, z], [x, 1.73, z], 0.033);
  const body = mesh(parent, new T.SphereGeometry(0.59, 20, 12), '#484942', x, 1.0, z);
  body.scale.set(1, 0.68, 1);
  rod(parent, '#4b4940', [x, 1.3, z], [x, 1.37, z], 0.39, 0.45);
  ink(
    parent,
    '#3a3833',
    [
      [x - 0.41, 1.18, z],
      [x - 0.43, 1.62, z],
      [x - 0.2, 1.87, z],
      [x + 0.16, 1.89, z],
      [x + 0.42, 1.63, z],
      [x + 0.38, 1.17, z],
    ],
    0.055,
  );
  box(parent, '#544535', 9, 0.34, -4.95, 3.57, 0.16, 1.83);
  for (const u of [-1, 1])
    for (const v of [-1, 1]) box(parent, timber, 9 + u * 1.4, 0.15, -4.95 + v * 0.62, 0.19, 0.3, 0.19);
}

function halt(parent) {
  const station = group(parent, -6.9, 0, -7.6);
  // The two platform levels stand on old piles above the reed beds.
  for (let i = 0; i < 8; i++) {
    const x = -5.11 + i * 1.46;
    for (const z of [-1.8, 1.8]) boards(station, '#514a3a', x, 0.16, z, 0.37, 1.56, 0.38);
  }
  for (let i = 0; i < 36; i++)
    boards(station, i % 3 ? '#8b7759' : '#79684e', -5.65 + i * 0.323, 0.63, 0, 0.31, 0.18, 4.55);
  const shelter = group(station, -0.85, 0.74, -0.41);
  for (const x of [-3.35, 0, 3.35]) {
    for (const z of [-1.34, 1.14]) {
      boards(shelter, timber, x, 1.75, z, 0.22, 3.5, 0.22);
      beam(shelter, [x, 2.68, z], [x + 0.54, 3.42, z], 0.13, 0.14);
    }
  }
  boards(shelter, joinery, 0, 3.44, 0, 7.19, 0.22, 3.17);
  for (const side of [-1, 1]) {
    const roof = box(shelter, '#526263', 0, 3.76, side * 0.94, 7.89, 0.17, 2.1);
    roof.rotation.x = side * 0.31;
    for (let i = 0; i < 20; i++) {
      const x = -3.72 + i * 0.39;
      beam(shelter, [x, 4.14, 0], [x, 3.51, side * 1.96], 0.053, 0.058, '#6b7773');
    }
  }
  for (let i = 0; i < 18; i++)
    boards(shelter, '#8f8061', -3.23 + i * 0.38, 1.26, -1.36, 0.36, 2.43, 0.13);
  for (const z of [-0.87, -0.54, -0.21]) boards(shelter, '#9a7854', 0, 0.71, z, 4.7, 0.13, 0.25);
  for (const x of [-1.8, 1.8]) boards(shelter, joinery, x, 0.36, -0.55, 0.25, 0.72, 0.65);
  // A weathered enamel timetable board contains no lettering.
  box(shelter, '#4c5549', -2.48, 2.04, -1.17, 1.26, 1.73, 0.13);
  box(shelter, '#c1b693', -2.48, 2.02, -1.08, 1.05, 1.51, 0.05);
  for (let i = 0; i < 6; i++) box(shelter, '#978d70', -2.48, 2.5 - i * 0.16, -1.04, 0.74, 0.025, 0.012);
  for (let i = 0; i < 30; i++) {
    const x = -14 + i * 0.96;
    boards(parent, i % 3 ? '#5b5445' : '#776851', x, 0.085, -3.07, 0.31, 0.16, 1.76);
  }
  for (const z of [-3.69, -2.47]) {
    box(parent, '#75543c', 0, 0.21, z, 28, 0.23, 0.13);
    box(parent, '#878a7c', 0, 0.33, z, 28, 0.055, 0.17);
  }
}

function archStones(parent, x, spring, z, inside, outside, depth, count, palette) {
  // Individually cut voussoirs. The outer edges meet along radial joints.
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count + 0.009,
      b = ((i + 1) * Math.PI) / count - 0.009;
    const point = (r, t) => [Math.cos(t) * r, Math.sin(t) * r];
    faced(
      parent,
      [point(inside, a), point(outside, a), point(outside, b), point(inside, b)],
      depth,
      x,
      spring,
      z,
      palette[(i * 7 + 3) % palette.length],
    );
  }
}

function viaduct(parent) {
  const depth = 4.66,
    r = 3.72;
  for (let bay = 0; bay < 3; bay++) {
    const x = (bay - 1) * 9.25;
    const shape = new T.Shape();
    shape.moveTo(-4.626, -8.2);
    shape.lineTo(-r, -8.2);
    shape.lineTo(-r, -5.47);
    shape.absarc(0, -5.47, r, Math.PI, 0, true);
    shape.lineTo(r, -8.2);
    shape.lineTo(4.626, -8.2);
    shape.lineTo(4.626, -0.41);
    shape.lineTo(-4.626, -0.41);
    shape.closePath();
    mesh(
      parent,
      new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 28 }),
      '#687064',
      x,
      0,
      -2.33,
    );
    for (const z of [-2.52, 2.34]) archStones(parent, x, -5.47, z, r, r + 0.49, 0.19, 19, stone);
    for (let j = 0; j < 6; j++) {
      const w = 1.28 + variation(j) * 0.31;
      box(parent, stone[(j + bay) % 5], x - 3.87 + j * 1.52, -0.65, 2.37, w, 0.43, 0.12);
    }
  }
  box(parent, stone[3], 0, -0.28, 0, 28.04, 0.23, 5.12);
  box(parent, '#867e66', 0, -0.12, 0, 28.03, 0.13, 4.79);
  for (const z of [-2.38, 2.38]) {
    for (let j = 0; j < 24; j++) {
      const x = -13.45 + j * 1.17;
      box(parent, stone[j % 5], x, 0.18, z, 1.12, 0.63, 0.3);
      box(parent, j % 4 ? stone[(j + 3) % 5] : moss, x, 0.53, z, 1.16, 0.11, 0.41);
    }
  }
  for (let i = 0; i < 24; i++) {
    const x = -13.6 + variation(i + 44) * 27.1;
    const y = -0.52 - variation(i + 1) * 0.36;
    ink(
      parent,
      i % 2 ? moss : '#818a54',
      [
        [x, y, 2.49],
        [x - 0.03, y - 0.13, 2.52],
        [x + 0.02, y - 0.4 * variation(i + 71) - 0.18, 2.48],
      ],
      0.048,
    );
  }
}

function observatory(parent) {
  const ruin = group(parent, -2.0, 0, -8.7);
  rod(ruin, stone[1], [0, -0.37, 0], [0, 0.18, 0], 5.67, 5.98);
  for (let j = 0; j < 3; j++)
    box(ruin, stone[(j + 1) % 5], 0, 0.16 - j * 0.065, 5.45 + j * 0.35, 4.34 + j * 0.19, 0.28, 0.61);
  const r = 5.08;
  // The circular masonry courses stop on either side of the broken entrance.
  for (let row = 0; row < 7; row++) {
    for (let i = 0; i < 26; i++) {
      const a = ((i + 0.5 * (row % 2)) * TAU) / 26;
      if (Math.cos(a) > 0.82 || (row > 4 && i > 7 && i < 11)) continue;
      const block = box(
        ruin,
        bricks[(i + row * 3) % 5],
        Math.sin(a) * r,
        0.33 + row * 0.63,
        Math.cos(a) * r,
        1.24,
        0.6,
        0.66,
      );
      block.rotation.y = a;
    }
  }
  const z = 4.73;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++)
      box(ruin, bricks[(i * 2) % 5], side * 2.39, 0.36 + i * 0.7, z, 0.7, 0.65, 0.9);
  }
  archStones(ruin, 0, 3.39, z - 0.45, 2.04, 2.74, 0.89, 17, bricks);
  // A weathered, partly open copper dome reveals the iron rib structure.
  const cap = mesh(
    ruin,
    new T.SphereGeometry(4.95, 40, 16, Math.PI * 0.05, Math.PI * 1.49, 0, Math.PI * 0.49),
    '#5c7e73',
    0,
    4.5,
    0,
  );
  cap.scale.y = 0.69;
  for (let i = 0; i < 12; i++) {
    const az = (i * TAU) / 12;
    const points = [];
    for (let j = 0; j <= 12; j++) {
      const a = (j * Math.PI) / 24;
      points.push([
        4.99 * Math.sin(a) * Math.sin(az),
        4.5 + 3.45 * Math.cos(a),
        4.99 * Math.sin(a) * Math.cos(az),
      ]);
    }
    ink(ruin, i % 3 ? '#57685c' : '#9a865b', points, 0.069);
  }
  for (let j = 0; j < 9; j++) {
    const x = -2.55 + variation(j + 40) * 0.72;
    const y = 3.75 + variation(j + 14) * 1.27;
    ink(
      ruin,
      j % 2 ? moss : '#718353',
      [
        [x, y, 5.2],
        [x + 0.07, y - 0.33, 5.24],
        [x - 0.07, y - 0.7, 5.22],
        [x + 0.05, y - 0.93, 5.18],
      ],
      0.035,
    );
  }
  const collar = mesh(ruin, new T.TorusGeometry(4.97, 0.15, 8, 64), '#6a7565', 0, 4.51, 0);
  collar.rotation.x = Math.PI / 2;
  rod(ruin, bronze, [0, 7.82, 0], [0, 8.25, 0], 0.24, 0.36);
  rod(ruin, bronze, [0, 8.17, 0], [0, 9.25, 0], 0.045, 0.095);
  mesh(ruin, new T.SphereGeometry(0.16, 12, 8), '#bb9b62', 0, 9.27, 0);
}

function outcrop(parent, x, y, z, rx, ry, rz, seed, rockColor = '#87918a') {
  // A single, continuous weathered rock face with isolated mossy ledges.
  const segments = 24,
    levels = 13,
    positions = [],
    colors = [],
    uv = [],
    indices = [];
  for (let j = 0; j <= levels; j++) {
    const t = j / levels;
    const spread = 0.55 + 0.46 * Math.sin(Math.PI * (0.12 + 0.85 * t));
    for (let i = 0; i < segments; i++) {
      const a = (i * TAU) / segments;
      // Smooth continuous fractures and strata across the outcrop.
      const fault =
        0.09 * Math.sin(a * 3.0 + t * 4 + seed) +
        0.06 * Math.cos(a * 6.0 + t * 2 + seed) +
        0.035 * Math.sin(a * 10 + t * 7);
      const band = 0.045 * Math.sin(t * 16 + Math.cos(a * 2 + seed));
      const width = spread + fault + band;
      positions.push(
        Math.cos(a) * rx * width,
        t * ry + 0.15 * Math.sin(a * 3 + seed + t),
        Math.sin(a) * rz * width,
      );
      const damper = Math.sin(a * 3.0 + t * 5.0 + seed);
      const grassy = t > 0.72 + damper * 0.2 || (t + band > 0.48 && t < 0.54 && damper > 0.01);
      const col = new T.Color(grassy ? '#7d8a53' : rockColor);
      col.multiplyScalar(0.83 + 0.13 * damper + 0.12 * Math.sin(t * 14 + seed + a * 0.35));
      colors.push(col.r, col.g, col.b);
      uv.push((i / segments) * 3, t * 3);
      if (j === levels) continue;
      const k = j * segments + i,
        nx = j * segments + ((i + 1) % segments);
      indices.push(k, k + segments, nx, nx, k + segments, nx + segments);
    }
  }
  const cap = positions.length / 3;
  positions.push(0, ry + 0.36, 0);
  uv.push(0.5, 0.5);
  const crown = new T.Color(moss);
  colors.push(crown.r, crown.g, crown.b);
  for (let i = 0; i < segments; i++)
    indices.push(cap, levels * segments + ((i + 1) % segments), levels * segments + i);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mat = surface('#ffffff', 'rock');
  mat.vertexColors = true;
  mesh(parent, geometry, mat, x, y, z);
}

function flowTexture() {
  const width = 192,
    height = 256,
    data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const s = x / width,
        v = (y / height) * TAU;
      const bank = Math.pow(Math.abs(2 * s - 1), 3);
      const drift = x + 2.8 * Math.sin(v + x * 0.027) + 1.8 * Math.sin(2 * v - x * 0.063);
      const channel = 0.5 + 0.5 * Math.cos(drift * 0.19 + 0.9 * Math.cos(v));
      const strands = 0.5 + 0.5 * Math.sin(drift * 0.78 + Math.cos(2 * v + x * 0.14) * 1.3);
      const fleck = 0.5 + 0.5 * Math.cos(v * 7 + x * 0.17);
      const shine = Math.min(
        1,
        0.2 + 0.36 * channel + 0.24 * strands * (0.3 + fleck * 0.7) + 0.22 * bank,
      );
      const k = (y * width + x) * 4;
      data[k] = 89 + shine * 150;
      data[k + 1] = 153 + shine * 95;
      data[k + 2] = 158 + shine * 83;
      data[k + 3] = 255;
    }
  const tex = new T.DataTexture(data, width, height, T.RGBAFormat);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapT = T.RepeatWrapping;
  tex.magFilter = tex.minFilter = T.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function falls(parent) {
  const river = group(parent, 1.8, 0, -6.8);
  for (let side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const w = 2.0 + variation(i + 12) * 1.5;
      const h = 8.1 + variation(i + 71) * 4.7;
      outcrop(
        river,
        side * (3.9 + i * 2.77),
        -0.83,
        -0.9 - variation(i) * 2.7,
        w,
        h,
        2.6,
        i + 20 * side,
      );
      outcrop(
        river,
        side * (3.6 + i * 2.64),
        -0.61,
        1.6 + variation(i + 21),
        1.57,
        1.7 + variation(i + 27) * 3,
        1.71,
        i + 41 * side,
      );
    }
  }
  outcrop(river, 0.1, -1.1, -3.44, 5.63, 11.7, 2.57, 120);
  // Ferns and long runners cling to the damp joints beside the curtain.
  for (let i = 0; i < 25; i++) {
    const side = i % 2 ? -1 : 1;
    const x = side * (3.1 + variation(i + 11) * 5.1);
    const z = 0.5 + variation(i + 33) * 1.2,
      y = 2.1 + variation(i + 89) * 4.55;
    const length = 0.72 + variation(i + 17) * 2.0;
    const run = [
      [x, y, z],
      [x + side * 0.18, y - 0.25 * length, z + 0.1],
      [x - side * 0.11, y - 0.65 * length, z + 0.08],
      [x + 0.14, y - length, z + 0.14],
    ];
    ink(river, i % 3 ? moss : '#53694e', run, 0.034);
    for (let j = 0; j < 6; j++) {
      const t = (j + 0.3) / 6,
        sign = j % 2 ? -1 : 1;
      const leaf = mesh(
        river,
        new T.SphereGeometry(1, 6, 4),
        j % 3 ? '#78935f' : '#9ba564',
        x + sign * (0.14 + 0.07 * t),
        y - t * length,
        z + 0.11,
      );
      leaf.scale.set(0.072, 0.18 - 0.04 * t, 0.047);
      leaf.rotation.z = sign * 0.64;
    }
  }
  const strips = 27,
    slices = 25,
    vertices = [],
    uv = [],
    indices = [];
  for (let j = 0; j <= slices; j++)
    for (let i = 0; i <= strips; i++) {
      const v = j / slices,
        u = i / strips;
      const spread = 1.9 + v * 0.78;
      const edge = variation(i + 24) * 0.16;
      vertices.push(
        (u - 0.5) * spread * 2,
        10.18 - v * 10.22 + edge * (1 - v),
        -0.52 + 2.78 * v + Math.sin(u * 29 + v * 4) * 0.065,
      );
      uv.push(u, 1 - v);
      if (j < slices && i < strips) {
        const k = j * (strips + 1) + i;
        indices.push(k, k + strips + 1, k + 1, k + 1, k + strips + 1, k + strips + 2);
      }
    }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const tex = flowTexture();
  const material = new T.MeshLambertMaterial({
    map: tex,
    color: 0xffffff,
    emissive: 0x425c5b,
    side: T.DoubleSide,
  });
  const cascade = mesh(river, geo, material);
  cascade.userData.animated = true;
  for (let i = 0; i < 23; i++) {
    const blob = mesh(
      river,
      new T.SphereGeometry(1, 10, 6),
      i % 3 ? '#b5d6c7' : '#d6e2cc',
      (variation(i + 31) - 0.5) * 5.64,
      0.1,
      2.17 + variation(i + 65) * 0.94,
    );
    blob.scale.set(0.3 + variation(i) * 0.47, 0.08 + variation(i + 37) * 0.12, 0.28);
  }
  parent.userData.update = (seconds) => {
    tex.offset.y = (seconds * 0.76) % 1;
  };
}

function riverReeds(parent, beds, seed, surfaceY = null, scale = 1) {
  const blades = [],
    shades = [];
  const colours = ['#536a43', '#798a4b', '#a19a54', '#899257'].map((c) => new T.Color(c));
  for (const [bx, by, bz, count] of beds) {
    for (let i = 0; i < count; i++) {
      seed++;
      const x = bx + (variation(seed * 2) - 0.5) * 2.2,
        z = bz + (variation(seed * 2 + 417) - 0.5) * 0.91;
      const h = (0.46 + variation(seed + 27) * 1.04) * scale;
      const ground = surfaceY ? surfaceY(x, z) : by;
      for (let j = 0; j < 4; j++) {
        const n = seed * 4 + j,
          angle = n * 2.4,
          dx = Math.sin(angle),
          dz = Math.cos(angle);
        const reach = (0.22 + variation(n + 81) * 0.34) * h,
          width = 0.035 + variation(n) * 0.035;
        const base = [x, ground, z],
          mid = [x + dx * reach * 0.26, ground + h * 0.69, z + dz * reach * 0.26];
        const left = [mid[0] - dz * width, mid[1], mid[2] + dx * width];
        const right = [mid[0] + dz * width, mid[1], mid[2] - dx * width];
        const tip = [x + dx * reach, ground + h * 0.91, z + dz * reach];
        blades.push(...base, ...left, ...right, ...tip, ...right, ...left);
        const colour = colours[n % 4];
        for (let k = 0; k < 6; k++) shades.push(colour.r, colour.g, colour.b);
      }
      if (i % 6 === 0) {
        const tx = x + 0.12;
        rod(parent, '#778254', [x, ground, z], [tx, ground + h * 1.4, z + 0.04], 0.016, 0.023);
        const head = mesh(
          parent,
          new T.SphereGeometry(1, 7, 6),
          '#826848',
          tx,
          ground + h * 1.44,
          z + 0.04,
        );
        head.scale.set(0.055 * scale, 0.18 * scale, 0.055 * scale);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(blades, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(shades, 3));
  geometry.computeVertexNormals();
  const mat = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  mesh(parent, geometry, mat);
}

function causeway(parent) {
  const n = 55;
  const center = (x) => -0.22 + 0.57 * Math.sin(x * 0.14);
  // Slightly uneven split planks follow the shape of the old lane.
  for (let i = 0; i < n; i++) {
    const x = -11.15 + i * 0.413;
    const width = 3.0 + variation(i) * 0.28;
    const p = boards(
      parent,
      ['#796d57', '#908064', '#83745a', '#9c8b6c'][i % 4],
      x,
      -0.04 + variation(i + 44) * 0.014,
      center(x),
      0.39,
      0.16,
      width,
    );
    p.rotation.y = 0.055 * Math.cos(x * 0.14);
    if (i % 7 === 0) {
      for (const side of [-1, 1]) {
        boards(parent, '#655941', x, -0.38, center(x) + side * 1.17, 0.26, 0.82, 0.28);
      }
    }
  }
  for (const x of [-10.1, -6.6, -2.9, 3.4, 6.9, 10.3]) {
    const z = center(x) - 1.48;
    rod(parent, timber, [x + 0.035, -0.3, z], [x, 0.73, z], 0.105, 0.145);
    const cap = mesh(parent, new T.CylinderGeometry(0.115, 0.115, 0.05, 10), '#a69870', x, 0.74, z);
    cap.rotation.z = 0.029;
  }
  for (const [a, b] of [
    [-10.1, -6.6],
    [-6.6, -2.9],
    [3.4, 6.9],
    [6.9, 10.3],
  ]) {
    ink(
      parent,
      '#a28d63',
      [
        [a, 0.6, center(a) - 1.48],
        [(a + b) / 2, 0.37, center((a + b) / 2) - 1.48],
        [b, 0.62, center(b) - 1.48],
      ],
      0.039,
    );
  }
  const beds = [];
  for (let i = 0; i < 15; i++) {
    const x = -11.4 + i * 1.64;
    const side = i % 3 ? -1 : 1;
    beds.push([x, -0.08, center(x) + side * (2.31 + variation(i + 55) * 0.83), 8 + (i % 5)]);
  }
  riverReeds(parent, beds, 609);
}

// The bedding planes dip toward the stream. The front lip of each shelf
// projects past the next slab and casts a dark band on the cleft below it.
let paintedShale;
function sheerRockMaterial() {
  if (paintedShale) return paintedShale;
  paintedShale = new T.MeshLambertMaterial({ color: '#f4f2ef', vertexColors: true, side: T.DoubleSide });
  if (typeof document !== 'undefined') {
    const map = new T.TextureLoader().load(new URL('art/slate.webp', import.meta.url).href);
    map.colorSpace = T.SRGBColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = 4;
    paintedShale.map = map;
  }
  return paintedShale;
}

function shale(
  parent,
  x,
  z,
  width,
  depth,
  top,
  slope,
  seed,
  { bottom = -2.7, ledge = false, near = false } = {},
) {
  const positions = [],
    colours = [],
    uv = [];
  const shift = variation(seed + 41) * 0.79 - 0.2;
  // Follow the same joints from bedrock up to the lip, then fold them
  // sharply. A smooth radial mound loses both the fissures and the skyline.
  const perimeter = [
    [-0.63, 0.13],
    [-0.55, 0.6],
    [-0.24, 0.69],
    [0.08, 0.54],
    [0.43, 0.57],
    [0.62, 0.23],
    [0.54, -0.4],
    [-0.44, -0.52],
  ];
  function ring(t, lip, scale) {
    return perimeter.map(([u, v], i) => {
      const fracture = variation(seed + i * 4) - 0.5;
      const shelf = top + slope * u + width * 0.2 * fracture + v * 0.41;
      const joint = t > 0 && t < 1 ? 0.095 * (u * 1.4 + Math.sin(i * 0.83 + seed) * 0.37) : 0;
      return [
        x + u * width * scale + t * (0.24 + shift + fracture * 0.39) + v * 0.1,
        bottom + (shelf - bottom) * (t + joint),
        z + v * depth * scale + lip * depth + fracture * 0.32 + t * shift * 0.48,
      ];
    });
  }
  const foot = ring(0, -0.065, 0.91),
    face = ring(0.52, 0.018, 1.0);
  const horizon = 0.56 + variation(seed + 91) * 0.28;
  const seam = ring(horizon, -0.021, 0.98),
    rim = ring(horizon + 0.046, 0.049, 1.0),
    crown = ring(1, 0.018, 0.91);
  function facet(a, b, c, base, variationValue) {
    const color = new T.Color(base).multiplyScalar(variationValue);
    for (const p of [a, b, c]) {
      positions.push(...p);
      colours.push(color.r, color.g, color.b);
      uv.push(
        (p[0] * 0.92 + p[2] * 0.35) / 5.3 + seed * 0.073,
        (p[1] * 0.96 + p[2] * 0.16) / 5.15 + seed * 0.094,
      );
    }
  }
  const rows = [foot, face, seam, rim, crown];
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < perimeter.length; i++) {
      const k = (i + 1) % perimeter.length;
      const a = rows[j][i],
        b = rows[j][k],
        c = rows[j + 1][k],
        d = rows[j + 1][i];
      const base = j === 2 ? '#c1c8c4' : near ? '#c4d0cf' : '#cbd3da';
      const pigment = 0.9 + variation(i + seed) * 0.16;
      facet(a, b, c, base, pigment);
      facet(a, c, d, base, pigment - 0.018);
    }
  const center = [x + shift * 0.4, top + 0.13, z - 0.18];
  for (let i = 0; i < perimeter.length; i++) {
    const k = (i + 1) % perimeter.length;
    facet(crown[i], crown[k], center, ledge ? '#a2ad8a' : '#d0cabb', 0.92 + variation(i + seed) * 0.13);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colours, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  mesh(parent, geometry, sheerRockMaterial());
  if (ledge) {
    // Keep the grass inside the upper face, even on its sloping edge.
    const beds = [[x + shift * 0.42, top + 0.055, z - 0.17, Math.max(5, Math.round(width * 2))]];
    riverReeds(
      parent,
      beds,
      seed,
      (px, pz) => top + 0.07 + ((px - x - shift * 0.42) * slope) / width + (pz - z) * 0.08,
      0.33,
    );
  }
}

// Dwarf pines grow horizontally from the fault. Needle fans taper to
// separate points and leave open windows between the little branches.
function cliffPine(parent, x, y, z, size, seed, direction) {
  const tree = group(parent, x, y, z);
  tree.scale.set(size * direction, size, size);
  const spine = [
    [0, 0, 0],
    [-0.2, 0.38, 0.08],
    [-0.22, 0.67, 0.07],
    [-0.04, 0.99, 0.12],
    [0.21, 1.18, 0.13],
  ];
  for (let j = 1; j < spine.length; j++) {
    rod(tree, '#5d5140', spine[j - 1], spine[j], 0.032 + 0.011 * (4 - j), 0.045 + 0.014 * (4 - j));
  }
  const leaves = [],
    colours = [];
  const canopy = ['#435e4c', '#4d7356', '#6c8657', '#899460', '#a29d66'].map((c) => new T.Color(c));
  for (let b = 0; b < 8; b++) {
    const t = b / 7,
      sign = b % 2 ? -1 : 1;
    const by = 0.42 + t * 0.64,
      width = 0.85 - 0.45 * t,
      az = variation(seed + b) * 2.8;
    const end = [-0.11 + sign * width, by + 0.15 + 0.22 * t, 0.12 + Math.cos(az) * 0.23];
    ink(
      tree,
      '#645943',
      [[-0.16, by, 0.08], [-0.16 + sign * width * 0.49, by - 0.045, 0.1], end],
      0.036 - 0.014 * t,
    );
    for (let i = 0; i < 82; i++) {
      const k = seed * 42 + b * 88 + i;
      const u = variation(k),
        angle = variation(k + 607) * TAU;
      const radius = Math.sqrt(u);
      const cx = end[0] + Math.cos(angle) * width * 0.53 * radius,
        cz = end[2] + Math.sin(angle) * width * 0.37 * radius;
      const cy = end[1] + 0.16 * (1 - radius) + 0.085 * variation(k + 33);
      const base = [cx, cy, cz],
        tip = [
          cx + 0.12 * Math.cos(angle),
          cy + 0.06 + 0.085 * variation(k + 71),
          cz + 0.11 * Math.sin(angle),
        ];
      const w = 0.034 + 0.032 * variation(k + 46);
      leaves.push(...base, cx - w * Math.sin(angle), cy + 0.041, cz + w * Math.cos(angle), ...tip);
      const pigment = canopy[Math.min(4, Math.floor(variation(k + 1) * 3 + (1 - radius) * 1.6))];
      for (let v = 0; v < 3; v++) colours.push(pigment.r, pigment.g, pigment.b);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(leaves, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  mesh(tree, geo, new T.MeshLambertMaterial({ side: T.DoubleSide, vertexColors: true }));
}

function ravineFaces(parent) {
  // Successive planes retreat into the pass. The clearest view into the
  // distant valley is just left of centre, where the two profiles diverge.
  const slabs = [
    [-13.9, -17, 6.4, 4.4, 7.6, -2.0],
    [-10.3, -18.7, 4.1, 3.0, 5.9, -1.25],
    [-8.2, -22.4, 3.8, 3.4, 3.6, -1.4],
    [-6.8, -27.6, 3.5, 3.1, 1.96, -1.4],
    [-13.8, -11.8, 5.1, 3.3, 5.1, -1.65],
    [-11.4, -13.2, 2.35, 2.4, 4.65, -1.3],
    [-10.2, -13.65, 1.9, 2.55, 2.95, -0.7],
    [-8.9, -15.5, 1.85, 2.55, 2.41, -0.9],
    [-7.7, -16.65, 2.3, 1.7, 1.26, -0.7],
    [-5.8, -20.3, 2.75, 1.75, 0.12, -0.7],
    [1.05, -25.5, 2.48, 2.2, 0.35, 1.1],
    [2.93, -23.1, 2.41, 2.6, 1.8, 1.2],
    [5.4, -21.4, 4.25, 3.1, 3.36, 1.23],
    [8.44, -20.0, 4.5, 3.5, 5.92, 2.0],
    [11.75, -18.9, 5.3, 4.2, 8.42, 1.93],
    [15.62, -16, 5.63, 3.1, 9.13, 0.8],
    [13.2, -12.74, 4.4, 3.6, 7.49, 1.14],
    [10.47, -13.2, 3.55, 2.1, 6.04, 1.53],
    [8.73, -14.15, 2.4, 2.55, 5.6, 1.17],
    [6.91, -15.98, 2.66, 2.91, 4.3, 0.66],
    [4.62, -16.4, 2.3, 2.4, 3.65, 1.06],
    [3.53, -15.4, 2.05, 1.4, 2.46, 0.96],
    [6.5, -12.81, 2.4, 2.1, 2.61, 1.18],
    [8.76, -11.6, 2.62, 2.2, 2.14, 1.46],
    [10.37, -10.51, 2.34, 1.7, 1.73, 0.56],
    [13.14, -9.9, 3.33, 2.6, 3.22, 0.87],
    [5.25, -12.67, 1.53, 1.3, 1.23, 0.46],
    [4.04, -12.1, 1.5, 1.52, 0.59, -0.44],
    [2.7, -11.42, 1.73, 1.46, 0.11, -0.43],
    [-10.22, -9.4, 2.8, 2.1, 0.42, 0.51],
    [-13.3, -8.4, 2.0, 2.0, 0.59, -0.6],
    [11.62, -8.41, 3.75, 1.61, 0.61, 0.81],
  ];
  for (const [i, slab] of slabs.entries()) {
    shale(parent, ...slab, 71 + i, {
      ledge: [1, 4, 7, 10, 14, 15, 18, 20, 25, 30].includes(i),
      near: slab[1] > -12,
    });
  }
  for (const [x, y, z, size, seed, dir] of [
    [-10.2, 4.0, -18.95, 1.61, 33, -1],
    [-8.2, 3.54, -22.43, 1.12, 17, -1],
    [-6.79, 1.93, -27.71, 0.93, 51, 1],
    [-13.57, 5.07, -11.94, 1.56, 83, 1],
    [3.03, 1.77, -23.25, 0.91, 42, -1],
    [5.55, 3.29, -21.57, 1.14, 14, -1],
    [6.94, 4.23, -16.1, 0.81, 75, 1],
    [10.57, 6.0, -13.27, 1.41, 85, -1],
  ])
    cliffPine(parent, x, y, z, size, seed, dir);
}

function fallingSheet(parent, knots, clock, seed) {
  const points = [],
    uv = [],
    index = [];
  const curve = new T.CatmullRomCurve3(knots.map(([x, y, z]) => new T.Vector3(x, y, z)));
  const steps = 58,
    threads = 17;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPoint(t),
      k = t * (knots.length - 1),
      row = Math.floor(k);
    const width = T.MathUtils.lerp(
      knots[row][3],
      knots[Math.min(row + 1, knots.length - 1)][3],
      k - row,
    );
    for (let j = 0; j <= threads; j++) {
      const across = (2 * j) / threads - 1;
      const lip = Math.sin(Math.PI * t);
      const wander =
        0.041 * Math.sin(22 * t + seed + across * 4) + 0.025 * Math.sin(37 * t - across * 12);
      points.push(
        p.x + across * width + wander * lip,
        p.y + 0.018 * Math.cos(across * 9 + t * 24),
        p.z + 0.1 * (1 - across * across) + 0.048 * Math.sin(across * 12 + t * 4),
      );
      uv.push(j / threads, t);
      if (i === steps || j === threads) continue;
      const a = i * (threads + 1) + j,
        b = a + threads + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  const paint = new T.ShaderMaterial({
    uniforms: { time: clock, seed: { value: seed } },
    vertexShader: `varying vec2 riverUV;
      void main(){riverUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 riverUV;
      uniform float time,seed;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
      float noise(vec2 p){
        vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(cell),hash(cell+vec2(1,0)),f.x),
          mix(hash(cell+vec2(0,1)),hash(cell+vec2(1)),f.x),f.y);
      }
      void main(){
        float y=riverUV.y-time*.26;
        float across=riverUV.x + .14*noise(vec2(riverUV.x*3.,y*3.+seed));
        float curl=noise(vec2(across*6.+seed,y*8.));
        float stream=noise(vec2(across*12.+curl*1.7,y*3.1+seed));
        float broken=noise(vec2(across*24.+curl*3.,y*12.));
        float crest=.58*stream+.33*curl+.24*broken;
        vec3 water=mix(vec3(.095,.245,.326),vec3(.31,.53,.57),smoothstep(.17,.62,crest));
        water=mix(water,vec3(.62,.75,.73),smoothstep(.47,.62,crest));
        water=mix(water,vec3(.86,.89,.81),smoothstep(.62,.72,crest+broken*.055));
        float rim=min(riverUV.x,1.-riverUV.x);
        if(rim<.12*noise(vec2(riverUV.x*17.+seed,y*14.)) && broken<.49) discard;
        gl_FragColor=vec4(water,1.);
        #include <colorspace_fragment>
      }`,
    side: T.DoubleSide,
  });
  mesh(parent, geometry, paint);
}

function downstream(parent, clock) {
  // Two outlets from a gap in the right bank. Their thin edges end at
  // different lengths at each lip. The lower fall divides around a tooth.
  const upper = [
    [5.45, 3.6, -15.62, 0.36],
    [5.29, 3.58, -15.13, 0.42],
    [5.14, 3.36, -14.9, 0.46],
    [4.97, 2.65, -14.73, 0.45],
    [4.81, 1.89, -14.5, 0.49],
    [4.7, 1.54, -14.19, 0.57],
    [4.42, 1.48, -13.75, 0.68],
    [4.24, 1.36, -13.37, 0.7],
    [4.03, 1.02, -13.07, 0.65],
    [3.72, 0.33, -12.81, 0.67],
    [3.56, -0.21, -12.49, 0.7],
    [3.33, -0.5, -12.09, 0.83],
    [2.89, -0.56, -11.47, 0.94],
  ];
  for (let i = 5; i < upper.length; i++) upper[i][2] += (i - 4) * 0.43;
  fallingSheet(parent, upper, clock, 17);
  const side = [
    [5.97, 3.58, -15.32, 0.16],
    [5.84, 3.37, -14.81, 0.17],
    [5.71, 2.61, -14.53, 0.15],
    [5.51, 1.79, -14.11, 0.19],
    [5.33, 1.51, -13.84, 0.27],
    [4.75, 1.43, -13.46, 0.31],
  ];
  fallingSheet(parent, side, clock, 93);
  const tangles = [
    [4.66, 1.49, -14.12, 0.56],
    [3.2, -0.45, -10.17, 0.75],
  ];
  for (const [x, y, z, w] of tangles)
    for (let i = 0; i < 14; i++) {
      const crest = mesh(
        parent,
        new T.SphereGeometry(1, 9, 6),
        i % 2 ? '#bdd5ce' : '#d2dfd5',
        x + (variation(i + 22) - 0.5) * w * 2,
        y + variation(i + 38) * 0.05,
        z + (variation(i + 88) - 0.29) * 0.44,
      );
      crest.scale.set(0.07 + variation(i + 53) * 0.17, 0.026 + variation(i + 19) * 0.048, 0.16);
    }
}

function streamRibbon(parent, centers, color, texture) {
  const points = [],
    uv = [],
    index = [];
  centers.forEach(([x, y, z, w], i) => {
    const previous = centers[Math.max(0, i - 1)],
      next = centers[Math.min(centers.length - 1, i + 1)];
    const dx = next[0] - previous[0],
      dz = next[2] - previous[2],
      len = Math.hypot(dx, dz) || 1;
    for (let j = 0; j <= 8; j++) {
      const offset = (j / 4 - 1) * w;
      points.push(
        x - (dz / len) * offset,
        y + Math.sin(j * 0.91 + i * 0.72) * 0.025,
        z + (dx / len) * offset,
      );
      uv.push(j / 8, 1 - i / (centers.length - 1));
      if (i < centers.length - 1 && j < 8) {
        const k = i * 9 + j;
        index.push(k, k + 9, k + 1, k + 1, k + 9, k + 10);
      }
    }
  });
  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geom.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geom.setIndex(index);
  geom.computeVertexNormals();
  mesh(
    parent,
    geom,
    new T.MeshLambertMaterial({ map: texture, color, side: T.DoubleSide, emissive: '#273c40' }),
  );
}

function gorge(parent) {
  ravineFaces(parent);
  const clock = { value: 0 };
  const blue = flowTexture();
  downstream(parent, clock);
  streamRibbon(
    parent,
    [
      [-17, -0.84, -14.6, 0.72],
      [-13.5, -0.78, -10.86, 1.29],
      [-10, -0.71, -8.61, 1.56],
      [-6, -0.7, -7.35, 1.71],
      [-2, -0.62, -8.08, 2.06],
      [2.5, -0.7, -8.53, 1.85],
      [7.3, -0.65, -8.08, 1.43],
      [11.3, -0.7, -9.45, 1.37],
      [16.4, -0.78, -13.63, 0.72],
    ],
    '#7cb8c7',
    blue,
  );
  // The gap is an overlook. The rope at each end stops at an upright.
  for (const section of [
    [-12.5, -9.4, -6.6, -3.8],
    [1.2, 4.1, 7.25, 10.2],
  ]) {
    for (const [i, x] of section.entries()) {
      const z = -2.85 + 0.3 * Math.sin(x * 0.28),
        y = 0.86 + variation(i + 19) * 0.13;
      rod(parent, timber, [x + 0.05, -0.25, z], [x, y, z], 0.105, 0.165);
      if (i === 0) continue;
      const prev = section[i - 1],
        oldZ = -2.85 + 0.3 * Math.sin(prev * 0.28);
      rod(parent, '#877150', [prev, 0.72, oldZ], [x, 0.72, z], 0.078, 0.092);
      ink(
        parent,
        '#ac976e',
        [
          [prev, 0.45, oldZ],
          [(prev + x) / 2, 0.29, (oldZ + z) / 2],
          [x, 0.48, z],
        ],
        0.026,
      );
    }
  }
  riverReeds(
    parent,
    [
      [-5.9, -0.02, -4.36, 12],
      [4.18, -0.02, -4.1, 8],
      [8, -0.02, -4.45, 15],
      [-10.1, -0.02, -4.33, 10],
    ],
    431,
  );
  parent.userData.update = (seconds) => {
    clock.value = seconds;
    blue.offset.y = (seconds * 0.062) % 1;
  };
}

const build = { house: gassho, hearth, causeway, marsh: halt, viaduct, observatory, gorge, falls };
export function landmark(room) {
  const root = new T.Group();
  root.name = room + ' landmark';
  build[room]?.(root);
  return root;
}
