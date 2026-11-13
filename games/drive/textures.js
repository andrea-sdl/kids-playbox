// Surfaces drawn in code: asphalt, dirt, ground detail, building fronts,
// rock and plants. Smooth noise (not square specks) keeps them crisp up
// close, and everything tiles, so it can repeat along the road. Most come
// with a bump (normal) map, and a map of where they are rough or shiny.

import * as THREE from '../../vendor/three/three.min.js';
import { normalMapFrom } from '../../gfx/surface.js';

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

// The brighter parts of a noise canvas, in one color with soft edges and
// see-through everywhere else: puddles, moss, patches of snow.
function patchesFrom(noise, from, to, [red, green, blue]) {
  const canvas = makeCanvas(noise.width, noise.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(noise, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const t = Math.min(1, Math.max(0, (data[i] / 255 - from) / (to - from)));
    data[i] = red;
    data[i + 1] = green;
    data[i + 2] = blue;
    data[i + 3] = t * t * (3 - 2 * t) * 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
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

/* ---------- Pictures as surfaces ---------- */

// A picture made to repeat: four mirrored copies side by side, so its
// edges always match.
function mirroredTile(image, size) {
  const canvas = makeCanvas(size * 2, size * 2);
  const ctx = canvas.getContext('2d');
  [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]].forEach(([column, row, flipX, flipY]) => {
    ctx.save();
    ctx.translate((column + (flipX < 0 ? 1 : 0)) * size, (row + (flipY < 0 ? 1 : 0)) * size);
    ctx.scale(flipX, flipY);
    ctx.drawImage(image, 0, 0, size, size);
    ctx.restore();
  });
  return canvas;
}

// Covers part of a canvas with a repeating picture.
function fillWith(ctx, image, x, y, width, height, tile = 256) {
  ctx.fillStyle = ctx.createPattern(mirroredTile(image, tile), 'repeat');
  ctx.fillRect(x, y, width, height);
}

// A building front from a picture of lit windows at night: the picture
// itself, and a second one that keeps only its bright parts, so the
// windows glow. The corner is left dark for roofs and floors.
export function facadeFromPicture(image) {
  const size = 1024;
  const color = makeCanvas(size, size);
  const ctx = color.getContext('2d');
  fillWith(ctx, image, 0, 0, size, size, 512);
  const glow = makeCanvas(size, size);
  const glowCtx = glow.getContext('2d', { willReadFrequently: true });
  glowCtx.drawImage(color, 0, 0);
  const pixels = glowCtx.getImageData(0, 0, size, size);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const bright = Math.max(data[i], data[i + 1], data[i + 2]) / 255;
    const t = Math.min(1, Math.max(0, (bright - 0.42) / 0.36));
    const keep = t * t * (3 - 2 * t);
    data[i] *= keep;
    data[i + 1] *= keep;
    data[i + 2] *= keep;
  }
  glowCtx.putImageData(pixels, 0, 0);
  [ctx, glowCtx].forEach((target, k) => {
    target.fillStyle = k === 0 ? '#16151c' : '#000000';
    target.fillRect(0, size - 12, 12, 12);
  });
  return { map: toTexture(color), emissiveMap: toTexture(glow) };
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

// A road texture 18 m across and 16 m along, a roughness map (bright =
// rough) and a bump map. The city road is wet: puddles lie in its dips,
// flat and mirror-smooth, so they reflect the neon and the sky. With a
// `picture` of the bare surface, that is what the road is made of, and the
// lines, wear and puddles are painted over it; `scenario` can then also be
// 'snowroad', the snowed-over road of the wasteland's first half.
export function roadTextures(scenario, picture = null) {
  const size = 1024;
  const color = makeCanvas(size, size);
  const ctx = color.getContext('2d');
  const rough = makeCanvas(size, size);
  const roughCtx = rough.getContext('2d');
  const rand = random(17);
  const patches = noiseCanvas(256, 3, 5, 3);
  const fine = noiseCanvas(256, 16, 3, 4);
  const wear = noiseCanvas(128, 8, 3, 5);

  if (scenario === 'jungle' && !picture) {
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
    return { map: toTexture(color), roughnessMap: toTexture(rough, { color: false }), normalMap: normalMapFrom(color, { strength: 3.2 }) };
  }

  // Asphalt: dark, with lighter stone chips and darker oil in the lanes.
  let base = '#2f3038';
  if (scenario === 'wasteland') {
    base = '#4a4844';
  }
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  if (picture) {
    fillWith(ctx, picture, 0, 0, size, size);
    overlayNoise(ctx, size, size, patches, 0.2);
  } else {
    overlayNoise(ctx, size, size, patches, 0.45);
    overlayNoise(ctx, size, size, fine, 0.35);
  }
  for (let i = 0; i < (picture ? 0 : 9000); i += 1) {
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
    // Crisp edge lines and dashed lines between the three lanes.
    paintLine(ctx, 36, 0, 16, size, wear);
    paintLine(ctx, size - 52, 0, 16, size, wear);
    [1 / 3, 2 / 3].forEach((lane) => paintLine(ctx, size * lane - 7, 0, 14, size * 0.42, wear));
  }
  if (scenario === 'jungle' || scenario === 'snowroad') {
    // Leaves and moss, or blown snow, creeping in from the edges.
    const creep = scenario === 'jungle' ? '70, 120, 50' : '240, 245, 252';
    [0, 1].forEach((edge) => {
      const gradient = ctx.createLinearGradient(edge * size, 0, edge ? size * 0.9 : size * 0.1, 0);
      gradient.addColorStop(0, `rgba(${creep}, 0.9)`);
      gradient.addColorStop(1, `rgba(${creep}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    });
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
  // Bumps come from the picture itself: stone chips stand up, cracks and
  // tire tracks sink in, paint sits on top.
  const height = makeCanvas(size, size);
  const heightCtx = height.getContext('2d');
  heightCtx.drawImage(color, 0, 0);
  if (scenario === 'city') {
    overlayNoise(roughCtx, size, size, patches, 0.9, 'multiply');
    roughCtx.drawImage(patchesFrom(patches, 0.52, 0.6, [14, 14, 14]), 0, 0, size, size);
    heightCtx.drawImage(patchesFrom(patches, 0.5, 0.58, [70, 70, 74]), 0, 0, size, size);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(patchesFrom(patches, 0.5, 0.6, [8, 8, 16]), 0, 0, size, size);
    ctx.globalAlpha = 1;
  }
  return { map: toTexture(color), roughnessMap: toTexture(rough, { color: false }), normalMap: normalMapFrom(height, { strength: 1.5 }) };
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

// A building front, 8 × 8 windows, with a glow map of the lit ones, a bump
// map (ledges stick out, windows sit back) and a map of what is rough wall
// and what is shiny glass. The strip under the bottom windows is plain
// wall, used for roofs.
export function facadeTextures(style) {
  const size = 1024;
  const cell = size / 8;
  const color = makeCanvas(size, size);
  const ctx = color.getContext('2d');
  const glow = makeCanvas(size, size);
  const glowCtx = glow.getContext('2d');
  const height = makeCanvas(size, size);
  const heightCtx = height.getContext('2d');
  // Green is roughness, blue is metalness (see MeshStandardMaterial).
  const finish = makeCanvas(size, size);
  const finishCtx = finish.getContext('2d');
  const ruin = style === 'ruin';
  const rand = random(ruin ? 41 : 43);
  ctx.fillStyle = ruin ? '#8a8680' : '#9a97a8';
  ctx.fillRect(0, 0, size, size);
  overlayNoise(ctx, size, size, noiseCanvas(256, 4, 5, 47), 0.5);
  glowCtx.fillStyle = '#000';
  glowCtx.fillRect(0, 0, size, size);
  heightCtx.fillStyle = '#b4b4b4';
  heightCtx.fillRect(0, 0, size, size);
  overlayNoise(heightCtx, size, size, noiseCanvas(256, 24, 3, 49), ruin ? 0.5 : 0.18);
  finishCtx.fillStyle = ruin ? 'rgb(0 240 0)' : 'rgb(0 205 0)';
  finishCtx.fillRect(0, 0, size, size);

  for (let row = 0; row < 8; row += 1) {
    // A ledge above each floor, lit on top and shaded below.
    const ledge = row * cell;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(0, ledge, size, 7);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, ledge + 7, size, 5);
    heightCtx.fillStyle = '#ffffff';
    heightCtx.fillRect(0, ledge, size, 8);
    for (let col = 0; col < 8; col += 1) {
      const x = col * cell + cell * 0.17;
      const y = row * cell + cell * 0.2;
      const w = cell * 0.66;
      const h = cell * 0.58;
      // A pillar between windows.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.fillRect(col * cell + 1, ledge + 12, 5, cell - 12);
      heightCtx.fillStyle = '#dcdcdc';
      heightCtx.fillRect(col * cell, ledge + 8, 8, cell - 8);
      // Frame and sill.
      ctx.fillStyle = 'rgba(34, 32, 44, 0.7)';
      ctx.fillRect(x - 5, y - 5, w + 10, h + 13);
      heightCtx.fillStyle = '#8c8c8c';
      heightCtx.fillRect(x - 5, y - 5, w + 10, h + 13);
      heightCtx.fillStyle = '#404040';
      heightCtx.fillRect(x, y, w, h);
      if (ruin) {
        const broken = rand() < 0.4;
        ctx.fillStyle = broken ? '#0c0c0e' : '#22262e';
        ctx.fillRect(x, y, w, h);
        if (!broken) {
          ctx.fillStyle = 'rgba(160, 170, 185, 0.18)';
          ctx.fillRect(x, y, w * 0.4, h);
          finishCtx.fillStyle = 'rgb(0 70 90)';
          finishCtx.fillRect(x, y, w, h);
        } else {
          heightCtx.fillStyle = '#101010';
          heightCtx.fillRect(x, y, w, h);
        }
        continue;
      }
      const lit = rand() < 0.42;
      if (lit) {
        const warm = ['#ffd38a', '#ffe7b5', '#a8e6ff', '#ffbf72', '#ffd0f0'][Math.floor(rand() * 5)];
        const gradient = ctx.createLinearGradient(0, y, 0, y + h);
        gradient.addColorStop(0, warm);
        gradient.addColorStop(1, '#6b4a2a');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);
        const power = 0.5 + rand() * 0.5;
        glowCtx.fillStyle = warm;
        glowCtx.globalAlpha = power;
        glowCtx.fillRect(x, y, w, h);
        // Something in the room: a blind half down, or furniture in shadow.
        const inside = rand();
        if (inside < 0.4) {
          const blind = h * (0.25 + rand() * 0.4);
          ctx.fillStyle = 'rgba(60, 40, 30, 0.45)';
          ctx.fillRect(x, y, w, blind);
          glowCtx.globalAlpha = 0.55;
          glowCtx.fillStyle = '#000';
          glowCtx.fillRect(x, y, w, blind);
        } else if (inside < 0.7) {
          const wide = w * (0.2 + rand() * 0.3);
          const at = x + rand() * (w - wide);
          ctx.fillStyle = 'rgba(40, 24, 16, 0.6)';
          ctx.fillRect(at, y + h * 0.5, wide, h * 0.5);
          glowCtx.globalAlpha = 0.7;
          glowCtx.fillStyle = '#000';
          glowCtx.fillRect(at, y + h * 0.5, wide, h * 0.5);
        }
        glowCtx.globalAlpha = 1;
        finishCtx.fillStyle = 'rgb(0 90 0)';
        finishCtx.fillRect(x, y, w, h);
      } else {
        // Dark glass with a sky reflection: smooth and mirror-like.
        const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
        gradient.addColorStop(0, '#46587e');
        gradient.addColorStop(0.5, '#161c2e');
        gradient.addColorStop(1, '#27314c');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w, h);
        finishCtx.fillStyle = 'rgb(0 26 215)';
        finishCtx.fillRect(x, y, w, h);
      }
      // Mullions: one down the middle, one across.
      ctx.fillStyle = 'rgba(26, 24, 36, 0.85)';
      ctx.fillRect(x + w / 2 - 2.5, y, 5, h);
      ctx.fillRect(x, y + h * 0.36, w, 3);
      heightCtx.fillStyle = '#8c8c8c';
      heightCtx.fillRect(x + w / 2 - 2.5, y, 5, h);
      heightCtx.fillRect(x, y + h * 0.36, w, 3);
      finishCtx.fillStyle = 'rgb(0 180 0)';
      finishCtx.fillRect(x + w / 2 - 2.5, y, 5, h);
    }
  }
  // Rain streaks under the ledges, and soot on ruins.
  const streaks = ruin ? 90 : 46;
  for (let i = 0; i < streaks; i += 1) {
    const x = rand() * size;
    const from = Math.floor(rand() * 8) * cell + 8;
    const gradient = ctx.createLinearGradient(0, from, 0, from + cell * (0.5 + rand() * (ruin ? 3 : 1)));
    gradient.addColorStop(0, ruin ? 'rgba(20, 18, 16, 0.4)' : 'rgba(20, 18, 30, 0.22)');
    gradient.addColorStop(1, 'rgba(20, 18, 16, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, from, 2 + rand() * 6, size);
  }
  addGrain(ctx, size, size, 14, 53);
  return {
    map: toTexture(color),
    emissiveMap: toTexture(glow),
    normalMap: normalMapFrom(height, { strength: 3 }),
    finishMap: toTexture(finish, { color: false }),
  };
}

// Eight neon billboards in one picture (4 across, 2 down): simple glowing
// drawings, no words, so they read the same in every language.
export function signTexture() {
  const width = 256;
  const height = 128;
  const canvas = makeCanvas(width * 4, height * 2);
  const ctx = canvas.getContext('2d');
  const colors = ['#ff3fa4', '#35f2ff', '#ffd23f', '#39ff88', '#a45bff', '#ff8a3a', '#35f2ff', '#ff3fa4'];
  const drawings = [
    // A star.
    () => {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? 44 : 19;
        const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.stroke();
    },
    // Arrows racing to the right.
    () => {
      [-70, -20, 30].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(x, -34);
        ctx.lineTo(x + 36, 0);
        ctx.lineTo(x, 34);
        ctx.stroke();
      });
    },
    // A lightning bolt.
    () => {
      ctx.beginPath();
      ctx.moveTo(16, -48);
      ctx.lineTo(-22, 6);
      ctx.lineTo(2, 6);
      ctx.lineTo(-14, 48);
      ctx.lineTo(26, -8);
      ctx.lineTo(2, -8);
      ctx.closePath();
      ctx.stroke();
    },
    // Rings, like a target.
    () => {
      [44, 28, 12].forEach((radius) => {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
      });
    },
    // A wave.
    () => {
      [-18, 6, 30].forEach((y) => {
        ctx.beginPath();
        for (let x = -90; x <= 90; x += 6) {
          ctx.lineTo(x, y + Math.sin(x / 15) * 12);
        }
        ctx.stroke();
      });
    },
    // A heart.
    () => {
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.bezierCurveTo(-70, -4, -34, -58, 0, -22);
      ctx.bezierCurveTo(34, -58, 70, -4, 0, 40);
      ctx.stroke();
    },
    // Sound bars.
    () => {
      [30, 54, 78, 46, 66, 24, 58].forEach((tall, i) => {
        ctx.strokeRect(-84 + i * 25, 42 - tall, 14, tall);
      });
    },
    // A diamond in a diamond.
    () => {
      [46, 24].forEach((radius) => {
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(radius * 1.5, 0);
        ctx.lineTo(0, radius);
        ctx.lineTo(-radius * 1.5, 0);
        ctx.closePath();
        ctx.stroke();
      });
    },
  ];
  drawings.forEach((draw, i) => {
    const x = (i % 4) * width;
    const y = Math.floor(i / 4) * height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = '#0b0714';
    ctx.fillRect(x, y, width, height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // A frame in a second color.
    ctx.strokeStyle = colors[(i + 3) % colors.length];
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 9, y + 9, width - 18, height - 18);
    ctx.translate(x + width / 2, y + height / 2);
    // Drawn twice: a wide soft glow, then a bright thin core.
    ctx.strokeStyle = colors[i];
    ctx.shadowColor = colors[i];
    ctx.shadowBlur = 18;
    ctx.lineWidth = 9;
    draw();
    ctx.strokeStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    draw();
    ctx.restore();
  });
  return toTexture(canvas, { repeat: false });
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
