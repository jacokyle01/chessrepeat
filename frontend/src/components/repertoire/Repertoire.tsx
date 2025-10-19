//TODO repertoire and repertoire section in same file

import { FileCog } from 'lucide-react';
import { useStore } from 'zustand';
import { useTrainerStore } from '../../state/state';
import { Modal } from '../modals/Modal';
import EditChapterModal from '../modals/EditChapterModal';
import React, { Dispatch, SetStateAction, useState } from 'react';
import { RepertoireChapter, RepertoireEntry } from '../../types/types';
import { BookDown, BookOpenIcon, BookPlus } from 'lucide-react';
// import { progress } from './progress'; // Uncomment if needed

interface RepertoireSectionProps {
  repertoire: RepertoireChapter[];
  startsAt: number;
  repertoireIndex: number;
  deleteChapter: (index: number) => void;
  renameChapter: (index: number, name: string) => void;
}

export const Chapter = ({ entry, index, deleteChapter, renameChapter }) => {
  const setRepertoireIndex = useStore(useTrainerStore, (s) => s.setRepertoireIndex);
  const clearChapterContext = useTrainerStore((s) => s.clearChapterContext);
  const repertoireIndex = useTrainerStore().repertoireIndex;
  const cbConfig = useTrainerStore().cbConfig;

  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const meta = entry;
  const unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);
  const name = entry.name;

  const handleChangeChapter = () => {
    console.log("handle change chapter");
    setRepertoireIndex(index);
    clearChapterContext();
    console.log("cbc", cbConfig);
  };

  return (
    <React.Fragment key={index}>
      {editOpen && (
        <EditChapterModal
          chapterIndex={index}
          onClose={() => setEditOpen(false)}
          onRename={renameChapter}
          onDelete={deleteChapter}
          onSetAllSeen={() => console.log('set all seen')}
        />
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
            <span className="text-xs italic font-mono mb-1">{meta.nodeCount}</span>
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
        </div>

        {/* Rename Modal */}
        <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename Chapter">
          <input
            type="text"
            placeholder="New chapter name"
            className="w-full border rounded-md p-2 mb-4"
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => {
              renameChapter(index, newName);
              setRenameOpen(false);
            }}
          >
            Save
          </button>
        </Modal>

        {/* Delete Modal */}
        <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Chapter">
          <p className="mb-4 text-gray-700">
            Are you sure you want to delete this chapter? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded-md border hover:bg-gray-100"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              onClick={() => {
                deleteChapter(index);
                setDeleteOpen(false);
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      </div>
    </React.Fragment>
  );
};

const Repertoire: React.FC = ({ deleteChapter, renameChapter }) => {
  const whiteEntries: RepertoireChapter[] = [];
  const blackEntries: RepertoireChapter[] = [];

  const repertoire = useTrainerStore().repertoire;
  console.log('rep', repertoire);

  repertoire.forEach((entry) => {
    if (entry.trainAs == 'white') whiteEntries.push(entry);
    else blackEntries.push(entry);
  });

  console.log('white entries', whiteEntries);
  console.log('black entries', blackEntries);
  // div.flex.flex-col.bg-white.bg-clip-border.text-gray-700.shadow-md.rounded-md.border.border-gray-200.mt-4.pb-5
  // class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"

  return (
    <div id="repertoire" className="flex flex-col rounded-xl border border-gray-300 bg-white pb-2">
      <div className="flex flex-col rounded-md pb-2 h-2/5 overflow-y-auto">
        <div id="repertoire-header" className="flex flex-row items-center justify-left p-3 gap-2">
          <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
            <BookOpenIcon></BookOpenIcon>
          </div>
          <span className="text-gray-800 font-semibold text-xl">My Repertoire</span>
        </div>
        <div id="repertoire-wrap">
          <span className="font-semibold text-sm uppercase px-2 pl-4 text-gray-600 space-x-1">White</span>
          <div id="chapter-tree-wrap" className="flex-row rounded-md">
            {whiteEntries.map((entry, index) => (
              <Chapter
                key={index}
                entry={entry}
                index={index}
                deleteChapter={deleteChapter}
                renameChapter={renameChapter}
              />
            ))}
          </div>
          <span className="font-semibold text-sm uppercase px-2 pl-4 text-gray-600">Black</span>
          <div id="chapter-tree-wrap" className="flex-row rounded-md">
            {blackEntries.map((entry, index) => (
              // ensure our index matches this entry's index in the actual repertoire array
              <Chapter
                key={index}
                entry={entry}
                index={index + whiteEntries.length}
                deleteChapter={deleteChapter}
                renameChapter={renameChapter}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Repertoire;
