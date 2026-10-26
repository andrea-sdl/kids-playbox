// Tricks and combos, Tony Hawk style. Every trick done without touching the
// ground in between adds to one combo; the combo's points are the sum of
// its tricks times how many there were. Landing in the middle of a flip is
// a fall (a bail), and the combo is lost. No Three.js here, so it can be
// tested.
//
// Trick names stay in English in every language, like at real skateparks.

// Flips: one press each, in order. `time` is how long one takes (seconds).
export const FLIPS = {
  skate: [
    { name: 'Kickflip', points: 100, time: 0.42, move: 'kickflip' },
    { name: 'Heelflip', points: 100, time: 0.42, move: 'heelflip' },
    { name: 'Pop Shove-it', points: 100, time: 0.38, move: 'shove' },
    { name: 'Varial Kickflip', points: 200, time: 0.5, move: 'varial' },
    { name: '360 Flip', points: 250, time: 0.55, move: 'treflip' },
    { name: 'Impossible', points: 250, time: 0.5, move: 'impossible' },
  ],
  snow: [
    { name: 'Backflip', points: 300, time: 0.75, move: 'backflip' },
    { name: 'Frontflip', points: 300, time: 0.75, move: 'frontflip' },
    { name: 'Rodeo', points: 400, time: 0.8, move: 'rodeo' },
    { name: 'Misty', points: 400, time: 0.8, move: 'misty' },
    { name: 'Wildcat', points: 350, time: 0.75, move: 'wildcat' },
  ],
};

// Grabs: held for as long as the button is held, earning more meanwhile.
export const GRABS = {
  skate: [
    { name: 'Indy', points: 100, move: 'indy' },
    { name: 'Melon', points: 100, move: 'melon' },
    { name: 'Method', points: 150, move: 'method' },
    { name: 'Nose Grab', points: 100, move: 'nose' },
    { name: 'Tail Grab', points: 100, move: 'tail' },
  ],
  snow: [
    { name: 'Indy', points: 100, move: 'indy' },
    { name: 'Mute', points: 100, move: 'melon' },
    { name: 'Method', points: 150, move: 'method' },
    { name: 'Nose Grab', points: 100, move: 'nose' },
    { name: 'Tail Grab', points: 100, move: 'tail' },
  ],
};

export const GRAB_PER_SECOND = 200;
export const GRIND_POINTS = 100;
export const GRIND_PER_SECOND = 250;
// Grounded this long and the combo is banked.
export const COMBO_GRACE = 0.6;
// Landing before a flip is this far done is a fall.
export const SAFE_LANDING = 0.8;

export function grindName(side) {
  return side ? 'Boardslide' : '50-50 Grind';
}

// Spins come in half turns: 180, 360, 540…
export function spinHalfTurns(spin) {
  return Math.round(Math.abs(spin) / Math.PI);
}

const SPIN_POINTS = [0, 100, 200, 400, 700, 1000, 1500];

export function spinPoints(halfTurns) {
  return SPIN_POINTS[Math.min(halfTurns, SPIN_POINTS.length - 1)] + Math.max(0, halfTurns - SPIN_POINTS.length + 1) * 500;
}

// How happy the game sounds about a combo.
export function praise(points) {
  if (points >= 10000) {
    return 'insane';
  }
  if (points >= 4000) {
    return 'sick';
  }
  if (points >= 1500) {
    return 'sweet';
  }
  if (points >= 400) {
    return 'nice';
  }
  return null;
}

export function createTricks(board) {
  const flips = FLIPS[board];
  const grabs = GRABS[board];
  let nextFlip = 0;
  let nextGrab = 0;
  // The combo: [{ name, points }].
  let combo = [];
  let grounded = 0;
  let flip = null;
  let grab = null;
  let grinding = null;
  let airTricks = 0;

  function add(name, points) {
    combo.push({ name, points: Math.round(points) });
  }

  function total() {
    return Math.round(combo.reduce((sum, trick) => sum + trick.points, 0)) * combo.length;
  }

  return {
    get combo() {
      return combo;
    },
    get multiplier() {
      return combo.length;
    },
    get total() {
      return total();
    },
    // What the rider is doing, for the animation.
    get flip() {
      if (!flip) {
        return null;
      }
      return { move: flip.trick.move, progress: Math.min(1, flip.time / flip.trick.time) };
    },
    get grab() {
      return grab?.trick.move || null;
    },

    takeOff() {
      airTricks = 0;
      grounded = 0;
      flip = null;
      grab = null;
    },

    // Flip button: starts the next flip, unless one is going or grabbing.
    pressFlip() {
      if (flip || grab) {
        return null;
      }
      const trick = flips[nextFlip % flips.length];
      nextFlip += 1;
      flip = { trick, time: 0 };
      add(trick.name, trick.points);
      airTricks += 1;
      return trick;
    },

    // Grab button held (true) or let go (false).
    setGrab(held) {
      if (!held) {
        grab = null;
        return null;
      }
      if (grab || flip) {
        return null;
      }
      const trick = grabs[nextGrab % grabs.length];
      nextGrab += 1;
      grab = { trick, entry: combo.length };
      add(trick.name, trick.points);
      airTricks += 1;
      return trick;
    },

    startGrind(side, spin) {
      const turns = spinHalfTurns(spin);
      if (turns > 0) {
        add(String(turns * 180), spinPoints(turns));
      }
      flip = null;
      grab = null;
      grinding = { entry: combo.length };
      add(grindName(side), GRIND_POINTS);
      grounded = 0;
    },

    endGrind() {
      grinding = null;
      airTricks = 0;
    },

    // Time passes. `mode` is the rider's: ground, air, grind or bail.
    update(dt, mode) {
      if (flip) {
        flip.time += dt;
        if (flip.time >= flip.trick.time) {
          flip = null;
        }
      }
      if (grab && mode === 'air') {
        combo[grab.entry].points += GRAB_PER_SECOND * dt;
      }
      if (grinding && mode === 'grind') {
        combo[grinding.entry].points += GRIND_PER_SECOND * dt;
      }
      if (mode === 'ground' && combo.length > 0) {
        grounded += dt;
        if (grounded >= COMBO_GRACE) {
          return this.bank();
        }
      }
      return 0;
    },

    // Touched down. Returns { bail } – true when a flip wasn't finished.
    land({ airTime, spin, from }) {
      grab = null;
      grounded = 0;
      if (flip && flip.time / flip.trick.time < SAFE_LANDING) {
        flip = null;
        combo = [];
        return { bail: true };
      }
      flip = null;
      const turns = spinHalfTurns(spin);
      if (turns > 0) {
        add(String(turns * 180), spinPoints(turns));
        airTricks += 1;
      }
      if (airTricks === 0 && airTime > 0.35 && from !== 'grind') {
        add(from === 'ollie' ? 'Ollie' : 'Air', from === 'ollie' ? 50 : 100);
      }
      if (airTime > 1.25) {
        add('Big Air', 250);
      }
      combo.forEach((trick) => {
        trick.points = Math.round(trick.points);
      });
      return { bail: false };
    },

    // Keeps the combo's points. Returns them.
    bank() {
      const points = total();
      combo = [];
      grounded = 0;
      return points;
    },

    // Fell over: the combo is gone.
    lose() {
      combo = [];
      flip = null;
      grab = null;
      grinding = null;
    },
  };
}
