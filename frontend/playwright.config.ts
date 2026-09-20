import { defineConfig, devices } from '@playwright/test';

// Browser-level regression suite. Two projects:
//
//   playground  — the signed-out app. Only Vite is needed; state lives in
//                 IndexedDB, and every test gets a fresh browser context so
//                 nothing leaks between them. This is what `npm run test:e2e`
//                 runs and what you'd reach for while developing.
//
//   authed      — the signed-in app against the real Go server and a real
//                 Postgres. Enabled with E2E_BACKEND=1 (see e2e/README.md for
//                 the Postgres it expects). Login bypasses Firebase: the
//                 server is pointed at a local cert endpoint and the tests
//                 mint their own ID tokens (e2e/support/auth.ts).
//
// Ports are chosen not to collide with `npm run dev` (5173) or a local
// backend (8080), so the suite can run next to a dev session.
const CI = !!process.env.CI;
const withBackend = !!process.env.E2E_BACKEND;

export const WEB_PORT = 5179;
export const API_PORT = 8089;
export const CERTS_PORT = 8090;
export const API_URL = `http://localhost:${API_PORT}`;

const backendServers = withBackend
  ? [
      {
        command: 'node e2e/scripts/certs-server.mjs',
        url: `http://localhost:${CERTS_PORT}/`,
        env: { E2E_CERTS_PORT: String(CERTS_PORT) },
        reuseExistingServer: !CI,
        timeout: 30_000,
      },
      {
        command: 'bash e2e/scripts/backend.sh',
        url: `${API_URL}/healthz`,
        env: {
          E2E_API_PORT: String(API_PORT),
          E2E_CERTS_PORT: String(CERTS_PORT),
          E2E_WEB_PORT: String(WEB_PORT),
        },
        reuseExistingServer: !CI,
        // First run compiles the server (and may download the Go toolchain).
        timeout: 300_000,
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
      },
    ]
  : [];

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    // The board is sized from the viewport; keep it big enough that square
    // centres are unambiguous and the sidebar isn't collapsed to mobile.
    viewport: { width: 1400, height: 900 },
  },
  webServer: [
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_E2E: '1', VITE_API_URL: API_URL },
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    ...backendServers,
  ],
  projects: [
    { name: 'playground', testMatch: /playground\/.*\.spec\.ts/ },
    ...(withBackend ? [{ name: 'authed', testMatch: /authed\/.*\.spec\.ts/ }] : []),
  ],
});
