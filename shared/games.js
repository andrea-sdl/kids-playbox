// The list of games on the home page. Each game lives in its own folder
// under games/<id>/ and is fully self-contained. Titles and blurbs are
// translated: see game.<id>.title / game.<id>.blurb in shared/i18n.js.

export const GAMES = [
  {
    id: 'dice',
    path: 'games/dice/',
    color: '#ff7a59',
    icon: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="14" width="34" height="34" rx="8" fill="#fff" stroke="#2b2140" stroke-width="3" transform="rotate(-12 25 31)"/>
        <g fill="#e0457b" transform="rotate(-12 25 31)">
          <circle cx="17" cy="23" r="3.4"/><circle cx="25" cy="31" r="3.4"/><circle cx="33" cy="39" r="3.4"/>
        </g>
        <rect x="30" y="24" width="26" height="26" rx="6" fill="#ffd23f" stroke="#2b2140" stroke-width="3" transform="rotate(14 43 37)"/>
        <g fill="#2b2140" transform="rotate(14 43 37)">
          <circle cx="37" cy="31" r="2.8"/><circle cx="49" cy="43" r="2.8"/>
        </g>
      </svg>`,
  },
  {
    id: 'memory',
    path: 'games/memory/',
    color: '#3fa06a',
    icon: `
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="12" width="28" height="38" rx="5" fill="#b3202f" stroke="#2b2140" stroke-width="3" transform="rotate(-10 22 31)"/>
        <path d="M22 24l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.8 5.4-.7z" fill="#fff" transform="rotate(-10 22 31)"/>
        <rect x="28" y="14" width="28" height="38" rx="5" fill="#fffef9" stroke="#2b2140" stroke-width="3" transform="rotate(8 42 33)"/>
        <circle cx="42" cy="31" r="7" fill="#ffd23f" stroke="#2b2140" stroke-width="2.5" transform="rotate(8 42 33)"/>
      </svg>`,
  },
  {
    id: 'blocks',
    path: 'games/blocks/',
    color: '#3490dc',
    icon: `
      <svg viewBox="0 0 64 64" aria-hidden="true" stroke="#2b2140" stroke-width="3" stroke-linejoin="round">
        <rect x="8" y="34" width="30" height="18" rx="2" fill="#e3342f"/>
        <rect x="12" y="28" width="8" height="6" rx="1" fill="#e3342f"/>
        <rect x="26" y="28" width="8" height="6" rx="1" fill="#e3342f"/>
        <rect x="26" y="16" width="30" height="18" rx="2" fill="#ffd23f"/>
        <rect x="30" y="10" width="8" height="6" rx="1" fill="#ffd23f"/>
        <rect x="44" y="10" width="8" height="6" rx="1" fill="#ffd23f"/>
        <rect x="38" y="34" width="18" height="18" rx="2" fill="#38c172"/>
      </svg>`,
  },
];
