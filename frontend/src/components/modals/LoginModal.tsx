import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { GoogleLoginButton, applyLoginResponse } from '../GoogleLoginButton';
import { useAuthStore } from '../../store/auth';
import './LoginModal.css';

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
    <Modal open={showLogin} onClose={dismiss} title="Sign in" scrimClassName="is-stacked">
      <div className="login-google">
        <GoogleLoginButton
          onNeedsUsername={(idToken) => setPendingSignup({ idToken })}
          onSuccess={(data) => applyLoginResponse(data)}
        />
        {!pendingSignup && (
          <p className="login-google-note">
            First time signing in? You'll be prompted to pick a username.
          </p>
        )}
      </div>

      {pendingSignup && (
        <div className="login-username">
          <h3>Pick a username</h3>
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
            <div className="login-username-field">
              <input
                type="text"
                autoFocus
                value={pendingUsername}
                onChange={(e) => setPendingUsername(e.target.value)}
                placeholder="username"
                aria-invalid={checkState === 'taken' || checkState === 'invalid'}
              />
              <span className="login-username-status" aria-live="polite">
                {checkState === 'pending' && (
                  <span className="login-status-pending" title="Checking…">
                    …
                  </span>
                )}
                {checkState === 'available' && (
                  <span className="login-status-available" title="Available">
                    ✓
                  </span>
                )}
                {checkState === 'taken' && (
                  <span className="login-status-error" title="Taken">
                    ✕
                  </span>
                )}
                {checkState === 'invalid' && (
                  <span className="login-status-error" title="3–20 chars, a–z 0–9 _">
                    ✕
                  </span>
                )}
              </span>
            </div>
            <p className="login-username-message">
              {checkState === 'invalid' && 'Use 3–20 chars: a–z, 0–9, underscore.'}
              {checkState === 'taken' && 'That username is taken.'}
              {checkState === 'available' && 'Username is available.'}
            </p>

            <button
              type="submit"
              disabled={!canSubmit}
              className="login-submit"
            >
              Continue
            </button>
          </form>
        </div>
      )}
    </Modal>
  );
}
