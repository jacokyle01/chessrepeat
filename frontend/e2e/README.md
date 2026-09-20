# Browser regression tests

Playwright drives the real UI through the user paths that matter: adding a
repertoire, edit mode, learn and recall, chapter management, and — signed
in — the server round trip and live collaboration over the WebSocket.

```
npm run test:e2e          # playground project: signed-out app, Vite only
npm run test:e2e:db       # start a throwaway Postgres in docker (port 5433)
npm run test:e2e:all      # playground + authed (needs Go and that Postgres)
npm run test:e2e:ui       # Playwright's UI mode
npm run test:e2e:db:stop
```

The first `test:e2e:all` builds the Go server; `backend/go.mod` pins a
toolchain newer than most machines have, so let `go` download it.

## Layout

| Path | What |
| --- | --- |
| `playground/` | Signed-out flows. Each test gets a fresh browser context, so IndexedDB starts empty and the app seeds the example chapter. |
| `authed/` | Signed-in flows against the Go server + Postgres. Each test signs up a fresh user. |
| `support/app.ts` | Locators and flows for the UI (add chapter, rename, context menu, tip text …). |
| `support/board.ts` | `playMove(page, 'e2', 'e4')`: click-click on computed square centres, verified against chessground's own selection marker. |
| `support/auth.ts` | Firebase-free login: mints an RS256 ID token, trades it at `POST /login`, copies the session cookies into the browser. |
| `scripts/certs-server.mjs` | Serves the self-signed cert the server verifies those tokens against (`FIREBASE_CERTS_URL`). |
| `scripts/backend.sh` | Drops and recreates `chessrepeat_e2e`, applies `schema.sql`, builds and runs the server on port 8089. |

Ports: Vite 5179, API 8089, certs 8090 — chosen so the suite can run next to
a normal dev session. `src/main.tsx` exposes the stores on
`window.__chessrepeat` when Vite runs with `VITE_E2E=1`; the tests use it
sparingly (orientation, selected path, socket state).

## Writing a test

- Prefer what the user sees: chapter rows, tree moves, the tip text.
- Outside edit mode the tree only draws the line being trained, so switch
  to edit before asserting on the whole chapter.
- Modes are not persisted; after `page.reload()` pick the mode again.
- Signed in: pass `signedIn: true` to `addChapter` (the server answers with
  a reload, and the helper waits for the resync) and call `waitForSocket`
  after a page load before anything that must reach the server.
- A test that documents a known bug uses `test.fail()` so the suite stays
  green and flips red the day the bug is fixed.
