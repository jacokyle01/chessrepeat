import { useTrainerStore } from '../state/state';

export const Debug: React.FC = ({atLast}) => {
  const trainingPath = useTrainerStore.getState().trainingPath;
  const selectedPath = useTrainerStore.getState().selectedPath;


  return (
    <div className='absolute bottom-0 p-15'>
      <div>{`TrainingPath ${trainingPath}`}</div>
      <div>{`selectedPath ${selectedPath}`}</div>
      <div>{`atLast ${atLast()}`}</div>
      <div>{`TrainingPath ${trainingPath}`}</div>
      <div>{`TrainingPath ${trainingPath}`}</div>

    </div>
  );
};
