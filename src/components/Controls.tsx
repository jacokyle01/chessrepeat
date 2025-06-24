import React, { Dispatch, SetStateAction, useEffect } from 'react';
import { Method } from '../spaced-repetition/types';
import { Book, Lightbulb, Repeat2, Settings, Settings2 } from 'lucide-react';
import { useTrainerStore } from '../state/state';
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

  return (
    <div className='mr-auto flex flex-start items-start gap-5 justify-start'>
      <div
        className="flex items-end gap-1 h-14 mr-auto p-3 bg-white items-center border border-gray-300 rounded-b"
        id="training-controls"
      >
        <button
          onClick={handleLearn}
          className={`gap-1 text-white font-bold py-1 px-4 rounded flex border-blue-700 hover:border-blue-500 hover:bg-blue-400 active:transform active:translate-y-px active:border-b ${
            isLearn ? 'bg-blue-400 translate-y-px transform border-b' : 'bg-blue-500 border-b-4'
          }`}
        >
          <Lightbulb />
          <span>Learn</span>
        </button>

        <button
          onClick={handleRecall}
          className={`gap-1 text-white font-bold py-1 px-4 rounded flex border-orange-700 hover:border-orange-500 hover:bg-orange-400 active:transform active:translate-y-px active:border-b ${
            isRecall ? 'bg-orange-400 translate-y-px transform border-b' : 'bg-orange-500 border-b-4'
          }`}
        >
          <Repeat2 />
          <span>Recall</span>
        </button>

        <div
          className="pl-2 cursor-pointer p-1 rounded text-gray-800"
          onClick={() => setShowTrainingSettings(true)}
        >
          <Settings2 className="w-6 h-6" />
        </div>
      </div>
      {showLastMoveCorrect && <LastMoveCorrect></LastMoveCorrect>}
    </div>
  );
};

export default Controls;
