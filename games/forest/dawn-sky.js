// The sky and its ridgelines are painted once at startup. The camera samples a
// window in each panorama; travel reveals new hills without dragging the sun.
import {
  CanvasTexture,
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
} from '../../vendor/three/three.min.js';

const WIDTH = 2048;
const HEIGHT = 720;
const SUN_X = 1148;
const SUN_Y = 315;
const clamp = (value) => Math.max(0, Math.min(1, value));

function seedRandom(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const randomNoise = seedRandom(4245153);
const lattice = Float32Array.from({ length: 65536 }, randomNoise);

// Interpolated value noise. Different scales give the paint both a broad wash
// and the little broken edges left by the tip of a brush.
function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let tx = x - ix;
  let ty = y - iy;
  tx *= tx * (3 - 2 * tx);
  ty *= ty * (3 - 2 * ty);
  const i = (ix & 255) + ((iy & 255) << 8);
  const j = ((ix + 1) & 255) + ((iy & 255) << 8);
  const upper = lattice[i] + (lattice[j] - lattice[i]) * tx;
  const lower =
    lattice[(i + 256) & 65535] + (lattice[(j + 256) & 65535] - lattice[(i + 256) & 65535]) * tx;
  return upper + (lower - upper) * ty;
}

const PAINT_SCALE = 0.75;

function surface(width) {
  const c = document.createElement('canvas');
  c.width = width * PAINT_SCALE;
  c.height = HEIGHT * PAINT_SCALE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.scale(PAINT_SCALE, PAINT_SCALE);
  return ctx;
}

function wash(ctx, x, y, r, color) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [at, tint] of color) glow.addColorStop(at, tint);
  ctx.fillStyle = glow;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function mix(a, b, fraction) {
  return a.map((v, i) => v + (b[i] - v) * fraction);
}

function skyWash() {
  const ctx = surface(WIDTH);
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  for (const [at, tint] of [
    [0, '#78a7b9'],
    [0.24, '#a7c5c9'],
    [0.4, '#eed4b0'],
    [0.51, '#ffc88b'],
    [0.67, '#e5c7b3'],
    [1, '#b0b2a1'],
  ]) {
    grad.addColorStop(at, tint);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  wash(ctx, SUN_X, SUN_Y, 370, [
    [0, 'rgba(255,242,168,.90)'],
    [0.18, 'rgba(255,225,143,.60)'],
    [0.49, 'rgba(255,218,156,.27)'],
    [1, 'rgba(255,220,175,0)'],
  ]);
  ctx.fillStyle = '#fff8c8';
  ctx.beginPath();
  ctx.arc(SUN_X, SUN_Y, 23, 0, Math.PI * 2);
  ctx.fill();

  paintClouds(ctx);
  return ctx;
}

function paintClouds(ctx) {
  // Deliberately leave a clear window around the sun and the right skyline.
  // Each ellipse describes a bank of cloud, not an individual painted puff.
  const banks = [
    [-70, -15, 560, 130, 0.18],
    [235, 30, 350, 99, -0.13],
    [515, 53, 283, 53, -0.16],
    [634, 35, 290, 38, -0.1],
    [277, 116, 265, 45, -0.17],
    [850, 40, 140, 12, -0.17],
    [1533, 79, 260, 58, -0.15],
    [1731, 43, 345, 87, -0.23],
    [2040, 28, 310, 102, -0.16],
    [1156, 111, 146, 19, -0.12],
    [1298, 93, 92, 13, -0.13],
    [936, 160, 81, 9, -0.11],
    [439, 202, 205, 29, -0.04],
    [386, 181, 53, 34, -0.12],
    [431, 164, 36, 42, -0.09],
    [462, 161, 42, 27, 0.05],
    [510, 180, 49, 23, -0.08],
    [558, 190, 64, 17, -0.08],
    [617, 196, 106, 12, -0.1],
    [267, 238, 181, 11, -0.08],
    [122, 264, 245, 18, -0.07],
    [730, 275, 205, 10, -0.03],
    [863, 267, 98, 6, -0.04],
    [1460, 235, 230, 15, 0.025],
    [1488, 216, 62, 19, -0.05],
    [1525, 210, 41, 30, -0.08],
    [1553, 201, 35, 21, -0.09],
    [1582, 214, 40, 17, -0.11],
    [1645, 237, 175, 16, 0.04],
    [1848, 231, 278, 38, -0.04],
    [1103, 335, 216, 5, -0.02],
    [1335, 318, 135, 6, 0.02],
  ];
  const width = ctx.canvas.width;
  const pixels = ctx.getImageData(0, 0, width, Math.ceil(370 * PAINT_SCALE));
  const data = pixels.data;
  const rng = seedRandom(73687);
  for (let row = 0; row < pixels.height; row++) {
    const y = row / PAINT_SCALE;
    const low = clamp(y / 330);
    const unit = 1 - low * 0.68;
    const topTint = mix([255, 229, 205], [255, 232, 169], low);
    const midTint = mix([226, 188, 185], [249, 194, 140], low);
    const darkTint = mix([157, 153, 173], [224, 165, 145], low);
    const rowBanks = banks.filter(
      ([, cy, rx, ry, slope]) => Math.abs(y - cy) < ry * 1.65 + rx * Math.abs(slope) + 25,
    );
    for (let column = 0; column < width; column++) {
      const x = column / PAINT_SCALE;
      const offset = 4 * (row * width + column);
      const grit = (rng() - 0.5) * 2.5;
      for (let k = 0; k < 3; k++) data[offset + k] += grit;
      if (!rowBanks.length) continue;
      const wx = x + 31 * unit * (noise(x / 88 + 9, y / 69) - 0.5);
      const wy = y + 36 * unit * (noise(x / 67, y / 52 + 5) - 0.5);
      let body = -2;
      let bottom = 0;
      for (const [cx, cy, rx, ry, rise] of rowBanks) {
        const dx = wx - cx;
        if (Math.abs(dx) > rx * 1.4) continue;
        const v = (wy - cy - dx * rise) / ry;
        const shape = 1 - (dx * dx) / (rx * rx) - v * v;
        if (shape > body) {
          body = shape;
          bottom = v;
        }
      }
      if (body < -0.72) continue;
      const swell = noise(wx / (58 * unit), wy / (34 * unit));
      const ripple = noise(wx / (19 * unit), wy / (11 * unit));
      const edges = noise(wx / (6 * unit), wy / (4.5 * unit));
      const density = body + (swell - 0.5) * 1.08 + (ripple - 0.5) * 0.39 + (edges - 0.5) * 0.12;
      if (density < 0.02) continue;
      const opacity = clamp((density - 0.02) * 7) * (0.91 - low * 0.22);
      // Soft apricot under-light, with two gouache values turning each billow.
      const light = 0.47 + bottom * 0.19 - density * 0.2 + (swell - 0.5) * 0.89 + (ripple - 0.5) * 0.28;
      const mid = clamp((light - 0.18) * 4.4);
      const rim = clamp((light - 0.45) * 4.5 + Math.max(0, 0.34 - density) * 1.15);
      const brush = (noise(x / 6 + y / 9, y / 2.7) - 0.5) * 3.2 + grit;
      for (let k = 0; k < 3; k++) {
        const base = darkTint[k] + (midTint[k] - darkTint[k]) * mid;
        const tint = base + (topTint[k] - base) * rim + brush;
        data[offset + k] += (tint - data[offset + k]) * opacity;
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return ctx;
}

function paintRange(ctx, opts) {
  const { baseline, amplitude, scale, seed, dark, bottom, trees } = opts;
  const width = ctx.canvas.width / PAINT_SCALE;
  const rng = seedRandom(seed * 1009);
  const profile = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    const u = x / scale;
    const crags = 1 - Math.abs(noise(u * 1.52, seed + 6) * 2 - 1);
    const hills =
      0.42 * noise(u, seed) +
      0.26 * crags +
      0.18 * noise(u * 2.38, seed + 1) +
      0.1 * noise(u * 6.1, seed + 2) +
      0.04 * noise(u * 20.4, seed + 3);
    profile[x] = baseline - amplitude * hills;
  }
  const paints = ctx.createLinearGradient(0, baseline - amplitude, 0, baseline + 70);
  paints.addColorStop(0, dark);
  paints.addColorStop(1, bottom);
  ctx.fillStyle = paints;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x < width; x++) ctx.lineTo(x, profile[x]);
  ctx.lineTo(width, HEIGHT);
  ctx.closePath();
  ctx.fill();

  const top = Math.floor((baseline - amplitude - 1) * PAINT_SCALE);
  const band = ctx.getImageData(0, top, ctx.canvas.width, Math.ceil((amplitude + 76) * PAINT_SCALE));
  const data = band.data;
  for (let column = 0; column < band.width; column++) {
    const x = Math.floor(column / PAINT_SCALE);
    for (let row = Math.floor(profile[x] * PAINT_SCALE) + 1; row < top + band.height; row++) {
      const y = row / PAINT_SCALE;
      const depth = y - profile[x];
      const haze = 1 - clamp(depth / (amplitude * 0.95 + 10));
      if (haze < 0.001) continue;
      // Gullies run downhill and turn in perspective. Their facing determines
      // whether the brush picks up golden light or the blue of forest shade.
      const sway = (noise(x / 93, y / 74 + seed) - 0.5) * depth * 0.88;
      const crest = Math.min(width - 13, Math.max(12, Math.floor(x - depth * 0.24 + sway)));
      const angle = (profile[crest - 10] - profile[crest + 10]) * 0.05;
      const flowX = x - depth * (0.2 + angle * 0.39) + sway;
      const facet = noise(flowX / 27, depth / 61 + seed) + 0.37 * noise(flowX / 8, depth / 20 + seed);
      const shade = Math.min(1, Math.max(-1, angle + (facet - 0.66) * 2.65));
      const woods = noise(x / 3, y / 4.5) + 0.55 * noise(x / 10, y / 9);
      const ink = ((shade > 0.18 ? 4 + shade * 13 : shade * 16) + (woods - 0.78) * 9) * haze;
      const pixel = 4 * ((row - top) * band.width + column);
      data[pixel] += ink * 1.22;
      data[pixel + 1] += ink * 0.85;
      data[pixel + 2] += ink * 0.54;
    }
  }
  ctx.putImageData(band, 0, top);

  if (trees) {
    ctx.fillStyle = dark;
    let x = 0;
    while (x < width) {
      const height = 1.2 + rng() * 3 + noise(x / 17, seed + 5) * 5;
      const y = profile[Math.floor(x)] + 1;
      const spread = height * (0.22 + rng() * 0.22);
      ctx.beginPath();
      ctx.moveTo(x - spread, y);
      ctx.lineTo(x - spread * 0.33, y - height * 0.7);
      ctx.lineTo(x, y - height);
      ctx.lineTo(x + spread * 0.26, y - height * 0.68);
      ctx.lineTo(x + spread, y);
      ctx.fill();
      x += 1 + rng() * 2.8;
    }
  }
}

function paintedTexture(ctx) {
  const texture = new CanvasTexture(ctx.canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function dawnSky() {
  const sky = skyWash();
  paintRange(sky, {
    baseline: 425,
    amplitude: 125,
    scale: 147,
    seed: 11,
    dark: '#ad9faf',
    bottom: '#eed3b7',
  });
  paintRange(sky, {
    baseline: 444,
    amplitude: 103,
    scale: 220,
    seed: 67,
    dark: '#918f9f',
    bottom: '#d9c5b1',
  });

  const hills = surface(3328);
  paintRange(hills, {
    baseline: 463,
    amplitude: 96,
    scale: 196,
    seed: 33,
    dark: '#909b9c',
    bottom: '#dfc8ab',
  });
  paintRange(hills, {
    baseline: 504,
    amplitude: 105,
    scale: 200,
    seed: 18,
    dark: '#728a88',
    bottom: '#c1b9a3',
    trees: true,
  });
  paintRange(hills, {
    baseline: 571,
    amplitude: 131,
    scale: 241,
    seed: 43,
    dark: '#557674',
    bottom: '#91a294',
    trees: true,
  });

  const material = new ShaderMaterial({
    uniforms: {
      distanceWalked: { value: 0 },
      atmosphere: { value: paintedTexture(sky) },
      foothills: { value: paintedTexture(hills) },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 point;
      varying float aspect;
      void main() {
        point = position.xy;
        aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
        gl_Position = vec4(position.xy, 0.9999, 1.);
      }`,
    fragmentShader: `
      uniform sampler2D atmosphere, foothills;
      uniform float distanceWalked;
      varying vec2 point;
      varying float aspect;
      void main() {
        float y = point.y * .5 + .5;
        float halfWidth = min(aspect * 360., 1000.);
        float center = mix(1094., 1024., smoothstep(.7, 1.55, aspect));
        vec3 skyColor = texture2D(atmosphere, vec2((center + point.x * halfWidth) / 2048., y)).rgb;
        vec4 hills = texture2D(foothills, vec2((1040. + distanceWalked * 3.95 + point.x * halfWidth) / 3328., y));
        gl_FragColor = vec4(mix(skyColor, hills.rgb, hills.a), 1.);
        #include <colorspace_fragment>
      }`,
  });
  const backdrop = new Mesh(new PlaneGeometry(2, 2), material);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1000;
  const group = new Group();
  group.add(backdrop);
  return {
    group,
    update(cameraX) {
      material.uniforms.distanceWalked.value = cameraX;
    },
  };
}
