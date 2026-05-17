import { ReactNode } from 'react';
import { useTrainerStore } from '../store/state';
import {
  GraduationCapIcon,
  HistoryIcon,
  LucideRepeat2,
  MousePointer,
  XIcon,
} from 'lucide-react';

type TipAction = {
  label: ReactNode;
  onClick: () => void;
};

type TipProps = {
  icon: ReactNode;
  title: string;
  description: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actions?: TipAction[];
};

const Tip = ({
  icon,
  title,
  description,
  titleClassName = 'font-bold text-base md:text-lg text-gray-800',
  descriptionClassName = 'text-md text-gray-600',
  actions,
}: TipProps) => (
  <div className="bg-white flex flex-col items-center py-4 md:px-6 border border-gray-300 rounded-lg">
    <div className="inline-flex items-center gap-2 md:gap-3">
      <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center">
        <div className="text-gray-500 p-1.5 md:p-2 rounded-md">{icon}</div>
      </div>
      <div className="text-start flex flex-col">
        <span className={titleClassName}>{title}</span>
        <span className={descriptionClassName}>{description}</span>
      </div>
    </div>

    {actions && actions.length > 0 && (
      <div className="flex flex-row items-center justify-center gap-1 md:gap-2 w-full px-2 md:px-4 pt-2 ">
        {actions.map((action, i) => (
          <button
            key={i}
            className="flex-1 py-1 hover:bg-gray-50 text-brand-blue rounded-md font-semibold text-xs md:text-sm whitespace-nowrap"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

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
  const train = useTrainerStore((s) => s.train);
  const setNextTrainable = useTrainerStore((s) => s.setNextTrainablePosition);
  const makeMove = useTrainerStore((s) => s.makeMove);
  const setUserTip = useTrainerStore((s) => s.setUserTip);

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
      return (
        <Tip
          icon={<div className="text-red-500 text-2xl md:text-4xl">✗</div>}
          title={`${lastGuess} is incorrect`}
          description={`${isWhite ? 'White' : 'Black'} plays ${san}`}
          actions={[
            {
              label: 'CONTINUE',
              onClick: () => {
                train(false);
                setNextTrainable();
              },
            },
            {
              label: 'UNDO',
              onClick: () => setUserTip('recall'),
            },
            {
              label: (
                <>
                  ADD <span className="text-black">{lastGuess}</span>
                </>
              ),
              onClick: () => {
                makeMove(lastGuess);
                setUserTip('recall');
              },
            },
          ]}
        />
      );
    default:
      return <div>Other</div>;
  }
};
