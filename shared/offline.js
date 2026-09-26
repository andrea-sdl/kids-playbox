// Ask the service worker which games are saved for offline use, or to save
// some. Returns null when offline support is not available.

const TIMEOUT_MS = 60000;

async function activeWorker() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), 5000);
    }),
  ]);
  if (!registration || !registration.active) {
    return null;
  }
  return registration.active;
}

async function ask(message) {
  const worker = await activeWorker();
  if (!worker) {
    return null;
  }
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), TIMEOUT_MS);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

// { games: { dice: true, memory: false, ... } }
export function offlineStatus() {
  return ask({ type: 'status' });
}

export function saveForOffline(ids) {
  return ask({ type: 'save', ids });
}

// True when downloading extra files is unlikely to cost the family money or
// slow them down. Browsers that don't tell us (like Safari) count as "no".
export function onUnmeteredConnection() {
  const connection = navigator.connection;
  if (!connection) {
    return false;
  }
  if (connection.saveData) {
    return false;
  }
  if (connection.type === 'cellular') {
    return false;
  }
  return connection.effectiveType === '4g';
}
