import { useState } from 'react';
import { XIcon, UserPlusIcon } from 'lucide-react';
import type { Collaborator, CollaboratorPermission } from '../../services/collaborators';

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

// Badge swatches mirror the avatar-ring colors in Header.tsx so the
// panel and the live presence list stay visually consistent.
const PERMISSION_BADGE: Record<CollaboratorPermission, string> = {
  edit: 'bg-brand-blue text-white',
  train: 'bg-brand-blue-light text-blue-900',
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
    <div
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-gray-900">Collaborators</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-5">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Shared with me ({incoming.length})
            </h3>
            {incoming.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nobody has added you as a collaborator yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
                {incoming.map((c) => (
                  <li key={c.username} className="flex items-center gap-2 px-3 py-2">
                    {c.picture ? (
                      <img
                        src={c.picture}
                        alt={c.username}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 rounded-full"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-gray-200" />
                    )}
                    <button
                      type="button"
                      onClick={() => onViewRepertoire(c.username)}
                      className="flex-1 text-left text-sm font-medium text-brand-blue hover:underline"
                      title="Open their repertoire"
                    >
                      {c.username}
                    </button>
                    <span
                      className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${PERMISSION_BADGE[c.permission]}`}
                    >
                      {c.permission}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              My collaborators ({outgoing.length})
            </h3>
            {outgoing.length === 0 ? (
              <p className="text-sm text-gray-500 mb-2">
                Add someone below to share your repertoire with them.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md mb-3">
                {outgoing.map((c) => (
                  <li key={c.username} className="flex items-center gap-2 px-3 py-2">
                    {c.picture ? (
                      <img
                        src={c.picture}
                        alt={c.username}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 rounded-full"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-gray-200" />
                    )}
                    <span className="flex-1 text-sm font-medium text-gray-800">
                      {c.username}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${PERMISSION_BADGE[c.permission]}`}
                    >
                      {c.permission}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(c.username)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"
                      title="Remove collaborator"
                    >
                      <XIcon size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAdd} className="space-y-2">
              <input
                type="text"
                value={inviteTarget}
                onChange={(e) => setInviteTarget(e.target.value)}
                placeholder="username"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <select
                  value={invitePermission}
                  onChange={(e) =>
                    setInvitePermission(e.target.value as CollaboratorPermission)
                  }
                  className="flex-1 border border-gray-300 rounded px-2 py-2 text-sm bg-white"
                  aria-label="Permission"
                >
                  <option value="edit">edit</option>
                  {/* TODO: re-enable once the training-collaborator UI is built.
                      Temporarily hidden so new collaborators can only be added
                      with "edit" access as a stopgap. */}
                  {/* <option value="train">train</option> */}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded hover:bg-slate-700 whitespace-nowrap"
                >
                  <UserPlusIcon size={14} />
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {PERMISSION_DESCRIPTIONS[invitePermission]}
              </p>
            </form>
            {addMsg && (
              <p className={`mt-2 text-xs ${addMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                {addMsg.text}
              </p>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
