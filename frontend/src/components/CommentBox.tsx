import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTrainerStore } from '../state/state';

// Only the comment CONTENT scrolls; header + buttons stay fixed.
export const CommentBox = () => {
  const chapter = useTrainerStore((s) => s.repertoire[s.repertoireIndex]);
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const path = useTrainerStore((s) => s.selectedPath);
  const setCommentAt = useTrainerStore((s) => s.setCommentAt);

  const currentComment = useMemo(() => {
    const c = (selectedNode as any)?.data?.comment;
    return typeof c === 'string' ? c : '';
  }, [selectedNode]);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentComment);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing) setDraft(currentComment);
  }, [currentComment, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const canEdit = !!chapter && !!selectedNode && typeof path === 'string';

  const onStartEdit = () => {
    if (!canEdit) return;
    setDraft(currentComment);
    setIsEditing(true);
  };

  const onCancel = () => {
    setDraft(currentComment);
    setIsEditing(false);
  };

  const onSave = async () => {
    if (!canEdit) return;
    await setCommentAt(draft, path);
    setIsEditing(false);
  };

  const hasChanges = draft !== currentComment;

  return (
    // ✅ h-full + min-h-0 are required so the inner scroll area can actually scroll
    <div className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {/* Header (never scrolls) */}
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Comment</div>

          {!isEditing ? (
            <button
              type="button"
              onClick={onStartEdit}
              disabled={!canEdit}
              className="rounded-lg px-2 py-1 text-xs font-medium
                         text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Edit comment
            </button>
          ) : null}
        </div>
      </div>

      {/* ✅ Scrollable body ONLY */}
      <div className="mt-2 flex-1 min-h-0 overflow-y-auto rounded-lg bg-gray-50 p-2 text-sm text-gray-900 break-words">
        {!isEditing ? (
          currentComment.trim() ? (
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{currentComment}</p>
          ) : (
            <span className="italic text-gray-400">No comment yet.</span>
          )
        ) : (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // Fill the scroll area; let textarea scroll internally if it exceeds
            className="h-full w-full resize-none rounded-lg border border-gray-200 bg-white p-2 text-sm
                       outline-none focus:ring-2 focus:ring-blue-500 break-words"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                onSave();
              }
            }}
          />
        )}
      </div>

      {/* Footer/actions (never scrolls) */}
      {isEditing ? (
        <div className="mt-2 shrink-0">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={!hasChanges}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white
                         hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
              title={!hasChanges ? 'No changes to save' : 'Save (Ctrl/Cmd+Enter)'}
            >
              Save
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-400">
            Tip: <span className="font-medium">Esc</span> to cancel •{' '}
            <span className="font-medium">Ctrl/Cmd+Enter</span> to save
          </div>
        </div>
      ) : null}
    </div>
  );
};
