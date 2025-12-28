import React, { Dispatch, SetStateAction, useEffect } from 'react';
import { Method } from '../spaced-repetition/types';
import {
  Book,
  FilePenLineIcon,
  GraduationCap,
  GraduationCapIcon,
  History,
  Lightbulb,
  Repeat2,
  Settings,
  Settings2,
  SquarePen,
} from 'lucide-react';
import { useTrainerStore } from '../state/state';
import SettingsButton from './SettingsButton';
import { repertoire } from '../view/repertoire';
// import { bookI, recallI, gearI } from './Icons'; // Update the path if necessary

export interface ControlsProps {
  handleLearn: () => void;
  handleRecall: () => void;
  handleEdit: () => void;
}

const Controls: React.FC<ControlsProps> = ({ handleLearn, handleRecall, handleEdit }: ControlsProps) => {
  const setRepertoireMethod = useTrainerStore((s) => s.setRepertoireMethod);
  const repertoireMethod = useTrainerStore.getState().repertoireMethod;

  const lastGuess = useTrainerStore.getState().lastGuess;
  const showLastMoveCorrect = useTrainerStore.getState().showSuccessfulGuess;

  const repertoire = useTrainerStore().repertoire;
  const repertoireIndex = useTrainerStore().repertoireIndex;
  const name = repertoire[repertoireIndex]?.name || '';


  //TODO difference between handleLearn and setting mode to learn?
  return (
    <div className="flex flex-row justify-start items-start">
      {/* train/edit controls */}
      <div className="flex gap-1 bg-white flex items-end p-1" id="training-controls">
        <button
          onClick={handleEdit}
          className={`gap-1 text-white font-bold py-1 px-3 rounded flex items-end border-gray-700 hover:border-gray-500 hover:bg-gray-300 active:transform active:translate-y-px active:border-b ${
            repertoireMethod == 'edit'
              ? 'bg-gray-400 translate-y-px transform border-b'
              : 'bg-gray-500 border-b-4'
          }`}
        >
          <SquarePen size={22} />
          <span className="">Edit</span>
        </button>

        <button
          onClick={handleLearn}
          className={`gap-1 text-white font-bold py-1 px-3 rounded flex border-blue-700 hover:border-blue-500 hover:bg-blue-400 active:transform active:translate-y-px active:border-b ${
            repertoireMethod == 'learn'
              ? 'bg-blue-400 translate-y-px transform border-b'
              : 'bg-blue-500 border-b-4'
          }
          ${
            repertoireMethod == 'unselected' && name == 'Example Repertoire' && 'shadow-lg shadow-blue-500/70'
          }  
          `}
        >
          <GraduationCap size={22}/>
          <span className="">Learn</span>
        </button>

        <button
          onClick={handleRecall}
          className={`gap-1 text-white font-bold py-1 px-3 rounded flex border-orange-700 hover:border-orange-500 hover:bg-orange-400 active:transform active:translate-y-px active:border-b ${
            repertoireMethod == 'recall'
              ? 'bg-orange-400 translate-y-px transform border-b'
              : 'bg-orange-500 border-b-4'
          }`}
        >
          <History size={22}/>
          <span className="">Recall</span>
        </button>
      </div>

      {/* training-specifc controls */}
      <div className="flex h-11 items-center mr-auto" id="training-controls">
        <div id="settings-wrap" className="flex p-2">
          <SettingsButton></SettingsButton>
        </div>
      </div>

      {/* {showLastMoveCorrect && <LastMoveCorrect></LastMoveCorrect>} */}

      {/* <div id="settings-wrap" className="flex justify-center items-center m-auto">
        <SettingsButton></SettingsButton>
      </div> */}
    </div>
  );
};

export default Controls;
