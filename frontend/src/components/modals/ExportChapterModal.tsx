import React, { useMemo, useState } from 'react';
import { CircleXIcon, DownloadIcon, FileTextIcon, InfoIcon } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import { exportChapter } from '../../util/training';

interface ExportChapterModalProps {
  chapterIndex: number;
  onClose: () => void;
}

type ExportFormat = 'pgn' | 'chessrepeat';

const ExportChapterModal: React.FC<ExportChapterModalProps> = ({ chapterIndex, onClose }) => {
  const repertoire = useTrainerStore((s) => s.repertoire);
  // Adjust to your actual store API
  // const exportChapterAsPgn = useTrainerStore((s) => (s as any).exportChapterAsPgn);
  // const exportChapterAsChessrepeat = useTrainerStore(
  //   (s) => (s as any).exportChapterAsChessrepeat
  // );

  const chapter = repertoire[chapterIndex];

  const [format, setFormat] = useState<ExportFormat>('pgn');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    exportChapter(chapter, format == 'chessrepeat');
  };

  return (
    <dialog
      open
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20
                 border-none bg-white rounded-lg shadow-lg w-full max-w-md"
    >
      {/* Close */}
      <button
        className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full h-8 w-8
                   flex items-center justify-center shadow-md hover:bg-red-600"
        onClick={onClose}
        type="button"
        aria-label="Close"
      >
        <CircleXIcon className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Export Chapter</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose a single export format for <span className="font-medium text-gray-700">{chapter.name}</span>.
        </p>
      </div>

      {/* Options (mutually exclusive “checkbox-like” rows) */}
      <div className="p-6 space-y-3">
        {/* PGN */}
        <button
          type="button"
          onClick={() => setFormat('pgn')}
          className={`w-full text-left rounded-lg border p-4 transition flex items-start gap-3
            ${format === 'pgn' ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200 hover:bg-gray-50'}`}
        >
          <span
            className={`mt-1 h-4 w-4 rounded border flex items-center justify-center
              ${format === 'pgn' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}
            aria-hidden="true"
          >
            {format === 'pgn' ? <span className="h-2 w-2 rounded bg-white" /> : null}
          </span>

          <div className="flex-1">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <FileTextIcon className="w-4 h-4" />
              PGN (.pgn)
            </div>
            <div className="text-sm text-gray-500">Standard chess format compatible with most tools.</div>
          </div>
        </button>

        {/* Chessrepeat */}
        <button
          type="button"
          onClick={() => setFormat('chessrepeat')}
          className={`w-full text-left rounded-lg border p-4 transition flex items-start gap-3
            ${
              format === 'chessrepeat'
                ? 'border-blue-600 ring-2 ring-blue-200'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
        >
          <span
            className={`mt-1 h-4 w-4 rounded border flex items-center justify-center
              ${format === 'chessrepeat' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}
            aria-hidden="true"
          >
            {format === 'chessrepeat' ? <span className="h-2 w-2 rounded bg-white" /> : null}
          </span>

          <div className="flex-1">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              Chessrepeat (.chessrepeat)
              <span className="relative group inline-flex items-center">
                <InfoIcon className="w-4 h-4 text-gray-500 group-hover:text-gray-800 transition" />
                <span
                  className="pointer-events-none absolute left-1/2 top-full mt-2 w-72
                             -translate-x-1/2 rounded-lg border border-gray-200
                             bg-white px-3 py-2 text-xs text-gray-700 shadow
                             opacity-0 translate-y-1
                             group-hover:opacity-100 group-hover:translate-y-0 transition"
                  role="tooltip"
                >
                  A Chessrepeat file is a special annotated export that you can re-import later to restore the
                  chapter and keep your training progress (e.g., “seen” status and app-specific metadata).
                </span>
              </span>
            </div>
            <div className="text-sm text-gray-500">Best for backups and continuing training later.</div>
          </div>
        </button>

        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          type="button"
          className="px-4 py-2 rounded-lg font-semibold bg-gray-100 hover:bg-gray-200"
          disabled={isExporting}
        >
          Cancel
        </button>

        <button
          onClick={handleExport}
          type="button"
          disabled={isExporting}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition
            ${isExporting ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        >
          <DownloadIcon className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </dialog>
  );
};

export default ExportChapterModal;
