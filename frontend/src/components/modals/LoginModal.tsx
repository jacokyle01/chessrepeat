import { useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import { Modal } from './Modal';
import { firebaseAuth, googleProvider } from '../../lib/firebase';
import { applyLoginResponse, exchangeIdToken } from '../../services/auth';
import { AvatarUploadError, deleteAvatar, uploadAvatar } from '../../services/avatar';
import { useAuthStore } from '../../store/auth';
import './LoginModal.css';

const API_URL = import.meta.env.VITE_API_URL;

type CheckState = 'idle' | 'pending' | 'available' | 'taken' | 'invalid';
type Mode = 'signin' | 'signup' | 'reset';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD = 8;

// Turns a Firebase auth error into something a person can act on.
// Returns null for "the user closed the popup" style non-errors.
function describeFirebaseError(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists.';
    case 'auth/weak-password':
      return `Use at least ${MIN_PASSWORD} characters.`;
    case 'auth/account-exists-with-different-credential':
      return 'That email is linked to a different sign-in method.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup.';
    default:
      console.error('firebase auth error', err);
      return 'Something went wrong. Try again.';
  }
}

export function LoginModal() {
  const showLogin = useAuthStore((s) => s.showLogin);
  const closeLogin = useAuthStore((s) => s.closeLogin);

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Set once Firebase has authenticated the user but the backend wants
  // a username before it creates the row. The ID token is re-read from
  // the Firebase user at submit time so it can't expire underneath us.
  const [pendingUser, setPendingUser] = useState<FirebaseUser | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');
  // URL of a picture the user uploaded during this signup. Empty means
  // "none uploaded": the backend then falls back to the provider's photo
  // (Google supplies one; email/password doesn't), which is also what the
  // preview shows.
  const [uploadedPicture, setUploadedPicture] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pictureBroken, setPictureBroken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const reset = () => {
    setMode('signin');
    setEmail('');
    setPassword('');
    setBusy(false);
    setError(null);
    setResetSent(false);
    setPendingUser(null);
    setPendingUsername('');
    setUploadedPicture('');
    setUploading(false);
    setPictureBroken(false);
    setCheckState('idle');
  };

  const dismiss = () => {
    reset();
    closeLogin();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResetSent(false);
  };

  // Common tail of every Firebase sign-in: swap the ID token for a
  // server session, or park the Firebase user until a username is picked.
  const finishSignIn = async (user: FirebaseUser) => {
    const idToken = await user.getIdToken();
    const result = await exchangeIdToken(idToken);
    switch (result.kind) {
      case 'ok':
        applyLoginResponse(result.data);
        reset();
        return;
      case 'needsUsername':
        setPendingUser(user);
        setUploadedPicture('');
        setPictureBroken(false);
        return;
      case 'usernameTaken':
        // can't happen without a username in the body; treat as generic
        setError('Login failed. Try again.');
        return;
      case 'error':
        setError(result.message);
        return;
    }
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const msg = describeFirebaseError(err);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = () =>
    run(async () => {
      const cred = await signInWithPopup(firebaseAuth, googleProvider);
      await finishSignIn(cred.user);
    });

  const submitEmailForm = (e: React.FormEvent) => {
    e.preventDefault();
    const addr = email.trim();
    if (mode === 'reset') {
      return run(async () => {
        await sendPasswordResetEmail(firebaseAuth, addr);
        setResetSent(true);
      });
    }
    if (password.length < MIN_PASSWORD && mode === 'signup') {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    return run(async () => {
      const cred =
        mode === 'signup'
          ? await createUserWithEmailAndPassword(firebaseAuth, addr, password)
          : await signInWithEmailAndPassword(firebaseAuth, addr, password);
      if (mode === 'signup') {
        // best-effort; the backend doesn't gate on verification today
        sendEmailVerification(cred.user).catch((err) => console.warn('verification email failed', err));
      }
      await finishSignIn(cred.user);
    });
  };

  const submitUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkState !== 'available' || !pendingUser) return;
    const username = pendingUsername.trim().toLowerCase();
    return run(async () => {
      const idToken = await pendingUser.getIdToken();
      const result = await exchangeIdToken(idToken, { username, picture: uploadedPicture });
      switch (result.kind) {
        case 'ok':
          applyLoginResponse(result.data);
          reset();
          return;
        case 'usernameTaken':
          setCheckState('taken');
          return;
        case 'needsUsername':
          setError('Login failed. Try again.');
          return;
        case 'error':
          setError(result.message);
          return;
      }
    });
  };

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // allow re-selecting the same file after a failure
    e.target.value = '';
    if (!file || !pendingUser || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAvatar(pendingUser, file);
      setUploadedPicture(url);
      setPictureBroken(false);
    } catch (err) {
      // Every failure is non-fatal: signup can proceed without a picture.
      // The quota case is the one we specifically want to surface
      // honestly rather than as a generic "try again".
      setError(err instanceof AvatarUploadError ? err.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePicture = () => {
    if (!pendingUser || uploading) return;
    setUploadedPicture('');
    setPictureBroken(false);
    void deleteAvatar(pendingUser);
  };

  const title = pendingUser ? 'Set up your profile' : mode === 'reset' ? 'Reset password' : 'Welcome';

  // what the preview shows: the upload if there is one, else Google's photo
  const previewUrl = uploadedPicture || pendingUser?.photoURL || '';
  const initial = (pendingUsername.trim()[0] ?? pendingUser?.email?.[0] ?? '?').toUpperCase();

  return (
    <Modal open={showLogin} onClose={dismiss} title={title} scrimClassName="is-stacked">
      {!pendingUser && (
        <div className="login-body">
          {mode !== 'reset' && (
            <>
              <div className="login-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signin'}
                  className={`login-tab${mode === 'signin' ? ' is-active' : ''}`}
                  onClick={() => switchMode('signin')}
                >
                  Log in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signup'}
                  className={`login-tab${mode === 'signup' ? ' is-active' : ''}`}
                  onClick={() => switchMode('signup')}
                >
                  Sign up
                </button>
              </div>
              <button type="button" className="login-google-btn" onClick={signInWithGoogle} disabled={busy}>
                <GoogleMark />
                <span>Continue with Google</span>
              </button>
              <div className="login-divider">
                <span>or</span>
              </div>
            </>
          )}

          <form onSubmit={submitEmailForm} className="login-form">
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
            {mode !== 'reset' && (
              <input
                type="password"
                name="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder={mode === 'signup' ? `password (${MIN_PASSWORD}+ characters)` : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
                required
                disabled={busy}
              />
            )}

            <p className={`login-message${error ? ' is-error' : ''}`} role="alert">
              {error}
              {!error && resetSent && 'If that address has an account, a reset link is on its way.'}
            </p>

            <button type="submit" className="login-submit" disabled={busy}>
              {mode === 'signup' ? 'Sign up' : mode === 'reset' ? 'Send reset link' : 'Log in'}
            </button>
          </form>

          <div className="login-links">
            {mode === 'signin' && (
              <button type="button" className="login-link" onClick={() => switchMode('reset')}>
                Forgot password?
              </button>
            )}
            {mode === 'reset' && (
              <button type="button" className="login-link" onClick={() => switchMode('signin')}>
                Back to log in
              </button>
            )}
          </div>

          {mode === 'signup' && <p className="login-note">You'll pick a username on the next step.</p>}
        </div>
      )}

      {pendingUser && (
        <div className="login-username">
          <form onSubmit={submitUsername}>
            <div className="login-profile">
              <div className="login-avatar" aria-hidden="true">
                {previewUrl && !pictureBroken ? (
                  <img
                    src={previewUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setPictureBroken(true)}
                  />
                ) : (
                  <span>{initial}</span>
                )}
                {uploading && <span className="login-avatar-busy" />}
              </div>
              <div className="login-profile-fields">
                <label className="login-label" htmlFor="login-username">
                  Username
                </label>
                <div className="login-username-field">
                  <input
                    id="login-username"
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={pendingUsername}
                    onChange={(e) => setPendingUsername(e.target.value)}
                    placeholder="username"
                    aria-invalid={checkState === 'taken' || checkState === 'invalid'}
                    disabled={busy}
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
                <span className="login-label">
                  Profile picture <span className="login-optional">(optional)</span>
                </span>
                <div className="login-picture-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={onFileChosen}
                    hidden
                  />
                  <button
                    type="button"
                    className="login-secondary-btn"
                    onClick={pickFile}
                    disabled={busy || uploading}
                  >
                    {uploading ? 'Uploading…' : uploadedPicture ? 'Change photo' : 'Upload photo'}
                  </button>
                  {uploadedPicture && (
                    <button
                      type="button"
                      className="login-link"
                      onClick={removePicture}
                      disabled={busy || uploading}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <p
              className={`login-message${error || checkState === 'taken' || checkState === 'invalid' ? ' is-error' : ''}`}
            >
              {error}
              {!error && checkState === 'invalid' && 'Use 3–20 chars: a–z, 0–9, underscore.'}
              {!error && checkState === 'taken' && 'That username is taken.'}
              {!error && checkState === 'available' && 'Username is available.'}
            </p>

            <button
              type="submit"
              disabled={checkState !== 'available' || busy || uploading}
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

// Google's "G", per their sign-in branding guidelines. Inline so it
// picks up nothing from the page palette.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}