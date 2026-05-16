//TODO repertoire and repertoire section in same file

import {
  BookOpenIcon,
  BookPlus,
  DownloadIcon,
  FilePlus2Icon,
  LucideCloudOff,
  LucideCloudUpload,
  LucideGraduationCap,
  LucideHistory,
  LucideRepeat,
  LucideRepeat2,
  LucideUpload,
  PlusIcon,
  Settings2Icon,
  SettingsIcon,
} from 'lucide-react';
import { useStore } from 'zustand';
import { useTrainerStore } from '../../store/state';
import EditChapterModal from '../modals/EditChapterModal';
import DownloadModal from '../modals/DownloadModal';
import React, { useState } from 'react';
import { Chapter } from '../../types/training';
import { useAuthStore } from '../../store/auth';

export const ChapterRow = ({ entry, index, id }) => {
  const setRepertoireIndex = useStore(useTrainerStore, (s) => s.setRepertoireIndex);
  const clearChapterContext = useTrainerStore((s) => s.clearChapterContext);
  const repertoireIndex = useTrainerStore().repertoireIndex;
  const [editOpen, setEditOpen] = useState(false);
  const meta = entry;
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
          onClick={() => setEditOpen(false)}
        >
          <div
            className="z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <EditChapterModal chapterIndex={index} onClose={() => setEditOpen(false)} />
          </div>
        </div>
      )}

      <div
        id="chapter-wrap"
        onClick={handleChangeChapter}
        className={repertoireIndex === index ? 'bg-cyan-50' : ''}
      >
        <div className="chapter flex items-center justify-around hover:bg-cyan-50 pl-2 py-0.5">
          <span className="font-bold pr-3 text-brand-blue flex-shrink-0">{index + 1}</span>

          <h3 className="text-md font-light flex flex-1 min-w-0 gap-2 whitespace-nowrap items-end">
            <span className="text-sm truncate leading-none">{name}</span>
            <span className="text-xs italic font-mono flex-shrink-0 leading-none">{meta.enabledCount}</span>
          </h3>

          {entry.unseenCount > 0 && (
            <button className="font-roboto text-sm font-medium bg-brand-blue-light/40 text-sky-700 rounded-md px-2 mr-2 flex-shrink-0 flex items-center">
              <span className="chapter-btn-label"><LucideGraduationCap size={18}/></span>{entry.unseenCount}
            </button>
          )}

          {entry.lastDueCount > 0 && (
            <button className="font-roboto text-sm font-medium bg-brand-blue/30 text-blue-800 rounded-md px-2 mr-2 flex-shrink-0 flex items-center">
              <span className="chapter-btn-label"><LucideHistory size={18}/> </span>{entry.lastDueCount}
            </button>
          )}

          <div
            id="edit-chapter"
            className="ml-auto mr-2 text-slate-500 cursor-pointer flex-shrink-0"
            onClick={() => setEditOpen(true)}
          >
            <div id="icon-wrap">
              <Settings2Icon width={20} height={20}/>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
};

const Repertoire: React.FC = () => {
  const whiteEntries: Chapter[] = [];
  const blackEntries: Chapter[] = [];

  const repertoire = useTrainerStore().repertoire;
  const repertoireAuthor = useTrainerStore().repertoireAuthor;
  const setShowingAddToRepertoireMenu = useTrainerStore((s) => s.setShowingAddToRepertoireMenu);
  const isAuth = useAuthStore().isAuthenticated(); // TODO don't use auth state to keep track of network connection
  const authUsername = useAuthStore().user?.username;
  const viewingOther = !!repertoireAuthor && !!authUsername && repertoireAuthor !== authUsername;
  const title = viewingOther ? `${repertoireAuthor}'s Repertoire` : 'My Repertoire';

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const isEmpty = repertoire.length === 0;

  repertoire.forEach((entry) => {
    if (entry.trainAs == 'white') whiteEntries.push(entry);
    else blackEntries.push(entry);
  });

  return (
    <div id="repertoire" className="flex flex-1 flex-col min-h-0 rounded-xl border border-gray-300 bg-white">
      {/* fixed header */}
      <div id="repertoire-header" className="shrink-0 flex flex-row items-center p-3 gap-2">
        <div id="reperoire-icon-wrap" className="shrink-0 text-gray-500 bg-gray-200 p-1 rounded">
          <BookOpenIcon />
        </div>
        <span className="text-gray-800 font-semibold text-lg">{title}</span>
        {isAuth ? (
          <span className="ml-auto text-green-600" title="Synced">
            <LucideCloudUpload size={18}/>
          </span>
        ) : (
          <span className="ml-auto text-red-600" title="Offline — changes not synced">
            <LucideCloudOff size={18}/>
          </span>
        )}
      </div>
      
      {/* ONLY THIS SCROLLS */}
      <div
        id="repertoire-wrap"
        className="
        repertoire-scroll
        flex-1 min-h-0 overflow-y-auto pb-2
        pr-1
      "
      >
        <span className="font-semibold text-sm uppercase px-2 text-gray-600">White</span>
        <div className="flex-row rounded-md">
          {whiteEntries.map((entry, index) => (
            <ChapterRow id={entry.id} entry={entry} index={index} />
          ))}
        </div>

        <span className="font-semibold text-sm uppercase px-2 text-gray-600">Black</span>
        <div className="flex-row rounded-md">
          {blackEntries.map((entry, index) => (
            <ChapterRow id={entry.id} entry={entry} index={index + whiteEntries.length} />
          ))}
        </div>
      </div>

      {/* Repertoire-level actions */}
      <div className="shrink-0 border-t border-gray-200 p-1 flex gap-1">
        <button
          type="button"
          onClick={() => setShowingAddToRepertoireMenu(true)}
          className={`flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-md px-1
            text-sm text-gray-600 hover:bg-gray-100 transition active:scale-[0.98]
            ${isEmpty ? 'ring-4 ring-yellow-400/50 ring-offset-2 ring-offset-white' : ''}`}
        >
          <LucideUpload size={18} />
          <span>add to repertoire</span>
        </button>
        <button
          type="button"
          onClick={() => setIsDownloadOpen(true)}
          disabled={isEmpty}
          aria-label="Download repertoire"
          className={`flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-md px-1
            text-sm transition active:scale-[0.98] ${
              isEmpty
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          <DownloadIcon className="w-[18px] h-[18px]" />
          <span>download</span>
        </button>
      </div>

      {isDownloadOpen && <DownloadModal onClose={() => setIsDownloadOpen(false)} />}
    </div>
  );
};

export default Repertoire;
