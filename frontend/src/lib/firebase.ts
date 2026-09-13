// Firebase does two things for us: authenticate the user and hand us
// an ID token, which is immediately traded for our own server session
// (POST /login) so every later request rides on the session cookie; and
// hold uploaded profile pictures in Cloud Storage. Nothing else in the
// app talks to Firebase.
//
// Config values are public by design (they identify the project, they
// don't authorise anything); the real protection is the backend
// verifying the token signature against Google's certs.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
});

export const firebaseAuth = getAuth(app);
export const firebaseStorage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
// Always show the account chooser so a user with several Google
// accounts isn't silently signed into the last one they used.
googleProvider.setCustomParameters({ prompt: 'select_account' });
