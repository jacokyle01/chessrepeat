// Repertoire.tsx
// Uses chapterMeta only (no full roots). Uses chapter.id everywhere.
// Clicking a chapter calls setActiveChapterById(chapterId) ONLY if not already active.

import React, { useState } from 'react';
import { BookOpenIcon, FileCog, FileDown } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import EditChapterModal from '../modals/EditChapterModal';
import ExportChapterModal from '../modals/ExportChapterModal';

// Prefer importing PersistedChapterMeta from your persist module:
// import type { PersistedChapterMeta as ChapterMeta } from '../../newState/persist';
export type ChapterMeta = {
  id: string;
  name: string;
  trainAs: 'white' | 'black';
  nodeCount: number;
  bucketEntries: number[];
  lastDueCount: number;
};

type ChapterRowProps = {
  meta: ChapterMeta;
  indexLabel: number; // 1-based display number
};

const ChapterRow: React.FC<ChapterRowProps> = ({ meta, indexLabel }) => {
  const activeChapterId = useTrainerStore((s) => s.activeChapterId);
  const setActiveChapterById = useTrainerStore((s) => s.setActiveChapterById);
  const clearChapterContext = useTrainerStore((s) => s.clearChapterContext);

  const [editOpen, setEditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const isActive = activeChapterId === meta.id;
  const unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);

  const handleSelect = async () => {
    if (isActive) return;

    // IMPORTANT: clear first (or put this inside setActiveChapterById)
    clearChapterContext();
    await setActiveChapterById(meta.id);
  };

  return (
    <>
      {editOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setEditOpen(false)}
        >
          <div className="z-50" onClick={(e) => e.stopPropagation()}>
            {/* Update your modal API to use chapterId instead of index */}
            <EditChapterModal chapterId={meta.id} onClose={() => setEditOpen(false)} />
          </div>
        </div>
      )}

      {exportOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setExportOpen(false)}
        >
          <div className="z-50" onClick={(e) => e.stopPropagation()}>
            <ExportChapterModal chapterId={meta.id} onClose={() => setExportOpen(false)} />
          </div>
        </div>
      )}

      <div
        id={`chapter-${meta.id}`}
        data-chapter-id={meta.id}
        onClick={handleSelect}
        className={isActive ? 'bg-cyan-50' : ''}
      >
        <div className="chapter flex items-center justify-around hover:bg-cyan-50 pl-4 py-0.5 cursor-pointer">
          <span className="font-bold pr-3 text-blue-600">{indexLabel}</span>

          <h3 className="text-lg font-light flex-1 gap-2 flex items-end">
            <span className="text-md">{meta.name}</span>
            <span className="text-xs italic font-mono mb-1">{meta.nodeCount}</span>
          </h3>

          {unseenCount > 0 && (
            <button
              type="button"
              className="font-roboto text-sm font-medium text-blue-700 bg-blue-500/20 rounded-full px-2 font-black mr-2"
              onClick={(e) => {
                e.stopPropagation();
                void handleSelect();
                // optionally: setTrainingMethod('learn')
              }}
            >
              Learn {unseenCount}
            </button>
          )}

          {meta.lastDueCount > 0 && (
            <button
              type="button"
              className="font-roboto text-sm font-medium text-orange-700 bg-orange-500/20 rounded-full px-2 font-black mr-2"
              onClick={(e) => {
                e.stopPropagation();
                void handleSelect();
                // optionally: setTrainingMethod('recall')
              }}
            >
              Recall {meta.lastDueCount}
            </button>
          )}

          {/* icons: stopPropagation so they don't also select */}
          <button
            type="button"
            className="ml-auto mr-2 text-gray-600"
            onClick={async (e) => {
              e.stopPropagation();
              await setActiveChapterById(meta.id);
              setEditOpen(true);
            }}
            aria-label="Edit chapter"
          >
            <FileCog />
          </button>

          <button
            type="button"
            className="mr-2 text-gray-600"
            onClick={async (e) => {
              e.stopPropagation();
              await setActiveChapterById(meta.id);
              setExportOpen(true);
            }}
            aria-label="Export chapter"
          >
            <FileDown />
          </button>
        </div>
      </div>
    </>
  );
};

const Repertoire: React.FC = () => {
  // ✅ correct store field name from your new TrainerState
  const chapterMeta = useTrainerStore((s) => s.chapterMeta);
  console.log('META IN REPERTOIRE', chapterMeta);

  //TODO could memoize this computuation...
  const white = chapterMeta.filter((m) => m.trainAs === 'white');
  const black = chapterMeta.filter((m) => m.trainAs === 'black');

  return (
    <div id="repertoire" className="flex flex-col flex-1 min-h-0 rounded-xl border border-gray-300 bg-white">
      {/* fixed header */}
      <div id="repertoire-header" className="shrink-0 flex flex-row items-center p-3 gap-2">
        <div id="repertoire-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
          <BookOpenIcon />
        </div>
        <span className="text-gray-800 font-semibold text-xl">My Repertoire</span>
      </div>

      {/* ONLY THIS SCROLLS */}
      <div id="repertoire-wrap" className="flex-1 min-h-0 overflow-y-auto pb-2">
        <span className="font-semibold text-sm uppercase px-2 pl-4 text-gray-600">White</span>
        <div className="flex-row rounded-md">
          {white.map((meta, i) => (
            <ChapterRow key={meta.id} meta={meta} indexLabel={i + 1} />
          ))}
        </div>

        <span className="font-semibold text-sm uppercase px-2 pl-4 text-gray-600">Black</span>
        <div className="flex-row rounded-md">
          {black.map((meta, i) => (
            <ChapterRow key={meta.id} meta={meta} indexLabel={white.length + i + 1} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Repertoire;
