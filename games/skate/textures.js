// Surfaces drawn in code: park floors, ramps, board graphics, windows,
// graffiti and the floating letters. Nothing to download, so it all works
// offline. Smooth noise keeps surfaces from looking flat up close.

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
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const noise = noiseCanvas(128, 4, 4, 11);
  if (scenario === 'city') {
    ctx.fillStyle = '#b9b8b4';
    ctx.fillRect(0, 0, size, size);
    overlayNoise(ctx, size, size, noise, 0.35);
    // Concrete slabs, 2 m each, with dark seams.
    ctx.strokeStyle = 'rgba(60, 58, 55, 0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 128, 0);
      ctx.lineTo(i * 128, size);
      ctx.moveTo(0, i * 128);
      ctx.lineTo(size, i * 128);
      ctx.stroke();
    }
    // A few oil spots and cracks.
    const rand = random(4);
    ctx.fillStyle = 'rgba(40, 38, 36, 0.12)';
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.ellipse(rand() * size, rand() * size, 10 + rand() * 20, 6 + rand() * 12, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    addGrain(ctx, size, size, 18, 3);
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
export function windowsTexture(style = 'city') {
  const size = 128;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, size - 10, size, 10);
  if (style === 'house') {
    // One wide window with a wooden frame and a little blind.
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(30, 34, 68, 50);
    ctx.fillStyle = '#9fd6f2';
    ctx.fillRect(34, 38, 60, 42);
    ctx.fillStyle = '#5a3d2a';
    ctx.fillRect(62, 38, 4, 42);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(34, 38, 60, 10);
  } else {
    [[14, 30], [72, 30]].forEach(([x, y]) => {
      ctx.fillStyle = '#3b4a5c';
      ctx.fillRect(x, y, 42, 60);
      const glass = ctx.createLinearGradient(x, y, x + 42, y + 60);
      glass.addColorStop(0, '#bfe3ff');
      glass.addColorStop(0.5, '#6f9bc4');
      glass.addColorStop(1, '#a8d2f0');
      ctx.fillStyle = glass;
      ctx.fillRect(x + 3, y + 3, 36, 54);
    });
  }
  // Plain wall in the corner (sampled for tops and sides).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 10, 10);
  return toTexture(canvas);
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
