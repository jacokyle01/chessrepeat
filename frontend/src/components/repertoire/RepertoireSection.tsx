//TODO better name?

import React, { useState } from 'react';
import { RepertoireChapter, RepertoireEntry } from '../../types/types';
import { smallGear } from '../../svg/smallGear';
import RepertoireDropdown from './RepertoireDropdown';
import { FileX, LucideFileEdit, Settings } from 'lucide-react';
import { useAtom } from 'jotai';
import { useStore } from 'zustand';
import { useTrainerStore } from '../../state/state';
import { Modal } from '../modals/Modal';
// const { setOrientation } = useTrainerStore();

interface RepertoireSectionProps {
  repertoire: RepertoireChapter[];
  startsAt: number;
  repertoireIndex: number;
  deleteChapter: (index: number) => void;
  renameChapter: (index: number, name: string) => void;
}

export const RepertoireSection: React.FC<RepertoireSectionProps> = ({
  repertoire,
  startsAt,
  repertoireIndex,
  deleteChapter,
  renameChapter,
}) => {
  // const [repertoireIndex, setRepertoireIndex] = useAtom(repertoireIndexAtom);

  const setRepertoireIndex = useStore(useTrainerStore, (s) => s.setRepertoireIndex);
  const setOrientation = useStore(useTrainerStore, (s) => s.setOrientation);
  const clearChapterContext = useTrainerStore((s) => s.clearChapterContext);

  //TODO BUG: renaming/deleting the wrong chapter?
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState(''); // holds input value

  // console.log("repertoire section", repertoire);
  return (
    <div id="chapter-tree-wrap" className="flex-row rounded-md">
      {repertoire.map((entry, index) => {
        const meta = entry;
        const unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);
        const name = entry.name;
        const fullIndex = index + startsAt;

        const handleChangeChapter = () => {
          // ctrl.selectChapter(fullIndex);
          setRepertoireIndex(fullIndex);
          const chapter = repertoire[repertoireIndex];
          setOrientation(chapter.trainAs);
          clearChapterContext();
        };

        // const handleSettingsClick = (e: React.MouseEvent) => {
        //   e.stopPropagation();
        //   ctrl.subrepSettingsIndex =
        //     ctrl.subrepSettingsIndex === fullIndex ? -1 : fullIndex;
        // };

        return (
          <div
            key={fullIndex}
            id="chapter-wrap"
            onClick={handleChangeChapter}
            className={repertoireIndex === fullIndex ? 'bg-cyan-50' : ''}
          >
            <div className="chapter flex items-center justify-around hover:bg-cyan-50 pl-4 py-0.5">
              <span className="font-bold pr-3 text-blue-600">{fullIndex + 1}</span>
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
              <div
                id="chapter-settings"
                className="text-gray-600 cursor-pointer"
                onClick={() => setRenameOpen(true)}
              >
                <LucideFileEdit />
              </div>

              {/* Delete icon → opens delete modal */}
              <div
                id="delete-chapter"
                className="ml-auto mr-2 text-gray-600 cursor-pointer"
                onClick={() => setDeleteOpen(true)}
              >
                <FileX />
              </div>
            </div>

            {/* Rename Modal */}
            <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename Chapter">
              <input
                type="text"
                placeholder="New chapter name"
                className="w-full border rounded-md p-2 mb-4"
                onChange={(e) => setNewName(e.target.value)} // update state on typing
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
        );
      })}
    </div>
  );
};

export default RepertoireSection;
