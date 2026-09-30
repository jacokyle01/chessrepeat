// Stepping through the selected chapter's moves. Shared by the buttons under
// the PGN tree and the keyboard shortcuts, so both read the store at call time.

import { useTrainerStore } from '../store/state';
import { fromNodeList, init } from './path';
import { collect } from './tree';

export const firstMove = (): void => useTrainerStore.getState().jump('');

export const prevMove = (): void => {
  const { selectedPath, jump } = useTrainerStore.getState();
  jump(init(selectedPath || ''));
};

export const nextMove = (): void => {
  const { trainingMethod, selectedNode, trainableContext, jump } = useTrainerStore.getState();
  const selectedPath = useTrainerStore.getState().selectedPath || '';

  if (trainingMethod == 'edit') {
    const child = selectedNode?.children?.[0];
    if (child) jump(selectedPath + child.data.id);
    return;
  }

  // learn or recall: step along the line leading to the position being trained
  const pathToTrain = trainableContext?.startingPath || '';
  if (selectedPath.length < pathToTrain.length) {
    jump(selectedPath + pathToTrain.slice(selectedPath.length, selectedPath.length + 2));
  }
};

export const lastMove = (): void => {
  const { trainingMethod, trainableContext, repertoire, selectedChapterId, jump } =
    useTrainerStore.getState();

  if (trainingMethod != 'edit') {
    jump(trainableContext?.startingPath || '');
    return;
  }

  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
  if (!chapter) return;
  // mainline: always the first child. The root itself carries no id.
  const mainline = collect(chapter.root, (n) => n.children[0]);
  jump(fromNodeList(mainline.slice(1)));
};
