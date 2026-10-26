// The rider and the board, built from simple rounded shapes so every piece
// of clothing can be swapped and recolored. Arms and legs are placed each
// frame with two-bone IK: the feet stay on the board and the hands reach
// for wherever the pose wants them (out for balance, or grabbing the board).
//
// The board points along +z (the way of travel) and the rider stands
// sideways on it, facing +x, looking ahead over the front shoulder.

import * as THREE from '../../vendor/three/three.min.js';
import { boardTexture } from './textures.js';

const THIGH = 0.44;
const SHIN = 0.44;
const UPPER_ARM = 0.29;
const FOREARM = 0.28;
// Height of the board's top, and how far apart the feet are.
const DECK = { skate: 0.1, snow: 0.045 };
const FEET = { skate: 0.25, snow: 0.29 };

const UP = new THREE.Vector3(0, 1, 0);

function mat(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...options });
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

function buildHead(look, board) {
  const head = new THREE.Group();
  const skin = mat(look.skin, { roughness: 0.6 });
  const face = sphere(0.15, skin);
  face.scale.set(1, 1.06, 1);
  head.add(face);
  const dark = mat('#1a1420', { roughness: 0.3 });
  [-0.052, 0.052].forEach((z) => {
    const eye = sphere(0.022, dark, { segments: 10 });
    eye.position.set(0.135, 0.025, z);
    eye.scale.set(0.6, 1.25, 1);
    head.add(eye);
    const shine = sphere(0.007, mat('#ffffff'), { segments: 6 });
    shine.position.set(0.149, 0.036, z + 0.006);
    head.add(shine);
    const cheek = sphere(0.026, mat('#ff8fa3', { transparent: true, opacity: 0.55 }), { segments: 8 });
    cheek.position.set(0.12, -0.04, z * 1.6);
    cheek.scale.set(0.4, 0.6, 1);
    head.add(cheek);
  });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.05), dark);
  mouth.position.set(0.142, -0.068, 0);
  head.add(mouth);
  const nose = sphere(0.018, skin, { segments: 8 });
  nose.position.set(0.152, -0.015, 0);
  head.add(nose);

  const hair = mat(look.hairColor, { roughness: 0.65 });
  const hatOn = look.hat !== 'none';
  const cap = (radius, cover = 0.52) => {
    const piece = sphere(radius, hair, { to: Math.PI * cover });
    piece.rotation.z = 0.42;
    return piece;
  };
  if (look.hair === 'buzz' || look.hair === 'mohawk') {
    head.add(cap(0.153, 0.5));
  } else {
    head.add(cap(0.163));
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
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.2), mat('#101016', { roughness: 0.15, metalness: 0.4 }));
    shades.position.set(0.14, 0.028, 0);
    head.add(shades);
  }
  if (look.glasses === 'goggles') {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.22), mat('#ff9a2a', { roughness: 0.1, metalness: 0.7 }));
    lens.position.set(0.14, 0.035, 0);
    head.add(lens);
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.166, 0.166, 0.035, 22, 1, true), mat('#2a2a33'));
    strap.position.y = 0.035;
    head.add(strap);
  }
  [-1, 1].forEach((side) => {
    const ear = sphere(0.032, skin, { segments: 8 });
    ear.position.set(0, -0.005, side * 0.148);
    ear.scale.set(0.8, 1, 0.5);
    head.add(ear);
  });
  return head;
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

  const skin = mat(look.skin, { roughness: 0.6 });
  const top = mat(look.topColor, { roughness: 0.8 });
  const bottom = mat(look.bottomColor, { roughness: 0.85 });
  const shoe = mat(look.shoes, { roughness: 0.6 });
  const sole = mat('#f4f4f0', { roughness: 0.7 });
  const glove = board === 'snow' ? mat('#2a2a33', { roughness: 0.8 }) : skin;

  const hips = new THREE.Object3D();
  body.add(hips);
  const torso = limb(0.17, 0.3, top);
  torso.position.y = 0.27;
  torso.scale.set(0.78, 1, 1);
  hips.add(torso);
  const pelvis = limb(0.12, 0.12, bottom);
  pelvis.rotation.x = Math.PI / 2;
  pelvis.scale.set(0.85, 1, 1);
  pelvis.position.y = 0.02;
  hips.add(pelvis);
  if (look.top === 'hoodie') {
    const hood = sphere(0.13, top, { to: Math.PI * 0.6 });
    hood.position.set(-0.11, 0.52, 0);
    hood.rotation.z = 1.3;
    hips.add(hood);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.18), mat(new THREE.Color(look.topColor).multiplyScalar(0.8)));
    pocket.position.set(0.13, 0.18, 0);
    hips.add(pocket);
  }
  if (look.top === 'jacket') {
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.42, 0.025), mat('#f2f2f2', { roughness: 0.4 }));
    zip.position.set(0.135, 0.28, 0);
    hips.add(zip);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.07, 14, 1, true), top);
    collar.position.y = 0.52;
    hips.add(collar);
  }
  if (look.top === 'tee') {
    const print = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), mat(new THREE.Color(look.topColor).offsetHSL(0.5, 0, 0)));
    print.position.set(0.134, 0.3, 0);
    print.rotation.y = Math.PI / 2;
    hips.add(print);
  }
  const chest = new THREE.Object3D();
  chest.position.y = 0.48;
  hips.add(chest);
  const neck = limb(0.05, 0.06, skin);
  neck.position.y = 0.07;
  chest.add(neck);
  const head = buildHead(look, board);
  head.position.y = 0.22;
  head.rotation.y = -1.05;
  chest.add(head);

  const legRadius = { shorts: [0.072, 0.05], pants: [0.068, 0.058], baggy: [0.088, 0.08] }[look.bottom];
  const legs = [-1, 1].map((side) => {
    const thigh = limb(legRadius[0], THIGH - 0.06, bottom);
    const shin = limb(legRadius[1], SHIN - 0.06, look.bottom === 'shorts' ? skin : bottom);
    const foot = new THREE.Group();
    const upper = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.07, 0.105), shoe));
    upper.position.y = 0.045;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.025, 0.11), sole);
    base.position.y = 0.012;
    foot.add(upper, base);
    body.add(thigh, shin, foot);
    let cuff = null;
    if (look.bottom === 'shorts') {
      cuff = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.06, 12), mat('#f4f4f0')));
      body.add(cuff);
    }
    return { side, thigh, shin, foot, cuff, knee: new THREE.Vector3(), ankle: new THREE.Vector3() };
  });
  const sleeve = look.top === 'tee';
  const arms = [-1, 1].map((side) => {
    const upper = limb(sleeve ? 0.058 : 0.055, UPPER_ARM - 0.05, top);
    const lower = limb(sleeve ? 0.042 : 0.05, FOREARM - 0.05, sleeve ? skin : top);
    const hand = sphere(0.048, glove, { segments: 10 });
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
      if (leg.cuff) {
        leg.cuff.position.copy(hipJoint).lerp(leg.knee, 0.72);
        leg.cuff.quaternion.copy(leg.thigh.quaternion);
      }
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
