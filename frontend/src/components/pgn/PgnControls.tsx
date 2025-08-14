//TODO more robust implementation of moving - store logic in state.ts file 

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrainerStore } from '../../state/state';

const PgnControls = ({ makeCgOpts }) => {
    const setSelectedPath = useTrainerStore((state) => state.setSelectedPath);
    const setSelectedNode = useTrainerStore((state) => state.setSelectedNode);

    const selectedPath = useTrainerStore().selectedPath;
    const selectedNode = useTrainerStore().selectedNode;

  





  return (
    <div id="pgn-control" className="flex justify-between w-1/2 mt-3 items-center m-auto">
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
        {<ChevronFirst size={36}/>}
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
        {<ChevronLeft size={36} />}
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
        {<ChevronRight size={36} />}
      </button>
      <button 
      // onClick={ () => setPathIndex(lastLength)} className={!atLast ? 'animate-pulse-blue' : ''}
        >
        {<ChevronLast size={36}/>}
      </button>
    </div>
  );
};

export default PgnControls;
