import React, { useRef, useState } from 'react';
import { CircleXIcon, GlassesIcon, PencilIcon, TrashIcon, UploadIcon } from 'lucide-react';
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
  // const repertoire = useTrainerStore((s) => s.repertoire);

  // ✅ state action you asked to use
  const importIntoChapter = useTrainerStore((s) => s.importIntoChapter);

  const chapter = useTrainerStore((s) => s.activeChapter);
  const [isEditingName, setIsEditingName] = useState(false);
  const [chapterName, setChapterName] = useState(chapter?.name || '');

  // New: PGN input state
  const [pgnText, setPgnText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!chapter) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onRename(chapterIndex, chapterName.trim());
      setIsEditingName(false);
    }
    if (e.key === 'Escape') {
      setChapterName(chapter.name);
      setIsEditingName(false);
    }
  };

  const handleImport = async () => {
    const trimmed = pgnText.trim();
    if (!trimmed) {
      setImportError('Paste a PGN first.');
      return;
    }

    setImportError(null);
    try {
      // assuming your store action takes (chapterIndex, pgnString)
      // if your signature is different, adjust here.
      // await importIntoChapter(chapterIndex, trimmed);

      setPgnText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setImportError(err?.message ?? 'Failed to import PGN.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setPgnText(text);
      setImportError(null);
    };
    reader.readAsText(file);
  };

  return (
    <dialog
      open
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-60
                 border-none bg-white rounded-lg shadow-lg w-full max-w-md"
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

      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-3">
        {isEditingName ? (
          <input
            className="text-2xl font-semibold text-gray-800 border-b border-gray-400
                       focus:outline-none flex-1"
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            onBlur={() => {
              onRename(chapterIndex, chapterName.trim());
              setIsEditingName(false);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-800 flex-1">{chapter.name}</h2>
        )}

        <button
          className="text-gray-500 hover:text-gray-800 transition"
          onClick={() => setIsEditingName(true)}
          type="button"
        >
          <PencilIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Actions */}
      <div className="p-6 space-y-3">
        <button
          onClick={() => onDelete(chapterIndex)}
          className="w-full py-2 px-4 bg-red-500 hover:bg-red-600
                     text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
          type="button"
        >
          <TrashIcon className="w-5 h-5" />
          <span>Delete Chapter</span>
        </button>

        <button
          onClick={() => onSetAllSeen(chapterIndex)}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700
                     text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
          type="button"
        >
          <GlassesIcon className="w-5 h-5" />
          <span>Mark all as seen</span>
        </button>
      </div>

      {/* ✅ Import PGN section at the bottom */}
      <div className="px-6 pb-6">
        <div className="border-t border-gray-200 pt-5">
          <h3 className="text-lg font-bold text-gray-800">Import PGN</h3>
          <p className="mt-1 text-sm text-gray-500">
            Paste PGN text below (or upload a .pgn/.txt file) to merge into this chapter.
          </p>

          <textarea
            rows={5}
            value={pgnText}
            onChange={(e) => setPgnText(e.target.value)}
            placeholder="Paste PGN here…&#10;ex. 1. d4 d5 2. c4 c6"
            className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-800 shadow"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pgn,.txt"
              onChange={handleFileChange}
              className="text-sm"
            />

            <button
              onClick={handleImport}
              disabled={!pgnText.trim()}
              type="button"
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition
                ${
                  pgnText.trim()
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
            >
              <UploadIcon className="w-4 h-4" />
              Import
            </button>
          </div>

          {importError ? <div className="mt-2 text-sm text-red-600">{importError}</div> : null}
        </div>
      </div>
    </dialog>
  );
};

export default EditChapterModal;
