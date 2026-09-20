import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('idb-keyval', () => ({
  get: async () => undefined,
  set: async () => {},
  del: async () => {},
}));

import {
  addCollaborator,
  fetchIncomingCollaborators,
  fetchOutgoingCollaborators,
  removeCollaborator,
  viewUserRepertoire,
} from './collaborators';
import { useTrainerStore } from '../store/state';
import { useAuthStore } from '../store/auth';
import { chapter, ITALIAN } from '../test/fixtures';
import { fetchCall, mockFetch, mockFetchNetworkError } from '../test/http';

beforeEach(() => {
  useAuthStore.setState({ user: { username: 'alice' } });
  useTrainerStore.setState(useTrainerStore.getInitialState(), true);
});

describe('listing collaborators', () => {
  test('returns the server list', async () => {
    const fetch = mockFetch(200, { collaborators: [{ username: 'bob', permission: 'edit' }] });
    expect(await fetchOutgoingCollaborators()).toEqual([{ username: 'bob', permission: 'edit' }]);
    expect(fetchCall(fetch).url).toBe('http://api.test/collaborators/outgoing');

    mockFetch(200, { collaborators: [{ username: 'carol', permission: 'train' }] });
    expect(await fetchIncomingCollaborators()).toEqual([{ username: 'carol', permission: 'train' }]);
  });

  test('an error response reads as an empty list', async () => {
    mockFetch(500, 'boom');
    expect(await fetchOutgoingCollaborators()).toEqual([]);
    expect(await fetchIncomingCollaborators()).toEqual([]);
  });
});

describe('addCollaborator', () => {
  test('refuses a blank username without a request', async () => {
    const fetch = mockFetch(200, {});
    expect(await addCollaborator('   ', 'edit')).toEqual({ ok: false, error: 'username required' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('posts the trimmed name and permission', async () => {
    const fetch = mockFetch(200, { username: 'bob', permission: 'edit' });
    const result = await addCollaborator('  bob ', 'edit');
    expect(result).toEqual({ ok: true, collaborator: { username: 'bob', permission: 'edit' } });
    const { url, init } = fetchCall(fetch);
    expect(url).toBe('http://api.test/collaborators');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'bob', permission: 'edit' });
  });

  test('surfaces the server error text', async () => {
    mockFetch(404, 'no such user');
    expect(await addCollaborator('nobody', 'edit')).toEqual({ ok: false, error: 'no such user' });

    mockFetch(500, '');
    expect(await addCollaborator('bob', 'edit')).toEqual({ ok: false, error: 'http 500' });

    mockFetchNetworkError('offline');
    expect(await addCollaborator('bob', 'edit')).toMatchObject({ ok: false, error: /offline/ });
  });
});

describe('removeCollaborator', () => {
  test('deletes by url-encoded username', async () => {
    const fetch = mockFetch(200);
    await removeCollaborator('b o b');
    const { url, init } = fetchCall(fetch);
    expect(url).toBe('http://api.test/collaborators/b%20o%20b');
    expect(init.method).toBe('DELETE');
  });
});

describe('viewUserRepertoire', () => {
  test('swaps in the other user chapters and moves the socket to their room', async () => {
    const c = chapter(ITALIAN, 'white', 'bobs');
    const fetch = mockFetch(200, { user: { username: 'bob' }, chapters: [{ uuid: c.uuid, name: c.name, trainAs: c.trainAs, root: c.root }] });
    const socket = { readyState: WebSocket.OPEN, close: vi.fn() } as unknown as WebSocket;
    useTrainerStore.setState({
      socket,
      repertoireAuthor: 'alice',
      connectedUsers: [{ username: 'alice', picture: '', permission: 'owner' }],
    });

    expect(await viewUserRepertoire('bob')).toEqual({ ok: true });

    expect(fetchCall(fetch).url).toBe('http://api.test/repertoire?owner=bob');
    expect(socket.close).toHaveBeenCalled();
    const trainer = useTrainerStore.getState();
    expect(trainer.connectedUsers).toEqual([]);
    expect(trainer.repertoireAuthor).toBe('bob');
    expect(trainer.repertoire.map((ch) => ch.name)).toEqual(['bobs']);
    expect(trainer.selectedChapterId).toBe(c.uuid);
  });

  test('leaves the current view alone when the server says no', async () => {
    useTrainerStore.setState({ repertoireAuthor: 'alice' });
    mockFetch(403, 'forbidden');
    expect(await viewUserRepertoire('bob')).toEqual({ ok: false, error: 'http 403' });
    expect(useTrainerStore.getState().repertoireAuthor).toBe('alice');
  });
});
