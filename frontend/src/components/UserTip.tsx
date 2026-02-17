import React from 'react';
//TODO king SVG
import { useTrainerStore } from '../state/state';
import {
  BookOpenIcon,
  GraduationCapIcon,
  HistoryIcon,
  Lightbulb,
  LucideRepeat2,
  MousePointer,
  Repeat2,
  XIcon,
} from 'lucide-react';

const isWhite = true;
const Recall = () => {
  //TODO change
  let isWhite = true;
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');
  // const toggleShowingHint = useTrainerStore.getState().showingHint;
  // const fail = useTrainerStore((s) => s.fail);

  return (
    <div className="bg-white justify-center border border-gray-300">
      <div className="bg-white flex items-center justify-center py-12 px-6 gap-3">
        <div className="w-12 h-12 flex items-center justify-center">
          <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-2 rounded-md">
            <HistoryIcon width={35} height={35} />
          </div>
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
    <div className="bg-white flex items-center justify-center py-12 border border-gray-300 gap-3">
      <div className="w-12 h-12 flex items-center justify-center">
        <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-2 rounded-md">
          <GraduationCapIcon width={35} height={35} />
        </div>
      </div>
      <div>
        <h1 className="font-bold text-2xl text-gray-800">Play the move</h1>
        <h2 className="text-lg text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</h2>
      </div>
    </div>
  );
};

// nextTrainablePosition couldn't find any moves to train
const Empty = () => {
  const method = useTrainerStore.getState().trainingMethod;

  return (
    <div className="bg-white flex items-center justify-center py-12 border border-gray-300 gap-1">
      <div className="w-12 h-12 flex items-center justify-center">
        <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-2 rounded-md">
          <XIcon width={25} height={25} />
        </div>
      </div>
      <div>
        <h1 className="font-bold text-xl text-gray-600">{`No more moves to ${method}`}</h1>
        <h2 className="text-md text-gray-600">Try switching the training mode or modifying settings</h2>
      </div>
    </div>
  );
};

const Fail = () => {
  const train = useTrainerStore((s) => s.train);
  const setNextTrainable = useTrainerStore((s) => s.setNextTrainablePosition);
  const makeMove = useTrainerStore((s) => s.makeMove);

  // OPTIONAL: swap these for real store actions when ready
  // const undoLastGuess = useTrainerStore((s) => s.undoLastGuess);
  // const markAsAlternative = useTrainerStore((s) => s.markAsAlternative);

  const san = useTrainerStore.getState().trainableContext.targetMove.data.san;
  const lastGuess = useTrainerStore.getState().lastGuess;
  // const isWhite = useTrainerStore((s) => s.chapter.trainAs === 'white');

  const onContinue = () => {
    train(false);
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
            <h2>ADD</h2>
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

const EmptyRepertoire = () => {
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');

  return (
    <div className="bg-white flex items-center justify-center py-12 border border-gray-300 gap-3">
      <div className="w-12 h-12 flex items-center justify-center">
        <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-2 rounded-md">
          <GraduationCapIcon width={35} height={35} />
        </div>
      </div>
      <div>
        <h1 className="font-bold text-2xl text-gray-800">Repertoire is empty</h1>
        <h2 className="text-lg text-gray-600">Click "Add to Repertoire" to get started!</h2>
      </div>
    </div>
  );
};

const Unselected = () => {
  // const isWhite = useTrainerStore(s => s.chapter.trainAs === 'white');

  return (
    <div className="bg-white flex items-center justify-center py-12 border border-gray-300 gap-3">
      <div className="w-12 h-12 flex items-center justify-center">
        <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-2 rounded-md">
          <MousePointer width={35} height={35} />
        </div>
      </div>
      <div>
        <h1 className="font-bold text-2xl text-gray-800">No training mode selected</h1>
        <h2 className="text-md text-gray-600">Click Learn or Recall to start training</h2>
      </div>
    </div>
  );
};

export const UserTip = () => {
  const userTip = useTrainerStore((s) => s.userTip);
  const repertoire = useTrainerStore((s) => s.repertoire);
  const trainingMethod = useTrainerStore((s) => s.trainingMethod);

  if (repertoire.length == 0) return <EmptyRepertoire />;
  if (!trainingMethod) return <Unselected />;

  // TODO repertoireIndex should be correct, so user have a repertoire selected

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
