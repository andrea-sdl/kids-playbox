import { registerServiceWorker, setupFavoriteButton, setupFullscreen, setupLanguage, STAR_SVG } from '../../shared/chrome.js';
import { t } from '../../shared/i18n.js';
import { readJSON, writeJSON } from '../../shared/store.js';
import { recordPlay } from '../../shared/progress.js';
import {
  ELEMENTS,
  ELEMENT_ORDER,
  MOLECULES,
  addBond,
  bondBetween,
  countElements,
  emptyBuild,
  formulaParts,
  freeHands,
  isComplete,
  markDone,
  matches,
  normalizeSave,
  parseFormula,
  removeAtom,
  targetBuild,
  unlockedCount,
  weakenBond,
} from './logic.js';
import { createSounds } from './sound.js';
import './strings.js';

const GAME_ID = 'molecules';
const STORE_KEY = 'game:molecules';
const ATOM_RADIUS = 30;
const BOND_LENGTH = 96;
const H_BOND_LENGTH = 80;
const BOND_GAP = 9;
const DRAG_START_PX = 6;
const WIN_DELAY_MS = 700;

registerServiceWorker(GAME_ID);
setupLanguage();

const $ = (selector) => document.querySelector(selector);

const els = {
  defs: $('.ball-defs defs'),
  prev: $('.level-prev'),
  next: $('.level-next'),
  levelButton: $('.level-button'),
  levelNumber: $('.level-number'),
  modeInputs: document.querySelectorAll('.mode input'),
  workspace: $('.workspace'),
  bonds: $('.workspace .bonds'),
  atoms: $('.workspace .atoms'),
  undo: $('.undo-button'),
  remove: $('.remove-button'),
  clear: $('.clear-button'),
  status: $('.status'),
  goal: $('.goal'),
  goalName: $('.goal-name'),
  goalFormula: $('.goal-formula'),
  goalPicture: $('.goal-picture'),
  goalMystery: $('.goal-mystery'),
  goalAtoms: $('.goal-atoms'),
  hint: $('.hint-button'),
  tray: $('.tray'),
  levels: $('.levels-dialog'),
  levelsList: $('.levels-list'),
  levelsClose: $('.levels-close'),
  win: $('.win-dialog'),
  winPicture: $('.win-picture'),
  winTitle: $('#win-title'),
  winFormula: $('.win-formula'),
  winFact: $('.win-fact'),
  winHard: $('.win-hard'),
  nextLevel: $('.next-level'),
  buildAgain: $('.build-again'),
  sound: $('.sound-button'),
  favorite: $('.favorite-button'),
};

let save = normalizeSave(readJSON(STORE_KEY, null));
const sounds = createSounds();

// The molecule being built.
let build = emptyBuild();
let history = [];
let selected = null;
let nextId = 1;
let hintShown = false;
let won = false;
let clearArmed = false;
let message = null;

// Workspace size in drawing units (atoms keep the same size in units; small
// screens show the units a bit smaller). Atoms stay between `top` and
// `bottom`, clear of the tool buttons and the status line.
let area = { width: 600, height: 400, top: 0, bottom: 400, scale: 1 };

function store() {
  writeJSON(STORE_KEY, save);
}

function molecule() {
  return MOLECULES[save.level];
}

function elementName(el) {
  return t(`element.${el}`);
}

function moleculeName(item) {
  return t(`molecule.${item.id}.name`);
}

function radiusOf(el) {
  return ATOM_RADIUS * ELEMENTS[el].size;
}

function formulaHtml(formula) {
  return formulaParts(formula).map(([el, count]) => {
    if (!count) {
      return el;
    }
    return `${el}<sub>${count}</sub>`;
  }).join('');
}

/* ---------- Shiny atom balls ---------- */

function mix(hex, target, amount) {
  const from = hex.match(/\w\w/g).map((part) => parseInt(part, 16));
  const to = target.match(/\w\w/g).map((part) => parseInt(part, 16));
  const out = from.map((value, i) => Math.round(value + (to[i] - value) * amount));
  return `rgb(${out.join(' ')})`;
}

function makeBallGradients() {
  els.defs.innerHTML = ELEMENT_ORDER.map((el) => {
    const color = ELEMENTS[el].color;
    return `
      <radialGradient id="ball-${el}" cx="0.36" cy="0.32" r="0.75">
        <stop offset="0" stop-color="${mix(color, '#ffffff', 0.75)}"/>
        <stop offset="0.35" stop-color="${color}"/>
        <stop offset="1" stop-color="${mix(color, '#000000', 0.45)}"/>
      </radialGradient>`;
  }).join('');
}

function ballMarkup(el, radius) {
  const ink = ELEMENTS[el].ink;
  const fontSize = radius * 0.78;
  return `
    <circle class="ball" r="${radius}" fill="url(#ball-${el})"/>
    <ellipse class="shine" cx="${-radius * 0.32}" cy="${-radius * 0.4}" rx="${radius * 0.32}" ry="${radius * 0.2}" transform="rotate(-25 ${-radius * 0.32} ${-radius * 0.4})"/>
    <text class="symbol" y="${fontSize * 0.36}" font-size="${fontSize}" fill="${ink}">${el}</text>`;
}

/* ---------- Drawing bonds and pictures ---------- */

// One, two or three parallel lines between two points.
function bondLines(x1, y1, x2, y2, order, gap) {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / length;
  const ny = (x2 - x1) / length;
  const lines = [];
  for (let i = 0; i < order; i += 1) {
    const offset = (i - (order - 1) / 2) * gap;
    lines.push(`<line x1="${x1 + nx * offset}" y1="${y1 + ny * offset}" x2="${x2 + nx * offset}" y2="${y2 + ny * offset}"/>`);
  }
  return lines.join('');
}

// A finished molecule, sized to fit its own viewBox.
function drawPicture(svg, item) {
  const unit = 80;
  const target = targetBuild(item);
  const xs = target.atoms.map((atom) => atom.x * unit);
  const ys = target.atoms.map((atom) => atom.y * unit);
  const pad = ATOM_RADIUS * 1.25;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - minX + pad;
  const height = Math.max(...ys) - minY + pad;
  svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
  const bonds = target.bonds.map((bond) => {
    const a = target.atoms[bond.a];
    const b = target.atoms[bond.b];
    return bondLines(a.x * unit, a.y * unit, b.x * unit, b.y * unit, bond.order, BOND_GAP);
  }).join('');
  const atoms = target.atoms.map((atom) => (
    `<g transform="translate(${atom.x * unit} ${atom.y * unit})">${ballMarkup(atom.el, radiusOf(atom.el) * 0.9)}</g>`
  )).join('');
  svg.innerHTML = `<g class="bond-lines">${bonds}</g>${atoms}`;
}

/* ---------- Where hands point, and where new atoms go ---------- */

function atomById(id) {
  return build.atoms.find((atom) => atom.id === id);
}

function bondLength(first, second) {
  if (first === 'H' || second === 'H') {
    return H_BOND_LENGTH;
  }
  return BOND_LENGTH;
}

function angleGap(first, second) {
  const diff = Math.abs(first - second) % (Math.PI * 2);
  return Math.min(diff, Math.PI * 2 - diff);
}

function inside(x, y, radius) {
  return x > radius && y > area.top + radius && x < area.width - radius && y < area.bottom - radius;
}

function crowded(x, y, skipIds) {
  return build.atoms.some((other) => {
    if (skipIds.includes(other.id)) {
      return false;
    }
    return Math.hypot(other.x - x, other.y - y) < radiusOf(other.el) * 2.1;
  });
}

// Directions of an atom's free hands: spread out, away from its bonds, and
// toward open space, so a new atom lands where a hand points.
function handAngles(atom) {
  const taken = [];
  const neighborIds = [];
  build.bonds.forEach((bond) => {
    let otherId = null;
    if (bond.a === atom.id) {
      otherId = bond.b;
    }
    if (bond.b === atom.id) {
      otherId = bond.a;
    }
    const other = atomById(otherId);
    if (other) {
      taken.push(Math.atan2(other.y - atom.y, other.x - atom.x));
      neighborIds.push(other.id);
    }
  });
  const angles = [];
  const length = bondLength(atom.el, 'C');
  for (let hand = 0; hand < freeHands(build, atom.id); hand += 1) {
    let best = null;
    let bestScore = -Infinity;
    for (let step = 0; step < 24; step += 1) {
      const angle = (step * Math.PI) / 12;
      let score = Math.PI;
      [...taken, ...angles].forEach((other) => {
        score = Math.min(score, angleGap(angle, other));
      });
      const x = atom.x + Math.cos(angle) * length;
      const y = atom.y + Math.sin(angle) * length;
      if (!inside(x, y, ATOM_RADIUS)) {
        score -= 2;
      }
      if (crowded(x, y, [atom.id, ...neighborIds])) {
        score -= 1.5;
      }
      if (score > bestScore + 0.001) {
        best = angle;
        bestScore = score;
      }
    }
    angles.push(best);
  }
  return angles;
}

function clampAtom(atom) {
  const radius = radiusOf(atom.el);
  atom.x = Math.min(Math.max(atom.x, radius), area.width - radius);
  atom.y = Math.min(Math.max(atom.y, area.top + radius), area.bottom - radius);
}

// An open spot for an atom that doesn't join anything yet.
function freeSpot() {
  const centerX = area.width / 2;
  const centerY = (area.top + area.bottom) / 2;
  for (let ring = 0; ring < 12; ring += 1) {
    const distance = ring * 50;
    const steps = Math.max(1, ring * 6);
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      if (inside(x, y, ATOM_RADIUS) && !build.atoms.some((atom) => Math.hypot(atom.x - x, atom.y - y) < 130)) {
        return { x, y };
      }
    }
  }
  return { x: centerX, y: centerY };
}

/* ---------- Workspace ---------- */

function measure() {
  const box = els.workspace.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) {
    return;
  }
  // Atoms shrink a little on narrow screens.
  const scale = Math.min(1, Math.max(0.72, box.width / 560));
  const tools = els.undo.getBoundingClientRect().bottom - box.top;
  const status = box.bottom - els.status.getBoundingClientRect().top;
  area = {
    width: box.width / scale,
    height: box.height / scale,
    top: tools / scale,
    bottom: (box.height - status) / scale,
    scale,
  };
  els.workspace.setAttribute('viewBox', `0 0 ${area.width} ${area.height}`);
  build.atoms.forEach(clampAtom);
}

function renderWorkspace() {
  const focusedId = document.activeElement?.closest?.('.workspace .atom')?.dataset.id;
  els.bonds.innerHTML = build.bonds.map((bond) => {
    const a = atomById(bond.a);
    const b = atomById(bond.b);
    return `
      <g class="bond order-${bond.order}" data-a="${bond.a}" data-b="${bond.b}">
        <line class="bond-hit" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>
        <g class="bond-lines">${bondLines(a.x, a.y, b.x, b.y, bond.order, BOND_GAP)}</g>
      </g>`;
  }).join('');
  els.atoms.innerHTML = build.atoms.map((atom) => {
    const radius = radiusOf(atom.el);
    const hands = handAngles(atom).map((angle) => {
      const x1 = Math.cos(angle) * (radius - 2);
      const y1 = Math.sin(angle) * (radius - 2);
      const x2 = Math.cos(angle) * (radius + 11);
      const y2 = Math.sin(angle) * (radius + 11);
      return `<line class="hand-arm" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle class="hand" cx="${x2}" cy="${y2}" r="5"/>`;
    }).join('');
    let classes = 'atom';
    if (atom.id === selected) {
      classes += ' is-selected';
    }
    const label = t('molecules.atomLabel', {
      element: elementName(atom.el),
      hands: t('molecules.freeHands', { count: freeHands(build, atom.id) }),
    });
    return `
      <g class="${classes}" data-id="${atom.id}" transform="translate(${atom.x} ${atom.y})" tabindex="0" role="button" aria-pressed="${atom.id === selected}" aria-label="${label}">
        <g class="atom-body">
          <circle class="pick-ring" r="${radius + 7}"/>
          ${hands}
          ${ballMarkup(atom.el, radius)}
        </g>
      </g>`;
  }).join('');
  if (focusedId) {
    els.atoms.querySelector(`[data-id="${focusedId}"]`)?.focus();
  }
}

/* ---------- Goal card ---------- */

function renderGoal() {
  const item = molecule();
  const easy = save.mode === 'easy';
  els.goal.classList.toggle('is-hard', !easy);
  els.goalName.textContent = moleculeName(item);
  els.goalFormula.innerHTML = formulaHtml(item.formula);
  const showAtoms = easy || hintShown;
  els.goalFormula.hidden = !showAtoms;
  els.goalPicture.toggleAttribute('hidden', !easy);
  els.goalMystery.hidden = easy || hintShown;
  els.hint.hidden = easy || hintShown;
  els.goalAtoms.hidden = !showAtoms;
  if (easy) {
    drawPicture(els.goalPicture, item);
  }
  renderCounts();
}

// Easy mode (or a hint) lists the atoms needed, ticking off what's built.
function renderCounts() {
  const needed = parseFormula(molecule().formula);
  const built = countElements(build.atoms);
  els.goalAtoms.innerHTML = Object.entries(needed).map(([el, count]) => {
    const have = built[el] || 0;
    let state = '';
    if (have === count) {
      state = 'is-done';
    }
    if (have > count) {
      state = 'is-over';
    }
    return `
      <li class="chip ${state}" title="${elementName(el)}">
        <svg viewBox="-30 -30 60 60" aria-hidden="true">${ballMarkup(el, 26)}</svg>
        <span><span class="visually-hidden">${elementName(el)}: </span>${have}/${count}</span>
      </li>`;
  }).join('');
}

/* ---------- Status line and tools ---------- */

function statusText() {
  if (message) {
    return message;
  }
  if (build.atoms.length === 0) {
    return t('molecules.start');
  }
  const atom = atomById(selected);
  if (atom) {
    const free = freeHands(build, atom.id);
    if (free === 0) {
      return t('molecules.pickedFull', { element: elementName(atom.el) });
    }
    return t('molecules.picked', { element: elementName(atom.el), hands: t('molecules.freeHands', { count: free }) });
  }
  if (isComplete(build) && !won) {
    let key = 'molecules.notYet';
    if (save.mode === 'hard') {
      key = 'molecules.notYetHard';
    }
    if (save.mode === 'hard' && hintShown) {
      key = 'molecules.notYetCount';
    }
    return t(key, { name: moleculeName(molecule()) });
  }
  return t('molecules.tip');
}

function renderTools() {
  els.status.textContent = statusText();
  els.undo.disabled = history.length === 0;
  els.remove.disabled = selected === null;
  els.clear.disabled = build.atoms.length === 0;
  els.clear.textContent = t('common.clear');
  if (clearArmed) {
    els.clear.textContent = t('common.tapAgain');
  }
  els.clear.classList.toggle('is-armed', clearArmed);
}

function render() {
  renderWorkspace();
  renderCounts();
  renderTools();
}

/* ---------- Changing the build ---------- */

function remember() {
  history.push(JSON.parse(JSON.stringify({ build, selected, nextId })));
  if (history.length > 100) {
    history.shift();
  }
}

function changed() {
  won = false;
  clearArmed = false;
  if (matches(build, targetBuild(molecule()))) {
    celebrate();
  }
  render();
}

function say(text) {
  message = text;
  renderTools();
}

// After a bond, keep the picked atom while it has free hands; otherwise
// move on to the new atom, so chains build one tap at a time.
function pickAfterBond(newAtomId) {
  if (freeHands(build, selected) > 0) {
    return;
  }
  selected = null;
  if (newAtomId !== null && freeHands(build, newAtomId) > 0) {
    selected = newAtomId;
  }
}

function addAtom(el) {
  sounds.unlock();
  message = null;
  remember();
  const atom = { id: nextId, el, x: 0, y: 0 };
  nextId += 1;
  const anchor = atomById(selected);
  if (anchor && freeHands(build, anchor.id) > 0) {
    const angle = handAngles(anchor)[0];
    const length = bondLength(anchor.el, el);
    atom.x = anchor.x + Math.cos(angle) * length;
    atom.y = anchor.y + Math.sin(angle) * length;
    clampAtom(atom);
    build = addBond({ atoms: [...build.atoms, atom], bonds: build.bonds }, anchor.id, atom.id);
    sounds.snap(1);
    pickAfterBond(atom.id);
  } else {
    Object.assign(atom, freeSpot());
    build = { atoms: [...build.atoms, atom], bonds: build.bonds };
    sounds.pop();
    selected = atom.id;
  }
  changed();
  popIn(atom.id);
}

function popIn(id) {
  const node = els.atoms.querySelector(`[data-id="${id}"]`);
  node?.classList.add('is-new');
}

function nudge(ids) {
  ids.forEach((id) => {
    const node = els.atoms.querySelector(`[data-id="${id}"]`);
    if (!node) {
      return;
    }
    node.classList.remove('is-nope');
    void node.getBoundingClientRect();
    node.classList.add('is-nope');
  });
}

function tapAtom(id) {
  sounds.unlock();
  message = null;
  if (selected === null || !atomById(selected)) {
    selected = id;
    sounds.pick();
    render();
    return;
  }
  if (selected === id) {
    selected = null;
    render();
    return;
  }
  const next = addBond(build, selected, id);
  if (!next) {
    let full = selected;
    if (freeHands(build, id) === 0) {
      full = id;
    }
    sounds.nope();
    render();
    nudge([full]);
    say(t('molecules.noHands', { element: elementName(atomById(full).el) }));
    return;
  }
  remember();
  build = next;
  sounds.snap(bondBetween(build, selected, id).order);
  pickAfterBond(id);
  changed();
}

function tapBond(a, b) {
  sounds.unlock();
  message = null;
  remember();
  build = weakenBond(build, a, b);
  sounds.unsnap();
  changed();
}

function tapBackground() {
  if (selected === null) {
    return;
  }
  selected = null;
  message = null;
  render();
}

function removeSelected() {
  if (selected === null) {
    return;
  }
  remember();
  build = removeAtom(build, selected);
  selected = null;
  message = null;
  sounds.unsnap();
  changed();
}

function undo() {
  const last = history.pop();
  if (!last) {
    return;
  }
  build = last.build;
  selected = last.selected;
  nextId = last.nextId;
  message = null;
  sounds.unsnap();
  changed();
}

function clearAll() {
  if (!clearArmed) {
    clearArmed = true;
    renderTools();
    return;
  }
  remember();
  build = emptyBuild();
  selected = null;
  message = null;
  sounds.unsnap();
  changed();
}

/* ---------- Pointer: tap to pick and join, drag to move ---------- */

let drag = null;

function pointInArea(event) {
  const box = els.workspace.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * area.width,
    y: ((event.clientY - box.top) / box.height) * area.height,
  };
}

els.workspace.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary) {
    return;
  }
  const atomNode = event.target.closest('.atom');
  const bondNode = event.target.closest('.bond');
  const point = pointInArea(event);
  drag = { startX: event.clientX, startY: event.clientY, moved: false, atomId: null, bond: null, dx: 0, dy: 0 };
  if (atomNode) {
    const atom = atomById(Number(atomNode.dataset.id));
    drag.atomId = atom.id;
    drag.dx = atom.x - point.x;
    drag.dy = atom.y - point.y;
  } else if (bondNode) {
    drag.bond = [Number(bondNode.dataset.a), Number(bondNode.dataset.b)];
  }
  els.workspace.setPointerCapture(event.pointerId);
});

els.workspace.addEventListener('pointermove', (event) => {
  if (!drag || !event.isPrimary || drag.atomId === null) {
    return;
  }
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_START_PX) {
    return;
  }
  drag.moved = true;
  const atom = atomById(drag.atomId);
  const point = pointInArea(event);
  atom.x = point.x + drag.dx;
  atom.y = point.y + drag.dy;
  clampAtom(atom);
  renderWorkspace();
});

els.workspace.addEventListener('pointerup', (event) => {
  if (!drag || !event.isPrimary) {
    return;
  }
  const done = drag;
  drag = null;
  if (done.moved) {
    return;
  }
  if (done.atomId !== null) {
    tapAtom(done.atomId);
    return;
  }
  if (done.bond) {
    tapBond(done.bond[0], done.bond[1]);
    return;
  }
  tapBackground();
});

els.workspace.addEventListener('pointercancel', () => {
  drag = null;
});

els.workspace.addEventListener('keydown', (event) => {
  const atomNode = event.target.closest('.atom');
  if (!atomNode || (event.key !== 'Enter' && event.key !== ' ')) {
    return;
  }
  event.preventDefault();
  tapAtom(Number(atomNode.dataset.id));
});

/* ---------- Atom tray ---------- */

function renderTray() {
  const buttons = ELEMENT_ORDER.map((el) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chunky-button tray-atom';
    const hands = ELEMENTS[el].hands;
    const dots = Array.from({ length: hands }, () => '<i></i>').join('');
    button.innerHTML = `
      <svg viewBox="-30 -30 60 60" aria-hidden="true">${ballMarkup(el, 27)}</svg>
      <span class="tray-name"></span>
      <span class="tray-hands" aria-hidden="true">${dots}</span>`;
    button.querySelector('.tray-name').textContent = elementName(el);
    const label = `${t('molecules.addAtom', { element: elementName(el) })} (${t('molecules.hands', { count: hands })})`;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.addEventListener('click', () => addAtom(el));
    return button;
  });
  els.tray.replaceChildren(...buttons);
}

/* ---------- Levels and modes ---------- */

function renderLevelBar() {
  els.levelNumber.textContent = `${save.level + 1}. ${moleculeName(molecule())}`;
  els.levelButton.setAttribute('aria-label', `${t('molecules.levelOf', { number: save.level + 1, total: MOLECULES.length })}: ${moleculeName(molecule())}. ${t('molecules.levels')}`);
  els.prev.disabled = save.level === 0;
  els.next.disabled = save.level + 1 >= unlockedCount(save.done);
  els.modeInputs.forEach((input) => {
    input.checked = input.value === save.mode;
  });
}

function startLevel(level) {
  save.level = level;
  store();
  build = emptyBuild();
  history = [];
  selected = null;
  hintShown = false;
  won = false;
  clearArmed = false;
  message = null;
  renderLevelBar();
  renderGoal();
  render();
}

function renderLevelsList() {
  const open = unlockedCount(save.done);
  const items = MOLECULES.map((item, index) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-card';
    const locked = index >= open;
    button.disabled = locked;
    if (index === save.level) {
      button.classList.add('is-current');
    }
    let mark = '';
    let markLabel = '';
    if (save.done[item.id] === 'easy') {
      mark = '<span class="level-mark is-easy" aria-hidden="true">✓</span>';
      markLabel = `, ${t('molecules.doneEasy')}`;
    }
    if (save.done[item.id] === 'hard') {
      mark = '<span class="level-mark is-hard" aria-hidden="true">★</span>';
      markLabel = `, ${t('molecules.doneHard')}`;
    }
    if (locked) {
      mark = '<span class="level-mark is-locked" aria-hidden="true">🔒</span>';
      markLabel = `. ${t('molecules.locked')}`;
    }
    button.innerHTML = `
      <span class="level-index">${index + 1}</span>
      <svg class="level-picture" aria-hidden="true"></svg>
      <span class="level-name"></span>
      ${mark}`;
    button.querySelector('.level-name').textContent = moleculeName(item);
    button.setAttribute('aria-label', `${index + 1}. ${moleculeName(item)}${markLabel}`);
    if (!locked) {
      drawPicture(button.querySelector('.level-picture'), item);
    }
    button.addEventListener('click', () => {
      els.levels.close();
      startLevel(index);
    });
    li.append(button);
    return li;
  });
  els.levelsList.replaceChildren(...items);
}

els.levelButton.addEventListener('click', () => {
  renderLevelsList();
  els.levels.showModal();
});

els.levelsClose.addEventListener('click', () => els.levels.close());

els.levels.addEventListener('click', (event) => {
  if (event.target === els.levels) {
    els.levels.close();
  }
});

els.prev.addEventListener('click', () => startLevel(save.level - 1));
els.next.addEventListener('click', () => startLevel(save.level + 1));

els.modeInputs.forEach((input) => {
  input.addEventListener('change', () => {
    if (!input.checked) {
      return;
    }
    save.mode = input.value;
    hintShown = false;
    message = null;
    store();
    renderGoal();
    renderTools();
  });
});

els.hint.addEventListener('click', () => {
  hintShown = true;
  renderGoal();
  renderTools();
});

/* ---------- Winning ---------- */

function celebrate() {
  won = true;
  selected = null;
  const item = molecule();
  save.done = markDone(save.done, item.id, save.mode);
  store();
  recordPlay(GAME_ID, { key: 'progress.molecules', vars: { count: Object.keys(save.done).length } });
  sounds.win();
  els.workspace.classList.remove('is-won');
  void els.workspace.getBoundingClientRect();
  els.workspace.classList.add('is-won');
  setTimeout(() => showWin(item), WIN_DELAY_MS);
}

function showWin(item) {
  if (!won || molecule() !== item) {
    return;
  }
  drawPicture(els.winPicture, item);
  els.winTitle.textContent = t('molecules.winTitle', { name: moleculeName(item) });
  els.winFormula.innerHTML = formulaHtml(item.formula);
  els.winFact.textContent = t(`molecule.${item.id}.fact`);
  els.winHard.hidden = save.mode !== 'hard';
  const isLast = save.level + 1 >= MOLECULES.length;
  els.nextLevel.textContent = t('molecules.nextLevel');
  if (isLast) {
    els.nextLevel.textContent = t('molecules.allDone');
  }
  els.nextLevel.disabled = isLast;
  renderLevelBar();
  els.win.showModal();
}

els.nextLevel.addEventListener('click', () => {
  els.win.close();
  startLevel(Math.min(save.level + 1, MOLECULES.length - 1));
});

els.buildAgain.addEventListener('click', () => {
  els.win.close();
  startLevel(save.level);
});

/* ---------- Tools, sound, chrome ---------- */

els.undo.addEventListener('click', undo);
els.remove.addEventListener('click', removeSelected);
els.clear.addEventListener('click', clearAll);

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && selected !== null && !event.target.closest('input, select, textarea')) {
    event.preventDefault();
    removeSelected();
  }
});

function renderSound() {
  els.sound.setAttribute('aria-pressed', String(save.sound));
  let label = t('common.soundOff');
  if (save.sound) {
    label = t('common.soundOn');
  }
  els.sound.setAttribute('aria-label', label);
  els.sound.title = label;
  els.sound.querySelector('.sound-on').toggleAttribute('hidden', !save.sound);
  els.sound.querySelector('.sound-off').toggleAttribute('hidden', save.sound);
  sounds.setEnabled(save.sound);
}

els.sound.addEventListener('click', () => {
  save.sound = !save.sound;
  store();
  renderSound();
  sounds.unlock();
  sounds.pop();
});

function relayout() {
  measure();
  render();
}

new ResizeObserver(relayout).observe(els.workspace);

setupFullscreen($('.fullscreen-button'), { slot: $('.focus-slot'), onChange: relayout });
els.favorite.innerHTML = STAR_SVG;
setupFavoriteButton(els.favorite, GAME_ID, t('game.molecules.title'));
makeBallGradients();
renderSound();
renderTray();
startLevel(save.level);
measure();
render();
