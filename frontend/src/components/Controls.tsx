import React, { Dispatch, SetStateAction, useEffect } from 'react';
import {
  Book,
  FilePenLineIcon,
  FolderCog2,
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
// import SettingsButton from './SettingsButton';
// import { bookI, recallI, gearI } from './Icons'; // Update the path if necessary

// export interface ControlsProps {
//   handleLearn: () => void;
//   handleRecall: () => void;
//   handleEdit: () => void;
// }

const Controls = () => {
  const setTrainingMethod = useTrainerStore((s) => s.setTrainingMethod);
  const trainingMethod = useTrainerStore.getState().trainingMethod;
  const setNextTrainable = useTrainerStore((s) => s.setNextTrainablePosition);
  const updateDueCounts = useTrainerStore((s) => s.updateDueCounts);

  const lastGuess = useTrainerStore.getState().lastGuess;

  const repertoire = useTrainerStore().repertoire;
  const repertoireIndex = useTrainerStore().repertoireIndex;
  const name = repertoire[repertoireIndex]?.name || '';

  //TODO difference between handleLearn and setting mode to learn?
  return (
    <div className="flex flex-row justify-start items-start">
      {/* train/edit controls */}
      <div className="flex bg-white flex items-end p-1" id="training-controls">
        <button
          onClick={() => setTrainingMethod('edit')}
          className={`rounded-md gap-1 text-white font-bold py-1 px-3 rounded flex items-end border-slate-700 hover:border-slate-500 hover:bg-slate-400 active:transform active:translate-y-px active:border-b ${
            trainingMethod == 'edit'
              ? 'bg-slate-400 translate-y-px transform border-b'
              : 'bg-slate-500 border-b-4'
          }`}
        >
          <SquarePen size={22} />
          <span className="">Edit</span>
        </button>

        <button
          onClick={() => {
            setTrainingMethod('learn');
            setNextTrainable();
            updateDueCounts();
          }}
          className={`rounded-md gap-1 text-white font-bold py-1 px-3 rounded flex border-blue-700 hover:border-blue-500 hover:bg-blue-400 active:transform active:translate-y-px active:border-b ${
            trainingMethod == 'learn'
              ? 'bg-blue-400 translate-y-px transform border-b'
              : 'bg-blue-500 border-b-4'
          }
          ${
            trainingMethod == 'unselected' && name == 'Example Repertoire' && 'shadow-lg shadow-blue-500/70'
          }  
          `}
        >
          <GraduationCap size={22} />
          <span className="">Learn</span>
        </button>

        <button
          onClick={() => {
            setTrainingMethod('recall');
            setNextTrainable();
            updateDueCounts();
          }}
          className={`rounded-md gap-1 text-white font-bold py-1 px-3 rounded flex border-blue-800 hover:border-blue-700 hover:bg-blue-600 active:transform active:translate-y-px active:border-b ${
            trainingMethod == 'recall'
              ? 'bg-blue-600 translate-y-px transform border-b'
              : 'bg-blue-700 border-b-4'
          }`}
        >
          <History size={22} />
          <span className="">Recall</span>
        </button>

          
      </div>



      {/* {showLastMoveCorrect && <LastMoveCorrect></LastMoveCorrect>} */}

      {/* <div id="settings-wrap" className="flex justify-center items-center m-auto">
        <SettingsButton></SettingsButton>
      </div> */}
      {/* <div className="settings-wrap">
        <Settings size={30} />
      </div> */}
    </div>
  );
};

export default Controls;
