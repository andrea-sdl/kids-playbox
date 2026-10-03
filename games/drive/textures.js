// Surfaces drawn in code: asphalt, dirt, ground detail, building fronts,
// rock and plants. Smooth noise (not square specks) keeps them crisp up
// close, and everything tiles, so it can repeat along the road.

import * as THREE from '../../vendor/three/three.min.js';

export function random(seed) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Tileable fractal noise as a grayscale canvas. Drawn small, then scaled up
// with smoothing, it gives soft patches at no real cost.
function noiseCanvas(size, cells, octaves, seed, stretchY = 1) {
  const rand = random(seed);
  const values = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const gridX = cells * 2 ** octave;
    const gridY = Math.max(1, Math.round(gridX * stretchY));
    const grid = new Float32Array(gridX * gridY);
    for (let i = 0; i < grid.length; i += 1) {
      grid[i] = rand();
    }
    for (let y = 0; y < size; y += 1) {
      const fy = (y / size) * gridY;
      const iy = Math.floor(fy);
      let ty = fy - iy;
      ty = ty * ty * (3 - 2 * ty);
      const y0 = iy % gridY;
      const y1 = (iy + 1) % gridY;
      for (let x = 0; x < size; x += 1) {
        const fx = (x / size) * gridX;
        const ix = Math.floor(fx);
        let tx = fx - ix;
        tx = tx * tx * (3 - 2 * tx);
        const x0 = ix % gridX;
        const x1 = (ix + 1) % gridX;
        const top = grid[y0 * gridX + x0] + (grid[y0 * gridX + x1] - grid[y0 * gridX + x0]) * tx;
        const bottom = grid[y1 * gridX + x0] + (grid[y1 * gridX + x1] - grid[y1 * gridX + x0]) * tx;
        values[y * size + x] += (top + (bottom - top) * ty) * amplitude;
      }
    }
    total += amplitude;
    amplitude *= 0.5;
  }
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < values.length; i += 1) {
    const value = Math.round((values[i] / total) * 255);
    image.data[i * 4] = value;
    image.data[i * 4 + 1] = value;
    image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// Fine per-pixel grain, so surfaces never look flat up close.
function addGrain(ctx, width, height, amount, seed) {
  const rand = random(seed);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (rand() - 0.5) * amount;
    data[i] += grain;
    data[i + 1] += grain;
    data[i + 2] += grain;
  }
  ctx.putImageData(image, 0, 0);
}

// Lay a noise canvas over what's drawn, lightening and darkening it.
function overlayNoise(ctx, width, height, noise, strength, mode = 'overlay') {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = strength;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(noise, 0, 0, width, height);
  ctx.restore();
}

function toTexture(canvas, { color = true, repeat = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  texture.anisotropy = 8;
  return texture;
}

/* ---------- Roads ---------- */

// Painted lines, a little worn: drawn solid, then rubbed with noise.
function paintLine(ctx, x, y, width, height, wear) {
  ctx.save();
  ctx.fillStyle = 'rgba(245, 245, 240, 0.95)';
  ctx.fillRect(x, y, width, height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = 0.6;
  ctx.drawImage(wear, x, y, width, height);
  ctx.restore();
}

// A road texture 18 m across and 16 m along, plus a roughness map (bright
// = rough). The city road is slick in the tire tracks, so it shines.
export function roadTextures(scenario) {
  const size = 1024;
  const color = makeCanvas(size, size);
  const ctx = color.getContext('2d');
  const rough = makeCanvas(size, size);
  const roughCtx = rough.getContext('2d');
  const rand = random(17);
  const patches = noiseCanvas(256, 3, 5, 3);
  const fine = noiseCanvas(256, 16, 3, 4);
  const wear = noiseCanvas(128, 8, 3, 5);

  if (scenario === 'jungle') {
    ctx.fillStyle = '#7d5232';
    ctx.fillRect(0, 0, size, size);
    overlayNoise(ctx, size, size, patches, 0.7);
    overlayNoise(ctx, size, size, fine, 0.45);
    // Two packed-down tire ruts.
    [0.3, 0.7].forEach((center) => {
      const gradient = ctx.createLinearGradient(size * (center - 0.1), 0, size * (center + 0.1), 0);
      gradient.addColorStop(0, 'rgba(50, 28, 14, 0)');
      gradient.addColorStop(0.5, 'rgba(50, 28, 14, 0.4)');
      gradient.addColorStop(1, 'rgba(50, 28, 14, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(size * (center - 0.1), 0, size * 0.2, size);
    });
    // Pebbles with a soft shadow.
    for (let i = 0; i < 700; i += 1) {
      const radius = 1.2 + rand() * 2.6;
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle = 'rgba(30, 18, 8, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 1.5, y + 1.5, radius, radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      const shade = 95 + Math.floor(rand() * 45);
      ctx.fillStyle = `rgb(${shade} ${Math.floor(shade * 0.8)} ${Math.floor(shade * 0.6)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.8, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Grass creeping in at the edges.
    [0, 1].forEach((edge) => {
      const gradient = ctx.createLinearGradient(edge * size, 0, edge ? size * 0.88 : size * 0.12, 0);
      gradient.addColorStop(0, 'rgba(60, 110, 35, 0.95)');
      gradient.addColorStop(1, 'rgba(60, 110, 35, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    });
    addGrain(ctx, size, size, 26, 6);
    roughCtx.fillStyle = '#e6e6e6';
    roughCtx.fillRect(0, 0, size, size);
    return { map: toTexture(color), roughnessMap: toTexture(rough, { color: false }) };
  }

  // Asphalt: dark, with lighter stone chips and darker oil in the lanes.
  let base = '#2f3038';
  if (scenario === 'wasteland') {
    base = '#4a4844';
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  overlayNoise(ctx, size, size, patches, 0.45);
  overlayNoise(ctx, size, size, fine, 0.35);
  for (let i = 0; i < 9000; i += 1) {
    const shade = 70 + Math.floor(rand() * 70);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 6}, ${0.25 + rand() * 0.4})`;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 0.6 + rand() * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dark, polished tire tracks: two per lane.
  [0.17, 0.33, 0.67, 0.83].forEach((center) => {
    const gradient = ctx.createLinearGradient(size * (center - 0.06), 0, size * (center + 0.06), 0);
    gradient.addColorStop(0, 'rgba(10, 10, 14, 0)');
    gradient.addColorStop(0.5, 'rgba(10, 10, 14, 0.35)');
    gradient.addColorStop(1, 'rgba(10, 10, 14, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(size * (center - 0.06), 0, size * 0.12, size);
  });

  if (scenario === 'wasteland') {
    // Cracks with a dark fill and a lighter lip, and sand blown onto the edges.
    for (let i = 0; i < 26; i += 1) {
      let x = rand() * size;
      let y = rand() * size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      const points = [[x, y]];
      for (let step = 0; step < 8; step += 1) {
        x += (rand() - 0.5) * 70;
        y += (rand() - 0.3) * 50;
        points.push([x, y]);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(160, 150, 130, 0.35)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(12, 10, 8, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    paintLine(ctx, size / 2 - 7, 0, 14, size * 0.4, wear);
    paintLine(ctx, 40, 0, 12, size, wear);
    paintLine(ctx, size - 52, 0, 12, size, wear);
    [0, 1].forEach((edge) => {
      const gradient = ctx.createLinearGradient(edge * size, 0, edge ? size * 0.8 : size * 0.2, 0);
      gradient.addColorStop(0, 'rgba(225, 205, 170, 0.9)');
      gradient.addColorStop(1, 'rgba(225, 205, 170, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    });
    overlayNoise(ctx, size, size, patches, 0.25, 'soft-light');
  } else {
    // City: crisp edge lines and a dashed middle line.
    paintLine(ctx, 36, 0, 16, size, wear);
    paintLine(ctx, size - 52, 0, 16, size, wear);
    paintLine(ctx, size / 2 - 8, 0, 16, size * 0.45, wear);
  }
  addGrain(ctx, size, size, 18, 8);

  // Roughness: tire tracks and the city's damp patches are smoother.
  roughCtx.fillStyle = scenario === 'city' ? '#c0c0c0' : '#d8d8d8';
  roughCtx.fillRect(0, 0, size, size);
  [0.17, 0.33, 0.67, 0.83].forEach((center) => {
    const gradient = roughCtx.createLinearGradient(size * (center - 0.07), 0, size * (center + 0.07), 0);
    gradient.addColorStop(0, 'rgba(40, 40, 40, 0)');
    gradient.addColorStop(0.5, 'rgba(40, 40, 40, 0.35)');
    gradient.addColorStop(1, 'rgba(40, 40, 40, 0)');
    roughCtx.fillStyle = gradient;
    roughCtx.fillRect(size * (center - 0.07), 0, size * 0.14, size);
  });
  if (scenario === 'city') {
    overlayNoise(roughCtx, size, size, patches, 0.9, 'multiply');
  }
  return { map: toTexture(color), roughnessMap: toTexture(rough, { color: false }) };
}

/* ---------- Ground ---------- */

// A light gray detail texture that the ground's own colors tint: grass
// strokes, sand ripples or paving slabs. Tiles every few meters.
export function groundDetail(kind) {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rand = random(23);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, size, size);
  overlayNoise(ctx, size, size, noiseCanvas(128, 4, 4, 31), 0.6);
  if (kind === 'grass') {
    for (let i = 0; i < 6000; i += 1) {
      const x = rand() * size;
      const y = rand() * size;
      const length = 4 + rand() * 9;
      const shade = 130 + Math.floor(rand() * 125);
      ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, 0.55)`;
      ctx.lineWidth = 1 + rand();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 4, y - length);
      ctx.stroke();
    }
  }
  if (kind === 'drift') {
    // Wind ripples, for both sand and snow.
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (let y = 0; y < size; y += 9) {
      ctx.strokeStyle = y % 18 === 0 ? '#ffffff' : '#9a9a9a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 16) {
        const wave = Math.sin((x / size) * Math.PI * 4 + y * 0.05) * 4;
        if (x === 0) {
          ctx.moveTo(x, y + wave);
        } else {
          ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (kind === 'paving') {
    ctx.strokeStyle = 'rgba(70, 70, 80, 0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, (i * size) / 4);
      ctx.lineTo(size, (i * size) / 4);
      ctx.moveTo((i * size) / 4, 0);
      ctx.lineTo((i * size) / 4, size);
      ctx.stroke();
    }
  }
  addGrain(ctx, size, size, 22, 29);
  return toTexture(canvas);
}

/* ---------- Buildings ---------- */

// A building front, 8 × 8 windows, with a glow map of the lit ones. The
// bottom-left corner is plain wall, used for roofs.
export function facadeTextures(style) {
  const size = 512;
  const cell = size / 8;
  const color = makeCanvas(size, size);
  const ctx = color.getContext('2d');
  const glow = makeCanvas(size, size);
  const glowCtx = glow.getContext('2d');
  const rand = random(style === 'ruin' ? 41 : 43);
  ctx.fillStyle = style === 'ruin' ? '#8a8680' : '#9a97a8';
  ctx.fillRect(0, 0, size, size);
  overlayNoise(ctx, size, size, noiseCanvas(128, 4, 4, 47), 0.5);
  glowCtx.fillStyle = '#000';
  glowCtx.fillRect(0, 0, size, size);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const x = col * cell + cell * 0.16;
      const y = row * cell + cell * 0.18;
      const w = cell * 0.68;
      const h = cell * 0.6;
      // Frame and sill.
      ctx.fillStyle = 'rgba(40, 38, 50, 0.55)';
      ctx.fillRect(x - 3, y - 3, w + 6, h + 8);
      if (style === 'ruin') {
        const broken = rand() < 0.4;
        ctx.fillStyle = broken ? '#0c0c0e' : '#22262e';
        ctx.fillRect(x, y, w, h);
        if (!broken) {
          ctx.fillStyle = 'rgba(160, 170, 185, 0.18)';
          ctx.fillRect(x, y, w * 0.4, h);
        }
        continue;
      }
      const lit = rand() < 0.45;
      if (lit) {
        const warm = ['#ffd38a', '#ffe7b5', '#a8e6ff', '#ffbf72', '#ffd0f0'][Math.floor(rand() * 5)];
        const gradient = ctx.createLinearGradient(0, y, 0, y + h);
        gradient.addColorStop(0, warm);
        gradient.addColorStop(1, '#6b4a2a');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);
        glowCtx.fillStyle = warm;
        glowCtx.globalAlpha = 0.55 + rand() * 0.45;
        glowCtx.fillRect(x, y, w, h);
        glowCtx.globalAlpha = 1;
      } else {
        // Dark glass with a sky reflection.
        const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
        gradient.addColorStop(0, '#3a4a6e');
        gradient.addColorStop(0.5, '#141a2a');
        gradient.addColorStop(1, '#232c45');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);
      }
      // Mullion.
      ctx.fillStyle = 'rgba(30, 28, 40, 0.8)';
      ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
    }
  }
  // Plain wall corner for roofs.
  ctx.fillStyle = style === 'ruin' ? '#6e6a66' : '#5a586a';
  ctx.fillRect(0, 0, 6, 6);
  glowCtx.fillStyle = '#000';
  glowCtx.fillRect(0, 0, 6, 6);
  if (style === 'ruin') {
    // Soot and streaks running down.
    for (let i = 0; i < 60; i += 1) {
      const x = rand() * size;
      const gradient = ctx.createLinearGradient(0, rand() * size, 0, size);
      gradient.addColorStop(0, 'rgba(20, 18, 16, 0.35)');
      gradient.addColorStop(1, 'rgba(20, 18, 16, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, 2 + rand() * 6, size);
    }
  }
  addGrain(ctx, size, size, 16, 53);
  return { map: toTexture(color), emissiveMap: toTexture(glow) };
}

// Layered rock for desert mesas.
export function strataTexture() {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rand = random(61);
  let y = 0;
  while (y < size) {
    const band = 8 + rand() * 30;
    const shade = rand();
    ctx.fillStyle = `rgb(${170 + shade * 60} ${90 + shade * 50} ${55 + shade * 35})`;
    ctx.fillRect(0, y, size, band);
    y += band;
  }
  overlayNoise(ctx, size, size, noiseCanvas(128, 6, 4, 67), 0.55);
  addGrain(ctx, size, size, 20, 71);
  return toTexture(canvas);
}

/* ---------- Plants (with see-through edges) ---------- */

// A clump of grass and ferns, for crossed cards along the roadside.
export function fernTexture() {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rand = random(73);
  for (let i = 0; i < 70; i += 1) {
    const x = size / 2 + (rand() - 0.5) * size * 0.7;
    const height = size * (0.35 + rand() * 0.6);
    const bend = (rand() - 0.5) * size * 0.5;
    const green = 90 + Math.floor(rand() * 90);
    ctx.strokeStyle = `rgb(${Math.floor(green * 0.45)} ${green} ${Math.floor(green * 0.35)})`;
    ctx.lineWidth = 2 + rand() * 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, size);
    ctx.quadraticCurveTo(x + bend * 0.3, size - height * 0.6, x + bend, size - height);
    ctx.stroke();
  }
  return toTexture(canvas, { repeat: false });
}

// One palm frond: a stem with leaflets, see-through around it.
export function frondTexture() {
  const width = 128;
  const height = 512;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const rand = random(79);
  ctx.lineCap = 'round';
  for (let y = 20; y < height - 10; y += 7) {
    const reach = (width / 2 - 6) * Math.sin((y / height) * Math.PI) ** 0.7;
    const green = 110 + Math.floor(rand() * 60);
    ctx.strokeStyle = `rgb(${Math.floor(green * 0.4)} ${green} ${Math.floor(green * 0.3)})`;
    ctx.lineWidth = 4;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.moveTo(width / 2, y);
      ctx.lineTo(width / 2 + side * reach, y + 18);
      ctx.stroke();
    });
  }
  ctx.strokeStyle = '#5c7a2a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
  return toTexture(canvas, { repeat: false });
}

/* ---------- Small effects ---------- */

export function stripesTexture(first, second) {
  const canvas = makeCanvas(64, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = first;
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = second;
  ctx.fillRect(0, 0, 64, 128);
  // A rounded top: lighter in the middle, darker at the edges.
  const gradient = ctx.createLinearGradient(0, 0, 64, 0);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 256);
  return toTexture(canvas);
}

export function checkerTexture() {
  const canvas = makeCanvas(512, 128);
  const ctx = canvas.getContext('2d');
  const square = 32;
  for (let x = 0; x < 512; x += square) {
    for (let y = 0; y < 128; y += square) {
      ctx.fillStyle = (x / square + y / square) % 2 === 0 ? '#f4f4f4' : '#111111';
      ctx.fillRect(x, y, square, square);
    }
  }
  return toTexture(canvas, { repeat: false });
}

// A soft round dot: glows, smoke puffs and sparks.
export function softDotTexture() {
  const canvas = makeCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(canvas, { repeat: false });
}

// Fades from bright at the bottom to nothing at the top: pickup beams.
export function beamTexture() {
  const canvas = makeCanvas(8, 256);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, 256);
  return toTexture(canvas, { repeat: false });
}

// A boost pad: bright chevrons on a dark strip, pointing toward the bottom
// of the canvas (the pad turns that way down the road). It scrolls.
export function boostTexture() {
  const canvas = makeCanvas(128, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(20, 60, 110, 0.55)';
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 18;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  [40, 125, 210].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(18, y - 30);
    ctx.lineTo(64, y + 10);
    ctx.lineTo(110, y - 30);
    ctx.stroke();
  });
  // Bright edges.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 6, 256);
  ctx.fillRect(122, 0, 6, 256);
  return toTexture(canvas);
}

// Side graphics for a car, on a see-through canvas laid over each side:
// left of the canvas is the back of the car, right is the front, the
// bottom is the bottom of the car. 'swirl' is long swooshes, 'tribal' is
// pointed blades, 'flames' licks back from the front wheel.
export function decalTexture(kind, color) {
  const canvas = makeCanvas(1024, 256);
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'swirl') {
    const swoosh = (width, lift) => {
      ctx.beginPath();
      ctx.moveTo(990, 205 - lift);
      ctx.bezierCurveTo(760, 230 - lift, 600, 90 - lift, 330, 120 - lift);
      ctx.bezierCurveTo(200, 135 - lift, 110, 95 - lift, 40, 70 - lift);
      ctx.lineWidth = width;
      ctx.stroke();
    };
    [[30, 0], [16, 34], [9, 58]].forEach(([width, lift]) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      swoosh(width + 8, lift);
      ctx.strokeStyle = color;
      swoosh(width, lift);
    });
  }
  if (kind === 'tribal') {
    ctx.fillStyle = color;
    // Blades fanning back from the front wheel, each ending in a point.
    [[560, 70, 34], [470, 120, 30], [380, 165, 26], [640, 205, 24], [300, 210, 18]].forEach(([tipX, tipY, thick]) => {
      ctx.beginPath();
      ctx.moveTo(960, 150);
      ctx.quadraticCurveTo(820, tipY - thick, tipX, tipY);
      ctx.quadraticCurveTo(820, tipY + thick * 1.6, 960, 205);
      ctx.closePath();
      ctx.fill();
    });
  }
  if (kind === 'flames') {
    const gradient = ctx.createLinearGradient(980, 0, 380, 0);
    gradient.addColorStop(0, '#ffe14a');
    gradient.addColorStop(0.5, '#ff8a1a');
    gradient.addColorStop(1, '#e3242b');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#7a1010';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(1000, 120);
    [[760, 70, 690, 110], [560, 60, 480, 120], [620, 135, 420, 165], [600, 190, 520, 215], [780, 215, 1000, 225]].forEach(([cx, cy, x, y]) => {
      ctx.quadraticCurveTo(cx, cy, x, y);
      ctx.quadraticCurveTo((x + 1000) / 2, (y + cy) / 2, Math.min(1000, x + 160), y + 4);
    });
    ctx.lineTo(1000, 225);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  return toTexture(canvas, { repeat: false });
}

// Light thrown on the road by headlights: a soft fan.
export function headlightTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 256, 10, 128, 256, 250);
  gradient.addColorStop(0, 'rgba(255, 250, 230, 0.9)');
  gradient.addColorStop(0.5, 'rgba(255, 250, 230, 0.25)');
  gradient.addColorStop(1, 'rgba(255, 250, 230, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(128, 256);
  ctx.lineTo(0, 0);
  ctx.lineTo(256, 0);
  ctx.closePath();
  ctx.fill();
  return toTexture(canvas, { repeat: false });
}
