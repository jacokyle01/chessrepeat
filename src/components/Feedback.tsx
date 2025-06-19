import React from 'react';
import { whiteKingI } from '../svg/white_king';
import { blackKingI } from '../svg/black_king';
import { F } from 'vite/dist/node/types.d-aGj9QkWt';

const Recall = ({ handleFail, showingHint }) => {
  let isWhite = true;

  return (
    <div id="recall" className="border-t-4 border-blue-500 rounded-md shadow-lg">
      <div className="bg-white flex items-center justify-center py-12 px-6 gap-3">
        <div className="w-12 h-12 flex items-center justify-center">
          {/* {isWhite ? whiteKingI() : blackKingI()} */}
        </div>
        <div>
          <h1 className="font-bold text-xl text-gray-800">Your move</h1>
          <h2 className="text-md text-gray-600">{`What does ${isWhite ? 'White' : 'Black'} play here?`}</h2>
        </div>
      </div>
      <div id="recall-options" className="flex">
        <span
          id="recall-fail"
          className="bg-blue-100 text-blue-700 font-semibold text-lg uppercase flex-1 text-center py-3 cursor-pointer transition hover:bg-blue-200"
          onClick={handleFail}
        >
          Give up
        </span>
        <span
          id="recall-hint"
          className="bg-blue-100 text-blue-700 font-semibold text-lg uppercase flex-1 text-center py-3 cursor-pointer transition hover:bg-blue-200"
          // TODO hint
          // onClick={}
        >
          Show hint
        </span>
      </div>
    </div>
  );
};

const Learn = ({ trainingPath }) => {
  let isWhite = true;

  return (
    <div className="bg-white flex items-center justify-center py-12 px-6 rounded-md shadow-lg border-t-4 border-blue-500 gap-3">
      <div className="w-12 h-12 flex items-center justify-center">
        {/* {isWhite ? whiteKingI() : blackKingI()} */}
      </div>
      <div>
        <h1 className="font-bold text-xl text-gray-800">Your move</h1>
        <h2 className="text-md text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</h2>
      </div>
    </div>
  );
};

const Empty = () => (
  <div className="bg-white flex flex-col items-center justify-center py-12 px-6 rounded-md shadow-lg border-t-4 border-blue-500">
    <h1 className="font-bold text-xl text-gray-800">No moves</h1>
    <h2 className="text-md text-gray-600 mt-2 text-center">
      Try training a different repertoire or switching modes
    </h2>
  </div>
);

const FailOrAlternate = ({ trainingPath, lastGuess }) => {
  // const isWhite = useTrainerStore(s => s.subrep.meta.trainAs === 'white');
  // const fail = useTrainerStore(s => s.fail);
  // const handleRecall = useTrainerStore(s => s.handleRecall);

  const onContinue = () => {
    // fail();
    // handleRecall();
  };

  return (
    <div id="recall" className="border-t-2">
      <div className="bg-white py-10 shadow-md flex flex-col items-center">
        <div className="flex flex-row justify-center items-center w-full space-x-5">
          <div className="text-red-500 text-6xl font-bold">✗</div>
          <div id="failure">
            <h2 className="text-xl font-semibold">{`${lastGuess} is Incorrect`}</h2>
            <p className="text-lg">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</p>
          </div>
        </div>
        <button
          id="continue-btn"
          className="bg-orange-400 text-white font-bold py-2 px-6 mt-6 rounded hover:bg-orange-500 active:transform active:translate-y-px active:border-b-2 border-orange-700"
          onClick={onContinue}
        >
          Continue Training ⮕
        </button>
      </div>
    </div>
  );
};

export const Feedback: React.FC<FeedbackProps> = ({ handleFail, lastFeedback, trainingPath, lastGuess }) => {
  switch (lastFeedback) {
    case 'recall':
      return <Recall handleFail={handleFail} />;
    case 'learn':
      return <Learn />;
    case 'empty':
      return <Empty />;
    case 'fail':
    case 'alternate':
      return <FailOrAlternate trainingPath={trainingPath} lastGuess={lastGuess} />;
    default:
      return <div>Other</div>;
  }
};
