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
import { CloudAlert, LucideLogOut } from 'lucide-react';

export function ProfileButton() {
  const { user, isAuthenticated, isLoading, signInWithGoogle, signOut } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center py-2 text-sm text-gray-500">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-row items-end px-10">
        <button
          onClick={signInWithGoogle}
          className="bg-white mx-auto mt-3 inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 hover:shadow active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
          <span>Sign in with Google</span>
        </button>

        {/* optional helper text (keeps structure simple) */}
        {/* <p className="mt-2 text-xs text-gray-500">Sign in to sync across devices.</p> */}
      </div>
    );
  }

  //TODO more consistent padding 
  return (
    <div>
      <div className="flex items-center gap-2 rounded-md bg-white p-1 my-1 shadow-sm ring-1 ring-gray-200">
        <div className="min-w-0">
          <strong className="block truncate text-sm text-gray-900">{user?.name}</strong>
        </div>

        <img
          src={user?.picture}
          alt="profile picture"
          width={25}
          height={25}
          className="ml-auto h-7 w-7 rounded-full rounded-md ring-gray-200"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={signOut}
            className="inline-flex items-center justify-center rounded-md bg-gray-600 p-2 text-white shadow-sm transition hover:bg-red-600 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Sign out"
            title="Sign out"
          >
            <LucideLogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
