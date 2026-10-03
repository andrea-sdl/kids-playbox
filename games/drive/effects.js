// Particles: tire smoke, dust and snow spray behind the car, sparks when
// scraping a barrier, and bursts when a point is collected. Two pools (one
// soft and see-through, one glowing) drawn as points, so it's cheap.

import * as THREE from '../../vendor/three/three.min.js';

const VERTEX = `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  varying float vAlpha;
  varying vec3 vTint;
  uniform float scale;
  void main() {
    vAlpha = alpha;
    vTint = tint;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / max(0.1, -view.z);
    gl_Position = projectionMatrix * view;
  }
`;

const FRAGMENT = `
  uniform sampler2D dot;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 texel = texture2D(dot, gl_PointCoord);
    gl_FragColor = vec4(vTint, texel.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }
`;

class Pool {
  constructor(count, dotTexture, additive) {
    this.count = count;
    this.next = 0;
    this.particles = Array.from({ length: count }, () => ({
      life: 0, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, grow: 0, gravity: 0, drag: 0, fade: 1, color: new THREE.Color(),
    }));
    this.positions = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.tints = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    geometry.setAttribute('tint', new THREE.BufferAttribute(this.tints, 3));
    this.material = new THREE.ShaderMaterial({
      uniforms: { dot: { value: dotTexture }, scale: { value: 400 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  emit({ color, ...options }) {
    const particle = this.particles[this.next];
    this.next = (this.next + 1) % this.count;
    Object.assign(particle, { age: 0, grow: 0, gravity: 0, drag: 0, fade: 1 }, options);
    particle.color.set(color);
  }

  update(dt) {
    this.particles.forEach((particle, i) => {
      if (particle.age >= particle.life) {
        this.alphas[i] = 0;
        return;
      }
      particle.age += dt;
      particle.vy -= particle.gravity * dt;
      const slow = Math.max(0, 1 - particle.drag * dt);
      particle.vx *= slow;
      particle.vy *= slow;
      particle.vz *= slow;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      particle.size += particle.grow * dt;
      const left = 1 - particle.age / particle.life;
      this.positions[i * 3] = particle.x;
      this.positions[i * 3 + 1] = particle.y;
      this.positions[i * 3 + 2] = particle.z;
      this.sizes[i] = particle.size;
      this.alphas[i] = Math.max(0, left) * particle.fade;
      this.tints[i * 3] = particle.color.r;
      this.tints[i * 3 + 1] = particle.color.g;
      this.tints[i * 3 + 2] = particle.color.b;
    });
    const attributes = this.points.geometry.attributes;
    attributes.position.needsUpdate = true;
    attributes.size.needsUpdate = true;
    attributes.alpha.needsUpdate = true;
    attributes.tint.needsUpdate = true;
  }
}

export function createEffects(scene, dotTexture) {
  const soft = new Pool(260, dotTexture, false);
  const glow = new Pool(220, dotTexture, true);
  scene.add(soft.points);
  scene.add(glow.points);
  let carry = 0;

  return {
    // Matches the point size to the screen height in pixels.
    resize(height) {
      soft.material.uniforms.scale.value = height * 0.5;
      glow.material.uniforms.scale.value = height * 0.5;
    },

    // Behind the rear wheels. `kind`: 'smoke' (city), 'dust' (jungle),
    // 'snow' or 'sand' (wasteland). More when fast, sliding or boosting.
    wheels(dt, { wheels, speed, slide, kind, nitro, exhausts }) {
      const rate = Math.min(1, speed / 30) * (kind === 'smoke' ? slide * 26 : 10 + slide * 30);
      carry += rate * dt;
      while (carry >= 1) {
        carry -= 1;
        const wheel = wheels[Math.floor(Math.random() * wheels.length)];
        let color = '#d8d8dc';
        if (kind === 'dust') {
          color = '#9a7048';
        }
        if (kind === 'sand') {
          color = '#e2b77a';
        }
        if (kind === 'snow') {
          color = '#f6f9ff';
        }
        soft.emit({
          life: 0.7 + Math.random() * 0.6,
          x: wheel.x + (Math.random() - 0.5) * 0.4,
          y: wheel.y + 0.2,
          z: wheel.z + (Math.random() - 0.5) * 0.4,
          vx: (Math.random() - 0.5) * 2,
          vy: 0.8 + Math.random() * 1.6,
          vz: (Math.random() - 0.5) * 2,
          size: 0.5 + Math.random() * 0.4,
          grow: 1.3,
          drag: 1.5,
          fade: kind === 'smoke' ? 0.3 : 0.45,
          color,
        });
      }
      if (nitro) {
        exhausts.forEach((exhaust) => {
          for (let i = 0; i < 2; i += 1) {
            glow.emit({
              life: 0.12 + Math.random() * 0.08,
              x: exhaust.x,
              y: exhaust.y,
              z: exhaust.z,
              vx: exhaust.vx * 8 + (Math.random() - 0.5),
              vy: (Math.random() - 0.5),
              vz: exhaust.vz * 8 + (Math.random() - 0.5),
              size: 0.22 + Math.random() * 0.14,
              grow: -0.8,
              color: Math.random() < 0.5 ? '#5cc8ff' : '#b47bff',
            });
          }
        });
      }
    },

    // Orange sparks where the car scrapes a barrier.
    sparks(x, y, z, vx, vz) {
      for (let i = 0; i < 6; i += 1) {
        glow.emit({
          life: 0.3 + Math.random() * 0.35,
          x, y, z,
          vx: vx * 0.6 + (Math.random() - 0.5) * 8,
          vy: 2 + Math.random() * 5,
          vz: vz * 0.6 + (Math.random() - 0.5) * 8,
          size: 0.18 + Math.random() * 0.15,
          gravity: 14,
          color: Math.random() < 0.5 ? '#ffb347' : '#ffe08a',
        });
      }
    },

    // A ring of glowing bits where a point was picked up.
    burst(x, y, z, color) {
      for (let i = 0; i < 28; i += 1) {
        const angle = (i / 28) * Math.PI * 2;
        const speed = 5 + Math.random() * 5;
        glow.emit({
          life: 0.5 + Math.random() * 0.4,
          x, y, z,
          vx: Math.cos(angle) * speed,
          vy: 1 + Math.random() * 6,
          vz: Math.sin(angle) * speed,
          size: 0.35 + Math.random() * 0.35,
          gravity: 6,
          drag: 2,
          color,
        });
      }
    },

    update(dt) {
      soft.update(dt);
      glow.update(dt);
    },
  };
}
