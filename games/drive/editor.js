// The track builder: add straights and curves, see the track from above,
// name it, pick its scenery, save it, and share it as a file or a code.

import { t } from '../../shared/i18n.js';
import { ROAD_WIDTH, SCENARIOS } from './world.js';
import {
  checkTrack,
  cleanName,
  closingPath,
  fileName,
  newTrackId,
  piecePath,
  readTrack,
  trackCode,
  trackFile,
} from './tracks.js';

const MESSAGE_MS = 2600;

function formatLength(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

function pathData(points) {
  return points.map(([x, z], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${z.toFixed(1)}`).join(' ');
}

// callbacks: isSaved(id), onSave(track), onDrive(track), onDelete(id), onClose()
export function createBuilder(root, callbacks) {
  const $ = (selector) => root.querySelector(selector);
  const els = {
    svg: $('.builder-svg'),
    status: $('.builder-status'),
    name: $('.builder-name input'),
    look: $('.builder-look'),
    undo: $('.undo-piece'),
    clear: $('.clear-pieces'),
    save: $('.builder-save'),
    drive: $('.builder-drive'),
    exportButton: $('.builder-export'),
    copy: $('.builder-copy'),
    importButton: $('.builder-import'),
    remove: $('.builder-delete'),
    importer: $('.builder-importer'),
    code: $('.import-code'),
    load: $('.import-load'),
    file: $('.import-file input'),
    close: $('.builder-close'),
  };

  let track = null;
  let message = null;
  let messageTimer = null;
  let removeArmed = false;
  let clearArmed = false;

  function say(text) {
    message = text;
    render();
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      message = null;
      render();
    }, MESSAGE_MS);
  }

  function currentName() {
    return cleanName(els.name.value, t('drive.defaultName'));
  }

  /* ---------- Map ---------- */

  function renderMap(check) {
    const { points, end } = piecePath(track.pieces);
    const back = closingPath(end);
    const all = [...points, ...back];
    let minX = Math.min(...all.map(([x]) => x), -40);
    let maxX = Math.max(...all.map(([x]) => x), 120);
    let minZ = Math.min(...all.map(([, z]) => z), -60);
    let maxZ = Math.max(...all.map(([, z]) => z), 60);
    const pad = 40;
    minX -= pad;
    minZ -= pad;
    maxX += pad;
    maxZ += pad;
    els.svg.setAttribute('viewBox', `${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`);

    const backPath = [[end.x, end.z], ...back, [0, 0]];
    let arrow = '';
    if (track.pieces.length > 0) {
      const degrees = (end.heading * 180) / Math.PI;
      arrow = `<g transform="translate(${end.x.toFixed(1)} ${end.z.toFixed(1)}) rotate(${degrees.toFixed(1)})"><path class="map-arrow" d="M14 0 L-8 -11 L-3 0 L-8 11 Z"/></g>`;
    }
    let spot = '';
    if (check.spot) {
      spot = `<circle class="map-problem" cx="${check.spot.x.toFixed(1)}" cy="${check.spot.z.toFixed(1)}" r="${ROAD_WIDTH * 1.6}"/>`;
    }
    els.svg.innerHTML = `
      <path class="builder-back-edge" d="${pathData(backPath)}" stroke-width="${ROAD_WIDTH + 4}"/>
      <path class="builder-back" d="${pathData(backPath)}" stroke-width="${ROAD_WIDTH}"/>
      <path class="builder-road-edge" d="${pathData(points)}" stroke-width="${ROAD_WIDTH + 4}"/>
      <path class="builder-road" d="${pathData(points)}" stroke-width="${ROAD_WIDTH}"/>
      <path class="builder-middle" d="${pathData(points)}"/>
      <rect class="builder-start" x="-3" y="${-ROAD_WIDTH / 2}" width="6" height="${ROAD_WIDTH}"/>
      ${arrow}
      ${spot}`;
  }

  /* ---------- Everything else ---------- */

  function statusText(check) {
    if (message) {
      return message;
    }
    if (check.ok) {
      return t('drive.track.ok', { length: formatLength(check.length) });
    }
    return t(`drive.track.${check.problem}`);
  }

  function renderLook() {
    const options = SCENARIOS.map((scenario) => {
      const label = document.createElement('label');
      label.className = 'card card-look';
      label.innerHTML = `<input type="radio" name="builder-look" value="${scenario}"><span class="card-art art-${scenario}" aria-hidden="true"></span><strong></strong>`;
      label.querySelector('strong').textContent = t(`drive.scenario.${scenario}`);
      const input = label.querySelector('input');
      input.checked = track.scenario === scenario;
      input.addEventListener('change', () => {
        if (input.checked) {
          track.scenario = scenario;
          render();
        }
      });
      return label;
    });
    els.look.replaceChildren(...options);
  }

  function render() {
    if (!track) {
      return;
    }
    const check = checkTrack(track.pieces);
    renderMap(check);
    els.status.textContent = statusText(check);
    els.status.classList.toggle('is-ok', check.ok && !message);
    els.status.classList.toggle('is-problem', !check.ok && track.pieces.length > 0 && !message);
    els.undo.disabled = track.pieces.length === 0;
    els.clear.disabled = track.pieces.length === 0;
    els.clear.textContent = t(clearArmed ? 'common.tapAgain' : 'drive.clearTrack');
    [els.save, els.drive, els.exportButton, els.copy].forEach((button) => {
      button.disabled = !check.ok;
    });
    els.remove.hidden = !callbacks.isSaved(track.id);
    els.remove.textContent = t(removeArmed ? 'drive.deleteConfirm' : 'drive.deleteTrack');
  }

  function addPiece(piece) {
    track.pieces += piece;
    clearArmed = false;
    render();
  }

  function finished() {
    return { ...track, name: currentName() };
  }

  root.querySelectorAll('[data-piece]').forEach((button) => {
    button.addEventListener('click', () => addPiece(button.dataset.piece));
  });

  els.undo.addEventListener('click', () => {
    track.pieces = track.pieces.slice(0, -1);
    render();
  });

  els.clear.addEventListener('click', () => {
    if (!clearArmed) {
      clearArmed = true;
      render();
      return;
    }
    clearArmed = false;
    track.pieces = '';
    render();
  });

  els.save.addEventListener('click', () => {
    track = finished();
    callbacks.onSave(track);
    say(t('drive.trackSaved'));
  });

  els.drive.addEventListener('click', () => {
    track = finished();
    callbacks.onDrive(track);
  });

  // Share the file where the device can (phones open the share sheet),
  // otherwise download it.
  els.exportButton.addEventListener('click', async () => {
    const ready = finished();
    const text = trackFile(ready);
    const file = new File([text], fileName(ready), { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: ready.name });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }
      }
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName(ready);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  els.copy.addEventListener('click', async () => {
    const code = trackCode(finished());
    try {
      await navigator.clipboard.writeText(code);
      say(t('drive.copied'));
    } catch {
      // No clipboard: show the code so it can be copied by hand.
      els.importer.hidden = false;
      els.code.value = code;
      els.code.select();
    }
  });

  els.importButton.addEventListener('click', () => {
    els.importer.hidden = !els.importer.hidden;
    if (!els.importer.hidden) {
      els.code.value = '';
      els.code.focus();
    }
  });

  function loadText(text) {
    const imported = readTrack(text, t('drive.defaultName'));
    if (!imported) {
      say(t('drive.importFailed'));
      return;
    }
    open(imported);
    say(t('drive.imported'));
  }

  els.load.addEventListener('click', () => loadText(els.code.value));

  els.file.addEventListener('change', async () => {
    const [file] = els.file.files;
    els.file.value = '';
    if (!file) {
      return;
    }
    loadText(await file.text());
  });

  els.remove.addEventListener('click', () => {
    if (!removeArmed) {
      removeArmed = true;
      render();
      return;
    }
    removeArmed = false;
    callbacks.onDelete(track.id);
  });

  els.close.addEventListener('click', () => callbacks.onClose());

  // Open a saved track to edit, or start a new one in `scenario`.
  function open(next, scenario = 'city') {
    track = next ? { ...next } : { id: newTrackId(), name: '', scenario, pieces: '' };
    removeArmed = false;
    clearArmed = false;
    message = null;
    els.name.value = track.name;
    els.name.placeholder = t('drive.defaultName');
    els.importer.hidden = true;
    renderLook();
    render();
  }

  return { open };
}
