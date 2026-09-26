import { GAMES } from './shared/games.js';
import { getFavorites } from './shared/favorites.js';
import { getProgress } from './shared/progress.js';
import { readJSON, writeJSON } from './shared/store.js';
import { registerServiceWorker, setupFavoriteButton, STAR_SVG } from './shared/chrome.js';

registerServiceWorker();

const grid = document.querySelector('.game-grid');
const emptyFavorites = document.querySelector('.empty-favorites');
const filterButtons = document.querySelectorAll('.filter');

let filter = readJSON('home-filter', 'all');
if (filter !== 'favorites') {
  filter = 'all';
}

function progressText(gameId) {
  const progress = getProgress(gameId);
  if (progress.plays === 0) {
    return 'Not played yet';
  }
  let unit = 'times';
  if (progress.plays === 1) {
    unit = 'time';
  }
  let text = `Played ${progress.plays} ${unit}`;
  if (progress.last) {
    text += ` · ${progress.last}`;
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
    <span class="game-progress"></span>`;
  link.querySelector('.game-title').textContent = game.title;
  link.querySelector('.game-blurb').textContent = game.blurb;
  link.querySelector('.game-progress').textContent = progressText(game.id);

  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'chunky-button icon-button star-button';
  star.innerHTML = STAR_SVG;
  setupFavoriteButton(star, game.id, game.title, () => {
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
  item.textContent = 'More games coming soon!';
  return item;
}

function render() {
  const games = sortedGames();
  grid.replaceChildren(...games.map(createCard));
  if (filter === 'all') {
    grid.append(createComingSoon());
  }
  emptyFavorites.hidden = !(filter === 'favorites' && games.length === 0);
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

// "Install" button for browsers that support the install prompt.
const installButton = document.querySelector('.install-button');
let installPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
});
