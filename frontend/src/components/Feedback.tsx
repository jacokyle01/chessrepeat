import React from 'react';
import { whiteKingI } from '../svg/white_king';
import { blackKingI } from '../svg/black_king';
import { useTrainerStore } from '../state/state';
import { F } from 'vite/dist/node/types.d-aGj9QkWt';
import { Lightbulb, Repeat2 } from 'lucide-react';

export interface FeedbackProps {
  // repertoire: RepertoireEntry[];
  handleFail: () => void;

  //TODO calculate this dynamically??
}
const isWhite = true;
const Recall = ({ handleFail }) => {
  //TODO change
  let isWhite = true;
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');
  const toggleShowingHint = useTrainerStore.getState().showingHint;

  return (
    <div className="bg-white justify-center border border-gray-300 gap-5 rounded-b-xl">
      <div className="bg-white flex items-center justify-center py-12 px-6 gap-3">
        <div className="w-12 h-12 flex items-center justify-center">
          <Repeat2 className="w-14 h-14" />
        </div>
        <div>
          <h1 className="font-bold text-2xl text-gray-800">Your move</h1>
          <h2 className="text-lg text-gray-600">{`What does ${isWhite ? 'White' : 'Black'} play here?`}</h2>
        </div>
      </div>
      <div id="recall-options" className="flex">
        <span
          id="recall-fail"
          className="bg-white text-blue-700 font-semibold text-lg uppercase flex-1 text-center py-3 cursor-pointer transition hover:bg-blue-200"
          onClick={handleFail}
        >
          Give up
        </span>
        <span
          id="recall-hint"
          className="bg-white text-blue-700 font-semibold text-lg uppercase flex-1 text-center py-3 cursor-pointer transition hover:bg-blue-200"
          // TODO hint
          // onClick={}
        >
          Show hint
        </span>
      </div>
    </div>
  );
};

const Learn = () => {
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');
  const san = useTrainerStore((s) => s.trainingPath.at(-1)?.data.san);

  return (
    <div className="bg-white flex items-center justify-center py-12 border border-gray-300 gap-5 rounded-b-xl">
      <div className="w-12 h-12 flex items-center justify-center">
        <Lightbulb className="w-20 h-20" />
      </div>
      <div>
        <h1 className="font-bold text-2xl text-gray-800">Your move</h1>
        <h2 className="text-lg text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</h2>
      </div>
    </div>
  );
};

const Empty = () => (
  <div className="bg-white flex flex-col items-center justify-center py-12 border border-gray-300 rounded-b-xl">
    <h1 className="font-bold text-xl text-gray-800">No moves</h1>
    <h2 className="text-md text-gray-600 mt-2 text-center">
      Try training a different repertoire or switching modes
    </h2>
  </div>
);

const FailOrAlternate = () => {
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');
  const san = useTrainerStore((s) => s.trainingPath.at(-1)?.data.san);
  const lastGuess = useTrainerStore.getState().lastGuess;
  // const fail = useTrainerStore(s => s.fail);
  // const handleRecall = useTrainerStore(s => s.handleRecall);

  const onContinue = () => {
    fail();
    handleRecall();
  };

  return (
    <div id="recall" className="border-t-2">
      <div className="bg-white py-10 shadow-md flex flex-col items-center">
        <div className="flex flex-row justify-center items-center w-full space-x-5">
          <div className="text-red-500 text-7xl font-bold">✗</div>
          <div id="failure">
            <h2 className="font-bold text-2xl text-gray-800">{`${lastGuess} is Incorrect`}</h2>
            <p className="text-lg text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</p>
          </div>
        </div>
        <button
          id="continue-btn"
          className="bg-orange-400 text-white font-bold py-2 px-6 mt-6 rounded hover:bg-orange-500 active:transform active:translate-y-px active:border-b-2 border-orange-700"
          onClick={onContinue}
        >
          Continue Training
        </button>
      </div>
    </div>
  );
};

export const Feedback: React.FC<FeedbackProps> = ({ handleFail }) => {
  const lastFeedback = useTrainerStore((s) => s.lastFeedback);

  switch (lastFeedback) {
    case 'recall':
      return <Recall handleFail={handleFail} />;
    case 'learn':
      return <Learn />;
    case 'empty':
      return <Empty />;
    case 'fail':
    case 'alternate':
      return <FailOrAlternate />;
    default:
      return <div>Other</div>;
  }
};
