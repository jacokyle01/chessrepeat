//TODO more robust implementation of moving - store logic in state.ts file
//TODO refactor:
// use number indexes into tree,
// put logic into state
// see en-crossaint

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrainerStore } from '../../store/state';
import { fromNodeList, init } from '../../util/path';
import './TreeControls.css';
const PgnControls = () => {
  const setSelectedPath = useTrainerStore((state) => state.setSelectedPath);
  const setSelectedNode = useTrainerStore((state) => state.setSelectedNode);

  const selectedPath = useTrainerStore().selectedPath || '';
  const selectedNode = useTrainerStore().selectedNode;

  const trainingPath = useTrainerStore().trainableContext?.startingPath || '';

  const chapter = useTrainerStore.getState().activeChapter;

  const trainingMethod = useTrainerStore().trainingMethod;

  const jump = useTrainerStore((s) => s.jump);

  const next = (): void => {
    if (trainingMethod == 'edit') {
      const child = selectedNode.children[0];
      if (child) jump(selectedPath + child.data.id);
    }
    // learn or recall
    else {
    }
    const pathToTrain = useTrainerStore.getState().trainableContext?.startingPath || '';
    // dynamically generate training path from string path
    const currentPath = selectedPath;

    const nextId = pathToTrain.slice(currentPath.length, currentPath.length + 2);

    if (currentPath.length < pathToTrain.length) jump(selectedPath + nextId);
  };

  //TODO we can also generate the mainline as part of initialization
  const last = (): void => {
    if (trainingMethod != 'edit') jump(trainingPath);
    else {
      const mainline = mainlineNodeList(chapter.root);
      jump(fromNodeList(mainline));
    }
  };

  const first = (): void => jump('');
  const prev = (): void => jump(init(selectedPath));

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
