import { parseChapters } from '../util/chapters';
import { useTrainerStore } from '../store/state';

const API = 'http://localhost:8080';

export type Collaborator = {
  username: string;
  picture?: string;
};

// Users we've added to our repertoire as collaborators.
export async function fetchOutgoingCollaborators(): Promise<Collaborator[]> {
  const res = await fetch(`${API}/collaborators/outgoing`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = (await res.json()) as { collaborators: Collaborator[] };
  return data.collaborators ?? [];
}

// Users who've added us to their repertoire as a collaborator.
export async function fetchIncomingCollaborators(): Promise<Collaborator[]> {
  const res = await fetch(`${API}/collaborators/incoming`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = (await res.json()) as { collaborators: Collaborator[] };
  return data.collaborators ?? [];
}

export async function addCollaborator(
  username: string,
): Promise<{ ok: boolean; collaborator?: Collaborator; error?: string }> {
  const name = username.trim();
  if (!name) return { ok: false, error: 'username required' };
  try {
    const res = await fetch(`${API}/collaborators`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text || `http ${res.status}` };
    }
    const c = (await res.json()) as Collaborator;
    return { ok: true, collaborator: c };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function removeCollaborator(username: string): Promise<void> {
  await fetch(`${API}/collaborators/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

// Fetch another user's repertoire, close the current WebSocket, swap the
// in-memory chapters, and set repertoireAuthor so useWebsocket opens the
// new room. The WS hook's cleanup already closes the previous socket when
// repertoireAuthor changes, but we close explicitly here so no events are
// observed against the old room between fetch and effect run.
export async function viewUserRepertoire(username: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API}/repertoire?owner=${encodeURIComponent(username)}`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      return { ok: false, error: `http ${res.status}` };
    }
    const data = await res.json();

    const { socket, setConnectedUsers, setRepertoire, setRepertoireAuthor } =
      useTrainerStore.getState();
    // Close the old room's socket up-front so we don't observe events
    // from the previous room between now and when useWebsocket's effect
    // reruns for the new repertoireAuthor.
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
    setConnectedUsers([]);

    await setRepertoire(parseChapters(data.chapters));
    setRepertoireAuthor(username);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
