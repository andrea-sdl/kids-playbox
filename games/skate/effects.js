// Particles: snow, sand and dust sprayed by the board, a puff on landing,
// sparks on rails, and bursts when a letter is picked up. Two pools (one
// soft and see-through, one glowing) drawn as points, so it is cheap.

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
  const soft = new Pool(320, dotTexture, false);
  const glow = new Pool(240, dotTexture, true);
  scene.add(soft.points);
  scene.add(glow.points);
  let carry = 0;

  return {
    // Matches the point size to the screen height in pixels.
    resize(height) {
      soft.material.uniforms.scale.value = height * 0.5;
      glow.material.uniforms.scale.value = height * 0.5;
    },

    // Spray from the board: snow, sand or a little dust, more when turning.
    trail(dt, { x, y, z, speed, turn, kind }) {
      if (kind === 'none') {
        return;
      }
      const rate = Math.min(1, speed / 12) * (kind === 'dust' ? 3 + turn * 10 : 8 + turn * 40);
      carry += rate * dt;
      while (carry >= 1) {
        carry -= 1;
        let color = '#d9d4cc';
        if (kind === 'snow') {
          color = '#f6f9ff';
        }
        if (kind === 'sand') {
          color = '#e9c58e';
        }
        soft.emit({
          life: 0.5 + Math.random() * 0.5,
          x: x + (Math.random() - 0.5) * 0.4,
          y: y + 0.1,
          z: z + (Math.random() - 0.5) * 0.4,
          vx: (Math.random() - 0.5) * 2.5,
          vy: 0.6 + Math.random() * (1 + turn * 2),
          vz: (Math.random() - 0.5) * 2.5,
          size: 0.25 + Math.random() * 0.3,
          grow: 1.1,
          drag: 2,
          gravity: kind === 'dust' ? 0 : 4,
          fade: kind === 'dust' ? 0.25 : 0.6,
          color,
        });
      }
    },

    // A puff where the board lands.
    puff(x, y, z, kind, strength) {
      let color = '#d9d4cc';
      if (kind === 'snow') {
        color = '#f6f9ff';
      }
      if (kind === 'sand') {
        color = '#e9c58e';
      }
      const count = Math.round(8 + strength * 14);
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2;
        soft.emit({
          life: 0.5 + Math.random() * 0.4,
          x, y: y + 0.1, z,
          vx: Math.cos(angle) * (2 + Math.random() * 2),
          vy: 0.5 + Math.random() * 1.5,
          vz: Math.sin(angle) * (2 + Math.random() * 2),
          size: 0.35 + Math.random() * 0.3,
          grow: 1.2,
          drag: 3,
          fade: kind === 'none' || kind === 'dust' ? 0.35 : 0.7,
          color,
        });
      }
    },

    // Sparks from a grind.
    sparks(x, y, z, vx, vz) {
      for (let i = 0; i < 3; i += 1) {
        glow.emit({
          life: 0.25 + Math.random() * 0.3,
          x, y, z,
          vx: -vx * 0.2 + (Math.random() - 0.5) * 5,
          vy: 1 + Math.random() * 4,
          vz: -vz * 0.2 + (Math.random() - 0.5) * 5,
          size: 0.12 + Math.random() * 0.1,
          gravity: 14,
          color: Math.random() < 0.5 ? '#ffb347' : '#ffe08a',
        });
      }
    },

    // A ring of glowing bits where a letter was picked up.
    burst(x, y, z, color) {
      for (let i = 0; i < 30; i += 1) {
        const angle = (i / 30) * Math.PI * 2;
        const speed = 4 + Math.random() * 4;
        glow.emit({
          life: 0.5 + Math.random() * 0.4,
          x, y, z,
          vx: Math.cos(angle) * speed,
          vy: 1 + Math.random() * 5,
          vz: Math.sin(angle) * speed,
          size: 0.3 + Math.random() * 0.3,
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
