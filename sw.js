// Service worker: stores every file the app needs so it runs fully offline.
// Bump VERSION when adding or removing files, so old caches are cleared.

const VERSION = 'playbox-v3';

const FILES = [
  './',
  './index.html',
  './home.css',
  './home.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './shared/base.css',
  './shared/chrome.js',
  './shared/favorites.js',
  './shared/games.js',
  './shared/progress.js',
  './shared/store.js',
  './games/dice/',
  './games/dice/index.html',
  './games/dice/dice.css',
  './games/dice/dice.js',
  './games/dice/logic.js',
  './games/dice/mascots.js',
  './games/dice/sound.js',
  './games/dice/audio.js',
  './games/dice/music.js',
  './games/dice/songs.js',
  './games/dice/art/bg-princess.webp',
  './games/dice/art/bg-cowboy.webp',
  './games/dice/art/bg-explorer.webp',
  './games/dice/art/bg-pixel.webp',
  './games/dice/art/tex-princess.webp',
  './games/dice/art/tex-cowboy.webp',
  './games/dice/art/tex-explorer.webp',
  './games/dice/art/tex-pixel.webp',
  './games/dice/art/bg-prince.webp',
  './games/dice/art/bg-cowgirl.webp',
  './games/dice/art/bg-adventurer.webp',
  './games/dice/art/bg-pixel-girl.webp',
  './games/dice/art/bg-witch.webp',
  './games/dice/art/bg-wizard.webp',
  './games/dice/art/tex-prince.webp',
  './games/dice/art/tex-mage.webp',
  './games/dice/art/sprite-witch.webp',
  './games/dice/art/sprite-wizard.webp',
  './games/dice/art/face-witch.webp',
  './games/dice/art/face-wizard.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate: answer from the cache right away (fast, and works
// offline), then refresh the cached copy in the background so the next
// visit picks up any update.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(respond(event, request));
});

async function refresh(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

async function respond(event, request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) {
    event.waitUntil(refresh(request).catch(() => {
      // Offline: keep the cached copy.
    }));
    return cached;
  }
  try {
    return await refresh(request);
  } catch (error) {
    if (request.mode === 'navigate') {
      const home = await caches.match('./');
      if (home) {
        return home;
      }
    }
    throw error;
  }
}
