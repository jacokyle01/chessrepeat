//TODO repertoire and repertoire section in same file

import { CloudAlert, FileCog, FileDown, SettingsIcon } from 'lucide-react';
import { useStore } from 'zustand';
import { useTrainerStore } from '../../state/state';
import { Modal } from '../modals/Modal';
import EditChapterModal from '../modals/EditChapterModal';
import React, { Dispatch, SetStateAction, useState } from 'react';
import { BookDown, BookOpenIcon, BookPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const Chapter = ({ entry, index, id }) => {
  // console.log('chapter ID should be visible', id);
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
  //TODO dont clear all chapter context? maybe dont change trainingMethod
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

      <div
        id="chapter-wrap"
        onClick={handleChangeChapter}
        className={repertoireIndex === index ? 'bg-cyan-50' : ''}
      >
        <div className="chapter flex items-center justify-around hover:bg-cyan-50 pl-4 py-0.5">
          <span className="font-bold pr-3 text-blue-600 flex-shrink-0">{index + 1}</span>

          <h3 className="text-md font-light flex flex-1 min-w-0 gap-2 whitespace-nowrap items-end">
            <span className="text-md truncate leading-none">{name}</span>
            <span className="text-xs italic font-mono flex-shrink-0 leading-none">{meta.enabledCount}</span>
            {!entry.synced && <CloudAlert width={15} height={15} color="red" />}
          </h3>

          {unseenCount > 0 && (
            <button className="font-roboto text-sm font-medium text-blue-700 bg-blue-500/20 rounded-md px-2 font-black mr-2 flex-shrink-0">
              Learn {unseenCount}
            </button>
          )}

          {entry.lastDueCount > 0 && (
            <button className="font-roboto text-sm font-medium text-orange-700 bg-orange-500/20 rounded-md px-2 font-black mr-2 flex-shrink-0">
              Recall {entry.lastDueCount}
            </button>
          )}

          <div
            id="edit-chapter"
            className="ml-auto mr-2 text-gray-600 cursor-pointer flex-shrink-0"
            onClick={() => setEditOpen(true)}
          >
            <div id="icon-wrap">
              <SettingsIcon width={20} height={20} />
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

const Repertoire: React.FC = () => {
  const whiteEntries = [];
  const blackEntries = [];

  const repertoire = useTrainerStore().repertoire;
  const { isAuthenticated } = useAuth();

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
        <div className="alert-wrap pl-1 text-red-400" title="Sign in to sync repertoire across devices!">
          {!isAuthenticated && <CloudAlert />}
        </div>
      </div>

      {/* ONLY THIS SCROLLS */}
      <div id="repertoire-wrap" className="repertoire-scroll flex-1 min-h-0 overflow-y-auto pb-2">
        <span className="font-semibold text-sm uppercase px-2 text-gray-600 space-x-1">White</span>

        <div className="flex-row rounded-md">
          {whiteEntries.map((entry, index) => (
            <Chapter id={entry.id} entry={entry} index={index} />
          ))}
        </div>

        <span className="font-semibold text-sm uppercase px-2 text-gray-600">Black</span>

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
