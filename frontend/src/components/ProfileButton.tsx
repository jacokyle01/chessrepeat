// TODO different view for logged in / logged out

// import React, { useEffect, useRef, useState } from 'react';
// import { GoogleLogin, googleLogout } from '@react-oauth/google';
// import { User, UserX, LogOut } from 'lucide-react';
// import { useAuth } from '../contexts/AuthContext';
// import { createBackendSession } from '../api/session';

// export function ProfileButton() {
//   const user = useAuth((s) => s.user);
//   const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
//   const setAuthFromIdToken = useAuthStore((s) => s.setAuthFromIdToken);
//   const clearAuth = useAuthStore((s) => s.clearAuth);

//   const [menuOpen, setMenuOpen] = useState(false);
//   const menuRef = useRef<HTMLDivElement | null>(null);

//   // Close menu on outside click
//   useEffect(() => {
//     if (!menuOpen) return;
//     const onDown = (e: MouseEvent) => {
//       if (!menuRef.current) return;
//       if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
//     };
//     window.addEventListener('mousedown', onDown);
//     return () => window.removeEventListener('mousedown', onDown);
//   }, [menuOpen]);

//   const signOut = () => {
//     clearAuth();
//     googleLogout(); // clears Google session selection state in this tab
//     setMenuOpen(false);
//   };

//   // ---- Signed OUT view ----
//   if (!isAuthenticated) {
//     return (
//       <div className="flex items-center gap-2 mr-5">
//         <GoogleLogin
//           onSuccess={async (cred) => {
//             if (cred.credential) {
//               setAuthFromIdToken(cred.credential);
//               await createBackendSession(cred.credential);
//             }
//           }}
//           onError={() => console.error('Google Login Failed')}
//           useOneTap={false}
//         />
//         <UserX className="w-8 h-8 text-gray-500" title="Not signed in" />
//       </div>
//     );
//   }

//   // ---- Signed IN view ----
//   return (
//     <div className="relative flex items-center gap-2 mr-5" ref={menuRef}>
//       <span className="text-base text-gray-600 max-w-[180px] truncate hidden sm:block" title={user?.name}>
//         {user?.name ?? 'Signed in'}
//       </span>

//       <button
//         type="button"
//         className="hover:text-black transition"
//         title="Profile"
//         onClick={() => setMenuOpen((v) => !v)}
//       >
//         <User className="w-8 h-8" />
//       </button>

//       {menuOpen && (
//         <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white shadow-lg">
//           <div className="px-4 py-3 border-b border-slate-100">
//             <div className="text-sm font-semibold text-slate-900 truncate">{user?.name ?? 'Signed in'}</div>
//             <div className="text-xs text-slate-500 truncate">{user?.email ?? ''}</div>
//           </div>

//           <button
//             type="button"
//             onClick={signOut}
//             className="w-full px-4 py-3 flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50"
//           >
//             <LogOut className="w-4 h-4" />
//             Sign out
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// frontend/src/examples/SignInComponent.tsx
// Example sign-in component with sync status

import React from 'react';
import { useAuth } from '../contexts/AuthContext';

export function ProfileButton() {
  const { user, isAuthenticated, isLoading, syncStatus, signInWithGoogle, signOut, forceSync } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center' }}>
        {/* <span className='font-md'>Sign in to sync your repertoire</span> */}
        {/* <p>Your data works offline. Sign in to sync across devices.</p> */}

        <button
          onClick={signInWithGoogle}
          style={{
            fontSize: '1rem',
            background: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: '1rem auto',
          }}
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            style={{ width: '20px', height: '20px' }}
          />
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid #ddd',
        padding: '1rem',
        borderRadius: '4px',
        marginBottom: '1rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{user?.email}</strong>
          <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            {syncStatus.state === 'syncing' && '🔄 Syncing...'}
            {/* {syncStatus.state === 'synced' && `✅ Synced (${formatTime(syncStatus.lastSync)})`} */}
            {syncStatus.state === 'error' && `❌ Error: ${syncStatus.error}`}
            {syncStatus.state === 'paused' && '⏸ Sync paused'}
          </div>
          {syncStatus.changesReceived || syncStatus.changesSent ? (
            <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
              ↓ {syncStatus.changesReceived || 0} • ↑ {syncStatus.changesSent || 0}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={forceSync} style={buttonStyle} disabled={syncStatus.state === 'syncing'}>
            Force Sync
          </button>

          <button onClick={signOut} style={{ ...buttonStyle, background: '#dc3545' }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '0.875rem',
};
