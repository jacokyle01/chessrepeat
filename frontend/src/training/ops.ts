/*
  Spaced repetition algorithms
*/

import { forEachNode } from '../tree/ops';
import { currentTime } from '../util';
import { TrainableContext, TrainingMethod, TrainableNode, TrainingConfig, TrainingData } from './types';

/*
  Get the next trainable path, if it exists
*/

// Returns a string string
// - easier to set selected node in the DOM
// - have to use getNodeList() to convert to ChildNode<TrainingData>[]
// - generally easier to convert from path to node
// - TODO: more verbose return values - give more context for why `nextTrainablePath()` failed
//  */

//TODO return path to position + target ChildNode<TrainingData>
//TODO better type for getNext
export function computeNextTrainableNode(
  root: TrainableNode,
  method: TrainingMethod,
  getNext: any,
): TrainableContext | null {
  // let method = useTrainerStore.getState().TrainingMethod;
  // let repertoireIndex = useTrainerStore.getState().repertoireIndex;
  // let repertoire = useTrainerStore.getState().repertoire;

  //initialization
  // TODO refactor to ops or tree file?
  interface DequeEntry {
    nodeList: TrainableNode[];
    layer: number;
    pathToHere: string;
    targetNode: TrainableNode;
  }

  const deque: DequeEntry[] = [];

  // console.log('root in  computeNextTrainableNode', root);
  // //initialize deque
  // console.log('root', root);
  // for (const child of roots.children) {
  //   deque.push({
  //     nodeList: [child],
  //     layer: 0,
  //     pathToHere: '',
  //     targetNode: child,
  //   });
  // }
  //TODO just push root directly? would that work? 
  root.children.forEach((child) => {
    deque.push({
      nodeList: [child],
      layer: 0,
      pathToHere: '',
      targetNode: child,
    });
  });
  while (deque.length != 0) {
    //initialize dedequed path
    const entry = getNext!.by == 'breadth' ? deque.shift()! : deque.pop()!;
    const pos = entry.nodeList.at(-1)!;

    //test if match
    if (!pos.data.training.disabled) {
      switch (method) {
        case 'recall': //recall if due
          //TODO remove some pos._ fields
          if (pos.data.training.seen && pos.data.training.dueAt <= currentTime()) {
            return {
              startingPath: entry.pathToHere,
              targetMove: entry.targetNode,
            };
          }
          break;
        case 'learn': //learn if unseen
          if (!pos.data.training.seen) {
            return {
              startingPath: entry.pathToHere,
              targetMove: entry.targetNode,
            };
          }
          break;
      }
    }

    //push child nodes
    //TODO guarantee non-full
    // TODO check math to ensure that max is followed appropriately
    if (entry.layer < getNext!.max! * 2) {
      // TODO ?
      for (const child of pos.children) {
        const DequeEntry: DequeEntry = {
          nodeList: [...entry.nodeList, child],
          layer: ++entry.layer,
          pathToHere: entry.pathToHere + entry.targetNode.data.id,
          targetNode: child,
        };
        deque.push(DequeEntry);
      }
    }
  }
  return null;
}

// TODO provide a more detailed breakdown, like when each one is due.
// TODO combine this with nextTrainablePath() so we don't need to walk the tree twice

/*
  Traverse current chapter to get data when positions are due, 
  returning bucketed intervals of due dates.
*/
export function computeDueCounts(root: TrainableNode, buckets: number[]): number[] {
  const counts = new Array(1 + buckets.length).fill(0);
  const time = currentTime();

  forEachNode(root, (node) => {
    const t = node.data.training;
    if (t.disabled || !t.seen) return;

    const secondsTilDue = t.dueAt - time;
    if (secondsTilDue <= 0) {
      counts[0]++;
      return;
    }

    for (let i = 0; i < buckets.length; i++) {
      if (secondsTilDue <= buckets[i]) {
        counts[i + 1]++;
        return;
      }
    }
  });

  return counts;
}

/*
    Calculate 
  */
export function computeSucceedUpdate(
  node: TrainableNode,
  method: TrainingMethod,
  config: TrainingConfig,
): {
  timeToAdd: number;
  // training field updates (apply to node.data.training or your flattened node fields)
  nextTraining: Partial<TrainingData['training']> & { dueAt: number };
  // how to adjust chapter.bucketEntries
  bucketDelta: { to: number } | null;
} {
  const t = node.data.training;
  const time = currentTime();

  if (method === 'recall') {
    const from = t.group;

    let to = from;
    if (config.promotion === 'most') to = config.buckets.length - 1;
    else to = Math.min(from + 1, config.buckets.length - 1);

    const timeToAdd = config.buckets[to];
    return {
      timeToAdd,
      nextTraining: { group: to, dueAt: time + timeToAdd },
      bucketDelta: { from, to },
    };
  }

  const to = 0;
  const timeToAdd = config.buckets[to];
  return {
    timeToAdd,
    nextTraining: { seen: true, group: to, dueAt: time + timeToAdd },
    // learning marks it as "seen" globally; you were incrementing bucketEntries[0]
    bucketDelta: { to },
  };
}
