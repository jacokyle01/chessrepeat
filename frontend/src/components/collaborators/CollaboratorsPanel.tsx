import { useState } from 'react';
import { XIcon, UserPlusIcon, BookOpen } from 'lucide-react';
import type { Collaborator } from '../../services/collaborators';

type Props = {
  open: boolean;
  onClose: () => void;
  outgoing: Collaborator[];
  incoming: Collaborator[];
  onAdd: (username: string) => Promise<{ ok: boolean; error?: string }>;
  onRemove: (username: string) => Promise<void>;
  onViewRepertoire: (username: string) => void;
  onViewMine?: () => void;
};

export function CollaboratorsPanel({
  open,
  onClose,
  outgoing,
  incoming,
  onAdd,
  onRemove,
  onViewRepertoire,
  onViewMine,
}: Props) {
  const [inviteTarget, setInviteTarget] = useState('');
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await onAdd(inviteTarget);
    if (result.ok) {
      setAddMsg({ ok: true, text: `added ${inviteTarget}` });
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
                      className="flex-1 text-left text-sm font-medium text-blue-700 hover:underline"
                      title="Open their repertoire"
                    >
                      {c.username}
                    </button>
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

            <form onSubmit={handleAdd} className="flex items-center gap-2">
              <input
                type="text"
                value={inviteTarget}
                onChange={(e) => setInviteTarget(e.target.value)}
                placeholder="username"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 bg-slate-800 text-white text-sm font-semibold px-3 py-2 rounded hover:bg-slate-700"
              >
                <UserPlusIcon size={14} />
                Add
              </button>
            </form>
            {addMsg && (
              <p className={`mt-2 text-xs ${addMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                {addMsg.text}
              </p>
            )}
          </section>

          {onViewMine && (
            <button
              type="button"
              onClick={onViewMine}
              className="w-full inline-flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-3 py-2"
            >
              <BookOpen size={14} />
              View my repertoire
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
