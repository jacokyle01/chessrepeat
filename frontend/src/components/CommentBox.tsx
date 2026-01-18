import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTrainerStore } from '../state/state';
//TODO make comments clickable
export const CommentBox = () => {
  // --- Store state (read-only selectors) ---
  // const repertoireIndex = useTrainerStore((s) => s.repertoireIndex);
  // const chapter = useTrainerStore((s) => s.repertoire[s.repertoireIndex]);
  const chapter = useTrainerStore((s) => s.activeChapter);
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const path = useTrainerStore((s) => s.selectedPath);
  const setCommentAt = useTrainerStore((s) => s.setCommentAt);

  // Derive current comment safely
  const currentComment = useMemo(() => {
    // adjust this field to match your actual data shape:
    // - chessops often uses node.data.comments?: string[]
    // - you might have node.data.comment?: string
    const c = (selectedNode as any)?.data?.comment;
    return typeof c === 'string' ? c : '';
  }, [selectedNode]);

  // --- Local UI state ---
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentComment);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // When the selected node/comment changes, reset draft (unless currently editing)
  useEffect(() => {
    if (!isEditing) setDraft(currentComment);
  }, [currentComment, isEditing]);

  // Autofocus/select when entering edit mode
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

  const onSave = () => {
    if (!canEdit) return;
    setCommentAt(draft, path);
    setIsEditing(false);
  };

  const hasChanges = draft !== currentComment;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
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

      {!isEditing ? (
        <div className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-900">
          {currentComment.trim() ? (
            <p className="whitespace-pre-wrap">{currentComment}</p>
          ) : (
            <span className="italic text-gray-400">No comment yet.</span>
          )}
        </div>
      ) : (
        <>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white p-2 text-sm
                       outline-none focus:ring-2 focus:ring-blue-500"
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

          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-sm font-medium
                         text-gray-700 hover:bg-gray-100"
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
        </>
      )}
    </div>
  );
};