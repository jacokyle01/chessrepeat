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
