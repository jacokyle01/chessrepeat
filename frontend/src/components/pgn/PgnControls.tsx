import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrainerStore } from '../../state/state';

const PgnControls = ({ makeCgOpts }) => {
  return (
    <div id="pgn-control" className="flex justify-between w-3/4 mt-3 items-center m-auto">
      <button
        onClick={() => {
          // setPathIndex(0);
          const opts = makeCgOpts();
          useTrainerStore.setState((state) => ({
            cbConfig: {
              ...state.cbConfig,
              ...opts,
            },
          }));
        }}
      >
        {<ChevronFirst />}
      </button>
      <button
        onClick={() => {
          // setPathIndex(Math.max(pathIndex - 1, 0));
          const opts = makeCgOpts();
          useTrainerStore.setState((state) => ({
            cbConfig: {
              ...state.cbConfig,
              ...opts,
            },
          }));
        }}
      >
        {<ChevronLeft />}
      </button>
      <button
        onClick={() => {
          // setPathIndex(Math.min(lastLength, pathIndex + 1));
          const opts = makeCgOpts();
          useTrainerStore.setState((state) => ({
            cbConfig: {
              ...state.cbConfig,
              ...opts,
            },
          }));
        }}
      >
        {<ChevronRight />}
      </button>
      <button 
      // onClick={ () => setPathIndex(lastLength)} className={!atLast ? 'animate-pulse-blue' : ''}
        >
        {<ChevronLast />}
      </button>
    </div>
  );
};

export default PgnControls;
