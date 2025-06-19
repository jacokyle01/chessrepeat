import React, { Dispatch, SetStateAction } from 'react';
import { Method } from '../spaced-repetition/types';
import { Book, Lightbulb, Repeat2, Settings, Settings2 } from 'lucide-react';
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

  return (
    <div
      className="flex items-end gap-1 p-1 h-14 mr-auto shadow-md rounded-b-md p-4 bg-white items-center"
      id="training-controls"
    >
      <button
        onClick={handleLearn}
        className={`gap-1 text-white font-bold py-1 px-4 rounded flex border-blue-700 hover:border-blue-500 hover:bg-blue-400 active:transform active:translate-y-px active:border-b ${
          isLearn ? 'bg-blue-400 translate-y-px transform border-b' : 'bg-blue-500 border-b-4'
        }`}
      >
        <span>Learn</span>
        < Lightbulb />
      </button>

      <button
        onClick={handleRecall}
        className={`gap-1 text-white font-bold py-1 px-4 rounded flex border-orange-700 hover:border-orange-500 hover:bg-orange-400 active:transform active:translate-y-px active:border-b ${
          isRecall ? 'bg-orange-400 translate-y-px transform border-b' : 'bg-orange-500 border-b-4' 
        }`}
      >
        <span>Recall</span>
        < Repeat2 />
      </button>

      <div className="ml-3 cursor-pointer" onClick={() => setShowTrainingSettings(true)}>
        < Settings2 />
      </div>
    </div>
  );
};

export default Controls;
