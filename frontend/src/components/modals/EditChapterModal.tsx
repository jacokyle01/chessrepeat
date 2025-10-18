import React, { useState } from 'react';
import { CircleXIcon, GlassesIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';

interface EditChapterModalProps {
  chapterIndex: number;
  onClose: () => void;
  onRename: (index: number, name: string) => void;
  onDelete: (index: number) => void;
  onSetAllSeen: (index: number) => void;
}

const EditChapterModal: React.FC<EditChapterModalProps> = ({
  chapterIndex,
  onClose,
  onDelete,
  onRename,
  onSetAllSeen,
}) => {
  const repertoire = useTrainerStore((s) => s.repertoire);
  const setRepertoire = useTrainerStore((s) => s.setRepertoire);

  const chapter = repertoire[chapterIndex];
  const [isEditingName, setIsEditingName] = useState(false);
  const [chapterName, setChapterName] = useState(chapter?.name || '');

  if (!chapter) return null;


  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onRename(chapterIndex, chapterName);
  };

  return (
    <dialog
      open
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
      z-50 border-none bg-white rounded-lg shadow-lg w-full max-w-md"
    >
      {/* Close Button */}
      <button
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-8 w-8 
        flex items-center justify-center shadow-md hover:bg-red-600"
        aria-label="Close"
        onClick={onClose}
      >
        <CircleXIcon className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        {isEditingName ? (
          <input
            className="text-2xl font-semibold text-gray-800 border-b border-gray-400 
            focus:outline-none flex-1"
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            onBlur={onRename(chapterIndex, chapterName)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-800 flex-1">{chapter.name}</h2>
        )}

        <button
          className="ml-3 text-gray-500 hover:text-gray-800 transition"
          onClick={() => setIsEditingName(true)}
        >
          <PencilIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Actions */}
      <div className="p-6 space-y-4 flex">
        <button
          onClick={() => onDelete(chapterIndex)}
          className="w-full py-2 px-4 bg-red-500 hover:bg-red-600 
          text-white font-semibold rounded-lg transition flex items-center justify-center"
        >
          <TrashIcon />
          <span> Delete Chapter </span>
        </button>

        <button
          onClick={() => onSetAllSeen(chapterIndex)}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 
          text-white font-semibold rounded-lg transition flex gap-5 items-center justify-center"
        >
          <GlassesIcon />
          <span>Set All as Seen</span>
        </button>
      </div>
    </dialog>
  );
};

export default EditChapterModal;
