// The list of games on the home page. Each game lives in its own folder
// under games/<id>/ and is fully self-contained.

export const GAMES = [
  {
    id: 'dice',
    title: 'Dice Thrower',
    blurb: 'Pick a buddy and roll the dice!',
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
];
