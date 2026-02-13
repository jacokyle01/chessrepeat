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
  const method = useTrainerStore.getState().trainingMethod;
  const setNextTrainable = useTrainerStore((s) => s.setNextTrainablePosition);
  const updateDueCounts = useTrainerStore((s) => s.updateDueCounts);

  const lastGuess = useTrainerStore.getState().lastGuess;

  const repertoire = useTrainerStore().repertoire;
  const repertoireIndex = useTrainerStore().repertoireIndex;
  const name = repertoire[repertoireIndex]?.name || '';

  //TODO difference between handleLearn and setting mode to learn?
  return (
  <div className="flex justify-start items-start">
    <div
      id="training-controls"
      className="inline-flex rounded-b-xl bg-white p-1"
    >
      {/* EDIT */}
      <button
        onClick={() => setTrainingMethod('edit')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
          transition-all duration-200
          ${
            method === 'edit'
              ? 'bg-white text-slate-900 shadow-md ring-1 ring-slate-300'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
          }
        `}
      >
        <SquarePen size={18} />
        Edit
      </button>

      {/* LEARN */}
      <button
        onClick={() => {
          setTrainingMethod('learn');
          setNextTrainable();
          updateDueCounts();
        }}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
          transition-all duration-200
          ${
            method === 'learn'
              ? 'bg-white text-blue-600 shadow-md ring-1 ring-blue-300'
              : 'text-slate-500 hover:text-blue-600 hover:bg-slate-200'
          }
          ${
            method === 'unselected' && name === 'Example Repertoire'
              ? 'animate-pulse'
              : ''
          }
        `}
      >
        <GraduationCap size={18} />
        Learn
      </button>

      {/* RECALL */}
      <button
        onClick={() => {
          setTrainingMethod('recall');
          setNextTrainable();
          updateDueCounts();
        }}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
          transition-all duration-200
          ${
            method === 'recall'
              ? 'bg-white text-indigo-600 shadow-md ring-1 ring-indigo-300'
              : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-200'
          }
        `}
      >
        <History size={18} />
        Recall
      </button>
    </div>
  </div>
);

};

export default Controls;
