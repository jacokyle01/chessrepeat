import React, { useRef, useState } from 'react';
import { CircleXIcon, UploadIcon, CheckCircle2, TreePalmIcon, TriangleAlertIcon, CloudAlertIcon } from 'lucide-react';
import { useTrainerStore } from '../../store/state';
import { chapterFromImport, chapterFromPgn } from '../../util/io';
import { Chapter } from '../../types/training';
import { useAuthStore } from '../../store/auth';
import './modals.css';
import './AddToRepertoireModal.css';
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

  // Whether this chapter will be saved locally or to the server
  const isLoggedIn = useAuthStore().isAuthenticated();
  const openLogin = useAuthStore((s) => s.openLogin);

  const SignedOutNotice = () => (
    <div className="add-rep-signed-out">
      <CloudAlertIcon />
      <p>
        You're using chessrepeat signed out.{' '}
        <button type="button" onClick={openLogin}>
          Log in
        </button>{' '}
        to save your repertoire to the cloud and train anywhere.
      </p>
    </div>
  );

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
    // chapterFromPgn alerts and returns null on a parse error; keep the
    // modal open so the user can fix the PGN rather than silently closing.
    if (!chapter) return;
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
        // Assign a fresh uuid so imported chapters never collide with
        // existing ones (exports strip the uuid).
        await addNewChapter(chapterFromImport(chapter));
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
    <dialog open className="modal-dialog modal-dialog-lg add-rep-dialog">
      {/* Close button */}
      <button
        className="modal-close-puck"
        aria-label="Close"
        onClick={() => {
          resetJsonState();
          setShowModal(false);
        }}
        type="button"
      >
        <CircleXIcon />
      </button>

      {/* Heading + Tabs */}
      <div className="add-rep-head">
        <h2>Add to Repertoire</h2>

        <div className="add-rep-tabs">
          <button
            type="button"
            onClick={() => setTab('pgn')}
            className={`add-rep-tab ${tab === 'pgn' ? 'is-active' : ''}`}
          >
            PGN
          </button>
          <button
            type="button"
            onClick={() => setTab('json')}
            className={`add-rep-tab ${tab === 'json' ? 'is-active' : ''}`}
          >
            JSON
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="add-rep-body">
        {tab === 'pgn' ? (
          <form onSubmit={handleSubmitPgn}>
            {/* Name */}
            <div className="add-rep-field">
              <label>Name</label>
              <input id="name" ref={nameRef} className="add-rep-name-input" />
            </div>

            {/* PGN */}
            <div className="add-rep-field">
              <label>PGN</label>
              <textarea
                id="pgn"
                ref={pgnRef}
                rows={4}
                placeholder={'Enter PGN...\nex. 1. d4 d5 2. c4 c6'}
                className="add-rep-pgn-input"
              />
              <input
                id="fileInput"
                type="file"
                accept=".txt,.pgn"
                onChange={handlePgnFileChange}
                className="add-rep-file-input"
              />
            </div>

            {/* Train As */}
            <div className="add-rep-train-as">
              <label>Train as</label>
              <div className="add-rep-colors">
                <label className="add-rep-color">
                  <input
                    id="colorWhite"
                    type="radio"
                    name="color"
                    value="white"
                    onChange={() => setSelectedColor('white')}
                  />
                  <span className="add-rep-color-label">White</span>
                </label>
                <label className="add-rep-color">
                  <input
                    id="colorBlack"
                    type="radio"
                    name="color"
                    value="black"
                    onChange={() => setSelectedColor('black')}
                  />
                  <span className="add-rep-color-label">Black</span>
                </label>
              </div>
            </div>
            {!isLoggedIn && <SignedOutNotice />}

            <button type="submit" disabled={!selectedColor} className="add-rep-submit">
              Add
            </button>
          </form>
        ) : (
          <form onSubmit={handleImportJson}>
            <p className="add-rep-json-intro">
              Import a JSON file of a repertoire or chapter that you've previously downloaded.{' '}
            </p>

            <div className="add-rep-field">
              <label>File (.json)</label>
              <input
                ref={jsonFileRef}
                type="file"
                accept="application/json,.json"
                onChange={handleJsonFileChange}
                className="add-rep-file-input"
              />

              {/* Loaded indicator (no content preview) */}
              <div className="add-rep-json-status">
                {jsonLoaded ? (
                  <div className="add-rep-json-loaded">
                    <CheckCircle2 />
                    <strong>Loaded</strong>
                    {jsonFilename ? (
                      <span className="add-rep-json-filename">— {jsonFilename}</span>
                    ) : null}
                  </div>
                ) : (
                  <div className="add-rep-json-idle">No file loaded yet.</div>
                )}
              </div>
            </div>

            {jsonError ? <div className="add-rep-json-error">{jsonError}</div> : null}
            {!isLoggedIn && <SignedOutNotice />}

            <div className="add-rep-json-actions">
              <button type="button" onClick={resetJsonState} className="add-rep-clear-btn">
                Clear
              </button>

              <button
                type="submit"
                disabled={isImportingJson || !jsonLoaded}
                className="add-rep-import-btn"
              >
                <span>
                  <UploadIcon />
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
