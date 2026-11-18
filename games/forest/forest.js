import './strings.js';
import { t, mountLanguagePicker, translatePage, getLanguage } from '../../shared/i18n.js';
import { registerServiceWorker, setupFullscreen } from '../../shared/chrome.js';
import { readJSON, writeJSON } from '../../shared/store.js';
import { recordPlay } from '../../shared/progress.js';
import {
  places,
  road,
  pitch,
  doors,
  neighboringPaintings,
  roadPosition,
  memories,
  memoryLength,
  isCoin,
  stories,
  restore,
  clamp,
} from './world.js';
import { actionText, echoText } from './encounters.js';
import { createWalkRenderer } from './painted.js';
import { traceRing } from './carving.js';
import { forestMusic } from './music.js';
import { makeSound } from './audio.js';

const $ = (id) => document.getElementById(id);
const f = (key) => t('forest.' + key);
const panel = $('panel'),
  body = $('panel-body'),
  stage = $('stage'),
  spots = $('spots');
const state = restore(readJSON('forest:journey', null));
const motion = { walking: false, facing: 1, stride: 0, kneel: 0 };
let renderer;
const keys = new Set();
const heldPointers = new Map();
const score = forestMusic();
let musicOn = readJSON('forest:music', readJSON('forest:sound', true)) !== false;
function syncMusic() {
  $('music').setAttribute('aria-pressed', String(musicOn));
  score.set(playing && musicOn);
}
let audible = readJSON('forest:sound', true) !== false;
const sound = makeSound(audible);
let playing = false,
  running = false,
  target = null,
  nearest = '',
  movie = null,
  inFalls = false;
let time = 0,
  lastStamp = 0,
  nextChirp = 10,
  foot = 0,
  toastUntil = 0,
  saveAt = 0;
const icons = {
  sound: '<path d="M4 9h4l5-4v14l-5-4H4zM16 8q4 4 0 8m3-11q6 7 0 14"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/>',
  settings:
    '<path d="M3 7h4m4 0h10M3 17h10m4 0h4"/><circle cx="9" cy="7" r="2.3"/><circle cx="15" cy="17" r="2.3"/>',
  book: '<path d="M12 6q-5-3-9-1v14q4-2 9 1 5-3 9-1V5q-4-2-9 1v14"/>',
  music:
    '<path d="M9 17V6l11-3v12M9 9l11-3"/><ellipse cx="6" cy="17" rx="3" ry="2.4"/><ellipse cx="17" cy="15" rx="3" ry="2.4"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
};
function icon(el, id) {
  el.innerHTML =
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    icons[id] +
    '</svg>';
}
function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function button(text, cls, fn) {
  const el = node('button', text, cls);
  el.type = 'button';
  el.addEventListener('click', fn);
  return el;
}
function photo(id, cls) {
  const img = node('img', null, cls);
  img.src = 'art/' + id + '.webp';
  img.alt = '';
  return img;
}
function save() {
  const stored = readJSON('forest:journey', null);
  if (stored?.journeyId && stored.journeyId !== state.journeyId) return false;
  return writeJSON('forest:journey', { ...state, found: [...state.found] });
}
function tell(text, seconds = 3) {
  $('toast').textContent = text;
  toastUntil = time + seconds;
}
function soundButton() {
  icon($('sound'), audible ? 'sound' : 'mute');
  $('sound').setAttribute('aria-label', f('effects'));
  $('sound').setAttribute('aria-pressed', String(audible));
}
function stopFeet() {
  keys.clear();
  heldPointers.clear();
  target = null;
  motion.walking = false;
}
function panelTitle(title) {
  const h = node('h2', title);
  h.id = 'panel-title';
  return h;
}
function openPanel(title, cls = '') {
  stopFeet();
  body.replaceChildren(panelTitle(title));
  panel.className = cls;
  if (!panel.open) panel.showModal();
  panel.scrollTop = 0;
}
function help() {
  openPanel(f('how'));
  body.append(node('p', f('controls')), node('p', f('routeHelp')));
}
function settings() {
  openPanel(f('settings'));
  const picker = node('div', null, 'picker');
  const lang = node('div', null, 'lang-slot');
  picker.append(lang, fullscreenButton);
  const actions = node('div', null, 'dialog-actions');
  actions.append(button(f('how'), 'primary', help));
  if (state.started) actions.append(button(f('restart'), 'text-link', confirmRestart));
  body.append(picker, actions);
  mountLanguagePicker();
}
function confirmRestart() {
  openPanel(f('restartTitle'));
  const keep = button(f('keep'), 'primary', () => panel.close());
  const actions = node('div', null, 'dialog-actions');
  actions.append(keep, button(f('restart'), 'text-link', startAgain));
  body.append(node('p', f('restartNote')), actions);
  keep.focus();
}
function startAgain() {
  stopFeet();
  const fresh = restore(null);
  fresh.journeyId = Array.from(crypto.getRandomValues(new Uint32Array(2))).join('-');
  fresh.started = true;
  const saved = writeJSON('forest:journey', { ...fresh, found: [] });
  Object.assign(state, fresh);
  foot = 0;
  Object.assign(motion, { stride: 0, facing: 1, clearedAt: -10 });
  running = false;
  $('run').setAttribute('aria-pressed', 'false');
  panel.close();
  begin();
  if (!saved) tell(f('unsaved'), 5);
}
window.addEventListener('storage', (event) => {
  if (event.key !== 'playbox:forest:journey') return;
  const latest = readJSON('forest:journey', null);
  if (latest?.journeyId && latest.journeyId !== state.journeyId) location.reload();
});
function label(id) {
  if (id === 'ship' && !state.found.has(id)) return f(['lift', 'brush', 'press'][state.shipStep]);
  if (id === 'tree' && !state.found.has(id)) return f('carve');
  return f(id);
}
function mark(id) {
  if (state.found.has(id)) return;
  state.found.add(id);
  save();
  updateCount();
  const s = spots.querySelector('[data-id="' + id + '"]');
  if (s) {
    if (isCoin(id) || id === 'ship') s.remove();
    else {
      s.classList.add('done');
      s.setAttribute('aria-label', label(id));
      s.lastChild.textContent = label(id);
    }
  }
  nearest = '';
  updateNear();
}
function updateCount() {
  const n = state.found.size + ' / ' + memories.length;
  $('count').textContent = n;
  $('journal').setAttribute('aria-label', f('guide') + ' · ' + n);
}
function spotsForRoom() {
  spots.replaceChildren();
  const ways = $('ways');
  ways.replaceChildren();
  const door = doors[state.room];
  if (door) {
    const b = button('', 'spot way', () => {
      target = { x: door.x, y: door.y, arrive: () => enterDoor(door) };
    });
    b.style.left = door.x * 100 + '%';
    b.style.top = '64%';
    b.setAttribute('aria-label', f(door.to));
    b.append(node('span', '↥', 'way-arrow'), node('span', f(door.to), 'tip'));
    ways.append(b);
  }
  for (const tile of neighboringPaintings(state.room)) {
    for (const [id, [x, y]] of Object.entries(places[tile.room].points)) {
      if (state.found.has(id) && (isCoin(id) || id === 'ship')) continue;
      const s = button('', 'spot', () => approach(id, tile.room));
      s.style.left = (x + tile.offset) * 100 + '%';
      s.style.top = y * 100 + '%';
      s.dataset.id = id;
      s.setAttribute('aria-label', label(id));
      s.classList.toggle('done', state.found.has(id));
      s.classList.toggle('coin', isCoin(id));
      s.append(node('span', null, 'spark'), node('span', label(id), 'tip'));
      spots.append(s);
    }
  }
}
function enterPlace() {
  const room = state.room;
  inFalls = false;
  nearest = '';
  $('action').hidden = true;
  $('place').textContent = f(room);
  stage.setAttribute('aria-label', f(room) + ' · ' + f('wander'));
  $('toast').textContent = '';
  $('listen').hidden = !Object.keys(places[state.room].points).length;
  spotsForRoom();
  updateNear();
  save();
}
function begin() {
  $('opening').hidden = true;
  $('play').hidden = false;
  playing = true;
  state.started = true;
  sound.wake();
  if (!renderer) {
    renderer = createWalkRenderer($('world'), $('plate'), $('forest-view'));
    renderer.warm();
  }
  motion.kneel = time + 1.4;
  enterPlace();
  renderer.render(state, motion, movie, time);
  syncMusic();
  stage.focus({ preventScroll: true });
  updateCount();
  recordPlay('forest', { key: 'progress.forest', vars: {} });
  if (!state.found.size) tell(f('wander') + ' · ' + f('look'), 4);
}
function journal() {
  openPanel(f('guide'));
  const mapped = state.found.has('map');
  if (mapped) {
    const map = photo('map', 'journal-map');
    map.alt = f('mapLabel');
    body.append(map);
  } else body.append(node('p', f('hint')));
  body.append(node('p', f('found') + ' · ' + state.found.size + ' / ' + memories.length));
  if (!mapped && !state.found.size) body.append(node('p', f('journalEmpty')));
  for (const [room, place] of Object.entries(places)) {
    const entries = Object.keys(place.points).filter((id) => mapped || state.found.has(id));
    if (!entries.length) continue;
    const ul = node('ul');
    body.append(node('h3', f(room)), ul);
    for (const id of entries) {
      const done = id === 'passage' ? state.finished : state.found.has(id);
      const li = node('li');
      if (done && id !== 'passage') {
        const replay = button(f(id), 'memory-replay', () => {
          panel.close();
          replayMemory(id, journal);
        });
        replay.setAttribute('aria-label', f('replay') + ' · ' + f(id));
        replay.append(node('small', '▶'));
        li.append(node('span', '✓'), replay);
      } else li.append(node('span', done ? '✓' : '·'), document.createTextNode(f(id)));
      ul.append(li);
    }
  }
}
function look() {
  openPanel(f('look'));
  for (const id of Object.keys(places[state.room].points)) {
    if (state.found.has(id) && (isCoin(id) || id === 'ship')) continue;
    const b = button(label(id), 'route', () => {
      panel.close();
      approach(id);
    });
    b.append(node('b', state.found.has(id) ? '✓' : '↗'));
    body.append(b);
  }
}
function destination(id, room = state.room) {
  const [x, y] = places[room].points[id];
  if (id === 'ship') return { x: 0.575, y: 0.824 };
  if (id === 'passage') return { x, y: 0.72 };
  return { x, y: clamp(y + 0.075, 0.74, 0.9) };
}
function approach(id, room = state.room) {
  if (movie || !playing) return;
  const point = destination(id, room);
  const shift = (road.indexOf(room) - road.indexOf(state.room)) * pitch;
  target = { x: point.x + shift, y: point.y, arrive: () => interact(id) };
}
function updateNear() {
  let best = '',
    distance = 0.095;
  for (const id of Object.keys(places[state.room].points)) {
    if (state.found.has(id) && (isCoin(id) || id === 'ship')) continue;
    const p = destination(id),
      d = Math.hypot(p.x - state.x, (p.y - state.y) * 0.65);
    if (d < distance) {
      best = id;
      distance = d;
    }
  }
  if (best === nearest) return;
  nearest = best;
  for (const s of spots.children) s.classList.toggle('near', s.dataset.id === best);
  $('action').hidden = !best;
  if (best) $('action').textContent = label(best) + '  ↗';
}
function encounter(id) {
  const done = state.found.has(id);
  openPanel(f(id), 'encounter');
  const copy = node('div', null, 'insert-copy');
  copy.append(body.firstChild);
  body.append(photo(id, 'insert'), copy);
  if (done)
    copy.append(
      node('p', echoText(id)),
      button(f('go'), 'primary', () => panel.close()),
    );
  else
    copy.append(
      button(actionText(id), 'primary', () => {
        mark(id);
        panel.close();
        replayMemory(id, () => encounter(id));
      }),
    );
}

function rollFilm(kind, after = null) {
  target = null;
  motion.walking = false;
  $('toast').textContent = '';
  movie = { kind, age: 0, after };
  document.body.classList.add('filming');
  score.duck(true);
  if (kind === 'ending') sound.play('stairs');
}
async function replayMemory(id, after = null) {
  rollFilm(id, after);
  const film = movie;
  film.loading = true;
  const still = $('memory-still');
  const animation = $('memory-view');
  let artwork = id;
  if (isCoin(id)) artwork = 'meadow';
  if (id === 'ship') artwork = 'ignition';
  if (id === 'tree') artwork = 'bark';
  still.src = 'art/' + artwork + '.webp';
  still.hidden = false;
  animation.hidden = true;
  $('film-name').textContent = f(id);
  $('screening').hidden = false;
  $('film-skip').textContent = f('skip');
  $('film-skip').focus({ preventScroll: true });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    film.loading = false;
    if (id === 'ship') sound.play('ship');
    return;
  }
  film.request = new AbortController();
  try {
    const response = await fetch('art/films/' + id + '.gif', { signal: film.request.signal });
    if (!response.ok) throw new Error('Memory unavailable');
    const data = await response.blob();
    if (movie !== film) return;
    // Give even consecutive replays of the same GIF a fresh animation clock.
    film.url = URL.createObjectURL(data);
    animation.src = film.url;
    await animation.decode();
    if (movie !== film) return;
    animation.hidden = false;
    still.hidden = true;
    film.loading = false;
    if (id === 'ship') sound.play('ship');
  } catch {
    if (movie === film) $('film-skip').textContent = f('go');
  }
}
function carveTree() {
  openPanel(f('tree'), 'encounter');
  const closeup = node('div', null, 'bark');
  const guide = node('canvas');
  guide.width = 640;
  guide.height = 360;
  guide.setAttribute('aria-label', f('trace'));
  closeup.append(guide);
  const copy = node('div', null, 'insert-copy');
  copy.append(body.firstChild, node('p', f('trace')));
  function finish() {
    mark('tree');
    sound.play('wood');
    motion.kneel = time + 0.7;
    panel.close();
    replayMemory('tree');
  }
  traceRing(guide, finish);
  copy.append(button(f('carve'), 'primary', finish));
  body.append(closeup, copy);
}
function awakenShip() {
  const id = 'ship';
  if (state.found.has(id)) return;
  motion.facing = 1;
  if (state.shipStep < 2) {
    sound.play(state.shipStep ? 'moss' : 'wood');
    ++state.shipStep;
    motion.kneel = time + 0.7;
    motion.clearedAt = time;
    save();
    spotsForRoom();
    nearest = '';
    updateNear();
    tell(label(id));
    return;
  }
  mark(id);
  replayMemory('ship');
  return;
}
function interact(id) {
  if (movie) return;
  if (id === 'passage') {
    if (state.found.size === memories.length) rollFilm('ending');
    else tell(f('locked'), 4);
    inFalls = true;
    return;
  }
  if (id === 'ship') {
    awakenShip();
    return;
  }
  if (id === 'tree' && !state.found.has(id)) {
    carveTree();
    return;
  }
  if (stories.includes(id)) {
    encounter(id);
    return;
  }
  if (isCoin(id) && state.found.has(id)) return;
  mark(id);
  replayMemory(id, id === 'map' ? journal : null);
}
function finalCard() {
  // Hold the last flight drawing beneath the end title until the player returns.
  renderer.render(state, motion, { kind: 'ending', age: 7 }, time);
  openPanel(f('ending'), 'end-card');
  body.append(
    node('p', f('farewell')),
    button(f('return'), 'primary', () => panel.close()),
  );
}
function finishFilm() {
  const { kind, after, request, url } = movie;
  request?.abort();
  if (url) {
    $('memory-view').removeAttribute('src');
    URL.revokeObjectURL(url);
  }
  movie = null;
  $('screening').hidden = true;
  document.body.classList.remove('filming');
  score.duck(false);
  if (kind === 'ending') {
    document.body.classList.add('ending-title');
    state.finished = true;
    state.y = 0.86;
    save();
    finalCard();
    return;
  }
  if (after) {
    after();
    return;
  }
  stage.focus({ preventScroll: true });
  tell(f(kind) + '  ✓');
}
function tickFilm(dt) {
  if (movie.loading) return;
  const previous = movie.age;
  movie.age += dt;
  if (movie.kind === 'ending') {
    if (previous < 2.4 && movie.age >= 2.4) sound.play('flight');
    if (movie.age >= 7) finishFilm();
  } else if (movie.kind === 'ship') {
    if (movie.age >= 5.5) finishFilm();
  } else {
    if (previous < 0.55 && movie.age >= 0.55) sound.play(movie.kind);
    if (movie.age >= memoryLength) finishFilm();
  }
}

function enterDoor(door) {
  state.room = door.to;
  state.x = door.arrivesAt;
  state.y = 0.846;
  stopFeet();
  enterPlace();
}
function passDoor(dy) {
  const door = doors[state.room];
  if (dy >= 0 || !door || state.y > 0.744 || Math.abs(state.x - door.x) > 0.042) return false;
  enterDoor(door);
  return true;
}
function floorEvents() {
  for (const id of Object.keys(places[state.room].points)) {
    if (!isCoin(id) || state.found.has(id)) continue;
    const coin = destination(id);
    if (Math.hypot(state.x - coin.x, (state.y - coin.y) * 0.75) < 0.029) {
      const onward = target;
      mark(id);
      replayMemory(id, () => {
        target = onward;
        stage.focus({ preventScroll: true });
      });
      return;
    }
  }
  if (state.room === 'falls') {
    const touches = Math.abs(state.x - 0.565) < 0.043 && state.y < 0.751;
    if (touches && !inFalls && !target?.arrive) interact('passage');
    inFalls = touches;
  }
}
function walk(dt) {
  const touching = [...heldPointers.values()];
  let dx =
    Number(keys.has('arrowright') || keys.has('d') || touching.includes(1)) -
    Number(keys.has('arrowleft') || keys.has('a') || touching.includes(-1));
  let dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
  const speed = running || keys.has('shift') ? 0.24 : 0.115;
  if (dx || dy) target = null;
  let arrived;
  if (target) {
    dx = target.x - state.x;
    dy = target.y - state.y;
    if (Math.hypot(dx, dy) <= speed * dt + 0.0001) {
      arrived = target;
      target = null;
    }
  }
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < 0.00001) {
    if (motion.walking) save();
    motion.walking = false;
    arrived?.arrive?.();
    return;
  }
  const oldX = state.x,
    oldY = state.y;
  const distance = arrived ? magnitude : speed * dt;
  const localX = oldX + (dx / magnitude) * distance;
  const next = roadPosition(state.room, localX);
  const newRoom = next.room !== state.room;
  const shift = localX - next.x;
  if (newRoom && target) target.x -= shift;
  state.room = next.room;
  state.x = next.x;
  state.y = clamp(oldY + (dy / magnitude) * distance, 0.72, 0.91);
  const moved = Math.hypot(next.x + (newRoom ? shift : 0) - oldX, state.y - oldY);
  if (newRoom) enterPlace();
  motion.walking = moved > 0.00001;
  if (!motion.walking) {
    target = null;
    return;
  }
  if (Math.abs(dx) > 0.015) motion.facing = Math.sign(dx);
  motion.stride += moved * 8;
  motion.kneel = 0;
  if (motion.stride - foot > 0.44) {
    sound.play('step');
    foot = motion.stride;
  }
  updateNear();
  if (passDoor(dy)) return;
  if (arrived?.arrive) {
    arrived.arrive();
    return;
  }
  floorEvents();
  if (time >= saveAt) {
    saveAt = time + 1;
    save();
  }
}
function loop(stamp) {
  const dt = Math.min(0.055, (stamp - lastStamp) / 1000);
  lastStamp = stamp;
  if (playing && !panel.open && !document.hidden) {
    time += dt;
    if (movie) tickFilm(dt);
    else walk(dt);
    if (!panel.open && (!movie || movie.kind === 'ending')) renderer.render(state, motion, movie, time);
    if (!movie && time > nextChirp && state.room !== 'hearth') {
      sound.play('bird');
      nextChirp = time + 12 + Math.random() * 8;
    }
    if (time > toastUntil && $('toast').textContent) $('toast').textContent = '';
  }
  requestAnimationFrame(loop);
}
const movement = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', 'shift'];
document.addEventListener('keydown', (e) => {
  if (!playing || panel.open || movie || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (movement.includes(k)) {
    e.preventDefault();
    keys.add(k);
    return;
  }
  if (e.repeat) return;
  if (k === 'j') journal();

  if (k === 'e' && nearest) {
    e.preventDefault();
    approach(nearest);
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', stopFeet);
window.addEventListener('pagehide', () => {
  if (playing) save();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing) {
    stopFeet();
    save();
  }
});
stage.addEventListener('click', (e) => {
  if (movie || e.target.closest('button')) return;
  const p = renderer.point(e.clientX, e.clientY);
  target = { x: p.x, y: clamp(p.y, 0.72, 0.91) };
  stage.focus({ preventScroll: true });
});
$('begin').onclick = begin;
$('restart').onclick = confirmRestart;
for (const [id, direction] of [
  ['west', -1],
  ['east', 1],
]) {
  const key = $(id);
  key.addEventListener('pointerdown', (e) => {
    if (movie) return;
    e.preventDefault();
    key.setPointerCapture(e.pointerId);
    heldPointers.set(e.pointerId, direction);
  });
  key.addEventListener('lostpointercapture', (e) => heldPointers.delete(e.pointerId));
  key.addEventListener('click', (e) => {
    if (!movie && e.detail === 0) target = { x: state.x + direction * 0.16, y: state.y };
  });
}
$('film-skip').onclick = () => {
  if (movie) finishFilm();
};
$('music').onclick = () => {
  musicOn = !musicOn;
  writeJSON('forest:music', musicOn);
  syncMusic();
};
$('journal').onclick = journal;
$('listen').onclick = look;
$('action').onclick = () => {
  if (nearest) approach(nearest);
};
$('run').onclick = () => {
  running = !running;
  $('run').setAttribute('aria-pressed', String(running));
};
$('settings').onclick = settings;
$('close').onclick = () => panel.close();
$('sound').onclick = () => {
  audible = !audible;
  sound.wake();
  sound.set(audible);
  writeJSON('forest:sound', audible);
  soundButton();
};
document.querySelector('.how').onclick = help;
panel.addEventListener('close', () => {
  document.body.classList.remove('ending-title');
  if (playing && !movie && !panel.open) stage.focus({ preventScroll: true });
});
const fullscreenButton = node('button', null, 'round');
setupFullscreen(fullscreenButton);
translatePage();
document.title = t('game.forest.title') + ' · Playbox';
if (getLanguage() !== 'en') $('title').textContent = t('game.forest.title');
$('begin').firstElementChild.textContent = f(state.started ? 'resume' : 'begin');
$('begin').disabled = false;
$('restart').hidden = !state.started;
document.querySelectorAll('[data-icon]').forEach((el) => icon(el, el.dataset.icon));
soundButton();
syncMusic();
registerServiceWorker('forest');
requestAnimationFrame(loop);
