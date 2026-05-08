import { SiDiscord, SiGithub } from 'react-icons/si';
import { Bug, Globe, LogIn, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import type { Peer } from '../store/state';

interface Props {
  // Other users currently connected to the same repertoire. Only meaningful
  // on Chessrepeat; Login omits this.
  connectedUsers?: Peer[];
  incomingCollaboratorsCount?: number;
  onOpenCollaborators?: () => void;
}

export function Header({ connectedUsers, incomingCollaboratorsCount = 0, onOpenCollaborators }: Props) {
  const authUser = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const openLogin = useAuthStore((s) => s.openLogin);
  const showLogin = useAuthStore((s) => s.showLogin);

  const peers = connectedUsers?.filter((u) => u.username !== authUser?.username) ?? [];
  const showSignIn = !showLogin;

  return (
    <div id="header" className="flex items-end pb-1">
      <div className="logo-wrap">
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

      {authUser && onOpenCollaborators && (
        <button
          type="button"
          onClick={onOpenCollaborators}
          title="Collaborators"
          className="header-link relative"
        >
          <span>collaborators</span>
          <Globe />
        </button>
      )}

      <div className="ml-auto flex items-end gap-3">
        {peers.length > 0 && (
          <div className="flex items-end -space-x-1.5">
            {peers.map((u) => {
              // train collaborators get a light-blue ring; everyone else
              // (owner, edit) gets dark blue. Owner appears as a peer
              // only when a collaborator is viewing — same color as edit
              // since they have full access too.
              const ring = u.permission === 'train' ? 'ring-blue-300' : 'ring-blue-700';
              return (
                <img
                  key={u.username}
                  src={u.picture}
                  alt={u.username}
                  title={`${u.username} (${u.permission})`}
                  referrerPolicy="no-referrer"
                  className={`h-6 w-6 rounded-full ring-2 ${ring}`}
                />
              );
            })}
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
            <button type="button" onClick={() => clearAuth()} title="Sign out" className="header-link">
              <LogOut />
            </button>
          </>
        ) : (
          showSignIn && (
            <button type="button" onClick={openLogin} className="header-link" title="Sign in">
              <span>sign in</span>
              <LogIn />
            </button>
          )
        )}
      </div>
    </div>
  );
}
