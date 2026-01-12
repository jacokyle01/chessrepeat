import React, { useState } from 'react';
import { CircleXIcon, Download, GlassesIcon, PencilIcon, TrashIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import { updateRecursive } from '../tree/ops';
import { currentTime, downloadChapter } from '../../util';
import { PgnNodeData } from 'chessops/pgn';

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

  // TODO factor out spaced repetition actions (succeed, fail, learn) into separate logic file, possibly this one
  const markAllAsSeen = () => {
    // TODO this function should be factored out
    let srsConfig = useTrainerStore.getState().srsConfig;
    const learnNode = (node: Tree.Node) => {
      if (node.disabled) return;
      console.log('learning some node');
      const timeToAdd = srsConfig!.buckets![0];

      chapter.bucketEntries[0]++;
      node.seen = true;
      node.dueAt = currentTime() + timeToAdd;
    };
    updateRecursive(chapter.tree, '', (node) => learnNode(node));
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
          onClick={() => markAllAsSeen()}
          className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 
          text-white font-semibold rounded-lg transition flex items-center justify-center"
        >
          <GlassesIcon />
          <span> Mark all as seen</span>
        </button>
        <button
          onClick={() => {
            const chapter = repertoire[chapterIndex];
            downloadChapter(chapter);
          }}
          className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 
          text-white font-semibold rounded-lg transition flex items-center justify-center"
        >
          <Download />
          <span> Download chapter</span>
        </button>
      </div>
    </dialog>
  );
};

export default EditChapterModal;
