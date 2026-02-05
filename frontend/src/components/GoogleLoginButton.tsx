import { useEffect, useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function GoogleLoginButton({ onToken }: { onToken: (idToken: string) => void }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // @ts-ignore
    if (!window.google?.accounts?.id) return;

    // @ts-ignore
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp: any) => {
        // resp.credential is the ID token (JWT)
        onToken(resp.credential);
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
