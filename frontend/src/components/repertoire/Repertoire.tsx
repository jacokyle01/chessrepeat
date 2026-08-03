//TODO repertoire and repertoire section in same file

import {
  ArrowLeftIcon,
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
import { viewUserRepertoire } from '../../services/collaborators';
import './Repertoire.css';

export const ChapterRow = ({ entry, index, id }) => {
  const setSelectedChapterId = useStore(useTrainerStore, (s) => s.setSelectedChapterId);
  const clearChapterContext = useTrainerStore((s) => s.clearChapterContext);
  const updateDueCounts = useTrainerStore().updateDueCounts;
  const selectedChapterId = useTrainerStore().selectedChapterId;
  const [editOpen, setEditOpen] = useState(false);
  const meta = entry;
  const name = entry.name;
  const isSelected = selectedChapterId === entry.uuid;

  //TODO dont change if already on this chapter..
  //TODO dont clear all chapter context? maybe dont change trainingMethod
  const handleChangeChapter = () => {
    setSelectedChapterId(entry.uuid);
    clearChapterContext();
    updateDueCounts();
  };

  return (
    <React.Fragment key={index}>
      {editOpen && (
        <div className="chapter-edit-backdrop" onClick={() => setEditOpen(false)}>
          <div className="chapter-edit-dialog-wrap" onClick={(e) => e.stopPropagation()}>
            <EditChapterModal chapterId={entry.uuid} onClose={() => setEditOpen(false)} />
          </div>
        </div>
      )}

      <div
        id="chapter-wrap"
        onClick={handleChangeChapter}
        className={`chapter-row ${isSelected ? 'is-selected' : ''}`}
      >
        <div className="chapter">
          <span className="chapter-index">{index + 1}</span>

          <h3 className="chapter-title">
            <span className={`chapter-name ${isSelected ? 'is-selected' : ''}`}>{name}</span>
            <span className="chapter-size">{meta.enabledCount}</span>
          </h3>

          {entry.unseenCount > 0 && (
            <button className="chapter-count chapter-count-unseen">
              <span className="chapter-btn-label">
                <LucideGraduationCap size={18} />
              </span>
              {entry.unseenCount}
            </button>
          )}

          {entry.lastDueCount > 0 && (
            <button className="chapter-count chapter-count-due">
              <span className="chapter-btn-label">
                <LucideHistory size={18} />
              </span>
              {entry.lastDueCount}
            </button>
          )}

          <div id="edit-chapter" className="chapter-edit" onClick={() => setEditOpen(true)}>
            <Settings2Icon width={20} height={20} />
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
  const title = viewingOther ? `${repertoireAuthor}'s repertoire` : 'Repertoire';

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  const isEmpty = repertoire.length === 0;

  repertoire.forEach((entry) => {
    if (entry.trainAs == 'white') whiteEntries.push(entry);
    else blackEntries.push(entry);
  });

  return (
    <div id="repertoire" className="repertoire-card">
      {/* fixed header */}
      <div className="panel-header">
        {viewingOther && authUsername ? (
          <button
            type="button"
            onClick={() => void viewUserRepertoire(authUsername)}
            aria-label="Back to my repertoire"
            title="Back to my repertoire"
            className="panel-icon repertoire-back-btn"
          >
            <ArrowLeftIcon />
          </button>
        ) : (
          <div id="reperoire-icon-wrap" className="panel-icon">
            <BookOpenIcon />
          </div>
        )}
        <div className="panel-titles">
          <span className="panel-title">{title}</span>
          <span className="panel-subtitle">
            {repertoire.length} chapter{repertoire.length === 1 ? '' : 's'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowingAddToRepertoireMenu(true)}
          aria-label="Add to repertoire"
          title="Add to repertoire"
          className={`panel-action repertoire-add-btn ${isEmpty ? 'is-empty' : ''}`}
        >
          <LucideUpload size={18} />
          <span className="chapter-btn-label">add</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDownloadOpen(true)}
          disabled={isEmpty}
          aria-label="Download repertoire"
          title="Download repertoire"
          className="panel-action"
        >
          <DownloadIcon />
          <span className="chapter-btn-label">download</span>
        </button>
        {isAuth ? (
          <span className="repertoire-sync repertoire-sync-online" title="Synced">
            <LucideCloudUpload size={18} />
          </span>
        ) : (
          <span
            className="repertoire-sync repertoire-sync-offline"
            title="Offline — changes not synced"
          >
            <LucideCloudOff size={18} />
          </span>
        )}
      </div>

      {/* ONLY THIS SCROLLS */}
      <div id="repertoire-wrap" className="repertoire-scroll repertoire-list">
        <span className="repertoire-group-label">White</span>
        <div className="repertoire-group">
          {whiteEntries.map((entry, index) => (
            <ChapterRow id={entry.id} entry={entry} index={index} />
          ))}
        </div>

        <span className="repertoire-group-label">Black</span>
        <div className="repertoire-group">
          {blackEntries.map((entry, index) => (
            <ChapterRow id={entry.id} entry={entry} index={index + whiteEntries.length} />
          ))}
        </div>
      </div>

      {isDownloadOpen && <DownloadModal onClose={() => setIsDownloadOpen(false)} />}
    </div>
  );
};

export default Repertoire;
