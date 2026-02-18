import React, { useRef, useState } from 'react';
import { CircleXIcon, UploadIcon, CheckCircle2, TreePalmIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import { chapterFromPgn } from '../../util/io';
import { Chapter } from '../../types/training';
// import { importJSON } from '../../util/importJSON'; // <- assume this exists

type ImportTab = 'pgn' | 'json';

const AddToRepertoireModal: React.FC = () => {
  const setShowModal = useTrainerStore((s) => s.setShowingAddToRepertoireMenu);
  const addNewChapter = useTrainerStore((s) => s.addNewChapter);

  const [tab, setTab] = useState<ImportTab>('pgn');

  // PGN refs/state
  const [selectedColor, setSelectedColor] = useState<'white' | 'black' | undefined>(undefined);
  const nameRef = useRef<HTMLInputElement>(null);
  const pgnRef = useRef<HTMLTextAreaElement>(null);

  // JSON refs/state
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState<string>(''); // stored but never displayed
  const [jsonFilename, setJsonFilename] = useState<string>('');
  const [jsonLoaded, setJsonLoaded] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isImportingJson, setIsImportingJson] = useState(false);

  const resetJsonState = () => {
    setJsonText('');
    setJsonFilename('');
    setJsonLoaded(false);
    setJsonError(null);
    if (jsonFileRef.current) jsonFileRef.current.value = '';
  };

  const handleSubmitPgn = (e: React.FormEvent) => {
    e.preventDefault();

    const name = nameRef.current?.value || '';
    const pgn = pgnRef.current?.value || '';
    const color = selectedColor || 'white';

    const chapter = chapterFromPgn(pgn, color, name);
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

  //TODO dont need all this
  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // basic UX: ensure it "looks like" json
    const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
    if (!isJson) {
      setJsonError('Please choose a .json file.');
      setJsonLoaded(false);
      setJsonText('');
      setJsonFilename('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '').trim();
      setJsonError(null);
      setJsonFilename(file.name);

      // validate parse now so user gets immediate feedback
      try {
        JSON.parse(text);
        setJsonText(text);
        setJsonLoaded(true);
      } catch {
        setJsonText('');
        setJsonLoaded(false);
        setJsonError('That file is not valid JSON.');
      }
    };
    reader.onerror = () => {
      setJsonText('');
      setJsonLoaded(false);
      setJsonFilename('');
      setJsonError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleImportJson = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = jsonText.trim();
    if (!trimmed) {
      setJsonError('Choose a .json file first.');
      return;
    }

    setJsonError(null);
    setIsImportingJson(true);

    try {
      // assume this restores repertoire / chapters internally
      // (or returns chapters that you add—either way, you said it exists)
      const parsed = JSON.parse(trimmed);
      console.log('Chapters', parsed);

      console.log('pars', parsed.chapters);
      for (const chapter of parsed.chapters) {
        await addNewChapter(chapter);
      }
      resetJsonState();
      setShowModal(false);
    } catch (err: any) {
      setJsonError(err?.message ?? 'Failed to import JSON backup.');
    } finally {
      setIsImportingJson(false);
    }
  };
  return (
    <dialog
      open
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000]
                 border-none bg-white rounded-lg shadow-lg w-full max-w-lg"
    >
      {/* Close button */}
      <button
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-8 w-8
                   flex items-center justify-center shadow-md hover:bg-red-600"
        aria-label="Close"
        onClick={() => {
          resetJsonState();
          setShowModal(false);
        }}
        type="button"
      >
        <CircleXIcon className="w-5 h-5" />
      </button>

      {/* Heading + Tabs */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Add to Repertoire</h2>

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
            onClick={() => setTab('json')}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
              tab === 'json' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            JSON backup
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
          <form onSubmit={handleImportJson}>
            <p className="text-sm text-gray-500 mb-4">
              Import a JSON file of a repertoire or chapter that you've previously downloaded.{' '}
            </p>

            <div className="mb-4">
              <label className="block text-gray-700 text-base font-semibold mb-2">File (.json)</label>
              <input
                ref={jsonFileRef}
                type="file"
                accept="application/json,.json"
                onChange={handleJsonFileChange}
                className="text-sm"
              />

              {/* Loaded indicator (no content preview) */}
              <div className="mt-3">
                {jsonLoaded ? (
                  <div className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">Loaded</span>
                    {jsonFilename ? (
                      <span className="text-green-700/80 truncate">— {jsonFilename}</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No file loaded yet.</div>
                )}
              </div>
            </div>

            {jsonError ? <div className="mb-3 text-sm text-red-600">{jsonError}</div> : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetJsonState}
                className="flex-1 rounded py-2 px-4 font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>

              <button
                type="submit"
                disabled={isImportingJson || !jsonLoaded}
                className={`flex-1 text-lg font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition
                ${
                  isImportingJson || !jsonLoaded
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <UploadIcon className="w-5 h-5" />
                  {isImportingJson ? 'Importing...' : 'Import'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
};
export default AddToRepertoireModal;
