import { Color, CountDueContext, PathContext, Chapter, TrainingContext, TrainingData } from './types';
import { defaultPosition } from 'chessops/variant';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import { makePgn, Node, PgnNodeData, startingPosition, transform } from 'chessops/pgn';
import { RepertoireEntry } from '../types/types';
import PrepCtrl from '../ctrl';

export const trainingContext = (color: Color): TrainingContext => {
  return {
    trainable: color == 'white',
    id: -1,
    pos: defaultPosition('chess'),
    clone() {
      const clonedCtx: TrainingContext = {
        ...this,
        pos: this.pos.clone(),
      };
      return clonedCtx;
    },
  };
};

export const countDueContext = (count: number): CountDueContext => {
  return {
    count,
    clone() {
      const clonedCtx: CountDueContext = {
        ...this,
      };
      return clonedCtx;
    },
  };
};

//initialize a raw pgn. does the following:
//a) marks moves made by our color as "trainable"
//b) disables training of moves made by opposite color

export const annotateMoves = (
  root: Node<PgnNodeData>,
  color: Color,
  // buckets: number[],
): {
  moves: Node<TrainingData>;
  // meta: {
  //   trainAs: Color;
  //   nodeCount: number;
  //   bucketEntries: number[];
  // };
} => {
  const context = trainingContext(color);
  let idCount = 0;
  let trainableNodes = 0;

  return {
    moves: transform(root, context, (context, data) => {
      const move = parseSan(context.pos, data.san);
      // assume the move is playable
      context.pos.play(move!);

      context.trainable = !context.trainable;
      context.id++;
      idCount++;

      if (context.trainable) {
        trainableNodes++;
      }

      return {
        ...data,
        fen: makeFen(context.pos.toSetup()),
        training: {
          id: idCount,
          disabled: context.trainable,
          seen: false,
          group: -1,
          dueAt: -1,
        },
      };
    }),
    // meta: {
    //   trainAs: color,
    //   nodeCount: trainableNodes,
    //   bucketEntries: buckets.map(() => 0),
    // },
  };
};

/*
  Annotate a each SAN of a RepertoireEntry by adding a preceding comment with
  training state. Necessary for exporting a repertoire as a PGN 
  without losing training information
*/

export const exportRepertoireEntry = (entry: RepertoireEntry) => {
  //TODO need deep copy
  let headers = new Map<string, string>();
  let currentTime = Math.round(Date.now() / 1000);

  // add training control headers
  headers.set('RepertoireFileName', entry.name);
  headers.set('LastDueCount', `${entry.lastDueCount}`);
  headers.set('TrainAs', entry.chapter.trainAs);
  headers.set('bucketEntries', entry.chapter.bucketEntries.toString());
  headers.set('nodeCount', `${entry.chapter.nodeCount}`);
  headers.set('Event', 'ChessrepeatRepertoireFile');
  headers.set('Time', currentTime.toString());

  const pos = startingPosition(entry.subrep.headers).unwrap();
  // annotate moves with training metadata
  const annotatedMoves = transform(entry.subrep.moves, pos, (pos, node) => {
    const newNode = { ...node, comments: node.comments ? [...node.comments] : [] };

    let trainingHeader = `${node.training.id},${node.training.disabled ? 1 : 0},${node.training.seen ? 1 : 0},${node.training.group},${node.training.dueAt === Infinity ? 'I' : currentTime - node.training.dueAt}`;

    newNode.comments.unshift(trainingHeader);

    return newNode;
  });

  let subrep: Chapter<TrainingData> = {
    meta: {
      trainAs: entry.chapter.trainAs,
      nodeCount: entry.chapter.nodeCount,
      bucketEntries: entry.chapter.bucketEntries,
    },
    headers,
    moves: annotatedMoves,
  };

  const pgn = makePgn(subrep) + '\n';
  return pgn;
};

export const mergeTrees = (
  ctrl: PrepCtrl,
  subrep: Chapter<TrainingData>,
  newPgn: Node<PgnNodeData>,
): Chapter<TrainingData> => {
  // annotate newPgn moves
  const newSubrep = generateChapter(newPgn, chapter.trainAs, ctrl.srsConfig.buckets!);
  console.log(newPgn);
  const mergedPgn = mergePgns(subrep.moves, newSubrep.moves);
  const mergedSubrep: Chapter<TrainingData> = {
    ...subrep,
    moves: mergedPgn,
  };
  return mergedSubrep;
};

let i = 0;
export const mergePgns = (oldPgn: Node<PgnNodeData>, newPgn: Node<PgnNodeData>): Node<TrainingData> => {
  console.log('newPgn', newPgn);
  console.log(++i);
  // filter out oldPgn nodes that aren't present in newPgn
  oldPgn.children = (oldPgn.children || []).filter((oldChild) => {
    console.log('oldChild1', oldChild);
    const val = newPgn.children.some((newChild) => {
      console.log('newChild1', newChild);
      console.log('newchildsan', newChild.data.san);
      console.log('oldchildsan', oldChild.data.san);

      const val2 = newChild.data.san === oldChild.data.san;
      // console.log(val2);
      return val2;
    });
    console.log(val);
    return val;
  });

  console.log('newoldPGN', oldPgn);
  // merge corresponding children nodes, that is,
  // nodes with the same SAN
  console.log('oldPgn', oldPgn);
  oldPgn.children.forEach((oldChild) => {
    console.log('oldChild', oldChild);
    const newChild = newPgn.children.find((newChild) => {
      return newChild.data.san === oldChild.data.san;
    });
    // shouldn't be undefined since we just filtered out duplicates
    console.log('newChild', newChild);
    mergePgns(oldChild, newChild);
  });

  // add new nodes, if necessary
  newPgn.children.forEach((newChild) => {
    // if a new Child isn't included in the old node's children, add it
    if (
      !oldPgn.children.some((oldChild) => {
        return oldChild.data.san === newChild.data.san;
      })
    ) {
      // include new child in old node's children
      // recursively adds everything
      oldPgn.children.push(newChild);
    }
  });

  return oldPgn;
};

export const pathContext: PathContext = {
  path: '',
  clone() {
    const clonedCtx: PathContext = { ...this };
    return clonedCtx;
  },
};
