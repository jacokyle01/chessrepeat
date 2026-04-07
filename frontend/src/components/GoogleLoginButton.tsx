import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/auth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function GoogleLoginButton({ onToken }: { onToken: (idToken: string) => void }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // @ts-ignore
    if (!window.google?.accounts?.id) return;

    // @ts-ignore
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp: any) => {
        const idToken: string = resp.credential;

        // hit backend login endpoint to upsert user + repertoire
        try {
          const res = await fetch('http://localhost:8080/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          if (!res.ok) {
            console.error('login failed', res.status, await res.text());
          } else {
            const data = await res.json();
            if (data.repertoire?.id) {
              useAuthStore.getState().setRepertoireId(data.repertoire.id);
            }
          }
        } catch (err) {
          console.error('login request failed', err);
        }

        onToken(idToken);
      },
    });

    setReady(true);
  }, [onToken]);

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
