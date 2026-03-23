import { useState, useEffect } from 'react';
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

const Recall = () => {
  const { repertoire, repertoireIndex } = useTrainerStore();
  const chapter = repertoire[repertoireIndex];
  if (!chapter) return;
  const isWhite = chapter.trainAs == 'white';

  return (
    <div className="bg-white justify-center border border-gray-300 rounded-md">
      <div className="flex items-center justify-center py-12 px-6 gap-3">
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
  const san = useTrainerStore.getState().trainableContext.targetMove.data.san;
  const { repertoire, repertoireIndex } = useTrainerStore();
  const chapter = repertoire[repertoireIndex];
  const isWhite = chapter.trainAs == 'white';

  return (
    <div className="bg-white flex items-center justify-center py-12 border border-gray-300 gap-3 rounded-md">
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
    <div className="bg-white flex items-center justify-center py-12 border border-gray-300 gap-1 rounded-md">
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
  const { repertoire, repertoireIndex } = useTrainerStore();
  const chapter = repertoire[repertoireIndex];
  const isWhite = chapter.trainAs == 'white';
  return (
    <div className="bg-white py-5 flex flex-col items-center rounded-md border border-gray-300">
      <div className="flex flex-row justify-center items-center w-full space-x-5 pb-5">
        <div className="text-red-500 text-7xl font-bold">✗</div>
        <div id="failure">
          <h2 className="font-bold text-2xl text-gray-800">{`${lastGuess} is incorrect`}</h2>
          <p className="text-lg text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-row items-center justify-center gap-2 w-full px-4">
        <button
          className="flex-1 py-1 hover:bg-gray-50 text-blue-400 rounded-md font-semibold text-sm whitespace-nowrap"
          onClick={onContinue}
        >
          CONTINUE
        </button>

        <button
          className="flex-1 py-1 hover:bg-gray-50 text-blue-400 rounded-md font-semibold text-sm whitespace-nowrap"
          onClick={() => setUserTip('recall')}
        >
          UNDO GUESS
        </button>

        <button
          className="flex-1 py-1 hover:bg-gray-50 text-blue-400 rounded-md font-semibold text-sm whitespace-nowrap"
          onClick={() => onMarkAlternative(lastGuess)}
        >
          ADD <span className="text-black">{lastGuess}</span> TO MOVES
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

//TODO factor this out of userTip?
const EditComment = () => {
  const selectedNode = useTrainerStore((s) => s.selectedNode);
  const selectedPath = useTrainerStore((s) => s.selectedPath);
  const setCommentAt = useTrainerStore((s) => s.setCommentAt);

  const savedComment = selectedNode?.data?.comment ?? '';
  const [draft, setDraft] = useState(savedComment);

  useEffect(() => {
    setDraft(selectedNode?.data?.comment ?? '');
  }, [selectedPath, selectedNode?.data?.comment]);

  const isDirty = draft !== savedComment;

  const handleSave = () => {
    if (selectedPath !== undefined) {
      setCommentAt(draft, selectedPath);
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-md p-4">
      <label className="block text-sm font-semibold text-gray-700 mb-1">Comment</label>
      <textarea
        className="w-full text-sm text-gray-700 rounded-md border border-gray-300 p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
        rows={3}
        value={draft}
        placeholder="~no comment~"
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex items-center justify-between mt-2 h-6">
        <span
          className={`text-xs text-amber-600 transition-opacity duration-150 ${isDirty ? 'opacity-100' : 'opacity-0'}`}
        >
          Unsaved changes
        </span>
        <button
          className={`text-sm font-semibold px-3 py-1 rounded transition ${
            isDirty
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          disabled={!isDirty}
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </div>
  );
};

export const UserTip = () => {
  const userTip = useTrainerStore((s) => s.userTip);
  const repertoire = useTrainerStore((s) => s.repertoire);
  const trainingMethod = useTrainerStore((s) => s.trainingMethod);

  if (!trainingMethod) return <Unselected />;
  if (trainingMethod == 'edit') return <EditComment />;
  if (repertoire.length == 0) return <EmptyRepertoire />;

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
