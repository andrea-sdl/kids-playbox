import { GAMES } from './shared/games.js';
import { getFavorites } from './shared/favorites.js';
import { getProgress } from './shared/progress.js';
import { readJSON, writeJSON } from './shared/store.js';
import { readSeen, registerServiceWorker, setupFavoriteButton, setupLanguage, STAR_SVG, writeSeen } from './shared/chrome.js';
import { getLanguage, t } from './shared/i18n.js';
import { RELEASES, badgesFor, hasUnseenReleases, latestVersion } from './shared/changelog.js';
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
    <span class="game-art">${game.icon}<span class="game-badge" hidden></span></span>
    <span class="game-title"></span>
    <span class="game-blurb"></span>
    <span class="game-progress"></span>
    <span class="game-offline" hidden></span>`;
  const title = t(`game.${game.id}.title`);
  link.querySelector('.game-title').textContent = title;
  link.querySelector('.game-blurb').textContent = t(`game.${game.id}.blurb`);
  link.querySelector('.game-offline').textContent = t('home.worksOffline');
  const badge = badgesFor(readSeen())[game.id];
  if (badge) {
    const badgeElement = link.querySelector('.game-badge');
    badgeElement.hidden = false;
    badgeElement.textContent = t(`badge.${badge}`);
    badgeElement.classList.add(`is-${badge}`);
  }
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

/* ---------- What's new ---------- */

const whatsNewButton = document.querySelector('.whats-new-button');
const whatsNewDot = document.querySelector('.whats-new-dot');
const whatsNewDialog = document.querySelector('.whats-new');
const releaseList = document.querySelector('.release-list');

function renderReleases() {
  const dateFormat = new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'long' });
  const items = RELEASES.map((release) => {
    const item = document.createElement('li');
    const heading = document.createElement('h3');
    // Noon avoids the date shifting a day in some time zones.
    const date = dateFormat.format(new Date(`${release.date}T12:00:00`));
    heading.textContent = `${t('whatsNew.version', { version: release.version })} · ${date}`;
    const changes = document.createElement('ul');
    release.changes.forEach((change) => {
      const row = document.createElement('li');
      row.innerHTML = '<span class="change-type"></span> <strong></strong><span class="change-text"></span>';
      const type = row.querySelector('.change-type');
      type.textContent = t(`whatsNew.type.${change.type}`);
      type.classList.add(`is-${change.type}`);
      // Game changes say which game; app-wide changes speak for themselves.
      if (change.target !== 'app') {
        row.querySelector('strong').textContent = `${t(`game.${change.target}.title`)}: `;
      }
      row.querySelector('.change-text').textContent = t(change.text);
      changes.append(row);
    });
    item.append(heading, changes);
    return item;
  });
  releaseList.replaceChildren(...items);
}

function renderWhatsNewDot() {
  whatsNewDot.hidden = !hasUnseenReleases(readSeen());
}

whatsNewButton.addEventListener('click', () => {
  renderReleases();
  whatsNewDialog.showModal();
  const seen = readSeen();
  seen.release = latestVersion();
  writeSeen(seen);
  renderWhatsNewDot();
  render();
});

document.querySelector('.whats-new-close').addEventListener('click', () => whatsNewDialog.close());
whatsNewDialog.addEventListener('click', (event) => {
  // A tap on the dimmed background closes it too.
  if (event.target === whatsNewDialog) {
    whatsNewDialog.close();
  }
});

renderWhatsNewDot();
