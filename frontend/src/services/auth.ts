import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';
import { parseChapters } from '../util/chapters';

const API_URL = import.meta.env.VITE_API_URL;

// Applies a successful /login response. The endpoint returns the same
// {user, chapters} shape as GET /repertoire, so we hydrate auth, replace
// the chapter list, and set repertoireAuthor (which triggers useWebsocket).
export function applyLoginResponse(data: any) {
  const auth = useAuthStore.getState();
  const trainer = useTrainerStore.getState();
  auth.setUser({
    username: data.user.username,
    picture: data.user.picture,
  });
  void trainer.setRepertoire(parseChapters(data.chapters));
  // triggers websocket hook
  if (data.user?.username) trainer.setRepertoireAuthor(data.user.username);
  auth.closeLogin();
}

export type ExchangeResult =
  | { kind: 'ok'; data: any }
  // First sign-in for this account: the backend wrote nothing and wants
  // a username before it will create the user row.
  | { kind: 'needsUsername' }
  | { kind: 'usernameTaken' }
  | { kind: 'error'; status: number; message: string };

// Trades a Firebase ID token for a server session. Pass the signup
// details on the second round-trip of a first-time signup; picture is
// only honoured then (empty means "use the provider's photo, if any").
export async function exchangeIdToken(
  idToken: string,
  signup?: { username: string; picture: string },
): Promise<ExchangeResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signup ? { idToken, ...signup } : { idToken }),
    });
  } catch (err) {
    console.error('login request failed', err);
    return { kind: 'error', status: 0, message: 'Could not reach the server. Try again.' };
  }
  if (res.status === 409) return { kind: 'usernameTaken' };
  if (!res.ok) {
    const text = await res.text();
    console.error('login failed', res.status, text);
    let message = 'Login failed. Try again.';
    if (res.status === 429) message = 'Too many attempts. Try again in a minute.';
    else if (res.status === 400 && text.includes('picture')) message = 'That picture was rejected. Remove it and try again.';
    return { kind: 'error', status: res.status, message };
  }
  const data = await res.json();
  if (data.needsUsername) return { kind: 'needsUsername' };
  return { kind: 'ok', data };
}
