import { GAMES } from './shared/games.js';
import { getFavorites } from './shared/favorites.js';
import { getProgress } from './shared/progress.js';
import { readJSON, writeJSON } from './shared/store.js';
import { registerServiceWorker, setupFavoriteButton, setupLanguage, STAR_SVG } from './shared/chrome.js';
import { t } from './shared/i18n.js';
import { offlineStatus, onUnmeteredConnection, saveForOffline } from './shared/offline.js';

registerServiceWorker();
setupLanguage();

const grid = document.querySelector('.game-grid');
const offlineBar = document.querySelector('.offline-bar');
const offlineSummary = document.querySelector('.offline-summary');
const saveOfflineButton = document.querySelector('.save-offline');
// Which games are saved for offline use, from the service worker.
let savedGames = {};
const emptyFavorites = document.querySelector('.empty-favorites');
const filterButtons = document.querySelectorAll('.filter');

let filter = readJSON('home-filter', 'all');
if (filter !== 'favorites') {
  filter = 'all';
}

function progressText(gameId) {
  const progress = getProgress(gameId);
  if (progress.plays === 0) {
    return t('home.notPlayed');
  }
  let text = t('home.played', { count: progress.plays });
  // Older saves stored plain English text; newer ones a translatable summary.
  if (typeof progress.last === 'string' && progress.last) {
    text += ` · ${progress.last}`;
  }
  if (typeof progress.last === 'object') {
    text += ` · ${t(progress.last.key, progress.last.vars)}`;
  }
  return text;
}

// Favorites first, then the original order.
function sortedGames() {
  const favorites = getFavorites();
  const favoriteGames = GAMES.filter((game) => favorites.includes(game.id));
  const otherGames = GAMES.filter((game) => !favorites.includes(game.id));
  if (filter === 'favorites') {
    return favoriteGames;
  }
  return [...favoriteGames, ...otherGames];
}

function createCard(game) {
  const item = document.createElement('li');
  item.className = 'game-card';
  item.style.setProperty('--card-color', game.color);

  const link = document.createElement('a');
  link.className = 'game-link';
  link.href = game.path;
  link.innerHTML = `
    <span class="game-art">${game.icon}</span>
    <span class="game-title"></span>
    <span class="game-blurb"></span>
    <span class="game-progress"></span>
    <span class="game-offline" hidden></span>`;
  const title = t(`game.${game.id}.title`);
  link.querySelector('.game-title').textContent = title;
  link.querySelector('.game-blurb').textContent = t(`game.${game.id}.blurb`);
  link.querySelector('.game-offline').textContent = t('home.worksOffline');
  link.querySelector('.game-progress').textContent = progressText(game.id);
  item.dataset.id = game.id;

  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'chunky-button icon-button star-button';
  star.innerHTML = STAR_SVG;
  setupFavoriteButton(star, game.id, title, () => {
    // In the favorites view, removing a star should remove the card.
    if (filter === 'favorites') {
      render();
    }
  });

  item.append(link, star);
  return item;
}

function createComingSoon() {
  const item = document.createElement('li');
  item.className = 'coming-soon';
  item.textContent = t('home.comingSoon');
  return item;
}

function render() {
  const games = sortedGames();
  grid.replaceChildren(...games.map(createCard));
  if (filter === 'all') {
    grid.append(createComingSoon());
  }
  emptyFavorites.hidden = !(filter === 'favorites' && games.length === 0);
  renderOffline();
  filterButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
  });
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    writeJSON('home-filter', filter);
    render();
  });
});

// Coming back with the browser's back button can restore a cached page.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    render();
  }
});

render();

/* ---------- Offline ---------- */


function renderOffline() {
  document.querySelectorAll('.game-card').forEach((card) => {
    card.querySelector('.game-offline').hidden = !savedGames[card.dataset.id];
  });
  const total = GAMES.length;
  const saved = GAMES.filter((game) => savedGames[game.id]).length;
  if (saved === total) {
    offlineSummary.textContent = t('home.allOffline');
    saveOfflineButton.hidden = true;
    return;
  }
  offlineSummary.textContent = t('home.someOffline', { saved, total });
  saveOfflineButton.hidden = false;
}

async function refreshOffline() {
  const status = await offlineStatus();
  if (!status) {
    return;
  }
  savedGames = status.games;
  offlineBar.hidden = false;
  renderOffline();
}

async function saveAll() {
  saveOfflineButton.disabled = true;
  saveOfflineButton.textContent = t('home.saving');
  const status = await saveForOffline(GAMES.map((game) => game.id));
  saveOfflineButton.disabled = false;
  saveOfflineButton.textContent = t('home.saveAll');
  if (!status) {
    offlineSummary.textContent = t('home.saveFailed');
    return;
  }
  savedGames = status.games;
  renderOffline();
  if (status.failed && status.failed.length > 0) {
    offlineSummary.textContent += ` ${t('home.someFailed')}`;
  }
}

saveOfflineButton.addEventListener('click', saveAll);

window.addEventListener('load', async () => {
  await refreshOffline();
  // On Wi-Fi or a fast unmetered line, quietly save everything.
  const missing = GAMES.some((game) => !savedGames[game.id]);
  if (missing && onUnmeteredConnection()) {
    setTimeout(saveAll, 3000);
  }
});
