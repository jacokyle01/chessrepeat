import { useTrainerStore } from '../state/state';

export const Debug: React.FC = () => {
  const trainingPath = useTrainerStore.getState().trainableContext?.startingPath;
  const selectedPath = useTrainerStore.getState().selectedPath;
  const TrainingMethod = useTrainerStore.getState().trainingMethod;

  return (
    <div className="absolute bottom-0 p-15">
      <div>{`TrainingPath ${trainingPath}`}</div>
      <div>{`selectedPath ${selectedPath}`}</div>
      <div>{`TrainingMethod ${TrainingMethod}`}</div>
      <div>{`TrainingPath ${trainingPath}`}</div>
    </div>
  );
};
