// The sky for Turbo Drive and Skate Star: a gradient, a sun that is brighter
// than white (so it glows), haze near the horizon, clouds lit from the
// sun's side with bright edges, and at night stars that twinkle and a moon.
// All of it is worked out per pixel, so there is nothing to download.

import * as THREE from '../vendor/three/three.min.js';

const VERTEX = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_Position.z = gl_Position.w;
  }
`;

const FRAGMENT = `
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 bottom;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform vec3 moonDir;
  uniform float sunSize;
  uniform float disc;
  uniform float stars;
  uniform float moon;
  uniform float clouds;
  uniform float time;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
      value += noise(p) * amplitude;
      p = p * 2.1 + vec2(13.7, 7.3);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 color = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.75, h), 0.65)) : mix(horizon, bottom, smoothstep(0.0, -0.2, h));
    float facing = max(dot(dir, sunDir), 0.0);
    float lowSun = 1.0 - smoothstep(0.0, 0.45, sunDir.y);
    // A warm haze around the sun, and a band of light along the horizon
    // when the sun is low.
    color += sunColor * (pow(facing, 6.0) * 0.4 + pow(facing, 60.0) * 0.8) * (1.0 - smoothstep(0.0, 0.6, h) * 0.4);
    color += sunColor * exp(-abs(h) * 10.0) * (0.12 + pow(facing, 3.0) * 0.5) * lowSun;
    color += sunColor * smoothstep(cos(sunSize), cos(sunSize * 0.7), facing) * disc;

    if (h > 0.0) {
      float cover = 0.0;
      if (clouds > 0.01) {
        vec2 uv = dir.xz / (h + 0.18) * 1.6;
        vec2 wind = vec2(time * 0.004, time * 0.0015);
        float shape = fbm(uv + wind);
        #ifdef CLOUD_DETAIL
          shape += (fbm(uv * 3.3 - wind * 2.0) - 0.5) * 0.22;
        #endif
        cover = smoothstep(0.56 - clouds * 0.34, 0.86, shape) * clouds * smoothstep(0.0, 0.22, h);
        // Thinner toward the sun means brighter: a cheap way to light them.
        vec2 sunward = normalize(sunDir.xz + vec2(0.0001)) * 0.16;
        float towardSun = fbm(uv + wind + sunward);
        float lit = clamp((shape - towardSun) * 2.6 + 0.62, 0.0, 1.0);
        vec3 shade = mix(horizon, top, 0.45) * 0.72 + vec3(0.06);
        vec3 bright = mix(horizon * 1.05 + 0.08, vec3(1.0), 0.6) + sunColor * 0.22;
        vec3 cloudColor = mix(shade, bright, lit);
        // Light shines through thin edges near the sun.
        cloudColor += sunColor * pow(facing, 5.0) * (1.0 - cover) * 1.4;
        color = mix(color, cloudColor, cover * 0.9);
      }
      if (stars > 0.01) {
        vec2 grid = dir.xz / (h + 0.05) * 140.0;
        vec2 cell = floor(grid);
        float seed = hash(cell);
        float twinkle = 0.75 + 0.25 * sin(time * (1.5 + seed * 4.0) + seed * 40.0);
        float star = step(0.9972, seed) * smoothstep(0.5, 0.1, length(fract(grid) - 0.5));
        vec3 starColor = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), fract(seed * 91.0));
        color += starColor * star * twinkle * 2.6 * stars * smoothstep(0.08, 0.5, h) * (1.0 - cover);
      }
      if (moon > 0.01) {
        float toMoon = dot(dir, moonDir);
        float moonDisc = smoothstep(0.9982, 0.9987, toMoon);
        vec2 face = dir.xz * 60.0;
        float seas = 0.82 + 0.18 * noise(face) - 0.12 * noise(face * 2.7);
        color += vec3(0.75, 0.82, 1.0) * pow(max(toMoon, 0.0), 300.0) * 0.5 * moon * (1.0 - cover);
        color = mix(color, vec3(1.25, 1.3, 1.45) * seas * 2.2, moonDisc * moon * (1.0 - cover * 0.8));
      }
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

// A direction in the sky from degrees above the horizon and around it.
export function skyDirection(elevation, azimuth) {
  const up = THREE.MathUtils.degToRad(elevation);
  const around = THREE.MathUtils.degToRad(azimuth);
  return new THREE.Vector3(Math.cos(up) * Math.sin(around), Math.sin(up), Math.cos(up) * Math.cos(around));
}

// `detail` adds wispy edges to the clouds (not on phones).
export function createSky(radius, { detail = true } = {}) {
  const defines = { OCTAVES: 4 };
  if (detail) {
    Object.assign(defines, { OCTAVES: 5, CLOUD_DETAIL: '' });
  }
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    defines,
    uniforms: {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      moonDir: { value: skyDirection(34, 20) },
      sunSize: { value: 0.03 },
      disc: { value: 10 },
      stars: { value: 0 },
      moon: { value: 0 },
      clouds: { value: 0 },
      time: { value: 0 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const uniforms = material.uniforms;

  return {
    mesh,
    material,

    // `look` has the colors (top, horizon, bottom, sunColor), where the sun
    // is (sunElevation, sunAzimuth, in degrees) and how much of the rest:
    // sunSize, disc (how bright the sun itself is), stars, moon, clouds.
    apply(look) {
      uniforms.top.value.set(look.top);
      uniforms.horizon.value.set(look.horizon);
      uniforms.bottom.value.set(look.bottom);
      uniforms.sunDir.value.copy(skyDirection(look.sunElevation, look.sunAzimuth));
      uniforms.sunColor.value.set(look.sunColor);
      uniforms.sunSize.value = look.sunSize;
      uniforms.disc.value = look.disc ?? 10;
      uniforms.stars.value = look.stars ?? 0;
      uniforms.moon.value = look.moon ?? 0;
      uniforms.clouds.value = look.clouds;
    },

    get sunDirection() {
      return uniforms.sunDir.value;
    },

    setTime(time) {
      uniforms.time.value = time;
    },
  };
}
