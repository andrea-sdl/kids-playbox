// Mascots are hand-drawn inline SVGs. CSS animates these parts:
//   .m-root  whole body (idle bob, cheer jump)
//   .m-eyes  blinking
//   .m-arm   throwing arm, rotates around its shoulder (--sx, --sy)
//   .m-hand  where the dice leave from
//   .m-hat   hat or crown (bounces on cheer)

import { t } from '../../shared/i18n.js';

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

/* ---------------- Prince ---------------- */

function prince() {
  const skin = '#f2c7a5';
  const hair = '#7a4a24';
  const tunic = '#3a6fd8';
  const pants = '#2b3f7a';
  const boot = '#5a3417';
  return `
    <ellipse cx="100" cy="232" rx="52" ry="6" fill="#000" opacity=".12"/>
    <path d="M74 122 L126 122 L146 214 Q100 224 54 214 Z" fill="#d6334a" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="84" y="182" width="15" height="36" rx="4" fill="${pants}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="101" y="182" width="15" height="36" rx="4" fill="${pants}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="79" y="212" width="21" height="20" rx="5" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="100" y="212" width="21" height="20" rx="5" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    ${limb('M80 132 L66 172', tunic)}
    ${hand(64, 178, skin)}
    <path d="M78 120 L122 120 L128 192 L72 192 Z" fill="${tunic}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M74 184 L126 184" stroke="#ffc21a" stroke-width="5"/>
    <path d="M100 124 L100 184" stroke="#2c56b0" stroke-width="3"/>
    <rect x="76" y="160" width="48" height="9" rx="3" fill="#ffc21a" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M100 134 l7 8 -7 8 -7 -8 z" fill="#ffc21a" stroke="${OUTLINE}" stroke-width="2.5"/>
    <rect x="93" y="106" width="14" height="16" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="100" cy="84" r="34" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M66 86 C60 54 84 44 100 46 C118 44 140 56 134 86 C128 70 118 64 108 66 C100 60 84 62 76 70 C72 74 68 80 66 86 Z" fill="${hair}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <g class="m-hat">
      <path d="M76 56 L80 32 L91 46 L100 28 L109 46 L120 32 L124 56 Z" fill="#ffc21a" stroke="${OUTLINE}" stroke-width="3.5"/>
      <circle cx="100" cy="47" r="4.5" fill="#3a86ff" stroke="${OUTLINE}" stroke-width="2.5"/>
      <circle cx="80" cy="32" r="3" fill="#ff4d6d" stroke="${OUTLINE}" stroke-width="2"/>
      <circle cx="100" cy="28" r="3" fill="#ff4d6d" stroke="${OUTLINE}" stroke-width="2"/>
      <circle cx="120" cy="32" r="3" fill="#ff4d6d" stroke="${OUTLINE}" stroke-width="2"/>
    </g>
    <g class="m-eyes">
      <circle cx="88" cy="88" r="4.5" fill="${OUTLINE}"/>
      <circle cx="112" cy="88" r="4.5" fill="${OUTLINE}"/>
      <circle cx="89.5" cy="86.5" r="1.6" fill="#fff"/>
      <circle cx="113.5" cy="86.5" r="1.6" fill="#fff"/>
    </g>
    <path d="M81 78 Q88 74 94 77 M106 77 Q112 74 119 78" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="78" cy="100" r="5.5" fill="#ff8fab" opacity=".6"/>
    <circle cx="122" cy="100" r="5.5" fill="#ff8fab" opacity=".6"/>
    <path d="M90 101 Q100 110 110 101" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
    <g class="m-arm">
      ${limb('M120 132 L148 170', tunic)}
      ${hand(151, 176, skin, 'm-hand')}
    </g>`;
}

/* ---------------- Cowgirl ---------------- */

function cowgirl() {
  const skin = '#e9b48f';
  const hair = '#c0692b';
  const shirt = '#9b5de5';
  const vest = '#e07a5f';
  const jeans = '#3f6fb5';
  const boot = '#8a3b1d';
  const hat = '#f28fb4';
  return `
    <ellipse cx="100" cy="232" rx="50" ry="6" fill="#000" opacity=".12"/>
    ${limb('M72 88 Q60 112 66 146', hair, 11)}
    ${limb('M128 88 Q140 112 134 146', hair, 11)}
    <rect x="59" y="142" width="14" height="8" rx="3" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="2.5"/>
    <rect x="127" y="142" width="14" height="8" rx="3" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="2.5"/>
    <rect x="82" y="182" width="16" height="40" rx="4" fill="${jeans}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="102" y="182" width="16" height="40" rx="4" fill="${jeans}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M78 212 L98 212 L98 232 L72 232 Q72 222 78 212 Z" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M102 212 L122 212 Q128 222 128 232 L102 232 Z" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M84 222 l3 -4 3 4 M110 222 l3 -4 3 4" fill="none" stroke="#ffd23f" stroke-width="2.5" stroke-linecap="round"/>
    ${limb('M80 132 L66 172', shirt)}
    ${hand(64, 178, skin)}
    <rect x="76" y="118" width="48" height="72" rx="14" fill="${shirt}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M78 124 L94 124 L90 186 L78 186 Z" fill="${vest}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M122 124 L106 124 L110 186 L122 186 Z" fill="${vest}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <g fill="#fff" opacity=".85"><circle cx="85" cy="140" r="2"/><circle cx="85" cy="156" r="2"/><circle cx="85" cy="172" r="2"/><circle cx="115" cy="140" r="2"/><circle cx="115" cy="156" r="2"/><circle cx="115" cy="172" r="2"/></g>
    <rect x="76" y="178" width="48" height="10" rx="3" fill="#4a2a14" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M100 176 l7 7 -7 7 -7 -7 z" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="2.5"/>
    <rect x="93" y="106" width="14" height="16" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M80 116 L120 116 L100 138 Z" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="100" cy="84" r="34" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M67 84 Q66 64 82 62 Q76 72 78 84 Z M133 84 Q134 64 118 62 Q124 72 122 84 Z" fill="${hair}" stroke="${OUTLINE}" stroke-width="3"/>
    <g class="m-hat">
      <path d="M72 60 C70 30 84 22 100 32 C116 22 130 30 128 60 Z" fill="${hat}" stroke="${OUTLINE}" stroke-width="3.5"/>
      <path d="M73 50 L127 50 L128 60 L72 60 Z" fill="#fff" stroke="${OUTLINE}" stroke-width="3"/>
      <path d="M40 56 Q46 72 100 70 Q154 72 160 56 Q150 64 100 62 Q50 64 40 56 Z" fill="${hat}" stroke="${OUTLINE}" stroke-width="3.5"/>
      <path d="M111 45 l2 4 4.5 .6 -3.3 3.1 .8 4.4 -4 -2.1 -4 2.1 .8 -4.4 -3.3 -3.1 4.5 -.6 z" fill="#ffd23f" stroke="${OUTLINE}" stroke-width="1.8"/>
    </g>
    <g class="m-eyes">
      <ellipse cx="88" cy="87" rx="4.5" ry="5.5" fill="${OUTLINE}"/>
      <ellipse cx="112" cy="87" rx="4.5" ry="5.5" fill="${OUTLINE}"/>
      <circle cx="89.5" cy="85" r="1.7" fill="#fff"/>
      <circle cx="113.5" cy="85" r="1.7" fill="#fff"/>
      <path d="M82 82 l-4 -3 M118 82 l4 -3" stroke="${OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <g fill="#c9784a"><circle cx="80" cy="97" r="1.6"/><circle cx="85" cy="100" r="1.6"/><circle cx="120" cy="97" r="1.6"/><circle cx="115" cy="100" r="1.6"/></g>
    <circle cx="77" cy="102" r="5" fill="#ff8fab" opacity=".55"/>
    <circle cx="123" cy="102" r="5" fill="#ff8fab" opacity=".55"/>
    <path d="M89 100 Q100 113 111 100 Z" fill="#fff" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <g class="m-arm">
      ${limb('M120 132 L148 170', shirt)}
      ${hand(151, 176, skin, 'm-hand')}
    </g>`;
}

/* ---------------- Adventurer (explorer, second look) ---------------- */

function adventurer() {
  const skin = '#e3a77e';
  const hair = '#5a3218';
  const top = '#2aa6a0';
  const shorts = '#8a5a33';
  const boot = '#3e2615';
  const glove = '#4a2e1a';
  return `
    <ellipse cx="100" cy="232" rx="50" ry="6" fill="#000" opacity=".12"/>
    ${limb('M76 92 Q60 120 70 162', hair, 12)}
    <path d="M64 112 l12 2 M64 124 l12 2 M66 136 l12 2 M68 148 l11 2" stroke="${OUTLINE}" stroke-width="2" opacity=".5"/>
    <rect x="86" y="190" width="12" height="22" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="102" y="190" width="12" height="22" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="80" y="206" width="20" height="26" rx="5" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <rect x="100" y="206" width="20" height="26" rx="5" fill="${boot}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M80 214 L100 214 M100 214 L120 214" stroke="#8f5a33" stroke-width="3"/>
    ${limb('M80 132 L66 172', skin, 11)}
    ${hand(64, 178, glove)}
    <rect x="78" y="176" width="44" height="20" rx="5" fill="${shorts}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M82 122 Q100 130 118 122 L122 180 L78 180 Z" fill="${top}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M86 124 L88 180 M114 124 L112 180" stroke="#5b3a22" stroke-width="5" stroke-linecap="round"/>
    <rect x="76" y="174" width="48" height="8" rx="3" fill="#3b2616" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="112" y="178" width="14" height="14" rx="3" fill="#8f5a33" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="93" y="106" width="14" height="18" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <circle cx="100" cy="84" r="34" fill="${skin}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <path d="M65 90 C58 54 84 42 102 46 C122 46 140 58 135 90 C130 74 124 66 114 64 C104 70 88 72 74 66 C70 74 67 82 65 90 Z" fill="${hair}" stroke="${OUTLINE}" stroke-width="3.5"/>
    <g class="m-eyes">
      <ellipse cx="88" cy="88" rx="4.5" ry="5" fill="${OUTLINE}"/>
      <ellipse cx="112" cy="88" rx="4.5" ry="5" fill="${OUTLINE}"/>
      <circle cx="89.5" cy="86.3" r="1.6" fill="#fff"/>
      <circle cx="113.5" cy="86.3" r="1.6" fill="#fff"/>
      <path d="M82 83 l-4 -2.5 M118 83 l4 -2.5" stroke="${OUTLINE}" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <path d="M80 78 L94 76 M106 76 L120 78" fill="none" stroke="${OUTLINE}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="78" cy="100" r="5" fill="#e0876a" opacity=".6"/>
    <circle cx="122" cy="100" r="5" fill="#e0876a" opacity=".6"/>
    <path d="M90 101 Q101 111 112 100" fill="none" stroke="${OUTLINE}" stroke-width="3" stroke-linecap="round"/>
    <g class="m-arm">
      ${limb('M120 132 L148 170', skin, 11)}
      ${hand(151, 176, glove, 'm-hand')}
    </g>`;
}

/* ---------------- Pixel hero ---------------- */

const U = 8; // one "pixel" in viewBox units

const PIXEL_BOY = {
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

const PIXEL_GIRL = {
  ...PIXEL_BOY,
  H: '#4a2c1a',
  h: '#2e1b10',
  S: '#e8b08a',
  P: '#2f7a3b',
  T: '#ff7ab6',
  t: '#e0559a',
  B: '#ffd23f',
  L: '#7a4fc4',
  l: '#5f3aa6',
  R: '#ff4d8d', // bow
  r: '#c9235f', // bow shade
};

// Draw a grid of letters as crisp squares. '.' is empty.
function pixels(rows, x0, y0, colors) {
  let out = '';
  rows.forEach((row, y) => {
    [...row].forEach((code, x) => {
      const color = colors[code];
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

const PIXEL_LOOKS = {
  boy: {
    colors: PIXEL_BOY,
    head: [
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
    ],
    // Extra pixels drawn over the shoulders (long hair), relative to the head.
    hair: [],
    bow: [],
  },
  girl: {
    colors: PIXEL_GIRL,
    head: [
      'HHHHHHHHHH',
      'HHhHHHHhHH',
      'HHSSSSSSHH',
      'HSSSSSSSSH',
      'HSSSSSSSSH',
      'HSSSSSSSSH',
      'HSSSSSSSSH',
      'HCSMSSMSCH',
      'HSSSMMSSSH',
      'HSSSSSSSSH',
    ],
    hair: ['HH......HH', 'Hh......hH', 'HH......HH', 'hH......Hh'],
    bow: ['RR.RR', 'RrRrR', 'RR.RR'],
  },
};

function pixel(lookName = 'boy') {
  const look = PIXEL_LOOKS[lookName];
  const colors = look.colors;
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
  let hair = '';
  if (look.hair.length > 0) {
    hair = `${pixelOutline(headX, bodyY, 16, look.hair.length * U)}${pixelOutline(headX + 64, bodyY, 16, look.hair.length * U)}
      ${pixels(look.hair, headX, bodyY, colors)}`;
  }
  let bow = '';
  if (look.bow.length > 0) {
    bow = `<g class="m-hat">${pixelOutline(headX + 44, headY - 12, 40, 24)}${pixels(look.bow, headX + 44, headY - 12, colors)}</g>`;
  }
  return `
    <rect x="52" y="226" width="96" height="8" fill="#000" opacity=".12"/>
    ${pixelOutline(bodyX, legsY, 24, 48)}${pixelOutline(bodyX + 40, legsY, 24, 48)}
    ${pixels(legs, bodyX, legsY, colors)}
    ${pixelOutline(leftArmX, bodyY, 24, 48)}
    ${pixels(arm, leftArmX, bodyY, colors)}
    ${pixelOutline(bodyX, bodyY, 64, 56)}
    ${pixels(body, bodyX, bodyY, colors)}
    ${hair}
    ${pixelOutline(headX, headY, 80, 80)}
    <g class="m-head">${pixels(look.head, headX, headY, colors)}</g>
    <g class="m-eyes">${pixels(eyes, headX, headY, colors)}</g>
    ${bow}
    <g class="m-arm">
      ${pixelOutline(rightArmX, bodyY, 24, 48)}
      ${pixels(arm, rightArmX, bodyY, colors)}
      <rect class="m-hand" x="${rightArmX}" y="${bodyY + 40}" width="24" height="8" fill="transparent"/>
    </g>`;
}

/* ---------------- Mage (painted sprites) ---------------- */

// The witch and wizard are detailed painted images instead of SVG drawings.
// `orb` is where the glowing staff or wand tip is, in % of the image, so the
// dice can fly out of it.
const SPRITES = {
  witch: { image: 'art/sprite-witch.webp', face: 'art/face-witch.webp', orb: { x: 71.2, y: 20.2 }, glow: '#ffd66b' },
  wizard: { image: 'art/sprite-wizard.webp', face: 'art/face-wizard.webp', orb: { x: 81.2, y: 22 }, glow: '#7fd4ff' },
};

function sprite(id) {
  const info = SPRITES[id];
  return `
    <div class="mascot-sprite" style="--orb-x:${info.orb.x}%; --orb-y:${info.orb.y}%; --glow:${info.glow}" aria-hidden="true">
      <div class="m-root">
        <img class="sprite-image" src="${info.image}" alt="" draggable="false">
        <span class="m-orb m-hand"></span>
        <span class="m-sparkles"><i></i><i></i><i></i><i></i><i></i></span>
      </div>
    </div>`;
}

function spriteFace(id) {
  return `<img class="mascot-svg mascot-face" src="${SPRITES[id].face}" alt="" draggable="false">`;
}

/* ---------------- Registry ---------------- */

// Keyed by character (see CHARACTERS in logic.js).
export const MASCOT_INFO = {
  princess: {
    get name() {
      return t('char.princess.name');
    },
    cheers: () => t('char.princess.cheers').split('|'),
    svg: () => frame('0 0 200 240', princess(), 124, 134),
    face: () => frame('50 10 100 100', princess(), 124, 134),
  },
  prince: {
    get name() {
      return t('char.prince.name');
    },
    cheers: () => t('char.prince.cheers').split('|'),
    svg: () => frame('0 0 200 240', prince(), 120, 132),
    face: () => frame('45 18 110 110', prince(), 120, 132),
  },
  cowboy: {
    get name() {
      return t('char.cowboy.name');
    },
    cheers: () => t('char.cowboy.cheers').split('|'),
    svg: () => frame('0 0 200 240', cowboy(), 120, 132),
    face: () => frame('45 18 110 110', cowboy(), 120, 132),
  },
  cowgirl: {
    get name() {
      return t('char.cowgirl.name');
    },
    cheers: () => t('char.cowgirl.cheers').split('|'),
    svg: () => frame('0 0 200 240', cowgirl(), 120, 132),
    face: () => frame('45 18 110 110', cowgirl(), 120, 132),
  },
  explorer: {
    get name() {
      return t('char.explorer.name');
    },
    cheers: () => t('char.explorer.cheers').split('|'),
    svg: () => frame('0 0 200 240', explorer(), 120, 132),
    face: () => frame('45 18 110 110', explorer(), 120, 132),
  },
  adventurer: {
    get name() {
      return t('char.adventurer.name');
    },
    cheers: () => t('char.adventurer.cheers').split('|'),
    svg: () => frame('0 0 200 240', adventurer(), 120, 132),
    face: () => frame('45 30 110 110', adventurer(), 120, 132),
  },
  pixel: {
    get name() {
      return t('char.pixel.name');
    },
    cheers: () => t('char.pixel.cheers').split('|'),
    svg: () => frame('0 0 200 240', pixel('boy'), 144, 120, 'is-pixel'),
    face: () => frame('50 30 100 100', pixel('boy'), 144, 120, 'is-pixel'),
  },
  'pixel-girl': {
    get name() {
      return t('char.pixel-girl.name');
    },
    cheers: () => t('char.pixel-girl.cheers').split('|'),
    svg: () => frame('0 0 200 240', pixel('girl'), 144, 120, 'is-pixel'),
    face: () => frame('50 22 100 100', pixel('girl'), 144, 120, 'is-pixel'),
  },
  witch: {
    get name() {
      return t('char.witch.name');
    },
    cheers: () => t('char.witch.cheers').split('|'),
    svg: () => sprite('witch'),
    face: () => spriteFace('witch'),
  },
  wizard: {
    get name() {
      return t('char.wizard.name');
    },
    cheers: () => t('char.wizard.cheers').split('|'),
    svg: () => sprite('wizard'),
    face: () => spriteFace('wizard'),
  },
};
