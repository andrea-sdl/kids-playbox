import { THREE } from './model-kit.js';
import { places } from './world.js';
import { worldX } from './ground.js';
import { woodModel } from './models-wood.js';
import { waterModel } from './models-water.js';
import { starModel } from './models-star.js';

// Each arrangement has a physical place on the route. The same model performs
// its action in close-up, including when the journal recalls a distant place.
const locations = new Map();
for (const [room, place] of Object.entries(places)) {
  for (const [id, [x]] of Object.entries(place.points)) locations.set(id, { room, x });
}
export const memoryRoom = (id) => locations.get(id)?.room;

const sizes = {
  tree: 1.65,
  owl: 1.02,
  scope: 1.5,
  signal: 1.15,
  stars: 0.88,
  stairs: 1.12,
  tea: 0.63,
  coin1: 0.44,
  coin2: 0.44,
  coin3: 0.44,
  pods: 0.68,
  bell: 0.93,
};
const bases = { tea: 0.42, bell: 1.5, quilt: 0.55, moth: 0.45, carp: 0.04 };
const depths = { tea: -4.4, carp: -2.4, boat: -1.9, signal: -3.1, tree: -3.3, bell: -2.0, quilt: -3.2 };

export function discovery(id) {
  const { room, x } = locations.get(id);
  const rig = woodModel(id) || waterModel(id) || starModel(id);
  const group = rig.group;
  const scale = sizes[id] ?? 0.83;
  group.scale.multiplyScalar(scale);
  group.position.set(worldX(room, x), bases[id] ?? 0.035, depths[id] ?? -1.7);
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const anchor = new THREE.Vector3(center.x, bounds.max.y + 0.15, center.z);
  // The coin and the moth rise during the shot. Leave air for their arc.
  if (id.startsWith('coin')) center.y = group.position.y + 0.96 * scale;
  if (id === 'moth') center.y += 0.3 * scale;
  const shotHeight = Math.max(2.85 * scale, size.y * 1.38);
  return { ...rig, room, anchor, center, shotHeight, shotWidth: Math.max(3 * scale, size.x * 1.27) };
}
