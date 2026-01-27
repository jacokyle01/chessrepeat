import React from 'react';
//TODO king SVG
import { useTrainerStore } from '../state/state';
import { Lightbulb, LucideRepeat2, Repeat2 } from 'lucide-react';

const isWhite = true;
const Recall = () => {
  //TODO change
  let isWhite = true;
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');
  // const toggleShowingHint = useTrainerStore.getState().showingHint;
  // const fail = useTrainerStore((s) => s.fail);

  return (
    <div className="bg-white justify-center border border-gray-300 gap-5">
      <div className="bg-white flex items-center justify-center py-12 px-6 gap-3">
        <div className="w-12 h-12 flex items-center justify-center">
          <Repeat2 className="w-14 h-14" />
        </div>
        <div>
          <h1 className="font-bold text-2xl text-gray-800">Play the move</h1>
          <h2 className="text-lg text-gray-600">{`What does ${isWhite ? 'White' : 'Black'} play here?`}</h2>
        </div>
      </div>
    </div>
  );
};

const Learn = () => {
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');
  const san = useTrainerStore.getState().trainableContext.targetMove.data.san;

  return (
    <div className="bg-white flex items-center justify-center py-12 border border-gray-300 gap-5">
      <div className="w-12 h-12 flex items-center justify-center">
        <Lightbulb className="w-20 h-20" />
      </div>
      <div>
        <h1 className="font-bold text-2xl text-gray-800">Play the move</h1>
        <h2 className="text-lg text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</h2>
      </div>
    </div>
  );
};

const Empty = () => (
  <div className="bg-white flex flex-col items-center justify-center py-12 border border-gray-300">
    <h1 className="font-bold text-xl text-gray-800">No moves</h1>
    <h2 className="text-md text-gray-600 mt-2 text-center">
      Try training a different repertoire or switching modes
    </h2>
  </div>
);

const Fail = () => {
  const fail = useTrainerStore((s) => s.fail);
  const setNextTrainable = useTrainerStore((s) => s.setNextTrainablePosition);
  const makeMove = useTrainerStore((s) => s.makeMove);

  // OPTIONAL: swap these for real store actions when ready
  // const undoLastGuess = useTrainerStore((s) => s.undoLastGuess);
  // const markAsAlternative = useTrainerStore((s) => s.markAsAlternative);

  const san = useTrainerStore.getState().trainableContext.targetMove.data.san;
  const lastGuess = useTrainerStore.getState().lastGuess;
  // const isWhite = useTrainerStore((s) => s.chapter.trainAs === 'white');

  const onContinue = () => {
    fail();
    setNextTrainable();
  };

  const onMarkAlternative = (san: string) => {
    // markAsAlternative?.(); // TODO: implement in store
    // setNextTrainable();
    makeMove(san);
    setUserTip('recall');
  };

  const setUserTip = useTrainerStore((s) => s.setUserTip);

  return (
    <div id="recall" className="border-t-2">
      <div className="bg-white py-10 shadow-md flex flex-col items-center">
        <div className="flex flex-row justify-center items-center w-full space-x-5 pb-5">
          <div className="text-red-500 text-7xl font-bold">✗</div>
          <div id="failure">
            <h2 className="font-bold text-2xl text-gray-800">{`${lastGuess} is incorrect`}</h2>
            <p className="text-lg text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</p>
          </div>
        </div>

        {/* Action buttons */}

        <button
          id="continue-btn"
          className="flex-1 px-4 py-1 hover:bg-gray-50 text-blue-400 rounded-md hover:bg-gray-400 font-semibold"
          onClick={onContinue}
        >
          CONTINUE TRAINING
        </button>

        <button
          id="continue-btn"
          className="flex-1 px-4 py-1 hover:bg-gray-50 text-blue-400 rounded-md hover:bg-gray-400 font-semibold"
          onClick={() => setUserTip('recall')}
        >
          UNDO GUESS
        </button>

        <button
          id="continue-btn"
          className="flex-1 px-4 py-1 hover:bg-gray-50 text-blue-400 rounded-md hover:bg-gray-400 font-semibold"
          onClick={() => onMarkAlternative(lastGuess)}
        >
          <span className="flex gap-2">
            <h2>MARK</h2>
            <h2 className="text-black">{`${lastGuess}`}</h2>
            <h2>AS ALTERNATE MOVE</h2>
          </span>
        </button>
      </div>
    </div>
  );
};

const Alternate = () => {
  const lastGuess = useTrainerStore.getState().lastGuess;

  return (
    <div id="recall" className="border-t-2">
      <div className="bg-white py-10 shadow-md flex flex-col items-center">
        <div className="flex flex-row justify-center items-center w-full space-x-5">
          <LucideRepeat2 size={48} color={'gold'} />
          <div id="failure">
            <h2 className="font-bold text-2xl text-amber-400">{`${lastGuess} is an alternate move`}</h2>
            <p className="text-lg text-gray-600">Try playing a different move</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const UserTip = () => {
  const userTip = useTrainerStore((s) => s.userTip);

  switch (userTip) {
    case 'recall':
      return <Recall />;
    case 'learn':
      return <Learn />;
    case 'empty':
      return <Empty />;
    case 'fail':
      return <Fail />;
    case 'alternate':
      return <Alternate />;
    default:
      return <div>Other</div>;
  }
};
