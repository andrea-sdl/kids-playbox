// Riding sounds made with the Web Audio API (no audio files, works
// offline): wheels or snow rolling, a pop for jumps, a thud on landing, a
// scrape on rails, whooshes for tricks and chimes for letters and combos.

import { getAudioContext, getNoiseBuffer } from '../../shared/audio.js';

export function createSounds() {
  let enabled = true;
  let roll = null;
  let scrape = null;

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

  function hiss(volume, type, from, to, length, at = 0) {
    const ctx = ready();
    if (!ctx) {
      return;
    }
    const start = ctx.currentTime + at;
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.02, length * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
    source.stop(start + length + 0.05);
  }

  // A looping noise through a filter, for rolling and grinding.
  function loop(type, frequency, q) {
    const ctx = ready();
    if (!ctx) {
      return null;
    }
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    return { ctx, source, filter, gain };
  }

  function stopLoop(sound) {
    if (!sound) {
      return;
    }
    sound.gain.gain.setTargetAtTime(0.0001, sound.ctx.currentTime, 0.05);
    sound.source.stop(sound.ctx.currentTime + 0.3);
  }

  function stopAll() {
    stopLoop(roll);
    stopLoop(scrape);
    roll = null;
    scrape = null;
  }

  return {
    setEnabled(value) {
      enabled = value;
      if (!value) {
        stopAll();
      }
    },
    unlock() {
      getAudioContext();
    },
    start() {
      if (!roll) {
        roll = loop('lowpass', 500, 0.7);
      }
      if (!scrape) {
        scrape = loop('bandpass', 2600, 4);
      }
    },
    stop: stopAll,
    // speed 0–1; kind: 'dust' (wheels), 'snow' or 'sand'; mode as in physics.
    ride(speed, kind, mode) {
      if (!roll || !scrape) {
        return;
      }
      const now = roll.ctx.currentTime;
      const rolling = mode === 'ground' ? speed : 0;
      let frequency = 380 + speed * 500;
      let volume = 0.05;
      if (kind === 'snow') {
        frequency = 2200 + speed * 1800;
        volume = 0.035;
      }
      if (kind === 'sand') {
        frequency = 900 + speed * 900;
        volume = 0.04;
      }
      roll.filter.type = kind === 'dust' ? 'lowpass' : 'bandpass';
      roll.filter.frequency.setTargetAtTime(frequency, now, 0.1);
      roll.gain.gain.setTargetAtTime(Math.max(0.0001, rolling * volume), now, 0.06);
      scrape.gain.gain.setTargetAtTime(mode === 'grind' ? 0.08 : 0.0001, now, 0.03);
    },
    pop() {
      tone(180, 0, 0.08, 'square', 0.06, 90);
      hiss(0.18, 'highpass', 3000, 6000, 0.06);
    },
    land(strength) {
      tone(110, 0, 0.18, 'sine', 0.12 + strength * 0.1, 45);
      hiss(0.12 + strength * 0.1, 'lowpass', 1200, 200, 0.18);
    },
    trick() {
      hiss(0.12, 'bandpass', 600, 2400, 0.3);
    },
    grind() {
      tone(1400, 0, 0.12, 'square', 0.03, 900);
    },
    bump() {
      tone(100, 0, 0.15, 'square', 0.06, 50);
    },
    letter(index) {
      const base = 660 * 2 ** (index / 6);
      tone(base, 0, 0.14, 'square', 0.06);
      tone(base * 1.5, 0.08, 0.3, 'triangle', 0.12);
    },
    allLetters() {
      [784, 988, 1175, 1568].forEach((frequency, i) => tone(frequency, i * 0.1, 0.4, 'triangle', 0.12));
    },
    // A happy jingle; bigger combos climb higher.
    combo(level) {
      const notes = [523, 659, 784, 1047, 1319].slice(0, 2 + level);
      notes.forEach((frequency, i) => tone(frequency, i * 0.07, 0.25, 'triangle', 0.1));
    },
    bail() {
      hiss(0.3, 'lowpass', 2000, 150, 0.5);
      tone(300, 0, 0.45, 'sawtooth', 0.05, 80);
    },
    count(last) {
      if (last) {
        tone(1046, 0, 0.5, 'square', 0.08);
        return;
      }
      tone(523, 0, 0.2, 'square', 0.07);
    },
    finish() {
      [784, 659, 784, 1047].forEach((frequency, i) => tone(frequency, i * 0.12, 0.4, 'triangle', 0.13));
    },
  };
}
