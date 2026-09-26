// Pure building logic: which cells each block fills, whether a block fits,
// and saving/loading. No DOM or 3D here, so it can be tested with Node.
//
// The world is a grid of cells. x and z run along the ground (0..GRID-1),
// y goes up (0..MAX_HEIGHT-1). A block's position is its lowest corner cell.

export const GRID = 24;
export const MAX_HEIGHT = 20;
export const MAX_BLOCKS = 3000;

// size: [width along x, height, depth along z] in cells.
export const SHAPES = [
  { id: 'brick', size: [1, 1, 1], studs: true },
  { id: 'long', size: [2, 1, 1], studs: true },
  { id: 'square', size: [2, 1, 2], studs: true },
  { id: 'plank', size: [4, 1, 1], studs: true },
  { id: 'ramp', size: [1, 1, 1], studs: false },
  { id: 'round', size: [1, 1, 1], studs: true },
  { id: 'cone', size: [1, 1, 1], studs: false },
  { id: 'arch', size: [2, 1, 1], studs: true },
  { id: 'dome', size: [1, 1, 1], studs: false },
];

export const COLORS = [
  '#e3342f', '#f6993f', '#ffd23f', '#38c172', '#1f8f55', '#4dc0b5',
  '#3490dc', '#233dab', '#9561e2', '#f66d9b', '#ffffff', '#8795a1',
  '#3d4852', '#8a5a33', '#f3d9b1',
];

export const TEXTURES = ['brick', 'stone', 'wood', 'marble', 'metal', 'fabric', 'tiles', 'leaves'];

const SHAPE_BY_ID = new Map(SHAPES.map((shape) => [shape.id, shape]));

export function shapeById(id) {
  return SHAPE_BY_ID.get(id);
}

// Width and depth after turning the block by rotation × 90°.
export function footprint(shapeId, rotation) {
  const [width, , depth] = shapeById(shapeId).size;
  if (rotation % 2 === 1) {
    return [depth, width];
  }
  return [width, depth];
}

export function cellsFor(block) {
  const [width, depth] = footprint(block.shape, block.rotation);
  const height = shapeById(block.shape).size[1];
  const cells = [];
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < height; dy += 1) {
      for (let dz = 0; dz < depth; dz += 1) {
        cells.push([block.x + dx, block.y + dy, block.z + dz]);
      }
    }
  }
  return cells;
}

function cellKey([x, y, z]) {
  return `${x},${y},${z}`;
}

function inBounds([x, y, z]) {
  return x >= 0 && x < GRID && z >= 0 && z < GRID && y >= 0 && y < MAX_HEIGHT;
}

// Place a multi-cell block so the pointed-at cell is near its middle.
export function anchorFor(shapeId, rotation, cell) {
  const [width, depth] = footprint(shapeId, rotation);
  return {
    x: cell[0] - Math.floor((width - 1) / 2),
    y: cell[1],
    z: cell[2] - Math.floor((depth - 1) / 2),
  };
}

function isColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

// Returns a clean block, or null if the data is not a valid block.
export function normalizeBlock(raw) {
  if (!raw || typeof raw !== 'object' || !shapeById(raw.shape)) {
    return null;
  }
  const numbers = ['x', 'y', 'z', 'rotation'].map((key) => raw[key]);
  if (!numbers.every(Number.isInteger)) {
    return null;
  }
  if (!isColor(raw.color)) {
    return null;
  }
  let texture = null;
  if (TEXTURES.includes(raw.texture)) {
    texture = raw.texture;
  }
  return {
    shape: raw.shape,
    x: raw.x,
    y: raw.y,
    z: raw.z,
    rotation: ((raw.rotation % 4) + 4) % 4,
    color: raw.color.toLowerCase(),
    texture,
  };
}

export class World {
  constructor() {
    this.blocks = new Map(); // id -> block
    this.cells = new Map(); // "x,y,z" -> id
    this.nextId = 1;
  }

  get size() {
    return this.blocks.size;
  }

  blockAt(cell) {
    const id = this.cells.get(cellKey(cell));
    if (id === undefined) {
      return null;
    }
    return { id, ...this.blocks.get(id) };
  }

  canPlace(block) {
    if (this.blocks.size >= MAX_BLOCKS) {
      return false;
    }
    return cellsFor(block).every((cell) => inBounds(cell) && !this.cells.has(cellKey(cell)));
  }

  // Returns the new block's id, or null if it doesn't fit.
  add(rawBlock) {
    const block = normalizeBlock(rawBlock);
    if (!block || !this.canPlace(block)) {
      return null;
    }
    const id = this.nextId;
    this.nextId += 1;
    this.blocks.set(id, block);
    cellsFor(block).forEach((cell) => this.cells.set(cellKey(cell), id));
    return id;
  }

  // Returns the removed block, or null.
  remove(id) {
    const block = this.blocks.get(id);
    if (!block) {
      return null;
    }
    cellsFor(block).forEach((cell) => this.cells.delete(cellKey(cell)));
    this.blocks.delete(id);
    return block;
  }

  update(id, changes) {
    const block = this.blocks.get(id);
    if (!block) {
      return null;
    }
    const next = normalizeBlock({ ...block, ...changes });
    if (!next) {
      return null;
    }
    this.blocks.set(id, next);
    return next;
  }

  clear() {
    this.blocks.clear();
    this.cells.clear();
  }

  toJSON() {
    return [...this.blocks.values()];
  }

  // Loads saved blocks, skipping any that are broken or overlap.
  static fromJSON(list) {
    const world = new World();
    if (Array.isArray(list)) {
      list.forEach((raw) => world.add(raw));
    }
    return world;
  }
}

// Sun and light for a time of day (0–24 h). Sunrise at 6, sunset at 18.
// elevation and azimuth are in degrees; daylight goes 0 (night) to 1 (noon).
export function sunForHour(hour) {
  const h = ((hour % 24) + 24) % 24;
  const dayProgress = (h - 6) / 12; // 0 at sunrise, 1 at sunset
  const elevation = 70 * Math.sin(Math.PI * dayProgress);
  const azimuth = 90 + dayProgress * 180;
  // Twilight: some light remains until the sun is 10° below the horizon.
  const daylight = Math.min(1, Math.max(0, (elevation + 10) / 36));
  return { elevation, azimuth, daylight };
}
