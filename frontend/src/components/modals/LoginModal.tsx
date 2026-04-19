import { useState } from 'react';
import { Modal } from './Modal';
import { GoogleLoginButton, applyLoginResponse } from '../GoogleLoginButton';
import { useAuthStore } from '../../store/auth';

export function LoginModal() {
  const showLogin = useAuthStore((s) => s.showLogin);
  const closeLogin = useAuthStore((s) => s.closeLogin);

  const [pendingSignup, setPendingSignup] = useState<{ idToken: string } | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');

  const dismiss = () => {
    setPendingSignup(null);
    setPendingUsername('');
    closeLogin();
  };

  return (
    <Modal open={showLogin} onClose={dismiss} title={pendingSignup ? 'Pick a username' : 'Sign in'}>
      {pendingSignup ? (
        <>
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
                applyLoginResponse(data);
                setPendingSignup(null);
                setPendingUsername('');
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
          <GoogleLoginButton
            onNeedsUsername={(idToken) => setPendingSignup({ idToken })}
            onSuccess={(data) => applyLoginResponse(data)}
          />
          <p className="mt-4 text-xs text-gray-500 text-center">
            First time signing in? You'll be prompted to pick a username.
          </p>
        </div>
      )}
    </Modal>
  );
}
