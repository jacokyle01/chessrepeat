import React from 'react';
import PrepCtrl from '../../ctrl';
import { trashI } from '../../svg/trash';
import { renameI } from '../../svg/rename';
import { seenI } from '../../svg/seen';
import { editI } from '../../svg/edit';
import { Glasses, Pencil, PencilLine, Trash } from 'lucide-react';

interface RepertoireDropdownProps {
  thisIndex: number;
  startsAt: number;
}

const RepertoireDropdown: React.FC<RepertoireDropdownProps> = ({ thisIndex, startsAt }) => {
  const absoluteIndex = thisIndex + startsAt;
  // const visible = ctrl.subrepSettingsIndex === absoluteIndex;

  const handleDelete = () => {
    console.log('Delete clicked');
    // ctrl.deleteChapter(absoluteIndex);
    // ctrl.subrepSettingsIndex = -1;
  };

  const handleRename = () => {
    console.log('Rename clicked');
    const newName = prompt('Enter new name') || '';
    // ctrl.repertoire[absoluteIndex].name = newName;
  };

  const handleSeen = () => {
    console.log('Seen clicked');
    // ctrl.toggleEditingSubrep();
  };

  const handleEdit = () => {
    // ctrl.toggleEditingSubrep();
  };

  // if (!visible) return null;

  return (
    <div className="dropdown-menu bg-white z-10 shadow-md rounded-md border border-gray-200 flex flex-row">
      <div
        className="option flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-gray-100"
        onClick={handleDelete}
      >
        <Trash />
        <span className="text-sm">Delete</span>
      </div>

      <div
        className="option flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-gray-100"
        onClick={handleRename}
      >
        <Pencil />
        <span className="text-sm">Rename</span>
      </div>

      <div
        className="option flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-gray-100"
        onClick={handleSeen}
      >
        <Glasses></Glasses>
        <span className="text-sm">All seen</span>
      </div>

      <div
        className="option flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md hover:bg-gray-100"
        onClick={handleEdit}
      >
        <PencilLine />
        <span className="text-sm">Edit PGN</span>
      </div>
    </div>
  );
};

export default RepertoireDropdown;
