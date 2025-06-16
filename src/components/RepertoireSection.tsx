//TODO better name?

import React from 'react';
import { RepertoireEntry } from '../types/types';
import { smallGear } from '../svg/smallGear';
import RepertoireDropdown from './RepertoireDropdown';
import { Settings } from 'lucide-react';
import { useAtom } from 'jotai';
import { useStore } from 'zustand';
import { useTrainerStore } from '../state/atoms';

interface RepertoireSectionProps {
  repertoire: RepertoireEntry[];
  startsAt: number;
  repertoireIndex: number;
}

export const RepertoireSection: React.FC<RepertoireSectionProps> = ({ repertoire, startsAt, repertoireIndex }) => {
  // const [repertoireIndex, setRepertoireIndex] = useAtom(repertoireIndexAtom);
  const setRepertoireIndex = useStore(useTrainerStore, (s) => s.setRepertoireIndex);

  return (
    <div id="subrepertoire-tree-wrap" className="flex-row rounded-md">
      {repertoire.map((entry, index) => {
        const meta = entry.subrep.meta;
        const unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);
        const name = entry.name;
        const fullIndex = index + startsAt;

        const handleClick = () => {
          // ctrl.selectSubrepertoire(fullIndex);
          setRepertoireIndex(fullIndex);

          
        };

        // const handleSettingsClick = (e: React.MouseEvent) => {
        //   e.stopPropagation();
        //   ctrl.subrepSettingsIndex =
        //     ctrl.subrepSettingsIndex === fullIndex ? -1 : fullIndex;
        // };

        return (
          <div
            key={fullIndex}
            id="subrepertoire-wrap"
            onClick={handleClick}
            className={repertoireIndex === fullIndex ? 'bg-cyan-50' : ''}
          >
            <div className="subrepertoire flex items-center justify-around hover:bg-cyan-50 pl-4 py-0.5">
              <span className="font-bold pr-3 text-blue-600">{fullIndex + 1}</span>
              <h3 className="text-lg font-light flex-1 gap-2 flex items-end">
                <span className="text-md">{name}</span>
                <span className="text-xs font-bold font-mono mb-1">{meta.nodeCount}</span>
              </h3>
              {unseenCount > 0 && (
                <button className="text-sm font-medium text-blue-700 bg-blue-500/20 rounded-full px-2 font-black">
                  Learn {unseenCount}
                </button>
              )}
              {entry.lastDueCount > 0 && (
                <button className="text-sm font-medium text-orange-700 bg-orange-500/20 rounded-full px-2 font-black">
                  Recall {entry.lastDueCount}
                </button>
              )}
              <div id="subrep-settings" className="ml-auto">
                <div
                // className={`cursor-pointer transition-all hover:bg-gray-300 active:scale-90 rounded-md ${
                //   // ctrl.subrepSettingsIndex === fullIndex ? 'bg-gray-300' : ''
                // }`}
                // onClick={handleSettingsClick}
                >
                  <Settings />
                </div>
              </div>
            </div>
            {/* {dropdownMenu(index, startsAt)} */}
            <RepertoireDropdown thisIndex={index} startsAt={startsAt}></RepertoireDropdown>
          </div>
        );
      })}
    </div>
  );
};

export default RepertoireSection;
