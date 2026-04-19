import { SiDiscord, SiGithub } from 'react-icons/si';
import { Bug, LogIn, LogOut, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../state/auth';
import type { Peer } from '../state/state';

interface Props {
  // Other users currently connected to the same repertoire. Only meaningful
  // on Chessrepeat; Login omits this.
  connectedUsers?: Peer[];
}

export function Header({ connectedUsers }: Props) {
  const authUser = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();

  const peers = connectedUsers?.filter((u) => u.userId !== authUser?.sub) ?? [];
  const showSignIn = location.pathname !== '/login';

  const goToLogin = () => {
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div id="header" className="flex items-end pb-1">
      <div className="logo-wrap flex items-end">
        <img src="/logo.png" alt="Logo" />
        <span>chess</span>
        <span className="accent">repeat</span>
      </div>

      <a
        href="https://discord.gg/xhjra9W6Bh"
        target="_blank"
        rel="noopener noreferrer"
        title="Join our Discord"
        className="header-link"
      >
        <span>join discord</span>
        <SiDiscord />
      </a>

      <a
        href="https://github.com/jacokyle01/chessrepeat"
        target="_blank"
        rel="noopener noreferrer"
        title="View on GitHub"
        className="header-link"
      >
        <span>view github</span>
        <SiGithub />
      </a>

      <a
        href="mailto:jacokyle01@gmail.com?subject=Bug Report | chessrepeat"
        title="Report a Bug"
        className="header-link"
      >
        <span>report bug</span>
        <Bug />
      </a>

      <div className="ml-auto flex items-end gap-3">
        {peers.length > 0 && (
          <div className="flex items-end -space-x-1.5">
            {peers.map((u) => (
              <img
                key={u.userId}
                src={u.picture}
                alt={u.username}
                title={u.username}
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-full ring-2 ring-white"
              />
            ))}
          </div>
        )}

        {authUser ? (
          <>
            <span className="flex items-end gap-2">
              {authUser.picture ? (
                <img
                  src={authUser.picture}
                  alt={authUser.username ?? 'profile'}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-md"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
              <span className="text-sm">{authUser.username ?? 'Unnamed'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearAuth();
                navigate('/');
              }}
              title="Sign out"
              className="header-link"
            >
              <LogOut />
            </button>
          </>
        ) : (
          showSignIn && (
            <button
              type="button"
              onClick={goToLogin}
              className="header-link"
              title="Sign in"
            >
              <span>sign in</span>
              <LogIn />
            </button>
          )
        )}
      </div>
    </div>
  );
}
