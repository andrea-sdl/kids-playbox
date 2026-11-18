// Each moving assembly is one mesh. Its plates, seams, bolts and plants share
// one cel material; the drawn highlights stay attached when a joint turns.
import {
  BackSide,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  mergeGeometries,
} from '../../vendor/three/three.min.js';

const TAU = Math.PI * 2;
const shell = '#889873',
  cream = '#dfc799',
  shade = '#4d6359';
const seam = '#394744',
  brass = '#bd935b',
  copper = '#a46d49';
const moss = '#778849',
  leaf = '#a9ad5a',
  wood = '#685443';

const paint = new ShaderMaterial({
  vertexColors: true,
  side: DoubleSide,
  vertexShader: `
    varying vec3 pigment, surface, local;
    void main() {
      pigment = color;
      surface = normalMatrix * normal;
      local = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
    }`,
  fragmentShader: `
    varying vec3 pigment, surface, local;
    float hash(vec3 p) {
      p = fract(p * vec3(.1031,.1030,.0973));
      p += dot(p,p.yzx + 33.33);
      return fract((p.x + p.y)*p.z);
    }
    float noise(vec3 p) {
      vec3 cell = floor(p), f = fract(p);
      f = f*f*(3.-2.*f);
      float a = mix(hash(cell),hash(cell+vec3(1,0,0)),f.x);
      float b = mix(hash(cell+vec3(0,1,0)),hash(cell+vec3(1,1,0)),f.x);
      float c = mix(hash(cell+vec3(0,0,1)),hash(cell+vec3(1,0,1)),f.x);
      float d = mix(hash(cell+vec3(0,1,1)),hash(cell+vec3(1,1,1)),f.x);
      return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
    }
    void main() {
      vec3 n = normalize(surface);
      float l = dot(n,normalize(vec3(-.48,.75,.50)));
      float edge = smoothstep(.015,.145,abs(n.z));
      float lamp = step(.83,pigment.r)*step(.18,pigment.g)*step(pigment.b,.15);
      vec3 shadow = mix(vec3(.55,.66,.72),vec3(.82,.84,.79),smoothstep(-.45,-.40,l));
      vec3 light = mix(shadow,vec3(1.06,1.02,.91),smoothstep(.13,.16,l));
      vec3 base = mix(pigment*light,pigment,lamp);
      // Small islands of oxidised paint, dense on exposed enamel and absent
      // from eyes and joints. Object-space marks follow the moving plate.
      float enamel = step(.24,pigment.g) * step(.13,pigment.b) * step(.19,pigment.r);
      float wear = .67*noise(local*15.) + .33*noise(local*48.);
      base = mix(base,vec3(.26,.139,.064)*light,enamel*smoothstep(.734,.772,wear));
      float fleck = hash(floor(local*103.));
      base *= .983 + .034*fleck;
      gl_FragColor = vec4(mix(base * vec3(.34,.39,.39),base,edge),1.);
      #include <colorspace_fragment>
    }`,
});

// Expand back faces by a fraction of a plate's width, like a second ink cel.
const ink = new ShaderMaterial({
  side: BackSide,
  vertexShader: `
    attribute float inkWidth;
    void main(){
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*inkWidth,1.);
    }`,
  fragmentShader: `
    void main(){
      gl_FragColor=vec4(.032,.043,.033,1.);
      #include <colorspace_fragment>
    }`,
});

// The same simple profile builder describes domed boiler plates, the face
// surround and feet with level soles. The profile is listed bottom to top.
function profile(points, segments = 30) {
  return new LatheGeometry(
    points.map(([r, y]) => new Vector2(r, y)),
    segments,
  );
}
const round = new SphereGeometry(1, 26, 17);
const detail = new SphereGeometry(1, 12, 8);
const plate = profile([
  [0.17, -0.5],
  [0.65, -0.47],
  [0.83, -0.38],
  [0.98, -0.18],
  [1, 0.1],
  [0.96, 0.3],
  [0.83, 0.45],
  [0.59, 0.5],
  [0.2, 0.5],
]);
const boot = profile([
  [0.05, 0],
  [0.89, 0],
  [0.98, 0.07],
  [1, 0.17],
  [0.92, 0.44],
  [0.72, 0.69],
  [0.34, 0.92],
  [0.03, 1],
]);
const up = new Vector3(0, 1, 0);
const zero = new Quaternion();

function batch() {
  const pieces = [];
  function add(shape, color, x, y, z, sx, sy = sx, sz = sx, rotation = zero) {
    if (shape === round && Math.max(sx, sy, sz) < 0.25) shape = detail;
    const geometry = shape.index ? shape.toNonIndexed() : shape.clone();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(
      new Matrix4().compose(new Vector3(x, y, z), rotation, new Vector3(sx, sy, sz)),
    );
    const rgb = new Color(color);
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) rgb.toArray(colors, i);
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const thickness = Math.min(0.01, Math.max(sx, sy, sz) * 0.037);
    geometry.setAttribute(
      'inkWidth',
      new Float32BufferAttribute(new Float32Array(colors.length / 3).fill(thickness), 1),
    );
    pieces.push(geometry);
  }
  function twig(start, end, r0, r1, color) {
    const a = new Vector3(...start),
      b = new Vector3(...end);
    const direction = b.clone().sub(a);
    const middle = a.addScaledVector(direction, 0.5);
    const shape = new CylinderGeometry(r1, r0, direction.length(), 7);
    add(
      shape,
      color,
      middle.x,
      middle.y,
      middle.z,
      1,
      1,
      1,
      new Quaternion().setFromUnitVectors(up, direction.normalize()),
    );
    shape.dispose();
  }
  function line(points, radius, color) {
    const path = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
    const shape = new TubeGeometry(path, Math.max(7, points.length * 4), radius, 6, false);
    add(shape, color, 0, 0, 0, 1);
    shape.dispose();
  }
  function finish(parent) {
    const geometry = mergeGeometries(pieces);
    for (const part of pieces) part.dispose();
    const mesh = new Mesh(geometry, paint);
    const outline = new Mesh(geometry, ink);
    parent.add(mesh, outline);
    return mesh;
  }
  return { add, twig, line, finish };
}

function joint(parent, x = 0, y = 0, z = 0) {
  const pivot = new Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  return pivot;
}

function fern(b, x, y, z, size, angle) {
  const dx = Math.cos(angle) * size,
    dz = Math.sin(angle) * size;
  b.line(
    [
      [x, y, z],
      [x + dx * 0.42, y + size * 0.53, z + dz * 0.42],
      [x + dx, y + size * 0.78, z + dz],
    ],
    size * 0.018,
    moss,
  );
  for (let j = 1; j <= 5; j++) {
    const t = j / 6,
      spread = size * (1.05 - t) * 0.34;
    for (const side of [-1, 1]) {
      const root = [x + dx * t, y + size * (1.17 * t - 0.39 * t * t), z + dz * t];
      const tip = [
        root[0] + dx * 0.16 - Math.sin(angle) * side * spread,
        root[1] + size * 0.13,
        root[2] + dz * 0.16 + Math.cos(angle) * side * spread,
      ];
      b.twig(root, tip, spread * 0.22, 0.001, j % 2 ? leaf : moss);
    }
  }
}

function limb(assembly, length, radius, color) {
  const b = batch();
  b.add(round, seam, 0, -0.025, 0, radius * 0.85, radius * 0.85, radius * 0.85);
  b.add(plate, color, 0, -length * 0.54, 0.012, radius, length * 0.82, radius * 0.86);
  b.add(round, brass, radius * 0.84, -0.02, 0, radius * 0.13, radius * 0.36, radius * 0.36);
  b.add(round, brass, -radius * 0.84, -0.02, 0, radius * 0.13, radius * 0.36, radius * 0.36);
  b.finish(assembly);
}

export function guardianModel() {
  const group = new Group(),
    heading = joint(group),
    root = joint(heading),
    torso = joint(root);
  group.scale.setScalar(1.076);
  const body = batch();
  body.add(plate, shade, 0, 0.07, -0.04, 0.38, 0.35, 0.31);
  body.add(round, seam, 0, 0.45, -0.05, 0.42, 0.52, 0.35);
  body.add(plate, shell, 0, 0.91, 0.015, 0.64, 1.29, 0.49);
  body.add(round, shade, 0, 0.91, -0.13, 0.59, 0.62, 0.46);
  body.add(round, shell, 0, 1.2, -0.1, 0.67, 0.46, 0.48);
  body.add(round, shade, 0, 1.46, 0.18, 0.395, 0.29, 0.295);
  body.add(round, shell, 0, 1.5, 0.21, 0.354, 0.254, 0.29);
  body.add(round, seam, 0, 1.5, 0.414, 0.299, 0.175, 0.104);
  body.add(round, cream, 0, 1.5, 0.437, 0.267, 0.151, 0.108);
  for (const side of [-1, 1]) {
    body.add(round, copper, side * 0.11, 1.52, 0.531, 0.055, 0.06, 0.025);
    body.add(round, '#ffd275', side * 0.11, 1.52, 0.552, 0.033, 0.039, 0.011);
    body.line(
      [
        [side * 0.21, 0.41, 0.28],
        [side * 0.42, 0.62, 0.34],
        [side * 0.5, 0.97, 0.3],
        [side * 0.53, 1.14, 0.25],
      ],
      0.01,
      shade,
    );
    body.add(round, brass, side * 0.4, 0.64, 0.358, 0.026);
    body.add(round, brass, side * 0.46, 1.02, 0.345, 0.026);
    body.add(round, copper, side * 0.47, 1.29, -0.38, 0.112, 0.053, 0.045);
    body.add(round, moss, side * 0.34, 1.56, -0.19, 0.2, 0.043, 0.15);
  }
  // Uneven seams, lichen and trailing roots break up the large shell.
  for (let i = 0; i < 10; i++) {
    const a = i * 2.39;
    fern(
      body,
      Math.cos(a) * 0.24,
      1.6 + Math.sin(a) * 0.025,
      -0.15 + Math.sin(a) * 0.12,
      0.15 + (i % 3) * 0.045,
      a,
    );
  }
  body.finish(torso);
  const roots = joint(torso, 0.35, 1.49, -0.3);
  const strands = batch();
  for (let i = 0; i < 3; i++) {
    const x = i * 0.048;
    strands.line(
      [
        [x, 0, 0],
        [x + 0.065, -0.15, -0.14],
        [x + 0.075, -0.29, -0.2],
        [x + 0.11, -0.46 - i * 0.045, -0.19],
      ],
      0.012,
      wood,
    );
  }
  strands.finish(roots);

  const legs = [],
    arms = [];
  const upper = 0.55,
    lower = 0.53;
  for (const s of [-1, 1]) {
    const thigh = joint(root, s * 0.225, 0, 0),
      shin = joint(thigh, 0, -upper, 0);
    const foot = joint(shin, 0, -lower, 0);
    limb(thigh, upper, 0.177, shell);
    limb(shin, lower, 0.162, cream);
    const shoe = batch();
    shoe.add(boot, seam, 0, -0.132, 0.085, 0.166, 0.06, 0.269);
    shoe.add(boot, cream, 0, -0.106, 0.087, 0.162, 0.2, 0.263);
    shoe.finish(foot);
    legs.push({ s, thigh, shin, foot });

    const shoulder = joint(torso, s * 0.53, 1.12, 0),
      elbow = joint(shoulder, 0, -0.56, 0.02);
    const hand = joint(elbow, 0, -0.62, 0.025);
    limb(shoulder, 0.56, 0.202, cream);
    limb(elbow, 0.62, 0.192, shell);
    const fingers = batch();
    fingers.add(round, seam, 0, -0.05, 0.015, 0.126, 0.149, 0.11);
    for (let j = 0; j < 3; j++) {
      const x = (j - 1) * 0.068;
      fingers.add(plate, cream, x, -0.174, 0.03, 0.047, 0.178, 0.062);
      fingers.add(round, brass, x, -0.24, 0.058, 0.044, 0.064, 0.042);
    }
    fingers.add(round, cream, -s * 0.112, -0.13, 0.09, 0.051, 0.09, 0.051);
    fingers.finish(hand);
    arms.push({ s, shoulder, elbow, hand });
  }

  function pose({ phase = 0, walk = 0, facing = 1, crouch = 0, flight = 0, time = 0 } = {}) {
    const gait = Math.min(1, Math.max(0, walk));
    // Hold drawings between successive twelfths of a second for loose details.
    const held = Math.floor(time * 12) / 12;
    heading.rotation.y = facing < 0 ? -1.04 : 1.04;
    const hip = 1.165 + Math.abs(Math.sin(phase)) * 0.044 * gait - crouch * 0.51;
    root.position.y = hip;
    root.rotation.x = flight * 1.0;
    torso.rotation.x = 0.055 + crouch * 0.53 + flight * 0.08 + Math.cos(phase * 2) * gait * 0.023;
    roots.rotation.x =
      0.14 + Math.sin(phase - 0.48) * gait * 0.21 + Math.sin(held * 1.8) * 0.035 + flight * 0.67;
    for (const { s, thigh, shin, foot } of legs) {
      const p = phase + (s > 0 ? Math.PI : 0);
      const reach = Math.cos(p) * 0.39 * gait + crouch * 0.15 - flight * 0.36;
      const lift = Math.max(0, -Math.sin(p)) ** 1.3 * 0.23 * gait + flight * 0.15;
      const drop = hip - 0.132 - lift;
      const d = Math.min(upper + lower - 0.0001, Math.hypot(drop, reach));
      const bend = Math.acos(Math.min(1, (upper * upper + d * d - lower * lower) / (2 * upper * d)));
      const hipAngle = -Math.atan2(reach, drop) - bend;
      const shank = -Math.atan2(reach + upper * Math.sin(hipAngle), drop - upper * Math.cos(hipAngle));
      thigh.rotation.x = hipAngle;
      shin.rotation.x = shank - hipAngle;
      foot.rotation.x = -shank + flight * 0.49;
    }
    for (const { s, shoulder, elbow, hand } of arms) {
      const p = phase + (s > 0 ? Math.PI : 0);
      shoulder.rotation.x = Math.cos(p) * gait * 0.46 + 0.1 - crouch * 0.28 + flight * 0.67;
      shoulder.rotation.z = s * (0.1 + crouch * 0.06);
      elbow.rotation.x = -0.19 - Math.max(0, -Math.cos(p)) * gait * 0.24 - crouch * 0.34;
      hand.rotation.x = 0.12 + gait * Math.sin(p - 0.4) * 0.07;
    }
  }
  pose();
  return { group, pose };
}

export function shipModel() {
  const group = new Group(),
    hull = batch();
  group.scale.setScalar(1.034);
  hull.add(round, '#53847d', 0, 0.73, 0, 1.59, 0.56, 0.65);
  hull.add(round, cream, 0.08, 0.94, 0, 1.56, 0.64, 0.66);
  hull.add(round, copper, -1.36, 0.72, 0, 0.32, 0.37, 0.41);
  hull.add(round, seam, -1.55, 0.73, 0, 0.18, 0.285, 0.33);
  for (const side of [-1, 1]) {
    hull.add(round, brass, 0.65, 1.11, side * 0.44, 0.52, 0.42, 0.23);
    hull.add(round, seam, 0.66, 1.12, side * 0.46, 0.47, 0.38, 0.235);
    hull.add(round, '#52758b', 0.68, 1.14, side * 0.48, 0.438, 0.345, 0.229);
    hull.add(round, '#93b4be', 0.77, 1.28, side * 0.645, 0.14, 0.041, 0.022);
    hull.line(
      [
        [-1.35, 0.68, side * 0.3],
        [-0.87, 0.71, side * 0.54],
        [0, 0.7, side * 0.64],
        [0.79, 0.69, side * 0.54],
        [1.43, 0.72, side * 0.28],
      ],
      0.012,
      shade,
    );
    hull.add(round, brass, -0.26, 0.87, side * 0.643, 0.245, 0.158, 0.041);
    hull.add(round, seam, -0.25, 0.87, side * 0.665, 0.213, 0.133, 0.042);
    hull.add(round, '#bd4a36', -0.19, 0.88, side * 0.706, 0.073, 0.07, 0.031);
    for (let j = 0; j < 8; j++) {
      const x = (j - 3.5) * 0.27,
        depth = Math.sqrt(1 - (x / 1.65) ** 2) * 0.65;
      hull.add(round, brass, x, 0.84, side * depth, 0.024);
    }
    for (const end of [-1, 1]) {
      const x = end * 0.82;
      hull.twig([x, 0.35, side * 0.27], [x + end * 0.1, 0.12, side * 0.31], 0.079, 0.059, copper);
      hull.add(round, shade, x + end * 0.11, 0.076, side * 0.31, 0.204, 0.076, 0.12);
    }
  }
  for (let j = 0; j < 9; j++) {
    const x = -0.97 + (j % 5) * 0.26;
    const z = Math.sin(j * 2.39) * 0.23;
    const y = 0.94 + 0.64 * Math.sqrt(Math.max(0.04, 1 - ((x - 0.08) / 1.56) ** 2 - (z / 0.66) ** 2));
    hull.add(round, moss, x, y, z, 0.24, 0.047, 0.16);
    if (j % 2 === 0) fern(hull, x, y, z, 0.22, j * 2.41);
  }
  hull.finish(group);
  const logs = joint(group),
    branches = batch();
  for (let i = 0; i < 2; i++) {
    const x = -1.12 + i * 0.24,
      z = -0.03 + i * 0.31;
    branches.twig([x, 1.44, z], [x + 0.84, 1.64, z + 0.12], 0.13 - i * 0.02, 0.083, wood);
    branches.twig(
      [x + 0.81, 1.64, z + 0.12],
      [x + 1.65, 1.67 + i * 0.13, z + 0.15],
      0.082,
      0.038,
      '#7e684b',
    );
    branches.twig([x + 0.78, 1.62, z + 0.13], [x + 1.12, 1.96, z + 0.19], 0.045, 0.009, wood);
    branches.twig([x + 1.34, 1.66, z + 0.15], [x + 1.74, 1.88, z + 0.21], 0.031, 0.007, wood);
  }
  branches.finish(logs);
  const cover = joint(group),
    growth = batch();
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      growth.add(
        round,
        i % 2 ? '#829958' : moss,
        -0.32 + (i % 3) * 0.096,
        0.845 + Math.floor(i / 3) * 0.083,
        s * 0.716,
        0.096,
        0.082,
        0.037,
      );
    }
    growth.line(
      [
        [-0.4, 1.48, s * 0.23],
        [-0.4, 1.28, s * 0.61],
        [-0.37, 0.99, s * 0.704],
        [-0.26, 0.81, s * 0.72],
      ],
      0.031,
      moss,
    );
  }
  growth.finish(cover);
  const lamps = joint(group),
    light = batch();
  for (const s of [-1, 1]) light.add(round, '#ffbc57', 1.2, 0.79, s * 0.415, 0.114, 0.065, 0.028);
  light.add(round, '#ffc875', -1.72, 0.73, 0, 0.024, 0.19, 0.22);
  light.finish(lamps);
  function pose({ step = 0, age = 0 } = {}) {
    logs.visible = step < 1;
    cover.visible = step < 2;
    lamps.visible = age > 0 && (age > 1.6 || Math.sin(age * 35) + Math.cos(age * 17) > 0.08);
  }
  pose();
  return { group, pose };
}

export function birdModel() {
  const group = new Group(),
    body = batch();
  body.add(round, '#496679', 0, 0, 0, 0.105, 0.063, 0.055);
  body.add(round, '#e7ca9b', 0.035, -0.024, 0.004, 0.062, 0.039, 0.052);
  body.add(round, '#647f86', 0.082, 0.038, 0, 0.056, 0.053, 0.05);
  body.twig([0.122, 0.039, 0], [0.177, 0.031, 0], 0.018, 0.001, brass);
  body.twig([-0.075, 0.0, 0], [-0.173, 0.027, 0.028], 0.026, 0.001, shade);
  body.twig([-0.075, 0.0, 0], [-0.171, 0.025, -0.028], 0.025, 0.001, shade);
  for (const s of [-1, 1]) body.add(round, seam, 0.104, 0.049, s * 0.038, 0.01);
  body.finish(group);
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = joint(group, -0.006, 0.014, s * 0.016);
    const wing = batch();
    wing.add(round, '#718a8d', -0.019, 0.003, s * 0.064, 0.067, 0.023, 0.099);
    wing.twig([-0.042, 0.006, s * 0.102], [-0.16, 0.001, s * 0.29], 0.04, 0.002, '#4a6572');
    wing.twig([-0.048, 0.005, s * 0.102], [-0.175, 0.0, s * 0.23], 0.035, 0.001, '#647d83');
    wing.finish(pivot);
    wings.push({ s, pivot });
  }
  function pose(time = 0) {
    const frame = Math.floor(time * 14) / 14;
    const glide = Math.max(0, Math.min(1, (Math.cos(frame * 1.65) + 0.24) * 2));
    for (const { s, pivot } of wings)
      pivot.rotation.x = -s * (0.2 + Math.sin(frame * 19) * glide * 0.98);
  }
  pose();
  return { group, pose };
}
