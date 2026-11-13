// The sea, seen from high above: trains of waves that move, the sky
// mirrored more strongly at a low angle (as on real water), a path of
// glitter toward the sun, pale turquoise shallows by the shore, lines of
// surf rolling in to the foot of the cliff, whitecaps further out, and
// haze toward the horizon. All of it is worked out per pixel.

import * as THREE from '../vendor/three/three.min.js';

const VERTEX = `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = `
  uniform float time;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform vec3 deep;
  uniform vec3 shallow;
  uniform vec3 haze;
  uniform vec3 skyTop;
  uniform vec3 skyHorizon;
  uniform vec3 origin;
  uniform float shoreSide;
  uniform float shoreDistance;
  uniform float hazeDensity;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  // How much the water tilts at a point: several trains of waves, each
  // shorter, weaker and turned a little from the one before.
  vec2 tilt(vec2 p, float t, float soften) {
    vec2 slope = vec2(0.0);
    vec2 dir = normalize(vec2(0.8, 0.6));
    float size = 0.6;
    float count = 0.013;
    for (int i = 0; i < WAVES; i++) {
      float bend = noise(p * count * 0.45 + float(i) * 7.0) * 4.2;
      slope += dir * cos(dot(p, dir) * count + t * (0.55 + 0.3 * float(i)) + bend) * size;
      dir = mat2(0.82, -0.57, 0.57, 0.82) * dir;
      count *= 1.85;
      // Short waves blur together far away.
      size *= 0.64 * mix(1.0, soften, 0.5);
    }
    return slope;
  }

  void main() {
    vec2 p = vWorld.xz;
    vec3 toEye = cameraPosition - vWorld;
    float distance = length(toEye);
    vec3 view = toEye / distance;
    float soften = 1.0 / (1.0 + distance * 0.0009);
    vec2 slope = tilt(p, time, soften) * 0.11;
    slope += (vec2(noise(p * 0.3 + time * 0.35), noise(p * 0.3 - time * 0.3 + 19.0)) - 0.5) * 0.2 * soften;
    vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));

    // Looked at from low down, water is a mirror; from above, see-through.
    float mirror = 0.02 + 0.98 * pow(1.0 - max(dot(view, normal), 0.0), 5.0);
    vec3 bounce = reflect(-view, normal);
    bounce.y = abs(bounce.y);
    vec3 sky = mix(skyHorizon, skyTop, pow(clamp(bounce.y, 0.0, 1.0), 0.6));
    float toSun = max(dot(bounce, sunDir), 0.0);
    float glitter = pow(toSun, 260.0) * 7.0 + pow(toSun, 22.0) * 0.22;

    // Meters out from the foot of the cliff.
    float seaward = shoreSide * (vWorld.x - origin.x) - shoreDistance;
    float shelf = 1.0 - smoothstep(-40.0, 460.0, seaward + (noise(p * 0.004) - 0.5) * 320.0);
    vec3 body = mix(deep, shallow, shelf * shelf);
    // Sunlight glowing through the faces of the waves.
    body += shallow * max(0.0, slope.x * sunDir.x + slope.y * sunDir.z) * 0.3;
    vec3 color = mix(body, sky, mirror) + sunColor * glitter;

    // Surf: lines of foam rolling in, a white edge at the rocks, and
    // whitecaps further out.
    float roll = sin(seaward * 0.11 + time * 0.8 + noise(p * 0.015) * 9.0 + noise(p * 0.06) * 2.0);
    float nearShore = (1.0 - smoothstep(8.0, 95.0, seaward)) * smoothstep(-30.0, -5.0, seaward);
    float surf = smoothstep(0.72, 0.98, roll) * nearShore;
    surf += (1.0 - smoothstep(0.0, 26.0, seaward)) * smoothstep(-30.0, -5.0, seaward);
    surf *= 0.5 + 0.5 * noise(p * 0.28 + time * 0.3);
    float caps = smoothstep(0.62, 0.8, noise(p * 0.012 + time * 0.02) * noise(p * 0.21 - time * 0.05) * 1.7) * smoothstep(0.5, 0.9, noise(p * 0.9 + time * 0.2)) * 0.5 * soften;
    color = mix(color, vec3(1.0), clamp(surf + caps, 0.0, 1.0) * 0.92);

    float hazed = 1.0 - exp(-pow(distance * hazeDensity, 2.0));
    gl_FragColor = vec4(mix(color, haze, hazed), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// `detail` adds the short ripples (not on phones).
export function createSea(radius, { detail = true } = {}) {
  const geometry = new THREE.RingGeometry(1, radius, 72, 24);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    defines: { WAVES: detail ? 6 : 4 },
    uniforms: {
      time: { value: 0 },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      deep: { value: new THREE.Color() },
      shallow: { value: new THREE.Color() },
      haze: { value: new THREE.Color() },
      skyTop: { value: new THREE.Color() },
      skyHorizon: { value: new THREE.Color() },
      origin: { value: new THREE.Vector3() },
      shoreSide: { value: 1 },
      shoreDistance: { value: 100 },
      hazeDensity: { value: 0.0002 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const uniforms = material.uniforms;

  return {
    mesh,
    material,

    // `look` has the water's colors (deep, shallow), the sky's (top,
    // horizon, haze, sunColor), where the sun is (sunDirection), and the
    // shore: the open sea lies toward shoreSide (1 for +x, -1 for -x),
    // starting shoreDistance meters from the middle. hazeDensity is how
    // quickly the water fades into the haze.
    apply(look) {
      uniforms.deep.value.set(look.deep);
      uniforms.shallow.value.set(look.shallow);
      uniforms.haze.value.set(look.haze);
      uniforms.skyTop.value.set(look.top);
      uniforms.skyHorizon.value.set(look.horizon);
      uniforms.sunColor.value.set(look.sunColor);
      uniforms.sunDir.value.copy(look.sunDirection);
      uniforms.shoreSide.value = look.shoreSide;
      uniforms.shoreDistance.value = look.shoreDistance;
      uniforms.hazeDensity.value = look.hazeDensity;
    },

    // The sea is carried along with the viewer; the waves stay where they
    // are in the world. `origin` is where the middle of the sea is now.
    update(time, origin) {
      uniforms.time.value = time;
      uniforms.origin.value.copy(origin);
    },
  };
}
