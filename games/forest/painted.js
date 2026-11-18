import { places, clamp, road, pitch, neighboringPaintings } from './world.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const images = {};
function picture(name) {
  if (!images[name]) {
    images[name] = new Image();
    images[name].src = 'art/' + name + '.webp';
  }
  return images[name];
}
const poses = [
  'idle',
  'step1',
  'step2',
  'step3',
  'crouch',
  'rise-low',
  'rise-high',
  'launch',
  'fly',
  'ship',
  'branches',
  'birds',
  'sky',
];
// Hold each drawing for its exposure. Feet stay planted through the rise.
function rising(elapsed) {
  if (elapsed < 0.48) return 'crouch';
  if (elapsed < 0.88) return 'rise-low';
  if (elapsed < 1.24) return 'rise-high';
  return 'idle';
}
const walk = ['step1', 'step1', 'step2', 'step3', 'step3', 'step2'];
const fractions = Array.from({ length: 32 }, (_, i) => {
  const val = Math.sin((i + 1) * 73.17) * 9783;
  return val - Math.floor(val);
});

export function createWalkRenderer(world, plate, canvas) {
  const ctx = canvas.getContext('2d');
  let width = 1600,
    height = 900,
    offset = 0,
    top = 0;
  let viewW = 0,
    viewH = 0,
    art = '';
  const stage = world.parentNode;
  // Color the cels with a single wash per location. Reuse the result for
  // every exposure to keep the ink and the transparent edges intact.
  const washes = {
    grove: '#41665c',
    house: '#5a6957',
    hearth: '#ad8153',
    falls: '#547b7e',
    marsh: '#7f8e8c',
  };
  const colored = new Map();
  function localCel(name, img) {
    const wash = washes[art];
    if (!wash) return img;
    const key = wash + name;
    if (colored.has(key)) return colored.get(key);
    const cel = document.createElement('canvas');
    cel.width = img.naturalWidth;
    cel.height = img.naturalHeight;
    const brush = cel.getContext('2d');
    brush.drawImage(img, 0, 0);
    brush.globalCompositeOperation = 'source-atop';
    brush.globalAlpha = 0.18;
    brush.fillStyle = wash;
    brush.fillRect(0, 0, cel.width, cel.height);
    colored.set(key, cel);
    return cel;
  }
  function image(name, x, y, w, flip = false) {
    const img = picture(name);
    if (!img.naturalWidth) return;
    const h = (w * img.naturalHeight) / img.naturalWidth;
    ctx.save();
    ctx.translate(x * 1600, y * 900);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(localCel(name, img), -w / 2, -h, w, h);
    ctx.restore();
  }
  function bird(x, y, w, t, flip) {
    const img = picture('birds');
    if (!img.naturalWidth) return;
    const phase = [0, 1, 2, 3, 1, 0, 0, 0][Math.floor(t * 9) % 8];
    const cellW = img.naturalWidth / 2,
      cellH = img.naturalHeight / 2;
    ctx.save();
    ctx.translate(x * 1600, y * 900);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(
      img,
      (phase % 2) * cellW,
      Math.floor(phase / 2) * cellH,
      cellW,
      cellH,
      -w / 2,
      -w / 2,
      w,
      w,
    );
    ctx.restore();
  }
  function glints(x, y, t) {
    ctx.fillStyle = '#ffeeb0';
    for (let i = 0; i < 5; i++) {
      const a = t * 3 + i * 1.257;
      const dx = Math.cos(a) * 17,
        dy = Math.sin(a) * 10;
      ctx.fillRect(x * 1600 + dx, y * 900 + dy, 2.5, 2.5);
    }
  }
  function shadow(x, y, rx, ry) {
    ctx.fillStyle = 'rgba(36,47,32,.28)';
    ctx.beginPath();
    ctx.ellipse(x * 1600, y * 900 - 3, rx, ry, -0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  function weather(room, t) {
    if (room === 'hearth') return;
    // Quiet holds between gusts; each leaf has a different descent.
    const gust = Math.max(0, Math.sin(t * 0.42));
    for (let i = 0; i < 18; i++) {
      const f = fractions[i];
      const x = ((f * 1.13 + t * (0.004 + f * 0.006)) % 1.12) - 0.05;
      const y = (fractions[i + 7] + t * 0.008) % 1.02;
      ctx.fillStyle = i % 3 ? 'rgba(255,238,172,.63)' : 'rgba(146,160,83,.66)';
      ctx.beginPath();
      ctx.ellipse(x * 1600, y * 900, 1.4 + f * 2, 0.9 + f, Math.sin(t + i), 0, Math.PI * 2);
      ctx.fill();
    }
    if (room === 'falls') {
      for (let i = 0; i < 18; i++) {
        const x = (0.51 + fractions[i] * 0.12) * 1600;
        const y = (0.24 + ((fractions[i + 3] + t * 0.31) % 1) * 0.46) * 900;
        ctx.strokeStyle = 'rgba(229,248,238,.35)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 12);
        ctx.stroke();
      }
    }
    if (room === 'meadow' || room === 'grove') {
      for (let i = 0; i < 24; i++) {
        const x = fractions[i] * 1600,
          y = (0.87 + fractions[(i + 4) % 32] * 0.13) * 900;
        ctx.strokeStyle = i % 2 ? '#697747' : '#829653';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 2, y - 7, x + 3 + gust * 6, y - 13 - fractions[i] * 9);
        ctx.stroke();
      }
    }
  }
  const panorama = world.querySelector('#panorama');
  let paintings = [];
  function setScenery(name, continuous) {
    if (art === name && plate.hidden === continuous) return;
    art = name;
    plate.hidden = continuous;
    panorama.hidden = !continuous;
    if (!continuous) {
      plate.src = 'art/' + name + '.webp';
      paintings = [{ room: name, offset: 0 }];
      return;
    }
    paintings = neighboringPaintings(name);
    // Keep decoded neighbors when the camera crosses a painting boundary.
    const visible = paintings.map(({ room, offset }) => {
      const img = picture(room);
      img.alt = '';
      img.draggable = false;
      img.style.left = offset * 100 + '%';
      img.classList.toggle('blended', room !== road[0]);
      return img;
    });
    panorama.replaceChildren(...visible);
    const index = road.indexOf(name);
    for (const next of [road[index - 2], road[index + 2]]) if (next) picture(next);
  }
  function cameraFrame(focus, continuous) {
    const w = stage.clientWidth,
      h = stage.clientHeight;
    height = Math.max(h, (w * 9) / 16);
    width = (height * 16) / 9;
    if (w !== viewW || h !== viewH) {
      viewW = w;
      viewH = h;
      const ratio = Math.min(devicePixelRatio || 1, 1.5, 2400 / w);
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      Object.assign(canvas.style, { width: w + 'px', height: h + 'px' });
      Object.assign(world.style, { width: width + 'px', height: height + 'px' });
    }
    // Outdoor coordinates scroll past the frame edges; only the ends of
    // the whole road constrain the view. Close shots and interiors stay framed.
    let min = 0,
      max = width - w;
    if (continuous) {
      const index = road.indexOf(art);
      min = -index * pitch * width;
      max += (road.length - index - 1) * pitch * width;
    }
    offset = clamp(focus * width - w * 0.5, min, max);
    top = (height - h) * 0.75;
    world.style.transform = 'translate(' + -offset + 'px,' + -top + 'px)';
    canvas.style.transform = 'translate(' + offset + 'px,' + top + 'px)';
    const rx = canvas.width / w,
      ry = canvas.height / h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform((rx * width) / 1600, 0, 0, (ry * height) / 900, -offset * rx, -top * ry);
  }
  function spacecraft(state, time, motion) {
    if (state.found.has('ship')) return;
    shadow(0.71, 0.77, 123, 11);
    image('ship', 0.71, 0.77, 304);
    if (!state.shipStep) image('branches', 0.71, 0.735, 315);
    else if (state.shipStep === 1 && time - motion.clearedAt < 0.78) {
      const lift = (time - motion.clearedAt) / 0.78;
      image('branches', 0.71 + 0.12 * lift, 0.735 - 0.18 * Math.sin(lift * Math.PI), 315);
    }
    if (state.shipStep < 2) {
      // Tufts conceal the maintenance button until the player brushes it.
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = ['#687748', '#889348', '#525e39'][i % 3];
        ctx.beginPath();
        ctx.ellipse(1205 + fractions[i] * 14, 626 + fractions[i + 3] * 12, 5, 3, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  function guardian(state, motion, movie, time, name, sky) {
    let x = state.x,
      y = state.y,
      pose = 'idle';
    if (motion.walking) pose = walk[Math.floor(motion.stride * 6) % walk.length];
    if (motion.kneel > time) pose = rising(1.4 - (motion.kneel - time));
    // Keep the walker's scale continuous across the outdoor paintings.
    const scale = name === 'hearth' || movie ? 305 : 258;
    let size = scale * (0.77 + (y - 0.72) * 1.65);
    if (movie?.kind === 'ending') {
      const a = movie.age;
      if (sky) {
        const flight = clamp((a - 3.05) / 3, 0, 1);
        pose = 'fly';
        x = 0.36 + 0.27 * flight;
        y = 0.69 - 0.17 * flight;
        size = 390 - 130 * flight;
      } else {
        pose = rising(a - 0.22);
        if (a > 2.32) pose = 'launch';
        y -= Math.max(0, a - 1) * 0.055 + Math.pow(Math.max(0, a - 2.35), 2) * 0.95;
      }
    }
    if (!sky) shadow(x, state.y, size * 0.136, size * 0.021);
    image(pose, x, y, size, sky ? false : motion.facing < 0);
    return { x, y };
  }
  function flock(state, name, sky, x, y, t) {
    if (name !== 'hearth') {
      const cycle = t * 0.37,
        side = Math.sin(cycle);
      bird(
        sky ? x + 0.15 : state.x + 0.1 + side * 0.1,
        sky ? y - 0.16 : 0.44 + Math.sin(t * 0.75) * 0.045,
        sky ? 57 : 44,
        t,
        Math.cos(cycle) < 0,
      );
    }
  }
  function meadowCoins(state, motion, name, t) {
    if (motion.walking && name === 'meadow') {
      for (const [id, [px, py]] of Object.entries(places.meadow.points)) {
        if (id.startsWith('coin') && !state.found.has(id) && Math.sin(t * 4 + px * 31) > 0.56)
          glints(px, py, t);
      }
    }
  }

  const propSizes = {
    pods: 37,
    bell: 24,
    owl: 49,
    letter: 48,
    quilt: 65,
    song: 36,
    fox: 36,
    boat: 55,
    float: 28,
    carp: 75,
    moth: 40,
  };
  function semaphore(state, motion, t) {
    const cel = picture('prop-semaphore');
    if (!cel.naturalWidth) return;
    const active = state.found.has('signal');
    let angle = active ? 0 : 0.79;
    if (active && !reduced.matches && motion.signalAt !== undefined) {
      const stops = [0.79, 0.72, 0.52, 0.29, 0.11, -0.04, 0];
      const step = clamp(Math.floor((t - motion.signalAt) * 8), 0, stops.length - 1);
      angle = stops[step];
    }
    ctx.drawImage(cel, 0, 0, 150, 85, 958, 128, 150, 85);
    ctx.save();
    ctx.translate(980, 184);
    ctx.rotate(angle);
    ctx.drawImage(cel, 150, 0, 150, 85, -22, -56, 150, 85);
    ctx.restore();
    if (active && angle < 0.12) {
      ctx.fillStyle = '#ffcb69';
      ctx.beginPath();
      ctx.arc(981, 201, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function props(room, state, motion, t) {
    for (const [id, [x, y]] of Object.entries(places[room].points)) {
      const done = state.found.has(id);
      if (id.startsWith('coin')) {
        if (!done) image('prop-coin', x, y + 0.008, 13);
        continue;
      }
      if (done && ['stars', 'scope', 'stairs'].includes(id)) glints(x, y, t);
      if (!propSizes[id]) continue;
      let px = x,
        py = y + 0.016;
      if (id === 'bell') {
        ctx.strokeStyle = '#565b45';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x * 1600, 0.136 * 900);
        ctx.lineTo(x * 1600, (py - 0.078) * 900);
        ctx.stroke();
      }
      if (id === 'carp') ctx.globalAlpha = 0.64;
      if (done && id === 'boat') px += 0.027;
      if (id === 'moth') {
        const wings = picture('prop-moth-wings');
        const tick = reduced.matches ? 0 : Math.floor(t * 9);
        if (done) {
          px += Math.sin(tick / 16) * 0.021;
          py -= 0.035 + Math.sin(tick / 11) * 0.016;
        }
        if (wings.naturalWidth) {
          const poses = [0, 1, 2, 2, 3, 1];
          const pose = !done && tick % 46 > 13 ? 0 : poses[tick % poses.length];
          ctx.drawImage(wings, pose * 100, 0, 100, 86, px * 1600 - 29, py * 900 - 38, 58, 50);
          continue;
        }
      }
      image('prop-' + id, px, py, propSizes[id]);
      ctx.globalAlpha = 1;
      if (done && ['pods', 'float'].includes(id)) glints(px, py - 0.025, t);
    }
    if (room === 'marsh') semaphore(state, motion, t);
  }
  function render(state, motion, movie, time) {
    const t = Math.floor(time * 12) / 12;
    const sky = movie?.kind === 'ending' && movie.age > 3.05;
    let name = state.room;
    if (sky) name = 'sky';
    const continuous = !movie && road.includes(name);
    setScenery(name, continuous);
    let focus = state.x;
    if (sky) focus = 0.5;
    cameraFrame(focus, continuous);
    if (!sky)
      for (const tile of paintings) {
        ctx.save();
        ctx.translate(tile.offset * 1600, 0);
        weather(tile.room, reduced.matches ? 1 : t);
        props(tile.room, state, motion, t);
        if (tile.room === 'grove') {
          spacecraft(state, time, motion);
          if (state.found.has('tree')) {
            ctx.strokeStyle = '#c09e6f';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.ellipse(425, 402, 9, 13, -0.19, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    const { x, y } = guardian(state, motion, movie, time, name, sky);
    flock(state, name, sky, x, y, t);
    meadowCoins(state, motion, name, t);
  }
  return {
    warm() {
      poses.forEach(picture);
    },
    render,
    point(clientX, clientY) {
      const box = stage.getBoundingClientRect();
      return { x: (clientX - box.left + offset) / width, y: (clientY - box.top + top) / height };
    },
  };
}
