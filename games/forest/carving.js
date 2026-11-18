// The dotted guide and the input share the same coordinate system on phones
// and desktops. A tap or a slash must not count as a circle.
export function traceRing(canvas, complete) {
  const ctx = canvas.getContext('2d');
  const center = { x: 364, y: 173 };
  const rx = 34,
    ry = 43;
  const sectors = new Set();
  let points = [],
    active = false;
  function paint() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#f7e8acb5';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#efcd91';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function sample(e) {
    const box = canvas.getBoundingClientRect();
    const x = ((e.clientX - box.left) * canvas.width) / box.width;
    const y = ((e.clientY - box.top) * canvas.height) / box.height;
    const nx = (x - center.x) / rx,
      ny = (y - center.y) / ry;
    const radius = Math.hypot(nx, ny);
    if (radius < 0.47 || radius > 1.65) return;
    const sector = Math.floor(((Math.atan2(ny, nx) + Math.PI) * 12) / (Math.PI * 2)) % 12;
    points.push({ x, y });
    sectors.add(sector);
    paint();
  }
  canvas.onpointerdown = (e) => {
    if (!e.isPrimary) return;
    active = true;
    points = [];
    sectors.clear();
    canvas.setPointerCapture(e.pointerId);
    sample(e);
  };
  canvas.onpointermove = (e) => {
    if (active && e.isPrimary) sample(e);
  };
  canvas.onpointerup = (e) => {
    if (!active || !e.isPrimary) return;
    active = false;
    sample(e);
    if (sectors.size >= 10) {
      complete();
      return;
    }
    points = [];
    paint();
  };
  canvas.onpointercancel = () => {
    active = false;
    points = [];
    paint();
  };
  paint();
}
