// Driving sounds made with the Web Audio API (no audio files, works
// offline): an engine that rises with speed, pickups, nitro and bumps.

import { getAudioContext, getNoiseBuffer } from '../../shared/audio.js';

export function createSounds() {
  let enabled = true;
  let engine = null;

  function ready() {
    if (!enabled) {
      return null;
    }
    return getAudioContext();
  }

  function tone(frequency, at, length, wave = 'triangle', volume = 0.14, slideTo = null) {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, start);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, start + length);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + length + 0.05);
  }

  function whoosh(volume, from, to, length) {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + length * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
    source.stop(start + length + 0.05);
  }

  // Two buzzy oscillators through a low-pass filter: a cartoon engine.
  function startEngine() {
    const ctx = ready();
    if (!ctx || engine) {
      return;
    }
    const low = ctx.createOscillator();
    low.type = 'sawtooth';
    const high = ctx.createOscillator();
    high.type = 'square';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 3;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const highGain = ctx.createGain();
    highGain.gain.value = 0.25;
    low.connect(filter);
    high.connect(highGain).connect(filter);
    filter.connect(gain).connect(ctx.destination);
    low.start();
    high.start();
    engine = { ctx, low, high, filter, gain };
  }

  function stopEngine() {
    if (!engine) {
      return;
    }
    const { ctx, low, high, gain } = engine;
    gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    low.stop(ctx.currentTime + 0.3);
    high.stop(ctx.currentTime + 0.3);
    engine = null;
  }

  return {
    setEnabled(value) {
      enabled = value;
      if (!value) {
        stopEngine();
      }
    },
    unlock() {
      getAudioContext();
    },
    startEngine,
    stopEngine,
    // speed 0–1 of top speed; nitro adds a whine.
    engine(speed, nitro) {
      if (!engine) {
        return;
      }
      const { ctx, low, high, filter, gain } = engine;
      const now = ctx.currentTime;
      // Gear changes: the pitch climbs, then drops a little, four times.
      const gear = Math.min(3, Math.floor(speed * 4));
      const inGear = speed * 4 - gear;
      const pitch = 55 + gear * 12 + inGear * 70 + (nitro ? 25 : 0);
      low.frequency.setTargetAtTime(pitch, now, 0.05);
      high.frequency.setTargetAtTime(pitch * 2.01, now, 0.05);
      filter.frequency.setTargetAtTime(500 + speed * 1600 + (nitro ? 800 : 0), now, 0.08);
      gain.gain.setTargetAtTime(0.045 + speed * 0.05, now, 0.1);
    },
    // Higher and higher pickups in a row.
    collect(streak) {
      const base = 660 * 2 ** (Math.min(streak, 8) / 12);
      tone(base, 0, 0.12, 'square', 0.07);
      tone(base * 1.5, 0.07, 0.25, 'triangle', 0.13);
    },
    nitro() {
      whoosh(0.35, 400, 3000, 0.8);
    },
    bump() {
      tone(120, 0, 0.18, 'square', 0.08, 60);
      whoosh(0.2, 900, 300, 0.2);
    },
    count(last) {
      if (last) {
        tone(1046, 0, 0.5, 'square', 0.08);
        return;
      }
      tone(523, 0, 0.2, 'square', 0.07);
    },
    finish() {
      [523, 659, 784, 1047, 1319, 1568].forEach((frequency, i) => tone(frequency, i * 0.09, 0.35, 'triangle', 0.13));
    },
  };
}
