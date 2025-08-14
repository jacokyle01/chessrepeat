//TODO more robust implementation of moving - store logic in state.ts file

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTrainerStore } from '../../state/state';

import { ops, path as treePath } from '../tree/tree';

const PgnControls = ({ jump }) => {
  const setSelectedPath = useTrainerStore((state) => state.setSelectedPath);
  const setSelectedNode = useTrainerStore((state) => state.setSelectedNode);

  const selectedPath = useTrainerStore().selectedPath || '';
  const selectedNode = useTrainerStore().selectedNode;

  const trainingPath = useTrainerStore().trainableContext?.startingPath || '';

  const repertoire = useTrainerStore().repertoire;
  const repertoireIndex = useTrainerStore().repertoireIndex;

  const repertoireMethod = useTrainerStore().repertoireMethod;
  const chapter = repertoire[repertoireIndex];
  // export function next(ctrl: AnalyseCtrl): void {
  //   if (ctrl.retro?.preventGoingToNextMove()) return;
  //   if (ctrl.fork.proceed()) return;
  //   const child = ctrl.node.children[0];
  //   if (child) ctrl.userJumpIfCan(ctrl.path + child.id);
  // }

  // export const prev = (ctrl: AnalyseCtrl): void => ctrl.userJumpIfCan(treePath.init(ctrl.path));

  const next = (): void => {
    const child = selectedNode.children[0];
    if (child) jump(selectedPath + child.id);
  };

  //TODO we can also generate the mainline as part of initialization
  const last = (): void => {
    if (repertoireMethod != 'edit') jump(trainingPath);
    else {
      const mainline = ops.mainlineNodeList(chapter.tree.root);
      jump(treePath.fromNodeList(mainline));
    }
  };

  const first = (): void => jump(treePath.root);
  const prev = (): void => jump(treePath.init(selectedPath));

  return (
    <div id="pgn-control" className="flex justify-between w-1/2 mt-3 items-center m-auto">
      <button onClick={first}>{<ChevronFirst size={36} />}</button>
      <button onClick={prev}>{<ChevronLeft size={36} />}</button>
      <button
        onClick={next}
      >
        {<ChevronRight size={36} />}
      </button>
      <button onClick={last}>{<ChevronLast size={36} />}</button>
    </div>
  );
};

export default PgnControls;
