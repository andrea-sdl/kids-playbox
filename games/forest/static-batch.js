import { THREE } from './model-kit.js';

// Join timber, masonry and roof strands once per material. Moving parts
// (the waterfall sheet) keep their own transform and update callback.
export function batchLandmark(root) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const removed = [];
  root.traverse((obj) => {
    if (!obj.isMesh || obj.userData.animated || Array.isArray(obj.material)) return;
    const g = obj.geometry;
    const key = obj.material.uuid + '|' + Object.keys(g.attributes).sort().join(',');
    if (!buckets.has(key)) buckets.set(key, { material: obj.material, parts: [] });
    const transformed = g.index ? g.toNonIndexed() : g.clone();
    transformed.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, obj.matrixWorld));
    buckets.get(key).parts.push(transformed);
    removed.push(obj);
  });
  for (const { parts, material } of buckets.values()) {
    const geo = THREE.mergeGeometries(parts);
    root.add(new THREE.Mesh(geo, material));
    for (const g of parts) g.dispose();
  }
  for (const obj of removed) obj.removeFromParent();
  return root;
}
