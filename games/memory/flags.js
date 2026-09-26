// Country flags drawn as small SVGs, so they cost no image downloads.
// Brazil and Argentina are simplified (no motto text, simple sun).

function svg(viewBox, body) {
  return `<svg class="flag" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>`;
}

function horizontal(colors, width = 3, height = 2) {
  const band = height / colors.length;
  const rects = colors.map((color, i) => `<rect x="0" y="${i * band}" width="${width}" height="${band + 0.01}" fill="${color}"/>`);
  return svg(`0 0 ${width} ${height}`, rects.join(''));
}

function vertical(colors, width = 3, height = 2) {
  const band = width / colors.length;
  const rects = colors.map((color, i) => `<rect x="${i * band}" y="0" width="${band + 0.01}" height="${height}" fill="${color}"/>`);
  return svg(`0 0 ${width} ${height}`, rects.join(''));
}

// Nordic cross. `across` and `down` are the widths of the parts before the
// cross, the cross itself, and after it.
function nordic({ across, down, field, cross, inner = null, innerWidth = 0 }) {
  const width = across[0] + across[1] + across[2];
  const height = down[0] + down[1] + down[2];
  const x = across[0];
  const y = down[0];
  let body = `<rect width="${width}" height="${height}" fill="${field}"/>`;
  body += `<rect x="${x}" y="0" width="${across[1]}" height="${height}" fill="${cross}"/>`;
  body += `<rect x="0" y="${y}" width="${width}" height="${down[1]}" fill="${cross}"/>`;
  if (inner) {
    const offset = (across[1] - innerWidth) / 2;
    body += `<rect x="${x + offset}" y="0" width="${innerWidth}" height="${height}" fill="${inner}"/>`;
    body += `<rect x="0" y="${y + offset}" width="${width}" height="${innerWidth}" fill="${inner}"/>`;
  }
  return svg(`0 0 ${width} ${height}`, body);
}

// Five-pointed star path. `rotation` 0 points straight up.
function star(cx, cy, r, rotation = 0) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    let radius = r * 0.382; // inner corner
    if (i % 2 === 0) {
      radius = r; // outer point
    }
    const angle = ((rotation + i * 36 - 90) * Math.PI) / 180;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(3)},${(cy + radius * Math.sin(angle)).toFixed(3)}`);
  }
  return `M${points.join('L')}Z`;
}

function usa() {
  const stripe = 10 / 13;
  let body = '';
  for (let i = 0; i < 13; i += 1) {
    let color = '#fff';
    if (i % 2 === 0) {
      color = '#b22234';
    }
    body += `<rect x="0" y="${i * stripe}" width="19" height="${stripe + 0.01}" fill="${color}"/>`;
  }
  body += `<rect x="0" y="0" width="7.6" height="${stripe * 7}" fill="#3c3b6e"/>`;
  let stars = '';
  for (let row = 1; row <= 9; row += 1) {
    // Rows of 6 and 5 stars take turns.
    let columns = [2, 4, 6, 8, 10];
    if (row % 2 === 1) {
      columns = [1, 3, 5, 7, 9, 11];
    }
    columns.forEach((column) => {
      stars += star(0.633 * column, 0.538 * row, 0.308);
    });
  }
  body += `<path d="${stars}" fill="#fff"/>`;
  return svg('0 0 19 10', body);
}

function uk() {
  return svg('0 0 60 30', `
    <clipPath id="uk-clip"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
    <rect width="60" height="30" fill="#012169"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>
    <path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#uk-clip)" stroke="#c8102e" stroke-width="4"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6"/>`);
}

function china() {
  let body = '<rect width="30" height="20" fill="#ee1c25"/>';
  body += `<path d="${star(5, 5, 3)}" fill="#ffff00"/>`;
  [[10, 2], [12, 4], [12, 7], [10, 9]].forEach(([x, y]) => {
    // Each small star points at the big one.
    const angle = (Math.atan2(5 - y, 5 - x) * 180) / Math.PI + 90;
    body += `<path d="${star(x, y, 1, angle)}" fill="#ffff00"/>`;
  });
  return svg('0 0 30 20', body);
}

function india() {
  let spokes = '';
  for (let i = 0; i < 24; i += 1) {
    const angle = (i * 15 * Math.PI) / 180;
    spokes += `M1.5,1 L${(1.5 + 0.25 * Math.cos(angle)).toFixed(3)},${(1 + 0.25 * Math.sin(angle)).toFixed(3)} `;
  }
  return svg('0 0 3 2', `
    <rect width="3" height="0.667" fill="#ff9933"/>
    <rect y="0.667" width="3" height="0.667" fill="#fff"/>
    <rect y="1.333" width="3" height="0.667" fill="#138808"/>
    <circle cx="1.5" cy="1" r="0.25" fill="none" stroke="#000080" stroke-width="0.035"/>
    <path d="${spokes}" stroke="#000080" stroke-width="0.012"/>
    <circle cx="1.5" cy="1" r="0.045" fill="#000080"/>`);
}

function greece() {
  let body = '';
  for (let i = 0; i < 9; i += 1) {
    let color = '#fff';
    if (i % 2 === 0) {
      color = '#0d5eaf';
    }
    body += `<rect x="0" y="${i * 2}" width="27" height="2.01" fill="${color}"/>`;
  }
  body += '<rect width="10" height="10" fill="#0d5eaf"/><rect x="4" y="0" width="2" height="10" fill="#fff"/><rect x="0" y="4" width="10" height="2" fill="#fff"/>';
  return svg('0 0 27 18', body);
}

export const FLAGS = {
  japan: () => svg('0 0 3 2', '<rect width="3" height="2" fill="#fff"/><circle cx="1.5" cy="1" r="0.6" fill="#bc002d"/>'),
  france: () => vertical(['#0055a4', '#fff', '#ef4135']),
  italy: () => vertical(['#009246', '#fff', '#ce2b37']),
  germany: () => horizontal(['#000', '#dd0000', '#ffce00'], 5, 3),
  ireland: () => vertical(['#169b62', '#fff', '#ff883e'], 2, 1),
  belgium: () => vertical(['#000', '#fae042', '#ed2939'], 15, 13),
  netherlands: () => horizontal(['#ae1c28', '#fff', '#21468b']),
  austria: () => horizontal(['#ed2939', '#fff', '#ed2939']),
  poland: () => horizontal(['#fff', '#dc143c'], 8, 5),
  ukraine: () => horizontal(['#0057b7', '#ffd700']),
  sweden: () => nordic({ across: [5, 2, 9], down: [4, 2, 4], field: '#006aa7', cross: '#fecc00' }),
  norway: () => nordic({ across: [6, 4, 12], down: [6, 4, 6], field: '#ba0c2f', cross: '#fff', inner: '#00205b', innerWidth: 2 }),
  denmark: () => nordic({ across: [12, 4, 21], down: [12, 4, 12], field: '#c8102e', cross: '#fff' }),
  finland: () => nordic({ across: [5, 3, 10], down: [4, 3, 4], field: '#fff', cross: '#002f6c' }),
  switzerland: () => svg('0 0 32 32', '<rect width="32" height="32" fill="#da291c"/><rect x="13" y="6" width="6" height="20" fill="#fff"/><rect x="6" y="13" width="20" height="6" fill="#fff"/>'),
  greece,
  bangladesh: () => svg('0 0 10 6', '<rect width="10" height="6" fill="#006a4e"/><circle cx="4.5" cy="3" r="2" fill="#f42a41"/>'),
  nigeria: () => vertical(['#008751', '#fff', '#008751'], 2, 1),
  colombia: () => svg('0 0 3 2', '<rect width="3" height="1" fill="#fcd116"/><rect y="1" width="3" height="0.5" fill="#003893"/><rect y="1.5" width="3" height="0.5" fill="#ce1126"/>'),
  indonesia: () => horizontal(['#ce1126', '#fff']),
  thailand: () => svg('0 0 9 6', '<rect width="9" height="6" fill="#a51931"/><rect y="1" width="9" height="4" fill="#f4f5f8"/><rect y="2" width="9" height="2" fill="#2d2a4a"/>'),
  estonia: () => horizontal(['#0072ce', '#000', '#fff'], 33, 21),
  hungary: () => horizontal(['#ce2939', '#fff', '#477050'], 2, 1),
  lithuania: () => horizontal(['#fdb913', '#006a44', '#c1272d'], 5, 3),
  chile: () => svg('0 0 3 2', `<rect width="3" height="1" fill="#fff"/><rect y="1" width="3" height="1" fill="#d52b1e"/><rect width="1" height="1" fill="#0039a6"/><path d="${star(0.5, 0.5, 0.25)}" fill="#fff"/>`),
  vietnam: () => svg('0 0 3 2', `<rect width="3" height="2" fill="#da251d"/><path d="${star(1.5, 1, 0.6)}" fill="#ffcd00"/>`),
  turkiye: () => svg('0 0 3 2', `<rect width="3" height="2" fill="#e30a17"/><circle cx="1" cy="1" r="0.5" fill="#fff"/><circle cx="1.125" cy="1" r="0.4" fill="#e30a17"/><path d="${star(1.47, 1, 0.25, -90)}" fill="#fff"/>`),
  china,
  india,
  usa,
  uk,
  brazil: () => svg('0 0 10 7', '<rect width="10" height="7" fill="#009c3b"/><path d="M0.85,3.5 L5,0.85 L9.15,3.5 L5,6.15 Z" fill="#ffdf00"/><circle cx="5" cy="3.5" r="1.75" fill="#002776"/><path d="M3.3,3.1 Q5,2.6 6.7,3.9" fill="none" stroke="#fff" stroke-width="0.28"/>'),
  argentina: () => svg('0 0 18 12', '<rect width="18" height="12" fill="#74acdf"/><rect y="4" width="18" height="4" fill="#fff"/><circle cx="9" cy="6" r="1.4" fill="#f6b40e" stroke="#85340a" stroke-width="0.15"/>'),
  jamaica: () => svg('0 0 2 1', '<rect width="2" height="1" fill="#000"/><path d="M0,0 L2,0 L1,0.5 Z M0,1 L2,1 L1,0.5 Z" fill="#009b3a"/><path d="M0,0 L2,1 M2,0 L0,1" stroke="#fed100" stroke-width="0.13"/>'),
  peru: () => vertical(['#d91023', '#fff', '#d91023']),
};
