// Bumps for flat surfaces. A normal map tells the light which way every
// little spot of a surface faces, so asphalt looks gritty, bricks stick out
// and window frames have depth, with no extra triangles. Here one is worked
// out from any picture drawn in code or loaded from a file: light parts of
// the picture count as high, dark parts as low.

import * as THREE from '../vendor/three/three.min.js';

function pixelsOf(source, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return { canvas, ctx, image: ctx.getImageData(0, 0, size.width, size.height) };
}

// `source` is a canvas or a loaded image. `strength` is how deep the bumps
// look. The picture is taken to repeat, so the edges match up.
export function normalMapFrom(source, { strength = 2, size = null, repeat = true } = {}) {
  const wanted = size || { width: source.width, height: source.height };
  const { canvas, ctx, image } = pixelsOf(source, wanted);
  const { width, height } = wanted;
  const data = image.data;
  const heights = new Float32Array(width * height);
  for (let i = 0; i < heights.length; i += 1) {
    heights[i] = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.59 + data[i * 4 + 2] * 0.11) / 255;
  }
  const edge = (value, max) => {
    if (repeat) {
      return (value + max) % max;
    }
    return Math.min(max - 1, Math.max(0, value));
  };
  for (let y = 0; y < height; y += 1) {
    const up = edge(y - 1, height) * width;
    const down = edge(y + 1, height) * width;
    for (let x = 0; x < width; x += 1) {
      const left = edge(x - 1, width);
      const right = edge(x + 1, width);
      const slopeX = (heights[y * width + right] - heights[y * width + left]) * strength;
      // Canvas rows run down, the texture's v runs up.
      const slopeY = (heights[down + x] - heights[up + x]) * strength;
      const length = Math.hypot(slopeX, slopeY, 1);
      const i = (y * width + x) * 4;
      data[i] = (-slopeX / length) * 127.5 + 127.5;
      data[i + 1] = (slopeY / length) * 127.5 + 127.5;
      data[i + 2] = (1 / length) * 127.5 + 127.5;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  texture.anisotropy = 8;
  return texture;
}

// Makes a normal map follow another texture's tiling.
export function matchTiling(texture, like) {
  texture.wrapS = like.wrapS;
  texture.wrapT = like.wrapT;
  texture.repeat.copy(like.repeat);
  texture.offset.copy(like.offset);
  return texture;
}
