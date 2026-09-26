import { registerServiceWorker, setupFavoriteButton, setupLanguage, STAR_SVG } from '../../shared/chrome.js';
import { t } from '../../shared/i18n.js';
import './strings.js';
import { readJSON, writeJSON } from '../../shared/store.js';
import { recordPlay, clearProgress } from '../../shared/progress.js';
import {
  CHARACTERS,
  FACE_ROTATIONS,
  PIP_CELLS,
  MASCOTS,
  MIN_DICE,
  MAX_DICE,
  addRoll,
  clampDiceCount,
  clearResults,
  currentCharacter,
  normalizeState,
  randomInt,
  rollDice,
  sum,
} from './logic.js';
import { MASCOT_INFO } from './mascots.js';
import { createSounds } from './sound.js';
import { createMusic } from './music.js';

const GAME_ID = 'dice';
const STORE_KEY = 'game:dice';
const HISTORY_SHOWN = 10;

registerServiceWorker(GAME_ID);
setupLanguage();

const $ = (selector) => document.querySelector(selector);

const els = {
  pickerOptions: $('.picker-options'),
  lookSwitch: $('.look-switch'),
  mascot: $('.mascot'),
  bubble: $('.bubble'),
  mat: $('.mat'),
  tray: $('.dice-tray'),
  total: $('.result-total'),
  detail: $('.result-detail'),
  countMinus: $('.count-minus'),
  countPlus: $('.count-plus'),
  countValue: $('.count-value'),
  roll: $('.roll-button'),
  sound: $('.sound-button'),
  music: $('.music-button'),
  favorite: $('.favorite-button'),
  clear: $('.clear-button'),
  statRolls: $('.stat-rolls'),
  statBest: $('.stat-best'),
  history: $('.history'),
  historyEmpty: $('.history-empty'),
  faceBars: $('.face-bars'),
};

let state = normalizeState(readJSON(STORE_KEY, null));
let rolling = false;
const sounds = createSounds();
const music = createMusic();
// Browsers block audio until the first tap or key press.
let audioAllowed = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function save() {
  writeJSON(STORE_KEY, state);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pick(list) {
  return list[randomInt(list.length)];
}

/* ---------- Mascot ---------- */

function renderPicker() {
  const options = MASCOTS.map((id) => {
    const info = MASCOT_INFO[state.characters[id]];
    const label = document.createElement('label');
    label.className = 'picker-option';
    label.innerHTML = `<input type="radio" name="mascot" value="${id}">${info.face()}<span></span>`;
    label.querySelector('span').textContent = info.name;
    const input = label.querySelector('input');
    input.checked = id === state.mascot;
    input.addEventListener('change', () => {
      if (input.checked) {
        chooseMascot(id);
      }
    });
    return label;
  });
  els.pickerOptions.replaceChildren(...options);
}

function renderMascot() {
  const character = currentCharacter(state);
  document.body.dataset.mascot = state.mascot;
  document.body.dataset.character = character;
  els.mascot.innerHTML = MASCOT_INFO[character].svg();
  renderLookSwitch();
}

// The two looks of the current mascot, e.g. Princess / Prince.
function renderLookSwitch() {
  const current = currentCharacter(state);
  const buttons = CHARACTERS[state.mascot].map((character) => {
    const info = MASCOT_INFO[character];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'look-option';
    button.setAttribute('aria-pressed', String(character === current));
    button.setAttribute('aria-label', info.name);
    button.innerHTML = `${info.face()}<span></span>`;
    button.querySelector('span').textContent = info.name;
    button.addEventListener('click', () => chooseLook(character));
    return button;
  });
  els.lookSwitch.replaceChildren(...buttons);
}

function chooseMascot(id) {
  state.mascot = id;
  save();
  renderMascot();
  hideBubble();
  sounds.select(id);
  syncMusic();
  cheer();
}

function chooseLook(character) {
  if (rolling || character === currentCharacter(state)) {
    return;
  }
  state.characters[state.mascot] = character;
  save();
  renderMascot();
  renderPicker();
  hideBubble();
  sounds.select(state.mascot);
  cheer();
}

function cheer() {
  els.mascot.classList.remove('is-cheering');
  void els.mascot.offsetWidth;
  els.mascot.classList.add('is-cheering');
}

function showBubble(text) {
  els.bubble.textContent = text;
  els.bubble.classList.add('is-visible');
}

function hideBubble() {
  els.bubble.classList.remove('is-visible');
}

/* ---------- Dice ---------- */

function createFace(value) {
  const face = document.createElement('div');
  face.className = `face f${value}`;
  const cells = PIP_CELLS[value];
  for (let cell = 1; cell <= 9; cell += 1) {
    const span = document.createElement('span');
    if (cells.includes(cell)) {
      span.className = 'pip';
    }
    face.append(span);
  }
  return face;
}

function createDie(value) {
  const slot = document.createElement('div');
  slot.className = 'die-slot';
  slot.innerHTML = `
    <div class="die-shadow"></div>
    <div class="die-mover"><div class="die-camera"><div class="cube"></div></div></div>`;
  const cube = slot.querySelector('.cube');
  for (let i = 1; i <= 6; i += 1) {
    const core = document.createElement('div');
    core.className = `core c${i}`;
    cube.append(core);
  }
  for (let i = 1; i <= 6; i += 1) {
    cube.append(createFace(i));
  }
  setCubeRotation(cube, restingRotation(value));
  return slot;
}

// A final orientation showing `value`, with a small random twist so the dice
// don't all line up perfectly.
function restingRotation(value) {
  const face = FACE_ROTATIONS[value];
  return { x: face.x, y: face.y, z: randomInt(25) - 12 };
}

function rotationCss(rotation) {
  return `rotateZ(${rotation.z}deg) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`;
}

function setCubeRotation(cube, rotation) {
  cube.style.transform = rotationCss(rotation);
  cube.dataset.rotation = JSON.stringify(rotation);
}

function readCubeRotation(cube) {
  try {
    return JSON.parse(cube.dataset.rotation);
  } catch {
    return { x: 0, y: 0, z: 0 };
  }
}

function currentValues() {
  const last = state.history[0];
  const values = [];
  for (let i = 0; i < state.count; i += 1) {
    let value = i + 1;
    if (last && last.values[i]) {
      value = last.values[i];
    }
    values.push(value);
  }
  return values;
}

function renderDice(values) {
  els.tray.replaceChildren(...values.map(createDie));
}

function renderCount() {
  els.countValue.textContent = t('dice.count', { count: state.count });
  els.countMinus.disabled = rolling || state.count <= MIN_DICE;
  els.countPlus.disabled = rolling || state.count >= MAX_DICE;
}

function changeCount(delta) {
  if (rolling) {
    return;
  }
  state.count = clampDiceCount(state.count + delta);
  save();
  renderCount();
  renderDice(currentValues());
  sounds.tick();
}

/* ---------- Throw animation ---------- */

function centerOf(element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function animateDie(slot, value, handPoint, delay) {
  const mover = slot.querySelector('.die-mover');
  const cube = slot.querySelector('.cube');
  const shadow = slot.querySelector('.die-shadow');
  const from = readCubeRotation(cube);
  const to = restingRotation(value);
  const duration = 1050;

  // Extra full turns make it tumble but land on the same face.
  const spinning = {
    x: to.x + 360 * (2 + randomInt(2)),
    y: to.y + 360 * (1 + randomInt(2)),
    z: to.z + 180 * (randomInt(3) - 1) * 2,
  };

  const slotCenter = centerOf(slot);
  const dx = handPoint.x - slotCenter.x;
  const dy = handPoint.y - slotCenter.y;
  const arc = 130 + randomInt(60);

  const flight = mover.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, easing: 'ease-out' },
      { transform: `translate(${dx * 0.45}px, ${Math.min(dy * 0.45, 0) - arc}px) scale(0.85)`, offset: 0.42, easing: 'ease-in' },
      { transform: 'translate(0, 0) scale(1)', offset: 0.72, easing: 'ease-out' },
      { transform: 'translate(0, -16px) scale(1)', offset: 0.84, easing: 'ease-in' },
      { transform: 'translate(0, 0) scale(1)' },
    ],
    { duration, delay, fill: 'backwards' },
  );

  const tumble = cube.animate(
    [
      { transform: rotationCss(from) },
      { transform: rotationCss(spinning) },
    ],
    { duration, delay, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)', fill: 'forwards' },
  );

  shadow.animate(
    [
      { opacity: 0, transform: 'scale(0.3)' },
      { opacity: 0, transform: 'scale(0.3)', offset: 0.5 },
      { opacity: 1, transform: 'scale(1)', offset: 0.72 },
      { opacity: 0.6, transform: 'scale(0.8)', offset: 0.84 },
      { opacity: 1, transform: 'scale(1)' },
    ],
    { duration, delay, fill: 'backwards' },
  );

  sounds.clackAt(delay + duration * 0.72);
  sounds.clackAt(delay + duration, 0.5);

  return tumble.finished.then(() => {
    setCubeRotation(cube, to);
    tumble.cancel();
    flight.cancel();
  });
}

async function throwDice(values) {
  renderDice(values.map(() => 1));
  const slots = [...els.tray.children];

  if (reducedMotion.matches) {
    slots.forEach((slot, i) => {
      setCubeRotation(slot.querySelector('.cube'), restingRotation(values[i]));
    });
    sounds.clackAt(0);
    return;
  }

  // Randomize the starting orientation so every throw looks different.
  slots.forEach((slot) => {
    const cube = slot.querySelector('.cube');
    setCubeRotation(cube, { x: randomInt(360), y: randomInt(360), z: randomInt(360) });
    slot.querySelector('.die-mover').style.opacity = '0';
  });

  els.mascot.classList.remove('is-throwing', 'is-cheering');
  void els.mascot.offsetWidth;
  els.mascot.classList.add('is-throwing');
  sounds.whoosh();
  await wait(370);

  const hand = els.mascot.querySelector('.m-hand');
  const handPoint = centerOf(hand);
  const landings = slots.map((slot, i) => {
    slot.querySelector('.die-mover').style.opacity = '';
    return animateDie(slot, values[i], handPoint, i * 90);
  });
  await Promise.all(landings);
  els.mascot.classList.remove('is-throwing');
}

/* ---------- Roll ---------- */

function describe(values) {
  if (values.length === 1) {
    return t('dice.youRolled', { value: values[0] });
  }
  return `${values.join(' + ')} = ${sum(values)}`;
}

async function roll() {
  if (rolling) {
    return;
  }
  rolling = true;
  els.roll.disabled = true;
  els.roll.textContent = t('dice.rolling');
  renderCount();
  hideBubble();
  sounds.unlock();

  const values = rollDice(state.count);
  const total = sum(values);
  const isBest = total > state.stats.best && state.stats.rolls > 0;

  await throwDice(values);

  state = addRoll(state, values, state.mascot, currentCharacter(state));
  save();
  recordPlay(GAME_ID, { key: 'progress.dice', vars: { total } });

  els.total.textContent = String(total);
  els.total.classList.remove('is-new');
  void els.total.offsetWidth;
  els.total.classList.add('is-new');
  let detail = describe(values);
  if (isBest) {
    detail += ` ${t('dice.newBest')}`;
  }
  els.detail.textContent = detail;

  showBubble(`${pick(MASCOT_INFO[currentCharacter(state)].cheers())} ${total}!`);
  cheer();
  sounds.tada(state.mascot, isBest);
  if (navigator.vibrate) {
    navigator.vibrate(30);
  }

  renderResults();
  rolling = false;
  els.roll.disabled = false;
  els.roll.textContent = t('dice.roll');
  renderCount();
}

/* ---------- Results ---------- */

function renderResults() {
  els.statRolls.textContent = String(state.stats.rolls);
  let best = '–';
  if (state.stats.best > 0) {
    best = String(state.stats.best);
  }
  els.statBest.textContent = best;

  const items = state.history.slice(0, HISTORY_SHOWN).map((entry) => {
    const item = document.createElement('li');
    item.innerHTML = `<span class="mini-mascot">${MASCOT_INFO[entry.character].face()}</span><span class="mini-total"></span><span class="mini-values"></span>`;
    item.querySelector('.mini-total').textContent = String(entry.total);
    if (entry.values.length > 1) {
      item.querySelector('.mini-values').textContent = `(${entry.values.join(' ')})`;
    }
    return item;
  });
  els.history.replaceChildren(...items);
  els.historyEmpty.hidden = items.length > 0;

  const faces = state.stats.faces;
  const most = Math.max(1, ...faces);
  const bars = faces.map((count, index) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <span class="face-label">${index + 1}</span>
      <span class="face-track"><span class="face-fill"></span></span>
      <span class="face-count">${count}</span>`;
    item.querySelector('.face-fill').style.width = `${(count / most) * 100}%`;
    item.setAttribute('aria-label', t('dice.faceCount', { face: index + 1, count }));
    return item;
  });
  els.faceBars.replaceChildren(...bars);
}

let clearTimer = null;

function onClear() {
  if (!els.clear.classList.contains('is-armed')) {
    els.clear.classList.add('is-armed');
    els.clear.textContent = t('common.tapAgain');
    clearTimer = setTimeout(disarmClear, 3000);
    return;
  }
  disarmClear();
  state = clearResults(state);
  save();
  clearProgress(GAME_ID);
  els.total.textContent = '?';
  els.detail.textContent = t('dice.allClear');
  renderResults();
}

function disarmClear() {
  clearTimeout(clearTimer);
  els.clear.classList.remove('is-armed');
  els.clear.textContent = t('common.clear');
}

/* ---------- Sound toggle ---------- */

function renderSound() {
  els.sound.setAttribute('aria-pressed', String(state.sound));
  let label = t('common.soundOff');
  if (state.sound) {
    label = t('common.soundOn');
  }
  els.sound.setAttribute('aria-label', label);
  els.sound.title = label;
  els.sound.querySelector('.sound-on').toggleAttribute('hidden', !state.sound);
  els.sound.querySelector('.sound-off').toggleAttribute('hidden', state.sound);
  sounds.setEnabled(state.sound);
}

/* ---------- Music toggle ---------- */

function renderMusic() {
  els.music.setAttribute('aria-pressed', String(state.music));
  let label = t('dice.musicOff');
  if (state.music) {
    label = t('dice.musicOn');
  }
  els.music.setAttribute('aria-label', label);
  els.music.title = label;
  els.music.querySelector('.music-on').toggleAttribute('hidden', !state.music);
  els.music.querySelector('.music-off').toggleAttribute('hidden', state.music);
}

// Play the current mascot's tune when music is on and the page is visible.
function syncMusic() {
  if (!audioAllowed) {
    return;
  }
  if (state.music && document.visibilityState === 'visible') {
    music.play(state.mascot);
    return;
  }
  music.stop();
}

function allowAudio() {
  if (audioAllowed) {
    return;
  }
  audioAllowed = true;
  syncMusic();
}

/* ---------- Start ---------- */

els.favorite.innerHTML = STAR_SVG;
setupFavoriteButton(els.favorite, GAME_ID, t('game.dice.title'));

els.roll.addEventListener('click', roll);
els.mat.addEventListener('click', roll);
els.countMinus.addEventListener('click', () => changeCount(-1));
els.countPlus.addEventListener('click', () => changeCount(1));
els.clear.addEventListener('click', onClear);
els.sound.addEventListener('click', () => {
  state.sound = !state.sound;
  save();
  renderSound();
  sounds.unlock();
  sounds.tick();
});
els.music.addEventListener('click', () => {
  state.music = !state.music;
  save();
  renderMusic();
  syncMusic();
});
document.addEventListener('click', allowAudio);
document.addEventListener('keydown', allowAudio);
document.addEventListener('visibilitychange', syncMusic);

renderPicker();
renderMascot();
renderCount();
renderSound();
renderMusic();
renderDice(currentValues());
renderResults();

const last = state.history[0];
if (last) {
  els.total.textContent = String(last.total);
  els.detail.textContent = t('dice.lastTime', { roll: describe(last.values) });
}
