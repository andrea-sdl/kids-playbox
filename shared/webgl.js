// The 3D games draw with WebGL. Some browsers have it switched off (a
// setting, a privacy mode, or an old graphics driver). Then the game can't
// start, and the page says so instead of staying on "loading" forever.

import { setupLanguage } from './chrome.js';

// Can this browser draw 3D? (The games need WebGL 2.)
export function hasWebGL() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

// Put the "needs WebGL" text where the loading text is.
export function explainNoWebGL(note) {
  document.body.classList.add('no-webgl');
  note.dataset.i18n = 'common.needsWebgl';
  note.classList.add('is-problem');
  note.hidden = false;
}

// Start a 3D game with `load` (which imports the game), or explain why it
// can't start. The page's own strings must be added before this is called.
export function startWith3D(load) {
  if (hasWebGL()) {
    return load();
  }
  explainNoWebGL(document.querySelector('.loading'));
  setupLanguage();
  return null;
}
