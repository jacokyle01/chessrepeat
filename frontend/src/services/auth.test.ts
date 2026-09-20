import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('idb-keyval', () => ({
  get: async () => undefined,
  set: async () => {},
  del: async () => {},
}));

import { applyLoginResponse, exchangeIdToken } from './auth';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';
import { chapter, ITALIAN } from '../test/fixtures';
import { fetchCall, mockFetch, mockFetchNetworkError } from '../test/http';

beforeEach(() => {
  useAuthStore.setState({ user: null, showLogin: true });
  useTrainerStore.setState(useTrainerStore.getInitialState(), true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('exchangeIdToken', () => {
  test('posts just the id token for a returning user', async () => {
    const fetch = mockFetch(200, { user: { username: 'alice' }, chapters: [] });
    const result = await exchangeIdToken('tok');
    expect(result.kind).toBe('ok');
    const { url, init } = fetchCall(fetch);
    expect(url).toBe('http://api.test/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual({ idToken: 'tok' });
  });

  test('includes the signup details on the second round trip', async () => {
    const fetch = mockFetch(200, { user: { username: 'alice' }, chapters: [] });
    await exchangeIdToken('tok', { username: 'alice', picture: 'https://pic' });
    expect(JSON.parse(fetchCall(fetch).init.body as string)).toEqual({
      idToken: 'tok',
      username: 'alice',
      picture: 'https://pic',
    });
  });

  test('a first-time account is asked for a username', async () => {
    mockFetch(200, { needsUsername: true });
    expect(await exchangeIdToken('tok')).toEqual({ kind: 'needsUsername' });
  });

  test('409 means the username is taken', async () => {
    mockFetch(409, 'username taken');
    expect(await exchangeIdToken('tok', { username: 'alice', picture: '' })).toEqual({ kind: 'usernameTaken' });
  });

  test('maps server errors to user-facing messages', async () => {
    mockFetch(429, 'slow down');
    expect(await exchangeIdToken('tok')).toMatchObject({ kind: 'error', status: 429, message: /Too many attempts/ });

    mockFetch(400, 'invalid picture');
    expect(await exchangeIdToken('tok')).toMatchObject({ kind: 'error', status: 400, message: /picture was rejected/ });

    mockFetch(500, 'boom');
    expect(await exchangeIdToken('tok')).toMatchObject({ kind: 'error', status: 500, message: 'Login failed. Try again.' });
  });

  test('a network failure is reported as status 0', async () => {
    mockFetchNetworkError();
    expect(await exchangeIdToken('tok')).toMatchObject({ kind: 'error', status: 0, message: /Could not reach/ });
  });
});

describe('applyLoginResponse', () => {
  test('hydrates auth, installs the chapters, opens the room and closes the modal', () => {
    const c = chapter(ITALIAN, 'white', 'from-server');
    applyLoginResponse({
      user: { username: 'alice', picture: 'https://pic' },
      chapters: [{ uuid: c.uuid, name: c.name, trainAs: c.trainAs, root: c.root }],
    });
    expect(useAuthStore.getState().user).toEqual({ username: 'alice', picture: 'https://pic' });
    expect(useAuthStore.getState().showLogin).toBe(false);
    const trainer = useTrainerStore.getState();
    expect(trainer.repertoireAuthor).toBe('alice');
    expect(trainer.repertoire.map((ch) => ch.name)).toEqual(['from-server']);
    // counts are derived on the way in, not trusted from the wire
    expect(trainer.repertoire[0].enabledCount).toBe(3);
    expect(trainer.repertoire[0].unseenCount).toBe(3);
  });
});
