// Runs the full test suite INCLUDING the database tests (npm run test:db).
// Loads .env.local (`node --env-file`), then refuses to run unless the database is the Neon dev branch
// (host starts with ep-dawn-snow). Production (ep-falling-sound) and anything else abort. Never prints the URL.
import { spawnSync } from 'node:child_process';

const DEV_HOST = 'ep-dawn-snow';
const PRODUCTION_HOST = 'ep-falling-sound';

const hostOf = (name, url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return abort(`${name} is missing or not a valid URL. Set it in .env.local.`);
  }
};
function abort(message) {
  console.error(`test:db aborted: ${message}`);
  process.exit(1);
}

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url)
  abort(
    'neither TEST_DATABASE_URL nor DATABASE_URL is set (looked in the environment and .env.local).',
  );

// Every database variable the tests could reach must be the dev branch, not just the one we pass on.
for (const name of ['TEST_DATABASE_URL', 'DATABASE_URL', 'DATABASE_URL_UNPOOLED']) {
  if (!process.env[name]) continue;
  const host = hostOf(name, process.env[name]);
  if (host.startsWith(PRODUCTION_HOST))
    abort(`${name} points at PRODUCTION (${PRODUCTION_HOST}). Never run tests there.`);
  if (!host.startsWith(DEV_HOST))
    abort(`${name} host is "${host.split('.')[0]}", expected ${DEV_HOST}.`);
}

console.log(
  `test:db: database host ${hostOf('database URL', url).split('.')[0]} (dev branch). Running the full suite.`,
);
const run = spawnSync(
  process.execPath,
  ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: url } },
);
process.exit(run.status ?? 1);
