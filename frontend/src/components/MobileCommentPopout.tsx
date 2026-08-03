import React, { useEffect, useRef, useState } from 'react';
import { CircleXIcon, MessageSquareShare, MessageSquareTextIcon } from 'lucide-react';
import { useTrainerStore, MAX_COMMENT_CHARS } from '../store/state';
import './modals/modals.css';
import './MobileCommentPopout.css';

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
    <div className="control-tab comment-popout-tab">
      <button
        id="comment-popout-btn"
        type="button"
        onClick={openEditor}
        className="control-tab-btn"
        aria-label="View move comment"
        title="View move comment"
      >
        <MessageSquareShare size={18} />
        Comment
      </button>

      {open && (
        <>
          <div className="modal-backdrop modal-backdrop-settings" onClick={() => setOpen(false)} />
          <dialog open className="modal-dialog comment-popout-dialog">
            <button
              className="modal-close-puck"
              aria-label="Close"
              onClick={() => setOpen(false)}
              type="button"
            >
              <CircleXIcon />
            </button>

            <div className="comment-popout-header">
              <div className="comment-popout-icon">
                <MessageSquareTextIcon size={20} />
              </div>
              <span className="comment-popout-title">Comment</span>
            </div>

            <textarea
              ref={textareaRef}
              rows={3}
              value={draft}
              maxLength={MAX_COMMENT_CHARS}
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
              className="comment-popout-textarea"
            />

            <div className="comment-popout-actions">
              <button type="button" onClick={() => setOpen(false)} className="comment-popout-cancel">
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!isDirty}
                className="comment-popout-save"
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
