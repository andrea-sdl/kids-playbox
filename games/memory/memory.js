import { registerServiceWorker, setupFavoriteButton, setupFullscreen, setupLanguage, STAR_SVG } from '../../shared/chrome.js';
import { t } from '../../shared/i18n.js';
import { readJSON, writeJSON } from '../../shared/store.js';
import { recordPlay } from '../../shared/progress.js';
import {
  CARD_BACKS,
  SIZES,
  THEMES,
  buildDeck,
  formatTime,
  isBetter,
  normalizeRecords,
  normalizeSettings,
  pairsFor,
  recordKey,
  starsFor,
} from './logic.js';
import { THEME_INFO } from './themes.js';
import { addPhotos, deletePhoto, listPhotos } from './photos.js';
import { createSounds } from './sound.js';

const GAME_ID = 'memory';
const STORE_KEY = 'game:memory';
const MISS_DELAY_MS = 900;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;

registerServiceWorker(GAME_ID);
setupLanguage();

const $ = (selector) => document.querySelector(selector);

const els = {
  setup: $('.setup'),
  play: $('.play'),
  themeOptions: $('.theme-options'),
  sizeOptions: $('.size-options'),
  backOptions: $('.back-options'),
  photoPanel: $('.photo-panel'),
  photoInput: $('.photo-input'),
  photoCount: $('.photo-count'),
  photoList: $('.photo-list'),
  deal: $('.deal-button'),
  bestLine: $('.best-line'),
  pairs: $('.stat-pairs'),
  moves: $('.stat-moves'),
  time: $('.stat-time'),
  fact: $('.fact'),
  table: $('.table'),
  board: $('.board'),
  zoomIn: $('.zoom-in'),
  zoomOut: $('.zoom-out'),
  zoomFit: $('.zoom-fit'),
  newGame: $('.new-game'),
  sound: $('.sound-button'),
  favorite: $('.favorite-button'),
  win: $('.win-dialog'),
  winStars: $('.win-stars'),
  winDetail: $('.win-detail'),
  winBest: $('.win-best'),
  playAgain: $('.play-again'),
  changeCards: $('.change-cards'),
};

const saved = readJSON(STORE_KEY, {});
let settings = normalizeSettings(saved.settings);
let records = normalizeRecords(saved.records);
const sounds = createSounds();

// Photos: [{ id, url }]. Object URLs are made once and reused.
let photos = [];

// Current game.
let game = null;
let zoom = 1;

function save() {
  writeJSON(STORE_KEY, { settings, records });
}

/* ---------- Items for the chosen theme ---------- */

function themeItems(theme) {
  if (theme === 'photos') {
    return photos.map((photo, i) => ({ key: photo.id, name: t('memory.photoName', { number: i + 1 }), image: photo.url, isPhoto: true }));
  }
  return THEME_INFO[theme].items;
}

function itemArt(item) {
  if (item.flag) {
    return item.flag();
  }
  return `<img src="${item.image}" alt="" decoding="async" draggable="false">`;
}

/* ---------- Setup screen ---------- */

function radioOption(name, value, checked, inner, onChange) {
  const label = document.createElement('label');
  label.className = 'option';
  label.innerHTML = `<input type="radio" name="${name}" value="${value}">${inner}`;
  const input = label.querySelector('input');
  input.checked = checked;
  input.addEventListener('change', () => {
    if (input.checked) {
      onChange(value);
    }
  });
  return label;
}

function themePreview(theme) {
  if (theme === 'photos') {
    if (photos.length > 0) {
      return `<img src="${photos[0].url}" alt="">`;
    }
    return '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="#dfe9ff" stroke="#2b2140" stroke-width="1.5"/><circle cx="9" cy="10" r="2" fill="#ffd23f"/><path d="M4 18l5-5 3 3 3-4 5 6z" fill="#2f8f55"/></svg>';
  }
  const first = THEME_INFO[theme].items[0];
  return itemArt(first);
}

function renderThemes() {
  const options = THEMES.map((theme) => radioOption(
    'theme',
    theme,
    settings.theme === theme,
    `<span class="option-art">${themePreview(theme)}</span><span>${THEME_INFO[theme].label}</span>`,
    (value) => {
      settings.theme = value;
      save();
      renderSetup();
    },
  ));
  els.themeOptions.replaceChildren(...options);
}

function renderSizes() {
  const available = themeItems(settings.theme).length;
  const options = SIZES.map((size) => {
    const option = radioOption(
      'size',
      size,
      settings.size === size,
      `<span>${size}×${size}</span><small>${t('memory.pairsCount', { count: pairsFor(size) })}</small>`,
      (value) => {
        settings.size = value;
        save();
        renderSetup();
      },
    );
    option.querySelector('input').disabled = available < pairsFor(size);
    return option;
  });
  els.sizeOptions.replaceChildren(...options);
}

function renderBacks() {
  const options = CARD_BACKS.map((back) => radioOption(
    'back',
    back,
    settings.back === back,
    `<span class="back-swatch back-${back}"></span><span>${t(`memory.back.${back}`)}</span>`,
    (value) => {
      settings.back = value;
      save();
      renderSetup();
    },
  ));
  els.backOptions.replaceChildren(...options);
}

// Bigger than the photos allow? Fall back to the biggest size that fits.
function fitSizeToTheme() {
  const available = themeItems(settings.theme).length;
  if (available >= pairsFor(settings.size)) {
    return;
  }
  const fitting = SIZES.filter((size) => pairsFor(size) <= available);
  if (fitting.length > 0) {
    settings.size = fitting[fitting.length - 1];
  }
}

function renderPhotos() {
  const isPhotos = settings.theme === 'photos';
  els.photoPanel.hidden = !isPhotos;
  if (!isPhotos) {
    return;
  }
  const count = photos.length;
  const needed = pairsFor(SIZES[0]);
  let text = t('memory.photoCount', { count });
  if (count < needed) {
    text += ` ${t('memory.addMore', { count: needed - count })}`;
  } else {
    const biggest = SIZES.filter((size) => pairsFor(size) <= count).pop();
    text += ` ${t('memory.enoughFor', { size: biggest })}`;
  }
  els.photoCount.textContent = text;
  const items = photos.map((photo) => {
    const item = document.createElement('li');
    item.innerHTML = `<img src="${photo.url}" alt=""><button type="button">×</button>`;
    item.querySelector('button').setAttribute('aria-label', t('memory.removePhoto'));
    item.querySelector('button').addEventListener('click', async () => {
      await deletePhoto(photo.id);
      await loadPhotos();
      renderSetup();
    });
    return item;
  });
  els.photoList.replaceChildren(...items);
}

function renderBest() {
  const best = records[recordKey(settings.theme, settings.size)];
  if (!best) {
    els.bestLine.textContent = t('memory.noRecord');
    return;
  }
  els.bestLine.textContent = t('memory.best', { moves: best.moves, time: formatTime(best.seconds) });
}

function renderSetup() {
  fitSizeToTheme();
  document.body.dataset.back = settings.back;
  renderThemes();
  renderPhotos();
  renderSizes();
  renderBacks();
  renderBest();
  els.deal.disabled = themeItems(settings.theme).length < pairsFor(settings.size);
}

async function loadPhotos() {
  photos.forEach((photo) => URL.revokeObjectURL(photo.url));
  const stored = await listPhotos();
  photos = stored.map((photo) => ({ id: photo.id, url: URL.createObjectURL(photo.blob) }));
}

els.photoInput.addEventListener('change', async () => {
  const files = [...els.photoInput.files];
  els.photoInput.value = '';
  if (files.length === 0) {
    return;
  }
  els.photoCount.textContent = t('memory.adding');
  await addPhotos(files);
  await loadPhotos();
  renderSetup();
});

/* ---------- Board ---------- */

function cardLabel(card, index) {
  if (card.free) {
    return t('memory.freeCard');
  }
  if (card.el.classList.contains('is-flipped') || card.el.classList.contains('is-matched')) {
    return card.item.name;
  }
  return t('memory.faceDown', { number: index + 1 });
}

function createCard(card, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'card';
  let front = '';
  if (card.item) {
    let frontClass = 'card-front card-face';
    if (card.item.isPhoto) {
      frontClass += ' is-photo';
    }
    let name = '';
    if (!card.item.isPhoto) {
      name = `<span class="card-name">${card.item.name}</span>`;
    }
    front = `<span class="${frontClass}">${itemArt(card.item)}${name}</span>`;
  } else {
    front = '<span class="card-front card-face"></span>';
  }
  button.innerHTML = `
    <span class="card-inner">
      <span class="card-face card-back back-${settings.back}"></span>
      ${front}
    </span>`;
  if (card.free) {
    button.classList.add('is-free');
    button.disabled = true;
  }
  card.el = button;
  button.setAttribute('aria-label', cardLabel(card, index));
  button.addEventListener('click', () => flip(index));
  return button;
}

// Cards fly in from a deck at the bottom of the table.
function dealAnimation() {
  const tableRect = els.table.getBoundingClientRect();
  const deckX = tableRect.left + tableRect.width / 2;
  const deckY = tableRect.bottom - 40;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    return;
  }
  game.cards.forEach((card, i) => {
    const rect = card.el.getBoundingClientRect();
    const dx = deckX - (rect.left + rect.width / 2);
    const dy = deckY - (rect.top + rect.height / 2);
    const delay = i * 22;
    card.el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) rotate(${(i % 5) * 4 - 8}deg) scale(0.9)`, opacity: 0 },
        { transform: `translate(${dx}px, ${dy}px) rotate(0) scale(0.9)`, opacity: 1, offset: 0.1 },
        { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
      ],
      { duration: 420, delay, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)', fill: 'backwards' },
    );
    sounds.deal(delay / 1000);
  });
}

function startGame() {
  sounds.unlock();
  const items = themeItems(settings.theme);
  const byKey = new Map(items.map((item) => [item.key, item]));
  const deck = buildDeck(items.map((item) => item.key), settings.size);
  game = {
    size: settings.size,
    theme: settings.theme,
    cards: deck.map((card) => ({ ...card, item: byKey.get(card.key) || null })),
    open: [],
    matched: 0,
    pairs: pairsFor(settings.size),
    moves: 0,
    startedAt: null,
    timer: null,
    locked: false,
  };
  els.board.style.setProperty('--size', game.size);
  els.board.replaceChildren(...game.cards.map(createCard));
  els.fact.textContent = t('memory.findPairs');
  els.setup.hidden = true;
  els.play.hidden = false;
  window.scrollTo(0, 0);
  fitBoard();
  setZoom(1);
  renderHud();
  requestAnimationFrame(dealAnimation);
}

function renderHud() {
  els.pairs.textContent = `${game.matched}/${game.pairs}`;
  els.moves.textContent = String(game.moves);
  let seconds = 0;
  if (game.startedAt) {
    seconds = (Date.now() - game.startedAt) / 1000;
  }
  els.time.textContent = formatTime(seconds);
}

function showFact(item) {
  let text = t('memory.named', { name: item.name });
  if (item.fact) {
    text = t('memory.withFact', { name: item.name, fact: item.fact });
  }
  if (item.isPhoto) {
    text = t('memory.match');
  }
  els.fact.textContent = text;
  els.fact.classList.remove('is-new');
  void els.fact.offsetWidth;
  els.fact.classList.add('is-new');
}

function flip(index) {
  const card = game.cards[index];
  if (game.locked || card.free || card.matched || game.open.includes(index)) {
    return;
  }
  if (!game.startedAt) {
    game.startedAt = Date.now();
    game.timer = setInterval(renderHud, 500);
  }
  card.el.classList.add('is-flipped');
  card.el.setAttribute('aria-label', cardLabel(card, index));
  sounds.flip();
  game.open.push(index);
  if (game.open.length < 2) {
    return;
  }

  game.moves += 1;
  const [first, second] = game.open.map((i) => game.cards[i]);
  if (first.key === second.key) {
    game.open = [];
    first.matched = true;
    second.matched = true;
    game.matched += 1;
    setTimeout(() => {
      first.el.classList.add('is-matched');
      second.el.classList.add('is-matched');
      sounds.match();
      showFact(first.item);
    }, 250);
    renderHud();
    if (game.matched === game.pairs) {
      setTimeout(finish, 900);
    }
    return;
  }

  game.locked = true;
  renderHud();
  setTimeout(() => {
    [first, second].forEach((openCard) => openCard.el.classList.add('is-missed'));
    sounds.miss();
  }, 450);
  setTimeout(() => {
    game.open.forEach((i) => {
      const openCard = game.cards[i];
      openCard.el.classList.remove('is-flipped', 'is-missed');
      openCard.el.setAttribute('aria-label', cardLabel(openCard, i));
    });
    game.open = [];
    game.locked = false;
  }, MISS_DELAY_MS + 250);
}

function finish() {
  clearInterval(game.timer);
  const seconds = Math.round((Date.now() - game.startedAt) / 1000);
  const result = { moves: game.moves, seconds };
  const key = recordKey(game.theme, game.size);
  const isBest = isBetter(result, records[key]);
  if (isBest) {
    records[key] = result;
    save();
  }
  recordPlay(GAME_ID, { key: 'progress.memory', vars: { size: game.size, moves: game.moves } });

  const stars = starsFor(game.moves, game.pairs);
  els.winStars.replaceChildren(...[1, 2, 3].map((n) => {
    const star = document.createElement('span');
    if (n <= stars) {
      star.className = 'is-on';
    }
    return star;
  }));
  els.winDetail.textContent = t('memory.winDetail', { moves: game.moves, time: formatTime(seconds) });
  els.winBest.textContent = '';
  if (isBest) {
    els.winBest.textContent = t('memory.newRecord');
  }
  sounds.win();
  els.win.showModal();
}

/* ---------- Zoom (buttons, pinch, ctrl + wheel) ---------- */

const CARD_RATIO = 5 / 4; // height / width

// Space the table's padding and border take, which is less in focus mode.
function tableChrome() {
  const style = getComputedStyle(els.table);
  const sum = (...names) => names.reduce((total, name) => total + parseFloat(style[name]), 0);
  return {
    x: sum('paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'),
    y: sum('paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'),
  };
}

// "Fit" means the whole board is visible: as wide as the table allows,
// but not taller than the space left on screen.
function fitBoard() {
  if (els.play.hidden) {
    return;
  }
  // Measured from the top of the page, as if scrolled to the top.
  const top = els.table.getBoundingClientRect().top + window.scrollY;
  const available = Math.max(280, window.innerHeight - top - 16);
  els.table.style.maxHeight = `${available}px`;
  const chrome = tableChrome();
  const tableWidth = els.table.getBoundingClientRect().width - chrome.x;
  const widthForHeight = (available - chrome.y) / CARD_RATIO;
  const fitWidth = Math.min(tableWidth, widthForHeight, 900);
  els.board.style.setProperty('--fit-width', `${Math.floor(fitWidth)}px`);
}

window.addEventListener('resize', fitBoard);

function setZoom(value) {
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  els.board.style.setProperty('--zoom', zoom);
}

// Keep the point under the fingers or mouse still while zooming.
function zoomAround(value, clientX, clientY) {
  const tableRect = els.table.getBoundingClientRect();
  const x = clientX - tableRect.left + els.table.scrollLeft;
  const y = clientY - tableRect.top + els.table.scrollTop;
  const before = zoom;
  setZoom(value);
  const ratio = zoom / before;
  els.table.scrollLeft = x * ratio - (clientX - tableRect.left);
  els.table.scrollTop = y * ratio - (clientY - tableRect.top);
}

els.zoomIn.addEventListener('click', () => setZoom(zoom * 1.25));
els.zoomOut.addEventListener('click', () => setZoom(zoom / 1.25));
els.zoomFit.addEventListener('click', () => setZoom(1));

els.table.addEventListener('wheel', (event) => {
  if (!event.ctrlKey) {
    return;
  }
  event.preventDefault();
  zoomAround(zoom * Math.exp(-event.deltaY / 200), event.clientX, event.clientY);
}, { passive: false });

const pointers = new Map();
let pinchStart = null;

els.table.addEventListener('pointerdown', (event) => {
  pointers.set(event.pointerId, event);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), zoom };
  }
});

els.table.addEventListener('pointermove', (event) => {
  if (!pointers.has(event.pointerId)) {
    return;
  }
  pointers.set(event.pointerId, event);
  if (pointers.size !== 2 || !pinchStart) {
    return;
  }
  const [a, b] = [...pointers.values()];
  const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  zoomAround(pinchStart.zoom * (distance / pinchStart.distance), (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
});

function endPointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) {
    pinchStart = null;
  }
}

els.table.addEventListener('pointerup', endPointer);
els.table.addEventListener('pointercancel', endPointer);

/* ---------- Buttons ---------- */

function backToSetup() {
  if (game) {
    clearInterval(game.timer);
  }
  if (els.win.open) {
    els.win.close();
  }
  els.play.hidden = true;
  els.setup.hidden = false;
  renderSetup();
}

function renderSound() {
  els.sound.setAttribute('aria-pressed', String(settings.sound));
  let label = t('common.soundOff');
  if (settings.sound) {
    label = t('common.soundOn');
  }
  els.sound.setAttribute('aria-label', label);
  els.sound.title = label;
  els.sound.querySelector('.sound-on').toggleAttribute('hidden', !settings.sound);
  els.sound.querySelector('.sound-off').toggleAttribute('hidden', settings.sound);
  sounds.setEnabled(settings.sound);
}

els.deal.addEventListener('click', startGame);
els.newGame.addEventListener('click', backToSetup);
els.changeCards.addEventListener('click', backToSetup);
els.playAgain.addEventListener('click', () => {
  els.win.close();
  startGame();
});
els.sound.addEventListener('click', () => {
  settings.sound = !settings.sound;
  save();
  renderSound();
  sounds.unlock();
  sounds.flip();
});

setupFullscreen(document.querySelector('.fullscreen-button'), fitBoard);
els.favorite.innerHTML = STAR_SVG;
setupFavoriteButton(els.favorite, GAME_ID, t('game.memory.title'));

renderSound();
renderSetup();
loadPhotos().then(renderSetup);
