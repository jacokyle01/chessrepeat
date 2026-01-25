//TODO repertoire and repertoire section in same file

import { FileCog, FileDown } from 'lucide-react';
import { useStore } from 'zustand';
import { useTrainerStore } from '../../state/state';
import { Modal } from '../modals/Modal';
import EditChapterModal from '../modals/EditChapterModal';
import React, { Dispatch, SetStateAction, useState } from 'react';
import { RepertoireChapter, RepertoireEntry } from '../../types/types';
import { BookDown, BookOpenIcon, BookPlus } from 'lucide-react';
import { exportChapter } from '../../training/util';
import ExportChapterModal from '../modals/ExportChapterModal';
// import { progress } from './progress'; // Uncomment if needed

interface RepertoireSectionProps {
  repertoire: RepertoireChapter[];
  startsAt: number;
  repertoireIndex: number;
}

export const Chapter = ({ entry, index, id }) => {
  console.log('chapter ID should be visible', id);
  const setRepertoireIndex = useStore(useTrainerStore, (s) => s.setRepertoireIndex);
  const clearChapterContext = useTrainerStore((s) => s.clearChapterContext);
  const repertoireIndex = useTrainerStore().repertoireIndex;
  const cbConfig = useTrainerStore().cbConfig;
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const meta = entry;
  const unseenCount = meta.enabledCount - meta.bucketEntries.reduce((a, b) => a + b, 0);
  const name = entry.name;

  //TODO dont change if already on this chapter..
  const handleChangeChapter = () => {
    setRepertoireIndex(index);
    clearChapterContext();
  };

  return (
    <React.Fragment key={index}>
      {editOpen && (
        <div
          className="
      fixed inset-0 z-40
      bg-black/50 backdrop-blur-sm
      flex items-center justify-center
    "
          onClick={() => setEditOpen(false)} // close on backdrop click
        >
          <div
            className="z-50"
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking modal
          >
            <EditChapterModal
              chapterIndex={index}
              onClose={() => setEditOpen(false)}
              onSetAllSeen={() => console.log('set all seen')}
            />
          </div>
        </div>
      )}

      {exportOpen && (
        <div
          className="
      fixed inset-0 z-40
      bg-black/50 backdrop-blur-sm
      flex items-center justify-center
    "
          onClick={() => setExportOpen(false)} // close on backdrop click
        >
          <div
            className="z-50"
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking modal
          >
            <ExportChapterModal chapterIndex={index} onClose={() => setExportOpen(false)} />
          </div>
        </div>
      )}

      <div
        id="chapter-wrap"
        onClick={handleChangeChapter}
        className={repertoireIndex === index ? 'bg-cyan-50' : ''}
      >
        <div className="chapter flex items-center justify-around hover:bg-cyan-50 pl-4 py-0.5">
          <span className="font-bold pr-3 text-blue-600">{index + 1}</span>
          <h3 className="text-lg font-light flex-1 gap-2 flex items-end">
            <span className="text-md">{name}</span>
            <span className="text-xs italic font-mono mb-1">{meta.enabledCount}</span>
          </h3>

          {unseenCount > 0 && (
            <button className="font-roboto text-sm font-medium text-blue-700 bg-blue-500/20 rounded-full px-2 font-black mr-2">
              Learn {unseenCount}
            </button>
          )}

          {entry.lastDueCount > 0 && (
            <button className="font-roboto text-sm font-medium text-orange-700 bg-orange-500/20 rounded-full px-2 font-black mr-2">
              Recall {entry.lastDueCount}
            </button>
          )}

          {/* Open edit modal */}
          <div
            id="edit-chapter"
            className="ml-auto mr-2 text-gray-600 cursor-pointer"
            onClick={() => setEditOpen(true)}
          >
            <FileCog />
          </div>
          <div
            id="download-chapter"
            className="ml-auto mr-2 text-gray-600 cursor-pointer"
            onClick={() => setExportOpen(true)}
          >
            <FileDown />
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

const Repertoire: React.FC = () => {
  const whiteEntries: RepertoireChapter[] = [];
  const blackEntries: RepertoireChapter[] = [];

  const repertoire = useTrainerStore().repertoire;
  console.log('repertoire component', repertoire);

  repertoire.forEach((entry) => {
    if (entry.trainAs == 'white') whiteEntries.push(entry);
    else blackEntries.push(entry);
  });

  return (
    <div id="repertoire" className="flex flex-col flex-1 min-h-0 rounded-xl border border-gray-300 bg-white">
      {/* fixed header */}
      <div id="repertoire-header" className="shrink-0 flex flex-row items-center p-3 gap-2">
        <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
          <BookOpenIcon />
        </div>
        <span className="text-gray-800 font-semibold text-xl">My Repertoire</span>
      </div>

      {/* ONLY THIS SCROLLS */}
      <div id="repertoire-wrap" className="flex-1 min-h-0 overflow-y-auto pb-2">
        <span className="font-semibold text-sm uppercase px-2 pl-4 text-gray-600 space-x-1">White</span>

        <div className="flex-row rounded-md">
          {whiteEntries.map((entry, index) => (
            <Chapter id={entry.id} entry={entry} index={index} />
          ))}
        </div>

        <span className="font-semibold text-sm uppercase px-2 pl-4 text-gray-600">Black</span>

        <div className="flex-row rounded-md">
          {blackEntries.map((entry, index) => (
            <Chapter id={entry.id} entry={entry} index={index + whiteEntries.length} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Repertoire;
