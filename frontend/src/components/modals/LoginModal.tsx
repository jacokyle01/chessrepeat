import { useState } from 'react';
import { Modal } from './Modal';
import { GoogleLoginButton, applyLoginResponse } from '../GoogleLoginButton';
import { useAuthStore } from '../../store/auth';

type Visibility = 'public' | 'private' | 'whitelist';

export function LoginModal() {
  const showLogin = useAuthStore((s) => s.showLogin);
  const closeLogin = useAuthStore((s) => s.closeLogin);

  const [pendingSignup, setPendingSignup] = useState<{ idToken: string } | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');

  const dismiss = () => {
    setPendingSignup(null);
    setPendingUsername('');
    setVisibility('private');
    closeLogin();
  };

  return (
    <Modal open={showLogin} onClose={dismiss} title="Sign in">
      <div className="flex flex-col items-center">
        <GoogleLoginButton
          onNeedsUsername={(idToken) => setPendingSignup({ idToken })}
          onSuccess={(data) => applyLoginResponse(data)}
        />
        {!pendingSignup && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            First time signing in? You'll be prompted to pick a username.
          </p>
        )}
      </div>

      {pendingSignup && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Pick a username</h3>
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
                  body: JSON.stringify({
                    idToken: pendingSignup.idToken,
                    username,
                    // placeholder: server doesn't consume this yet
                    repertoireVisibility: visibility,
                  }),
                });
                if (!res.ok) {
                  console.error('signup failed', res.status, await res.text());
                  return;
                }
                const data = await res.json();
                applyLoginResponse(data);
                setPendingSignup(null);
                setPendingUsername('');
                setVisibility('private');
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
              className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm"
              placeholder="username"
            />

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Repertoire visibility
              </label>
              <div className="flex flex-col gap-1.5">
                {(['public', 'private', 'whitelist'] as Visibility[]).map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="repertoire-visibility"
                      value={opt}
                      checked={visibility === opt}
                      onChange={() => setVisibility(opt)}
                    />
                    <span className="capitalize">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-800 text-white text-sm font-semibold py-2 rounded hover:bg-slate-700"
            >
              Continue
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
