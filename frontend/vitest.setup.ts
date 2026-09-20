import { vi } from 'vitest';

// src/lib/firebase calls initializeApp/getAuth at import time, which
// throws without a real API key. The stores import it transitively
// (store/auth -> lib/firebase), so replace it with inert stubs.
vi.mock('./src/lib/firebase', () => ({
  firebaseAuth: {},
  firebaseStorage: {},
  googleProvider: {},
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn(async () => {}),
}));

// chapterFromPgn alerts on a malformed PGN; there's no window in node.
vi.stubGlobal('alert', vi.fn());

// The store logs generously. Keep test output readable.
vi.spyOn(console, 'log').mockImplementation(() => {});
