import * as THREE from '../../vendor/three/three.min.js';

export { THREE };

const pigments = new Map();
const oval = new THREE.SphereGeometry(1, 20, 14);
const block = new THREE.BoxGeometry(1, 1, 1);
const vertical = new THREE.Vector3(0, 1, 0);
const bands = new THREE.DataTexture(new Uint8Array([76, 108, 179, 230, 251]), 5, 1, THREE.RedFormat);
bands.minFilter = bands.magFilter = THREE.NearestFilter;
bands.needsUpdate = true;

// Light is stepped like cel paint. Uneven pigment sits in object space so
// the brush marks stay attached when a joint turns or a camera moves.
export function material(color) {
  if (color?.isMaterial) return color;
  if (pigments.has(color)) return pigments.get(color);
  const paint = new THREE.MeshToonMaterial({ color, gradientMap: bands, side: THREE.DoubleSide });
  paint.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'varying vec3 vPigment;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n vPigment = position;',
      );
    shader.fragmentShader =
      'varying vec3 vPigment;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      vec3 p = vPigment * vec3(14.0,24.0,17.0);
      float fleck = sin(p.y + sin(p.x * 1.4)) * sin(p.z + p.x * .6);
      diffuseColor.rgb *= .972 + .055 * smoothstep(.32,.62,fleck);
      `,
      );
  };
  pigments.set(color, paint);
  return paint;
}

export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}
export function mesh(parent, geometry, color, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material(color));
  item.position.set(x, y, z);
  parent.add(item);
  return item;
}
export function egg(parent, color, x, y, z, rx, ry, rz) {
  const m = mesh(parent, oval, color, x, y, z);
  m.scale.set(rx, ry, rz);
  return m;
}
export function box(parent, color, x, y, z, width, height, depth) {
  const m = mesh(parent, block, color, x, y, z);
  m.scale.set(width, height, depth);
  return m;
}
export function rod(parent, color, from, to, radiusTop, radiusBottom = radiusTop) {
  const start = new THREE.Vector3(...from),
    end = new THREE.Vector3(...to);
  const axis = end.clone().sub(start);
  const cylinder = new THREE.CylinderGeometry(radiusTop, radiusBottom, axis.length(), 10);
  const m = mesh(parent, cylinder, color);
  m.position.copy(start).lerp(end, 0.5);
  m.quaternion.setFromUnitVectors(vertical, axis.normalize());
  return m;
}
export function ink(parent, color, points, width = 0.012) {
  const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const stroke = new THREE.TubeGeometry(path, Math.max(5, points.length * 3), width, 5, false);
  return mesh(parent, stroke, color);
}
