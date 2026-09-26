// One shared Web Audio context for sound effects and music.
// Browsers only let audio start after a tap, so create it from a click.

let context = null;
let noise = null;

export function getAudioContext() {
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    context = new AudioContextClass();
  }
  if (context.state === 'suspended') {
    context.resume();
  }
  return context;
}

// Half a second of white noise, reused for clacks, whooshes and drums.
export function getNoiseBuffer(ctx) {
  if (noise) {
    return noise;
  }
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return noise;
}
