import { registerServiceWorker, setupFavoriteButton, STAR_SVG } from '../../shared/chrome.js';
import { readJSON, writeJSON } from '../../shared/store.js';
import { recordPlay } from '../../shared/progress.js';
import { COLORS, SHAPES, TEXTURES, World, anchorFor, shapeById } from './world.js';
import { createScene } from './scene.js';
import { createSounds } from './sound.js';

const GAME_ID = 'blocks';
const STORE_KEY = 'game:blocks';
const HISTORY_LIMIT = 200;
const TAP_DISTANCE = 8;
const TAP_TIME_MS = 600;

registerServiceWorker(GAME_ID);

const $ = (selector) => document.querySelector(selector);

const els = {
  holder: $('.canvas-holder'),
  loading: $('.loading'),
  hint: $('.hint'),
  tools: $('.tools'),
  finish: $('.finish'),
  rotate: $('.rotate-button'),
  shapes: $('.shapes'),
  colors: $('.colors'),
  textures: $('.textures'),
  undo: $('.undo-button'),
  clear: $('.clear-button'),
  zoomIn: $('.zoom-in'),
  zoomOut: $('.zoom-out'),
  timeSlider: $('.time-slider'),
  timeText: $('.time-text'),
  clock: $('.clock-input'),
  timePanel: $('.time-panel'),
  sound: $('.sound-button'),
  favorite: $('.favorite-button'),
};

/* ---------- Saved state ---------- */

const TOOLS = [
  { id: 'build', label: 'Build' },
  { id: 'paint', label: 'Paint' },
  { id: 'remove', label: 'Remove' },
];

function loadSettings(raw) {
  const settings = {
    tool: 'build', shape: 'brick', color: COLORS[0], finish: 'plain', texture: 'brick',
    rotation: 0, hour: 12, followClock: true, sound: true,
  };
  if (!raw || typeof raw !== 'object') {
    return settings;
  }
  if (TOOLS.some((tool) => tool.id === raw.tool)) {
    settings.tool = raw.tool;
  }
  if (shapeById(raw.shape)) {
    settings.shape = raw.shape;
  }
  if (typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color)) {
    settings.color = raw.color;
  }
  if (raw.finish === 'plain' || raw.finish === 'textured') {
    settings.finish = raw.finish;
  }
  if (TEXTURES.includes(raw.texture)) {
    settings.texture = raw.texture;
  }
  if (Number.isInteger(raw.rotation)) {
    settings.rotation = ((raw.rotation % 4) + 4) % 4;
  }
  if (typeof raw.hour === 'number' && raw.hour >= 0 && raw.hour <= 24) {
    settings.hour = raw.hour;
  }
  if (typeof raw.followClock === 'boolean') {
    settings.followClock = raw.followClock;
  }
  if (typeof raw.sound === 'boolean') {
    settings.sound = raw.sound;
  }
  return settings;
}

const saved = readJSON(STORE_KEY, null);
const settings = loadSettings(saved && saved.settings);
let world = World.fromJSON(saved && saved.blocks);
const isFirstVisit = !saved;
const history = [];
const sounds = createSounds();
let scene = null;
let recordedThisVisit = false;
let saveTimer = null;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    writeJSON(STORE_KEY, { settings, blocks: world.toJSON() });
  }, 250);
}

/* ---------- A little starter build for the first visit ---------- */

function starterBlocks() {
  const blocks = [];
  const red = '#e3342f';
  const x0 = 8;
  const z0 = 10;
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      for (let z = 0; z < 4; z += 1) {
        const onEdge = x === 0 || x === 4 || z === 0 || z === 3;
        const isDoor = z === 3 && x === 2;
        if (onEdge && !isDoor) {
          blocks.push({ shape: 'brick', x: x0 + x, y, z: z0 + z, rotation: 0, color: red, texture: null });
        }
      }
    }
  }
  [[0, 0], [2, 0], [0, 2], [2, 2]].forEach(([dx, dz]) => {
    blocks.push({ shape: 'square', x: x0 + dx, y: 2, z: z0 + dz, rotation: 0, color: '#233dab', texture: null });
  });
  [0, 1, 2, 3].forEach((dz) => {
    blocks.push({ shape: 'brick', x: x0 + 4, y: 2, z: z0 + dz, rotation: 0, color: '#233dab', texture: null });
  });
  blocks.push({ shape: 'arch', x: x0 + 1, y: 2, z: z0 + 4, rotation: 0, color: '#ffd23f', texture: null });
  blocks.push({ shape: 'round', x: 16, y: 0, z: 9, rotation: 0, color: '#8a5a33', texture: 'wood' });
  blocks.push({ shape: 'round', x: 16, y: 1, z: 9, rotation: 0, color: '#8a5a33', texture: 'wood' });
  blocks.push({ shape: 'cone', x: 16, y: 2, z: 9, rotation: 0, color: '#38c172', texture: 'leaves' });
  return blocks;
}

/* ---------- Dock ---------- */

const SHAPE_ICONS = {
  brick: '<rect x="14" y="20" width="20" height="18" rx="2"/><rect x="19" y="14" width="10" height="6" rx="1"/>',
  long: '<rect x="6" y="20" width="36" height="18" rx="2"/><rect x="9" y="14" width="10" height="6" rx="1"/><rect x="29" y="14" width="10" height="6" rx="1"/>',
  square: '<path d="M8 26l16-8 16 8v10l-16 8-16-8z"/><path d="M8 26l16 8 16-8M24 34v10" fill="none"/>',
  plank: '<rect x="2" y="22" width="44" height="12" rx="2"/><rect x="4" y="17" width="6" height="5" rx="1"/><rect x="15" y="17" width="6" height="5" rx="1"/><rect x="27" y="17" width="6" height="5" rx="1"/><rect x="38" y="17" width="6" height="5" rx="1"/>',
  ramp: '<path d="M8 38h32V14h-4L8 34z"/>',
  round: '<ellipse cx="24" cy="36" rx="12" ry="5"/><rect x="12" y="18" width="24" height="18"/><ellipse cx="24" cy="18" rx="12" ry="5"/>',
  cone: '<path d="M24 8l13 30H11z"/><ellipse cx="24" cy="38" rx="13" ry="4"/>',
  arch: '<path d="M4 38V16h40v22h-8v-6a12 12 0 0 0-24 0v6z"/>',
  dome: '<path d="M8 36a16 16 0 0 1 32 0z"/>',
};

function radioButton(className, checked, label, onSelect) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', String(checked));
  button.setAttribute('aria-label', label);
  button.title = label;
  button.addEventListener('click', onSelect);
  return button;
}

function renderTools() {
  const buttons = TOOLS.map((tool) => {
    const button = radioButton('', settings.tool === tool.id, tool.label, () => {
      settings.tool = tool.id;
      save();
      renderDock();
      scene?.setGhost(null);
    });
    button.textContent = tool.label;
    return button;
  });
  els.tools.replaceChildren(...buttons);

  const finishes = [['plain', 'Plain'], ['textured', 'Textured']].map(([id, label]) => {
    const button = radioButton('', settings.finish === id, label, () => {
      settings.finish = id;
      save();
      renderDock();
    });
    button.textContent = label;
    return button;
  });
  els.finish.replaceChildren(...finishes);
}

function renderShapes() {
  const buttons = SHAPES.map((shape) => {
    const button = radioButton('shape-button', settings.shape === shape.id, shape.name, () => {
      settings.shape = shape.id;
      settings.tool = 'build';
      save();
      renderDock();
    });
    button.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true" fill="${settings.color}" stroke="#2b2140" stroke-width="2.5" stroke-linejoin="round">${SHAPE_ICONS[shape.id]}</svg>`;
    return button;
  });
  els.shapes.replaceChildren(...buttons);
}

function renderColors() {
  const buttons = COLORS.map((color) => {
    const button = radioButton('swatch', settings.color === color, `Color ${color}`, () => {
      settings.color = color;
      save();
      renderDock();
    });
    button.style.background = color;
    return button;
  });
  const custom = document.createElement('label');
  custom.className = 'swatch custom-color';
  custom.title = 'Pick any color';
  custom.innerHTML = '<input type="color" aria-label="Pick any color">';
  const input = custom.querySelector('input');
  input.value = settings.color;
  if (!COLORS.includes(settings.color)) {
    custom.setAttribute('aria-checked', 'true');
    custom.style.background = settings.color;
  }
  input.addEventListener('input', () => {
    settings.color = input.value;
    save();
    renderDock();
  });
  els.colors.replaceChildren(...buttons, custom);
}

function renderTextures() {
  els.textures.hidden = settings.finish !== 'textured';
  const buttons = TEXTURES.map((texture) => {
    const button = radioButton('swatch texture-swatch', settings.texture === texture, texture, () => {
      settings.texture = texture;
      save();
      renderDock();
    });
    button.style.backgroundImage = `url(art/tex-${texture}.webp)`;
    button.style.backgroundColor = settings.color;
    return button;
  });
  els.textures.replaceChildren(...buttons);
}

function renderDock() {
  renderTools();
  renderShapes();
  renderColors();
  renderTextures();
  els.rotate.hidden = settings.tool !== 'build';
}

/* ---------- Building ---------- */

function currentTexture() {
  if (settings.finish === 'textured') {
    return settings.texture;
  }
  return null;
}

function candidateAt(cell) {
  return {
    shape: settings.shape,
    rotation: settings.rotation,
    color: settings.color,
    texture: currentTexture(),
    ...anchorFor(settings.shape, settings.rotation, cell),
  };
}

function remember(entry) {
  history.push(entry);
  if (history.length > HISTORY_LIMIT) {
    history.shift();
  }
}

function noteBuilding() {
  if (recordedThisVisit) {
    return;
  }
  recordedThisVisit = true;
  recordPlay(GAME_ID, 'Building');
}

function addBlock(block, { animate = true } = {}) {
  const id = world.add(block);
  if (id === null) {
    return null;
  }
  scene.addBlock(id, world.blocks.get(id), { animate });
  return id;
}

function act(target) {
  if (!target) {
    return;
  }
  sounds.unlock();
  if (settings.tool === 'build') {
    const block = candidateAt(target.cell);
    const id = addBlock(block);
    if (id === null) {
      sounds.nope();
      return;
    }
    remember({ type: 'add', block: world.blocks.get(id) });
    sounds.place();
    noteBuilding();
    save();
    return;
  }
  if (target.blockId === null) {
    return;
  }
  const before = world.blocks.get(target.blockId);
  if (settings.tool === 'paint') {
    const after = world.update(target.blockId, { color: settings.color, texture: currentTexture() });
    scene.updateBlock(target.blockId, after);
    remember({ type: 'paint', before, after });
    sounds.paint();
    save();
    return;
  }
  world.remove(target.blockId);
  scene.removeBlock(target.blockId);
  remember({ type: 'remove', block: before });
  sounds.remove();
  save();
}

// Find a block by its corner cell (ids change when blocks come back).
function idAt(block) {
  const found = world.blockAt([block.x, block.y, block.z]);
  if (!found) {
    return null;
  }
  return found.id;
}

function undo() {
  const entry = history.pop();
  if (!entry) {
    return;
  }
  if (entry.type === 'add') {
    const id = idAt(entry.block);
    if (id !== null) {
      world.remove(id);
      scene.removeBlock(id);
    }
  }
  if (entry.type === 'remove') {
    addBlock(entry.block, { animate: true });
  }
  if (entry.type === 'paint') {
    const id = idAt(entry.after);
    if (id !== null) {
      scene.updateBlock(id, world.update(id, { color: entry.before.color, texture: entry.before.texture }));
    }
  }
  sounds.remove();
  save();
}

let clearTimer = null;

function onClear() {
  if (!els.clear.classList.contains('is-armed')) {
    els.clear.classList.add('is-armed');
    els.clear.textContent = 'Tap again';
    clearTimer = setTimeout(disarmClear, 3000);
    return;
  }
  disarmClear();
  world.clear();
  scene.clearBlocks();
  history.length = 0;
  sounds.remove();
  save();
}

function disarmClear() {
  clearTimeout(clearTimer);
  els.clear.classList.remove('is-armed');
  els.clear.textContent = 'Clear';
}

/* ---------- Pointer: tap acts, drag looks around ---------- */

let press = null;

function updateGhost(event) {
  if (settings.tool !== 'build' || event.pointerType !== 'mouse') {
    scene.setGhost(null);
    return;
  }
  const target = scene.pick(event.clientX, event.clientY);
  if (!target) {
    scene.setGhost(null);
    return;
  }
  const block = candidateAt(target.cell);
  scene.setGhost(block, world.canPlace(block));
}

function setupPointer(canvas) {
  canvas.addEventListener('pointerdown', (event) => {
    // A second finger means pinch or pan, never a tap.
    if (!event.isPrimary) {
      if (press) {
        press.multi = true;
      }
      return;
    }
    press = { x: event.clientX, y: event.clientY, time: performance.now(), multi: false };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (press) {
      return;
    }
    updateGhost(event);
  });
  canvas.addEventListener('pointerleave', () => scene.setGhost(null));
  const release = (event) => {
    if (!press || !event.isPrimary) {
      return;
    }
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    const quick = performance.now() - press.time < TAP_TIME_MS;
    const wasTap = !press.multi && moved < TAP_DISTANCE && quick && event.type === 'pointerup';
    press = null;
    if (wasTap) {
      act(scene.pick(event.clientX, event.clientY));
      updateGhost(event);
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}

/* ---------- Time of day ---------- */

function hourName(hour) {
  if (hour >= 5 && hour < 7) {
    return 'Sunrise';
  }
  if (hour >= 7 && hour < 11) {
    return 'Morning';
  }
  if (hour >= 11 && hour < 14) {
    return 'Noon';
  }
  if (hour >= 14 && hour < 17) {
    return 'Afternoon';
  }
  if (hour >= 17 && hour < 19.5) {
    return 'Sunset';
  }
  if (hour >= 19.5 && hour < 21) {
    return 'Evening';
  }
  return 'Night';
}

function clockHour() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

function renderTime() {
  if (settings.followClock) {
    settings.hour = clockHour();
  }
  const hour = settings.hour;
  const whole = Math.floor(hour) % 24;
  const minutes = String(Math.round((hour - Math.floor(hour)) * 60) % 60).padStart(2, '0');
  els.timeText.textContent = `${whole}:${minutes} · ${hourName(hour)}`;
  els.timeSlider.value = String(hour);
  els.clock.checked = settings.followClock;
  let icon = '#ffd23f';
  if (hourName(hour) === 'Night' || hourName(hour) === 'Evening') {
    icon = '#dfe7ff';
  }
  if (hourName(hour) === 'Sunset' || hourName(hour) === 'Sunrise') {
    icon = '#ff8a3d';
  }
  els.timePanel.style.setProperty('--time-icon', icon);
  scene?.setTime(hour);
}

els.timeSlider.addEventListener('input', () => {
  settings.hour = Number(els.timeSlider.value);
  settings.followClock = false;
  renderTime();
  save();
});

els.clock.addEventListener('change', () => {
  settings.followClock = els.clock.checked;
  renderTime();
  save();
});

setInterval(() => {
  if (settings.followClock) {
    renderTime();
  }
}, 60000);

/* ---------- Other controls ---------- */

function renderSound() {
  els.sound.setAttribute('aria-pressed', String(settings.sound));
  let label = 'Sound is off. Turn sound on';
  if (settings.sound) {
    label = 'Sound is on. Turn sound off';
  }
  els.sound.setAttribute('aria-label', label);
  els.sound.title = label;
  els.sound.querySelector('.sound-on').toggleAttribute('hidden', !settings.sound);
  els.sound.querySelector('.sound-off').toggleAttribute('hidden', settings.sound);
  sounds.setEnabled(settings.sound);
}

function rotate() {
  settings.rotation = (settings.rotation + 1) % 4;
  save();
}

els.rotate.addEventListener('click', rotate);
els.undo.addEventListener('click', undo);
els.clear.addEventListener('click', onClear);
els.zoomIn.addEventListener('click', () => scene.zoomBy(0.8));
els.zoomOut.addEventListener('click', () => scene.zoomBy(1.25));
els.sound.addEventListener('click', () => {
  settings.sound = !settings.sound;
  save();
  renderSound();
  sounds.unlock();
  sounds.place();
});

document.addEventListener('keydown', (event) => {
  if (event.target.closest('input')) {
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.key.toLowerCase() === 'r') {
    rotate();
  }
});

els.favorite.innerHTML = STAR_SVG;
setupFavoriteButton(els.favorite, GAME_ID, 'Blocks');

/* ---------- Start ---------- */

renderSound();
renderDock();

try {
  scene = createScene(els.holder);
  els.loading.hidden = true;
  if (isFirstVisit) {
    world = World.fromJSON(starterBlocks());
    save();
  }
  world.blocks.forEach((block, id) => scene.addBlock(id, block));
  renderTime();
  setupPointer(scene.canvas);
} catch {
  els.loading.textContent = 'This device can’t show 3D right now. Try another browser.';
}
