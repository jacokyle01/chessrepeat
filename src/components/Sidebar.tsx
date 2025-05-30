import React from 'react';
import PrepCtrl from '../ctrl';
import { RepertoireEntry } from '../types/types';
import { repertoire } from './repertoire';
import { addI } from '../svg/add';
import { chart } from './chart';
import { downloadI } from '../svg/download';
// import { progress } from './progress'; // Uncomment if needed

interface SidebarProps {
  ctrl: PrepCtrl;
}

const Sidebar: React.FC<SidebarProps> = ({ ctrl }) => {
  const whiteEntries: RepertoireEntry[] = ctrl.repertoire.slice(0, ctrl.numWhiteEntries);
  const blackEntries: RepertoireEntry[] = ctrl.repertoire.slice(ctrl.numWhiteEntries);

  return (
    <div id="sidebar" className="flex flex-col flex-1 h-lvh">
      <div className="flex flex-col bg-white bg-clip-border text-gray-700 shadow-md rounded-md border border-gray-200 pb-2 h-2/5 overflow-y-auto">
        <span className="text-xl font-bold py-2 pl-2 border-b-2 mb-2 border-gray-300">
          My Repertoire
        </span>
        <div id="repertoire-wrap">
          <span className="font-semibold text-sm uppercase px-2 text-gray-600 space-x-1">White</span>
          {repertoire(whiteEntries, ctrl, 0)}
          <span className="font-semibold text-sm uppercase px-2 text-gray-600">Black</span>
          {repertoire(blackEntries, ctrl, ctrl.numWhiteEntries)}
        </div>
        <div id="repertoire-actions" className="mt-auto flex mt-4">
          <button
            className="flex bg-blue-500 text-white font-bold rounded p-2 gap-1 mx-auto px-5 transition duration-200 ease-in-out hover:bg-blue-600 active:scale-95 shadow-md hover:shadow-lg"
            onClick={() => ctrl.toggleAddingNewSubrep()}
          >
            <div>Add to Repertoire</div>
            {addI()}
          </button>
          <button
            className="flex bg-blue-700 text-white font-bold rounded p-2 gap-1 mx-auto px-5 transition duration-200 ease-in-out hover:bg-blue-800 active:scale-95 shadow-md hover:shadow-lg"
            onClick={() => ctrl.downloadRepertoire()}
          >
            <div>Download</div>
            {downloadI()}
          </button>
        </div>
      </div>

      <div className="flex flex-col bg-white bg-clip-border text-gray-700 shadow-md rounded-md border border-gray-200 mt-4 pb-5">
        <span className="text-xl font-bold py-2 pl-2 border-b-2 mb-2 border-gray-300">
          Memory Schedule
        </span>
        <span className="font-semibold text-gray-600 px-1">Due at</span>
        <div id="chart-wrap" className="px-1">
          {chart(ctrl)}
        </div>
        {/* {progress(ctrl)} Uncomment if you want to show progress */}
      </div>
    </div>
  );
};

export default Sidebar;
