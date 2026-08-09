//TODO repertoire and repertoire section in same file

import { FaChessKing, FaRegChessKing } from 'react-icons/fa6';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  CheckIcon,
  BookPlus,
  ChevronRightIcon,
  DownloadIcon,
  FilePlus2Icon,
  Globe,
  LucideCloudOff,
  LucideCloudUpload,
  LucideRepeat,
  LucideRepeat2,
  LucideUpload,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { useStore } from 'zustand';
import { useTrainerStore } from '../../store/state';
import DownloadModal from '../modals/DownloadModal';
import React, { useEffect, useState } from 'react';
import { Chapter } from '../../types/training';
import { useAuthStore } from '../../store/auth';
import { viewUserRepertoire } from '../../services/collaborators';
import './Repertoire.css';

export const ChapterRow = ({ entry, index }) => {
  const setSelectedChapterId = useStore(useTrainerStore, (s) => s.setSelectedChapterId);
  const clearChapterContext = useTrainerStore((s) => s.clearChapterContext);
  const renameChapter = useTrainerStore((s) => s.renameChapter);
  const deleteChapterAt = useTrainerStore((s) => s.deleteChapterAt);
  const updateDueCounts = useTrainerStore().updateDueCounts;
  const selectedChapterId = useTrainerStore().selectedChapterId;
  // The chapter's actions open as a row of their own directly below it, rather
  // than as a popover. `view` is which face that row is showing; 'closed' means
  // there is no row. Rename and delete are faces of the same row, so the whole
  // flow stays inline in the list.
  const [view, setView] = useState<'closed' | 'menu' | 'rename' | 'delete'>('closed');
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const meta = entry;
  const name = entry.name;
  const isSelected = selectedChapterId === entry.uuid;
  const isOpen = view !== 'closed';
  const actionsId = `chapter-actions-${entry.uuid}`;

  //TODO dont change if already on this chapter..
  //TODO dont clear all chapter context? maybe dont change trainingMethod
  const handleChangeChapter = () => {
    setSelectedChapterId(entry.uuid);
    clearChapterContext();
    updateDueCounts();
  };

  const closeMenu = () => {
    setView('closed');
    setRenameError(null);
  };

  const toggleMenu = () => {
    if (isOpen) return closeMenu();
    // always reopen on the menu itself, never on whatever panel was last used
    setRenameError(null);
    setView('menu');
  };

  // The row sits in the list rather than over it, so it doesn't need the
  // click-outside / scroll / resize teardown a popover does — only Escape,
  // which is the one dismissal a keyboard user expects to work from anywhere.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const openRename = () => {
    setDraftName(name);
    setRenameError(null);
    setView('rename');
  };

  const trimmedName = draftName.trim();
  const canCommitRename = !!trimmedName && trimmedName !== name;

  /** Save the pending name (if there is one) and close the menu. */
  const commitRename = async () => {
    if (!canCommitRename) return closeMenu();
    setRenameError(null);
    try {
      await renameChapter(entry.uuid, trimmedName);
      closeMenu();
    } catch (err: any) {
      // stay open on failure so the typed name isn't lost
      setRenameError(err?.message ?? 'Failed to rename chapter.');
    }
  };

  const handleDelete = async () => {
    await deleteChapterAt(entry.uuid);
    closeMenu();
  };

  return (
    <React.Fragment key={index}>
      <div
        id="chapter-wrap"
        onClick={handleChangeChapter}
        className={`chapter-row ${isSelected ? 'is-selected' : ''}`}
      >
        <div className="chapter">
          <span className="chapter-index">{index + 1}</span>

          {/* Outline king for white, filled for black — the same way a chess
              diagram distinguishes the two sides. */}
          <span className="chapter-side" title={`Trained as ${entry.trainAs}`}>
            {entry.trainAs === 'white' ? <FaRegChessKing /> : <FaChessKing />}
          </span>

          <h3 className="chapter-title">
            <span className={`chapter-name ${isSelected ? 'is-selected' : ''}`}>{name}</span>
            <span className="chapter-size">
              {meta.enabledCount} move{meta.enabledCount === 1 ? '' : 's'}
            </span>
          </h3>

          {/* counts only — the color says which is which, the same way the
              progress bar above the board does */}
          {entry.unseenCount > 0 && (
            <button className="chapter-count chapter-count-unseen" title={`Learn ${entry.unseenCount} moves`}>
              {entry.unseenCount}
            </button>
          )}

          {entry.lastDueCount > 0 && (
            <button
              className="chapter-count chapter-count-due"
              title={`Recall ${entry.lastDueCount} moves`}
            >
              {entry.lastDueCount}
            </button>
          )}

          <div className="chapter-menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`chapter-menu-btn ${isOpen ? 'is-open' : ''}`}
              aria-expanded={isOpen}
              aria-controls={actionsId}
              aria-label="Chapter options"
              onClick={toggleMenu}
            >
              <ChevronRightIcon width={16} height={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Actions get a row of their own under the chapter instead of a
          floating menu, so nothing overlays the list and the bottom rows
          can't be clipped by its scroll container. */}
      {isOpen && (
        <div id={actionsId} className={`chapter-actions is-${view}`}>
          {view === 'menu' && (
            <>
              <button type="button" className="chapter-action-btn" onClick={openRename}>
                <PencilIcon size={14} />
                Rename
              </button>
              <button
                type="button"
                className="chapter-action-btn is-danger"
                onClick={() => setView('delete')}
              >
                <TrashIcon size={14} />
                Delete
              </button>
            </>
          )}

          {view === 'rename' && (
            <div className="chapter-action-panel">
              <div className="chapter-action-rename">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') closeMenu();
                  }}
                  aria-label="Chapter name"
                  autoFocus
                />
                <button
                  type="button"
                  className="chapter-action-confirm"
                  onClick={commitRename}
                  disabled={!canCommitRename}
                  aria-label="Save name"
                  title="Save name"
                >
                  <CheckIcon size={16} />
                </button>
              </div>
              {renameError && <p className="chapter-action-error">{renameError}</p>}
            </div>
          )}

          {view === 'delete' && (
            <div className="chapter-action-panel">
              <p className="chapter-action-warning">Delete this chapter? This cannot be undone.</p>
              <div className="chapter-action-confirm-row">
                <button type="button" className="chapter-action-confirm-no" onClick={() => setView('menu')}>
                  Cancel
                </button>
                <button type="button" className="chapter-action-confirm-yes" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </React.Fragment>
  );
};

type RepertoireProps = {
  onOpenCollaborators?: () => void;
};

const Repertoire: React.FC<RepertoireProps> = ({ onOpenCollaborators }) => {
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

        {/* Sharing is a repertoire action, so it sits with the other two rather
            than up in the app bar. */}
        {isAuth && onOpenCollaborators && (
          <button
            type="button"
            onClick={onOpenCollaborators}
            aria-label="Share repertoire"
            title="Share repertoire"
            className="panel-action"
          >
            <Globe />
            <span className="chapter-btn-label">share</span>
          </button>
        )}
        {isAuth ? (
          <span className="repertoire-sync repertoire-sync-online" title="Synced">
            <LucideCloudUpload size={18} />
          </span>
        ) : (
          <span className="repertoire-sync repertoire-sync-offline" title="Offline — changes not synced">
            <LucideCloudOff size={18} />
          </span>
        )}
      </div>

      {/* ONLY THIS SCROLLS */}
      <div id="repertoire-wrap" className="repertoire-scroll repertoire-list">
        {/* One list rather than a section per side: each row carries its own
            king, so the white chapters simply come first. */}
        <div className="repertoire-group">
          {[...whiteEntries, ...blackEntries].map((entry, index) => (
            <ChapterRow key={entry.uuid} entry={entry} index={index} />
          ))}
        </div>
      </div>

      {isDownloadOpen && <DownloadModal onClose={() => setIsDownloadOpen(false)} />}
    </div>
  );
};

export default Repertoire;
