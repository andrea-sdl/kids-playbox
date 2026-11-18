// Each drawing is held for several exposures. Only the foreground cels change.
const gestures = {
  bell: [0, 1, 2, 3, 4, 2, 1, 5],
  carp: [0, 1, 2, 3, 4, 5],
  owl: [0, 1, 2, 3, 4, 5, 3, 1],
  scope: [0, 1, 2, 3, 4, 5, 4, 3, 2, 1],
  quilt: [0, 1, 2, 3, 4, 5],
  tea: [0, 1, 2, 3, 4, 3, 5],
};
const standard = [0, 1, 2, 3, 4, 5];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function createObjectAnimation(id, canvas, onError) {
  const cels = new Image();
  cels.onerror = onError;
  cels.src = 'art/objects/' + id + '-poses.webp';
  const ctx = canvas.getContext('2d');
  let age = 0;
  let lastTick = -1;

  function paint(dt) {
    if (!cels.naturalWidth) return;
    age += dt;
    const tick = reduced.matches ? 27 : Math.floor(age * 12);
    if (tick === lastTick) return;
    lastTick = tick;
    const w = cels.naturalWidth / 3;
    const h = cels.naturalHeight / 2;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    function draw(pose, dx = 0, dy = 0) {
      ctx.drawImage(cels, (pose % 3) * w, Math.floor(pose / 3) * h, w, h, dx, dy, w, h);
    }

    if (id === 'signal') {
      // The enamel arm turns on its painted pin. The lamp catches after the latch seats.
      const key = [0, 0, 0, 0.06, 0.19, 0.41, 0.69, 0.98, 1.18, 1.24, 1.19, 1.2];
      const phase = tick % 80;
      let angle = key[Math.min(phase, key.length - 1)];
      if (phase > 61) angle = key[Math.max(0, 11 - (phase - 61))];
      ctx.save();
      ctx.translate((w * 99) / 320, (h * 86) / 160);
      ctx.rotate(angle);
      draw(0, (-w * 99) / 320, (-h * 86) / 160);
      ctx.restore();
      if (phase >= 10 && phase <= 64 && phase !== 12) draw(1);
    } else if (id === 'moth') {
      const phase = tick % 86;
      const flight = Math.max(0, Math.min(1, (phase - 14) / 59));
      const arc = Math.sin(Math.PI * flight);
      const wings = [0, 1, 2, 2, 3, 1];
      const pose = phase < 7 || phase > 80 ? 0 : wings[phase % wings.length];
      draw(pose, w * (0.01 + 0.16 * Math.sin(2 * Math.PI * flight)), h * (0.06 - 0.31 * arc));
    } else {
      const sequence = gestures[id] || standard;
      // Anticipation, a quick action, then a longer hold on the result.
      const exposure = (tick % (sequence.length * 4 + 24)) - 6;
      const index = Math.max(0, Math.min(sequence.length - 1, Math.floor(exposure / 4)));
      draw(sequence[index]);
    }
    canvas.hidden = false;
  }
  return { paint };
}
