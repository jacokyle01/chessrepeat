import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useTrainerStore } from '../store/state';
import { parseChapters } from '../util/chapters';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface Props {
  onNeedsUsername?: (idToken: string) => void;
  // Override the post-login behaviour. When provided, the default
  // applyLoginResponse call is skipped and the caller owns state transitions.
  onSuccess?: (data: any) => void | Promise<void>;
}

// Applies a successful /login response. The endpoint returns the same
// {user, chapters} shape as GET /repertoire, so we hydrate auth, replace
// the chapter list, and set repertoireAuthor (which triggers useWebsocket).
export function applyLoginResponse(data: any) {
  const auth = useAuthStore.getState();
  const trainer = useTrainerStore.getState();
  auth.setUser({
    sub: data.user.tokenId,
    username: data.user.username,
    email: data.user.email,
    picture: data.user.picture,
  });
  void trainer.setRepertoire(parseChapters(data.chapters));
  if (data.user?.username) trainer.setRepertoireAuthor(data.user.username);
  auth.closeLogin();
}

export function GoogleLoginButton({ onNeedsUsername, onSuccess }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // @ts-ignore
    if (!window.google?.accounts?.id) return;

    // @ts-ignore
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp: any) => {
        const idToken: string = resp.credential;

        try {
          const res = await fetch('http://localhost:8080/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          if (!res.ok) {
            console.error('login failed', res.status, await res.text());
            return;
          }
          const data = await res.json();
          if (data.needsUsername) {
            onNeedsUsername?.(idToken);
            return;
          }
          if (onSuccess) {
            await onSuccess(data);
            return;
          }
          applyLoginResponse(data);
        } catch (err) {
          console.error('login request failed', err);
        }
      },
    });

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // @ts-ignore
    window.google.accounts.id.renderButton(document.getElementById('gbtn'), {
      theme: 'outline',
      size: 'large',
    });
  }, [ready]);

  return <div id="gbtn" />;
}
