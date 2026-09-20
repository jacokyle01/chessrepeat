import React from 'react';
import ReactDOM from 'react-dom/client';
// Before App: imports are evaluated in source order, so importing App first
// pulled every component stylesheet in ahead of these and inverted the
// cascade — base.css's reset (`[type=button] { background-color: transparent }`
// among others) then beat any same-specificity component rule instead of
// being the floor it's written to be.
import './css/base.css';
import './css/style.css';
import './css/theme.css';
import App from './App';
import { useTrainerStore } from './store/state';
import { useAuthStore } from './store/auth';

// The Playwright suite (frontend/e2e) drives the app through the real UI
// but needs to peek at store state for assertions the DOM can't make
// cheaply (which path is selected, what a card's due date is). Only
// exposed when the dev server is started with VITE_E2E=1.
if (import.meta.env.VITE_E2E) {
  (window as any).__chessrepeat = { trainer: useTrainerStore, auth: useAuthStore };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);
