import React, { useState } from 'react';
import { BookDownIcon, BookPlus, DownloadIcon, XIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import { pgnFromChapter, pgnFromRepertoire } from '../../util/training';
import { downloadTextFile, repertoireAsJson } from '../../util/io';

type DownloadScope = 'repertoire' | 'chapter';
type ExportFormat = 'json' | 'pgn';

//TODO refactor into modal
const DownloadModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const repertoire = useTrainerStore((state) => state.repertoire);
  const repertoireIndex = useTrainerStore((state) => state.repertoireIndex);
  const chapter = repertoire[repertoireIndex];

  const [scope, setScope] = useState<DownloadScope>('repertoire');
  const [format, setFormat] = useState<ExportFormat>('json');

  const canDownloadChapter = !!chapter;
  const canDownloadRepertoire = repertoire.length > 0;
  const canDownload = scope === 'repertoire' ? canDownloadRepertoire : canDownloadChapter;

  const download = () => {
    if (!canDownload) return;

    if (scope === 'chapter' && chapter) {
      if (format === 'pgn') {
        downloadTextFile(pgnFromChapter(chapter), `${chapter.name}.pgn`, 'application/x-chess-pgn');
      } else {
        downloadTextFile(repertoireAsJson([chapter]), `${chapter.name}.json`, 'application/json');
      }
    } else if (scope === 'repertoire') {
      if (format === 'pgn') {
        downloadTextFile(pgnFromRepertoire(repertoire), 'repertoire.pgn', 'application/x-chess-pgn');
      } else {
        downloadTextFile(repertoireAsJson(repertoire), 'repertoire.json', 'application/json');
      }
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-gray-900">Download</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-5">
          {/* Scope */}
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Scope
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <ScopeOption
                label="Repertoire"
                sublabel={`${repertoire.length} chapter${repertoire.length !== 1 ? 's' : ''}`}
                selected={scope === 'repertoire'}
                disabled={!canDownloadRepertoire}
                onClick={() => setScope('repertoire')}
              />
              <ScopeOption
                label="Chapter"
                sublabel={chapter?.name || 'none'}
                selected={scope === 'chapter'}
                disabled={!canDownloadChapter}
                onClick={() => setScope('chapter')}
              />
            </div>
          </fieldset>

          {/* Format */}
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Format
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <FormatOption
                label="JSON"
                sublabel="Chessrepeat format"
                selected={format === 'json'}
                onClick={() => setFormat('json')}
              />
              <FormatOption
                label="PGN"
                sublabel="Standard chess"
                selected={format === 'pgn'}
                onClick={() => setFormat('pgn')}
              />
            </div>
          </fieldset>

          {/* Download button */}
          <button
            onClick={download}
            type="button"
            disabled={!canDownload}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition
              ${
                canDownload
                  ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            <DownloadIcon className="w-4 h-4" />
            Download {scope === 'chapter' ? 'Chapter' : 'Repertoire'} as .{format}
          </button>
        </div>
      </div>
    </div>
  );
};

const ScopeOption: React.FC<{
  label: string;
  sublabel: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}> = ({ label, sublabel, selected, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`text-left px-3 py-2.5 rounded-lg border-2 transition text-sm
      ${
        selected
          ? 'border-blue-500 bg-blue-50 text-blue-900'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
      }
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <div className="font-semibold">{label}</div>
    <div className="text-xs text-gray-500 truncate mt-0.5">{sublabel}</div>
  </button>
);

const FormatOption: React.FC<{
  label: string;
  sublabel: string;
  selected: boolean;
  onClick: () => void;
}> = ({ label, sublabel, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-left px-3 py-2.5 rounded-lg border-2 transition text-sm cursor-pointer
      ${
        selected
          ? 'border-blue-500 bg-blue-50 text-blue-900'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
      }`}
  >
    <div className="font-semibold">{label}</div>
    <div className="text-xs text-gray-500 mt-0.5">{sublabel}</div>
  </button>
);

const RepertoireActions: React.FC = () => {
  const setShowingAddToRepertoireMenu = useTrainerStore((state) => state.setShowingAddToRepertoireMenu);
  const repertoire = useTrainerStore((state) => state.repertoire);

  const isHighlighted = repertoire.length === 0;

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  return (
    <>
      <div id="repertoire-actions" className="my-2 shrink-0 flex items-center justify-start gap-2">
        <button
          onClick={() => setShowingAddToRepertoireMenu(true)}
          className={`
            h-11 inline-flex items-center justify-center gap-2
            rounded-md px-3
            hover:shadow transition active:scale-[0.98] whitespace-nowrap
            border border-gray-300 bg-white 
            ${isHighlighted ? 'ring-4 ring-yellow-400/50 ring-offset-2 ring-offset-white' : ''}
          `}
        >
          <BookPlus className="h-5 w-5" />
          <span>Add to Repertoire</span>
        </button>

        <button
          onClick={() => setIsDownloadOpen(true)}
          className="h-11 inline-flex items-center justify-center gap-2 rounded-md px-3 hover:shadow transition active:scale-[0.98] whitespace-nowrap border border-gray-300 bg-white"
        >
          <BookDownIcon className="h-5 w-5" />
          <span>Download</span>
        </button>
      </div>

      {isDownloadOpen && <DownloadModal onClose={() => setIsDownloadOpen(false)} />}
    </>
  );
};

export default RepertoireActions;
