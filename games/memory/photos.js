// The player's own photos for custom card sets.
// Photos are shrunk to small squares and kept only on this device, in
// IndexedDB (localStorage is too small for images). Nothing is uploaded.

const DB_NAME = 'playbox';
const STORE = 'memory-photos';
const SIDE = 320;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const result = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(result.result ?? result);
    transaction.onerror = () => reject(transaction.error);
  });
}

// Newest first: [{ id, blob, created }]
export async function listPhotos() {
  try {
    const photos = await withStore('readonly', (store) => store.getAll());
    return photos.sort((a, b) => b.created - a.created);
  } catch {
    return [];
  }
}

export function deletePhoto(id) {
  return withStore('readwrite', (store) => store.delete(id));
}

// Center-crop to a square and shrink, so photos stay small.
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIDE;
  canvas.height = SIDE;
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  bitmap.close();
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.82);
  });
}

// Returns how many photos were added.
export async function addPhotos(files) {
  let added = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      continue;
    }
    try {
      const blob = await shrink(file);
      const photo = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, blob, created: Date.now() };
      await withStore('readwrite', (store) => store.put(photo));
      added += 1;
    } catch {
      // Skip pictures the browser can't read (e.g. some HEIC files).
    }
  }
  return added;
}
