// What changed in each release. The newest release comes first, and its
// version must match VERSION in sw.js (a test checks this), so every
// release gets an entry.
//
// target: a game id, or 'app' for the whole app.
// type:   'new', 'updated' or 'fixed'.
// text:   a translation key (see shared/i18n.js).

export const RELEASES = [
  {
    version: 17,
    date: '2026-10-03',
    changes: [
      { target: 'drive', type: 'updated', text: 'changes.v17.steerYourself' },
      { target: 'app', type: 'fixed', text: 'changes.v17.rotate' },
    ],
  },
  {
    version: 16,
    date: '2026-10-03',
    changes: [
      { target: 'drive', type: 'updated', text: 'changes.v16.driveMusic' },
      { target: 'app', type: 'fixed', text: 'changes.v16.fastUpdate' },
    ],
  },
  {
    version: 15,
    date: '2026-10-03',
    changes: [
      { target: 'drive', type: 'updated', text: 'changes.v15.driveLooks' },
    ],
  },
  {
    version: 14,
    date: '2026-10-03',
    changes: [
      { target: 'drive', type: 'new', text: 'changes.v14.drive' },
    ],
  },
  {
    version: 13,
    date: '2026-10-03',
    changes: [
      { target: 'molecules', type: 'new', text: 'changes.v13.molecules' },
    ],
  },
  {
    version: 12,
    date: '2026-09-27',
    changes: [
      { target: 'app', type: 'fixed', text: 'changes.v12.installedTop' },
    ],
  },
  {
    version: 11,
    date: '2026-09-27',
    changes: [
      { target: 'app', type: 'fixed', text: 'changes.v11.versionSpace' },
    ],
  },
  {
    version: 10,
    date: '2026-09-27',
    changes: [
      { target: 'app', type: 'fixed', text: 'changes.v10.iosTop' },
      { target: 'app', type: 'fixed', text: 'changes.v10.footer' },
      { target: 'blocks', type: 'fixed', text: 'changes.v10.firefox' },
    ],
  },
  {
    version: 9,
    date: '2026-09-27',
    changes: [
      { target: 'app', type: 'fixed', text: 'changes.v9.iosBlur' },
    ],
  },
  {
    version: 8,
    date: '2026-09-27',
    changes: [
      { target: 'app', type: 'new', text: 'changes.v8.version' },
    ],
  },
  {
    version: 7,
    date: '2026-09-27',
    changes: [
      { target: 'app', type: 'updated', text: 'changes.v7.focus' },
      { target: 'blocks', type: 'updated', text: 'changes.v7.blocksPhones' },
    ],
  },
  {
    version: 6,
    date: '2026-09-26',
    changes: [
      { target: 'app', type: 'new', text: 'changes.v6.fullscreen' },
      { target: 'app', type: 'new', text: 'changes.v6.whatsNew' },
      { target: 'app', type: 'new', text: 'changes.v6.updateNotice' },
    ],
  },
  {
    version: 5,
    date: '2026-09-26',
    changes: [
      { target: 'app', type: 'new', text: 'changes.v5.languages' },
    ],
  },
  {
    version: 4,
    date: '2026-09-26',
    changes: [
      { target: 'memory', type: 'new', text: 'changes.v4.memory' },
      { target: 'blocks', type: 'new', text: 'changes.v4.blocks' },
      { target: 'app', type: 'updated', text: 'changes.v4.offline' },
      { target: 'dice', type: 'fixed', text: 'changes.v4.mageDice' },
    ],
  },
  {
    version: 3,
    date: '2026-09-26',
    changes: [
      { target: 'dice', type: 'updated', text: 'changes.v3.looks' },
      { target: 'dice', type: 'new', text: 'changes.v3.mage' },
    ],
  },
  {
    version: 2,
    date: '2026-09-26',
    changes: [
      { target: 'dice', type: 'updated', text: 'changes.v2.music' },
    ],
  },
  {
    version: 1,
    date: '2026-09-26',
    changes: [
      { target: 'dice', type: 'new', text: 'changes.v1.dice' },
    ],
  },
];

export function latestVersion(releases = RELEASES) {
  return releases[0].version;
}

// seen: { release: number, games: { [gameId]: number } }
// A game gets a badge for changes newer than both the last release the
// player read about and the last version in which they opened that game.
// Returns { [gameId]: 'new' | 'updated' }.
export function badgesFor(seen, releases = RELEASES) {
  const badges = {};
  releases.forEach((release) => {
    release.changes.forEach((change) => {
      if (change.target === 'app' || change.type === 'fixed') {
        return;
      }
      const seenGame = seen.games[change.target] || 0;
      if (release.version <= Math.max(seen.release, seenGame)) {
        return;
      }
      if (change.type === 'new' || !badges[change.target]) {
        badges[change.target] = change.type;
      }
    });
  });
  return badges;
}

export function hasUnseenReleases(seen, releases = RELEASES) {
  return latestVersion(releases) > seen.release;
}

// A first-time player hasn't missed anything, so nothing is "new" yet.
export function normalizeSeen(raw, releases = RELEASES) {
  const latest = latestVersion(releases);
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.release)) {
    return { release: latest, games: {} };
  }
  const games = {};
  if (raw.games && typeof raw.games === 'object') {
    Object.entries(raw.games).forEach(([id, version]) => {
      if (Number.isInteger(version)) {
        games[id] = version;
      }
    });
  }
  return { release: raw.release, games };
}
