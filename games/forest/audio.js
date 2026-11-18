import { getAudioContext, getNoiseBuffer } from '../../shared/audio.js';

const notes = {
  bell: [880, 1320],
  owl: [370, 262],
  pods: [659, 880, 1175],
  letter: [392, 587],
  boat: [294, 440, 523],
  signal: [587, 622, 587],
  float: [659, 784, 988, 1318],
  carp: [196, 294],
  fox: [349, 523],
  quilt: [440, 554],
  tea: [392, 494, 587],
  song: [392, 494, 587, 440],
  scope: [784, 1175],
  stars: [523, 659, 784, 1047],
  moth: [698, 880],
  stairs: [262, 330, 392],
};
export function makeSound(enabled) {
  let ctx;
  let bus;
  let awake = false;
  function unlock() {
    if (!enabled || !awake || document.hidden) return false;
    if (!ctx) {
      ctx = getAudioContext();
      if (!ctx) return false;
      bus = ctx.createGain();
      bus.gain.value = 0.52;
      bus.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  function tone(freq, delay, length, volume, end = freq, type = 'sine') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(end, start + length);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.08, length / 5));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(bus);
    osc.start(start);
    osc.stop(start + length + 0.01);
  }
  function rustle(length, low, volume) {
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    noise.buffer = getNoiseBuffer(ctx);
    noise.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = low;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + length);
    noise.connect(filter).connect(gain).connect(bus);
    noise.start();
    noise.stop(ctx.currentTime + length);
  }
  function play(id) {
    if (!unlock()) return;
    if (id === 'step') {
      tone(81, 0, 0.16, 0.09, 38);
      rustle(0.14, 780, 0.07);
      return;
    }
    if (id === 'wood' || id === 'moss') {
      rustle(0.75, 1150, 0.17);
      tone(128, 0, 0.6, 0.1, 72, 'triangle');
      return;
    }
    if (id === 'ship') {
      tone(52, 0, 3.6, 0.23, 37, 'sawtooth');
      tone(78, 0.35, 3.1, 0.19, 62, 'triangle');
      tone(39, 2.5, 2.3, 0.24, 230, 'triangle');
      rustle(4, 430, 0.2);
      return;
    }
    if (id === 'bird') {
      tone(2100, 0, 0.14, 0.038, 2980);
      tone(2570, 0.17, 0.12, 0.032, 1950);
      return;
    }
    if (id === 'flight') {
      rustle(1.7, 1850, 0.17);
    }
    const tune = notes[id] || [523, 659, 880];
    tune.forEach((freq, i) => tone(freq, i * 0.17, 0.88, 0.1));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ctx) ctx.suspend().catch(() => {});
  });
  return {
    wake() {
      awake = true;
      unlock();
    },
    play,
    set(on) {
      enabled = on;
      if (bus) bus.gain.value = on ? 0.52 : 0;
      if (on) unlock();
    },
  };
}
