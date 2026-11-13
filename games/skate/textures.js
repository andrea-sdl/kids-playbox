// Surfaces drawn in code: the track's markings, board graphics, windows and
// the floating letters, plus plain stand-ins for the ground, the track and
// the ramps. The real ground, track, rock and wood come from pictures in
// art/ (see scene.js); the stand-ins show if one is missing. Smooth noise
// keeps drawn surfaces from looking flat up close, and the scene works out
// bumps (normal maps) from all of these pictures.

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

/* ---------- Hill surfaces ---------- */

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

// The strip the rider goes down, seen from above: 21 m across the picture
// and 16 m along it, repeating along the way. Its edges fade out so it
// blends into the hillside (the road keeps hard edges). `pictures` may
// hold photos of the ground and of the track's own surface; without them
// everything is drawn here.
export function trackTexture(scenario, pictures = {}) {
  const width = 1024;
  const height = 1024;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const rand = random(71);
  const noise = noiseCanvas(256, 4, 4, 33);
  const fine = noiseCanvas(256, 16, 3, 34);
  // A line down the picture that sways and still joins up top to bottom.
  const sway = (y, size, turns = 1, start = 0) => Math.sin((y / height) * Math.PI * 2 * turns + start) * size;
  const band = (center, half, style, swaySize = 0, turns = 1) => {
    ctx.fillStyle = style;
    ctx.beginPath();
    for (let y = 0; y <= height; y += 16) {
      ctx.lineTo(center - half + sway(y, swaySize, turns), y);
    }
    for (let y = height; y >= 0; y -= 16) {
      ctx.lineTo(center + half + sway(y, swaySize, turns), y);
    }
    ctx.fill();
  };
  let fade = 0.16;
  if (scenario === 'meadow') {
    // Mown grass with a worn dirt trail down the middle.
    if (pictures.ground && pictures.track) {
      fillWith(ctx, pictures.ground, 0, 0, width, height);
      ctx.fillStyle = 'rgba(255, 255, 210, 0.1)';
      ctx.fillRect(0, 0, width, height);
      // The trail: a band of dirt whose edges fade into the grass.
      const trail = makeCanvas(width, height);
      const trailCtx = trail.getContext('2d');
      fillWith(trailCtx, pictures.track, 0, 0, width, height, 128);
      // Sun-dried: paler than the damp dirt of the photo.
      trailCtx.fillStyle = 'rgba(236, 214, 170, 0.34)';
      trailCtx.fillRect(0, 0, width, height);
      const edge = trailCtx.createLinearGradient(width / 2 - 120, 0, width / 2 + 120, 0);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(0.22, 'rgba(0,0,0,1)');
      edge.addColorStop(0.78, 'rgba(0,0,0,1)');
      edge.addColorStop(1, 'rgba(0,0,0,0)');
      trailCtx.globalCompositeOperation = 'destination-in';
      trailCtx.fillStyle = edge;
      trailCtx.fillRect(0, 0, width, height);
      ctx.drawImage(trail, 0, 0);
      // Two faint wheel ruts.
      band(width / 2 - 34, 11, 'rgba(70, 50, 30, 0.16)', 8);
      band(width / 2 + 34, 11, 'rgba(70, 50, 30, 0.16)', 8);
    } else {
      ctx.fillStyle = '#86cf55';
      ctx.fillRect(0, 0, width, height);
      overlayNoise(ctx, width, height, noise, 0.5, 'soft-light');
      for (let i = 0; i < 5000; i += 1) {
        const x = rand() * width;
        const y = rand() * height;
        ctx.strokeStyle = `rgba(${40 + rand() * 60}, ${130 + rand() * 90}, ${30 + rand() * 40}, 0.5)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 5, y - 5 - rand() * 7);
        ctx.stroke();
      }
      band(width / 2, 150, 'rgba(150, 170, 80, 0.55)', 26);
      band(width / 2, 118, '#b99866', 26);
      band(width / 2 - 52, 16, 'rgba(120, 92, 56, 0.3)', 26);
      band(width / 2 + 52, 16, 'rgba(120, 92, 56, 0.3)', 26);
      band(width / 2, 14, 'rgba(140, 165, 80, 0.5)', 26);
      for (let i = 0; i < 260; i += 1) {
        const y = rand() * height;
        const x = width / 2 + (rand() - 0.5) * 220 + sway(y, 26);
        const tone = 130 + rand() * 70;
        ctx.fillStyle = `rgba(${tone}, ${tone - 14}, ${tone - 40}, 0.7)`;
        ctx.beginPath();
        ctx.ellipse(x, y, 1 + rand() * 2.2, 0.8 + rand() * 1.6, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      overlayNoise(ctx, width, height, fine, 0.3);
    }
  } else if (scenario === 'sea') {
    fade = 0.05;
    // A coast road: a grass verge and a gravel shoulder on each side, then
    // asphalt with tar seams, worn wheel paths, edge lines and a dashed
    // middle.
    if (pictures.ground) {
      fillWith(ctx, pictures.ground, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#6fae4c';
      ctx.fillRect(0, 0, width, height);
      overlayNoise(ctx, width, height, noise, 0.4, 'soft-light');
    }
    const road = { left: 190, right: width - 190 };
    ctx.fillStyle = '#a79c88';
    ctx.fillRect(road.left - 56, 0, road.right - road.left + 112, height);
    for (let i = 0; i < 2600; i += 1) {
      const x = rand() < 0.5 ? road.left - 56 + rand() * 56 : road.right + rand() * 56;
      const tone = 120 + rand() * 90;
      ctx.fillStyle = `rgb(${tone}, ${tone - 6}, ${tone - 18})`;
      ctx.fillRect(x, rand() * height, 1.5 + rand() * 2.5, 1.5 + rand() * 2.5);
    }
    if (pictures.track) {
      fillWith(ctx, pictures.track, road.left, 0, road.right - road.left, height);
    } else {
      ctx.fillStyle = '#4c4d52';
      ctx.fillRect(road.left, 0, road.right - road.left, height);
      // Fine stone in the asphalt.
      for (let i = 0; i < 26000; i += 1) {
        const tone = 50 + rand() * 80;
        ctx.fillStyle = `rgba(${tone}, ${tone}, ${tone + 4}, 0.5)`;
        ctx.fillRect(road.left + rand() * (road.right - road.left), rand() * height, 1.6, 1.6);
      }
    }
    // Where the wheels run it is worn smoother and a little lighter.
    [0.27, 0.43, 0.57, 0.73].forEach((share) => {
      const x = road.left + (road.right - road.left) * share;
      const worn = ctx.createLinearGradient(x - 34, 0, x + 34, 0);
      worn.addColorStop(0, 'rgba(120, 120, 124, 0)');
      worn.addColorStop(0.5, 'rgba(120, 120, 124, 0.22)');
      worn.addColorStop(1, 'rgba(120, 120, 124, 0)');
      ctx.fillStyle = worn;
      ctx.fillRect(x - 34, 0, 68, height);
    });
    // Tar poured into cracks.
    ctx.strokeStyle = 'rgba(22, 22, 26, 0.8)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 7; i += 1) {
      let x = road.left + 30 + rand() * (road.right - road.left - 60);
      let y = rand() * height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k += 1) {
        x += (rand() - 0.5) * 44;
        y += 12 + rand() * 28;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#eeeee6';
    ctx.fillRect(road.left + 14, 0, 9, height);
    ctx.fillRect(road.right - 23, 0, 9, height);
    ctx.fillStyle = '#f0cf5e';
    [0, 512].forEach((y) => ctx.fillRect(width / 2 - 5, y + 60, 10, 200));
    // Paint wears off in specks.
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = 'rgba(76, 77, 82, 0.8)';
      const x = [road.left + 14, road.right - 23, width / 2 - 5][i % 3] + rand() * 10;
      ctx.fillRect(x, rand() * height, 2, 2);
    }
  } else if (scenario === 'mountain') {
    // A groomed ski run: fine lines from the snow machine, and old tracks.
    if (pictures.track) {
      fillWith(ctx, pictures.track, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#f2f6fc';
      ctx.fillRect(0, 0, width, height);
      for (let x = 0; x < width; x += 6) {
        ctx.fillStyle = 'rgba(150, 175, 215, 0.2)';
        ctx.fillRect(x, 0, 2, height);
      }
    }
    ctx.lineWidth = 5;
    for (let i = 0; i < 6; i += 1) {
      const center = 200 + rand() * 620;
      const size = 40 + rand() * 90;
      const start = rand() * 6;
      ctx.strokeStyle = 'rgba(140, 165, 210, 0.3)';
      ctx.beginPath();
      for (let y = 0; y <= height; y += 16) {
        ctx.lineTo(center + sway(y, size, 1 + (i % 2), start), y);
      }
      ctx.stroke();
    }
    overlayNoise(ctx, width, height, noise, 0.22);
    overlayNoise(ctx, width, height, fine, 0.2);
  } else {
    // A packed dirt track through red rock, with tire marks and stones.
    if (pictures.track) {
      fillWith(ctx, pictures.track, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#c98f5c';
      ctx.fillRect(0, 0, width, height);
      overlayNoise(ctx, width, height, noise, 0.55);
    }
    band(width / 2 - 90, 26, 'rgba(120, 70, 40, 0.2)', 40);
    band(width / 2 + 90, 26, 'rgba(120, 70, 40, 0.2)', 40);
    for (let i = 0; i < (pictures.track ? 0 : 700); i += 1) {
      const tone = 120 + rand() * 90;
      ctx.fillStyle = `rgba(${tone + 30}, ${tone - 10}, ${tone - 50}, 0.8)`;
      ctx.beginPath();
      ctx.ellipse(rand() * width, rand() * height, 1.5 + rand() * 5, 1.2 + rand() * 3.5, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    overlayNoise(ctx, width, height, fine, 0.35);
  }
  // Fade the sides out.
  const mask = ctx.createLinearGradient(0, 0, width, 0);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(fade, 'rgba(0,0,0,1)');
  mask.addColorStop(1 - fade, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  return toTexture(canvas);
}

// The hillside around the strip, 8 m square per repeat. It is light and
// nearly gray, because the hill's own colors are multiplied onto it.
export function groundTexture(scenario) {
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const rand = random(88);
  ctx.fillStyle = '#e4e4e0';
  ctx.fillRect(0, 0, size, size);
  overlayNoise(ctx, size, size, noiseCanvas(256, 4, 4, 61), 0.6);
  if (scenario === 'meadow' || scenario === 'sea') {
    // Blades of grass.
    for (let i = 0; i < 9000; i += 1) {
      const x = rand() * size;
      const y = rand() * size;
      const tone = 150 + rand() * 105;
      ctx.strokeStyle = `rgba(${tone - 20}, ${tone}, ${tone - 40}, 0.55)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 6, y - 4 - rand() * 8);
      ctx.stroke();
    }
  } else if (scenario === 'mountain') {
    // Wind-blown snow.
    for (let i = 0; i < 60; i += 1) {
      ctx.strokeStyle = `rgba(170, 190, 225, ${0.1 + rand() * 0.15})`;
      ctx.lineWidth = 2 + rand() * 4;
      const y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size / 3, y + (rand() - 0.5) * 40, (size * 2) / 3, y + (rand() - 0.5) * 40, size, y);
      ctx.stroke();
    }
  } else {
    // Sand ripples and grit.
    for (let y = 0; y < size; y += 12) {
      ctx.strokeStyle = 'rgba(150, 110, 80, 0.22)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 16) {
        ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 4 + y) * 4);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 900; i += 1) {
      const tone = 130 + rand() * 100;
      ctx.fillStyle = `rgba(${tone}, ${tone - 20}, ${tone - 40}, 0.6)`;
      ctx.fillRect(rand() * size, rand() * size, 2, 2);
    }
  }
  overlayNoise(ctx, size, size, noiseCanvas(256, 24, 2, 62), 0.3);
  return toTexture(canvas);
}

// The tops of ramps, tables and ledges, 4 m square per repeat.
export function rampTexture(scenario) {
  const size = 256;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const noise = noiseCanvas(64, 3, 3, 21);
  if (scenario === 'meadow') {
    // Weathered wooden planks.
    for (let i = 0; i < 8; i += 1) {
      const tone = 172 - (i % 3) * 14;
      ctx.fillStyle = `rgb(${tone + 20}, ${tone - 18}, ${tone - 62})`;
      ctx.fillRect(0, i * 32, size, 32);
      ctx.fillStyle = 'rgba(60, 36, 16, 0.5)';
      ctx.fillRect(0, i * 32, size, 2);
    }
    overlayNoise(ctx, size, size, noise, 0.4);
  } else if (scenario === 'sea') {
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
