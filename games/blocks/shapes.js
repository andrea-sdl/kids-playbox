// 3D geometry for each block shape. Built once per shape and reused by
// every block of that shape. Each geometry is centered on x/z, sits on y=0,
// and is built for rotation 0 (the scene turns it).

import * as THREE from '../../vendor/three/three.min.js';
import { shapeById } from './world.js';

export const CELL_HEIGHT = 1.2; // bricks are a bit taller than wide
const GAP = 0.03; // tiny gap so neighboring blocks read as separate
const STUD_RADIUS = 0.19;
const STUD_HEIGHT = 0.16;

function roundedBox(width, height, depth) {
  const geometry = new THREE.RoundedBoxGeometry(width - GAP, height - GAP, depth - GAP, 2, 0.05);
  geometry.translate(0, height / 2, 0);
  return geometry;
}

function extruded(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - GAP, bevelEnabled: false, curveSegments: 24 });
  geometry.translate(0, 0, -(depth - GAP) / 2);
  return geometry;
}

function ramp(width, height, depth) {
  const w = (width - GAP) / 2;
  const top = height - GAP;
  const lip = 0.12;
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, top);
  shape.lineTo(w - 0.12, top);
  shape.lineTo(-w, lip);
  shape.closePath();
  return extruded(shape, depth);
}

function arch(width, height, depth) {
  const w = (width - GAP) / 2;
  const top = height - GAP;
  const radius = 0.5;
  const legTop = top - radius - 0.18;
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(-radius, 0);
  shape.lineTo(-radius, legTop);
  shape.absarc(0, legTop, radius, Math.PI, 0, true);
  shape.lineTo(radius, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, top);
  shape.lineTo(-w, top);
  shape.closePath();
  return extruded(shape, depth);
}

function round(height) {
  const geometry = new THREE.CylinderGeometry(0.47, 0.47, height - GAP, 32);
  geometry.translate(0, (height - GAP) / 2, 0);
  return geometry;
}

function cone(height) {
  const geometry = new THREE.ConeGeometry(0.48, height - GAP, 32);
  geometry.translate(0, (height - GAP) / 2, 0);
  return geometry;
}

function dome() {
  const geometry = new THREE.SphereGeometry(0.48, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  geometry.scale(1, 1.3, 1);
  return geometry;
}

function studs(width, depth, top) {
  const list = [];
  for (let x = 0; x < width; x += 1) {
    for (let z = 0; z < depth; z += 1) {
      const stud = new THREE.CylinderGeometry(STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 20);
      stud.translate(x - width / 2 + 0.5, top + STUD_HEIGHT / 2 - GAP, z - depth / 2 + 0.5);
      list.push(stud);
    }
  }
  return list;
}

// mergeGeometries needs every part to have the same attributes and no index.
function prepare(geometry) {
  let flat = geometry;
  if (geometry.index) {
    flat = geometry.toNonIndexed();
  }
  Object.keys(flat.attributes).forEach((name) => {
    if (!['position', 'normal', 'uv'].includes(name)) {
      flat.deleteAttribute(name);
    }
  });
  flat.clearGroups();
  return flat;
}

function build(shapeId, withStuds) {
  const shape = shapeById(shapeId);
  const [width, cells, depth] = shape.size;
  const height = cells * CELL_HEIGHT;
  let body = null;
  switch (shapeId) {
    case 'ramp':
      body = ramp(width, height, depth);
      break;
    case 'arch':
      body = arch(width, height, depth);
      break;
    case 'round':
      body = round(height);
      break;
    case 'cone':
      body = cone(height);
      break;
    case 'dome':
      body = dome();
      break;
    default:
      body = roundedBox(width, height, depth);
  }
  const parts = [body];
  if (withStuds && shape.studs) {
    parts.push(...studs(width, depth, height));
  }
  const merged = THREE.mergeGeometries(parts.map(prepare));
  merged.computeBoundingSphere();
  return merged;
}

const cache = new Map();

export function geometryFor(shapeId, withStuds) {
  const key = `${shapeId}-${withStuds}`;
  if (!cache.has(key)) {
    cache.set(key, build(shapeId, withStuds));
  }
  return cache.get(key);
}
