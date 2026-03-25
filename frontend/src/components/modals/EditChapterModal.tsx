import React, { useRef, useState } from "react";
import { CircleXIcon, TrashIcon, UploadIcon, PencilIcon, CheckIcon, XIcon } from "lucide-react";
import { useTrainerStore } from "../../state/state";

interface EditChapterModalProps {
  chapterIndex: number;
  onClose: () => void;
}

const EditChapterModal: React.FC<EditChapterModalProps> = ({
  chapterIndex,
  onClose,
}) => {
  const repertoire = useTrainerStore((s) => s.repertoire);
  const renameChapter = useTrainerStore((s) => s.renameChapter);
  const deleteChapterAt = useTrainerStore((s) => s.deleteChapterAt);
  const importIntoChapter = useTrainerStore((s) => s.importIntoChapter);

  const chapter = repertoire[chapterIndex];

  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(chapter?.name || "");
  const [renameError, setRenameError] = useState<string | null>(null);

  const [pgnText, setPgnText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      setRenameError("Name cannot be empty.");
      return;
    }
    if (next === chapter.name) {
      setIsRenaming(false);
      return;
    }

    setRenameError(null);
    try {
      await renameChapter(chapterIndex, next);
      setIsRenaming(false);
    } catch (err: any) {
      setRenameError(err?.message ?? "Failed to rename chapter.");
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") cancelRename();
  };

  const handleDelete = async () => {
    await deleteChapterAt(chapterIndex);
    onClose();
  };

  const handleImport = async () => {
    const trimmed = pgnText.trim();
    if (!trimmed) {
      setImportError("Paste a PGN first.");
      return;
    }

    setImportError(null);
    try {
      await importIntoChapter(chapterIndex, trimmed);
      setPgnText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setImportError(err?.message ?? "Failed to import PGN.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setPgnText(text);
      setImportError(null);
    };
    reader.readAsText(file);
  };

  return (
    <dialog
      open
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20
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
      <div className="p-6 border-b border-gray-200">
        {isRenaming ? (
          <div className="flex items-center gap-2">
            <input
              className="flex-1 text-2xl font-semibold text-gray-800 border-b-2 border-blue-400
                         focus:outline-none bg-transparent"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              autoFocus
            />
            <button
              className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition"
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
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-gray-800 flex-1 min-w-0 truncate">{chapter.name}</h2>
            <button
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              onClick={startRename}
              type="button"
              aria-label="Rename chapter"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        {renameError && (
          <div className="mt-2 text-sm text-red-600">{renameError}</div>
        )}
      </div>

      {/* Import PGN section */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Import PGN</h3>
        <p className="mt-1 text-sm text-gray-400">
          Paste PGN or upload a .pgn file to merge into this chapter.
        </p>

        <textarea
          rows={5}
          value={pgnText}
          onChange={(e) => setPgnText(e.target.value)}
          placeholder={"Paste PGN here…\nex. 1. d4 d5 2. c4 c6"}
          className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-800
                     focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pgn,.txt"
            onChange={handleFileChange}
            className="text-sm text-gray-500"
          />

          <button
            onClick={handleImport}
            disabled={!pgnText.trim()}
            type="button"
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition
              ${
                pgnText.trim()
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
          >
            <UploadIcon className="w-4 h-4" />
            Import
          </button>
        </div>

        {importError && (
          <div className="mt-2 text-sm text-red-600">{importError}</div>
        )}
      </div>

      {/* Delete */}
      <div className="px-6 p-2 border-t border-gray-200 ">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 text-sm hover:bg-red-400 bg-red-500 rounded-md p-2 font-semibold"
            type="button"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            Delete chapter
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600">Delete this chapter?</span>
            <button
              onClick={handleDelete}
              className="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition"
              type="button"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 rounded-md border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
              type="button"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
};

export default EditChapterModal;
