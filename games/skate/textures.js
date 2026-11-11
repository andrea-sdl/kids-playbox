// Surfaces drawn in code: park floors, ramps, board graphics, windows,
// graffiti and the floating letters. Nothing to download, so it all works
// offline. Smooth noise keeps surfaces from looking flat up close, and the
// scene works out bumps (normal maps) from these same pictures.

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

// Tileable fractal noise as a grayscale canvas.
function noiseCanvas(size, cells, octaves, seed) {
  const rand = random(seed);
  const values = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    const grid = cells * 2 ** octave;
    const points = new Float32Array(grid * grid);
    for (let i = 0; i < points.length; i += 1) {
      points[i] = rand();
    }
    for (let y = 0; y < size; y += 1) {
      const fy = (y / size) * grid;
      const iy = Math.floor(fy);
      let ty = fy - iy;
      ty = ty * ty * (3 - 2 * ty);
      const y0 = iy % grid;
      const y1 = (iy + 1) % grid;
      for (let x = 0; x < size; x += 1) {
        const fx = (x / size) * grid;
        const ix = Math.floor(fx);
        let tx = fx - ix;
        tx = tx * tx * (3 - 2 * tx);
        const x0 = ix % grid;
        const x1 = (ix + 1) % grid;
        const top = points[y0 * grid + x0] + (points[y0 * grid + x1] - points[y0 * grid + x0]) * tx;
        const bottom = points[y1 * grid + x0] + (points[y1 * grid + x1] - points[y1 * grid + x0]) * tx;
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

function overlayNoise(ctx, width, height, noise, strength, mode = 'overlay') {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = strength;
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

/* ---------- Park surfaces ---------- */

// The floor, 8 m square per repeat.
export function floorTexture(scenario) {
  const size = scenario === 'city' ? 1024 : 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const noise = noiseCanvas(128, 4, 4, 11);
  if (scenario === 'city') {
    // Concrete slabs, 2 m each. Every slab has its own tone, the seams are
    // dark with a worn light edge, and the stone in the mix shows as specks.
    const rand = random(4);
    const slab = size / 4;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const tone = 172 + Math.round(rand() * 22);
        ctx.fillStyle = `rgb(${tone + 4}, ${tone + 2}, ${tone - 3})`;
        ctx.fillRect(col * slab, row * slab, slab, slab);
      }
    }
    overlayNoise(ctx, size, size, noise, 0.4);
    overlayNoise(ctx, size, size, noiseCanvas(256, 24, 3, 12), 0.22);
    for (let i = 0; i < 5000; i += 1) {
      const shade = rand() < 0.5 ? 235 : 90;
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${0.12 + rand() * 0.2})`;
      ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
    }
    for (let i = 0; i <= 4; i += 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fillRect(i * slab - 6, 0, 12, size);
      ctx.fillRect(0, i * slab - 6, size, 12);
      ctx.fillStyle = 'rgba(38, 36, 34, 0.9)';
      ctx.fillRect(i * slab - 2.5, 0, 5, size);
      ctx.fillRect(0, i * slab - 2.5, size, 5);
    }
    // Oil spots, and a few hairline cracks.
    for (let i = 0; i < 9; i += 1) {
      const x = rand() * size;
      const y = rand() * size;
      const spot = ctx.createRadialGradient(x, y, 0, x, y, 20 + rand() * 40);
      spot.addColorStop(0, 'rgba(40, 38, 36, 0.22)');
      spot.addColorStop(1, 'rgba(40, 38, 36, 0)');
      ctx.fillStyle = spot;
      ctx.fillRect(x - 70, y - 70, 140, 140);
    }
    ctx.strokeStyle = 'rgba(30, 28, 26, 0.6)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 7; i += 1) {
      let x = rand() * size;
      let y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 7; step += 1) {
        x += (rand() - 0.5) * 60;
        y += (rand() - 0.2) * 44;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    addGrain(ctx, size, size, 14, 3);
  }
  if (scenario === 'sea') {
    // Pale stone pavers in a running bond.
    ctx.fillStyle = '#9c8f7c';
    ctx.fillRect(0, 0, size, size);
    const rand = random(8);
    for (let row = 0; row < 8; row += 1) {
      const shift = (row % 2) * 64;
      for (let col = -1; col < 5; col += 1) {
        const tone = 178 + Math.round(rand() * 26);
        const warm = rand() < 0.2 ? 18 : 0;
        ctx.fillStyle = `rgb(${tone + warm}, ${tone - 10}, ${tone - 26 - warm})`;
        ctx.fillRect(col * 128 + shift + 3, row * 64 + 3, 122, 58);
      }
    }
    overlayNoise(ctx, size, size, noise, 0.25);
    addGrain(ctx, size, size, 12, 5);
  }
  if (scenario === 'mountain') {
    // Groomed snow: soft lines from the snow machine.
    ctx.fillStyle = '#eef3fa';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? 'rgba(150, 172, 210, 0.22)' : 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(0, y, size, 4);
    }
    overlayNoise(ctx, size, size, noise, 0.2);
    addGrain(ctx, size, size, 8, 6);
  }
  if (scenario === 'desert') {
    // Packed sand with wind ripples.
    ctx.fillStyle = '#e4bf86';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(160, 110, 60, 0.18)';
    ctx.lineWidth = 3;
    for (let y = 0; y < size; y += 14) {
      ctx.beginPath();
      for (let x = 0; x <= size; x += 16) {
        const wave = Math.sin((x / size) * Math.PI * 4 + y * 0.3) * 4;
        if (x === 0) {
          ctx.moveTo(x, y + wave);
        } else {
          ctx.lineTo(x, y + wave);
        }
      }
      ctx.stroke();
    }
    overlayNoise(ctx, size, size, noise, 0.35);
    addGrain(ctx, size, size, 16, 7);
  }
  return toTexture(canvas);
}

// Ramp and quarter pipe surfaces, 4 m square per repeat.
export function rampTexture(scenario) {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const noise = noiseCanvas(64, 3, 3, 21);
  if (scenario === 'sea') {
    // Painted wooden planks.
    for (let i = 0; i < 8; i += 1) {
      const tone = 236 - (i % 3) * 6;
      ctx.fillStyle = `rgb(${tone - 20}, ${tone - 6}, ${tone + 10})`;
      ctx.fillRect(0, i * 32, size, 32);
      ctx.fillStyle = 'rgba(60, 80, 110, 0.35)';
      ctx.fillRect(0, i * 32, size, 2);
    }
    overlayNoise(ctx, size, size, noise, 0.2);
  } else if (scenario === 'mountain') {
    // Packed snow with the snow machine's lines.
    ctx.fillStyle = '#e3eaf4';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 8) {
      ctx.fillStyle = 'rgba(150, 170, 205, 0.16)';
      ctx.fillRect(0, y, size, 3);
    }
    overlayNoise(ctx, size, size, noise, 0.3);
  } else if (scenario === 'desert') {
    // Sandstone, with soft bands.
    ctx.fillStyle = '#d9a86a';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = `rgba(150, 90, 40, ${0.08 + (i % 2) * 0.06})`;
      ctx.fillRect(0, i * 44, size, 18);
    }
    overlayNoise(ctx, size, size, noise, 0.4);
  } else {
    // Smooth skatepark concrete.
    ctx.fillStyle = '#c9c7c2';
    ctx.fillRect(0, 0, size, size);
    overlayNoise(ctx, size, size, noise, 0.3);
  }
  addGrain(ctx, size, size, 12, 9);
  return toTexture(canvas);
}

/* ---------- Boards ---------- */

function star(ctx, x, y, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

// The board's top and bottom: its color and graphic. The canvas is the
// board seen from above, nose at the top.
export function boardTexture(deck, graphic, color) {
  const width = 128;
  const height = 512;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = deck;
  ctx.fillRect(0, 0, width, height);
  // A soft shine down the middle.
  const shine = ctx.createLinearGradient(0, 0, width, 0);
  shine.addColorStop(0, 'rgba(0,0,0,0.18)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  shine.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (graphic === 'stripes') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-0.5);
    for (let i = -10; i <= 10; i += 1) {
      ctx.fillRect(-200, i * 48, 400, 18);
    }
    ctx.restore();
  }
  if (graphic === 'flames') {
    // Flames licking up from the tail.
    for (let i = 0; i < 5; i += 1) {
      const x = (i + 0.5) * (width / 5);
      const tall = 200 + (i % 2) * 90 + (i === 2 ? 60 : 0);
      ctx.beginPath();
      ctx.moveTo(x - 22, height);
      ctx.quadraticCurveTo(x - 30, height - tall * 0.5, x + 4, height - tall);
      ctx.quadraticCurveTo(x - 4, height - tall * 0.45, x + 22, height);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 220, 90, 0.75)';
    for (let i = 0; i < 5; i += 1) {
      const x = (i + 0.5) * (width / 5);
      ctx.beginPath();
      ctx.moveTo(x - 10, height);
      ctx.quadraticCurveTo(x - 12, height - 70, x + 2, height - 120);
      ctx.quadraticCurveTo(x, height - 60, x + 10, height);
      ctx.fill();
    }
  }
  if (graphic === 'stars') {
    const rand = random(17);
    for (let i = 0; i < 14; i += 1) {
      star(ctx, 12 + rand() * (width - 24), 20 + rand() * (height - 40), 9 + rand() * 12, 4 + rand() * 4);
    }
    star(ctx, width / 2, height / 2, 46, 20);
  }
  if (graphic === 'checker') {
    const cell = 32;
    for (let y = 0; y < height / cell; y += 1) {
      for (let x = 0; x < width / cell; x += 1) {
        if ((x + y) % 2 === 0 && (y < 5 || y > 10)) {
          ctx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }
  if (graphic === 'bolt') {
    ctx.beginPath();
    ctx.moveTo(84, 40);
    ctx.lineTo(30, 270);
    ctx.lineTo(70, 270);
    ctx.lineTo(40, 470);
    ctx.lineTo(104, 220);
    ctx.lineTo(62, 220);
    ctx.closePath();
    ctx.fill();
  }
  if (graphic === 'wave') {
    // Japanese wave scales.
    ctx.lineWidth = 4;
    const r = 26;
    for (let row = 0; row < height / (r / 2) + 2; row += 1) {
      for (let col = -1; col < width / (r * 2) + 2; col += 1) {
        const x = col * r * 2 + (row % 2) * r;
        const y = row * (r / 2);
        [r, r * 0.7, r * 0.4].forEach((radius) => {
          ctx.beginPath();
          ctx.arc(x, y, radius, Math.PI, Math.PI * 2);
          ctx.stroke();
        });
      }
    }
  }
  // A thin edge line all around.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, width, height);
  const texture = toTexture(canvas, { repeat: false });
  texture.anisotropy = 4;
  return texture;
}

/* ---------- Scenery ---------- */

// Building fronts: rows of windows, 4 m wide and 3.5 m tall per repeat.
// The top left corner is plain wall, for roofs and sides without windows.
// Three pictures come back: the colors, a height picture for bumps
// (frames stick out, glass sits back) and a finish picture (green is
// roughness, blue is metalness: glass is smooth and mirror-like).
export function windowsTexture(style = 'city') {
  const size = 256;
  const color = makeCanvas(size, size);
  const ctx = color.getContext('2d');
  const height = makeCanvas(size, size);
  const heightCtx = height.getContext('2d');
  const finish = makeCanvas(size, size);
  const finishCtx = finish.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  overlayNoise(ctx, size, size, noiseCanvas(64, 4, 3, 51), 0.12, 'multiply');
  heightCtx.fillStyle = '#b0b0b0';
  heightCtx.fillRect(0, 0, size, size);
  finishCtx.fillStyle = 'rgb(0 215 0)';
  finishCtx.fillRect(0, 0, size, size);
  // A ledge under each floor.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(0, size - 18, size, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(0, size - 22, size, 4);
  heightCtx.fillStyle = '#ffffff';
  heightCtx.fillRect(0, size - 20, size, 14);

  const pane = (x, y, w, h, frame, glassStops) => {
    ctx.fillStyle = frame;
    ctx.fillRect(x, y, w, h);
    heightCtx.fillStyle = '#d8d8d8';
    heightCtx.fillRect(x, y, w, h);
    const glass = ctx.createLinearGradient(x, y, x + w, y + h);
    glassStops.forEach(([stop, shade]) => glass.addColorStop(stop, shade));
    ctx.fillStyle = glass;
    ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
    heightCtx.fillStyle = '#505050';
    heightCtx.fillRect(x + 6, y + 6, w - 12, h - 12);
    finishCtx.fillStyle = 'rgb(0 22 205)';
    finishCtx.fillRect(x + 6, y + 6, w - 12, h - 12);
  };
  if (style === 'house') {
    // One wide window with a wooden frame and a little blind.
    pane(60, 68, 136, 100, '#5a3d2a', [[0, '#b9e4f7'], [0.5, '#7fb4d6'], [1, '#a9d8f0']]);
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(124, 74, 8, 88);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(66, 74, 124, 20);
    heightCtx.fillStyle = '#d8d8d8';
    heightCtx.fillRect(124, 74, 8, 88);
    finishCtx.fillStyle = 'rgb(0 215 0)';
    finishCtx.fillRect(124, 74, 8, 88);
    finishCtx.fillRect(66, 74, 124, 20);
  } else {
    [[28, 60], [144, 60]].forEach(([x, y]) => {
      pane(x, y, 84, 120, '#3b4a5c', [[0, '#c9e8ff'], [0.45, '#5f8bb6'], [0.55, '#7aa6cf'], [1, '#b4daf5']]);
      // A bar across, and a streak of light on the glass.
      ctx.fillStyle = '#3b4a5c';
      ctx.fillRect(x + 6, y + 44, 72, 5);
      heightCtx.fillStyle = '#d8d8d8';
      heightCtx.fillRect(x + 6, y + 44, 72, 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(x + 14, y + 110);
      ctx.lineTo(x + 40, y + 10);
      ctx.lineTo(x + 54, y + 10);
      ctx.lineTo(x + 28, y + 110);
      ctx.fill();
    });
  }
  // Plain wall in the corner (sampled for tops and sides).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 20, 20);
  heightCtx.fillStyle = '#b0b0b0';
  heightCtx.fillRect(0, 0, 20, 20);
  finishCtx.fillStyle = 'rgb(0 215 0)';
  finishCtx.fillRect(0, 0, 20, 20);
  return { map: toTexture(color), height: toTexture(height, { color: false }), finish: toTexture(finish, { color: false }) };
}

// A graffiti wall for the city.
export function graffitiTexture() {
  const width = 512;
  const height = 128;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8f8a84';
  ctx.fillRect(0, 0, width, height);
  overlayNoise(ctx, width, height, noiseCanvas(64, 4, 3, 31), 0.3);
  const blobs = [['#ff3fa4', 40], ['#35c8ff', 170], ['#ffd23f', 300], ['#7cff6a', 420]];
  blobs.forEach(([color, x], i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x + 40, 64, 64, 40, (i - 1.5) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.font = 'italic 900 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a1030';
  ctx.strokeText('SKATE!', width / 2, 66);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('SKATE!', width / 2, 66);
  return toTexture(canvas, { repeat: false });
}

// Where a surface is rough and where it is smooth, as soft patches:
// polished concrete, icy snow, damp stone. `low` and `high` are the
// roughness of the smoothest and the roughest patches (0 to 1).
export function finishTexture(seed, low, high) {
  const canvas = noiseCanvas(128, 3, 4, seed);
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    // Stretch the middle of the noise, so there are clear patches.
    const t = Math.min(1, Math.max(0, (data[i] / 255 - 0.36) / 0.28));
    const value = (low + (high - low) * t * t * (3 - 2 * t)) * 255;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
  return toTexture(canvas, { color: false });
}

// Gentle bumps for water, sand dunes and snow.
export function bumpTexture(seed = 41) {
  return toTexture(noiseCanvas(256, 8, 4, seed), { color: false });
}

export function softDotTexture() {
  const canvas = makeCanvas(64, 64);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(canvas, { repeat: false });
}

// A floating letter on a glowing badge.
export function letterTexture(letter, color) {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
  glow.addColorStop(0, color);
  glow.addColorStop(0.7, color);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#1a1030';
  ctx.stroke();
  ctx.font = '900 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a1030';
  ctx.fillText(letter, 64, 68);
  return toTexture(canvas, { repeat: false });
}
