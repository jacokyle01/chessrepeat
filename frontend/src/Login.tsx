import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLoginButton } from './components/GoogleLoginButton';
import { Header } from './components/Header';
import { useAuthStore } from './state/auth';
import './css/layout.css';

// Reject absolute URLs and protocol-relative paths so a crafted ?returnTo=
// can't turn /login into an open redirect.
function safeReturnTo(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function storeUserFromLoginResponse(data: any) {
  useAuthStore.getState().setUser({
    sub: data.user.tokenId,
    username: data.user.username,
    email: data.user.email,
    picture: data.user.picture,
  });
}

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));

  const [pendingSignup, setPendingSignup] = useState<{
    idToken: string;
    hasPlaygroundData: boolean;
  } | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');

  const finish = (data: any) => {
    storeUserFromLoginResponse(data);
    navigate(returnTo, { replace: true });
  };

  return (
    <div className="app-root">
      <Header />
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-6 w-96">
          {pendingSignup ? (
        <>
          <h1 className="text-lg font-semibold mb-2">Pick a username</h1>
          <p className="text-sm text-gray-600 mb-4">
            This will be your URL handle (chessrepeat.com/@/your-username).
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const username = pendingUsername.trim();
              if (!username) return;
              try {
                const res = await fetch('http://localhost:8080/login', {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken: pendingSignup.idToken, username }),
                });
                if (!res.ok) {
                  console.error('signup failed', res.status, await res.text());
                  return;
                }
                const data = await res.json();
                finish(data);
              } catch (err) {
                console.error('signup request failed', err);
              }
            }}
          >
            <input
              type="text"
              autoFocus
              value={pendingUsername}
              onChange={(e) => setPendingUsername(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-sm"
              placeholder="username"
            />
            <button
              type="submit"
              className="w-full bg-slate-800 text-white text-sm font-semibold py-2 rounded hover:bg-slate-700"
            >
              Continue
            </button>
          </form>
        </>
      ) : (
            <div className="flex flex-col items-center">
              <h1 className="text-lg font-semibold mb-4">Sign in</h1>
              <GoogleLoginButton
                onNeedsUsername={(idToken, hasPlaygroundData) =>
                  setPendingSignup({ idToken, hasPlaygroundData })
                }
                onSuccess={(data) => finish(data)}
              />
              <p className="mt-4 text-xs text-gray-500 text-center">
                First time signing in? You'll be prompted to pick a username.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
