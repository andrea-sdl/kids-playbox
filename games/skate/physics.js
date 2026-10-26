// Riding: rolling on the ground and up the ramps, flying, grinding rails and
// falling over. No Three.js here, so it can be tested. Distances are in
// meters, speeds in meters per second.
//
// On the ground the rider has a speed along the surface and a heading. The
// board rolls on its own (no pushing needed); hills slow it down or speed it
// up. When the ground drops away faster than the rider falls, or the rider
// jumps, they fly until they land again.

import { VERT_D } from './world.js';

export const GRAVITY = 16;
export const CRUISE = 11;
const PUSH = 7;
export const MAX_SPEED = 20;
export const OLLIE = 6.8;
// The smallest pop when flying out of a quarter pipe.
const VERT_POP = 9;
// Ledges taller than this are walls.
export const STEP = 0.35;
const TURN = 2.5;
const AIR_SPIN = 7;
// After rolling off an edge there's still a moment to jump.
const COYOTE = 0.18;
const GRIND_REACH = 0.6;

function wrap(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function createRider(park) {
  const rider = {
    x: 0, y: 0, z: 0, heading: 0, speed: 0,
    vx: 0, vy: 0, vz: 0,
    mode: 'ground',
    air: null,
    grind: null,
    bail: 0,
    slope: 0,
    normal: { x: 0, y: 1, z: 0 },
  };
  placeAtStart(rider, park);
  return rider;
}

export function placeAtStart(rider, park) {
  Object.assign(rider, {
    x: park.start.x,
    z: park.start.z,
    y: park.height(park.start.x, park.start.z),
    heading: park.start.heading,
    speed: 0,
    vx: 0, vy: 0, vz: 0,
    mode: 'ground',
    air: null,
    grind: null,
    bail: 0,
  });
}

export function slopeAt(park, x, z) {
  const { gx, gz } = park.surface(x, z);
  return { gx, gz };
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
  rider.air = { time: 0, spin: 0, vert: null, jumped: kind === 'ollie', coyote: kind === 'launch' ? COYOTE : 0, from: kind };
  events.push({ type: kind });
}

// Keeps the rider inside the park. Returns true when it bumped.
function clampToBounds(rider, park) {
  const { minX, maxX, minZ, maxZ } = park.bounds;
  let bumped = false;
  if (rider.x < minX || rider.x > maxX) {
    rider.x = Math.min(maxX, Math.max(minX, rider.x));
    rider.vx = -rider.vx * 0.5;
    bumped = 'x';
  }
  if (rider.z < minZ || rider.z > maxZ) {
    rider.z = Math.min(maxZ, Math.max(minZ, rider.z));
    rider.vz = -rider.vz * 0.5;
    bumped = bumped ? 'xz' : 'z';
  }
  return bumped;
}

function bounceHeading(rider, axis) {
  const f = forward(rider.heading);
  if (axis.includes('x')) {
    f.x = -f.x;
  }
  if (axis.includes('z')) {
    f.z = -f.z;
  }
  rider.heading = Math.atan2(f.x, f.z);
}

/* ---------- On the ground ---------- */

function rideGround(rider, input, dt, park, events) {
  const { gx, gz } = slopeAt(park, rider.x, rider.z);
  let f = forward(rider.heading);
  // Downhill pulls the nose around on the walls of a quarter pipe.
  const rightX = -f.z;
  const rightZ = f.x;
  const downhillRight = -(gx * rightX + gz * rightZ);
  const grip = Math.min(1, rider.speed / 3);
  rider.heading -= (input.steer * TURN * grip + downhillRight * 0.9) * dt;
  f = forward(rider.heading);

  const m = gx * f.x + gz * f.z;
  rider.slope = m;
  const cos = 1 / Math.sqrt(1 + m * m);
  const sin = m * cos;
  rider.speed -= GRAVITY * sin * dt;
  if (Math.abs(m) < 0.15) {
    if (rider.speed < CRUISE) {
      rider.speed = Math.min(CRUISE, rider.speed + PUSH * dt);
    } else {
      rider.speed -= (rider.speed - CRUISE) * 0.5 * dt;
    }
  }
  rider.speed = Math.min(MAX_SPEED, rider.speed);
  // Rolled back down a wall: turn around and keep going.
  if (rider.speed < 0) {
    rider.heading = wrap(rider.heading + Math.PI);
    rider.speed = -rider.speed;
    events.push({ type: 'turnAround' });
    return;
  }

  const step = rider.speed * cos * dt;
  let nx = rider.x + f.x * step;
  let nz = rider.z + f.z * step;
  let hn = park.height(nx, nz);
  if (hn - rider.y > STEP) {
    // A wall: slide along it if one direction is free, else turn back.
    const hx = park.height(nx, rider.z);
    const hz = park.height(rider.x, nz);
    if (hx - rider.y <= STEP) {
      nz = rider.z;
      hn = hx;
      bounceHeading(rider, 'z');
    } else if (hz - rider.y <= STEP) {
      nx = rider.x;
      hn = hz;
      bounceHeading(rider, 'x');
    } else {
      rider.heading = wrap(rider.heading + Math.PI);
      nx = rider.x;
      nz = rider.z;
      hn = rider.y;
    }
    rider.speed *= 0.5;
    events.push({ type: 'bump' });
  }
  const expected = rider.y + rider.speed * sin * dt;
  rider.x = nx;
  rider.z = nz;
  const bumped = clampToBounds(rider, park);
  if (bumped) {
    bounceHeading(rider, bumped);
    rider.speed *= 0.6;
    hn = park.height(rider.x, rider.z);
    events.push({ type: 'bump' });
  }

  // The ground fell away: fly.
  if (hn < expected - 0.06) {
    rider.y = expected;
    takeOff(rider, events, 'launch', rider.speed * sin);
    return;
  }
  rider.y = hn;

  // High up a quarter pipe and still going up it: fly straight up, and
  // come back down facing the other way.
  const pipe = park.quarterPipeAt(rider.x, rider.z);
  if (pipe && pipe.d > VERT_D && f.x * pipe.nx + f.z * pipe.nz > 0.15) {
    const horizontal = rider.speed * cos;
    const out = horizontal * (f.x * pipe.nx + f.z * pipe.nz);
    const tx = f.x * horizontal - pipe.nx * out;
    const tz = f.z * horizontal - pipe.nz * out;
    const along = Math.hypot(tx, tz);
    const up = Math.max(VERT_POP, Math.sqrt(Math.max(0, rider.speed ** 2 - along ** 2)));
    const facing = { x: f.x - 2 * (f.x * pipe.nx + f.z * pipe.nz) * pipe.nx, z: f.z - 2 * (f.x * pipe.nx + f.z * pipe.nz) * pipe.nz };
    rider.mode = 'air';
    rider.vx = tx;
    rider.vz = tz;
    rider.vy = up;
    rider.air = {
      time: 0, spin: 0, jumped: false, coyote: 0, from: 'vert',
      vert: { from: rider.heading, to: Math.atan2(facing.x, facing.z) },
    };
    events.push({ type: 'vert' });
    return;
  }

  if (input.jump) {
    takeOff(rider, events, 'ollie', rider.speed * sin + OLLIE);
  }
}

/* ---------- In the air ---------- */

function findRail(rider, park, nx, ny, nz) {
  if (rider.vy > 1) {
    return null;
  }
  let best = null;
  for (const rail of park.rails) {
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

function fly(rider, input, dt, park, events) {
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
  if (!air.vert) {
    air.spin -= input.steer * AIR_SPIN * dt;
  }
  rider.vy -= GRAVITY * dt;
  const nx = rider.x + rider.vx * dt;
  const ny = rider.y + rider.vy * dt;
  const nz = rider.z + rider.vz * dt;

  const hit = findRail(rider, park, nx, ny, nz);
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

  const ground = park.height(nx, nz);
  if (ny <= ground && ground - rider.y > STEP && ground - ny > STEP) {
    // Flew into the side of something: bounce off, keep falling.
    const hx = park.height(nx, rider.z);
    if (hx - rider.y > STEP) {
      rider.vx = -rider.vx * 0.4;
    }
    const hz = park.height(rider.x, nz);
    if (hz - rider.y > STEP) {
      rider.vz = -rider.vz * 0.4;
    }
    rider.y = ny;
    events.push({ type: 'bump' });
    return;
  }

  rider.x = nx;
  rider.y = ny;
  rider.z = nz;
  if (clampToBounds(rider, park)) {
    events.push({ type: 'bump' });
  }
  const below = park.height(rider.x, rider.z);
  if (rider.y > below) {
    return;
  }

  // Landed.
  rider.y = below;
  const horizontal = Math.hypot(rider.vx, rider.vz);
  if (air.vert) {
    rider.heading = air.vert.to;
    rider.speed = Math.min(MAX_SPEED, Math.hypot(horizontal, rider.vy) * 0.9);
  } else {
    if (horizontal > 0.5) {
      rider.heading = Math.atan2(rider.vx, rider.vz);
    }
    const { gx, gz } = slopeAt(park, rider.x, rider.z);
    const f = forward(rider.heading);
    const m = gx * f.x + gz * f.z;
    // Landing on a downhill keeps some of the fall as speed.
    const extra = m < 0 ? -rider.vy * (-m / Math.sqrt(1 + m * m)) : 0;
    rider.speed = Math.min(MAX_SPEED, horizontal + extra);
  }
  rider.mode = 'ground';
  events.push({ type: 'land', airTime: air.time, spin: air.spin, vert: Boolean(air.vert), from: air.from, fall: -rider.vy });
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
  rider.air = { time: 0, spin: 0, vert: null, jumped: extraUp > 2, coyote: extraUp > 2 ? 0 : COYOTE, from: 'grind' };
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

function slide(rider, dt, park, events) {
  rider.bail -= dt;
  rider.speed *= Math.exp(-dt * 2.5);
  const f = forward(rider.heading);
  const nx = rider.x + f.x * rider.speed * dt;
  const nz = rider.z + f.z * rider.speed * dt;
  const hn = park.height(nx, nz);
  if (Math.abs(hn - rider.y) <= STEP) {
    rider.x = nx;
    rider.z = nz;
  } else {
    rider.speed = 0;
  }
  clampToBounds(rider, park);
  const below = park.height(rider.x, rider.z);
  // Slide down the walls of a quarter pipe.
  rider.y = below;
  const { gx, gz } = slopeAt(park, rider.x, rider.z);
  if (Math.hypot(gx, gz) > 0.3) {
    rider.heading = Math.atan2(-gx, -gz);
    rider.speed = Math.max(rider.speed, 3);
  }
  if (rider.bail <= 0) {
    rider.mode = 'ground';
    rider.speed = 1;
    events.push({ type: 'recover' });
  }
}

// One step of riding. Returns what happened (jumps, landings, grinds) so
// the game can score tricks and play sounds.
export function stepRider(rider, input, dt, park) {
  const events = [];
  if (rider.mode === 'ground') {
    rideGround(rider, input, dt, park, events);
  } else if (rider.mode === 'air') {
    fly(rider, input, dt, park, events);
  } else if (rider.mode === 'grind') {
    grind(rider, input, dt, events);
  } else if (rider.mode === 'bail') {
    slide(rider, dt, park, events);
  }
  return events;
}
