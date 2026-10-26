import { registerServiceWorker, setupFavoriteButton, setupFullscreen, setupLanguage, STAR_SVG } from '../../shared/chrome.js';
import { getLanguage, t } from '../../shared/i18n.js';
import './strings.js';
import { readJSON, writeJSON } from '../../shared/store.js';
import { recordPlay } from '../../shared/progress.js';
import * as THREE from '../../vendor/three/three.min.js';
import {
  BOARDS,
  BOARD_OPTIONS,
  MODES,
  PRESETS,
  RIDER_OPTIONS,
  SCENARIOS,
  SCORE_GOALS,
  SESSION_SECONDS,
  WORDS,
  formatClock,
  normalizeSave,
  presetLook,
  starsFor,
} from './world.js';
import { CRUISE, GRAVITY, createRider, placeAtStart, startBail, stepRider } from './physics.js';
import { createTricks, praise } from './tricks.js';
import { buildRider } from './rider.js';
import { createScene } from './scene.js';
import { createSounds } from './sound.js';
import { createMusic } from './music.js';

const GAME_ID = 'skate';
const STORE_KEY = 'game:skate';
const LETTER_POINTS = 250;
const WORD_BONUS = 1000;
const PICKUP_RADIUS = 1.9;
// A jump pressed a moment before it can happen still counts.
const JUMP_BUFFER = 0.15;

registerServiceWorker(GAME_ID);
setupLanguage();

const $ = (selector) => document.querySelector(selector);

const els = {
  holder: $('.canvas-holder'),
  loading: $('.loading'),
  view: $('.view'),
  shop: $('.shop'),
  scenarioOptions: $('.scenario-options'),
  boardOptions: $('.board-options'),
  deckOptions: $('.deck-options'),
  boardRows: $('.board-rows'),
  presetOptions: $('.preset-options'),
  riderRows: $('.rider-rows'),
  modeOptions: $('.mode-options'),
  modeBlurb: $('.mode-blurb'),
  bestLine: $('.best-line'),
  go: $('.shop .go-button'),
  hud: $('.hud'),
  score: $('.score-value'),
  time: $('.time-value'),
  letters: $('.hud-letters'),
  combo: $('.combo'),
  comboTricks: $('.combo-tricks'),
  comboPoints: $('.combo-points'),
  toast: $('.toast'),
  countdown: $('.countdown'),
  left: $('.steer-left'),
  right: $('.steer-right'),
  jump: $('.jump-button'),
  flip: $('.flip-button'),
  grab: $('.grab-button'),
  pause: $('.pause-button'),
  pausePanel: $('.pause-panel'),
  resume: $('.resume-button'),
  restart: $('.restart-button'),
  finishPanel: $('.finish-panel'),
  finishScore: $('.finish-score'),
  finishBest: $('.finish-best'),
  goals: $('.goals'),
  again: $('.again-button'),
  changeButtons: document.querySelectorAll('.change-button'),
  sound: $('.sound-button'),
  music: $('.music-button'),
  favorite: $('.favorite-button'),
};

let save = normalizeSave(readJSON(STORE_KEY, null));

function store() {
  writeJSON(STORE_KEY, save);
}

const sounds = createSounds();
const music = createMusic();
let heardTap = false;
const view = createScene(els.holder);
const numbers = new Intl.NumberFormat(getLanguage());

/* ---------- State ---------- */

// 'shop' | 'countdown' | 'riding' | 'paused' | 'finished'
let mode = 'shop';
let park = null;
let rider = null;
let model = null;
let tricks = createTricks(save.board);
const session = { score: 0, time: SESSION_SECONDS, letters: [], ending: false };
const input = { left: false, right: false, grab: false, jumpBuffer: 0, flipQueued: false, keys: new Set() };
const look = { spin: 0, land: 0, bail: 0, shake: 0, camYaw: 0, orientation: new THREE.Quaternion(), vertSpan: 1 };
let toastTimer = null;
let countdownTimer = null;
let pausedFrom = null;

function word() {
  return WORDS[save.board];
}

/* ---------- Building ---------- */

function setRider() {
  if (model) {
    view.scene.remove(model.group);
    model.dispose();
  }
  model = buildRider(save.look, save.board);
  view.scene.add(model.group);
  syncModel(0);
}

function loadScenario() {
  els.loading.hidden = false;
  document.body.dataset.scenario = save.scenario;
  return new Promise((resolve) => {
    setTimeout(() => {
      park = view.setScenario(save.scenario, word());
      if (!rider) {
        rider = createRider(park);
      }
      placeAtStart(rider, park);
      look.camYaw = rider.heading;
      updateMusic();
      els.loading.hidden = true;
      resolve();
    }, 30);
  });
}

/* ---------- Riding ---------- */

function steerInput() {
  let steer = 0;
  if (input.left || input.keys.has('left')) {
    steer -= 1;
  }
  if (input.right || input.keys.has('right')) {
    steer += 1;
  }
  return steer;
}

function pressJump() {
  input.jumpBuffer = JUMP_BUFFER;
}

// Flip and grab work from the ground too: they jump first.
function pressFlip() {
  if (mode !== 'riding') {
    return;
  }
  if (rider.mode === 'air') {
    if (tricks.pressFlip()) {
      sounds.trick();
    }
    return;
  }
  if (rider.mode !== 'bail') {
    pressJump();
    input.flipQueued = true;
  }
}

function pressGrab(held) {
  input.grab = held;
  if (held && mode === 'riding' && (rider.mode === 'ground' || rider.mode === 'grind')) {
    pressJump();
  }
}

function ride(dt) {
  const wasAir = rider.mode === 'air';
  const steer = rider.mode === 'bail' ? 0 : steerInput();
  const events = stepRider(rider, { steer, jump: input.jumpBuffer > 0 && rider.mode !== 'bail' }, dt, park);
  input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
  events.forEach((event) => handle(event, wasAir));
  if (rider.mode === 'air') {
    if (tricks.setGrab(input.grab)) {
      sounds.trick();
    }
  }
  const banked = tricks.update(dt, rider.mode);
  if (banked > 0) {
    bankCombo(banked);
  }
  collectLetters();
}

function handle(event, wasAir) {
  if (event.type === 'ollie' || event.type === 'launch' || event.type === 'vert') {
    if (event.type === 'ollie') {
      input.jumpBuffer = 0;
      sounds.pop();
    }
    if (!(event.type === 'ollie' && wasAir)) {
      tricks.takeOff();
    }
    if (event.type === 'vert') {
      look.vertSpan = (2 * rider.vy) / GRAVITY;
    }
    if (input.flipQueued) {
      input.flipQueued = false;
      if (tricks.pressFlip()) {
        sounds.trick();
      }
    }
  }
  if (event.type === 'land') {
    look.spin = Math.atan2(Math.sin(look.spin), Math.cos(look.spin));
    const result = tricks.land(event);
    if (result.bail) {
      startBail(rider);
      sounds.bail();
      look.shake = 0.4;
      toast(t('skate.bail'), 1400);
      return;
    }
    const strength = Math.min(1, event.fall / 12);
    look.land = Math.max(look.land, 0.3 + strength * 0.7);
    sounds.land(strength);
    view.effects.puff(rider.x, rider.y, rider.z, view.groundKind(), strength);
  }
  if (event.type === 'grind') {
    tricks.startGrind(event.side, event.spin);
    look.spin = 0;
    sounds.grind();
  }
  if (event.type === 'grindEnd') {
    tricks.endGrind();
    tricks.takeOff();
  }
  if (event.type === 'bump') {
    sounds.bump();
    look.shake = Math.max(look.shake, 0.2);
  }
}

function bankCombo(points) {
  session.score += points;
  const level = praise(points);
  let text = `+${numbers.format(points)}`;
  if (level) {
    text = `${t(`skate.praise.${level}`)} ${text}`;
  }
  toast(text, 1500);
  sounds.combo(['nice', 'sweet', 'sick', 'insane'].indexOf(level) + 1);
  els.score.parentElement.classList.remove('is-bump');
  void els.score.offsetWidth;
  els.score.parentElement.classList.add('is-bump');
}

function collectLetters() {
  const letters = word();
  for (let i = 0; i < letters.length; i += 1) {
    if (session.letters[i]) {
      continue;
    }
    const at = view.letterPosition(i);
    if (!at) {
      continue;
    }
    if (Math.hypot(at.x - rider.x, at.y - (rider.y + 1), at.z - rider.z) > PICKUP_RADIUS) {
      continue;
    }
    session.letters[i] = true;
    view.collectLetter(i);
    session.score += LETTER_POINTS;
    sounds.letter(i);
    const found = session.letters.filter(Boolean).length;
    if (found === letters.length) {
      session.score += WORD_BONUS;
      sounds.allLetters();
      toast(t('skate.allLetters', { word: letters }), 2200);
    } else {
      toast(t('skate.letter', { letter: letters[i] }), 1100);
    }
    renderLetters();
  }
}

/* ---------- The rider on screen ---------- */

const up = new THREE.Vector3();
const ahead = new THREE.Vector3();
const side = new THREE.Vector3();
const basis = new THREE.Matrix4();
const targetQ = new THREE.Quaternion();

function wrap(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// Which way the body faces: the heading, turned through a quarter-pipe
// air, plus any spin.
function displayHeading() {
  if (rider.mode === 'air' && rider.air?.vert) {
    const { from, to } = rider.air.vert;
    const progress = Math.min(1, rider.air.time / Math.max(0.3, look.vertSpan));
    const eased = progress * progress * (3 - 2 * progress);
    return from + wrap(to - from) * eased;
  }
  return rider.heading;
}

function syncModel(dt) {
  if (!model || !rider) {
    return;
  }
  const heading = displayHeading();
  model.group.position.set(rider.x, rider.y, rider.z);
  // Stand on the slope on the ground; upright in the air and on rails.
  if (rider.mode === 'ground' || rider.mode === 'bail') {
    const { gx, gz } = park.surface(rider.x, rider.z);
    up.set(-gx, 1, -gz).normalize();
  } else {
    up.set(0, 1, 0);
  }
  ahead.set(Math.sin(heading), 0, Math.cos(heading));
  ahead.addScaledVector(up, -ahead.dot(up)).normalize();
  side.crossVectors(up, ahead).normalize();
  basis.makeBasis(side, up, ahead);
  targetQ.setFromRotationMatrix(basis);
  if (dt === 0) {
    look.orientation.copy(targetQ);
  } else {
    look.orientation.slerp(targetQ, Math.min(1, dt * (rider.mode === 'air' ? 6 : 14)));
  }
  model.group.quaternion.copy(look.orientation);

  if (rider.mode === 'air') {
    look.spin = rider.air.spin;
  } else {
    look.spin += (0 - look.spin) * Math.min(1, dt * 14);
  }
  look.land = Math.max(0, look.land - dt * 3);
  let bail = 0;
  if (rider.mode === 'bail') {
    const done = 1 - rider.bail / 1.5;
    bail = done < 0.7 ? 1 : (1 - done) / 0.3;
  }
  let state = 'ride';
  if (rider.mode === 'air') {
    state = 'air';
  }
  if (rider.mode === 'grind') {
    state = 'grind';
  }
  if (rider.mode === 'bail') {
    state = 'bail';
  }
  model.update(dt, {
    state,
    steer: mode === 'riding' ? steerInput() : 0,
    spin: look.spin,
    flip: tricks.flip,
    grab: tricks.grab,
    side: rider.mode === 'grind' && rider.grind?.side,
    land: look.land,
    bail,
    time: clock,
  });
  view.follow(rider.x, rider.y, rider.z);
}

function spray(dt) {
  const kind = view.groundKind();
  if (rider.mode === 'ground' && rider.speed > 2) {
    const tail = model.boardWorld(-model.length * 0.4, 0.02);
    view.effects.trail(dt, { x: tail.x, y: tail.y, z: tail.z, speed: rider.speed, turn: Math.abs(steerInput()), kind });
  }
  if (rider.mode === 'grind' && save.board === 'skate' && Math.random() < 0.7) {
    const point = model.boardWorld(0, 0);
    view.effects.sparks(point.x, point.y, point.z, Math.sin(rider.heading) * rider.speed, Math.cos(rider.heading) * rider.speed);
  }
}

/* ---------- Camera ---------- */

const cameraTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

function portrait() {
  return Math.min(1, Math.max(0, (1 - view.camera.aspect) / 0.55));
}

function chaseCamera(dt, snap = false) {
  // Turn with the rider, but hold still through a quarter-pipe air.
  let goal = rider.heading;
  if (rider.mode === 'air') {
    goal = rider.air?.vert ? look.camYaw : Math.atan2(rider.vx, rider.vz);
  }
  const rate = rider.mode === 'air' ? 1.5 : 3.5;
  look.camYaw += wrap(goal - look.camYaw) * Math.min(1, dt * rate);
  if (snap) {
    look.camYaw = goal;
  }
  const tall = portrait();
  // By the sea the camera rides higher, to see down to the coast.
  const lift = save.scenario === 'sea' ? 1.3 : 0;
  const distance = 5.8 + tall * 2.4 + lift;
  const back = { x: Math.sin(look.camYaw), z: Math.cos(look.camYaw) };
  const groundY = rider.mode === 'air' ? Math.max(rider.y * 0.6, park.height(rider.x, rider.z)) : rider.y;
  cameraTarget.set(rider.x - back.x * distance, groundY + 2.9 + tall * 1.2 + lift, rider.z - back.z * distance);
  const floor = park.height(cameraTarget.x, cameraTarget.z) + 1.2;
  cameraTarget.y = Math.max(cameraTarget.y, floor);
  const follow = snap ? 1 : 1 - Math.exp(-dt * 6);
  view.camera.position.lerp(cameraTarget, follow);
  if (look.shake > 0) {
    look.shake = Math.max(0, look.shake - dt);
    view.camera.position.x += (Math.random() - 0.5) * look.shake;
    view.camera.position.y += (Math.random() - 0.5) * look.shake;
  }
  lookTarget.set(rider.x + back.x * 3, rider.y + 1.1, rider.z + back.z * 3);
  view.camera.lookAt(lookTarget);
  const fov = 62 + Math.min(1, rider.speed / 16) * 6 + tall * 16;
  view.camera.fov += (fov - view.camera.fov) * Math.min(1, dt * 3);
  view.camera.updateProjectionMatrix();
}

// In the shop the camera circles the rider, who stands beside the panel
// on wide screens, or above it on phones.
function showroomCamera(time) {
  const tall = portrait();
  const angle = rider.heading + Math.PI * 0.5 + Math.sin(time * 0.35) * 0.9;
  const radius = 4.2 + tall * 1.8;
  view.camera.position.set(rider.x + Math.sin(angle) * radius, rider.y + 1.5 + tall * 0.6, rider.z + Math.cos(angle) * radius);
  lookTarget.set(rider.x, rider.y + 0.95, rider.z);
  view.camera.lookAt(lookTarget);
  view.camera.fov = 45 + tall * 14;
  const holder = els.holder.getBoundingClientRect();
  const panel = els.shop.getBoundingClientRect();
  let shiftX = 0;
  let shiftY = 0;
  if (panel.top > holder.top + 40) {
    shiftY = (holder.bottom - panel.top) / 2;
  } else {
    shiftX = -(panel.right - holder.left) / 2;
  }
  view.camera.setViewOffset(holder.width, holder.height, shiftX, shiftY, holder.width, holder.height);
  view.camera.updateProjectionMatrix();
}

/* ---------- HUD ---------- */

function toast(text, ms = 1600) {
  els.toast.textContent = text;
  els.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('is-on'), ms);
}

function renderLetters() {
  const letters = word();
  els.letters.replaceChildren(...[...letters].map((letter, i) => {
    const span = document.createElement('span');
    span.className = 'hud-letter';
    span.textContent = letter;
    span.classList.toggle('is-found', Boolean(session.letters[i]));
    return span;
  }));
  els.letters.setAttribute('aria-label', t('skate.lettersFound', { count: session.letters.filter(Boolean).length, total: letters.length }));
}

let shownCombo = '';

function renderHud() {
  els.score.textContent = numbers.format(session.score);
  if (save.mode === 'session') {
    els.time.textContent = formatClock(session.time);
    els.time.parentElement.classList.toggle('is-low', session.time < 10);
  } else {
    els.time.textContent = t('skate.freeTime');
  }
  const combo = tricks.combo;
  const text = combo.map((trick) => trick.name).join(' + ');
  if (combo.length === 0) {
    els.combo.classList.remove('is-on');
  } else {
    els.combo.classList.add('is-on');
    if (text !== shownCombo) {
      els.comboTricks.textContent = combo.length > 4 ? `… + ${combo.slice(-4).map((trick) => trick.name).join(' + ')}` : text;
    }
    const sum = Math.round(combo.reduce((total, trick) => total + trick.points, 0));
    els.comboPoints.textContent = `${numbers.format(sum)} × ${combo.length}`;
  }
  shownCombo = text;
}

/* ---------- Game flow ---------- */

function setMode(next) {
  mode = next;
  if (next !== 'shop') {
    view.camera.clearViewOffset();
  }
  document.body.classList.toggle('is-shop', next === 'shop');
  els.shop.hidden = next !== 'shop';
  els.hud.hidden = next === 'shop';
  els.pause.hidden = next !== 'riding' && next !== 'countdown';
  els.pausePanel.hidden = next !== 'paused';
  els.finishPanel.hidden = next !== 'finished' || !els.finishPanel.dataset.ready;
  if (next === 'riding') {
    sounds.start();
  } else {
    sounds.stop();
  }
}

function resetRun() {
  tricks = createTricks(save.board);
  placeAtStart(rider, park);
  look.camYaw = rider.heading;
  look.spin = 0;
  Object.assign(session, { score: 0, time: SESSION_SECONDS, letters: [], ending: false });
  view.resetLetters(word());
  input.jumpBuffer = 0;
  input.flipQueued = false;
  delete els.finishPanel.dataset.ready;
  renderLetters();
  renderHud();
}

function startRun() {
  sounds.unlock();
  resetRun();
  setMode('countdown');
  syncModel(0);
  chaseCamera(0, true);
  let count = 3;
  els.countdown.textContent = String(count);
  els.countdown.classList.add('is-on');
  sounds.count(false);
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    count -= 1;
    if (count > 0) {
      els.countdown.textContent = String(count);
      sounds.count(false);
      return;
    }
    clearInterval(countdownTimer);
    els.countdown.textContent = t('skate.countGo');
    sounds.count(true);
    rider.speed = CRUISE * 0.5;
    setMode('riding');
    toast(t('skate.tip'), 2600);
    setTimeout(() => els.countdown.classList.remove('is-on'), 700);
  }, 800);
}

function finish() {
  // The last combo counts if it was landed.
  if (rider.mode !== 'bail') {
    const points = tricks.bank();
    if (points > 0) {
      session.score += points;
    }
  }
  setMode('finished');
  sounds.finish();
  const letters = session.letters.filter(Boolean).length;
  const total = word().length;
  const stars = starsFor(session.score, letters, total);
  const previous = save.best[save.scenario] || 0;
  const isBest = session.score > previous;
  if (isBest) {
    save.best[save.scenario] = session.score;
  }
  save.stars[save.scenario] = Math.max(save.stars[save.scenario] || 0, stars);
  store();
  recordPlay(GAME_ID, { key: 'progress.skate', vars: { count: session.score } });
  els.finishScore.textContent = t('skate.finishScore', { score: numbers.format(session.score) });
  els.finishBest.textContent = isBest && session.score > 0 ? t('skate.newBest') : t('skate.best', { score: numbers.format(previous) });
  const goals = [
    ...SCORE_GOALS.map((goal) => ({ done: session.score >= goal, text: t('skate.goal.score', { score: numbers.format(goal) }) })),
    { done: letters >= total, text: t('skate.goal.letters', { word: word() }) },
  ];
  els.goals.replaceChildren(...goals.map((goal) => {
    const item = document.createElement('li');
    item.classList.toggle('is-done', goal.done);
    item.innerHTML = '<span class="goal-star" aria-hidden="true">★</span><span></span>';
    item.lastChild.textContent = goal.text;
    return item;
  }));
  setTimeout(() => {
    if (mode !== 'finished') {
      return;
    }
    els.finishPanel.dataset.ready = 'yes';
    els.finishPanel.hidden = false;
    els.again.focus({ preventScroll: true });
  }, 900);
}

function pause() {
  if (mode !== 'riding' && mode !== 'countdown') {
    return;
  }
  clearInterval(countdownTimer);
  els.countdown.classList.remove('is-on');
  pausedFrom = mode;
  setMode('paused');
  els.resume.focus({ preventScroll: true });
}

function resume() {
  // Paused during the countdown: count again.
  if (pausedFrom === 'countdown') {
    startRun();
    return;
  }
  setMode('riding');
}

function toShop() {
  clearInterval(countdownTimer);
  els.countdown.classList.remove('is-on');
  if (save.mode === 'free' && session.score > 0 && mode !== 'finished') {
    recordPlay(GAME_ID, { key: 'progress.skate', vars: { count: session.score } });
  }
  tricks = createTricks(save.board);
  placeAtStart(rider, park);
  setMode('shop');
  renderShop();
}

/* ---------- The loop ---------- */

let last = performance.now();
let clock = 0;

function loop(now) {
  const elapsed = now - last;
  const dt = Math.min(0.05, elapsed / 1000);
  last = now;
  step(dt);
  if (mode !== 'paused' && document.visibilityState === 'visible') {
    view.adapt(elapsed);
  }
  requestAnimationFrame(loop);
}

function step(dt) {
  clock += dt;
  if (!park || !rider || !model) {
    return;
  }
  if (mode === 'riding') {
    ride(dt);
    if (save.mode === 'session') {
      session.time = Math.max(0, session.time - dt);
      // Time's up once the rider is down from any trick in progress.
      if (session.time === 0 && (rider.mode === 'ground' || rider.mode === 'bail')) {
        finish();
      }
    }
    syncModel(dt);
    spray(dt);
    chaseCamera(dt);
    sounds.ride(Math.min(1, rider.speed / 14), view.groundKind(), rider.mode);
    renderHud();
  } else if (mode === 'countdown' || mode === 'finished') {
    if (mode === 'finished') {
      rider.speed *= Math.exp(-dt * 2);
    }
    syncModel(dt);
    chaseCamera(dt);
  } else if (mode === 'shop') {
    syncModel(dt);
    showroomCamera(clock);
  }
  if (mode !== 'paused') {
    view.animate(dt, clock, view.camera.position);
    view.render();
  }
}

/* ---------- Controls ---------- */

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  KeyJ: 'flip', KeyX: 'flip',
  KeyK: 'grab', KeyC: 'grab',
};

document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, select, textarea')) {
    return;
  }
  if ((event.code === 'Escape' || event.code === 'KeyP') && (mode === 'riding' || mode === 'countdown')) {
    pause();
    return;
  }
  const action = KEYS[event.code];
  if (!action || mode === 'shop' || mode === 'paused' || mode === 'finished') {
    return;
  }
  event.preventDefault();
  if (event.repeat) {
    return;
  }
  if (action === 'jump' && mode === 'riding') {
    pressJump();
  } else if (action === 'flip') {
    pressFlip();
  } else if (action === 'grab') {
    pressGrab(true);
  } else {
    input.keys.add(action);
  }
});

document.addEventListener('keyup', (event) => {
  const action = KEYS[event.code];
  if (action === 'grab') {
    pressGrab(false);
  }
  if (action) {
    input.keys.delete(action);
  }
});

// Touch pads: steering and grab are held, jump and flip are tapped.
function holdPad(button, onDown, onUp = () => {}) {
  const release = () => {
    if (button.classList.contains('is-held')) {
      button.classList.remove('is-held');
      onUp();
    }
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    sounds.unlock();
    button.setPointerCapture(event.pointerId);
    button.classList.add('is-held');
    onDown();
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

holdPad(els.left, () => { input.left = true; }, () => { input.left = false; });
holdPad(els.right, () => { input.right = true; }, () => { input.right = false; });
holdPad(els.jump, () => {
  if (mode === 'riding') {
    pressJump();
  }
});
holdPad(els.flip, pressFlip);
holdPad(els.grab, () => pressGrab(true), () => pressGrab(false));

els.pause.addEventListener('click', pause);
els.resume.addEventListener('click', resume);
els.restart.addEventListener('click', startRun);
els.again.addEventListener('click', startRun);
els.changeButtons.forEach((button) => button.addEventListener('click', toShop));
els.go.addEventListener('click', startRun);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    pause();
  }
  updateMusic();
});

window.addEventListener('blur', () => {
  input.keys.clear();
  input.left = false;
  input.right = false;
  input.grab = false;
});

function updateMusic() {
  if (save.music && heardTap && document.visibilityState === 'visible') {
    music.play(save.scenario);
    return;
  }
  music.stop();
}

function firstTap() {
  if (heardTap) {
    return;
  }
  heardTap = true;
  sounds.unlock();
  updateMusic();
}

document.addEventListener('pointerdown', firstTap);
document.addEventListener('keydown', firstTap);

/* ---------- The shop ---------- */

function radioCard(name, value, checked, inner, onPick) {
  const label = document.createElement('label');
  label.className = `card card-${name}`;
  label.innerHTML = `<input type="radio" name="${name}" value="${value}">${inner}`;
  const radio = label.querySelector('input');
  radio.checked = checked;
  radio.addEventListener('change', () => {
    if (radio.checked) {
      onPick(value);
    }
  });
  return label;
}

const BOARD_ART = {
  skate: `
    <svg viewBox="0 0 64 24" aria-hidden="true">
      <path class="sil-board" d="M6 9 Q2 9 3 5 L8 11 H56 L61 5 Q62 9 58 9 L56 12 H8 Z"/>
      <circle class="sil-wheel" cx="15" cy="17" r="4"/><circle class="sil-wheel" cx="49" cy="17" r="4"/>
    </svg>`,
  snow: `
    <svg viewBox="0 0 64 24" aria-hidden="true">
      <path class="sil-board" d="M2 10 Q3 16 9 15 H55 Q61 16 62 10 Q60 13 55 12 H9 Q4 13 2 10 Z"/>
      <rect class="sil-wheel" x="17" y="7" width="8" height="5" rx="1.5"/><rect class="sil-wheel" x="39" y="7" width="8" height="5" rx="1.5"/>
    </svg>`,
};

function stars(count) {
  return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`;
}

function renderShop() {
  els.scenarioOptions.replaceChildren(...SCENARIOS.map((scenario) => radioCard(
    'scenario',
    scenario,
    save.scenario === scenario,
    `<span class="card-art art-${scenario}" aria-hidden="true"></span><strong>${t(`skate.scenario.${scenario}`)}</strong><small>${t(`skate.scenarioBlurb.${scenario}`)}</small><span class="card-stars" aria-hidden="true">${stars(save.stars[scenario] || 0)}</span>`,
    async (value) => {
      save.scenario = value;
      store();
      renderShop();
      await loadScenario();
      syncModel(0);
    },
  )));
  els.boardOptions.replaceChildren(...BOARDS.map((board) => radioCard(
    'board',
    board,
    save.board === board,
    `${BOARD_ART[board]}<strong>${t(`skate.boardType.${board}`)}</strong>`,
    (value) => {
      save.board = value;
      store();
      tricks = createTricks(save.board);
      view.resetLetters(word());
      setRider();
      renderShop();
    },
  )));
  els.deckOptions.replaceChildren(...BOARD_OPTIONS.deck.map((color, i) => {
    const swatch = radioCard('deck', color, save.look.deck === color, `<span class="swatch" style="--paint: ${color}"></span>`, (value) => {
      save.look.deck = value;
      changedLook();
    });
    swatch.classList.add('card-paint');
    swatch.setAttribute('aria-label', t('skate.colorChoice', { number: i + 1 }));
    swatch.title = t('skate.colorChoice', { number: i + 1 });
    return swatch;
  }));
  renderCustom();
  els.modeOptions.replaceChildren(...MODES.map((value) => radioCard(
    'mode',
    value,
    save.mode === value,
    `<strong>${t(`skate.mode.${value}`)}</strong>`,
    (picked) => {
      save.mode = picked;
      store();
      renderShop();
    },
  )));
  els.modeBlurb.textContent = t(`skate.modeBlurb.${save.mode}`);
  const best = save.best[save.scenario];
  els.bestLine.textContent = best ? t('skate.best', { score: numbers.format(best) }) : t('skate.noBest');
}

function changedLook() {
  store();
  setRider();
  renderCustom();
  renderShop();
}

// A row of choices for one part of the look: words, or color dots.
function customRow(key) {
  const row = document.createElement('div');
  row.className = 'custom-row';
  const title = document.createElement('p');
  let label = t(`skate.custom.${key}`);
  if (key === 'wheels' && save.board === 'snow') {
    label = t('skate.custom.bindings');
  }
  title.textContent = label;
  const options = document.createElement('div');
  options.className = 'custom-options';
  options.setAttribute('role', 'radiogroup');
  options.setAttribute('aria-label', label);
  const values = { ...RIDER_OPTIONS, ...BOARD_OPTIONS }[key];
  options.append(...values.map((value, i) => {
    const color = value.startsWith('#');
    let inner = `<strong>${t(`skate.${key}.${value}`)}</strong>`;
    if (color) {
      inner = `<span class="swatch" style="--paint: ${value}"></span>`;
    }
    const card = radioCard(`custom-${key}`, value, save.look[key] === value, inner, () => {
      save.look[key] = value;
      changedLook();
    });
    card.classList.add('card-custom');
    if (color) {
      card.classList.add('card-paint');
      card.setAttribute('aria-label', t('skate.colorChoice', { number: i + 1 }));
      card.title = t('skate.colorChoice', { number: i + 1 });
    }
    return card;
  }));
  row.append(title, options);
  return row;
}

function presetRow() {
  const options = document.createElement('div');
  options.className = 'custom-options';
  options.append(...PRESETS.map((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card card-custom card-preset';
    button.innerHTML = `<span class="preset-dot" style="--paint: ${preset.look.topColor}; --accent: ${preset.look.deck}" aria-hidden="true"></span><strong></strong>`;
    button.querySelector('strong').textContent = t(`skate.preset.${preset.id}`);
    button.addEventListener('click', () => {
      save.look = presetLook(preset);
      save.board = preset.board;
      tricks = createTricks(save.board);
      view.resetLetters(word());
      changedLook();
    });
    return button;
  }));
  return options;
}

function renderCustom() {
  const riderKeys = Object.keys(RIDER_OPTIONS).filter((key) => key !== 'hatColor' || save.look.hat !== 'none');
  const boardKeys = ['graphic', 'graphicColor', 'wheels'].filter((key) => key !== 'graphicColor' || save.look.graphic !== 'none');
  els.presetOptions.replaceChildren(presetRow());
  els.riderRows.replaceChildren(...riderKeys.map(customRow));
  els.boardRows.replaceChildren(...boardKeys.map(customRow));
}

/* ---------- Sound, chrome, sizing ---------- */

function renderSound() {
  els.sound.setAttribute('aria-pressed', String(save.sound));
  const label = save.sound ? t('common.soundOn') : t('common.soundOff');
  els.sound.setAttribute('aria-label', label);
  els.sound.title = label;
  els.sound.querySelector('.sound-on').toggleAttribute('hidden', !save.sound);
  els.sound.querySelector('.sound-off').toggleAttribute('hidden', save.sound);
  sounds.setEnabled(save.sound);
  if (save.sound && mode === 'riding') {
    sounds.start();
  }
}

function renderMusic() {
  els.music.setAttribute('aria-pressed', String(save.music));
  const label = save.music ? t('skate.musicOn') : t('skate.musicOff');
  els.music.setAttribute('aria-label', label);
  els.music.title = label;
  els.music.querySelector('.music-on').toggleAttribute('hidden', !save.music);
  els.music.querySelector('.music-off').toggleAttribute('hidden', save.music);
  music.setEnabled(save.music);
}

els.music.addEventListener('click', () => {
  save.music = !save.music;
  store();
  renderMusic();
  updateMusic();
});

els.sound.addEventListener('click', () => {
  save.sound = !save.sound;
  store();
  renderSound();
  sounds.unlock();
});

function resize() {
  const box = els.holder.getBoundingClientRect();
  if (box.width > 0 && box.height > 0) {
    view.resize(box.width, box.height);
  }
}

new ResizeObserver(resize).observe(els.holder);

els.favorite.innerHTML = STAR_SVG;
setupFavoriteButton(els.favorite, GAME_ID, t('game.skate.title'));
setupFullscreen($('.fullscreen-button'), { slot: $('.focus-slot'), onChange: resize });
renderSound();
renderMusic();
renderShop();
setMode('shop');
resize();
loadScenario().then(() => {
  setRider();
  requestAnimationFrame(loop);
});
