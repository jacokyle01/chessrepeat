import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('idb-keyval', () => ({
  get: async () => undefined,
  set: async () => {},
  del: async () => {},
}));
vi.mock('./repertoire', () => ({
  fetchRepertoire: vi.fn(async () => ({ ok: true, status: 200 })),
}));

import { postChapter } from './postChapter';
import { fetchRepertoire } from './repertoire';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';
import { chapter, ITALIAN } from '../test/fixtures';
import { fetchCall, mockFetch } from '../test/http';

beforeEach(() => {
  useAuthStore.setState({ user: { username: 'alice' } });
  useTrainerStore.setState(useTrainerStore.getInitialState(), true);
  useTrainerStore.setState({ repertoireAuthor: 'alice' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('postChapter', () => {
  test('sends the whole tree to the viewed owner', async () => {
    useTrainerStore.setState({ repertoireAuthor: 'bob' });
    const fetch = mockFetch(200, {});
    const c = chapter(ITALIAN, 'black', 'italian');

    await postChapter(c);

    const { url, init } = fetchCall(fetch);
    expect(url).toBe('http://api.test/chapter?owner=bob');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ chapterId: c.uuid, name: 'italian', trainAs: 'black' });
    expect(body.root.children[0].data.san).toBe('e4');
    expect(fetchRepertoire).not.toHaveBeenCalled();
  });

  test('signed out: nothing is sent', async () => {
    useAuthStore.setState({ user: null });
    const fetch = mockFetch(200, {});
    await postChapter(chapter(ITALIAN));
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each([
    [413, /move cap/],
    [409, /chapter limit/],
  ])('%i: tells the user and resyncs from the server', async (status, message) => {
    mockFetch(status, '');
    await postChapter(chapter(ITALIAN));
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(message));
    expect(fetchRepertoire).toHaveBeenCalledTimes(1);
  });

  test('other failures are logged, not resynced', async () => {
    mockFetch(500, 'boom');
    await postChapter(chapter(ITALIAN));
    expect(console.error).toHaveBeenCalled();
    expect(fetchRepertoire).not.toHaveBeenCalled();
  });
});
