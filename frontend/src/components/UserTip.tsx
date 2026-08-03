import { ReactNode } from 'react';
import { useTrainerStore } from '../store/state';
import {
  GraduationCapIcon,
  HistoryIcon,
  LucideRepeat2,
  MousePointer,
  XIcon,
} from 'lucide-react';
import './UserTip.css';

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
  /** extra class on the icon wrapper, for tips whose glyph is sized differently */
  iconClassName?: string;
  actions?: TipAction[];
  grayIcon?: boolean;
};

const Tip = ({
  icon,
  title,
  description,
  titleClassName = 'tip-title',
  descriptionClassName = 'tip-description',
  iconClassName = '',
  actions,
  grayIcon = true,
}: TipProps) => (
  <div className="tip">
    <div className="tip-main">
      <div className="tip-icon-slot">
        <div className={`tip-icon ${grayIcon ? 'is-boxed' : ''} ${iconClassName}`}>{icon}</div>
      </div>
      <div className="tip-text">
        <span className={titleClassName}>{title}</span>
        <span className={descriptionClassName}>{description}</span>
      </div>
    </div>

    {actions && actions.length > 0 && (
      <div className="tip-actions">
        {actions.map((action, i) => (
          <button key={i} className="tip-action" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

const EmptyRepertoire = () => (
  <Tip
    icon={<GraduationCapIcon />}
    title="Repertoire is empty"
    description={'Click "Add to Repertoire" to get started!'}
  />
);

const Unselected = () => (
  <Tip
    icon={<MousePointer />}
    title="No training mode selected"
    description="Click Learn or Recall to start training"
    descriptionClassName="tip-description-small"
  />
);

export const UserTip = () => {
  const { userTip, repertoire, selectedChapterId, trainingMethod, trainableContext, lastGuess } =
    useTrainerStore();
  const train = useTrainerStore((s) => s.train);
  const setNextTrainable = useTrainerStore((s) => s.setNextTrainablePosition);
  const makeMove = useTrainerStore((s) => s.makeMove);
  const setUserTip = useTrainerStore((s) => s.setUserTip);

  if (repertoire.length == 0) return <EmptyRepertoire />;
  if (!trainingMethod) return <Unselected />;
  if (trainingMethod == 'edit') return null;

  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
  if (!chapter) return null;
  const san = trainableContext?.targetMove?.data.san;
  const isWhite = chapter.trainAs == 'white';
  switch (userTip) {
    case 'recall':
      return (
        <Tip
          icon={<HistoryIcon />}
          title="Play the move"
          description={`What does ${isWhite ? 'White' : 'Black'} play here?`}
        />
      );
    case 'learn':
      return (
        <Tip
          icon={<GraduationCapIcon />}
          title="Play the move"
          description={`${isWhite ? 'White' : 'Black'} plays ${san}`}
        />
      );
    case 'empty':
      return (
        <Tip
          icon={<XIcon />}
          iconClassName="tip-icon-small"
          title={`No more moves to ${trainingMethod}`}
          description="Try switching the training mode or modifying settings"
          titleClassName="tip-title-muted"
          descriptionClassName="tip-description-small"
        />
      );
    case 'alternate':
      return (
        <Tip
          icon={<LucideRepeat2 color={'gold'} />}
          iconClassName="tip-icon-alternate"
          title={`${lastGuess} is an alternate move`}
          description="Try playing a different move"
          grayIcon={false}
        />
      );
    case 'fail':
      return (
        <Tip
          icon={<div className="tip-cross">✗</div>}
          title={`${lastGuess} is incorrect`}
          grayIcon={false}
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
                  ADD <span className="tip-action-move">{lastGuess}</span>
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
