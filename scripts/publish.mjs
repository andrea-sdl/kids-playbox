// Publish the committed version of the app (HEAD) to Spacefast.
// Only files listed in offline.json are shipped, plus sw.js and offline.json.
// Uncommitted changes are never published.
//
// Usage: npm run deploy    (needs the Spacefast CLI `sf`, logged in)

import { execFileSync, execSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPACE = 'spc_75a2377177614267bec4010b4bfbe8ea';
const REPOSITORY = 'andrea-sdl/kids-playbox';

const root = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const commit = git('rev-parse', 'HEAD');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const message = git('log', '-1', '--format=%s');
if (git('status', '--porcelain')) {
  console.log('Note: you have uncommitted changes. They will not be published.');
}

const work = mkdtempSync(join(tmpdir(), 'playbox-publish-'));
const source = join(work, 'source');
const site = join(work, 'site');
mkdirSync(source);
mkdirSync(site);

try {
  execSync(`git archive HEAD | tar -x -C "${source}"`, { cwd: root });
  const manifest = JSON.parse(readFileSync(join(source, 'offline.json'), 'utf8'));
  const files = [...manifest.shell, ...Object.values(manifest.games).flat()]
    .filter((file) => !file.endsWith('/'))
    .concat(['./sw.js', './offline.json']);
  new Set(files).forEach((file) => {
    const target = join(site, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(source, file), target);
  });
  console.log(`Publishing ${commit.slice(0, 7)} (${new Set(files).size} files): ${message}`);
  execFileSync('sf', [
    'publish', site,
    '--space', SPACE,
    '-m', message,
    '--git-repository', REPOSITORY,
    '--git-branch', branch,
    '--wait', '-y',
  ], { stdio: 'inherit', env: { ...process.env, SPACEFAST_GIT_COMMIT: commit } });
} finally {
  rmSync(work, { recursive: true, force: true });
}
