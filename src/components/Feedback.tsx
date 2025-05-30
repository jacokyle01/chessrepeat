//TODO rename 

import React from 'react';
import PrepCtrl from '../ctrl';
import { whiteKingI } from '../svg/white_king';
import { blackKingI } from '../svg/black_king';

interface ToastProps {
  ctrl: PrepCtrl;
}

const RecallToast: React.FC<{ ctrl: PrepCtrl }> = ({ ctrl }) => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return (
    <div id="recall" className="border-t-4 border-blue-500 rounded-md shadow-lg">
      <div className="bg-white flex items-center justify-center py-12 px-6 gap-3">
        <div className="w-12 h-12 flex items-center justify-center">
          {/* {isWhite ? whiteKingI() : blackKingI()} */}
        </div>
        <div>
          <h1 className="font-bold text-xl text-gray-800">Your move</h1>
          <h2 className="text-md text-gray-600">
            What does {isWhite ? 'White' : 'Black'} play here?
          </h2>
        </div>
      </div>
      <div id="recall-options" className="flex">
        <span
          id="recall-fail"
          className="bg-blue-100 text-blue-700 font-semibold text-lg uppercase flex-1 text-center py-3 cursor-pointer transition hover:bg-blue-200"
          onClick={() => ctrl.handleFail()}
        >
          Give up
        </span>
        <span
          id="recall-hint"
          className="bg-blue-100 text-blue-700 font-semibold text-lg uppercase flex-1 text-center py-3 cursor-pointer transition hover:bg-blue-200"
          onClick={() => ctrl.toggleShowingHint()}
        >
          Show hint
        </span>
      </div>
    </div>
  );
};

const LearnToast: React.FC<{ ctrl: PrepCtrl }> = ({ ctrl }) => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  const move = ctrl.trainingPath.at(-1)?.data.san ?? '';
  return (
    <div className="bg-white flex items-center justify-center py-12 px-6 rounded-md shadow-lg border-t-4 border-blue-500 gap-3">
      <div className="w-12 h-12 flex items-center justify-center">
        {/* {isWhite ? whiteKingI() : blackKingI()} */}
      </div>
      <div>
        <h1 className="font-bold text-xl text-gray-800">Your move</h1>
        <h2 className="text-md text-gray-600">
          {isWhite ? 'White' : 'Black'} plays {move}
        </h2>
      </div>
    </div>
  );
};

const EmptyToast: React.FC = () => (
  <div className="bg-white flex flex-col items-center justify-center py-12 px-6 rounded-md shadow-lg border-t-4 border-blue-500">
    <h1 className="font-bold text-xl text-gray-800">No moves</h1>
    <h2 className="text-md text-gray-600 mt-2 text-center">
      Try training a different repertoire or switching modes
    </h2>
  </div>
);

const FailToast: React.FC<{ ctrl: PrepCtrl }> = ({ ctrl }) => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  const move = ctrl.trainingPath.at(-1)?.data.san ?? '';
  return (
    <div id="recall" className="border-t-2">
      <div className="bg-white py-10 shadow-md flex flex-col items-center">
        <div className="flex flex-row justify-center items-center w-full space-x-5">
          <div className="text-red-500 text-6xl font-bold">✗</div>
          <div id="failure">
            <h2 className="text-xl font-semibold">{ctrl.lastGuess} is Incorrect</h2>
            <p className="text-lg">
              {isWhite ? 'White' : 'Black'} plays {move}
            </p>
          </div>
        </div>
        <button
          id="continue-btn"
          className="bg-orange-400 text-white font-bold py-2 px-6 mt-6 rounded hover:bg-orange-500 active:translate-y-px active:border-b-2 border-orange-700"
          onClick={() => {
            ctrl.fail();
            ctrl.handleRecall();
          }}
        >
          Continue Training ⮕
        </button>
      </div>
    </div>
  );
};

const Toast: React.FC<ToastProps> = ({ ctrl }) => {
  switch (ctrl.lastFeedback) {
    case 'recall':
      return <RecallToast ctrl={ctrl} />;
    case 'learn':
      return <LearnToast ctrl={ctrl} />;
    case 'empty':
      return <EmptyToast />;
    case 'fail':
      return <FailToast ctrl={ctrl} />;
    default:
      return <div>Other</div>;
  }
};

export default Toast;
