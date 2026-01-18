import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTrainerStore } from '../state/state';
//TODO make comments clickable
export const CommentBox = () => {
  // --- Store state (read-only selectors) ---
  const repertoireIndex = useTrainerStore((s) => s.repertoireIndex);
  const chapter = useTrainerStore((s) => s.repertoire[s.repertoireIndex]);
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

// import { useState, useEffect, useRef } from 'react';
// import { useTrainerStore } from '../state/state';

// //TODO improve this, use state-level actions
// export const CommentBox = () => {
//   // // --------------------
//   // // All hooks must run top-level, unconditionally
//   // // --------------------
//   // const repertoire = useTrainerStore((s) => s.repertoire);
//   // const repertoireIndex = useTrainerStore((s) => s.repertoireIndex);
//   // const selectedNode = useTrainerStore((s) => s.selectedNode);
//   // const path = useTrainerStore((s) => s.selectedPath);
//   // const setCommentAt = useTrainerStore((s) => s.setCommentAt);

//   // const [editedContent, setEditedContent] = useState('');
//   // const [isEditing, setIsEditing] = useState(false);
//   // const textareaRef = useRef<HTMLTextAreaElement | null>(null);

//   // // --------------------
//   // // Derived state (safe)
//   // // --------------------
//   // const chapter = repertoire[repertoireIndex];
//   // if (!chapter) return;
//   // const root = chapter.root;
//   // const comment = selectedNode?.data.comment;

//   // // Sync when node changes
//   // useEffect(() => {
//   //   setEditedContent(comment);
//   // }, [comment, selectedNode]);

//   // // Autofocus when editing
//   // useEffect(() => {
//   //   if (isEditing && textareaRef.current) {
//   //     textareaRef.current.focus();
//   //     textareaRef.current.select();
//   //   }
//   // }, [isEditing]);

//   // const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
//   //   const newComment = e.target.value;
//   //   setEditedContent(newComment);
//   //   if (root) setCommentAt(newComment, path);
//   // };

//   // // // --------------------
//   // // // UI-only conditional rendering — NO hook changes
//   // // // --------------------
//   // // if (!currentRep || !selectedNode) {
//   // //   return (
//   // //     <div className="p-2 text-gray-400 italic text-sm">
//   // //       No comment.
//   // //     </div>
//   // //   );
//   // // }

//   // return (
//   //   <div className="">
//   //     {/* <label className="text-xs font-semibold text-gray-500">Comment</label> */}

//   //     {isEditing ? (
//   //       <textarea
//   //         ref={textareaRef}
//   //         value={editedContent}
//   //         onChange={handleChange}
//   //         onBlur={() => setIsEditing(false)}
//   //         onKeyDown={(e) => {
//   //           if (e.key === 'Escape') {
//   //             setEditedContent(comment);
//   //             setIsEditing(false);
//   //           }
//   //           if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
//   //             setIsEditing(false);
//   //           }
//   //         }}
//   //         rows={3}
//   //         className="
//   //           w-full mt-1 p-2 rounded-lg border border-gray-300
//   //           focus:outline-none focus:ring-2 focus:ring-blue-500
//   //           resize-none text-sm bg-gray-50
//   //         "
//   //       />
//   //     ) : (
//   //       <div
//   //         className="
//   //           mt-1 p-2 rounded-lg min-h-[60px] cursor-text
//   //           bg-gray-50 hover:bg-gray-100 transition text-sm
//   //         "
//   //         onClick={() => setIsEditing(true)}
//   //       >
//   //         {comment.trim() ? (
//   //           <p className="whitespace-pre-wrap">{comment}</p>
//   //         ) : (
//   //           <span className="text-gray-400 italic">Click to add a comment…</span>
//   //         )}
//   //       </div>
//   //     )}
//   //   </div>
//   // );

//   return (
//     <div>WIP</div>
//   )
// };
