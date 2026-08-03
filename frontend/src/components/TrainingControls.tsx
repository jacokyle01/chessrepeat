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
import { useTrainerStore } from '../store/state';
import './TrainingControls.css';
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
  const selectedChapterId = useTrainerStore().selectedChapterId;
  const name = repertoire.find((c) => c.uuid === selectedChapterId)?.name || '';

  // Nudge new users toward their first review: when the seeded example
  // chapter is selected but no training mode is active yet, make Learn pop.
  const promptExample = !method && name === 'Example Chapter';

  //TODO difference between handleLearn and setting mode to learn?
  return (
    <div className="training-controls-wrap">
      <div id="training-controls" className="control-tab">
        {/* EDIT */}
        <button
          onClick={() => setTrainingMethod('edit')}
          className={`control-tab-btn training-btn training-btn-edit ${
            method === 'edit' ? 'is-active' : ''
          }`}
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
          className={`control-tab-btn training-btn training-btn-learn ${
            method === 'learn' ? 'is-active' : promptExample ? 'is-prompted' : ''
          }`}
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
          className={`control-tab-btn training-btn training-btn-recall ${
            method === 'recall' ? 'is-active' : ''
          }`}
        >
          <History size={18} />
          Recall
        </button>
      </div>
    </div>
  );
};

export default Controls;
