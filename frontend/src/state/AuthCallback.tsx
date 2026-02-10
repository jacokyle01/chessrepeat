// frontend/src/pages/AuthCallback.tsx
// Google OAuth callback handler

import React, { useEffect } from 'react';

const AuthCallback: React.FC = () => {
  useEffect(() => {
    // Extract authorization code from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    
    if (error) {
      // Send error to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_ERROR', error },
          window.location.origin
        );
      }
    } else if (code) {
      // Send code to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_SUCCESS', code },
          window.location.origin
        );
      }
    }
  }, []);
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Completing authentication...</h2>
        <p>You can close this window.</p>
      </div>
    </div>
  );
};

export default AuthCallback;