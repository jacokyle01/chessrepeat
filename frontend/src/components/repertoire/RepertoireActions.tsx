//TODO styling improvements, app theme, export repertoire as PGN

import React, { useMemo, useState } from 'react';
import { BookDownIcon, BookPlus, DownloadIcon, FileTextIcon, FolderCog2Icon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import { pgnFromChapter, pgnFromRepertoire } from '../../util/training';
import { downloadTextFile } from '../../util/io';
import SettingsModal from '../modals/SettingsModal';

type DownloadScope = 'repertoire' | 'chapter';
type ExportFormat = 'chessrepeat' | 'pgn';

const RepertoireActions: React.FC = () => {
  const setShowingAddToRepertoireMenu = useTrainerStore((state) => state.setShowingAddToRepertoireMenu);
  const repertoire = useTrainerStore((state) => state.repertoire);
  const repertoireIndex = useTrainerStore((state) => state.repertoireIndex);

  const chapter = repertoire[repertoireIndex];

  const isHighlighted = repertoire.length === 0;

  // ui flags
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [scope, setScope] = useState<DownloadScope>('repertoire');
  const [format, setFormat] = useState<ExportFormat>('chessrepeat');

  const canDownloadChapter = !!chapter;
  const canDownloadRepertoire = repertoire.length > 0;

  const scopeLabel = useMemo(() => {
    if (scope === 'repertoire') return 'Repertoire';
    return chapter ? `Chapter: ${chapter.name}` : 'Chapter';
  }, [scope, chapter]);

  const download = () => {
    if (scope === 'chapter') {
      if (!chapter) return;

      const content = pgnFromChapter(chapter, format === 'chessrepeat');
      const fileName = format === 'chessrepeat' ? `${chapter.name}.chessrepeat` : `${chapter.name}.pgn`;

      downloadTextFile(content, fileName, 'application/x-chess-pgn');
      setIsDownloadOpen(false);
      return;
    }

    // scope === 'repertoire'
    if (!canDownloadRepertoire) return;

    if (format === 'pgn') {
      // TODO: support exporting the entire repertoire as a single .pgn file
      // (Right now repertoire export is only implemented as a .chessrepeat annotated export.)
      return;
    }

    const outFile = pgnFromRepertoire(repertoire);
    downloadTextFile(outFile, 'repertoire.chessrepeat', 'application/x-chess-pgn');
    setIsDownloadOpen(false);
  };

  const SegButton = ({
    active,
    onClick,
    children,
    disabled,
    left,
    right,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
    left?: boolean;
    right?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'px-3 py-2 text-sm font-semibold border transition select-none',
        left ? 'rounded-l-lg' : '',
        right ? 'rounded-r-lg -ml-px' : '-ml-px', // <- no space between buttons
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
        disabled ? 'opacity-50 cursor-not-allowed hover:bg-white' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );

  return (
    <>
      <div
        id="repertoire-actions"
        className="
    my-2 shrink-0
    flex items-center justify-center
    gap-2
  "
      >
        {/* Add to Repertoire */}
        <button
          onClick={() => setShowingAddToRepertoireMenu(true)}
          className={`
      h-11
      inline-flex items-center justify-center gap-2
      rounded-md px-3
      font-semibold text-white
      bg-blue-600 hover:bg-blue-700
      shadow-sm hover:shadow
      transition active:scale-[0.98]
      whitespace-nowrap
      ${isHighlighted ? 'ring-4 ring-yellow-400/50 ring-offset-2 ring-offset-white' : ''}
    `}
        >
          <BookPlus className="h-5 w-5" />
          <span>Add to Repertoire</span>
        </button>

        {/* Settings (center icon button) */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="
      h-11 w-11
      inline-flex items-center justify-center
      rounded-md
      bg-blue-500 text-white
      hover:bg-blue-600
      shadow-sm hover:shadow
      transition active:scale-[0.98]
    "
          aria-label="Settings"
          title="Settings"
        >
          <FolderCog2Icon size={22} />
        </button>

        {/* Download */}
        <button
          onClick={() => setIsDownloadOpen(true)}
          className="
      h-11
      inline-flex items-center justify-center gap-2
      rounded-md px-3
      font-semibold text-white
      bg-blue-800 hover:bg-blue-900
      shadow-sm hover:shadow
      transition active:scale-[0.98]
      whitespace-nowrap
    "
        >
          <BookDownIcon className="h-5 w-5" />
          <span>Download</span>
        </button>
      </div>

      {/* Download dialog */}
      {isDownloadOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setIsDownloadOpen(false)}
        >
          <dialog
            open
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
             z-50 border-none bg-white rounded-lg shadow-lg w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-gray-800">Download</h2>
                <button
                  type="button"
                  onClick={() => setIsDownloadOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition text-sm font-semibold"
                >
                  Close
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">Choose what to download and the file format.</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Scope segmented control (no gap between buttons) */}
              <div>
                <div className="text-sm font-semibold text-gray-800 mb-2">Download</div>
                <div className="inline-flex">
                  <SegButton
                    left
                    active={scope === 'repertoire'}
                    onClick={() => setScope('repertoire')}
                    disabled={!canDownloadRepertoire}
                  >
                    Repertoire
                  </SegButton>
                  <SegButton
                    right
                    active={scope === 'chapter'}
                    onClick={() => setScope('chapter')}
                    disabled={!canDownloadChapter}
                  >
                    Chapter
                  </SegButton>
                </div>
                <div className="mt-2 text-xs text-gray-500">{scopeLabel}</div>
              </div>

              {/* Format segmented control (no gap between buttons) */}
              <div>
                <div className="text-sm font-semibold text-gray-800 mb-2">Export as</div>
                <div className="inline-flex">
                  <SegButton left active={format === 'chessrepeat'} onClick={() => setFormat('chessrepeat')}>
                    Chessrepeat
                  </SegButton>
                  <SegButton
                    right
                    active={format === 'pgn'}
                    onClick={() => setFormat('pgn')}
                    // NOTE: repertoire -> PGN not implemented yet
                    disabled={scope === 'repertoire'}
                  >
                    PGN file
                  </SegButton>
                </div>

                {scope === 'repertoire' && format === 'pgn' ? (
                  <div className="mt-2 text-xs text-gray-500">
                    TODO: Repertoire → PGN export isn’t implemented yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setIsDownloadOpen(false)}
                type="button"
                className="px-4 py-2 rounded-lg font-semibold bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>

              <button
                onClick={download}
                type="button"
                disabled={
                  (scope === 'repertoire' && !canDownloadRepertoire) ||
                  (scope === 'chapter' && !canDownloadChapter) ||
                  (scope === 'repertoire' && format === 'pgn') // TODO
                }
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition
                  ${
                    (scope === 'repertoire' && format === 'pgn') ||
                    (scope === 'repertoire' && !canDownloadRepertoire) ||
                    (scope === 'chapter' && !canDownloadChapter)
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                <DownloadIcon className="w-4 h-4" />
                Download
              </button>
            </div>
          </dialog>
        </div>
      ) : null}

      {settingsOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setSettingsOpen(false)} // close on backdrop click
          ></div>

          {/* Modal */}
          <SettingsModal setSettingsOpen={setSettingsOpen}></SettingsModal>
        </>
      )}
    </>
  );
};

export default RepertoireActions;
