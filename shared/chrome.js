// Shared page behavior: offline support, update notice, "seen" tracking
// for What's new, and the favorite star.

import { isFavorite, toggleFavorite } from './favorites.js';
import { saveForOffline } from './offline.js';
import { mountLanguagePicker, t, translatePage } from './i18n.js';
import { latestVersion, normalizeSeen } from './changelog.js';
import { readJSON, writeJSON } from './store.js';

const UPDATE_CHECK_MS = 30 * 60 * 1000;

// Translate the static page text and add the language menu. Call once each
// page's own strings have been added.
export function setupLanguage() {
  translatePage();
  mountLanguagePicker();
  showVersion();
}

// The version this page is running, in the footer. If it's older than the
// newest release, this copy hasn't updated yet.
function showVersion() {
  const footer = document.querySelector('.site-footer');
  if (!footer) {
    return;
  }
  const version = document.createElement('p');
  version.className = 'app-version';
  version.textContent = `Playbox · ${t('whatsNew.version', { version: latestVersion() })}`;
  footer.append(version);
}

// Each page sets <html data-root="..."> to the relative path of the site root,
// so the app works both at a domain root and under a sub-path (GitHub Pages).
export function siteRoot() {
  return document.documentElement.dataset.root || './';
}

export function readSeen() {
  return normalizeSeen(readJSON('seen', null));
}

export function writeSeen(seen) {
  writeJSON('seen', seen);
}

// Opening a game clears its "New" or "Updated" badge on the home page.
function markGameSeen(gameId) {
  const seen = readSeen();
  seen.games[gameId] = latestVersion();
  writeSeen(seen);
}

function showUpdateBanner() {
  if (document.querySelector('.update-banner')) {
    return;
  }
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = '<span></span><button class="chunky-button update-refresh" type="button"></button><button class="chunky-button update-later" type="button"></button>';
  banner.querySelector('span').textContent = `✨ ${t('update.ready')}`;
  banner.querySelector('.update-refresh').textContent = t('update.refresh');
  banner.querySelector('.update-later').textContent = t('update.later');
  banner.querySelector('.update-refresh').addEventListener('click', () => location.reload());
  banner.querySelector('.update-later').addEventListener('click', () => banner.remove());
  document.body.append(banner);
}

// A new version installs quietly in the background. When it takes over
// this page, offer a refresh instead of reloading by surprise (a game could
// be in progress). Apps left open for days check again when shown.
function watchForUpdates(registration, hadController) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) {
      showUpdateBanner();
    }
  });
  let lastCheck = Date.now();
  const check = () => {
    if (Date.now() - lastCheck < UPDATE_CHECK_MS) {
      return;
    }
    lastCheck = Date.now();
    registration.update().catch(() => {
      // Offline: try again later.
    });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      check();
    }
  });
  setInterval(check, UPDATE_CHECK_MS);
}

// Pass the game's id on a game page: once the page has loaded, all of that
// game's files are saved so it keeps working offline.
export function registerServiceWorker(gameId) {
  if (gameId) {
    markGameSeen(gameId);
  }
  if (!('serviceWorker' in navigator)) {
    return;
  }
  const root = siteRoot();
  // The first install also "takes over" the page; that's not an update.
  const hadController = Boolean(navigator.serviceWorker.controller);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${root}sw.js`, { scope: root })
      .then((registration) => watchForUpdates(registration, hadController))
      .catch(() => {
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
  let label = t('common.favoriteAdd', { title });
  if (favorite) {
    label = t('common.favoriteRemove', { title });
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

/* ---------- Full screen ---------- */

export const FULLSCREEN_BUTTON = `
  <svg class="fs-enter" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <svg class="fs-exit" viewBox="0 0 24 24" aria-hidden="true" hidden><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

// Focus mode hides the top bar, footer and extras so the game gets the whole
// screen. The full-screen, sound and music buttons move into `slot`, a spot
// inside the game itself, and go back to the top bar afterwards. Where the
// browser allows it (not iPhone Safari), the page also goes truly full screen.
export function setupFullscreen(button, { slot = null, onChange = null } = {}) {
  button.innerHTML = FULLSCREEN_BUTTON;
  const root = document.documentElement;
  const movable = [button, ...document.querySelectorAll('.topbar .music-button, .topbar .sound-button')];
  const homes = movable.map((element) => ({ element, parent: element.parentNode, next: element.nextSibling }));

  function moveButtons(intoGame) {
    if (!slot) {
      return;
    }
    if (intoGame) {
      slot.append(...movable);
      return;
    }
    // Put back last-first, so each button's old neighbor is already home.
    [...homes].reverse().forEach(({ element, parent, next }) => {
      parent.insertBefore(element, next);
    });
  }

  function render(on) {
    document.body.classList.toggle('is-immersive', on);
    moveButtons(on);
    button.setAttribute('aria-pressed', String(on));
    let label = t('common.fullscreen');
    if (on) {
      label = t('common.exitFullscreen');
    }
    button.setAttribute('aria-label', label);
    button.title = label;
    button.querySelector('.fs-enter').toggleAttribute('hidden', on);
    button.querySelector('.fs-exit').toggleAttribute('hidden', !on);
    if (onChange) {
      onChange(on);
    }
  }

  async function setFocus(on) {
    render(on);
    try {
      if (on && !fullscreenElement()) {
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        if (request) {
          await request.call(root);
        }
      }
      if (!on && fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        await exit.call(document);
      }
    } catch {
      // Full screen was refused; focus mode still works.
    }
  }

  button.addEventListener('click', () => {
    setFocus(!document.body.classList.contains('is-immersive'));
  });

  // Leaving full screen with Esc or a system gesture also leaves focus mode.
  const onFullscreenChange = () => {
    if (!fullscreenElement() && document.body.classList.contains('is-immersive')) {
      render(false);
    }
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
  render(false);
  return {
    leave() {
      if (document.body.classList.contains('is-immersive')) {
        setFocus(false);
      }
    },
  };
}
