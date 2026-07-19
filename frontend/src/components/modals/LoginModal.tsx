import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { GoogleLoginButton, applyLoginResponse } from '../GoogleLoginButton';
import { useAuthStore } from '../../store/auth';

const API_URL = import.meta.env.VITE_API_URL;

type CheckState = 'idle' | 'pending' | 'available' | 'taken' | 'invalid';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function LoginModal() {
  const showLogin = useAuthStore((s) => s.showLogin);
  const closeLogin = useAuthStore((s) => s.closeLogin);

  const [pendingSignup, setPendingSignup] = useState<{ idToken: string } | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');

  // Debounced availability check. Empty input → idle; locally-invalid
  // input → invalid (no request); otherwise wait 500ms then hit the
  // backend. A request id guards against an out-of-order response
  // overwriting a newer keystroke's state.
  useEffect(() => {
    const trimmed = pendingUsername.trim().toLowerCase();
    if (!trimmed) {
      setCheckState('idle');
      return;
    }
    if (!USERNAME_RE.test(trimmed)) {
      setCheckState('invalid');
      return;
    }
    setCheckState('pending');
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/username/check?username=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        // guard: only commit if the input still matches what we asked about
        if (pendingUsername.trim().toLowerCase() !== trimmed) return;
        if (data.available) setCheckState('available');
        else if (data.reason === 'invalid') setCheckState('invalid');
        else setCheckState('taken');
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          console.warn('username check failed', err);
        }
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [pendingUsername]);

  const dismiss = () => {
    setPendingSignup(null);
    setPendingUsername('');
    setCheckState('idle');
    closeLogin();
  };

  const canSubmit = checkState === 'available';

  return (
    <Modal open={showLogin} onClose={dismiss} title="Sign in" zClassName="z-[1100]">
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
              if (!canSubmit) return;
              const username = pendingUsername.trim().toLowerCase();
              try {
                const res = await fetch(`${API_URL}/login`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    idToken: pendingSignup.idToken,
                    username,
                  }),
                });
                if (res.status === 409) {
                  setCheckState('taken');
                  return;
                }
                if (!res.ok) {
                  console.error('signup failed', res.status, await res.text());
                  return;
                }
                const data = await res.json();
                applyLoginResponse(data);
                setPendingSignup(null);
                setPendingUsername('');
                setCheckState('idle');
              } catch (err) {
                console.error('signup request failed', err);
              }
            }}
          >
            <div className="relative mb-1">
              <input
                type="text"
                autoFocus
                value={pendingUsername}
                onChange={(e) => setPendingUsername(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 pr-9 text-sm"
                placeholder="username"
                aria-invalid={checkState === 'taken' || checkState === 'invalid'}
              />
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm leading-none"
                aria-live="polite"
              >
                {checkState === 'pending' && (
                  <span className="text-gray-400" title="Checking…">
                    …
                  </span>
                )}
                {checkState === 'available' && (
                  <span className="text-green-600" title="Available">
                    ✓
                  </span>
                )}
                {checkState === 'taken' && (
                  <span className="text-red-600" title="Taken">
                    ✕
                  </span>
                )}
                {checkState === 'invalid' && (
                  <span className="text-red-600" title="3–20 chars, a–z 0–9 _">
                    ✕
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4 h-4">
              {checkState === 'invalid' && 'Use 3–20 chars: a–z, 0–9, underscore.'}
              {checkState === 'taken' && 'That username is taken.'}
              {checkState === 'available' && 'Username is available.'}
            </p>

            <button
              type="submit"
              disabled={!canSubmit}
              className={
                canSubmit
                  ? 'w-full bg-emerald-600 text-white text-sm font-semibold py-2 rounded hover:bg-emerald-500 ring-2 ring-emerald-300'
                  : 'w-full bg-slate-300 text-slate-500 text-sm font-semibold py-2 rounded cursor-not-allowed'
              }
            >
              Continue
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
