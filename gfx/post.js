// The camera's finishing touches, shared by the 3D games (Blocks, Turbo
// Drive, Skate Star). The scene is drawn into a bright (HDR) picture, then:
//   1. glow (bloom) spreads light from anything brighter than white;
//   2. one last pass works like a lens and a film: light shafts and flares
//      from the sun, a speed blur, color fringes at the edges, sharpening,
//      tone mapping, color grading, a vignette and fine grain.
// Phones get the short version of step 2, so it costs about what plain
// tone mapping did.

import * as THREE from '../vendor/three/three.min.js';

const VERTEX = `
  varying vec2 vUv;
  #ifdef USE_FLARE
    uniform sampler2D tDiffuse;
    uniform vec3 sunScreen;
    varying float vFlare;
    float sunLight(vec2 at) {
      vec3 s = texture2D(tDiffuse, clamp(at, 0.0, 1.0)).rgb;
      return max(s.r, max(s.g, s.b));
    }
  #endif
  void main() {
    vUv = uv;
    #ifdef USE_FLARE
      // Is the sun in view, or behind a building or a tree? Look at how
      // bright the picture is where the sun should be.
      vFlare = 0.0;
      vec2 at = sunScreen.xy;
      if (sunScreen.z > 0.0 && at.x > 0.0 && at.x < 1.0 && at.y > 0.0 && at.y < 1.0) {
        float light = sunLight(at) + sunLight(at + vec2(0.004, 0.0)) + sunLight(at - vec2(0.004, 0.0)) + sunLight(at + vec2(0.0, 0.006)) + sunLight(at - vec2(0.0, 0.006));
        float inside = min(min(at.x, 1.0 - at.x), min(at.y, 1.0 - at.y));
        vFlare = smoothstep(1.5, 5.0, light / 5.0) * smoothstep(0.0, 0.06, inside);
      }
    #endif
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = `
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float time;
  uniform float vignette;
  uniform float grain;
  uniform float aberration;
  uniform float saturation;
  uniform float contrast;
  uniform float sharpen;
  uniform float rays;
  uniform float rayFloor;
  uniform float flare;
  uniform float speed;
  uniform vec3 tint;
  uniform vec3 shadowTint;
  uniform vec3 sunScreen;
  uniform vec3 sunColor;
  varying vec2 vUv;
  #ifdef USE_FLARE
    varying float vFlare;
  #endif

  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 scene(vec2 uv) {
    return texture2D(tDiffuse, uv).rgb;
  }

  float disc(vec2 p, float radius) {
    return smoothstep(radius, radius * 0.25, length(p));
  }

  void main() {
    vec2 center = vUv - 0.5;
    float aspect = resolution.x / resolution.y;
    float edge = dot(center, center);

    #ifdef USE_ABERRATION
      // Colors split a little toward the corners, like a real lens.
      vec2 shift = center * edge * aberration;
      vec3 color = vec3(scene(vUv + shift).r, scene(vUv).g, scene(vUv - shift).b);
    #else
      vec3 color = scene(vUv);
    #endif

    #ifdef USE_SPEED
      // Going very fast: the edges of the picture streak toward the middle.
      if (speed > 0.001) {
        float amount = speed * smoothstep(0.015, 0.28, edge);
        float jitter = hash(gl_FragCoord.xy + time * 60.0);
        vec3 sum = color;
        for (int i = 1; i <= 6; i++) {
          sum += scene(vUv - center * amount * (float(i) - jitter) / 6.0);
        }
        color = sum / 7.0;
      }
    #endif

    #ifdef USE_SHARPEN
      vec2 px = 1.0 / resolution;
      vec3 around = scene(vUv + vec2(px.x, 0.0)) + scene(vUv - vec2(px.x, 0.0)) + scene(vUv + vec2(0.0, px.y)) + scene(vUv - vec2(0.0, px.y));
      color = max(vec3(0.0), color + clamp(color - around * 0.25, -0.2, 0.2) * sharpen);
    #endif

    #ifdef USE_RAYS
      // Shafts of light: walk from this pixel toward the sun and add up the
      // bright sky seen on the way. Anything in front of the sky is dark,
      // so it cuts the shafts, like trees and buildings do.
      if (rays > 0.001 && sunScreen.z > 0.0) {
        vec2 toSun = sunScreen.xy - vUv;
        float reach = length(toSun * vec2(aspect, 1.0));
        float fall = 1.0 - smoothstep(0.0, 1.15, reach);
        if (fall > 0.0) {
          vec2 stride = toSun / float(RAY_STEPS);
          vec2 at = vUv + stride * hash(gl_FragCoord.xy - time * 40.0);
          float weight = 1.0;
          vec3 shaft = vec3(0.0);
          for (int i = 0; i < RAY_STEPS; i++) {
            vec2 inside = step(vec2(0.0), at) * step(at, vec2(1.0));
            vec3 light = min(scene(at), vec3(5.0));
            float bright = max(light.r, max(light.g, light.b));
            shaft += light * smoothstep(rayFloor, rayFloor * 2.5, bright) * weight * inside.x * inside.y;
            weight *= 0.92;
            at += stride;
          }
          color += shaft / float(RAY_STEPS) * rays * fall * fall;
        }
      }
    #endif

    #ifdef USE_FLARE
      // Looking at the sun: soft ghosts across the picture and a wide streak.
      if (vFlare > 0.001 && flare > 0.001) {
        vec2 p = vec2(center.x * aspect, center.y);
        vec2 s = vec2((sunScreen.x - 0.5) * aspect, sunScreen.y - 0.5);
        vec3 ghosts = vec3(1.0, 0.62, 0.32) * disc(p + s * 0.42, 0.07) * 0.22;
        ghosts += vec3(0.4, 0.8, 1.0) * disc(p + s * 0.95, 0.12) * 0.14;
        ghosts += vec3(0.9, 0.5, 1.0) * disc(p - s * 0.4, 0.035) * 0.3;
        float ring = length(p + s * 1.6);
        ghosts += vec3(0.6, 1.0, 0.7) * smoothstep(0.02, 0.0, abs(ring - 0.24)) * 0.08;
        vec2 away = p - s;
        float streak = exp(-abs(away.y) * 70.0) * exp(-abs(away.x) * 2.4);
        float halo = exp(-length(away) * 5.0);
        color += (ghosts + vec3(0.65, 0.8, 1.0) * streak * 0.7 + vec3(halo * 0.3)) * sunColor * vFlare * flare;
      }
    #endif

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    // Grading, on the picture as the screen will show it.
    vec3 graded = gl_FragColor.rgb;
    float luma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
    graded = mix(vec3(luma), graded, saturation);
    graded = (graded - 0.5) * contrast + 0.5;
    graded += shadowTint * (1.0 - smoothstep(0.0, 0.55, luma));
    graded *= mix(vec3(1.0), tint, smoothstep(0.25, 1.0, luma));
    graded *= 1.0 - vignette * smoothstep(0.1, 0.62, edge);
    graded += (hash(gl_FragCoord.xy + fract(time) * 311.0) - 0.5) * grain * (1.0 - luma * 0.6);
    gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
  }
`;

// The neutral look: games change only what they need (see `look()`).
const DEFAULT_LOOK = {
  bloom: 0.4,
  threshold: 0.95,
  radius: 0.45,
  vignette: 0.32,
  grain: 0.03,
  aberration: 0.012,
  saturation: 1.08,
  contrast: 1.05,
  sharpen: 0.35,
  rays: 0,
  rayFloor: 1.2,
  flare: 0,
  tint: '#ffffff',
  shadowTint: '#000000',
  sunColor: '#ffffff',
};

// One big triangle that covers the screen.
function screenTriangle() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return geometry;
}

// The last pass. It has the few things EffectComposer asks of a pass.
class FinishPass {
  constructor(full) {
    this.enabled = true;
    this.needsSwap = true;
    this.clear = false;
    this.renderToScreen = false;
    const defines = {};
    if (full) {
      Object.assign(defines, { USE_ABERRATION: '', USE_SPEED: '', USE_SHARPEN: '', USE_RAYS: '', USE_FLARE: '', RAY_STEPS: 14 });
    }
    this.material = new THREE.ShaderMaterial({
      defines,
      uniforms: {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(1, 1) },
        time: { value: 0 },
        vignette: { value: 0 },
        grain: { value: 0 },
        aberration: { value: 0 },
        saturation: { value: 1 },
        contrast: { value: 1 },
        sharpen: { value: 0 },
        rays: { value: 0 },
        rayFloor: { value: 1 },
        flare: { value: 0 },
        speed: { value: 0 },
        tint: { value: new THREE.Color(1, 1, 1) },
        shadowTint: { value: new THREE.Color(0, 0, 0) },
        sunScreen: { value: new THREE.Vector3(0.5, 0.5, 0) },
        sunColor: { value: new THREE.Color(1, 1, 1) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(screenTriangle(), this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(width, height) {
    this.material.uniforms.resolution.value.set(width, height);
  }

  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

// `full` turns on everything; phones pass false. `msaa` is how many samples
// smooth the edges. Returns the pipeline: call render() each frame.
export function createPipeline(renderer, scene, camera, { full = true, msaa = 4, halfBloom = false } = {}) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: msaa });
  const composer = new THREE.EffectComposer(renderer, target);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.95);
  composer.addPass(bloom);
  const finish = new FinishPass(full);
  composer.addPass(finish);
  const uniforms = finish.material.uniforms;

  let width = 1;
  let height = 1;
  let pixelRatio = renderer.getPixelRatio();
  composer.setPixelRatio(pixelRatio);
  const sunDirection = new THREE.Vector3(0, 1, 0);
  const projected = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let current = { ...DEFAULT_LOOK };

  // Phones blur the glow at half size: it's soft anyway.
  function sizeBloom() {
    if (halfBloom) {
      bloom.setSize(Math.round((width * pixelRatio) / 2), Math.round((height * pixelRatio) / 2));
    }
  }

  function placeSun() {
    camera.getWorldDirection(forward);
    projected.copy(camera.position).addScaledVector(sunDirection, 1000).project(camera);
    const ahead = forward.dot(sunDirection) > 0.05;
    uniforms.sunScreen.value.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5, ahead ? 1 : 0);
  }

  return {
    composer,
    full,

    // Changes the look. Missing settings keep the neutral values above.
    look(settings = {}) {
      current = { ...DEFAULT_LOOK, ...settings };
      bloom.strength = current.bloom;
      bloom.threshold = current.threshold;
      bloom.radius = current.radius;
      ['vignette', 'grain', 'aberration', 'saturation', 'contrast', 'sharpen', 'rays', 'rayFloor', 'flare'].forEach((key) => {
        uniforms[key].value = current[key];
      });
      uniforms.tint.value.set(current.tint);
      uniforms.shadowTint.value.set(current.shadowTint);
      uniforms.sunColor.value.set(current.sunColor);
    },

    // Where the sun is (a direction in the world), for shafts and flares.
    setSun(direction) {
      sunDirection.copy(direction).normalize();
    },

    // 0 to about 0.2: how much the edges streak.
    setSpeed(amount) {
      uniforms.speed.value = amount;
    },

    get bloomOn() {
      return bloom.enabled;
    },

    // For devices that struggle: no more glow.
    dropBloom() {
      bloom.enabled = false;
    },

    setPixelRatio(ratio) {
      pixelRatio = ratio;
      composer.setPixelRatio(ratio);
      composer.setSize(width, height);
      sizeBloom();
    },

    setSize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
      composer.setSize(width, height);
      sizeBloom();
    },

    // `time` moves the film grain; pass the same number to keep it still.
    render(time = 0) {
      uniforms.time.value = time;
      placeSun();
      composer.render();
    },
  };
}
