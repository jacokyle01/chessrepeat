import { createSign, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { API_URL } from '../../playwright.config';

// Firebase-free login for the `authed` project.
//
// The Go server verifies ID tokens as RS256 JWTs against whatever
// FIREBASE_CERTS_URL serves (see e2e/scripts/certs-server.mjs and
// backend/internal/auth/firebase.go). We hold the matching private key,
// so we can mint a token with the claims a real Firebase token carries and
// trade it for a session at POST /login exactly the way the app does.

const PROJECT_ID = 'chessrepeat-e2e';
const KID = 'e2e';
const keyPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.tmp', 'key.pem');

const b64url = (input: string | Buffer) => Buffer.from(input).toString('base64url');

export function mintIdToken(user: { uid: string; email: string; name: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: KID };
  const claims = {
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: user.uid,
    iat: now - 60,
    exp: now + 3600,
    auth_time: now - 60,
    email: user.email,
    email_verified: true,
    name: user.name,
    picture: '',
    firebase: { sign_in_provider: 'google.com' },
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(readFileSync(keyPath));
  return `${signingInput}.${b64url(signature)}`;
}

export type TestUser = { username: string; uid: string };

// Usernames must match ^[a-z0-9_]{3,20}$ on the server and be unique
// across parallel tests and repeated runs against a reused database.
export function freshUser(prefix = 'e2e'): TestUser {
  const username = `${prefix}_${randomBytes(4).toString('hex')}`.slice(0, 20);
  return { username, uid: `uid-${username}` };
}

// Signs `user` up (first login sends the username) and copies the session
// cookies into the browser context, so the next page load boots signed in.
export async function loginAs(request: APIRequestContext, context: BrowserContext, user: TestUser) {
  const idToken = mintIdToken({ uid: user.uid, email: `${user.username}@example.com`, name: user.username });
  const res = await request.post(`${API_URL}/login`, {
    data: { idToken, username: user.username, picture: '' },
  });
  expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBe(true);
  const { cookies } = await request.storageState();
  await context.addCookies(cookies);
  return user;
}

export async function expectSignedInAs(page: Page, username: string) {
  await expect(page.locator('.header-username')).toHaveText(username);
}

// Moves, comments and training results travel over the WebSocket, and the
// client drops them silently while it's still connecting. Wait for the
// room to be open before doing anything that must reach the server.
export async function waitForSocket(page: Page) {
  await expect
    .poll(
      () => page.evaluate(() => (window as any).__chessrepeat.trainer.getState().socket?.readyState ?? -1),
      { message: 'websocket never opened', timeout: 15_000 },
    )
    .toBe(WebSocket.OPEN);
}
