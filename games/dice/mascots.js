// Mascots are hand-drawn inline SVGs. CSS animates these parts:
//   .m-root  whole body (idle bob, cheer jump)
//   .m-eyes  blinking
//   .m-arm   throwing arm, rotates around its shoulder (--sx, --sy)
//   .m-hand  where the dice leave from
//   .m-hat   hat or crown (bounces on cheer)

const OUTLINE = '#2b2140';

// A rounded limb with an outline: a thick dark stroke under a colored one.
function limb(d, color, width = 12) {
  return `
    <path d="${d}" fill="none" stroke="${OUTLINE}" stroke-width="${width + 7}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function hand(cx, cy, color, className = '') {
  return `<circle class="${className}" cx="${cx}" cy="${cy}" r="8.5" fill="${color}" stroke="${OUTLINE}" stroke-width="3.5"/>`;
}

function frame(viewBox, body, sx, sy, extraClass = '') {
  return `
    <svg class="mascot-svg ${extraClass}" viewBox="${viewBox}" style="--sx:${sx}px; --sy:${sy}px" aria-hidden="true">
      <g class="m-root" stroke-linejoin="round">${body}</g>
    </svg>`;
}

/* ---------------- Princess ---------------- */

function princess() {
  const skin = '#ffd9bf';
  const hair = '#ffcf4a';
  const dress = '#ff8fc2';
  const bodice = '#ff5fa2';
  return `
    <ellipse cx="100" cy="232" rx="58" ry="6" fill="#000" opacity=".12"/>
    <path d="M58 78 C52 122 56 150 70 164 L130 164 C144 150 148 122 142 78 Z" fill="${hair}" stroke="${OUTLINE}" stroke-width="3.5"/>
    ${limb('M78 136 L62 176', '#ffb3d6')}
    ${hand(60, 182, skin)}
    <path d="M80 128 L120 128 L154 222 Q100 238 46 222 Z" fill="${dress}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M60 200 Q72 210 84 200 Q96 212 108 200 Q120 212 132 200 Q142 208 146 202" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>
    <circle cx="74" cy="176" r="3" fill="#fff" opacity=".8"/>
    <circle cx="124" cy="186" r="3" fill="#fff" opacity=".8"/>
    <circle cx="100" cy="166" r="3" fill="#fff" opacity=".8"/>
    <path d="M82 120 L118 120 L116 150 L84 150 Z" fill="${bodice}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="93" y="108" width="14" height="16" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="100" cy="82" r="36" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M62 86 C58 52 82 38 100 40 C120 38 144 52 138 86 C130 66 116 58 104 62 C98 70 86 70 78 64 C70 70 66 76 62 86 Z" fill="${hair}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <g class="m-hat">
      <path d="M74 52 L78 22 L90 38 L100 16 L110 38 L122 22 L126 52 Z" fill="#ffc21a" stroke="${OUTLINE}" stroke-width="3.5"/>
      <circle cx="100" cy="42" r="5" fill="#ff4d8d" stroke="${OUTLINE}" stroke-width="2.5"/>
      <circle cx="78" cy="22" r="3.5" fill="#6ad5ff" stroke="${OUTLINE}" stroke-width="2"/>
      <circle cx="100" cy="16" r="3.5" fill="#6ad5ff" stroke="${OUTLINE}" stroke-width="2"/>
      <circle cx="122" cy="22" r="3.5" fill="#6ad5ff" stroke="${OUTLINE}" stroke-width="2"/>
      <path class="m-sparkle" d="M140 22 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#fff" stroke="${OUTLINE}" stroke-width="2"/>
    </g>
    <g class="m-eyes">
      <ellipse cx="86" cy="88" rx="5" ry="6.5" fill="${OUTLINE}"/>
      <ellipse cx="114" cy="88" rx="5" ry="6.5" fill="${OUTLINE}"/>
      <circle cx="88" cy="85.5" r="2" fill="#fff"/>
      <circle cx="116" cy="85.5" r="2" fill="#fff"/>
      <path d="M79 82 l-4 -3 M121 82 l4 -3" stroke="${OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <circle cx="76" cy="100" r="6" fill="#ff8fab" opacity=".7"/>
    <circle cx="124" cy="100" r="6" fill="#ff8fab" opacity=".7"/>
    <path d="M91 101 Q100 110 109 101" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="80" cy="130" r="10" fill="#ffb3d6" stroke="${OUTLINE}" stroke-width="3.5"/>
    <g class="m-arm">
      ${limb('M124 134 L150 172', '#ffb3d6')}
      <circle cx="120" cy="130" r="10" fill="#ffb3d6" stroke="${OUTLINE}" stroke-width="3.5"/>
      ${hand(153, 178, skin, 'm-hand')}
    </g>`;
}

/* ---------------- Cowboy ---------------- */

function cowboy() {
  const skin = '#f2c29b';
  const shirt = '#e84a3c';
  const vest = '#a0612f';
  const jeans = '#3f6fb5';
  const boot = '#7a3f1d';
  const hat = '#c58440';
  return `
    <ellipse cx="100" cy="232" rx="50" ry="6" fill="#000" opacity=".12"/>
    <rect x="82" y="182" width="16" height="40" rx="4" fill="${jeans}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="102" y="182" width="16" height="40" rx="4" fill="${jeans}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M78 214 L98 214 L98 232 L72 232 Q72 222 78 214 Z" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M102 214 L122 214 Q128 222 128 232 L102 232 Z" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    ${limb('M80 132 L66 172', shirt)}
    ${hand(64, 178, skin)}
    <rect x="76" y="118" width="48" height="72" rx="14" fill="${shirt}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M86 122 L86 186 M100 122 L100 186 M114 122 L114 186 M78 146 L122 146 M78 168 L122 168" stroke="#b8302a" stroke-width="3" opacity=".6"/>
    <path d="M78 124 L94 124 L90 186 L78 186 Z" fill="${vest}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M122 124 L106 124 L110 186 L122 186 Z" fill="${vest}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M86 146 l2.6 5.3 5.8 .8 -4.2 4.1 1 5.8 -5.2 -2.7 -5.2 2.7 1 -5.8 -4.2 -4.1 5.8 -.8 z" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="2"/>
    <rect x="76" y="178" width="48" height="10" rx="3" fill="#4a2a14" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="93" y="176" width="14" height="14" rx="3" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="93" y="106" width="14" height="16" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M80 116 L120 116 L100 138 Z" fill="#3a86ff" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="94" cy="124" r="2" fill="#fff"/><circle cx="106" cy="124" r="2" fill="#fff"/><circle cx="100" cy="131" r="2" fill="#fff"/>
    <circle cx="100" cy="84" r="34" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M68 76 Q72 62 84 64 Q78 72 80 80 Z M132 76 Q128 62 116 64 Q122 72 120 80 Z" fill="#8a4b25" stroke="${OUTLINE}" stroke-width="3"/>
    <g class="m-hat">
      <path d="M72 60 C70 30 84 22 100 32 C116 22 130 30 128 60 Z" fill="${hat}" stroke="${OUTLINE}" stroke-width="3.5"/>
      <path d="M73 50 L127 50 L128 60 L72 60 Z" fill="#6b3a1a" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M40 58 Q46 72 100 70 Q154 72 160 58 Q150 64 100 62 Q50 64 40 58 Z" fill="${hat}" stroke="${OUTLINE}" stroke-width="3.5"/>
    </g>
    <g class="m-eyes">
      <circle cx="88" cy="86" r="4.5" fill="${OUTLINE}"/>
      <circle cx="112" cy="86" r="4.5" fill="${OUTLINE}"/>
      <circle cx="89.5" cy="84.5" r="1.6" fill="#fff"/>
      <circle cx="113.5" cy="84.5" r="1.6" fill="#fff"/>
    </g>
    <path d="M81 76 Q88 72 94 75 M106 75 Q112 72 119 76" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
    <g fill="#c9784a"><circle cx="80" cy="96" r="1.8"/><circle cx="85" cy="99" r="1.8"/><circle cx="78" cy="101" r="1.8"/><circle cx="120" cy="96" r="1.8"/><circle cx="115" cy="99" r="1.8"/><circle cx="122" cy="101" r="1.8"/></g>
    <path d="M88 100 Q100 114 112 100 Z" fill="#fff" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <g class="m-arm">
      ${limb('M120 132 L148 170', shirt)}
      ${hand(151, 176, skin, 'm-hand')}
    </g>`;
}

/* ---------------- Explorer ---------------- */

function explorer() {
  const skin = '#e8b48a';
  const shirt = '#e3cf9a';
  const jacket = '#7a4a2a';
  const pants = '#a58a5a';
  const boot = '#4a2e1a';
  const hat = '#7b5533';
  return `
    <ellipse cx="100" cy="232" rx="50" ry="6" fill="#000" opacity=".12"/>
    <rect x="82" y="182" width="16" height="40" rx="4" fill="${pants}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="102" y="182" width="16" height="40" rx="4" fill="${pants}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="78" y="216" width="22" height="16" rx="5" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="100" y="216" width="22" height="16" rx="5" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    ${limb('M80 132 L66 172', jacket)}
    ${hand(64, 178, skin)}
    <rect x="76" y="118" width="48" height="72" rx="14" fill="${shirt}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M92 120 L100 138 L108 120" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M78 124 L92 124 L94 186 L78 186 Z" fill="${jacket}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M122 124 L108 124 L106 186 L122 186 Z" fill="${jacket}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M84 120 L126 178" stroke="#4a2e1a" stroke-width="7" stroke-linecap="round"/>
    <rect x="114" y="168" width="24" height="22" rx="5" fill="#8f5a33" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M114 176 L138 176" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="76" y="180" width="48" height="9" rx="3" fill="#3b2616" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="80" cy="198" r="9" fill="none" stroke="#5b3a22" stroke-width="4"/>
    <circle cx="80" cy="198" r="4" fill="none" stroke="#5b3a22" stroke-width="3"/>
    <rect x="93" y="106" width="14" height="16" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="100" cy="84" r="34" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M67 80 Q68 64 80 62 L80 84 Z M133 80 Q132 64 120 62 L120 84 Z" fill="#4a2e1a" stroke="${OUTLINE}" stroke-width="3"/>
    <g class="m-hat">
      <path d="M70 62 C68 40 78 28 100 30 C122 28 132 40 130 62 Z" fill="${hat}" stroke="${OUTLINE}" stroke-width="3.5"/>
      <path d="M90 34 Q100 44 110 34" fill="none" stroke="#5a3b22" stroke-width="3" stroke-linecap="round"/>
      <path d="M71 50 L129 50 L130 62 L70 62 Z" fill="#3b2616" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M46 62 Q52 74 100 72 Q148 74 154 62 Q144 66 100 64 Q56 66 46 62 Z" fill="${hat}" stroke="${OUTLINE}" stroke-width="3.5"/>
    </g>
    <g class="m-eyes">
      <circle cx="88" cy="88" r="4.5" fill="${OUTLINE}"/>
      <circle cx="112" cy="88" r="4.5" fill="${OUTLINE}"/>
      <circle cx="89.5" cy="86.5" r="1.6" fill="#fff"/>
      <circle cx="113.5" cy="86.5" r="1.6" fill="#fff"/>
    </g>
    <path d="M80 78 L94 77 M106 76 Q113 72 120 76" fill="none" stroke="${OUTLINE}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="78" cy="100" r="5" fill="#e0876a" opacity=".6"/>
    <circle cx="122" cy="100" r="5" fill="#e0876a" opacity=".6"/>
    <path d="M90 102 Q102 112 112 100" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
    <g class="m-arm">
      ${limb('M120 132 L148 170', jacket)}
      ${hand(151, 176, skin, 'm-hand')}
    </g>`;
}

/* ---------------- Pixel hero ---------------- */

const U = 8; // one "pixel" in viewBox units

const PIXEL_COLORS = {
  H: '#d9661a', // hair
  h: '#a94a0c', // hair shade
  S: '#f5c49c', // skin
  W: '#ffffff', // eye white
  P: '#3b3b98', // pupil
  C: '#f28b82', // cheek
  M: '#8a3b1a', // mouth
  T: '#1fb5a8', // shirt
  t: '#168a80', // shirt shade
  B: '#3b2616', // belt
  L: '#4a4fc4', // pants
  l: '#393da0', // pants shade
  F: '#56566b', // shoes
};

// Draw a grid of letters as crisp squares. '.' is empty.
function pixels(rows, x0, y0) {
  let out = '';
  rows.forEach((row, y) => {
    [...row].forEach((code, x) => {
      const color = PIXEL_COLORS[code];
      if (!color) {
        return;
      }
      out += `<rect x="${x0 + x * U}" y="${y0 + y * U}" width="${U}" height="${U}" fill="${color}"/>`;
    });
  });
  return out;
}

function pixelOutline(x, y, w, h) {
  return `<rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" fill="${OUTLINE}"/>`;
}

function pixel() {
  const head = [
    'HHHHHHHHHH',
    'HhHHHHHHhH',
    'HHSSSSSSHH',
    'HSSSSSSSSH',
    'SSSSSSSSSS',
    'SSSSSSSSSS',
    'SSSSSSSSSS',
    'SCSMSSMSCS',
    'SSSSMMSSSS',
    'SSSSSSSSSS',
  ];
  const eyes = [
    '..........',
    '..........',
    '..........',
    '..........',
    '..WP..PW..',
    '..WP..PW..',
  ];
  const body = [
    'TTTTTTTT',
    'TTTtTTTT',
    'TTTTTTtT',
    'TtTTTTTT',
    'TTTTTtTT',
    'TTTTTTTT',
    'BBBBBBBB',
  ];
  const arm = ['TTT', 'TtT', 'TTT', 'SSS', 'SSS', 'SSS'];
  const legs = [
    'LLLLLLLL',
    'LlLLLLlL',
    'LLLLLLLL',
    'LLL..LLL',
    'LLL..LLL',
    'FFF..FFF',
  ];
  // Layout (viewBox units): head 80x80, body 64x56, arms 24x48, legs 64x48.
  const headX = 60;
  const headY = 40;
  const bodyX = 68;
  const bodyY = 120;
  const legsY = 176;
  const leftArmX = 44;
  const rightArmX = 132;
  return `
    <rect x="52" y="226" width="96" height="8" fill="#000" opacity=".12"/>
    ${pixelOutline(bodyX, legsY, 24, 48)}${pixelOutline(bodyX + 40, legsY, 24, 48)}
    ${pixels(legs, bodyX, legsY)}
    ${pixelOutline(leftArmX, bodyY, 24, 48)}
    ${pixels(arm, leftArmX, bodyY)}
    ${pixelOutline(bodyX, bodyY, 64, 56)}
    ${pixels(body, bodyX, bodyY)}
    ${pixelOutline(headX, headY, 80, 80)}
    <g class="m-head">${pixels(head, headX, headY)}</g>
    <g class="m-eyes">${pixels(eyes, headX, headY)}</g>
    <g class="m-arm">
      ${pixelOutline(rightArmX, bodyY, 24, 48)}
      ${pixels(arm, rightArmX, bodyY)}
      <rect class="m-hand" x="${rightArmX}" y="${bodyY + 40}" width="24" height="8" fill="transparent"/>
    </g>`;
}

/* ---------------- Registry ---------------- */

export const MASCOT_INFO = {
  princess: {
    name: 'Princess',
    cheers: ['Royal roll!', 'Sparkle power!', 'How magical!', 'Fit for a queen!'],
    svg: () => frame('0 0 200 240', princess(), 124, 134),
    face: () => frame('50 10 100 100', princess(), 124, 134),
  },
  cowboy: {
    name: 'Cowboy',
    cheers: ['Yee-haw!', 'Nice throw, partner!', 'Rootin’ tootin’!', 'Giddy-up!'],
    svg: () => frame('0 0 200 240', cowboy(), 120, 132),
    face: () => frame('45 18 110 110', cowboy(), 120, 132),
  },
  explorer: {
    name: 'Explorer',
    cheers: ['Treasure found!', 'What an adventure!', 'X marks the spot!', 'Great discovery!'],
    svg: () => frame('0 0 200 240', explorer(), 120, 132),
    face: () => frame('45 18 110 110', explorer(), 120, 132),
  },
  pixel: {
    name: 'Pixel Hero',
    cheers: ['Level up!', 'Critical roll!', '+1 XP!', 'Block party!'],
    svg: () => frame('0 0 200 240', pixel(), 144, 120, 'is-pixel'),
    face: () => frame('50 30 100 100', pixel(), 144, 120, 'is-pixel'),
  },
};
