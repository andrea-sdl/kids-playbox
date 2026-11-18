// The first pair is the painted point of interest. The robot approaches
// along the walkable floor below it. Coordinates are fractions of the plate.
export const places = {
  meadow: {
    points: {
      coin1: [0.18, 0.78],
      coin2: [0.48, 0.7],
      coin3: [0.7, 0.84],
      map: [0.85, 0.74],
      pods: [0.33, 0.7],
    },
  },
  grove: {
    points: {
      tree: [0.24, 0.45],
      owl: [0.122, 0.33],
      bell: [0.369, 0.289],
      ship: [0.71, 0.68],
    },
  },
  house: {
    points: {
      letter: [0.31, 0.72],
      quilt: [0.58, 0.69],
      song: [0.84, 0.79],
    },
  },
  hearth: { points: { fox: [0.36, 0.62], tea: [0.85, 0.65] } },
  marsh: {
    points: {
      boat: [0.36, 0.73],
      signal: [0.61, 0.28],
      float: [0.78, 0.68],
      carp: [0.49, 0.714],
    },
  },
  observatory: {
    points: {
      scope: [0.29, 0.4],
      stars: [0.46, 0.39],
      moth: [0.78, 0.67],
    },
  },
  falls: {
    points: { stairs: [0.32, 0.73], passage: [0.565, 0.58] },
  },
};
// Saved positions are local to each area. The road pitch maps both sides
// of every boundary onto the same point in the continuous world.
export const road = [
  'meadow',
  'ridge',
  'roots',
  'grove',
  'orchard',
  'house',
  'causeway',
  'marsh',
  'viaduct',
  'observatory',
  'gorge',
  'falls',
];
export const pitch = 0.88;
export const memoryLength = 3.7;
for (const room of road) {
  if (!places[room]) places[room] = { points: {} };
}
export const doors = {
  house: { x: 0.685, y: 0.73, to: 'hearth', arrivesAt: 0.18 },
  hearth: { x: 0.16, y: 0.73, to: 'house', arrivesAt: 0.685 },
};

export function roadPosition(room, x) {
  const index = road.indexOf(room);
  if (index < 0) return { room, x: clamp(x, 0.035, 0.965) };
  const distance = clamp(index * pitch + x, 0.035, (road.length - 1) * pitch + 0.965);
  const next = clamp(Math.floor((distance - (1 - pitch) / 2) / pitch), 0, road.length - 1);
  return { room: road[next], x: distance - next * pitch };
}

export function neighboringPaintings(room) {
  const index = road.indexOf(room);
  if (index < 0) return [{ room, offset: 0 }];
  return road.slice(Math.max(0, index - 1), index + 2).map((name) => ({
    room: name,
    offset: (road.indexOf(name) - index) * pitch,
  }));
}

export const memories = Object.values(places)
  .flatMap((place) => Object.keys(place.points))
  .filter((id) => id !== 'passage');
export const isCoin = (id) => /^coin[1-3]$/.test(id);
export const stories = memories.filter((id) => !isCoin(id) && !['map', 'tree', 'ship'].includes(id));
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function restore(raw) {
  const saved = raw && typeof raw === 'object' ? raw : {};
  const found = new Set(memories.filter((id) => Array.isArray(saved.found) && saved.found.includes(id)));
  return {
    journeyId: typeof saved.journeyId === 'string' ? saved.journeyId : '',
    room: typeof saved.room === 'string' && Object.hasOwn(places, saved.room) ? saved.room : 'meadow',
    x: Number.isFinite(saved.x) ? clamp(saved.x, 0.04, 0.96) : 0.55,
    y: Number.isFinite(saved.y) ? clamp(saved.y, 0.72, 0.91) : 0.84,
    found,
    shipStep: found.has('ship') ? 2 : [1, 2].includes(saved.shipStep) ? saved.shipStep : 0,
    finished: found.size === memories.length && saved.finished === true,
    started: saved.started === true,
  };
}
