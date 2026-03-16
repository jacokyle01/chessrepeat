//TODO more robust implementation of moving - store logic in state.ts file
//TODO refactor:
// use number indexes into tree,
// put logic into state
// see en-crossaint

import {
  ArrowLeftToLineIcon,
  ArrowRightToLineIcon,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  MoveLeftIcon,
  MoveRightIcon,
} from 'lucide-react';
import { useTrainerStore } from '../../state/state';
import { fromNodeList, init } from '../../util/path';
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

  const first = (): void => jump(root);
  const prev = (): void => jump(init(selectedPath));

  return (
    <div id="pgn-control" className="flex justify-between w-1/2 mt-3 items-center m-auto">
      <button onClick={first} className="bg-gray-200 text-gray-700 px-1 rounded-md">
        {<ArrowLeftToLineIcon size={30} />}
      </button>
      <button onClick={prev} className="bg-gray-200 text-gray-700 px-1 rounded-md">
        {<MoveLeftIcon size={30} />}
      </button>
      <button onClick={next} className="bg-gray-200 text-gray-700 px-1 rounded-md">
        {<MoveRightIcon size={30} />}
      </button>
      <button onClick={last} className="bg-gray-200 text-gray-700 px-1 rounded-md">
        {<ArrowRightToLineIcon size={30} />}
      </button>
    </div>
  );
};

export default PgnControls;
