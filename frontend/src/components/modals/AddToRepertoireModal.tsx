import React, { useRef, useState } from 'react';
import { CircleXIcon, UploadIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import { chapterFromPgn, importAnnotatedPgn } from '../../util/io';

type ImportTab = 'pgn' | 'chessrepeat';

const AddToRepertoireModal: React.FC = () => {
  const setShowModal = useTrainerStore((s) => s.setShowingAddToRepertoireMenu);
  const trainingConfig = useTrainerStore((s) => s.trainingConfig);

  // ✅ Adjust to your real store action name/signature
  // expected: importChessrepeatIntoRepertoire(fileText: string): Promise<void> | void
  const addChapters = useTrainerStore((s) => s.addChapters);
  const addNewChapter = useTrainerStore((s) => s.addNewChapter);

  const [tab, setTab] = useState<ImportTab>('pgn');

  // PGN refs/state
  const [selectedColor, setSelectedColor] = useState<'white' | 'black' | undefined>(undefined);
  const nameRef = useRef<HTMLInputElement>(null);
  const pgnRef = useRef<HTMLTextAreaElement>(null);

  // Chessrepeat refs/state
  const chessrepeatFileRef = useRef<HTMLInputElement>(null);
  const [chessrepeatText, setChessrepeatText] = useState('');
  const [chessrepeatError, setChessrepeatError] = useState<string | null>(null);
  const [isImportingChessrepeat, setIsImportingChessrepeat] = useState(false);

  const handleSubmitPgn = (e: React.FormEvent) => {
    e.preventDefault();

    const name = nameRef.current?.value || '';
    const pgn = pgnRef.current?.value || '';
    const color = selectedColor || 'white';

    const chapter = chapterFromPgn(pgn, color, name, trainingConfig);
    addNewChapter(chapter);
    setShowModal(false);
  };

  const handlePgnFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (pgnRef.current) pgnRef.current.value = String(reader.result ?? '');
    };
    reader.readAsText(file);
  };

  const handleChessrepeatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setChessrepeatText(String(reader.result ?? ''));
      setChessrepeatError(null);
    };
    reader.readAsText(file);
  };

  const handleImportChessrepeat = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = chessrepeatText.trim();
    if (!trimmed) {
      setChessrepeatError('Choose a .chessrepeat file first.');
      return;
    }

    // importAnnotatedPgn(chessrepeatText);
    setShowModal(false);

    setChessrepeatError(null);
    setIsImportingChessrepeat(true);
    try {
      // await importChessrepeatIntoRepertoire(trimmed);
      const chapters = importAnnotatedPgn(chessrepeatText);
      //TODO state action addChapters?
      for (const ch of chapters) {
        await useTrainerStore.getState().addNewChapter(ch);
      }

      // console.log("IMPORTED CHAPTERS", chapters);
      // addChapters(chapters);
      // reset + close
      setChessrepeatText('');
      if (chessrepeatFileRef.current) chessrepeatFileRef.current.value = '';
      setShowModal(false);
    } catch (err: any) {
      setChessrepeatError(err?.message ?? 'Failed to import Chessrepeat file.');
    } finally {
      setIsImportingChessrepeat(false);
    }
  };

  return (
    <dialog
      open
      className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10
                 border-none bg-white rounded-lg shadow-lg w-full max-w-lg"
    >
      {/* Close button */}
      <button
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-8 w-8
                   flex items-center justify-center shadow-md hover:bg-red-600"
        aria-label="Close"
        onClick={() => setShowModal(false)}
        type="button"
      >
        <CircleXIcon className="w-5 h-5" />
      </button>

      {/* Heading + Tabs */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Add to Repertoire</h2>

        {/* Tabs */}
        <div className="mt-4 inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setTab('pgn')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              tab === 'pgn' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            PGN
          </button>
          <button
            type="button"
            onClick={() => setTab('chessrepeat')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              tab === 'chessrepeat' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Chessrepeat file
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        {tab === 'pgn' ? (
          <form onSubmit={handleSubmitPgn}>
            {/* Name */}
            <div className="mb-4">
              <label className="block text-gray-700 text-base font-semibold mb-2">Name</label>
              <input
                id="name"
                ref={nameRef}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight
                           focus:outline-none focus:shadow-outline"
              />
            </div>

            {/* PGN */}
            <div className="mb-4">
              <label className="block text-gray-700 text-base font-semibold mb-2">PGN</label>
              <textarea
                id="pgn"
                ref={pgnRef}
                rows={4}
                placeholder={'Enter PGN...\nex. 1. d4 d5 2. c4 c6'}
                className="shadow block w-full text-sm text-gray-700 rounded-lg border border-gray-300 p-3"
              />
              <input
                id="fileInput"
                type="file"
                accept=".txt,.pgn"
                onChange={handlePgnFileChange}
                className="mt-2 text-sm"
              />
            </div>

            {/* Train As */}
            <div className="mb-5">
              <label className="block text-gray-700 text-base font-semibold mb-3">Train as</label>
              <div className="flex">
                <label className="flex-1">
                  <input
                    id="colorWhite"
                    type="radio"
                    name="color"
                    value="white"
                    className="hidden peer"
                    onChange={() => setSelectedColor('white')}
                  />
                  <span
                    className="block text-center py-3 text-lg font-medium bg-gray-200 text-gray-800 rounded-l-lg
                                   peer-checked:bg-gray-700 peer-checked:text-white cursor-pointer transition"
                  >
                    White
                  </span>
                </label>
                <label className="flex-1">
                  <input
                    id="colorBlack"
                    type="radio"
                    name="color"
                    value="black"
                    className="hidden peer"
                    onChange={() => setSelectedColor('black')}
                  />
                  <span
                    className="block text-center py-3 text-lg font-medium bg-gray-200 text-gray-800 rounded-r-lg
                                   peer-checked:bg-gray-700 peer-checked:text-white cursor-pointer transition"
                  >
                    Black
                  </span>
                </label>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!selectedColor}
              className={`w-full text-lg font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition ${
                selectedColor
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Add
            </button>
          </form>
        ) : (
          <form onSubmit={handleImportChessrepeat}>
            <p className="text-sm text-gray-500 mb-4">
              Importing a Chessrepeat file restores your saved annotations/training metadata. Name and “Train
              as” are not needed.
            </p>

            <div className="mb-4">
              <label className="block text-gray-700 text-base font-semibold mb-2">File (.chessrepeat)</label>
              <input
                ref={chessrepeatFileRef}
                type="file"
                accept=".chessrepeat,.txt"
                onChange={handleChessrepeatFileChange}
                className="text-sm"
              />
            </div>

            {/* Optional preview/edit */}
            <div className="mb-4">
              <label className="block text-gray-700 text-base font-semibold mb-2">Contents</label>
              <textarea
                rows={6}
                value={chessrepeatText}
                onChange={(e) => setChessrepeatText(e.target.value)}
                placeholder="Choose a .chessrepeat file to load its contents…"
                className="shadow block w-full text-sm text-gray-700 rounded-lg border border-gray-300 p-3"
              />
            </div>

            {chessrepeatError ? <div className="mb-3 text-sm text-red-600">{chessrepeatError}</div> : null}

            <button
              type="submit"
              disabled={isImportingChessrepeat || !chessrepeatText.trim()}
              className={`w-full text-lg font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition
                ${
                  isImportingChessrepeat || !chessrepeatText.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <UploadIcon className="w-5 h-5" />
                {isImportingChessrepeat ? 'Importing...' : 'Import'}
              </span>
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
};

export default AddToRepertoireModal;
