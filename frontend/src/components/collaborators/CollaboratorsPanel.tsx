import { useState } from 'react';
import { XIcon, UserPlusIcon } from 'lucide-react';
import type { Collaborator, CollaboratorPermission } from '../../services/collaborators';
import '../modals/modals.css';
import './CollaboratorsPanel.css';

type Props = {
  open: boolean;
  onClose: () => void;
  outgoing: Collaborator[];
  incoming: Collaborator[];
  onAdd: (
    username: string,
    permission: CollaboratorPermission,
  ) => Promise<{ ok: boolean; error?: string }>;
  onRemove: (username: string) => Promise<void>;
  onViewRepertoire: (username: string) => void;
};

const PERMISSION_DESCRIPTIONS: Record<CollaboratorPermission, string> = {
  edit: 'Full access — add chapters, edit moves, enable/disable lines.',
  train: 'Read-only on the tree, but their training progress syncs.',
};

const PERMISSION_BADGE: Record<CollaboratorPermission, string> = {
  edit: 'collab-badge-edit',
  train: 'collab-badge-train',
};

export function CollaboratorsPanel({
  open,
  onClose,
  outgoing,
  incoming,
  onAdd,
  onRemove,
  onViewRepertoire,
}: Props) {
  const [inviteTarget, setInviteTarget] = useState('');
  const [invitePermission, setInvitePermission] = useState<CollaboratorPermission>('edit');
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await onAdd(inviteTarget, invitePermission);
    if (result.ok) {
      setAddMsg({ ok: true, text: `added ${inviteTarget} as ${invitePermission}` });
      setInviteTarget('');
    } else {
      setAddMsg({ ok: false, text: result.error ?? 'failed' });
    }
    setTimeout(() => setAddMsg(null), 2500);
  };

  return (
    <div className="modal-scrim modal-scrim-top" onClick={onClose}>
      <div className="modal-card modal-card-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card-header">
          <h2>Collaborators</h2>
          <button type="button" onClick={onClose} className="modal-close-x">
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-card-body">
          <section className="collab-section">
            <h3>Shared with me ({incoming.length})</h3>
            {incoming.length === 0 ? (
              <p className="collab-empty">Nobody has added you as a collaborator yet.</p>
            ) : (
              <ul className="collab-list">
                {incoming.map((c) => (
                  <li key={c.username} className="collab-row">
                    {c.picture ? (
                      <img
                        src={c.picture}
                        alt={c.username}
                        referrerPolicy="no-referrer"
                        className="collab-avatar"
                      />
                    ) : (
                      <div className="collab-avatar collab-avatar-blank" />
                    )}
                    <button
                      type="button"
                      onClick={() => onViewRepertoire(c.username)}
                      className="collab-open-btn"
                      title="Open their repertoire"
                    >
                      {c.username}
                    </button>
                    <span className={`collab-badge ${PERMISSION_BADGE[c.permission]}`}>
                      {c.permission}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="collab-section">
            <h3>My collaborators ({outgoing.length})</h3>
            {outgoing.length === 0 ? (
              <p className="collab-empty collab-empty-outgoing">
                Add someone below to share your repertoire with them.
              </p>
            ) : (
              <ul className="collab-list collab-list-outgoing">
                {outgoing.map((c) => (
                  <li key={c.username} className="collab-row">
                    {c.picture ? (
                      <img
                        src={c.picture}
                        alt={c.username}
                        referrerPolicy="no-referrer"
                        className="collab-avatar"
                      />
                    ) : (
                      <div className="collab-avatar collab-avatar-blank" />
                    )}
                    <span className="collab-name">{c.username}</span>
                    <span className={`collab-badge ${PERMISSION_BADGE[c.permission]}`}>
                      {c.permission}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(c.username)}
                      className="collab-remove-btn"
                      title="Remove collaborator"
                    >
                      <XIcon size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAdd} className="collab-form">
              <input
                type="text"
                value={inviteTarget}
                onChange={(e) => setInviteTarget(e.target.value)}
                placeholder="username"
                className="modal-text-input"
              />
              <div className="collab-form-row">
                <select
                  value={invitePermission}
                  onChange={(e) =>
                    setInvitePermission(e.target.value as CollaboratorPermission)
                  }
                  className="collab-permission-select"
                  aria-label="Permission"
                >
                  <option value="edit">edit</option>
                  {/* TODO: re-enable once the training-collaborator UI is built.
                      Temporarily hidden so new collaborators can only be added
                      with "edit" access as a stopgap. */}
                  {/* <option value="train">train</option> */}
                </select>
                <button type="submit" className="collab-add-btn">
                  <UserPlusIcon size={14} />
                  Add
                </button>
              </div>
              <p className="modal-hint">{PERMISSION_DESCRIPTIONS[invitePermission]}</p>
            </form>
            {addMsg && (
              <p className={`collab-result ${addMsg.ok ? 'collab-result-ok' : 'collab-result-error'}`}>
                {addMsg.text}
              </p>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
