//TODO styling improvements, app theme, export repertoire as PGN 

import React, { useMemo, useState } from 'react';
import { BookDownIcon, BookPlus, DownloadIcon, FileTextIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import { pgnFromChapter, pgnFromRepertoire } from '../../util/training';
import { downloadTextFile } from '../../util/io';

type DownloadScope = 'repertoire' | 'chapter';
type ExportFormat = 'chessrepeat' | 'pgn';

const RepertoireActions: React.FC = () => {
  const setShowingAddToRepertoireMenu = useTrainerStore((state) => state.setShowingAddToRepertoireMenu);
  const repertoire = useTrainerStore((state) => state.repertoire);
  const repertoireIndex = useTrainerStore((state) => state.repertoireIndex);

  const chapter = repertoire[repertoireIndex];

  const isHighlighted = repertoire.length === 0;

  // --- download picker state ---
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
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
      <div id="repertoire-actions" className="my-2 flex flex-wrap justify-center gap-2 shrink-0">
        <button
          onClick={() => setShowingAddToRepertoireMenu(true)}
          className={`flex items-center justify-center bg-blue-500 text-white font-semibold rounded-md py-2 px-2 gap-2 transition duration-200 ease-in-out hover:bg-blue-600 active:scale-95 shadow-md hover:shadow-lg ${
            isHighlighted ? 'ring-4 ring-yellow-400/50 ring-offset-2' : ''
          }`}
        >
          <BookPlus className="w-5 h-5" />
          <span>Add to Repertoire</span>
        </button>

        <button
          onClick={() => setIsDownloadOpen(true)}
          className="flex items-center justify-center bg-blue-700 text-white font-semibold rounded-md py-2 px-3 gap-2 transition duration-200 ease-in-out hover:bg-blue-800 active:scale-95 shadow-md hover:shadow-lg"
        >
          <BookDownIcon className="w-5 h-5" />
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
    </>
  );
};

export default RepertoireActions;
