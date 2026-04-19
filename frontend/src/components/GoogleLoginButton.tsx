import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../state/auth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface Props {
  onNeedsUsername?: (idToken: string) => void;
  // Override the post-login behaviour. When provided, the default
  // applyLoginResponse call is skipped and the caller owns state + navigation.
  onSuccess?: (data: any) => void | Promise<void>;
}

// Applies a successful /login response: updates the auth store and, if we're
// not already viewing a /@/{username} route, navigates to the user's own.
// Does not touch the URL itself beyond that — navigation is owned by the
// router.
export async function applyLoginResponse(
  data: any,
  navigate: (path: string) => void,
) {
  const auth = useAuthStore.getState();
  auth.setUser({
    sub: data.user.tokenId,
    username: data.user.username,
    email: data.user.email,
    picture: data.user.picture,
  });
  if (data.user?.username) {
    const atRoute = /^\/@\/[^/]+/.test(window.location.pathname);
    if (!atRoute) {
      navigate(`/@/${data.user.username}`);
    }
  }
}

export function GoogleLoginButton({ onNeedsUsername, onSuccess }: Props) {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

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
          await applyLoginResponse(data, navigate);
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
