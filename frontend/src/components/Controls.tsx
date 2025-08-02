import React, { Dispatch, SetStateAction, useEffect } from 'react';
import { Method } from '../spaced-repetition/types';
import {
  Book,
  FilePenLineIcon,
  GraduationCapIcon,
  Lightbulb,
  Repeat2,
  Settings,
  Settings2,
} from 'lucide-react';
import { useTrainerStore } from '../state/state';
import SettingsButton from './SettingsButton';
// import { bookI, recallI, gearI } from './Icons'; // Update the path if necessary

export interface ControlsProps {
  trainingMethod: Method;
  handleLearn: () => void;
  handleRecall: () => void;
  setShowTrainingSettings: Dispatch<SetStateAction<boolean>>;
}

const Controls: React.FC<ControlsProps> = ({
  trainingMethod,
  handleLearn,
  handleRecall,
  setShowTrainingSettings,
}: ControlsProps) => {
  const isLearn = trainingMethod === 'learn';
  const isRecall = trainingMethod === 'recall';

  const lastGuess = useTrainerStore.getState().lastGuess;
  const showLastMoveCorrect = useTrainerStore.getState().showSuccessfulGuess;

  const LastMoveCorrect = () => {
    return <div className="text-green-600 text-lg">{`✔ ${lastGuess} was correct!`}</div>;
  };

  useEffect(() => {
    // console.log("last guess", lastGuess)
    // console.log("last fb", lastFeedback)
    console.log('show lastmvc?', showLastMoveCorrect);
  });

  /*
    TODO
    get state from store here



  */
  return (
    <div className="mr-auto flex flex-start items-start justify-start gap-5 bg-white">
      {/* train/edit controls */}
      <div
        className="flex gap-1 bg-white flex items-end h-14 mr-auto p-1 items-center"
        id="training-controls"
      >
        <button
          onClick={handleLearn}
          className={`text-white font-bold py-2 px-4 rounded flex border-gray-700 hover:border-gray-600 hover:bg-gray-400 active:transform active:translate-y-px active:border-b ${
            isLearn ? 'bg-gray-500 translate-y-px transform border-b' : 'bg-gray-600 border-b-4'
          }`}
        >
          <GraduationCapIcon />
          <span>Train</span>
        </button>

        <button
          onClick={handleRecall}
          className={`gap-1 text-white font-bold py-2 px-4 rounded flex border-gray-700 hover:border-gray-500 hover:bg-gray-300 active:transform active:translate-y-px active:border-b ${
            isRecall ? 'bg-gray-400 translate-y-px transform border-b' : 'bg-gray-500 border-b-4'
          }`}
        >
          <FilePenLineIcon />
          <span>Edit</span>
        </button>
      </div>

      {/* training-specifc controls */}
      <div
        className="flex gap-1 bg-white flex items-end h-12 mr-auto p-2 items-center my-auto"
        id="training-controls"
      >
        <button
          onClick={handleLearn}
          className={`text-white font-bold py-1 px-3 rounded flex border-blue-700 hover:border-blue-500 hover:bg-blue-400 active:transform active:translate-y-px active:border-b ${
            isLearn ? 'bg-blue-400 translate-y-px transform border-b' : 'bg-blue-500 border-b-4'
          }`}
        >
          <Lightbulb />
          <span>Learn</span>
        </button>

        <button
          onClick={handleRecall}
          className={`gap-1 text-white font-bold py-1 px-3 rounded flex border-orange-700 hover:border-orange-500 hover:bg-orange-400 active:transform active:translate-y-px active:border-b ${
            isRecall ? 'bg-orange-400 translate-y-px transform border-b' : 'bg-orange-500 border-b-4'
          }`}
        >
          <Repeat2 />
          <span>Recall</span>
        </button>
      </div>

      {showLastMoveCorrect && <LastMoveCorrect></LastMoveCorrect>}

      <div id="settings-wrap" className="flex justify-center items-center m-auto">
        <SettingsButton></SettingsButton>
      </div>
    </div>
  );
};

export default Controls;
