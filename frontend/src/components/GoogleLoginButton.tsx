import { useEffect, useState } from 'react';
import { useAuthStore } from '../state/auth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function GoogleLoginButton() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // @ts-ignore
    if (!window.google?.accounts?.id) return;

    // @ts-ignore
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp: any) => {
        const idToken: string = resp.credential;

        // hit backend login endpoint to upsert user + repertoire.
        // credentials: 'include' is required so the browser stores the
        // session cookie that the server returns in Set-Cookie.
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
          const auth = useAuthStore.getState();
          auth.setUser({
            sub: data.user.tokenId,
            name: data.user.name,
            email: data.user.email,
            picture: data.user.picture,
          });
          if (data.repertoire?.id) {
            // if URL is at root (no shared repertoire link), drop the
            // user into their own repertoire and reflect that in the URL.
            // otherwise leave the active (shared) repertoire alone.
            const seg = window.location.pathname.replace(/^\/+|\/+$/g, '');
            if (!seg) {
              auth.setRepertoireId(data.repertoire.id);
              window.history.pushState(null, '', `/${data.repertoire.id}`);
            }
          }
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
