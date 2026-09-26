// All sounds are made on the fly with the Web Audio API, so there are no
// audio files to download and everything works offline.

import { getAudioContext, getNoiseBuffer } from './audio.js';

const TUNES = {
  princess: { wave: 'sine', notes: [784, 988, 1175, 1568] },
  cowboy: { wave: 'triangle', notes: [392, 494, 587, 784] },
  explorer: { wave: 'triangle', notes: [330, 415, 494, 659] },
  pixel: { wave: 'square', notes: [523, 659, 784, 1047] },
};

export function createSounds() {
  let enabled = true;

  function ready() {
    if (!enabled) {
      return null;
    }
    return getAudioContext();
  }

  function burst({ at = 0, length = 0.05, frequency = 2500, q = 3, volume = 0.5 }) {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime + at;
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start, Math.random() * 0.3);
    source.stop(start + length + 0.02);
  }

  function note(frequency, at, length, wave, volume = 0.15) {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  return {
    setEnabled(value) {
      enabled = value;
    },
    // Browsers only allow audio after a tap; call this from a click handler.
    unlock() {
      getAudioContext();
    },
    tick() {
      burst({ length: 0.03, frequency: 3200, volume: 0.25 });
    },
    whoosh() {
      const ctx = ready();
      if (!ctx) {
        return;
      }
      const start = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(400, start);
      filter.frequency.exponentialRampToValueAtTime(2200, start + 0.3);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(start);
      source.stop(start + 0.4);
    },
    clackAt(ms, loudness = 1) {
      burst({ at: ms / 1000, length: 0.06, frequency: 1800 + Math.random() * 1600, q: 4, volume: 0.6 * loudness });
      burst({ at: ms / 1000 + 0.035, length: 0.04, frequency: 2600 + Math.random() * 1200, q: 5, volume: 0.3 * loudness });
    },
    select(mascot) {
      const tune = TUNES[mascot];
      note(tune.notes[0], 0, 0.12, tune.wave, 0.1);
      note(tune.notes[2], 0.08, 0.16, tune.wave, 0.1);
    },
    tada(mascot, big) {
      const tune = TUNES[mascot];
      tune.notes.forEach((frequency, i) => {
        note(frequency, i * 0.09, 0.25, tune.wave);
      });
      if (big) {
        tune.notes.forEach((frequency, i) => {
          note(frequency * 2, 0.4 + i * 0.07, 0.3, tune.wave, 0.1);
        });
      }
    },
  };
}
