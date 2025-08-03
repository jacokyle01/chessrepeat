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
  const setRepertoireMode = useTrainerStore((s) => s.setRepertoireMode);
  const repertoireMode = useTrainerStore.getState().repertoireMode;
  const isTrain = repertoireMode == 'train';


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
    <div className="flex flex-row justify-between items-start">
      {/* train/edit controls */}
      <div className="flex gap-1 bg-white flex items-end h-12 mr-auto p-1" id="training-controls">
        <button
          onClick={() => setRepertoireMode('train')}
          className={`text-white font-bold py-2 px-4 rounded flex border-gray-700 hover:border-gray-600 hover:bg-gray-400 active:transform active:translate-y-px active:border-b ${
            isTrain ? 'bg-gray-500 translate-y-px transform border-b' : 'bg-gray-600 border-b-4'
          }`}
        >
          <GraduationCapIcon />
          <span>Train</span>
        </button>

        <button
          onClick={() => setRepertoireMode('edit')}
          className={`gap-1 text-white font-bold py-2 px-4 rounded flex border-gray-700 hover:border-gray-500 hover:bg-gray-300 active:transform active:translate-y-px active:border-b ${
            !isTrain ? 'bg-gray-400 translate-y-px transform border-b' : 'bg-gray-500 border-b-4'
          }`}
        >
          <FilePenLineIcon />
          <span>Edit</span>
        </button>
      </div>

      {/* training-specifc controls */}
      <div
        className="flex h-11 p-2 items-center"
        id="training-controls"
      >
        <div className="bg-white flex gap-1 flex h-11 p-2 items-center my-0">
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
        <div id="settings-wrap" className="flex mx-auto p-2">
          <SettingsButton></SettingsButton>
        </div>
      </div>

      {showLastMoveCorrect && <LastMoveCorrect></LastMoveCorrect>}

      {/* <div id="settings-wrap" className="flex justify-center items-center m-auto">
        <SettingsButton></SettingsButton>
      </div> */}
    </div>
  );
};

export default Controls;
