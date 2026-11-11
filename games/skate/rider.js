// The rider and the board. The rider is built like a person: a chest wider
// than the waist, arms and legs that taper with a little muscle, hands with
// fingers, sneakers with laces, and a face with eyelids, brows, a nose and
// a smile. Every piece of clothing can be swapped and recolored. Arms and
// legs are placed each frame with two-bone IK: the feet stay on the board
// and the hands reach for wherever the pose wants them (out for balance,
// or grabbing the board).
//
// The board points along +z (the way of travel) and the rider stands
// sideways on it, facing +x, looking ahead over the front shoulder.

import * as THREE from '../../vendor/three/three.min.js';
import { boardTexture, bumpTexture } from './textures.js';
import { normalMapFrom } from '../../gfx/surface.js';

const THIGH = 0.44;
const SHIN = 0.44;
const UPPER_ARM = 0.29;
const FOREARM = 0.28;
// Height of the board's top, and how far apart the feet are.
const DECK = { skate: 0.1, snow: 0.045 };
const FEET = { skate: 0.25, snow: 0.29 };

// How much smaller the head is than the cartoon head its parts were first
// sized for, and how high it sits above the chest.
const HEAD_SCALE = 0.86;
const HEAD_HEIGHT = 0.272;
// The body's outline from the hips up to the neck: [how far out, height].
// It is turned around the spine, then flattened front to back.
const TORSO = [[0, -0.03], [0.112, -0.03], [0.134, 0.02], [0.128, 0.12], [0.14, 0.22], [0.16, 0.33], [0.172, 0.42], [0.162, 0.48], [0.122, 0.525], [0.072, 0.555], [0.052, 0.585], [0, 0.585]];
const TORSO_DEPTH = 0.66;

// How far the front of the body is from the spine at a height.
function chestFront(height) {
  for (let i = 1; i < TORSO.length; i += 1) {
    if (height <= TORSO[i][1]) {
      const [r0, y0] = TORSO[i - 1];
      const [r1, y1] = TORSO[i];
      const t = y1 === y0 ? 0 : (height - y0) / (y1 - y0);
      return (r0 + (r1 - r0) * t) * TORSO_DEPTH;
    }
  }
  return 0;
}

const UP = new THREE.Vector3(0, 1, 0);

function mat(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...options });
}

// Skin has a soft sheen at its edges, like light through a cheek.
function skinMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.52, sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ff9a7a'), 0.5),
  });
}

function shadowed(mesh) {
  mesh.castShadow = true;
  return mesh;
}

// A rounded tube between two points (an arm or leg bone).
function limb(radius, length, material) {
  const geometry = new THREE.CapsuleGeometry(radius, length, 4, 10);
  return shadowed(new THREE.Mesh(geometry, material));
}

// A piece of an arm or a leg: round at both ends, `from` wide where it
// starts and `to` wide at its far end, with a little muscle that is
// thickest `at` that share of the way along. It runs along y, far end up.
function segment(length, from, to, material, { swell = 0, at = 0.4 } = {}) {
  const points = [];
  const half = length / 2;
  const peak = Math.log(0.5) / Math.log(at);
  for (let i = 0; i <= 5; i += 1) {
    const angle = (i / 5) * (Math.PI / 2);
    points.push(new THREE.Vector2(Math.sin(angle) * from, -half - Math.cos(angle) * from));
  }
  for (let i = 1; i < 9; i += 1) {
    const t = i / 9;
    points.push(new THREE.Vector2(from + (to - from) * t + swell * Math.sin(Math.PI * t ** peak), -half + length * t));
  }
  for (let i = 0; i <= 5; i += 1) {
    const angle = (i / 5) * (Math.PI / 2);
    points.push(new THREE.Vector2(Math.cos(angle) * to, half + Math.sin(angle) * to));
  }
  return shadowed(new THREE.Mesh(new THREE.LatheGeometry(points, 16), material));
}

// An open tube of cloth around part of a segment: a sleeve, a shorts leg,
// a cuff or a sock. `low` and `high` are heights along the segment.
function wrap(low, high, lowRadius, highRadius, material) {
  const tube = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(highRadius, lowRadius, high - low, 16, 1, true), material));
  tube.position.y = (low + high) / 2;
  return tube;
}

// A thin rounded line through some points: a brow, a smile, a lace.
function line(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius, 6), material);
}

// A ball squashed into any rounded shape.
function blob(sx, sy, sz, material, segments = 14) {
  const mesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.round(segments * 0.7)), material));
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

const tmp = new THREE.Vector3();

function placeLimb(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  tmp.copy(b).sub(a).normalize();
  mesh.quaternion.setFromUnitVectors(UP, tmp);
}

// Where the middle joint (knee, elbow) goes so the bones reach the target,
// bending toward `pole`. Writes the joint and the reached end.
const ikDir = new THREE.Vector3();
const ikBend = new THREE.Vector3();

function twoBone(root, target, first, second, pole, joint, end) {
  ikDir.copy(target).sub(root);
  const distance = Math.min(first + second - 0.001, Math.max(Math.abs(first - second) + 0.01, ikDir.length()));
  ikDir.normalize();
  const angle = Math.acos(Math.min(1, Math.max(-1, (first * first + distance * distance - second * second) / (2 * first * distance))));
  ikBend.copy(pole).addScaledVector(ikDir, -pole.dot(ikDir)).normalize();
  joint.copy(root).addScaledVector(ikDir, first * Math.cos(angle)).addScaledVector(ikBend, first * Math.sin(angle));
  end.copy(root).addScaledVector(ikDir, distance);
}

/* ---------- The board ---------- */

// A rounded-end board seen from above, pushed up into a thin slab, with
// the nose and tail bent up.
function boardGeometry(width, length, thickness, kick) {
  const shape = new THREE.Shape();
  const r = width / 2;
  const half = length / 2 - r;
  shape.moveTo(-r, -half);
  shape.lineTo(-r, half);
  shape.absarc(0, half, r, Math.PI, 0, true);
  shape.lineTo(r, -half);
  shape.absarc(0, -half, r, 0, Math.PI, true);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 10 });
  // Shape x stays x, shape y becomes -z, depth becomes up.
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i += 1) {
    const z = position.getZ(i);
    position.setY(i, position.getY(i) + kick(Math.abs(z)));
    uv.setXY(i, 0.5 + position.getX(i) / width, 0.5 - z / length);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildBoard(type, look, owned) {
  const group = new THREE.Group();
  const texture = boardTexture(look.deck, look.graphic, look.graphicColor);
  owned.push(texture);
  const face = mat('#ffffff', { map: texture, roughness: 0.45 });
  const edge = mat(new THREE.Color(look.deck).multiplyScalar(0.7), { roughness: 0.5 });
  if (type === 'skate') {
    const deck = new THREE.Mesh(boardGeometry(0.21, 0.82, 0.02, (z) => Math.max(0, z - 0.27) * 0.5), [face, edge]);
    deck.position.y = 0.075;
    group.add(shadowed(deck));
    const metal = mat('#b9bec7', { metalness: 0.8, roughness: 0.35 });
    const wheel = mat(look.wheels, { roughness: 0.5 });
    const wheelGeometry = new THREE.CylinderGeometry(0.032, 0.032, 0.032, 14);
    wheelGeometry.rotateZ(Math.PI / 2);
    [-0.21, 0.21].forEach((z) => {
      const truck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.04), metal);
      truck.position.set(0, 0.044, z);
      group.add(shadowed(truck));
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.07), metal);
      base.position.set(0, 0.064, z);
      group.add(base);
      [-0.088, 0.088].forEach((x) => {
        const w = new THREE.Mesh(wheelGeometry, wheel);
        w.position.set(x, 0.032, z);
        group.add(shadowed(w));
      });
    });
  } else {
    const deck = new THREE.Mesh(boardGeometry(0.28, 1.45, 0.018, (z) => Math.max(0, z - 0.58) ** 2 * 1.1), [face, edge]);
    deck.position.y = 0.006;
    group.add(shadowed(deck));
    const strap = mat(look.wheels, { roughness: 0.6 });
    const dark = mat('#26262e', { roughness: 0.7 });
    [-FEET.snow, FEET.snow].forEach((z) => {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.13), dark);
      plate.position.set(0, 0.034, z);
      group.add(plate);
      const highback = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.13), strap);
      highback.position.set(-0.12, 0.11, z);
      highback.rotation.z = 0.18;
      group.add(shadowed(highback));
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.14), strap);
      band.position.set(0.05, 0.1, z);
      group.add(band);
    });
  }
  return group;
}

/* ---------- The rider's head ---------- */

function sphere(radius, material, { from = 0, to = Math.PI, segments = 18 } = {}) {
  return shadowed(new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.7), 0, Math.PI * 2, from, to), material));
}

function buildHead(look, skin) {
  const head = new THREE.Group();
  // The skull, a little taller than wide, with a jaw and chin below it.
  const skull = sphere(0.15, skin, { segments: 24 });
  skull.scale.set(1, 1.06, 0.93);
  head.add(skull);
  const jaw = sphere(0.112, skin, { segments: 18 });
  jaw.position.set(0.022, -0.078, 0);
  jaw.scale.set(1, 0.86, 0.9);
  head.add(jaw);

  const white = mat('#fbfbf6', { roughness: 0.25 });
  const iris = mat('#4f3420', { roughness: 0.3 });
  const dark = mat('#1a1420', { roughness: 0.3 });
  const lash = mat('#2a1c18', { roughness: 0.6 });
  const brow = mat(new THREE.Color(look.hairColor).multiplyScalar(0.75), { roughness: 0.7 });
  const cheekBlush = mat('#ff8fa3', { transparent: true, opacity: 0.28 });
  [-1, 1].forEach((side) => {
    const z = side * 0.054;
    // The eye: white, a brown iris, the pupil and a glint of light, under
    // an eyelid with a dark lash line.
    const ball = blob(0.0105, 0.0216, 0.03, white, 12);
    ball.position.set(0.128, 0.022, z);
    const color = blob(0.005, 0.0165, 0.0165, iris, 10);
    color.position.set(0.1375, 0.02, z);
    const pupil = blob(0.004, 0.008, 0.008, dark, 8);
    pupil.position.set(0.1405, 0.02, z);
    const glint = blob(0.003, 0.0045, 0.0045, mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.4 }), 6);
    glint.position.set(0.143, 0.027, z + 0.006);
    const lid = sphere(0.0315, skin, { to: Math.PI * 0.36, segments: 12 });
    lid.position.set(0.128, 0.022, z);
    lid.scale.set(0.37, 0.74, 1.03);
    head.add(ball, color, pupil, glint, lid);
    head.add(line([[0.1355, 0.03, z - 0.027], [0.1405, 0.0365, z], [0.1355, 0.03, z + 0.027]], 0.0032, lash));
    head.add(line([[0.127, 0.06, side * 0.088], [0.1395, 0.071, side * 0.058], [0.143, 0.066, side * 0.03]], 0.0058, brow));
    const cheek = blob(0.01, 0.016, 0.026, cheekBlush, 8);
    cheek.position.set(0.119, -0.036, side * 0.084);
    cheek.castShadow = false;
    head.add(cheek);
    // The ear, with its darker hollow.
    const ear = blob(0.022, 0.03, 0.013, skin, 10);
    ear.position.set(-0.004, -0.002, side * 0.14);
    const hollow = blob(0.012, 0.018, 0.005, mat(new THREE.Color(look.skin).multiplyScalar(0.72)), 8);
    hollow.position.set(0, -0.002, side * 0.151);
    head.add(ear, hollow);
    const nostril = blob(0.011, 0.009, 0.011, skin, 8);
    nostril.position.set(0.146, -0.03, side * 0.013);
    head.add(nostril);
  });
  // The nose: a bridge down to a rounded tip.
  const bridge = limb(0.012, 0.03, skin);
  bridge.position.set(0.147, 0.008, 0);
  bridge.rotation.z = -0.32;
  const tip = blob(0.018, 0.015, 0.019, skin, 10);
  tip.position.set(0.157, -0.021, 0);
  head.add(bridge, tip);
  // A smile.
  head.add(line([[0.127, -0.057, -0.037], [0.137, -0.068, -0.019], [0.1405, -0.0715, 0], [0.137, -0.068, 0.019], [0.127, -0.057, 0.037]], 0.0048, mat('#a8453f', { roughness: 0.5 })));

  const hair = mat(look.hairColor, { roughness: 0.65 });
  const hatOn = look.hat !== 'none';
  const cap = (radius, cover = 0.52) => {
    const piece = sphere(radius, hair, { to: Math.PI * cover });
    piece.rotation.z = 0.42;
    return piece;
  };
  const cropped = look.hair === 'buzz' || look.hair === 'mohawk';
  if (cropped) {
    head.add(cap(0.153, 0.5));
  } else {
    head.add(cap(0.163));
    // Hair down the back of the head, to the neck.
    const nape = blob(0.085, 0.11, 0.128, hair);
    nape.position.set(-0.07, -0.045, 0);
    head.add(nape);
  }
  if (!cropped && !hatOn && look.hair !== 'curly') {
    // A fringe of tufts over the forehead, swept to one side.
    [-0.085, -0.045, 0, 0.045, 0.085].forEach((z, i) => {
      const tuft = blob(0.05, 0.03, 0.036, hair, 10);
      tuft.position.set(0.105 - Math.abs(z) * 0.5, 0.118 - i * 0.004, z);
      tuft.rotation.set(0.5, 0, -0.55);
      head.add(tuft);
    });
  }
  if (look.hair === 'long') {
    const back = limb(0.1, 0.2, hair);
    back.position.set(-0.07, -0.13, 0);
    back.scale.set(0.55, 1, 1.45);
    head.add(back);
  }
  if (look.hair === 'ponytail') {
    const knot = sphere(0.055, hair, { segments: 10 });
    knot.position.set(-0.155, 0.04, 0);
    head.add(knot);
    const tail = limb(0.04, 0.2, hair);
    tail.position.set(-0.2, -0.08, 0);
    tail.rotation.z = -0.35;
    head.add(tail);
  }
  if (look.hair === 'curly' && !hatOn) {
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const curl = sphere(0.058, hair, { segments: 10 });
      curl.position.set(Math.cos(angle) * 0.11 - 0.03, 0.1 + (i % 2) * 0.03, Math.sin(angle) * 0.11);
      head.add(curl);
    }
    const top = sphere(0.07, hair, { segments: 10 });
    top.position.set(-0.02, 0.15, 0);
    head.add(top);
  }
  if (look.hair === 'mohawk' && look.hat !== 'helmet' && look.hat !== 'beanie') {
    for (let i = 0; i < 5; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 6), hair);
      const angle = 0.95 - i * 0.42;
      spike.position.set(Math.cos(angle + Math.PI / 2) * -0.15, Math.sin(angle + Math.PI / 2) * 0.15, 0);
      spike.rotation.z = -angle;
      head.add(shadowed(spike));
    }
  }

  const hatMat = mat(look.hatColor, { roughness: look.hat === 'helmet' ? 0.25 : 0.7, metalness: look.hat === 'helmet' ? 0.1 : 0 });
  if (look.hat === 'cap' || look.hat === 'backCap') {
    const dome = sphere(0.168, hatMat, { to: Math.PI * 0.5 });
    dome.position.y = 0.02;
    head.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.014, 18), hatMat);
    const side = look.hat === 'cap' ? 1 : -1;
    brim.position.set(side * 0.15, 0.035, 0);
    brim.scale.set(1.1, 1, 0.95);
    brim.rotation.z = -side * 0.12;
    head.add(shadowed(brim));
    const button = sphere(0.018, hatMat, { segments: 8 });
    button.position.y = 0.19;
    head.add(button);
  }
  if (look.hat === 'beanie') {
    const dome = sphere(0.17, hatMat, { to: Math.PI * 0.55 });
    dome.scale.set(1, 1.18, 1);
    head.add(dome);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 20, 1, true), hatMat);
    cuff.position.y = 0.01;
    head.add(cuff);
    const pom = sphere(0.05, mat('#ffffff', { roughness: 0.9 }), { segments: 10 });
    pom.position.y = 0.23;
    head.add(pom);
  }
  if (look.hat === 'helmet') {
    const dome = sphere(0.188, hatMat, { to: Math.PI * 0.56 });
    dome.position.y = 0.005;
    head.add(dome);
    const stripe = sphere(0.19, mat('#ffffff', { roughness: 0.3 }), { to: Math.PI * 0.56 });
    stripe.scale.set(1, 1, 0.18);
    stripe.position.y = 0.006;
    head.add(stripe);
  }
  if (look.glasses === 'shades') {
    const lens = mat('#101016', { roughness: 0.08, metalness: 0.6 });
    const frame = mat('#16161c', { roughness: 0.4 });
    [-1, 1].forEach((side) => {
      const glass = blob(0.01, 0.027, 0.04, lens, 12);
      glass.position.set(0.142, 0.022, side * 0.054);
      head.add(glass);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.008, 0.006), frame);
      arm.position.set(0.07, 0.028, side * 0.134);
      arm.rotation.y = side * -0.3;
      head.add(arm);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.04), frame);
    bridge.position.set(0.15, 0.03, 0);
    head.add(bridge);
  }
  if (look.glasses === 'goggles') {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.22), mat('#ff9a2a', { roughness: 0.1, metalness: 0.7 }));
    lens.position.set(0.14, 0.035, 0);
    head.add(lens);
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.166, 0.166, 0.035, 22, 1, true), mat('#2a2a33'));
    strap.position.y = 0.035;
    head.add(strap);
  }
  // Head sizes above are for a big cartoon head; a person's is smaller.
  head.scale.setScalar(HEAD_SCALE);
  return head;
}

/* ---------- Shoes and hands ---------- */

// A sneaker (or a snowboard boot): a white sole with a rubber toe, the
// upper, a tongue and laces, and a padded collar around the ankle. The toe
// points along +x; the ankle is above the heel end.
function buildShoe(boot, shoe, trim, sole, lace) {
  const foot = new THREE.Group();
  const base = shadowed(new THREE.Mesh(new THREE.RoundedBoxGeometry(0.27, 0.028, 0.104, 3, 0.012), sole));
  base.position.set(0.035, 0.014, 0);
  const heel = shadowed(new THREE.Mesh(new THREE.RoundedBoxGeometry(0.15, 0.078, 0.096, 4, 0.028), shoe));
  heel.position.set(-0.02, 0.064, 0);
  const toe = blob(0.085, 0.036, 0.049, shoe, 14);
  toe.position.set(0.085, 0.05, 0);
  const bumper = blob(0.04, 0.03, 0.05, sole, 12);
  bumper.position.set(0.135, 0.04, 0);
  const tongue = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.075, 0.02, 0.05, 2, 0.008), trim);
  tongue.position.set(0.04, 0.096, 0);
  tongue.rotation.z = -0.42;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.037, 0.014, 8, 16), trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(-0.028, 0.104, 0);
  foot.add(base, heel, toe, bumper, tongue, collar);
  [0.05, 0.072, 0.094].forEach((along, i) => {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.007, 0.056), lace);
    cross.position.set(along, 0.093 - i * 0.011, 0);
    cross.rotation.z = -0.42;
    foot.add(cross);
  });
  // A stripe down each side.
  [-1, 1].forEach((side) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.014, 0.004), lace);
    stripe.position.set(0.005, 0.066, side * 0.049);
    stripe.rotation.z = 0.5;
    foot.add(stripe);
  });
  if (boot) {
    // A boot comes up over the ankle, with two straps.
    const shaft = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.14, 14), shoe));
    shaft.position.set(-0.028, 0.16, 0);
    foot.add(shaft);
    [0.13, 0.19].forEach((up) => {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.061, 0.009, 6, 16), trim);
      strap.rotation.x = Math.PI / 2;
      strap.position.set(-0.028, up, 0);
      foot.add(strap);
    });
    foot.scale.setScalar(1.08);
  }
  return foot;
}

// A hand: a palm, four fingers a little curled, and a thumb. It runs along
// y from the wrist, like the forearm it follows. Gloves are thicker.
function buildHand(side, material, gloved) {
  const hand = new THREE.Group();
  const thick = gloved ? 1.3 : 1;
  const palm = blob(0.02 * thick, 0.04, 0.036 * thick, material, 12);
  palm.position.y = 0.036;
  hand.add(palm);
  [[-0.027, 0.028], [-0.009, 0.034], [0.009, 0.032], [0.027, 0.025]].forEach(([z, long]) => {
    const finger = limb(0.0088 * thick, long, material);
    finger.position.set(0.008, 0.074 + long / 2, z);
    finger.rotation.z = -0.3;
    hand.add(finger);
  });
  const thumb = limb(0.0098 * thick, 0.024, material);
  thumb.position.set(0.006, 0.045, side * 0.042);
  thumb.rotation.x = side * 0.75;
  hand.add(thumb);
  if (gloved) {
    hand.add(wrap(-0.03, 0.012, 0.05, 0.046, material));
  }
  return hand;
}

/* ---------- The whole rider ---------- */

// Builds a rider in their clothes on their board. `update` poses them.
export function buildRider(look, board) {
  const owned = [];
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const boardHolder = new THREE.Group();
  const boardSpin = new THREE.Group();
  const boardMesh = buildBoard(board, look, owned);
  const deckY = DECK[board];
  // Spin the board around its middle.
  boardSpin.position.y = deckY / 2;
  boardMesh.position.y = -deckY / 2;
  boardSpin.add(boardMesh);
  boardHolder.add(boardSpin);
  body.add(boardHolder);

  // Cloth has a fine weave that catches the light.
  const grain = bumpTexture(19);
  const weave = normalMapFrom(grain.image, { strength: 1.6, size: { width: 128, height: 128 } });
  weave.repeat.set(5, 7);
  owned.push(grain, weave);
  const cloth = (color, roughness) => mat(color, { roughness, normalMap: weave, side: THREE.DoubleSide });
  const shade = (color, amount) => new THREE.Color(color).multiplyScalar(amount);

  const skin = skinMaterial(look.skin);
  const top = cloth(look.topColor, 0.82);
  const topTrim = cloth(shade(look.topColor, 0.78), 0.85);
  const bottom = cloth(look.bottomColor, 0.86);
  const bottomTrim = cloth(shade(look.bottomColor, 0.78), 0.88);
  const shoe = mat(look.shoes, { roughness: 0.6 });
  const shoeTrim = mat(shade(look.shoes, 0.72), { roughness: 0.65 });
  const sole = mat('#f4f4f0', { roughness: 0.7 });
  const white = mat('#f4f4f0', { roughness: 0.8 });
  const snow = board === 'snow';
  const glove = snow ? mat('#2a2a33', { roughness: 0.8 }) : skin;

  // The body: a chest wider than the waist, flatter front to back.
  const hips = new THREE.Object3D();
  body.add(hips);
  const torso = shadowed(new THREE.Mesh(new THREE.LatheGeometry(TORSO.map(([out, up]) => new THREE.Vector2(out, up)), 24), top));
  torso.scale.x = TORSO_DEPTH;
  hips.add(torso);
  const pelvis = blob(0.105, 0.094, 0.147, bottom, 18);
  pelvis.position.y = -0.012;
  hips.add(pelvis);
  // A waistband, and the hem of the top over it.
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.133, 0.013, 8, 24), bottomTrim);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(TORSO_DEPTH + 0.04, 1, 1);
  belt.position.y = 0.012;
  hips.add(belt);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.134, 0.01, 8, 24), topTrim);
  hem.rotation.x = Math.PI / 2;
  hem.scale.set(TORSO_DEPTH + 0.03, 1, 1);
  hem.position.y = 0.04;
  hips.add(hem);

  if (look.top === 'hoodie') {
    const hood = sphere(0.12, top, { to: Math.PI * 0.6 });
    hood.position.set(-0.1, 0.55, 0);
    hood.rotation.z = 1.25;
    hood.scale.set(1, 1, 1.15);
    hips.add(hood);
    // A pouch pocket, and two drawstrings.
    const pocket = blob(0.02, 0.055, 0.1, topTrim, 12);
    pocket.position.set(chestFront(0.16) - 0.004, 0.16, 0);
    hips.add(pocket);
    [-1, 1].forEach((side) => {
      const string = limb(0.006, 0.09, white);
      string.position.set(chestFront(0.42) + 0.004, 0.42, side * 0.035);
      hips.add(string);
    });
  }
  if (look.top === 'jacket') {
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.44, 0.02), mat('#f2f2f2', { roughness: 0.35, metalness: 0.5 }));
    zip.position.set(chestFront(0.3) + 0.002, 0.27, 0);
    hips.add(zip);
    const collar = wrap(0.52, 0.6, 0.085, 0.07, top);
    collar.scale.x = 0.85;
    hips.add(collar);
    // Chest pockets.
    [-1, 1].forEach((side) => {
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.07), topTrim);
      flap.position.set(chestFront(0.36) - 0.004, 0.36, side * 0.085);
      hips.add(flap);
    });
  }
  if (look.top === 'tee') {
    const print = new THREE.Mesh(new THREE.CircleGeometry(0.055, 20), mat(new THREE.Color(look.topColor).offsetHSL(0.5, 0, 0)));
    print.position.set(chestFront(0.33) + 0.003, 0.33, 0);
    print.rotation.y = Math.PI / 2;
    hips.add(print);
  }
  if (look.top !== 'jacket') {
    // A neckline.
    const neckline = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 8, 20), topTrim);
    neckline.rotation.x = Math.PI / 2;
    neckline.scale.x = 0.85;
    neckline.position.y = 0.562;
    hips.add(neckline);
  }

  const chest = new THREE.Object3D();
  chest.position.y = 0.48;
  hips.add(chest);
  const neck = segment(0.11, 0.056, 0.05, skin);
  neck.position.y = 0.13;
  chest.add(neck);
  const head = buildHead(look, skin);
  head.position.y = HEAD_HEIGHT;
  head.rotation.y = -1.05;
  chest.add(head);

  // Legs: [thigh at the hip, thigh at the knee, shin at the knee, shin at
  // the ankle] for each kind of trousers.
  const shorts = look.bottom === 'shorts';
  const legSize = { shorts: [0.08, 0.058, 0.056, 0.04], pants: [0.086, 0.064, 0.061, 0.05], baggy: [0.1, 0.084, 0.084, 0.078] }[look.bottom];
  const half = { thigh: THIGH / 2, shin: SHIN / 2, upper: UPPER_ARM / 2, lower: FOREARM / 2 };
  const legs = [-1, 1].map((side) => {
    const thigh = segment(THIGH, legSize[0], legSize[1], shorts ? skin : bottom, { swell: 0.008, at: 0.35 });
    // A bare shin has a calf; trousers hang straighter.
    const shin = segment(SHIN, legSize[2], legSize[3], shorts ? skin : bottom, { swell: shorts ? 0.017 : 0.005, at: 0.3 });
    if (shorts) {
      // The shorts end above the knee; socks show above the shoes.
      thigh.add(wrap(-half.thigh - 0.02, half.thigh * 0.36, 0.094, 0.082, bottom));
      thigh.add(wrap(half.thigh * 0.3, half.thigh * 0.36, 0.083, 0.084, bottomTrim));
      shin.add(wrap(half.shin - 0.13, half.shin - 0.02, 0.044, 0.042, white));
    } else {
      // A turned-up cuff at the ankle.
      shin.add(wrap(half.shin - 0.07, half.shin - 0.015, legSize[3] + 0.012, legSize[3] + 0.01, bottomTrim));
    }
    const foot = buildShoe(snow, shoe, shoeTrim, sole, white);
    body.add(thigh, shin, foot);
    return { side, thigh, shin, foot, knee: new THREE.Vector3(), ankle: new THREE.Vector3() };
  });

  const sleeve = look.top === 'tee';
  const arms = [-1, 1].map((side) => {
    let upper = null;
    let lower = null;
    if (sleeve) {
      // Bare arms under short sleeves.
      upper = segment(UPPER_ARM, 0.052, 0.044, skin, { swell: 0.004, at: 0.4 });
      upper.add(wrap(-half.upper - 0.02, half.upper * 0.1, 0.064, 0.061, top));
      upper.add(wrap(half.upper * 0.02, half.upper * 0.1, 0.0615, 0.0625, topTrim));
      const cap = blob(0.064, 0.06, 0.064, top, 12);
      cap.position.y = -half.upper;
      upper.add(cap);
      lower = segment(FOREARM, 0.044, 0.033, skin, { swell: 0.008, at: 0.3 });
    } else {
      upper = segment(UPPER_ARM, 0.062, 0.052, top, { swell: 0.004 });
      lower = segment(FOREARM, 0.052, 0.044, top);
      // A ribbed cuff at the wrist.
      lower.add(wrap(half.lower - 0.045, half.lower + 0.005, 0.047, 0.044, topTrim));
    }
    const hand = buildHand(side, glove, snow);
    body.add(upper, lower, hand);
    return { side, upper, lower, hand, elbow: new THREE.Vector3(), wrist: new THREE.Vector3() };
  });

  // Smoothed pose values.
  const now = { hipY: 0.86, lean: 0.15, roll: 0, twist: 0, lift: 0, feet: 0, spin: 0, bail: 0, side: 0, crouch: 0 };
  const hands = [new THREE.Vector3(0.1, 0.95, -0.5), new THREE.Vector3(0.1, 0.95, 0.5)];
  const handGoal = [new THREE.Vector3(), new THREE.Vector3()];
  const hipJoint = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const footGoal = new THREE.Vector3();
  const pole = new THREE.Vector3();
  const chestMatrix = new THREE.Matrix4();
  const flipQ = new THREE.Quaternion();
  const spinQ = new THREE.Quaternion();
  const pivot = new THREE.Vector3(0, 0.9, 0);
  const rotatedPivot = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const feetZ = FEET[board];

  function approach(key, target, rate, dt) {
    now[key] += (target - now[key]) * Math.min(1, dt * rate);
  }

  // pose: { state: ride | air | grind | bail, steer, spin, flip, grab,
  // side, land (0–1 squash), bail (0–1), time }
  function update(dt, pose) {
    const { state } = pose;
    let hipY = 0.86 - Math.abs(pose.steer) * 0.04;
    let lean = 0.14;
    let lift = 0;
    let feet = 0;
    const grab = state === 'air' ? pose.grab : null;
    if (state === 'air') {
      hipY = 0.74;
      lean = 0.22;
    }
    if (state === 'grind') {
      hipY = 0.78;
      lean = 0.2;
    }
    if (grab) {
      hipY = 0.6;
      lean = 0.62;
      lift = 0.3;
    }
    hipY -= pose.land * 0.22;
    const flip = state === 'air' ? pose.flip : null;
    const skateFlip = flip && board === 'skate';
    if (skateFlip) {
      feet = Math.sin(Math.PI * flip.progress) * 0.3;
      hipY += feet * 0.2;
    }
    approach('hipY', hipY, 12, dt);
    approach('lean', lean - pose.steer * 0.12 * (state === 'ride' ? 1 : 0), 10, dt);
    approach('roll', state === 'ride' ? pose.steer * 0.12 : 0, 8, dt);
    approach('twist', pose.steer * 0.25, 6, dt);
    approach('lift', lift, 14, dt);
    approach('feet', feet, 30, dt);
    approach('side', pose.side ? 1 : 0, 12, dt);
    approach('bail', pose.bail, 10, dt);

    // Spins, and the whole-body flips of a snowboard.
    spinQ.setFromAxisAngle(UP, pose.spin + now.side * (Math.PI / 2));
    flipQ.identity();
    if (flip && board === 'snow') {
      const turn = Math.PI * 2 * flip.progress;
      const axes = {
        backflip: [0, 0, 1],
        frontflip: [0, 0, -1],
        wildcat: [-1, 0, 0],
        rodeo: [0.6, 0.55, 0.6],
        misty: [-0.6, 0.55, 0.6],
      };
      axis.fromArray(axes[flip.move]).normalize();
      flipQ.setFromAxisAngle(axis, turn);
    }
    if (now.bail > 0.001) {
      // Tip over onto the toe side, then lie there.
      axis.set(0, 0, -1);
      const fall = new THREE.Quaternion().setFromAxisAngle(axis, now.bail * Math.PI * 0.45);
      flipQ.premultiply(fall);
    }
    body.quaternion.copy(spinQ).multiply(flipQ);
    rotatedPivot.copy(pivot).applyQuaternion(flipQ).applyQuaternion(spinQ);
    if (flipQ.w < 0.99999) {
      body.position.copy(pivot).applyQuaternion(spinQ).sub(rotatedPivot);
      body.position.y -= now.bail * 0.72;
    } else {
      body.position.set(0, 0, 0);
    }

    // The board: lifted for grabs, flipped under the feet for skate tricks,
    // tipped with the turn.
    boardHolder.position.set(0, now.lift, 0);
    boardSpin.rotation.set(0, 0, 0);
    boardHolder.rotation.set(0, 0, now.roll);
    if (skateFlip) {
      const turn = Math.PI * 2 * flip.progress;
      boardHolder.position.y += Math.sin(Math.PI * flip.progress) * 0.12;
      if (flip.move === 'kickflip') {
        boardSpin.rotation.z = turn;
      }
      if (flip.move === 'heelflip') {
        boardSpin.rotation.z = -turn;
      }
      if (flip.move === 'shove') {
        boardSpin.rotation.y = turn / 2;
      }
      if (flip.move === 'varial') {
        boardSpin.rotation.set(0, turn / 2, turn, 'YXZ');
      }
      if (flip.move === 'treflip') {
        boardSpin.rotation.set(0, turn, turn, 'YXZ');
      }
      if (flip.move === 'impossible') {
        boardSpin.rotation.x = turn;
      }
    }
    if (grab === 'method') {
      boardHolder.rotation.x = 0.5;
      boardHolder.position.x = -0.15;
    }
    if (grab === 'nose') {
      boardHolder.rotation.x = -0.35;
    }
    if (grab === 'tail') {
      boardHolder.rotation.x = 0.35;
    }

    // Body.
    hips.position.set(-0.03, now.hipY + now.lift * 0.4, 0);
    hips.rotation.set(0, now.twist, -now.lean);
    hips.updateMatrix();
    chest.updateMatrix();
    chestMatrix.multiplyMatrices(hips.matrix, chest.matrix);
    head.rotation.z = now.lean * 0.6;

    // Legs: feet on the board.
    legs.forEach((leg) => {
      hipJoint.set(0, -0.02, leg.side * 0.11).applyMatrix4(hips.matrix);
      footGoal.set(0.02, deckY + 0.06 + now.feet, leg.side * feetZ);
      footGoal.applyEuler(boardHolder.rotation).add(boardHolder.position);
      pole.set(1, 0.1, leg.side * 0.35);
      twoBone(hipJoint, footGoal, THIGH, SHIN, pole, leg.knee, leg.ankle);
      placeLimb(leg.thigh, hipJoint, leg.knee);
      placeLimb(leg.shin, leg.knee, leg.ankle);
      leg.foot.position.copy(leg.ankle);
      leg.foot.position.y -= 0.06;
      leg.foot.rotation.copy(boardHolder.rotation);
    });

    // Arms: out for balance, up in the air, or grabbing the board.
    const swing = Math.sin(pose.time * 2.2) * 0.04;
    arms.forEach((arm, i) => {
      const side = arm.side;
      const goal = handGoal[i];
      if (state === 'air') {
        goal.set(0.15, 1.45, side * 0.62);
      } else if (state === 'grind') {
        goal.set(0.05, 1.18, side * 0.72);
      } else if (state === 'bail') {
        goal.set(0.4, 0.9, side * 0.45);
      } else {
        goal.set(0.12 - side * 0.05, 0.92 + swing * side, side * 0.5 + pose.steer * 0.1);
      }
      if (grab) {
        const boardY = now.lift + deckY + 0.02;
        const front = side > 0;
        const grabs = {
          indy: front ? null : [0.13, boardY, 0.02],
          melon: front ? [-0.13, boardY, 0.08] : null,
          method: front ? [-0.28, boardY + 0.15, 0.05] : null,
          nose: front ? [0, boardY + 0.05, 0.4] : null,
          tail: front ? null : [0, boardY + 0.05, -0.4],
        };
        const reach = grabs[grab];
        if (reach) {
          goal.fromArray(reach);
        } else {
          goal.set(0.1, 1.35, side * 0.7);
        }
      }
      hands[i].lerp(goal, Math.min(1, dt * 14));
      shoulder.set(0, 0.02, side * 0.2).applyMatrix4(chestMatrix);
      pole.set(-0.35, -1, side * 0.6);
      twoBone(shoulder, hands[i], UPPER_ARM, FOREARM, pole, arm.elbow, arm.wrist);
      placeLimb(arm.upper, shoulder, arm.elbow);
      placeLimb(arm.lower, arm.elbow, arm.wrist);
      arm.hand.position.copy(arm.wrist);
      arm.hand.quaternion.copy(arm.lower.quaternion);
    });
  }

  // A point on the board (meters along it) in world space, for sparks and spray.
  const boardPoint = new THREE.Vector3();
  function boardWorld(z, y = 0) {
    boardPoint.set(0, y, z);
    boardSpin.updateWorldMatrix(true, false);
    return boardPoint.applyMatrix4(boardSpin.matrixWorld);
  }

  update(0, { state: 'ride', steer: 0, spin: 0, flip: null, grab: null, side: false, land: 0, bail: 0, time: 0 });

  return {
    group,
    update,
    boardWorld,
    length: board === 'snow' ? 1.45 : 0.82,
    dispose() {
      group.traverse((object) => {
        object.geometry?.dispose();
        [object.material].flat().forEach((material) => material?.dispose());
      });
      owned.forEach((texture) => texture.dispose());
    },
  };
}
