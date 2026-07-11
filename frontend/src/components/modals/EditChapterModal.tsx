import React, { useState } from 'react';
import { CircleXIcon, TrashIcon, PencilIcon, CheckIcon, XIcon } from 'lucide-react';
import { useTrainerStore } from '../../store/state';

interface EditChapterModalProps {
  chapterId: string;
  onClose: () => void;
}

const EditChapterModal: React.FC<EditChapterModalProps> = ({ chapterId, onClose }) => {
  const repertoire = useTrainerStore((s) => s.repertoire);
  const renameChapter = useTrainerStore((s) => s.renameChapter);
  const deleteChapterAt = useTrainerStore((s) => s.deleteChapterAt);

  const chapter = repertoire.find((c) => c.uuid === chapterId);

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(chapter?.name || '');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    <dialog
      open
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20
                 border-none bg-white rounded-lg shadow-lg w-[calc(100%-2rem)] max-w-md"
    >
      {/* Close Button */}
      <button
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-8 w-8
                   flex items-center justify-center shadow-md hover:bg-red-600"
        aria-label="Close"
        onClick={onClose}
        type="button"
      >
        <CircleXIcon className="w-5 h-5" />
      </button>

      <div className="p-6">
        {isRenaming ? (
          <div className="flex items-center gap-2">
            <input
              className="flex-1 text-2xl font-semibold text-gray-800 border-b-2 border-brand-blue
                         focus:outline-none bg-transparent"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              autoFocus
            />
            <button
              className="p-1.5 rounded-md bg-brand-blue hover:brightness-110 text-white transition"
              onClick={commitRename}
              type="button"
              aria-label="Confirm rename"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50 transition"
              onClick={cancelRename}
              type="button"
              aria-label="Cancel rename"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <h2 className="text-2xl font-bold text-gray-800 truncate">{chapter.name}</h2>
        )}
        {renameError && <div className="mt-2 text-sm text-red-600">{renameError}</div>}

        {!isRenaming && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={startRename}
              type="button"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <PencilIcon className="w-4 h-4" />
              Rename
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                type="button"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  type="button"
                  className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  type="button"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
        {confirmDelete && !isRenaming && (
          <div className="mt-3 text-sm text-red-600">Delete this chapter? This cannot be undone.</div>
        )}
      </div>
    </dialog>
  );
};

export default EditChapterModal;
