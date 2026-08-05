import React, { useState } from 'react';
import { TrashIcon, PencilIcon, CheckIcon, XIcon } from 'lucide-react';
import { useTrainerStore } from '../../store/state';
import './modals.css';
import './EditChapterModal.css';

interface EditChapterModalProps {
  chapterId: string;
  onClose: () => void;
  /** Open straight into one action — the chapter row's menu picks it. */
  initialAction?: 'rename' | 'delete';
}

const EditChapterModal: React.FC<EditChapterModalProps> = ({ chapterId, onClose, initialAction }) => {
  const repertoire = useTrainerStore((s) => s.repertoire);
  const renameChapter = useTrainerStore((s) => s.renameChapter);
  const deleteChapterAt = useTrainerStore((s) => s.deleteChapterAt);

  const chapter = repertoire.find((c) => c.uuid === chapterId);

  const [isRenaming, setIsRenaming] = useState(initialAction === 'rename');
  const [draftName, setDraftName] = useState(chapter?.name || '');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(initialAction === 'delete');

  if (!chapter) return null;

  const startRename = () => {
    setRenameError(null);
    setDraftName(chapter.name);
    setIsRenaming(true);
  };

  const cancelRename = () => {
    setRenameError(null);
    setDraftName(chapter.name);
    setIsRenaming(false);
  };

  const commitRename = async () => {
    const next = draftName.trim();
    if (!next) {
      setRenameError('Name cannot be empty.');
      return;
    }
    if (next === chapter.name) {
      setIsRenaming(false);
      return;
    }

    setRenameError(null);
    try {
      await renameChapter(chapterId, next);
      setIsRenaming(false);
    } catch (err: any) {
      setRenameError(err?.message ?? 'Failed to rename chapter.');
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitRename();
    if (e.key === 'Escape') cancelRename();
  };

  const handleDelete = async () => {
    await deleteChapterAt(chapterId);
    onClose();
  };

  return (
    <dialog open className="modal-dialog edit-chapter-dialog">
      {/* Close Button */}
      <button className="modal-close-puck" aria-label="Close" onClick={onClose} type="button">
        <XIcon />
      </button>

      <div className="edit-chapter-body">
        {isRenaming ? (
          <div className="edit-chapter-rename">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              autoFocus
            />
            <button
              className="edit-chapter-confirm"
              onClick={commitRename}
              type="button"
              aria-label="Confirm rename"
            >
              <CheckIcon />
            </button>
            <button
              className="edit-chapter-cancel"
              onClick={cancelRename}
              type="button"
              aria-label="Cancel rename"
            >
              <XIcon />
            </button>
          </div>
        ) : (
          <h2 className="edit-chapter-title">{chapter.name}</h2>
        )}
        {renameError && <div className="edit-chapter-error">{renameError}</div>}

        {!isRenaming && (
          <div className="edit-chapter-actions">
            <button
              onClick={startRename}
              type="button"
              className="edit-chapter-action edit-chapter-rename-btn"
            >
              <PencilIcon />
              Rename
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                type="button"
                className="edit-chapter-action edit-chapter-delete-btn"
              >
                <TrashIcon />
                Delete
              </button>
            ) : (
              <div className="edit-chapter-confirm-row">
                <button onClick={handleDelete} type="button" className="edit-chapter-confirm-yes">
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                  className="edit-chapter-confirm-no"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
        {confirmDelete && !isRenaming && (
          <div className="edit-chapter-warning">Delete this chapter? This cannot be undone.</div>
        )}
      </div>
    </dialog>
  );
};

export default EditChapterModal;
