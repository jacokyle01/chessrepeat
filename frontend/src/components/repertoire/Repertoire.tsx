import React, { Dispatch, SetStateAction } from 'react';
import PrepCtrl from '../../ctrl';
import { RepertoireChapter, RepertoireEntry } from '../../types/types';
import { downloadI } from '../../svg/download';
import RepertoireSection from './RepertoireSection';
import { BookDown, BookOpenIcon, BookPlus } from 'lucide-react';
import { useTrainerStore } from '../../state/state';
// import { progress } from './progress'; // Uncomment if needed

const Repertoire: React.FC = () => {
  const repertoire = useTrainerStore().repertoire;
  const numWhiteEntries = useTrainerStore().numWhiteEntries;
  const repertoireIndex = useTrainerStore().repertoireIndex;

  // console.log("repertoire", repertoire);
  const whiteEntries: RepertoireChapter[] = repertoire.slice(0, numWhiteEntries);
  const blackEntries: RepertoireChapter[] = repertoire.slice(numWhiteEntries);

  // div.flex.flex-col.bg-white.bg-clip-border.text-gray-700.shadow-md.rounded-md.border.border-gray-200.mt-4.pb-5
  // class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"

  return (
    <div id="repertoire" className="flex flex-col rounded-2xl border border-gray-300 bg-white pb-2">
      <div className="flex flex-col rounded-md pb-2 h-2/5 overflow-y-auto">
        <div id="repertoire-header" className="flex flex-row items-center justify-left p-3 gap-2">
          <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
            <BookOpenIcon></BookOpenIcon>
          </div>
          <span className="text-gray-800 font-semibold text-xl">My Repertoire</span>
        </div>
        <div id="repertoire-wrap">
          <span className="font-semibold text-sm uppercase px-2 pl-4 text-gray-600 space-x-1">White</span>
          <RepertoireSection repertoire={whiteEntries} startsAt={0} repertoireIndex={repertoireIndex} />
          <span className="font-semibold text-sm uppercase px-2 pl-4 text-gray-600">Black</span>
          <RepertoireSection
            repertoire={blackEntries}
            startsAt={numWhiteEntries}
            repertoireIndex={repertoireIndex}
          />
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
