import { beforeEach, describe, expect, test, vi } from 'vitest';

const idb = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (k: string) => idb.get(k),
  set: async (k: string, v: unknown) => {
    idb.set(k, v);
  },
  del: async (k: string) => {
    idb.delete(k);
  },
}));

import { fetchRepertoire } from './repertoire';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';
import { chapter, ITALIAN } from '../test/fixtures';
import { fetchCall, mockFetch, mockFetchNetworkError } from '../test/http';

const wire = (c: ReturnType<typeof chapter>) => ({ uuid: c.uuid, name: c.name, trainAs: c.trainAs, root: c.root });

beforeEach(() => {
  idb.clear();
  useAuthStore.setState({ user: null });
  useTrainerStore.setState(useTrainerStore.getInitialState(), true);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('fetchRepertoire', () => {
  test('bootstrap: learns who the session belongs to and installs sorted chapters', async () => {
    const black = chapter(ITALIAN, 'black', 'b');
    const white = chapter(ITALIAN, 'white', 'w');
    const fetch = mockFetch(200, {
      user: { username: 'alice', picture: 'https://pic' },
      chapters: [wire(black), wire(white)],
    });

    const result = await fetchRepertoire();

    expect(result).toEqual({ ok: true, status: 200 });
    const { url, init } = fetchCall(fetch);
    expect(url).toBe('http://api.test/repertoire');
    expect(init.credentials).toBe('include');
    expect(useAuthStore.getState().user).toEqual({ username: 'alice', picture: 'https://pic' });
    const trainer = useTrainerStore.getState();
    expect(trainer.repertoireAuthor).toBe('alice');
    expect(trainer.repertoire.map((c) => c.name)).toEqual(['w', 'b']);
    expect(trainer.selectedChapterId).toBe(white.uuid);
    // signed in => chapters are not written to IndexedDB
    expect([...idb.keys()].filter((k) => k.startsWith('trainer:chapter'))).toEqual([]);
  });

  test('resync: asks for the viewed owner and leaves auth alone', async () => {
    useAuthStore.setState({ user: { username: 'alice' } });
    useTrainerStore.setState({ repertoireAuthor: 'bob' });
    const fetch = mockFetch(200, { user: { username: 'bob' }, chapters: [] });

    await fetchRepertoire();

    expect(fetchCall(fetch).url).toBe('http://api.test/repertoire?owner=bob');
    expect(useAuthStore.getState().user?.username).toBe('alice');
    expect(useTrainerStore.getState().repertoireAuthor).toBe('bob');
  });

  test('a stale session hint comes back as 401 and changes nothing', async () => {
    mockFetch(401, 'unauthorized');
    expect(await fetchRepertoire()).toEqual({ ok: false, status: 401 });
    expect(useAuthStore.getState().user).toBeNull();
    expect(useTrainerStore.getState().repertoire).toEqual([]);
  });

  test('a network error has no status so the caller can fall back to IDB', async () => {
    mockFetchNetworkError();
    expect(await fetchRepertoire()).toEqual({ ok: false });
  });
});
