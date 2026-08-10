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
import { GoogleOAuthProvider } from "@react-oauth/google";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  // </React.StrictMode>
);
