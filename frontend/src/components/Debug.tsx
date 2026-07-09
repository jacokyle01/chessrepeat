import { parseSan } from 'chessops/san';
import { useTrainerStore } from '../store/state';
import { Chess } from 'chessops';
import { INITIAL_BOARD_FEN, parseFen } from 'chessops/fen';

export const Debug: React.FC = () => {
  const trainingPath = useTrainerStore.getState().trainableContext?.startingPath;
  const targetMove = useTrainerStore.getState().trainableContext?.targetMove;

  const selectedPath = useTrainerStore.getState().selectedPath;
  const TrainingMethod = useTrainerStore.getState().trainingMethod;

  const { repertoire, selectedChapterId } = useTrainerStore.getState();

  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
  if (!chapter) return undefined;
  console.log(targetMove?.data?.fen);
  return (
    <div className="absolute bottom-0 p-15">
      <div>{`chapter ${chapter.unseenCount}`}</div>
      <div>{`TrainingPath ${trainingPath}`}</div>
      <div>{`selectedPath ${selectedPath}`}</div>
      <div>{`TrainingMethod ${TrainingMethod}`}</div>
      <div>{`TrainingPath ${trainingPath}`}</div>
      <div>{`targetMove ${targetMove?.data?.fen}`}</div>
    </div>
  );
};
