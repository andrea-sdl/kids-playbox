// Plays the background tunes from songs.js with tiny Web Audio synths.
// A look-ahead scheduler queues notes slightly ahead of time so the music
// stays in time even when the page is busy animating dice.

import { getAudioContext, getNoiseBuffer } from './audio.js';
import { SONGS, parseDrums, parseNotes } from './songs.js';

const MUSIC_VOLUME = 0.22;
const LOOKAHEAD_SECONDS = 0.15;
const TICK_MS = 30;
const FADE_SECONDS = 0.6;

export const INSTRUMENTS = {
  musicbox: { wave: 'sine', attack: 0.004, decay: 1.4, volume: 0.5, overtone: { ratio: 4, volume: 0.1 } },
  harp: { wave: 'triangle', attack: 0.004, decay: 0.7, volume: 0.34 },
  whistle: { wave: 'sine', attack: 0.05, sustain: true, volume: 0.2, vibrato: 0.006 },
  pluck: { wave: 'sawtooth', attack: 0.003, decay: 0.3, volume: 0.08, filter: 1600 },
  marimba: { wave: 'sine', attack: 0.003, decay: 0.45, volume: 0.24, overtone: { ratio: 3.9, volume: 0.06 } },
  flute: { wave: 'triangle', attack: 0.09, sustain: true, volume: 0.2, vibrato: 0.005 },
  bass: { wave: 'sine', attack: 0.01, sustain: true, volume: 0.34 },
  pulse: { wave: 'square', attack: 0.004, sustain: true, volume: 0.07 },
  blip: { wave: 'square', attack: 0.002, decay: 0.09, volume: 0.04 },
  tri: { wave: 'triangle', attack: 0.004, sustain: true, volume: 0.3 },
  celesta: { wave: 'sine', attack: 0.004, decay: 1.2, volume: 0.36, overtone: { ratio: 3, volume: 0.07 } },
  pizz: { wave: 'triangle', attack: 0.004, decay: 0.28, volume: 0.36 },
};

function frequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function prepare(song) {
  const tracks = song.tracks.map((track) => {
    let parsed = null;
    if (track.drums) {
      parsed = parseDrums(track.drums);
    } else {
      parsed = parseNotes(track.notes);
    }
    const byStep = new Map();
    parsed.events.forEach((event) => {
      byStep.set(event.step, [...(byStep.get(event.step) || []), event]);
    });
    return { ...track, length: parsed.length, byStep };
  });
  return { ...song, tracks };
}

const PREPARED = Object.fromEntries(
  Object.entries(SONGS).map(([id, song]) => [id, prepare(song)]),
);

function playNote(ctx, output, instrumentName, midi, time, duration, trackVolume) {
  const instrument = INSTRUMENTS[instrumentName];
  const peak = instrument.volume * trackVolume;
  const freq = frequency(midi);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + instrument.attack);
  let end = time + instrument.decay;
  if (instrument.sustain) {
    const releaseAt = Math.max(time + instrument.attack, time + duration * 0.92);
    gain.gain.setValueAtTime(peak, releaseAt);
    end = releaseAt + 0.06;
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  let destination = output;
  if (instrument.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = instrument.filter;
    filter.connect(output);
    destination = filter;
  }
  gain.connect(destination);

  const oscillators = [];
  const main = ctx.createOscillator();
  main.type = instrument.wave;
  main.frequency.value = freq;
  main.connect(gain);
  oscillators.push(main);

  if (instrument.overtone) {
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtone.type = 'sine';
    overtone.frequency.value = freq * instrument.overtone.ratio;
    overtoneGain.gain.value = instrument.overtone.volume / instrument.volume;
    overtone.connect(overtoneGain).connect(gain);
    oscillators.push(overtone);
  }

  if (instrument.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = freq * instrument.vibrato;
    lfo.connect(depth).connect(main.frequency);
    oscillators.push(lfo);
  }

  oscillators.forEach((osc) => {
    osc.start(time);
    osc.stop(end + 0.05);
  });
}

function noiseHit(ctx, output, time, { type, frequency: cutoff, decay, volume }) {
  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  source.connect(filter).connect(gain).connect(output);
  source.start(time, Math.random() * 0.3);
  source.stop(time + decay + 0.02);
}

function toneHit(ctx, output, time, { wave, from, to, decay, volume }) {
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(from, time);
  osc.frequency.exponentialRampToValueAtTime(to, time + decay * 0.8);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  osc.connect(gain).connect(output);
  osc.start(time);
  osc.stop(time + decay + 0.02);
}

function playDrum(ctx, output, drum, time, trackVolume) {
  const v = trackVolume;
  switch (drum) {
    case 'kick':
      toneHit(ctx, output, time, { wave: 'sine', from: 150, to: 45, decay: 0.2, volume: 0.6 * v });
      break;
    case 'snare':
      noiseHit(ctx, output, time, { type: 'bandpass', frequency: 1800, decay: 0.12, volume: 0.28 * v });
      break;
    case 'hat':
      noiseHit(ctx, output, time, { type: 'highpass', frequency: 7000, decay: 0.04, volume: 0.14 * v });
      break;
    case 'shaker':
      noiseHit(ctx, output, time, { type: 'highpass', frequency: 5000, decay: 0.06, volume: 0.07 * v });
      break;
    case 'wood':
      toneHit(ctx, output, time, { wave: 'triangle', from: 1050, to: 1000, decay: 0.06, volume: 0.3 * v });
      break;
    case 'woodLow':
      toneHit(ctx, output, time, { wave: 'triangle', from: 700, to: 660, decay: 0.07, volume: 0.3 * v });
      break;
    case 'tom':
      toneHit(ctx, output, time, { wave: 'sine', from: 170, to: 110, decay: 0.28, volume: 0.4 * v });
      break;
    case 'tomLow':
      toneHit(ctx, output, time, { wave: 'sine', from: 110, to: 70, decay: 0.35, volume: 0.5 * v });
      break;
    default:
      break;
  }
}

export function createMusic() {
  let current = null; // { id, song, gain, step, nextTime, timer }

  function stepSeconds(song, step) {
    const straight = 60 / song.bpm / song.stepsPerBeat;
    if (!song.swing) {
      return straight;
    }
    // Swing: long-short pairs of steps.
    if (step % 2 === 0) {
      return straight * 2 * song.swing;
    }
    return straight * 2 * (1 - song.swing);
  }

  function scheduleStep(ctx, playing, time) {
    const { song, gain, step } = playing;
    const stepLength = 60 / song.bpm / song.stepsPerBeat;
    song.tracks.forEach((track) => {
      const events = track.byStep.get(step % track.length);
      if (!events) {
        return;
      }
      events.forEach((event) => {
        if (event.drum) {
          playDrum(ctx, gain, event.drum, time, track.volume);
          return;
        }
        playNote(ctx, gain, track.instrument, event.midi, time, event.steps * stepLength, track.volume);
      });
    });
  }

  function tick(playing) {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }
    // If timers were paused (background tab), skip ahead instead of
    // playing every missed note at once.
    if (playing.nextTime < ctx.currentTime) {
      playing.nextTime = ctx.currentTime + 0.05;
    }
    while (playing.nextTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      scheduleStep(ctx, playing, playing.nextTime);
      playing.nextTime += stepSeconds(playing.song, playing.step);
      playing.step += 1;
    }
  }

  function fadeOut(playing) {
    clearInterval(playing.timer);
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }
    const now = ctx.currentTime;
    playing.gain.gain.cancelScheduledValues(now);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, now);
    playing.gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    setTimeout(() => playing.gain.disconnect(), (FADE_SECONDS + 0.5) * 1000);
  }

  return {
    // Starts the tune for this mascot, fading out any other one.
    // Call it from a tap the first time so the browser allows audio.
    play(id) {
      if (current && current.id === id) {
        return;
      }
      const ctx = getAudioContext();
      const song = PREPARED[id];
      if (!ctx || !song) {
        return;
      }
      if (current) {
        fadeOut(current);
      }
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, ctx.currentTime + FADE_SECONDS);
      gain.connect(ctx.destination);
      const playing = { id, song, gain, step: 0, nextTime: ctx.currentTime + 0.1, timer: null };
      playing.timer = setInterval(() => tick(playing), TICK_MS);
      tick(playing);
      current = playing;
    },
    stop() {
      if (!current) {
        return;
      }
      fadeOut(current);
      current = null;
    },
    isPlaying() {
      return current !== null;
    },
  };
}
