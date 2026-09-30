//TODO more robust implementation of moving - store logic in state.ts file
//TODO refactor:
// use number indexes into tree,
// put logic into state
// see en-crossaint

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrainerStore } from '../../store/state';
import { firstMove as first, lastMove as last, nextMove as next, prevMove as prev } from '../../util/navigation';
import './TreeControls.css';
const PgnControls = () => {
  const selectedPath = useTrainerStore().selectedPath || '';
  const selectedNode = useTrainerStore().selectedNode;

  const trainingPath = useTrainerStore().trainableContext?.startingPath || '';

  const trainingMethod = useTrainerStore().trainingMethod;

  const atStart = selectedPath === '';
  const atEnd =
    trainingMethod === 'edit' ? !selectedNode?.children?.[0] : selectedPath.length >= trainingPath.length;

  return (
    <div id="pgn-control" className="control-tab">
      <button
        onClick={first}
        disabled={atStart}
        aria-label="First move"
        className="control-tab-btn pgn-control-btn"
      >
        <ChevronFirst size={20} />
      </button>
      <button
        onClick={prev}
        disabled={atStart}
        aria-label="Previous move"
        className="control-tab-btn pgn-control-btn"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        disabled={atEnd}
        aria-label="Next move"
        className="control-tab-btn pgn-control-btn"
      >
        <ChevronRight size={20} />
      </button>
      <button
        onClick={last}
        disabled={atEnd}
        aria-label="Last move"
        className="control-tab-btn pgn-control-btn"
      >
        <ChevronLast size={20} />
      </button>
    </div>
  );
};

export default PgnControls;
