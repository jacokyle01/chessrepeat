import { SiDiscord, SiGithub } from 'react-icons/si';
import { LogIn, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useTrainerStore, type Peer } from '../store/state';

interface Props {
  // Other users currently connected to the same repertoire. Only meaningful
  // on Chessrepeat; Login omits this.
  connectedUsers?: Peer[];
  incomingCollaboratorsCount?: number;
}

export function Header({ connectedUsers, incomingCollaboratorsCount = 0 }: Props) {
  const authUser = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const openLogin = useAuthStore((s) => s.openLogin);
  const showLogin = useAuthStore((s) => s.showLogin);

  const setConnectedUsers = useTrainerStore().setConnectedUsers;
  const peers = connectedUsers?.filter((u) => u.username !== authUser?.username) ?? [];
  const showSignIn = !showLogin;

  return (
    <div id="header">
      <div className="logo-wrap">
        <span>chess</span>
        <span className="accent">repeat</span>
      </div>

      {/* Identity sits next to the wordmark; the links are pushed right. Who
          you are and the control that changes it live in one recessed track,
          the same treatment the peer avatars and the board's segmented
          controls get. */}
      <div className="header-auth">
        {authUser ? (
          <div className="header-identity">
            <span className="header-user">
              {authUser.picture ? (
                <img
                  src={authUser.picture}
                  alt={authUser.username ?? 'profile'}
                  referrerPolicy="no-referrer"
                  className="header-avatar"
                />
              ) : (
                <User />
              )}
              <span className="header-username">{authUser.username ?? 'Unnamed'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearAuth();
                //TODO we don't need to reload but this make it easy ..
                location.reload();
              }}
              title="Sign out"
              className="header-link"
            >
              <LogOut />
            </button>
          </div>
        ) : (
          showSignIn && (
            <div className="header-identity">
              <button
                type="button"
                onClick={openLogin}
                className="header-link header-signin"
                title="Sign in"
              >
                <span>sign in</span>
                <LogIn />
              </button>
            </div>
          )
        )}

        {/* Live view: just the faces of the people on this repertoire now.
            Sits with the identity on the left rather than in the right-hand
            link cluster — it's about who's here, not somewhere to go. */}
        {peers.length > 0 && (
          <div className="header-peers" title="Here now">
            {peers.map((u) => {
              // train collaborators get a light-blue ring; everyone else
              // (owner, edit) gets dark blue. Owner appears as a peer
              // only when a collaborator is viewing — same color as edit
              // since they have full access too.
              const ring = u.permission === 'train' ? 'header-peer-train' : 'header-peer-edit';
              return (
                <img
                  key={u.username}
                  src={u.picture}
                  alt={u.username}
                  title={`${u.username} (${u.permission})`}
                  referrerPolicy="no-referrer"
                  className={`header-peer ${ring}`}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="header-actions">
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
      </div>
    </div>
  );
}
