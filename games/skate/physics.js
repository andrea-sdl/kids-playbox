// Riding down the hill: rolling on the ground and up the ramps, flying,
// grinding rails and falling over. No Three.js here, so it can be tested.
// Distances are in meters, speeds in meters per second.
//
// On the ground the rider has a speed along the surface and a heading
// (0 is straight down the hill, toward +z). The hill does the pushing: the
// steeper it is, the faster it goes, until the wind holds it back. Carving
// left and right slows down. When the ground drops away faster than the
// rider falls, or the rider jumps, they fly until they land again.

export const GRAVITY = 16;
// The speed the rider sets off at, and never drops far below.
export const START_SPEED = 11;
const PUSH = 9;
export const MAX_SPEED = 36;
// Wind: grows with the square of the speed. On the average slope this
// settles near 24 m/s (about 85 km/h), and faster on the steep parts.
const DRAG = 0.008;
// How much a hard turn slows the ride.
const CARVE = 0.22;
export const OLLIE = 6.8;
// Ledges taller than this are walls.
export const STEP = 0.35;
const TURN = 2.5;
// How strongly the slope pulls the nose back downhill, and how strongly
// the rider follows the bends of the strip without steering.
const FALL_LINE = 0.5;
const FOLLOW = 2.2;
// The rider can't turn back up the hill.
export const MAX_HEADING = 1.05;
const AIR_SPIN = 7;
// After rolling off an edge there's still a moment to jump.
const COYOTE = 0.18;
// How close to a rail counts as landing on it: generous, for small hands.
const GRIND_REACH = 0.9;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function createRider(hill) {
  const rider = {
    x: 0, y: 0, z: 0, heading: 0, speed: 0,
    vx: 0, vy: 0, vz: 0,
    mode: 'ground',
    air: null,
    grind: null,
    bail: 0,
    slope: 0,
    onEdge: false,
  };
  placeAtStart(rider, hill);
  return rider;
}

export function placeAtStart(rider, hill) {
  Object.assign(rider, {
    x: hill.start.x,
    z: hill.start.z,
    y: hill.height(hill.start.x, hill.start.z),
    heading: hill.start.heading,
    speed: 0,
    vx: 0, vy: 0, vz: 0,
    mode: 'ground',
    air: null,
    grind: null,
    bail: 0,
  });
}

function forward(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

function takeOff(rider, events, kind, vy) {
  const f = forward(rider.heading);
  const horizontal = rider.speed * Math.cos(Math.atan(rider.slope));
  rider.vx = f.x * horizontal;
  rider.vz = f.z * horizontal;
  rider.vy = vy;
  rider.mode = 'air';
  rider.air = { time: 0, spin: 0, jumped: kind === 'ollie', coyote: kind === 'launch' ? COYOTE : 0, from: kind };
  events.push({ type: kind });
}

// Keeps the rider on the strip. Returns which edge it bumped: 1 for the
// +x edge, -1 for the other, 0 for none.
function keepOnStrip(rider, hill) {
  const { min, max } = hill.edges(rider.z);
  if (rider.x >= min && rider.x <= max) {
    return 0;
  }
  const side = rider.x > max ? 1 : -1;
  rider.x = clamp(rider.x, min, max);
  rider.vx = -rider.vx * 0.5;
  return side;
}

// Hit something head-on: stop there and let the game make it a fall.
function crash(rider, events) {
  rider.speed *= 0.4;
  rider.vx = 0;
  rider.vy = 0;
  rider.vz = 0;
  rider.mode = 'ground';
  rider.air = null;
  events.push({ type: 'crash' });
}

/* ---------- On the ground ---------- */

function rideGround(rider, input, dt, hill, events) {
  const { gx, gz } = hill.surface(rider.x, rider.z);
  let f = forward(rider.heading);
  const rightX = -f.z;
  const rightZ = f.x;
  const downhillRight = -(gx * rightX + gz * rightZ);
  const grip = Math.min(1, rider.speed / 3);
  rider.heading -= (input.steer * TURN * grip + downhillRight * FALL_LINE) * dt;
  if (input.steer === 0) {
    rider.heading += (hill.direction(rider.z) - rider.heading) * Math.min(1, FOLLOW * dt);
  }
  rider.heading = clamp(rider.heading, -MAX_HEADING, MAX_HEADING);
  f = forward(rider.heading);

  const m = gx * f.x + gz * f.z;
  rider.slope = m;
  const cos = 1 / Math.sqrt(1 + m * m);
  const sin = m * cos;
  rider.speed -= GRAVITY * sin * dt;
  rider.speed -= (DRAG * rider.speed + CARVE * Math.abs(input.steer)) * rider.speed * dt;
  if (rider.speed < START_SPEED) {
    rider.speed = Math.min(START_SPEED, rider.speed + PUSH * dt);
  }
  rider.speed = Math.min(MAX_SPEED, rider.speed);

  const step = rider.speed * cos * dt;
  const nx = rider.x + f.x * step;
  const nz = rider.z + f.z * step;
  let hn = hill.height(nx, nz);
  if (hn - rider.y > STEP) {
    crash(rider, events);
    return;
  }
  const expected = rider.y + rider.speed * sin * dt;
  rider.x = nx;
  rider.z = nz;
  const side = keepOnStrip(rider, hill);
  if (side !== 0) {
    // Slide along the edge, nose a little back toward the middle.
    rider.heading = hill.direction(rider.z) - side * 0.12;
    hn = hill.height(rider.x, rider.z);
    if (!rider.onEdge) {
      rider.speed *= 0.8;
      events.push({ type: 'bump' });
    }
  }
  rider.onEdge = side !== 0;

  // The ground fell away: fly.
  if (hn < expected - 0.06) {
    rider.y = expected;
    takeOff(rider, events, 'launch', rider.speed * sin);
    return;
  }
  rider.y = hn;

  if (input.jump) {
    takeOff(rider, events, 'ollie', rider.speed * sin + OLLIE);
  }
}

/* ---------- In the air ---------- */

function findRail(rider, hill, nx, ny, nz) {
  if (rider.vy > 1) {
    return null;
  }
  let best = null;
  for (const rail of hill.railsAt(nz)) {
    const ex = rail.bx - rail.ax;
    const ez = rail.bz - rail.az;
    const t = ((nx - rail.ax) * ex + (nz - rail.az) * ez) / (rail.flat * rail.flat);
    if (t < 0.03 || t > 0.97) {
      continue;
    }
    const cx = rail.ax + ex * t;
    const cz = rail.az + ez * t;
    const distance = Math.hypot(nx - cx, nz - cz);
    if (distance > GRIND_REACH) {
      continue;
    }
    const ry = rail.ay + (rail.by - rail.ay) * t;
    // Coming down onto it from above.
    if (ny > ry + 0.5 || ny < ry - 0.35 || rider.y < ry - 0.2) {
      continue;
    }
    const speed = Math.hypot(rider.vx, rider.vz);
    let align = 1;
    if (speed > 0.5) {
      align = (rider.vx * rail.dx + rider.vz * rail.dz) / (speed * Math.hypot(rail.dx, rail.dz));
    }
    if (Math.abs(align) < 0.25) {
      continue;
    }
    if (!best || distance < best.distance) {
      best = { rail, t, distance, align, speed };
    }
  }
  return best;
}

function fly(rider, input, dt, hill, events) {
  const air = rider.air;
  air.time += dt;
  air.coyote = Math.max(0, air.coyote - dt);
  // Rolled off an edge and jumped straight after: still an ollie.
  if (input.jump && air.coyote > 0 && !air.jumped) {
    air.jumped = true;
    rider.vy = Math.max(rider.vy, 0) + OLLIE;
    air.from = 'ollie';
    events.push({ type: 'ollie' });
  }
  air.spin -= input.steer * AIR_SPIN * dt;
  rider.vy -= GRAVITY * dt;
  const nx = rider.x + rider.vx * dt;
  const ny = rider.y + rider.vy * dt;
  const nz = rider.z + rider.vz * dt;

  const hit = findRail(rider, hill, nx, ny, nz);
  if (hit) {
    const { rail, t, align, speed } = hit;
    const direction = Math.sign(align) || 1;
    rider.mode = 'grind';
    rider.grind = { rail, t, direction, side: Math.abs(align) < 0.8 };
    rider.speed = Math.max(5, speed * Math.abs(align) + 1.5);
    rider.x = rail.ax + (rail.bx - rail.ax) * t;
    rider.y = rail.ay + (rail.by - rail.ay) * t;
    rider.z = rail.az + (rail.bz - rail.az) * t;
    rider.heading = Math.atan2(rail.dx * direction, rail.dz * direction);
    events.push({ type: 'grind', side: rider.grind.side, kind: rail.kind, airTime: air.time, spin: air.spin, from: air.from });
    rider.air = null;
    return;
  }

  const ground = hill.height(nx, nz);
  if (ny <= ground && ground - rider.y > STEP && ground - ny > STEP) {
    // Flew into the side of something.
    rider.y = hill.height(rider.x, rider.z);
    rider.speed = Math.hypot(rider.vx, rider.vz);
    crash(rider, events);
    return;
  }

  rider.x = nx;
  rider.y = ny;
  rider.z = nz;
  if (keepOnStrip(rider, hill) !== 0) {
    events.push({ type: 'bump' });
  }
  const below = hill.height(rider.x, rider.z);
  if (rider.y > below) {
    return;
  }

  // Landed.
  rider.y = below;
  const horizontal = Math.hypot(rider.vx, rider.vz);
  if (horizontal > 0.5) {
    rider.heading = clamp(Math.atan2(rider.vx, rider.vz), -MAX_HEADING, MAX_HEADING);
  }
  const { gx, gz } = hill.surface(rider.x, rider.z);
  const f = forward(rider.heading);
  const m = gx * f.x + gz * f.z;
  // Landing on a downhill keeps some of the fall as speed.
  const extra = m < 0 ? -rider.vy * (-m / Math.sqrt(1 + m * m)) : 0;
  rider.speed = Math.min(MAX_SPEED, horizontal + extra);
  rider.mode = 'ground';
  events.push({ type: 'land', airTime: air.time, spin: air.spin, from: air.from, fall: -rider.vy });
  rider.vy = 0;
  rider.air = null;
}

/* ---------- On a rail ---------- */

function leaveRail(rider, events, extraUp) {
  const { rail, direction } = rider.grind;
  rider.vx = rail.dx * direction * rider.speed;
  rider.vz = rail.dz * direction * rider.speed;
  rider.vy = rail.dy * direction * rider.speed + extraUp;
  rider.mode = 'air';
  rider.air = { time: 0, spin: 0, jumped: extraUp > 2, coyote: extraUp > 2 ? 0 : COYOTE, from: 'grind' };
  rider.grind = null;
  events.push({ type: 'grindEnd' });
}

function grind(rider, input, dt, events) {
  const g = rider.grind;
  const { rail } = g;
  rider.speed -= GRAVITY * rail.dy * g.direction * dt * 0.8 + 0.4 * dt;
  g.t += (g.direction * rider.speed * dt) / rail.length;
  rider.x = rail.ax + (rail.bx - rail.ax) * g.t;
  rider.y = rail.ay + (rail.by - rail.ay) * g.t;
  rider.z = rail.az + (rail.bz - rail.az) * g.t;
  if (input.jump) {
    leaveRail(rider, events, OLLIE);
    events.push({ type: 'ollie' });
    return;
  }
  if (g.t < 0 || g.t > 1 || rider.speed < 1.5) {
    rider.speed = Math.max(rider.speed, 2);
    leaveRail(rider, events, 1.2);
  }
}

/* ---------- Falling over ---------- */

export const BAIL_SECONDS = 1.5;

export function startBail(rider) {
  rider.mode = 'bail';
  rider.bail = BAIL_SECONDS;
  rider.air = null;
  rider.grind = null;
}

// Tumbling on down the hill, over whatever is in the way.
function slide(rider, dt, hill, events) {
  rider.bail -= dt;
  rider.speed = Math.max(3, rider.speed * Math.exp(-dt * 2.5));
  rider.heading *= Math.exp(-dt * 4);
  const f = forward(rider.heading);
  rider.x += f.x * rider.speed * dt;
  rider.z += f.z * rider.speed * dt;
  keepOnStrip(rider, hill);
  rider.y = hill.height(rider.x, rider.z);
  if (rider.bail <= 0) {
    rider.mode = 'ground';
    events.push({ type: 'recover' });
  }
}

// One step of riding. Returns what happened (jumps, landings, grinds) so
// the game can score tricks and play sounds.
export function stepRider(rider, input, dt, hill) {
  const events = [];
  if (rider.mode === 'ground') {
    rideGround(rider, input, dt, hill, events);
  } else if (rider.mode === 'air') {
    fly(rider, input, dt, hill, events);
  } else if (rider.mode === 'grind') {
    grind(rider, input, dt, events);
  } else if (rider.mode === 'bail') {
    slide(rider, dt, hill, events);
  }
  return events;
}
