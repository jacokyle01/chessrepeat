import { ReactNode } from 'react';
import { useTrainerStore } from '../store/state';
import {
  GraduationCapIcon,
  HistoryIcon,
  LucideRepeat2,
  MousePointer,
  XIcon,
} from 'lucide-react';

type TipProps = {
  icon: ReactNode;
  title: string;
  description: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

const Tip = ({
  icon,
  title,
  description,
  titleClassName = 'font-bold text-base md:text-2xl text-gray-800',
  descriptionClassName = 'text-sm md:text-lg text-gray-600',
}: TipProps) => (
  <div className="bg-white flex justify-center p-4 md:px-6 border border-gray-300 rounded-md">
    <div className="inline-flex items-center gap-2 md:gap-3">
      <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center">
        <div className="text-gray-500 bg-gray-200 p-1.5 md:p-2 rounded-md">{icon}</div>
      </div>
      <div className="text-start">
        <h1 className={titleClassName}>{title}</h1>
        <h2 className={descriptionClassName}>{description}</h2>
      </div>
    </div>
  </div>
);

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
    <div className="bg-white py-2 md:py-5 flex flex-col items-center rounded-md border border-gray-300">
      <div className="flex flex-row justify-center items-center w-full space-x-3 md:space-x-5 pb-2 md:pb-5">
        <div className="text-red-500 text-4xl md:text-7xl font-bold">✗</div>
        <div id="failure">
          <h2 className="font-bold text-base md:text-2xl text-gray-800">{`${lastGuess} is incorrect`}</h2>
          <p className="text-sm md:text-lg text-gray-600">{`${isWhite ? 'White' : 'Black'} plays ${san}`}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-row items-center justify-center gap-1 md:gap-2 w-full px-2 md:px-4">
        <button
          className="flex-1 py-1 hover:bg-gray-50 text-blue-400 rounded-md font-semibold text-xs md:text-sm whitespace-nowrap"
          onClick={onContinue}
        >
          CONTINUE
        </button>

        <button
          className="flex-1 py-1 hover:bg-gray-50 text-blue-400 rounded-md font-semibold text-xs md:text-sm whitespace-nowrap"
          onClick={() => setUserTip('recall')}
        >
          UNDO
        </button>

        <button
          className="flex-1 py-1 hover:bg-gray-50 text-blue-400 rounded-md font-semibold text-xs md:text-sm whitespace-nowrap"
          onClick={() => onMarkAlternative(lastGuess)}
        >
          ADD <span className="text-black">{lastGuess}</span>
        </button>
      </div>
    </div>
  );
};

const Alternate = () => {
  const lastGuess = useTrainerStore.getState().lastGuess;

  return (
    <div className="border-t-2">
      <div className="bg-white py-3 md:py-10 shadow-md flex flex-col items-center">
        <div className="flex flex-row justify-center items-center w-full space-x-3 md:space-x-5">
          <LucideRepeat2 className="w-8 h-8 md:w-12 md:h-12" color={'gold'} />
          <div>
            <h2 className="font-bold text-base md:text-2xl text-amber-400">{`${lastGuess} is an alternate move`}</h2>
            <p className="text-sm md:text-lg text-gray-600">Try playing a different move</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmptyRepertoire = () => (
  <Tip
    icon={<GraduationCapIcon className="w-5 h-5 md:w-[35px] md:h-[35px]" />}
    title="Repertoire is empty"
    description={'Click "Add to Repertoire" to get started!'}
  />
);

const Unselected = () => (
  <Tip
    icon={<MousePointer className="w-5 h-5 md:w-[35px] md:h-[35px]" />}
    title="No training mode selected"
    description="Click Learn or Recall to start training"
    descriptionClassName="text-xs md:text-md text-gray-600"
  />
);

export const UserTip = () => {
  const { userTip, repertoire, repertoireIndex, trainingMethod, trainableContext, lastGuess } =
    useTrainerStore();

  if (repertoire.length == 0) return <EmptyRepertoire />;
  if (!trainingMethod) return <Unselected />;
  if (trainingMethod == 'edit') return null;

  const chapter = repertoire[repertoireIndex];
  const san = trainableContext?.targetMove?.data.san;
  const isWhite = chapter.trainAs == 'white';
  switch (userTip) {
    case 'recall':
      return (
        <Tip
          icon={<HistoryIcon className="w-5 h-5 md:w-[35px] md:h-[35px]" />}
          title="Play the move"
          description={`What does ${isWhite ? 'White' : 'Black'} play here?`}
        />
      );
    case 'learn':
      return (
        <Tip
          icon={<GraduationCapIcon className="w-5 h-5 md:w-[35px] md:h-[35px]" />}
          title="Play the move"
          description={`${isWhite ? 'White' : 'Black'} plays ${san}`}
        />
      );
    case 'empty':
      return (
        <Tip
          icon={<XIcon className="w-5 h-5 md:w-[25px] md:h-[25px]" />}
          title={`No more moves to ${trainingMethod}`}
          description="Try switching the training mode or modifying settings"
          titleClassName="font-bold text-sm md:text-xl text-gray-600"
          descriptionClassName="text-xs md:text-md text-gray-600"
        />
      );
    case 'alternate':
      return (
        <Tip
          icon={<LucideRepeat2 className="w-8 h-8 md:w-12 md:h-12" color={'gold'} />}
          title={`${lastGuess} is an alternate move`}
          description="Try playing a different move"
        />
      );
    case 'fail':
      return <Fail />;
    default:
      return <div>Other</div>;
  }
};
