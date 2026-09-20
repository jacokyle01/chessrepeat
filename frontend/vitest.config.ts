import { defineConfig } from 'vitest/config';

// Unit tests for the pure logic under src/util and the zustand stores.
// They run in plain node — no DOM — so anything that touches the
// browser (Firebase, IndexedDB, alert) is stubbed in vitest.setup.ts.
// Browser-level user paths live in e2e/ (Playwright) instead.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
    // The services read the API base off import.meta.env at module load.
    env: { VITE_API_URL: 'http://api.test' },
  },
});
