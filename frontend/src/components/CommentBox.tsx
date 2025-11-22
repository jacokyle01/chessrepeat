import { useState, useEffect, useRef } from 'react';
import { useTrainerStore } from '../state/state';
import { setCommentAt } from './tree/ops';

export const CommentBox = () => {
  // --------------------
  // All hooks must run top-level, unconditionally
  // --------------------
  const repertoire = useTrainerStore((s) => s.repertoire);
  const repertoireIndex = useTrainerStore((s) => s.repertoireIndex);
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const path = useTrainerStore((s) => s.selectedPath);

  const [editedContent, setEditedContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // --------------------
  // Derived state (safe)
  // --------------------
  const currentRep = repertoire[repertoireIndex];
  const root = currentRep?.tree ?? null;
  const comment = selectedNode?.comment ?? '';

  // Sync when node changes
  useEffect(() => {
    setEditedContent(comment);
  }, [comment, selectedNode]);

  // Autofocus when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newComment = e.target.value;
    setEditedContent(newComment);
    if (root) setCommentAt(root, newComment, path);
  };

  // // --------------------
  // // UI-only conditional rendering — NO hook changes
  // // --------------------
  // if (!currentRep || !selectedNode) {
  //   return (
  //     <div className="p-2 text-gray-400 italic text-sm">
  //       No comment.
  //     </div>
  //   );
  // }

  return (
    <div className="">
      {/* <label className="text-xs font-semibold text-gray-500">Comment</label> */}

      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editedContent}
          onChange={handleChange}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditedContent(comment);
              setIsEditing(false);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              setIsEditing(false);
            }
          }}
          rows={3}
          className="
            w-full mt-1 p-2 rounded-lg border border-gray-300
            focus:outline-none focus:ring-2 focus:ring-blue-500
            resize-none text-sm bg-gray-50
          "
        />
      ) : (
        <div
          className="
            mt-1 p-2 rounded-lg min-h-[60px] cursor-text 
            bg-gray-50 hover:bg-gray-100 transition text-sm
          "
          onClick={() => setIsEditing(true)}
        >
          {comment.trim() ? (
            <p className="whitespace-pre-wrap">{comment}</p>
          ) : (
            <span className="text-gray-400 italic">Click to add a comment…</span>
          )}
        </div>
      )}
    </div>
  );
};
