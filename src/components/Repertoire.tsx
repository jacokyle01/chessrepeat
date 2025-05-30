import React, { Dispatch, SetStateAction } from 'react';
import PrepCtrl from '../ctrl';
import { RepertoireEntry } from '../types/types';
import { chart } from './chart';
import { downloadI } from '../svg/download';
import RepertoireSection from './RepertoireSection';
import { BookDown, BookPlus } from 'lucide-react';
// import { progress } from './progress'; // Uncomment if needed

export interface RepertoireProps {
  repertoire: RepertoireEntry[];
  //TODO calculate this dynamically??
  numWhiteEntries: number;
  setShowingAddToRepertoireMenu: Dispatch<SetStateAction<boolean>>;
  repertoireIndex: number
}

const Repertoire: React.FC<RepertoireProps> = ({
  repertoire,
  numWhiteEntries,
  setShowingAddToRepertoireMenu,
  repertoireIndex
}) => {
  const whiteEntries: RepertoireEntry[] = repertoire.slice(0, numWhiteEntries);
  const blackEntries: RepertoireEntry[] = repertoire.slice(numWhiteEntries);

  return (
    <div id="sidebar" className="flex flex-col flex-1 h-lvh">
      <div className="flex flex-col bg-white bg-clip-border text-gray-700 shadow-md rounded-md border border-gray-200 pb-2 h-2/5 overflow-y-auto">
        <span className="text-xl font-bold py-2 pl-2 border-b-2 mb-2 border-gray-300">My Repertoire</span>
        <div id="repertoire-wrap">
          <span className="font-semibold text-sm uppercase px-2 text-gray-600 space-x-1">White</span>
          <RepertoireSection repertoire={whiteEntries} startsAt={0} repertoireIndex={repertoireIndex} />
          <span className="font-semibold text-sm uppercase px-2 text-gray-600">Black</span>
          <RepertoireSection repertoire={blackEntries} startsAt={numWhiteEntries} repertoireIndex={repertoireIndex} />
        </div>
        <div id="repertoire-actions" className="mt-auto flex mt-4">
          <button
            className="flex bg-blue-500 text-white font-bold rounded p-2 gap-1 mx-auto px-5 transition duration-200 ease-in-out hover:bg-blue-600 active:scale-95 shadow-md hover:shadow-lg"
            onClick={() => setShowingAddToRepertoireMenu(true)}
          >
            <div>Add to Repertoire</div>
            <BookPlus />
          </button>
          <button
            className="flex bg-blue-700 text-white font-bold rounded p-2 gap-1 mx-auto px-5 transition duration-200 ease-in-out hover:bg-blue-800 active:scale-95 shadow-md hover:shadow-lg"
            // onClick={() => ctrl.downloadRepertoire()}
          >
            <div>Download</div>
            <BookDown />
          </button>
        </div>
      </div>

      {/* <div className="flex flex-col bg-white bg-clip-border text-gray-700 shadow-md rounded-md border border-gray-200 mt-4 pb-5">
        <span className="text-xl font-bold py-2 pl-2 border-b-2 mb-2 border-gray-300">
          Memory Schedule
        </span>
        <span className="font-semibold text-gray-600 px-1">Due at</span>
        <div id="chart-wrap" className="px-1">
          {chart(ctrl)}
        </div>
      </div> */}
    </div>
  );
};

export default Repertoire;
