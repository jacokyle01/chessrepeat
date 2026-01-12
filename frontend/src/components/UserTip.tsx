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
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');
  // const san = useTrainerStore((s) => s.TrainableNodeList.at(-1)?.san);
  const fail = useTrainerStore((s) => s.fail);
  const setNextTrainable = useTrainerStore((s) => s.setNextTrainablePosition);

  const san = useTrainerStore.getState().trainableContext.targetMove.data.san;
  const lastGuess = useTrainerStore.getState().lastGuess;
  // const fail = useTrainerStore(s => s.fail);
  // const handleRecall = useTrainerStore(s => s.handleRecall);

  const onContinue = () => {
    // don't automatically fail;
    // leaves room for an option to not mark as failure
    fail();
    setNextTrainable();
  };

  return (
    <div id="recall" className="border-t-2">
      <div className="bg-white py-10 shadow-md flex flex-col items-center gap-2">
        <div className="flex flex-row justify-center items-center w-full space-x-5">
          <div className="text-red-500 text-7xl font-bold">✗</div>
          <div id="failure">
            <h2 className="font-bold text-2xl text-gray-800">{`${lastGuess} is Incorrect`}</h2>
            <p className="text-lg text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</p>
          </div>
        </div>
        <button
          id="continue-btn"
          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-400"
          onClick={onContinue}
        >
          Continue Training
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
