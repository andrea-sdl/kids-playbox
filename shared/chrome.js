// Shared page behavior: offline support and the favorite star.

import { isFavorite, toggleFavorite } from './favorites.js';
import { saveForOffline } from './offline.js';

// Each page sets <html data-root="..."> to the relative path of the site root,
// so the app works both at a domain root and under a sub-path (GitHub Pages).
export function siteRoot() {
  return document.documentElement.dataset.root || './';
}

// Pass the game's id on a game page: once the page has loaded, all of that
// game's files are saved so it keeps working offline.
export function registerServiceWorker(gameId) {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  const root = siteRoot();
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${root}sw.js`, { scope: root }).catch(() => {
      // Offline support is a bonus; the site still works without it.
    });
    if (gameId) {
      setTimeout(() => saveForOffline([gameId]), 1500);
    }
  });
}

export function renderFavoriteButton(button, gameId, title) {
  const favorite = isFavorite(gameId);
  button.setAttribute('aria-pressed', String(favorite));
  let label = `Add ${title} to favorites`;
  if (favorite) {
    label = `Remove ${title} from favorites`;
  }
  button.setAttribute('aria-label', label);
  button.title = label;
}

export function setupFavoriteButton(button, gameId, title, onChange) {
  renderFavoriteButton(button, gameId, title);
  button.addEventListener('click', () => {
    toggleFavorite(gameId);
    renderFavoriteButton(button, gameId, title);
    button.classList.remove('is-popping');
    // Restart the pop animation.
    void button.offsetWidth;
    button.classList.add('is-popping');
    if (onChange) {
      onChange();
    }
  });
}

export const STAR_SVG = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/>
  </svg>`;
