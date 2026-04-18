import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/auth';
import { loadPlaygroundChapters } from '../state/state';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface Props {
  onPlaygroundMigration?: () => void;
  onNeedsUsername?: (idToken: string, hasPlaygroundData: boolean) => void;
}

export async function applyLoginResponse(
  data: any,
  hasPlaygroundData: boolean,
  onPlaygroundMigration?: () => void,
) {
  const auth = useAuthStore.getState();
  auth.setUser({
    sub: data.user.tokenId,
    username: data.user.username,
    email: data.user.email,
    picture: data.user.picture,
  });
  if (data.repertoire?.id) {
    const seg = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!seg) {
      auth.setRepertoireId(data.repertoire.id);
      window.history.pushState(null, '', `/${data.repertoire.id}`);
    }
  }
  if (hasPlaygroundData && onPlaygroundMigration) {
    onPlaygroundMigration();
  }
}

export function GoogleLoginButton({ onPlaygroundMigration, onNeedsUsername }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // @ts-ignore
    if (!window.google?.accounts?.id) return;

    // @ts-ignore
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp: any) => {
        const idToken: string = resp.credential;

        // Check if there's playground data before login clears it
        const playgroundChapters = await loadPlaygroundChapters();
        const hasPlaygroundData = playgroundChapters.length > 0;

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
            onNeedsUsername?.(idToken, hasPlaygroundData);
            return;
          }
          await applyLoginResponse(data, hasPlaygroundData, onPlaygroundMigration);
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
