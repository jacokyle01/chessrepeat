import { useTrainerStore } from '../state/state';

export const Debug: React.FC = ({atLast}) => {
  const trainingPath = useTrainerStore.getState().trainableContext?.startingPath;
  const selectedPath = useTrainerStore.getState().selectedPath;
  const repertoireMethod = useTrainerStore.getState().repertoireMethod;

  return (
    <div className='absolute bottom-0 p-15'>
      <div>{`TrainingPath ${trainingPath}`}</div>
      <div>{`selectedPath ${selectedPath}`}</div>
      <div>{`atLast ${atLast()}`}</div>
      <div>{`repertoireMethod ${repertoireMethod}`}</div>
      <div>{`TrainingPath ${trainingPath}`}</div>

    </div>
  );
};
