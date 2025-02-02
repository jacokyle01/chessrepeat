import { Color, CountDueContext, PathContext, Subrepertoire, TrainingContext, TrainingData } from './types';
import { defaultPosition } from 'chessops/variant';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import { makePgn, Node, PgnNodeData, startingPosition, transform } from 'chessops/pgn';
import { RepertoireEntry } from '../types/types';

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

export const generateSubrepertoire = (
  root: Node<PgnNodeData>,
  color: Color,
  buckets: number[],
): {
  moves: Node<TrainingData>;
  meta: {
    trainAs: Color;
    nodeCount: number;
    bucketEntries: number[];
  };
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
          dueAt: Infinity,
        },
      };
    }),
    meta: {
      trainAs: color,
      nodeCount: trainableNodes,
      bucketEntries: buckets.map(() => 0),
    },
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

  // add training control headers
  headers.set('RepertoireFileName', entry.name);
  headers.set('LastDueCount', `${entry.lastDueCount}`);
  headers.set('TrainAs', entry.subrep.meta.trainAs);
  headers.set('bucketEntries', entry.subrep.meta.bucketEntries.toString());
  headers.set('nodeCount', `${entry.subrep.meta.nodeCount}`);
  headers.set('Event', 'ChessrepeatRepertoireFile');

  const pos = startingPosition(entry.subrep.headers).unwrap();
  // annotate moves with training metadata
  const annotatedMoves = transform(entry.subrep.moves, pos, (pos, node) => {
    const newNode = { ...node, comments: node.comments ? [...node.comments] : [] };

    let trainingHeader = `${node.training.id},${node.training.disabled},${node.training.seen},${node.training.group},${node.training.dueAt}`;

    newNode.comments.unshift(trainingHeader);

    return newNode;
  });

  let subrep: Subrepertoire<TrainingData> = {
    meta: {
      trainAs: entry.subrep.meta.trainAs,
      nodeCount: entry.subrep.meta.nodeCount,
      bucketEntries: entry.subrep.meta.bucketEntries,
    },
    headers,
    moves: annotatedMoves,
  };

  const pgn = makePgn(subrep) + '\n';
  return pgn;
};

export const pathContext: PathContext = {
  path: '',
  clone() {
    const clonedCtx: PathContext = { ...this };
    return clonedCtx;
  },
};
