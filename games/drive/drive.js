import { registerServiceWorker, setupFavoriteButton, setupFullscreen, setupLanguage, STAR_SVG } from '../../shared/chrome.js';
import { t } from '../../shared/i18n.js';
import './strings.js';
import { readJSON, writeJSON } from '../../shared/store.js';
import { recordPlay } from '../../shared/progress.js';
import * as THREE from '../../vendor/three/three.min.js';
import {
  CARS,
  CUSTOM_OPTIONS,
  DIFFICULTIES,
  PRESETS,
  PAINTS,
  ROAD_WIDTH,
  SCENARIOS,
  bestKey,
  formatTime,
  lapChange,
  nearestSample,
  normalizeSave,
  placeBoosts,
  placePoints,
  presetCustom,
  sideMeters,
  sideOffset,
} from './world.js';
import { buildCar, carOutline } from './cars.js';
import { createScene } from './scene.js';
import { createSounds } from './sound.js';
import { createMusic } from './music.js';
import { normalizeTracks, trackPoints } from './tracks.js';
import { createBuilder } from './editor.js';
import { createTilt, tiltAvailable } from './tilt.js';

const GAME_ID = 'drive';
const STORE_KEY = 'game:drive';

// Speeds in meters per second. The speedometer shows a bit more, for fun.
const TOP_SPEED = 38;
const NITRO_SPEED = 54;
const ACCELERATION = 13;
const NITRO_ACCELERATION = 26;
// How fast the car slows to a stop after the finish.
const FINISH_SLOWDOWN = 13;
// A boost pad gives this many seconds of nitro.
const BOOST_SECONDS = 2.4;
const SPEEDO_SCALE = 3.6 * 1.6;
const PICKUP_RADIUS = 3.6;
const CAR_HALF_WIDTH = 1.1;
const WALL = ROAD_WIDTH / 2 - CAR_HALF_WIDTH;
const STREAK_SECONDS = 4;
// Top speed while scraping a barrier (meters per second).
const SCRAPE_SPEED = 4;

registerServiceWorker(GAME_ID);
setupLanguage();

const $ = (selector) => document.querySelector(selector);

const els = {
  holder: $('.canvas-holder'),
  loading: $('.loading'),
  garage: $('.garage'),
  scenarioOptions: $('.scenario-options'),
  carOptions: $('.car-options'),
  paintOptions: $('.paint-options'),
  customRows: $('.custom-rows'),
  steeringPick: $('.steering-pick'),
  controlOptions: $('.control-options'),
  controlNote: $('.control-note'),
  view: $('.view'),
  difficultyOptions: $('.difficulty-options'),
  difficultyBlurb: $('.difficulty-blurb'),
  bestLine: $('.best-line'),
  trackOptions: $('.track-options'),
  buildTrack: $('.build-button'),
  editTrack: $('.edit-button'),
  builder: $('.builder'),
  go: $('.garage .go-button'),
  hud: $('.hud'),
  points: $('.points-count'),
  time: $('.time-value'),
  lap: $('.lap-value'),
  minimap: $('.minimap'),
  toast: $('.toast'),
  countdown: $('.countdown'),
  speed: $('.speed-value'),
  boostBar: $('.boost-bar i'),
  speedo: $('.speedo'),
  steerLeft: $('.steer-left'),
  steerRight: $('.steer-right'),
  pause: $('.pause-button'),
  pausePanel: $('.pause-panel'),
  resume: $('.resume-button'),
  restart: $('.restart-button'),
  finishPanel: $('.finish-panel'),
  finishTime: $('.finish-time'),
  finishBest: $('.finish-best'),
  again: $('.again-button'),
  changeButtons: document.querySelectorAll('.change-button'),
  sound: $('.sound-button'),
  music: $('.music-button'),
  favorite: $('.favorite-button'),
};

const stored = readJSON(STORE_KEY, null);
let save = normalizeSave(stored);
// Tracks people built (see tracks.js). A selected track that's gone falls
// back to the scenario's own circuit.
save.tracks = normalizeTracks(stored?.tracks, t('drive.defaultName'));
if (!save.tracks.some((built) => built.id === save.track)) {
  save.track = null;
}

function builtTrack() {
  return save.tracks.find((built) => built.id === save.track) || null;
}
const sounds = createSounds();
const music = createMusic();
// Browsers only play sound after the first tap or key press.
let heardTap = false;
const view = createScene(els.holder);

function store() {
  writeJSON(STORE_KEY, save);
}

/* ---------- Game state ---------- */

// 'garage' | 'countdown' | 'driving' | 'paused' | 'finished'
let mode = 'garage';
let track = null;
let points = [];
let car = null;
const state = {
  x: 0, y: 0, z: 0, heading: 0, speed: 0, steer: 0,
  index: 0, lap: 0, time: 0, collected: 0, boost: 0,
  usingNitro: false, streak: 0, lastPickup: -10, wallTouch: false, wrongWay: 0, shake: 0,
};
const input = { left: false, right: false, keys: new Set() };
// Boost pads on the road: [{ index, side, armed }].
let boosts = [];
let toastTimer = null;
let countdownTimer = null;

/* ---------- Building the world and the car ---------- */

function setCar() {
  if (car) {
    view.scene.remove(car.group);
  }
  car = buildCar(save.car, save.paint, save.custom);
  car.setHeadlights(view.headlights);
  view.scene.add(car.group);
  placeCarAtStart();
}

function placeCarAtStart() {
  if (!track || !car) {
    return;
  }
  const start = track.samples[track.samples.length - 6];
  state.x = start.x;
  state.z = start.z;
  state.y = start.y;
  state.heading = Math.atan2(start.dx, start.dz);
  state.index = track.samples.length - 6;
  state.speed = 0;
  state.steer = 0;
  syncCar(0);
}

function loadScenario() {
  els.loading.hidden = false;
  document.body.dataset.scenario = save.scenario;
  // Let the "building" message show before the work starts.
  return new Promise((resolve) => {
    setTimeout(() => {
      const built = builtTrack();
      if (built) {
        track = view.setScenario(built.scenario, trackPoints(built.pieces));
      } else {
        track = view.setScenario(save.scenario);
      }
      car?.setHeadlights(view.headlights);
      updateMusic();
      placeCarAtStart();
      els.loading.hidden = true;
      drawMinimap();
      resolve();
    }, 30);
  });
}

/* ---------- Driving ---------- */

function forward() {
  return { x: Math.sin(state.heading), z: Math.cos(state.heading) };
}

function angleBetween(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function drive(dt) {
  const samples = track.samples;

  // Steering: smooth, and weaker when slow (you can't turn standing still).
  // Tilting the phone steers smoothly; keys and buttons still work.
  let steerInput = 0;
  if (tiltOn()) {
    steerInput = tilt.steer();
  }
  if (input.left || input.keys.has('left')) {
    steerInput = -1;
  }
  if (input.right || input.keys.has('right')) {
    steerInput = 1;
  }
  state.steer += (steerInput - state.steer) * Math.min(1, dt * 7);
  const grip = Math.min(1, state.speed / 6);
  const turnRate = (1.9 - 0.55 * Math.min(1, state.speed / TOP_SPEED)) * grip;
  state.heading -= state.steer * turnRate * dt;

  // Speed: the car always accelerates (like Asphalt); boost pads add nitro.
  state.boost = Math.max(0, state.boost - dt);
  const nitroOn = state.boost > 0 && mode === 'driving';
  state.usingNitro = nitroOn;
  let target = TOP_SPEED;
  let accel = ACCELERATION;
  if (nitroOn) {
    target = NITRO_SPEED;
    accel = NITRO_ACCELERATION;
  }
  if (mode === 'finished') {
    target = 0;
    accel = FINISH_SLOWDOWN;
  }
  if (state.speed < target) {
    state.speed = Math.min(target, state.speed + accel * dt * (1 - 0.5 * (state.speed / target)));
  } else {
    state.speed = Math.max(target, state.speed - 18 * dt);
  }

  const direction = forward();
  state.x += direction.x * state.speed * dt;
  state.z += direction.z * state.speed * dt;

  // Where is the car on the road now?
  const previous = state.index;
  state.index = nearestSample(samples, state.x, state.z, state.index);
  const lapStep = lapChange(previous, state.index, samples.length);
  state.lap = Math.max(0, state.lap + lapStep);
  const here = samples[state.index];
  state.y += (here.y - state.y) * Math.min(1, dt * 10);

  // The barriers stop the car going through, and scraping one slows it to
  // a crawl. They never turn the car: steering away is up to the driver.
  const side = sideOffset(here, state.x, state.z);
  if (Math.abs(side) > WALL) {
    const push = side - Math.sign(side) * WALL;
    state.x -= here.nx * push;
    state.z -= here.nz * push;
    const hereHeading = Math.atan2(here.dx, here.dz);
    if (!state.wallTouch) {
      const hit = Math.abs(Math.sin(angleBetween(hereHeading, state.heading)));
      state.speed *= 1 - Math.min(0.45, hit * 0.9 + 0.08);
      state.shake = 0.35;
      sounds.bump();
    }
    state.wallTouch = true;
    // Sparks where the car's side meets the barrier.
    if (state.speed > 8) {
      const edge = Math.sign(side) * (WALL + CAR_HALF_WIDTH);
      const direction = forward();
      view.effects.sparks(here.x + here.nx * edge, state.y + 0.5, here.z + here.nz * edge, direction.x * state.speed, direction.z * state.speed);
    }
    state.speed = Math.min(state.speed, SCRAPE_SPEED + Math.cos(angleBetween(hereHeading, state.heading)) ** 2 * 3);
  } else {
    state.wallTouch = false;
  }

  // Driving backwards?
  const wrong = Math.cos(angleBetween(Math.atan2(here.dx, here.dz), state.heading)) < -0.3 && state.speed > 4;
  if (wrong) {
    state.wrongWay += dt;
  } else {
    state.wrongWay = 0;
  }
  if (state.wrongWay > 1.2 && mode === 'driving') {
    toast(t('drive.wrongWay'), 1500);
    state.wrongWay = -2;
  }
}

function collectPoints() {
  points.forEach((point, i) => {
    if (point.collected) {
      return;
    }
    const position = view.pointPosition(i);
    if (!position) {
      return;
    }
    const distance = Math.hypot(position.x - state.x, position.z - state.z);
    if (distance > PICKUP_RADIUS || Math.abs(position.y - 1.5 - state.y) > 3) {
      return;
    }
    point.collected = true;
    view.collectPoint(i);
    state.collected += 1;
    if (state.time - state.lastPickup < STREAK_SECONDS) {
      state.streak += 1;
    } else {
      state.streak = 0;
    }
    state.lastPickup = state.time;
    sounds.collect(state.streak);
    els.points.parentElement.classList.remove('is-bump');
    void els.points.offsetWidth;
    els.points.parentElement.classList.add('is-bump');
    if (state.collected === points.length) {
      finish();
    }
  });
}

// Driving over a boost pad gives a burst of nitro. Each pad works once per
// pass: it re-arms when the car is well away from it.
function hitBoosts() {
  const count = track.samples.length;
  const sample = track.samples[state.index];
  const side = sideOffset(sample, state.x, state.z);
  boosts.forEach((boost, i) => {
    const apart = Math.abs(state.index - boost.index);
    const along = Math.min(apart, count - apart);
    if (along > 20) {
      boost.armed = true;
      return;
    }
    if (!boost.armed || along > 3 || Math.abs(side - sideMeters(boost.side)) > 3.6) {
      return;
    }
    boost.armed = false;
    if (state.boost === 0) {
      sounds.nitro();
    }
    state.boost = BOOST_SECONDS;
    view.hitBoost(i);
  });
}

/* ---------- Car and camera ---------- */

const cameraTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

// 0 on wide screens, up to 1 on a tall phone: the camera pulls back and
// widens its view there, or the car would fill the screen.
function portrait() {
  return Math.min(1, Math.max(0, (1 - view.camera.aspect) / 0.55));
}

function syncCar(dt) {
  if (!car) {
    return;
  }
  car.group.position.set(state.x, state.y, state.z);
  car.group.rotation.y = state.heading;
  // Lean back a little on hills.
  const here = track?.samples[state.index];
  const ahead = track?.samples[(state.index + 2) % track.samples.length];
  if (here && ahead) {
    car.group.rotation.x = -Math.atan2(ahead.y - here.y, 4);
  }
  car.update(dt, { speed: state.speed, steer: state.steer, nitro: state.usingNitro });
  view.follow(state.x, state.y, state.z);
}

// Smoke, dust, sand or snow from the rear tires, more when sliding.
function kickUp(dt) {
  const slide = Math.min(1, Math.abs(state.steer) * (state.speed / TOP_SPEED) * 1.4 + (state.wallTouch ? 0.6 : 0));
  view.effects.wheels(dt, {
    ...car.emitters(state.heading),
    speed: state.speed,
    slide,
    kind: view.groundKind(track.samples[state.index].t),
    nitro: state.usingNitro,
  });
}

function chaseCamera(dt, snap = false) {
  const direction = forward();
  const speedShare = state.speed / TOP_SPEED;
  const tall = portrait();
  const distance = 6.4 + speedShare * 1.1 + tall * 2.6;
  cameraTarget.set(state.x - direction.x * distance, state.y + 2.5 + speedShare * 0.3 + tall * 1, state.z - direction.z * distance);
  let follow = 1 - Math.exp(-dt * 7);
  if (snap) {
    follow = 1;
  }
  view.camera.position.lerp(cameraTarget, follow);
  if (state.shake > 0) {
    state.shake = Math.max(0, state.shake - dt);
    view.camera.position.x += (Math.random() - 0.5) * state.shake;
    view.camera.position.y += (Math.random() - 0.5) * state.shake;
  }
  lookTarget.set(state.x + direction.x * 5, state.y + 1.25, state.z + direction.z * 5);
  view.camera.lookAt(lookTarget);
  let fov = 60 + speedShare * 10 + tall * 18;
  if (state.usingNitro) {
    fov += 7;
  }
  view.camera.fov += (fov - view.camera.fov) * Math.min(1, dt * 4);
  view.camera.updateProjectionMatrix();
}

// In the garage the camera swings slowly in front of the car (where the
// road is open), and the picture shifts so the car sits beside the panel
// on wide screens, or above it on phones.
function showroomCamera(time) {
  const tall = portrait();
  const angle = state.heading + Math.sin(time * 0.4) * 0.9 + 0.5;
  const radius = 7 + tall * 3;
  view.camera.position.set(state.x + Math.sin(angle) * radius, state.y + 2 + tall, state.z + Math.cos(angle) * radius);
  lookTarget.set(state.x, state.y + 0.7, state.z);
  view.camera.lookAt(lookTarget);
  view.camera.fov = 48 + tall * 14;
  const holder = els.holder.getBoundingClientRect();
  const panel = els.garage.getBoundingClientRect();
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

function renderHud() {
  els.points.textContent = `${state.collected}/${points.length}`;
  els.time.textContent = formatTime(state.time);
  // The car starts just behind the line; lap 1 begins when it crosses.
  els.lap.textContent = t('drive.lap', { lap: Math.max(1, state.lap) });
  els.speed.textContent = String(Math.round(state.speed * SPEEDO_SCALE));
  els.boostBar.style.transform = `scaleX(${(state.boost / BOOST_SECONDS).toFixed(3)})`;
  els.speedo.classList.toggle('is-boosting', state.usingNitro);
  // The steering buttons hide only once tilt readings really arrive.
  document.body.classList.toggle('is-tilt', tiltOn());
  document.body.classList.toggle('is-nitro', state.usingNitro);
}

// The minimap: the road, the points still to get, and you.
let mapBox = null;

function drawMinimap() {
  const samples = track.samples;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  samples.forEach((sample) => {
    minX = Math.min(minX, sample.x);
    maxX = Math.max(maxX, sample.x);
    minZ = Math.min(minZ, sample.z);
    maxZ = Math.max(maxZ, sample.z);
  });
  const pad = 30;
  mapBox = { minX: minX - pad, minZ: minZ - pad, width: maxX - minX + pad * 2, height: maxZ - minZ + pad * 2 };
  els.minimap.setAttribute('viewBox', `${mapBox.minX} ${mapBox.minZ} ${mapBox.width} ${mapBox.height}`);
  const road = samples.filter((sample, i) => i % 4 === 0).map((sample) => `${sample.x.toFixed(1)},${sample.z.toFixed(1)}`).join(' ');
  const dots = points.map((point, i) => {
    const sample = samples[point.index];
    return `<circle class="map-point" data-i="${i}" cx="${sample.x.toFixed(1)}" cy="${sample.z.toFixed(1)}" r="${(mapBox.width / 55).toFixed(1)}"/>`;
  }).join('');
  const pads = boosts.map((boost) => {
    const sample = samples[boost.index];
    return `<circle class="map-boost" cx="${sample.x.toFixed(1)}" cy="${sample.z.toFixed(1)}" r="${(mapBox.width / 70).toFixed(1)}"/>`;
  }).join('');
  const start = samples[0];
  els.minimap.innerHTML = `
    <polygon class="map-road-edge" points="${road}"/>
    <polygon class="map-road" points="${road}"/>
    <circle class="map-start" cx="${start.x}" cy="${start.z}" r="${(mapBox.width / 50).toFixed(1)}"/>
    ${pads}
    ${dots}
    <circle class="map-car" r="${(mapBox.width / 34).toFixed(1)}"/>`;
  els.minimap.style.setProperty('--map-stroke', `${(mapBox.width / 26).toFixed(1)}px`);
}

function updateMinimap() {
  const dot = els.minimap.querySelector('.map-car');
  if (dot) {
    dot.setAttribute('cx', state.x.toFixed(1));
    dot.setAttribute('cy', state.z.toFixed(1));
  }
  points.forEach((point, i) => {
    if (point.collected) {
      els.minimap.querySelector(`[data-i="${i}"]`)?.remove();
    }
  });
}

/* ---------- Game flow ---------- */

function setMode(next) {
  mode = next;
  if (next !== 'garage') {
    view.camera.clearViewOffset();
  }
  document.body.classList.toggle('is-garage', next === 'garage');
  els.garage.hidden = next !== 'garage';
  els.builder.hidden = next !== 'builder';
  els.hud.hidden = next === 'garage' || next === 'builder';
  els.pause.hidden = next !== 'driving' && next !== 'countdown';
  els.pausePanel.hidden = next !== 'paused';
  els.finishPanel.hidden = next !== 'finished' || !els.finishPanel.dataset.ready;
  if (next === 'driving') {
    sounds.startEngine();
  }
  if (next === 'garage' || next === 'paused') {
    sounds.stopEngine();
  }
}

function resetRun() {
  points = placePoints(track.samples, save.difficulty).map((point) => ({ ...point, collected: false }));
  view.setPoints(points);
  boosts = placeBoosts(track.samples).map((boost) => ({ ...boost, armed: true }));
  view.setBoosts(boosts);
  placeCarAtStart();
  Object.assign(state, {
    lap: 0, time: 0, collected: 0, boost: 0, usingNitro: false, streak: 0, lastPickup: -10,
    wallTouch: false, wrongWay: 0, shake: 0,
  });
  drawMinimap();
  delete els.finishPanel.dataset.ready;
  renderHud();
}

async function startRun() {
  sounds.unlock();
  // iPhones only allow the motion sensor after a tap, each visit.
  if (save.control === 'tilt' && !tilt.ready) {
    const allowed = await tilt.enable();
    if (!allowed) {
      useButtons();
      toast(t('drive.tiltDenied'), 3500);
    }
  }
  resetRun();
  setMode('countdown');
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
    els.countdown.textContent = t('drive.countGo');
    sounds.count(true);
    setMode('driving');
    tilt.recenter();
    if (tiltOn()) {
      toast(t('drive.tiltHint'), 2600);
    } else {
      toast(t('drive.collectAll'), 2200);
    }
    setTimeout(() => els.countdown.classList.remove('is-on'), 700);
  }, 800);
}

function finish() {
  setMode('finished');
  sounds.stopEngine();
  sounds.finish();
  const key = bestKey(save.scenario, save.difficulty, save.track);
  const previous = save.best[key];
  const isBest = !previous || state.time < previous;
  if (isBest) {
    save.best[key] = Math.round(state.time * 10) / 10;
    store();
  }
  recordPlay(GAME_ID, { key: 'progress.drive', vars: { count: points.length, time: formatTime(state.time) } });
  els.finishTime.textContent = t('drive.finishTime', { time: formatTime(state.time) });
  els.finishBest.textContent = '';
  if (isBest) {
    els.finishBest.textContent = t('drive.newBest');
  } else {
    els.finishBest.textContent = t('drive.best', { time: formatTime(previous) });
  }
  setTimeout(() => {
    if (mode !== 'finished') {
      return;
    }
    els.finishPanel.dataset.ready = 'yes';
    els.finishPanel.hidden = false;
    els.again.focus({ preventScroll: true });
  }, 1400);
}

function pause() {
  if (mode !== 'driving' && mode !== 'countdown') {
    return;
  }
  clearInterval(countdownTimer);
  els.countdown.classList.remove('is-on');
  setMode('paused');
  els.resume.focus({ preventScroll: true });
}

function resume() {
  setMode('driving');
  tilt.recenter();
}

function toGarage() {
  clearInterval(countdownTimer);
  els.countdown.classList.remove('is-on');
  placeCarAtStart();
  setMode('garage');
  renderGarage();
}

/* ---------- The loop ---------- */

let last = performance.now();
let clock = 0;
let frame = 0;

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
  frame += 1;
  if (track && car) {
    if (mode === 'driving' || mode === 'finished') {
      if (mode === 'driving') {
        state.time += dt;
      }
      drive(dt);
      collectPoints();
      hitBoosts();
      syncCar(dt);
      kickUp(dt);
      chaseCamera(dt);
      sounds.engine(Math.min(1.3, state.speed / TOP_SPEED), state.usingNitro);
      renderHud();
      if (frame % 4 === 0) {
        updateMinimap();
      }
    } else if (mode === 'countdown') {
      syncCar(dt);
      chaseCamera(dt);
    } else if (mode === 'garage') {
      syncCar(dt);
      showroomCamera(clock);
    }
    // The builder covers the view, so the 3D scene can rest.
    if (mode !== 'paused' && mode !== 'builder') {
      view.animate(dt, clock, track.samples[state.index].t, view.camera.position);
      view.render();
    }
  }
}

/* ---------- Controls ---------- */

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, select, textarea')) {
    return;
  }
  if ((event.code === 'Escape' || event.code === 'KeyP') && (mode === 'driving' || mode === 'countdown')) {
    pause();
    return;
  }
  const action = KEYS[event.code];
  if (!action || mode === 'garage') {
    return;
  }
  event.preventDefault();
  input.keys.add(action);
});

document.addEventListener('keyup', (event) => {
  const action = KEYS[event.code];
  if (action) {
    input.keys.delete(action);
  }
});

// Touch pads: held while the finger stays down.
function holdPad(button, name) {
  const release = () => {
    input[name] = false;
    button.classList.remove('is-held');
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    sounds.unlock();
    button.setPointerCapture(event.pointerId);
    input[name] = true;
    button.classList.add('is-held');
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

holdPad(els.steerLeft, 'left');
holdPad(els.steerRight, 'right');

els.pause.addEventListener('click', pause);
els.resume.addEventListener('click', resume);
els.restart.addEventListener('click', startRun);
els.again.addEventListener('click', startRun);
els.changeButtons.forEach((button) => button.addEventListener('click', toGarage));
els.go.addEventListener('click', startRun);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    pause();
  }
  updateMusic();
});

// Each track has its own song, playing in the garage and on the road.
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

window.addEventListener('blur', () => {
  input.keys.clear();
});

/* ---------- Garage ---------- */

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

function carSilhouette(design) {
  const shape = carOutline(design);
  const wheelY = -shape.wheel;
  return `
    <svg viewBox="-2.7 -2 5.4 2.3" aria-hidden="true">
      <path class="sil-body" d="${shape.body}"/>
      <path class="sil-cabin" d="${shape.cabin}"/>
      <circle class="sil-wheel" cx="${shape.wheelBase}" cy="${wheelY}" r="${shape.wheel}"/>
      <circle class="sil-wheel" cx="${-shape.wheelBase}" cy="${wheelY}" r="${shape.wheel}"/>
    </svg>`;
}

function renderGarage() {
  els.scenarioOptions.replaceChildren(...SCENARIOS.map((scenario) => radioCard(
    'scenario',
    scenario,
    !save.track && save.scenario === scenario,
    `<span class="card-art art-${scenario}" aria-hidden="true"></span><strong>${t(`drive.scenario.${scenario}`)}</strong><small>${t(`drive.scenarioBlurb.${scenario}`)}</small>`,
    async (value) => {
      save.scenario = value;
      save.track = null;
      store();
      renderGarage();
      await loadScenario();
    },
  )));
  renderMyTracks();
  renderCustom();
  renderControls();
  els.carOptions.replaceChildren(...CARS.map((design) => radioCard(
    'car',
    design,
    save.car === design,
    `${carSilhouette(design)}<strong>${t(`drive.car.${design}`)}</strong>`,
    (value) => {
      save.car = value;
      store();
      setCar();
      renderGarage();
    },
  )));
  els.paintOptions.replaceChildren(...PAINTS.map((paint, i) => {
    const swatch = radioCard('paint', paint, save.paint === paint, `<span class="swatch" style="--paint: ${paint}"></span>`, (value) => {
      save.paint = value;
      store();
      car.setColor(value);
      renderGarage();
    });
    swatch.setAttribute('aria-label', t('drive.paintColor', { number: i + 1 }));
    swatch.title = t('drive.paintColor', { number: i + 1 });
    return swatch;
  }));
  els.difficultyOptions.replaceChildren(...DIFFICULTIES.map((difficulty) => radioCard(
    'difficulty',
    difficulty,
    save.difficulty === difficulty,
    `<strong>${t(`drive.difficulty.${difficulty}`)}</strong>`,
    (value) => {
      save.difficulty = value;
      store();
      renderGarage();
    },
  )));
  els.difficultyBlurb.textContent = t(`drive.difficultyBlurb.${save.difficulty}`);
  const best = save.best[bestKey(save.scenario, save.difficulty, save.track)];
  els.bestLine.textContent = t('drive.noBest');
  if (best) {
    els.bestLine.textContent = t('drive.best', { time: formatTime(best) });
  }
}

/* ---------- Car extras ---------- */

// A row of choices for one extra: words, or color dots for colors.
function customRow(key) {
  const row = document.createElement('div');
  row.className = 'custom-row';
  const title = document.createElement('p');
  title.textContent = t(`drive.custom.${key}`);
  const options = document.createElement('div');
  options.className = 'custom-options';
  options.setAttribute('role', 'radiogroup');
  options.setAttribute('aria-label', title.textContent);
  options.append(...CUSTOM_OPTIONS[key].map((value, i) => {
    let inner = `<strong>${t(`drive.${key}.${value}`)}</strong>`;
    if (value.startsWith('#')) {
      inner = `<span class="swatch" style="--paint: ${value}"></span>`;
    }
    const card = radioCard(`custom-${key}`, value, save.custom[key] === value, inner, () => {
      save.custom[key] = value;
      store();
      setCar();
      renderCustom();
    });
    card.classList.add('card-custom');
    if (value.startsWith('#')) {
      card.classList.add('card-paint');
      card.setAttribute('aria-label', t('drive.colorChoice', { number: i + 1 }));
    }
    return card;
  }));
  row.append(title, options);
  return row;
}

// Ready-made looks: one tap sets the paint and every extra.
function presetRow() {
  const row = document.createElement('div');
  row.className = 'custom-row';
  const title = document.createElement('p');
  title.textContent = t('drive.presets');
  const options = document.createElement('div');
  options.className = 'custom-options';
  options.append(...PRESETS.map((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card card-custom card-preset';
    const accent = preset.custom.decalColor ?? preset.custom.stripeColor ?? preset.paint;
    button.innerHTML = `<span class="preset-dot" style="--paint: ${preset.paint}; --accent: ${accent}" aria-hidden="true"></span><strong></strong>`;
    button.querySelector('strong').textContent = t(`drive.preset.${preset.id}`);
    button.addEventListener('click', () => {
      save.paint = preset.paint;
      save.custom = presetCustom(preset);
      store();
      setCar();
      renderGarage();
    });
    return button;
  }));
  row.append(title, options);
  return row;
}

function renderCustom() {
  const keys = Object.keys(CUSTOM_OPTIONS).filter((key) => {
    if (key === 'stripeColor') {
      return save.custom.stripes !== 'none';
    }
    // Flames have their own fiery colors.
    if (key === 'decalColor') {
      return save.custom.decal !== 'none' && save.custom.decal !== 'flames';
    }
    return true;
  });
  els.customRows.replaceChildren(presetRow(), ...keys.map(customRow));
}

/* ---------- Steering ---------- */

const tilt = createTilt();

function tiltOn() {
  return save.control === 'tilt' && tilt.ready;
}

function useButtons() {
  save.control = 'buttons';
  store();
  tilt.disable();
  renderControls();
}

// Buttons or tilt. Only offered where there's a motion sensor; asking for
// it has to happen in the tap itself, so this listens to clicks.
function renderControls() {
  els.steeringPick.hidden = !tiltAvailable();
  els.controlNote.textContent = '';
  if (save.control === 'tilt') {
    els.controlNote.textContent = t('drive.tiltNote');
  }
  els.controlOptions.replaceChildren(...['buttons', 'tilt'].map((control) => {
    const card = radioCard('control', control, save.control === control, `<strong>${t(`drive.control.${control}`)}</strong>`, () => {});
    card.querySelector('input').addEventListener('click', async () => {
      if (control === 'buttons') {
        useButtons();
        return;
      }
      const allowed = await tilt.enable();
      if (!allowed) {
        useButtons();
        els.controlNote.textContent = t('drive.tiltDenied');
        return;
      }
      save.control = 'tilt';
      store();
      renderControls();
    });
    return card;
  }));
}

// With tilt steering, a tap on the road straightens up.
els.view.addEventListener('pointerdown', (event) => {
  if (tiltOn() && mode === 'driving' && !event.target.closest('button')) {
    tilt.recenter();
  }
});

/* ---------- Built tracks ---------- */

function renderMyTracks() {
  els.trackOptions.replaceChildren(...save.tracks.map((built) => {
    const card = radioCard(
      'scenario',
      built.id,
      save.track === built.id,
      `<span class="track-dot art-${built.scenario}" aria-hidden="true"></span><strong></strong>`,
      async () => {
        save.track = built.id;
        save.scenario = built.scenario;
        store();
        renderGarage();
        await loadScenario();
      },
    );
    card.classList.add('card-track');
    card.querySelector('strong').textContent = built.name;
    return card;
  }));
  els.editTrack.hidden = !builtTrack();
}

function keepTrack(built) {
  const index = save.tracks.findIndex((existing) => existing.id === built.id);
  if (index === -1) {
    save.tracks.push(built);
  } else {
    save.tracks[index] = built;
  }
  store();
}

const builder = createBuilder(els.builder, {
  isSaved: (id) => save.tracks.some((built) => built.id === id),
  onSave(built) {
    keepTrack(built);
  },
  async onDrive(built) {
    keepTrack(built);
    save.track = built.id;
    save.scenario = built.scenario;
    store();
    setMode('garage');
    renderGarage();
    await loadScenario();
  },
  async onDelete(id) {
    save.tracks = save.tracks.filter((built) => built.id !== id);
    Object.keys(save.best).filter((key) => key.startsWith(`track-${id}-`)).forEach((key) => {
      delete save.best[key];
    });
    const wasDriving = save.track === id;
    if (wasDriving) {
      save.track = null;
    }
    store();
    setMode('garage');
    renderGarage();
    if (wasDriving) {
      await loadScenario();
    }
  },
  onClose() {
    setMode('garage');
    renderGarage();
  },
});

els.buildTrack.addEventListener('click', () => {
  builder.open(null, save.scenario);
  setMode('builder');
});

els.editTrack.addEventListener('click', () => {
  builder.open(builtTrack());
  setMode('builder');
});

/* ---------- Sound, chrome, sizing ---------- */

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
  if (save.sound && mode === 'driving') {
    sounds.startEngine();
  }
}

function renderMusic() {
  els.music.setAttribute('aria-pressed', String(save.music));
  let label = t('drive.musicOff');
  if (save.music) {
    label = t('drive.musicOn');
  }
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
setupFavoriteButton(els.favorite, GAME_ID, t('game.drive.title'));
setupFullscreen($('.fullscreen-button'), { slot: $('.focus-slot'), onChange: resize });
renderSound();
renderMusic();
renderGarage();
setMode('garage');
resize();
loadScenario().then(() => {
  setCar();
  requestAnimationFrame(loop);
});
