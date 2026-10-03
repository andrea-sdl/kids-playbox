// Background music for each track, played live with Web Audio synths (no
// audio files, works offline). Each song is a short loop: drums, a bass
// line, an arpeggio over a chord progression and a soft pad. A look-ahead
// scheduler queues notes slightly early so the beat stays steady.

import { getAudioContext, getNoiseBuffer } from '../../shared/audio.js';

const MUSIC_VOLUME = 0.2;
const LOOKAHEAD_SECONDS = 0.15;
const TICK_MS = 30;
const FADE_SECONDS = 0.8;

// Patterns are 16 steps (sixteenth notes) per bar. Drums: x = hit.
// Bass: hex digits are semitones above the chord root (c = an octave),
// '.' is a rest.
// Arpeggio: numbers pick chord notes (0 = root, 1 = third, 2 = fifth,
// 3 = octave), '.' is a rest. Chords: [root, 'minor' | 'major'], one per bar.
export const SONGS = {
  // Neon synthwave: four-on-the-floor, octave bass, bright arpeggios.
  city: {
    bpm: 118,
    chords: [[57, 'minor'], [53, 'major'], [48, 'major'], [55, 'major']],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: '0.c.0.c.0.c.0.c.',
    arp: '0123210301232103',
    arpSound: 'saw',
    pad: true,
  },
  // Jungle drums and a wooden marimba.
  jungle: {
    bpm: 108,
    chords: [[62, 'minor'], [60, 'major'], [58, 'major'], [60, 'major']],
    kick: 'x..x..x...x..x..',
    snare: '......x.......x.',
    hat: 'xxxxxxxxxxxxxxxx',
    tom: '..........x.x.x.',
    bass: '0..0..7...0..5..',
    arp: '0.2.1.3.2.0.3.1.',
    arpSound: 'marimba',
    pad: false,
  },
  // A dusty desert groove with a twangy pluck.
  wasteland: {
    bpm: 96,
    chords: [[52, 'minor'], [52, 'minor'], [48, 'major'], [50, 'major']],
    kick: 'x.......x..x....',
    snare: '....x.......x...',
    hat: '..x...x...x...xx',
    bass: '0...0.3.5...7.5.',
    arp: '0..2..1.3..2..1.',
    arpSound: 'twang',
    pad: true,
  },
};

const THIRDS = { minor: 3, major: 4 };

// Semitones above the root for an arpeggio digit.
export function chordNote(quality, digit) {
  return [0, THIRDS[quality], 7, 12][digit];
}

function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function createMusic() {
  let enabled = true;
  let current = null;
  let timer = null;
  let output = null;
  let nextTime = 0;
  let step = 0;

  function tone(ctx, { midi, time, length, wave, volume, attack = 0.005, filter = null, detune = 0 }) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = frequency(midi);
    osc.detune.value = detune;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    let last = gain;
    osc.connect(gain);
    if (filter) {
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(filter, time);
      lowpass.frequency.exponentialRampToValueAtTime(Math.max(200, filter * 0.25), time + length);
      gain.connect(lowpass);
      last = lowpass;
    }
    last.connect(output);
    osc.start(time);
    osc.stop(time + length + 0.05);
  }

  function noise(ctx, { time, length, volume, type, frequency: cutoff }) {
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    source.connect(filter).connect(gain).connect(output);
    source.start(time, Math.random() * 0.3);
    source.stop(time + length + 0.02);
  }

  function kick(ctx, time, high = false) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const start = high ? 180 : 120;
    osc.frequency.setValueAtTime(start, time);
    osc.frequency.exponentialRampToValueAtTime(high ? 90 : 42, time + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(high ? 0.5 : 0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (high ? 0.25 : 0.3));
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.35);
  }

  function playStep(ctx, song, time) {
    const stepLength = 60 / song.bpm / 4;
    const inBar = step % 16;
    const [root, quality] = song.chords[Math.floor(step / 16) % song.chords.length];
    if (song.kick[inBar] === 'x') {
      kick(ctx, time);
    }
    if (song.tom && song.tom[inBar] === 'x') {
      kick(ctx, time, true);
    }
    if (song.snare[inBar] === 'x') {
      noise(ctx, { time, length: 0.18, volume: 0.35, type: 'bandpass', frequency: 1800 });
      tone(ctx, { midi: 55, time, length: 0.1, wave: 'triangle', volume: 0.12 });
    }
    if (song.hat[inBar] === 'x') {
      let volume = 0.08;
      if (song.hat === 'xxxxxxxxxxxxxxxx' && inBar % 2 === 1) {
        volume = 0.04;
      }
      noise(ctx, { time, length: 0.05, volume, type: 'highpass', frequency: 7000 });
    }
    const bass = song.bass[inBar];
    if (bass !== '.') {
      const midi = root - 24 + Number.parseInt(bass, 16);
      tone(ctx, { midi, time, length: stepLength * 1.8, wave: 'sawtooth', volume: 0.22, filter: 700 });
    }
    const arp = song.arp[inBar];
    if (arp !== '.') {
      const midi = root + chordNote(quality, Number(arp));
      if (song.arpSound === 'marimba') {
        tone(ctx, { midi, time, length: 0.45, wave: 'sine', volume: 0.2 });
        tone(ctx, { midi: midi + 24, time, length: 0.12, wave: 'sine', volume: 0.04 });
      } else if (song.arpSound === 'twang') {
        tone(ctx, { midi: midi - 12, time, length: 0.5, wave: 'sawtooth', volume: 0.1, filter: 2400 });
      } else {
        tone(ctx, { midi, time, length: stepLength * 0.9, wave: 'sawtooth', volume: 0.06, filter: 3200, detune: 6 });
        tone(ctx, { midi, time, length: stepLength * 0.9, wave: 'square', volume: 0.03, filter: 2400, detune: -6 });
      }
    }
    // A soft chord held for the whole bar.
    if (song.pad && inBar === 0) {
      const barLength = stepLength * 16;
      [0, THIRDS[quality], 7].forEach((offset) => {
        tone(ctx, { midi: root - 12 + offset, time, length: barLength, wave: 'sawtooth', volume: 0.025, attack: 0.4, filter: 900, detune: 8 });
      });
    }
  }

  function schedule() {
    const ctx = getAudioContext();
    if (!ctx || !current) {
      return;
    }
    const song = SONGS[current];
    const stepLength = 60 / song.bpm / 4;
    while (nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      playStep(ctx, song, nextTime);
      nextTime += stepLength;
      step += 1;
    }
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    current = null;
    if (!output) {
      return;
    }
    const ctx = getAudioContext();
    const old = output;
    old.gain.setTargetAtTime(0.0001, ctx.currentTime, FADE_SECONDS / 4);
    setTimeout(() => old.disconnect(), FADE_SECONDS * 1000 + 200);
    output = null;
  }

  return {
    setEnabled(value) {
      enabled = value;
      if (!value) {
        stop();
      }
    },
    // Start (or switch to) a track's song. Needs a tap first (browsers
    // only allow sound after one).
    play(id) {
      if (!enabled || current === id) {
        return;
      }
      stop();
      const ctx = getAudioContext();
      if (!ctx) {
        return;
      }
      output = ctx.createGain();
      output.gain.setValueAtTime(0.0001, ctx.currentTime);
      output.gain.exponentialRampToValueAtTime(MUSIC_VOLUME, ctx.currentTime + FADE_SECONDS);
      output.connect(ctx.destination);
      current = id;
      step = 0;
      nextTime = ctx.currentTime + 0.05;
      schedule();
      timer = setInterval(schedule, TICK_MS);
    },
    stop,
  };
}
