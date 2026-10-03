// Service worker: makes the app work fully offline without downloading
// every game up front.
//
// - The "shell" (home page and shared files) is saved on install.
// - Each game's files are saved the first time the game is opened, or
//   when the home page asks for it ("Save all for offline", or quietly on
//   an unmetered connection).
// - Games already saved stay saved when a new version is installed.
//
// The file lists live in offline.json. Bump VERSION on every release so
// players get the update on their next visit.

const VERSION = 'playbox-v20';
const MANIFEST_URL = './offline.json';

async function fetchManifest() {
  const response = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  const cache = await caches.open(VERSION);
  await cache.put(MANIFEST_URL, response.clone());
  return response.json();
}

async function readManifest() {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(MANIFEST_URL);
  if (cached) {
    return cached.json();
  }
  return fetchManifest();
}

async function hasAll(cache, files) {
  const matches = await Promise.all(files.map((file) => cache.match(file)));
  return matches.every(Boolean);
}

async function saveFiles(files) {
  const cache = await caches.open(VERSION);
  await cache.addAll(files.map((file) => new Request(file, { cache: 'no-cache' })));
}

// Copy a game from an old cache when the network is not available.
async function copyFiles(fromCache, files) {
  const cache = await caches.open(VERSION);
  await Promise.all(files.map(async (file) => {
    const response = await fromCache.match(file);
    if (response) {
      await cache.put(file, response);
    }
  }));
}

// A game counts as saved in an old version if its page is there. (Its file
// list may have changed since, so the list itself can't be compared.)
async function savedIn(oldKeys, id) {
  for (const key of oldKeys) {
    const oldCache = await caches.open(key);
    if (await oldCache.match(`./games/${id}/index.html`)) {
      return oldCache;
    }
  }
  return null;
}

// Games saved in the old version are saved again for this one while
// installing, when the old version still runs the app. Doing it on
// activate would hold up every page the app opens until the downloads end.
async function carryOverSavedGames(manifest) {
  const oldKeys = (await caches.keys()).filter((key) => key !== VERSION);
  for (const [id, files] of Object.entries(manifest.games)) {
    const oldCache = await savedIn(oldKeys, id);
    if (!oldCache) {
      continue;
    }
    try {
      await saveFiles(files);
    } catch {
      await copyFiles(oldCache, files);
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const manifest = await fetchManifest();
    await saveFiles(manifest.shell);
    await carryOverSavedGames(manifest);
    await self.skipWaiting();
  })());
});

// Keep this quick: pages wait for it before they can load anything. Old
// copies are deleted afterwards, without holding anything up (if that gets
// cut short, the next update cleans up).
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))));
});

async function gameStatus() {
  const manifest = await readManifest();
  const cache = await caches.open(VERSION);
  const games = {};
  for (const [id, files] of Object.entries(manifest.games)) {
    games[id] = await hasAll(cache, files);
  }
  return { games };
}

async function saveGames(ids) {
  const manifest = await readManifest();
  const failed = [];
  for (const id of ids) {
    const files = manifest.games[id];
    if (!files) {
      continue;
    }
    try {
      await saveFiles(files);
    } catch {
      failed.push(id);
    }
  }
  return { ...(await gameStatus()), failed };
}

// Pages talk to the worker with { type: 'status' } or { type: 'save', ids }.
// The answer goes back on the MessageChannel port the page sends along.
self.addEventListener('message', (event) => {
  const port = event.ports[0];
  const message = event.data || {};
  let work = null;
  if (message.type === 'status') {
    work = gameStatus();
  }
  if (message.type === 'save' && Array.isArray(message.ids)) {
    work = saveGames(message.ids);
  }
  if (!work || !port) {
    return;
  }
  event.waitUntil(work.then((result) => port.postMessage(result), () => port.postMessage(null)));
});

// Stale-while-revalidate: answer from the cache right away (fast, and works
// offline), then refresh the cached copy in the background so the next
// visit picks up any update. Files not cached yet come from the network and
// are kept for next time.
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
