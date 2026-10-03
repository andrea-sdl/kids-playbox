// Lab sounds made with the Web Audio API (no audio files, works offline).

import { getAudioContext } from '../../shared/audio.js';

export function createSounds() {
  let enabled = true;

  function ready() {
    if (!enabled) {
      return null;
    }
    return getAudioContext();
  }

  // A tone that slides from one pitch to another.
  function blip(from, to, at, length, wave = 'sine', volume = 0.16) {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  return {
    setEnabled(value) {
      enabled = value;
    },
    unlock() {
      getAudioContext();
    },
    pop() {
      blip(320, 760, 0, 0.12);
    },
    pick() {
      blip(900, 1100, 0, 0.06, 'triangle', 0.08);
    },
    snap(order = 1) {
      blip(500 + order * 160, 1400 + order * 200, 0, 0.09, 'triangle', 0.14);
      blip(1800, 1200, 0.05, 0.08, 'sine', 0.08);
    },
    unsnap() {
      blip(900, 300, 0, 0.14, 'triangle', 0.12);
    },
    nope() {
      blip(220, 180, 0, 0.16, 'square', 0.05);
      blip(200, 160, 0.12, 0.18, 'square', 0.05);
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((frequency, i) => {
        blip(frequency, frequency * 1.01, i * 0.1, 0.4, 'triangle', 0.13);
      });
      blip(1568, 2093, 0.55, 0.5, 'sine', 0.08);
    },
  };
}
