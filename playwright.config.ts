import { defineConfig } from '@playwright/test';

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: rely on the real environment.
}

const PORT = 3200;

// These tests run against the DATABASE_URL in .env.local: use a Neon dev branch, never production.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}` },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
