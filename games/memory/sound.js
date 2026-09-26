// Card sounds made with the Web Audio API (no audio files, works offline).

import { getAudioContext, getNoiseBuffer } from '../../shared/audio.js';

export function createSounds() {
  let enabled = true;

  function ready() {
    if (!enabled) {
      return null;
    }
    return getAudioContext();
  }

  function swish(at, volume, from, to, length) {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime + at;
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + length * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start, Math.random() * 0.3);
    source.stop(start + length + 0.02);
  }

  function tone(frequency, at, length, wave = 'sine', volume = 0.14) {
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
    flip() {
      swish(0, 0.35, 2500, 900, 0.12);
    },
    deal(at) {
      swish(at, 0.18, 3500, 1800, 0.06);
    },
    match() {
      tone(784, 0, 0.3);
      tone(1175, 0.08, 0.4);
    },
    miss() {
      tone(220, 0, 0.18, 'triangle', 0.12);
      tone(185, 0.1, 0.22, 'triangle', 0.1);
    },
    win() {
      [523, 659, 784, 1047, 784, 1047].forEach((frequency, i) => {
        tone(frequency, i * 0.11, 0.35, 'triangle', 0.13);
      });
    },
  };
}
