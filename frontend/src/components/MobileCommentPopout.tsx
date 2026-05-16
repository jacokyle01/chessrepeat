import React, { useEffect, useRef, useState } from 'react';
import { CircleXIcon, MessageSquareTextIcon } from 'lucide-react';
import { useTrainerStore } from '../store/state';

/**
 * Mobile-only affordance shown during learn/recall when the current move
 * carries a comment. On phones the PGN tree (where comments normally live)
 * is hidden, so this surfaces the comment as a tab between the
 * Edit/Learn/Recall pills and the settings pill. Tapping it opens a modal
 * to read and edit the comment.
 */
const MobileCommentPopout: React.FC = () => {
  const trainingMethod = useTrainerStore((s) => s.trainingMethod);
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const selectedPath = useTrainerStore((s) => s.selectedPath) || '';
  const setCommentAt = useTrainerStore((s) => s.setCommentAt);

  const comment: string = (selectedNode as any)?.data?.comment ?? '';

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(comment);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isTraining = trainingMethod === 'learn' || trainingMethod === 'recall';

  useEffect(() => {
    if (!open) return;
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, [open]);

  if (!isTraining || !comment) return null;

  const openEditor = () => {
    setDraft(comment);
    setOpen(true);
  };

  const save = async () => {
    await setCommentAt(draft, selectedPath);
    setOpen(false);
  };

  const isDirty = draft !== comment;

  return (
    <div className="md:hidden inline-flex rounded-b-xl bg-white p-1">
      <button
        type="button"
        onClick={openEditor}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
          transition-all duration-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
        aria-label="View move comment"
        title="View move comment"
      >
        <MessageSquareTextIcon size={18} />
        Comment
      </button>

      {open && (
        <>
          <div
            className="modal-backdrop"
            style={{ zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <dialog
            open
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
                       border-none bg-white rounded-lg shadow-lg w-full max-w-md p-4"
          >
            <button
              className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-8 w-8
                         flex items-center justify-center shadow-md hover:bg-red-600"
              aria-label="Close"
              onClick={() => setOpen(false)}
              type="button"
            >
              <CircleXIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="text-gray-500 bg-gray-200 p-1 rounded">
                <MessageSquareTextIcon size={20} />
              </div>
              <span className="text-gray-800 font-semibold text-lg">Comment</span>
            </div>

            <textarea
              ref={textareaRef}
              rows={3}
              value={draft}
              placeholder="Add comment…"
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(false);
                } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  save();
                }
              }}
              className="w-full text-sm text-gray-700 rounded-md border border-gray-300 p-2
                         resize-none focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />

            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1 text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!isDirty}
                className={`text-xs font-semibold px-3 py-1 rounded transition ${
                  isDirty
                    ? 'bg-brand-blue text-white hover:brightness-110'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Save
              </button>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
};

export default MobileCommentPopout;
