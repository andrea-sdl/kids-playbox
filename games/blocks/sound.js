// Building sounds made with the Web Audio API (no files, works offline).

import { getAudioContext, getNoiseBuffer } from '../../shared/audio.js';

export function createSounds() {
  let enabled = true;

  function ready() {
    if (!enabled) {
      return null;
    }
    return getAudioContext();
  }

  function click(frequency, volume, length) {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start, Math.random() * 0.3);
    source.stop(start + length + 0.02);
  }

  function tone(from, to, length, volume, wave = 'sine') {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  return {
    setEnabled(value) {
      enabled = value;
    },
    unlock() {
      getAudioContext();
    },
    // The snap of two bricks clicking together.
    place() {
      click(2400, 0.6, 0.05);
      click(1300, 0.35, 0.08);
    },
    remove() {
      tone(500, 180, 0.15, 0.2, 'triangle');
    },
    paint() {
      tone(700, 1100, 0.12, 0.12);
    },
    nope() {
      tone(180, 140, 0.15, 0.15, 'square');
    },
  };
}
