import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
/**
 * Set E2E_BASE_URL to test a server that is already running, such as the Docker image, instead of
 * starting the local build. It must have a fresh database (the setup creates the first account).
 */
const EXTERNAL_URL = process.env['E2E_BASE_URL'];
const BASE_URL = EXTERNAL_URL ?? `http://127.0.0.1:${String(PORT)}`;
/** Throwaway data directory: every run starts from an empty database. */
const DATA_DIR = '.e2e-data';

/**
 * End-to-end tests against the production build. Run `pnpm build` first.
 */
export default defineConfig({
  testDir: './e2e',
  // One browser at a time. Launching several Chromium instances at once can stall slower
  // machines for long enough to time out the first navigation; the suite is fast either way.
  workers: 1,
  // Signing up (Argon2 hashing) and server actions can take a few seconds on a busy machine; the
  // default 5 s wait for assertions made the suite flaky there without catching real bugs.
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    // Creates the admin account first: on a fresh database, the first sign-up becomes admin.
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: EXTERNAL_URL
    ? undefined
    : {
        command: `node scripts/remove-dir.mjs ${DATA_DIR} && node --enable-source-maps dist/server.mjs`,
        url: `${BASE_URL}/healthz`,
        reuseExistingServer: false,
        // Server logs appear in the test output; raise verbosity with E2E_LOG_LEVEL=debug.
        stdout: 'pipe',
        timeout: 60_000,
        env: {
          NODE_ENV: 'production',
          PORT: String(PORT),
          DATA_DIR,
          LOG_LEVEL: process.env['E2E_LOG_LEVEL'] ?? 'warn',
        },
      },
});
