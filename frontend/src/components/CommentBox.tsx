import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTrainerStore } from '../state/state';
import { MessageSquareIcon } from 'lucide-react';

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
    // keep draft in sync unless currently editing
    if (!isEditing) setDraft(currentComment);
  }, [currentComment, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const canEdit = !!chapter && !!selectedNode && typeof path === 'string';
  const hasChanges = draft !== currentComment;

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

  if (!selectedNode) return null;

  return (
    <div className="my-2 mb-5 flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white">
      {/* Header (fixed) */}
      <div className="shrink-0 border-b border-gray-100 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
            <div className="rounded-md bg-gray-100 p-1 text-gray-500">
              <MessageSquareIcon size={18} />
            </div>
            <span className="text-sm font-semibold">Comment</span>
          </div>

          {/* Actions live in header (like Edit) */}
          <div className="flex items-center gap-1">
            {!isEditing ? (
              <button
                type="button"
                onClick={onStartEdit}
                disabled={!canEdit}
                className="rounded-md px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!hasChanges}
                  className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600"
                  title={!hasChanges ? 'No changes' : 'Save (Ctrl/Cmd+Enter)'}
                >
                  Save
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body (the only scrollable region) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {!isEditing ? (
          currentComment.trim() ? (
            <p className="whitespace-pre-wrap text-sm text-gray-900 [overflow-wrap:anywhere]">
              {currentComment}
            </p>
          ) : (
            <p className="text-sm italic text-gray-400">No comment yet.</p>
          )
        ) : (
          // Key fix: textarea is NOT inside a padded/rounded inner box that steals height.
          // It fills the entire scrollable body.
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="
              h-full w-full resize-none
              bg-transparent text-sm text-gray-900
              outline-none
              [overflow-wrap:anywhere]
            "
            placeholder="Write a comment…"
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
    </div>
  );
};
