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
  // Stripe's embedded checkout sometimes stalls in automated browsers (its invisible captcha never resolves). One retry
  // keeps the real-payment suite useful; the app code is not at fault, see docs/BUILD_PLAN.md (Phase 6).
  retries: process.env.E2E_STRIPE ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}` },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `npm run build && npx next start -p ${PORT}`,
          url: `http://localhost:${PORT}`,
          reuseExistingServer: true,
          timeout: 240_000,
          // Real emails only for the @email test (npm run e2e:email). Everything else runs with Resend off, which also
          // exercises the path where an email fails and the booking must survive.
          env: process.env.E2E_EMAIL ? {} : { RESEND_API_KEY: '' },
        },
        // The @stripe tests need real webhooks, forwarded to the local app by the Stripe CLI (test mode).
        ...(process.env.E2E_STRIPE
          ? [
              {
                command: `stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired --forward-to localhost:${PORT}/api/stripe/webhook`,
                wait: { stderr: /Ready!/ },
                reuseExistingServer: true,
                timeout: 60_000,
              },
            ]
          : []),
      ],
});
