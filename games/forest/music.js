import { getAudioContext } from '../../shared/audio.js';

// Decode once. The short MP3 lives in the same offline cache as the paintings.
// A buffer source loops without another network request at the end of a phrase.
export function forestMusic() {
  let ctx, gain, buffer, loading, source;
  let wanted = false;
  let quiet = false;
  let offset = 0,
    started = 0;
  function pause() {
    if (!source) return;
    offset = (offset + ctx.currentTime - started) % buffer.duration;
    source.stop();
    source.disconnect();
    source = null;
  }
  function volume() {
    if (gain) gain.gain.setTargetAtTime(quiet ? 0.14 : 0.28, ctx.currentTime, 0.2);
  }
  async function resume() {
    if (!wanted || document.hidden || source) return;
    ctx = getAudioContext();
    if (!ctx) return;
    if (!gain) {
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
    }
    if (!buffer) {
      loading ??= fetch('dawn.mp3')
        .then((response) => {
          if (!response.ok) throw Error(response.statusText);
          return response.arrayBuffer();
        })
        .then((bytes) => ctx.decodeAudioData(bytes));
      try {
        buffer = await loading;
      } catch {
        loading = null;
        return;
      }
    }
    if (!wanted || document.hidden || source) return;
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    started = ctx.currentTime;
    volume();
    source.start(0, offset);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else resume();
  });
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', resume);
  return {
    set(on) {
      wanted = on;
      if (on) resume();
      else pause();
    },
    duck(on) {
      quiet = on;
      volume();
    },
  };
}
