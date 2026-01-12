/*
  Functions for importing and exporting repertoire chapters
*/
// TODO should be util file instead?

import {
  defaultHeaders,
  Game,
  makePgn,
  Node,
  parsePgn,
  PgnNodeData,
  startingPosition,
  transform,
} from 'chessops/pgn';
import { Chapter, Color, TrainableNode, TrainingConfig, TrainingRoot } from '../training/types';
import { useTrainerStore } from '../state/state';
import { annotateMoves } from '../training/util';
import { INITIAL_BOARD_FEN, makeFen } from 'chessops/fen';
import { readNode, treeReconstruct } from '../util';
import { RepertoireChapter } from '../types/types';

import { parseSan } from 'chessops/san';

//   const importToRepertoire = (pgn: string, color: Color, name: string) => {
//     let repertoire = useTrainerStore.getState().repertoire;
//     // TODO why is PGN undefined?
//     //TODO shouldnt be game?
//     const chapters: Game<PgnNodeData>[] = parsePgn(pgn);
//     chapters.forEach((subrep, i) => {
//       //augment chapter with a) color to train as, and b) training data
//       // const annotatedSubrep: Chapter<TrainingData> = {
//       //   ...subrep,
//       //   ...generateChapter(subrep.moves, color, trainingConfig.buckets!),
//       // };

//       const { moves: moves, nodeCount: nodeCount } = annotateMoves(subrep.moves, color);

//       // game<trainingData> --> ChildNode<TrainingData>
//       // empower chapters w/ tree operations

//       const start = startingPosition(defaultHeaders()).unwrap();
//       const fen = makeFen(start.toSetup());
//       const initialPly = (start.toSetup().fullmoves - 1) * 2 + (start.turn === 'white' ? 0 : 1);
//       const treeParts: ChildNode<TrainingData>[] = [
//         {
//           id: '',
//           ply: initialPly,
//           fen,
//           children: [],
//           //TODO ???? make this optional?
//           disabled: false,
//           dueAt: -1,
//           group: 0,
//           seen: false,
//           comment: '',
//         },
//       ];
//       let tree = moves;

//       const pos = start;
//       const sidelines: ChildNode<TrainingData>[][] = [[]];
//       let index = 0;
//       while (tree.children.length) {
//         const [mainline, ...variations] = tree.children;
//         const ply = initialPly + index + 1;
//         sidelines.push(variations.map((variation) => readNode(variation, pos.clone(), ply)));
//         treeParts.push(readNode(mainline, pos, ply, false));
//         tree = mainline;
//         index += 1;
//       }
//       const newTree = treeReconstruct(treeParts, sidelines);
//       // return newTree;

//       if (i > 0) name += ` (${i + 1})`;

//       //

//       //TODO refactor (and possibly combine) annotateMoves and the above logic ^ creating a Tree
//       const chapter: RepertoireChapter = {
//         tree: newTree,
//         name: name,
//         bucketEntries: trainingConfig.buckets.map(() => 0),
//         nodeCount: nodeCount,
//         lastDueCount: 0,
//         trainAs: color,
//       };

//       // TODO handle correct placement
//       console.log('------------');
//       // console.log(repertoire, name, color);
//       switch (color) {
//         case 'white':
//           setRepertoire([chapter, ...repertoire]);
//           break;

//         case 'black':
//           setRepertoire([...repertoire, chapter]);
//           break;
//       }
//       console.log(repertoire);
//       //TODO
//       // postChapter(entry, color, name);
//     });
//   };
// };

/*
    Import PGN into repertoire 
    -> PGN can consist of one or more chapters 
    -> PGN can be "annotated", which means it has training metadata attached that must be parsed
  */
export const chapterFromPgn = (rawPgn: string, asColor: Color, name: string, config: TrainingConfig) => {
  const { root, nodeCount } = rootFromPgn(rawPgn, asColor);
  // // don't allow multiple games in one PGN
  // const parsedRoot: Node<PgnNodeData> = parsePgn(rawPgn).at(0).moves;
  // const { moves, nodeCount: nodeCount } = annotateMoves(parsedRoot, asColor);
  // // put initial position first
  // //TODO do something about mainline, etc..
  // const trainingRoot: TrainableNode = {
  //   data: {
  //     comment: '',
  //     fen: INITIAL_BOARD_FEN,
  //     id: '',
  //     ply: 0,
  //     san: '',
  //     //TODO shortcut for disabled
  //     training: {
  //       disabled: true,
  //       dueAt: -1,
  //       group: -1,
  //       seen: false,
  //     },
  //   },
  //   children: moves.children,
  // };
  // console.log('trainingRoot', trainingRoot);

  const chapter: Chapter = {
    root: root,
    name: name,
    bucketEntries: config.buckets.map(() => 0),
    nodeCount: nodeCount,
    lastDueCount: 0,
    trainAs: asColor,
  };
  return chapter;
};

export const rootFromPgn = (
  rawPgn: string,
  asColor: Color,
): {
  root: TrainableNode;
  nodeCount: Number;
} => {
  // don't allow multiple games in one PGN
  const parsedRoot: Node<PgnNodeData> = parsePgn(rawPgn).at(0).moves;
  const { moves, nodeCount: nodeCount } = annotateMoves(parsedRoot, false, asColor);
  // put initial position first
  //TODO do something about mainline, etc..
  const root: TrainableNode = {
    data: {
      comment: '',
      fen: INITIAL_BOARD_FEN,
      id: '',
      ply: 0,
      san: '',
      //TODO shortcut for disabled
      training: {
        disabled: true,
        dueAt: -1,
        group: -1,
        seen: false,
      },
    },
    children: moves.children,
  };
  console.log('trainingRoot', root);
  return { root, nodeCount };
};

// const treeWithDummy: TrainingRoot = {
//   id: '',
//   children: parsed[0].moves.children
// }
// // only parse first game into a chapter
// // TODO possibly handle parsing into multiple chapters from one pgn
// const chapter = parseIntoChapter(treeWithDummy, name, asColor, config);

/*

*/
export const parseIntoChapter = (
  root: TrainingRoot,
  name: string,
  color: Color,
  config: trainingConfig,
): RepertoireChapter => {
  // TODO implement annotated imports

  const { root: tree, nodeCount: nodeCount } = annotateMoves(root, color);

  // game<trainingData> --> ChildNode<TrainingData>
  // empower chapters w/ tree operations

  // const start = startingPosition(defaultHeaders()).unwrap();
  // const fen = makeFen(start.toSetup());
  // const initialPly = (start.toSetup().fullmoves - 1) * 2 + (start.turn === 'white' ? 0 : 1);
  // const treeParts: ChildNode<TrainingData>[] = [
  //   {
  //     id: '',
  //     ply: initialPly,
  //     fen,
  //     children: [],
  //     //TODO ???? make this optional?
  //     disabled: false,
  //     dueAt: -1,
  //     group: 0,
  //     seen: false,
  //     comment: '',
  //   },
  // ];
  // let tree = moves;

  // const pos = start;
  // const sidelines: ChildNode<TrainingData>[][] = [[]];
  // let index = 0;
  // while (tree.children.length) {
  //   const [mainline, ...variations] = tree.children;
  //   const ply = initialPly + index + 1;
  //   sidelines.push(variations.map((variation) => readNode(variation, pos.clone(), ply)));
  //   treeParts.push(readNode(mainline, pos, ply, false));
  //   tree = mainline;
  //   index += 1;
  // }
  // const newTree = treeReconstruct(treeParts, sidelines);
  // // return newTree;

  // if (i > 0) name += ` (${i + 1})`;

  //

  //TODO refactor (and possibly combine) annotateMoves and the above logic ^ creating a Tree
};
// TODO export const exportChapter TODO

/*
  Annotate a each SAN of a RepertoireEntry by adding a preceding comment with
  training state. Necessary for exporting a repertoire as a PGN 
  without losing training information

  Export chapter as PGN,
  optionally with training data augmented,
  so a user can import the exported file and have training metadata.
// */

// export const exportChapter = (chapter: RepertoireChapter, shouldAnnotate: boolean) => {
//   //TODO need deep copy
//   let headers = new Map<string, string>();

//   // add training control headers
//   headers.set('RepertoireFileName', chapter.name);
//   headers.set('LastDueCount', `${chapter.lastDueCount}`);
//   headers.set('TrainAs', chapter.trainAs);
//   headers.set('bucketEntries', chapter.bucketEntries.toString());
//   headers.set('Event', 'ChessrepeatChapter');

//   const pos = startingPosition(headers).unwrap();
//   const annotatedMoves = transform(chapter.tree, pos, (pos, node) => {
//     const newNode = { ...node, comments: node.comments ? [...node.comments] : [] };

//     // conditionally annotate moves with training metadata
//     if (shouldAnnotate) {
//       let trainingHeader = `${node.training.id},${node.training.disabled},${node.training.seen},${node.training.group},${node.training.dueAt}`;
//       newNode.comments.push(trainingHeader);
//     }

//     return newNode;
//   });

//   const newChapter = {
//     // meta: {
//     //   trainAs: entry.subrep.meta.trainAs,
//     //   nodeCount: entry.subrep.meta.nodeCount,
//     //   bucketEntries: entry.subrep.meta.bucketEntries,
//     // },
//     headers,
//     moves: annotatedMoves,
//   };

//   const pgn = makePgn(newChapter) + '\n';
//   return pgn;
// };

//   /*
//   Annotate a each SAN of a RepertoireEntry by adding a preceding comment with
//   training state. Necessary for exporting a repertoire as a PGN
//   without losing training information
// */

//   const exportRepertoireEntry = (entry: RepertoireEntry) => {
//     //TODO need deep copy
//     let headers = new Map<string, string>();

//     // add training control headers
//     headers.set('RepertoireFileName', entry.name);
//     headers.set('LastDueCount', `${entry.lastDueCount}`);
//     headers.set('TrainAs', entry.subrep.meta.trainAs);
//     headers.set('bucketEntries', entry.subrep.meta.bucketEntries.toString());
//     headers.set('nodeCount', `${entry.subrep.meta.nodeCount}`);
//     headers.set('Event', 'ChessrepeatRepertoireFile');

//     const pos = startingPosition(entry.subrep.headers).unwrap();
//     // annotate moves with training metadata
//     const annotatedMoves = transform(entry.subrep.moves, pos, (pos, node) => {
//       const newNode = { ...node, comments: node.comments ? [...node.comments] : [] };

//       let trainingHeader = `${node.training.id},${node.training.disabled},${node.training.seen},${node.training.group},${node.training.dueAt}`;

//       newNode.comments.push(trainingHeader);

//       return newNode;
//     });

//     let subrep: Subrepertoire<TrainingData> = {
//       meta: {
//         trainAs: entry.subrep.meta.trainAs,
//         nodeCount: entry.subrep.meta.nodeCount,
//         bucketEntries: entry.subrep.meta.bucketEntries,
//       },
//       headers,
//       moves: annotatedMoves,
//     };

//     const pgn = makePgn(subrep) + '\n';
//     return pgn;
//   };

/*
  Import annotated entry 
*/

export const importAnnotatedPgn = (annotatedPgn: string) => {

  console.log("ADDING TO REPERTOIRE");
  // console.log("name", name);
  // console.log("pgn", pgn);
  // TODO why is PGN undefined?
  const chapters: Chapter[] = [];
  const parts: Game<PgnNodeData>[] = parsePgn(annotatedPgn);
  console.log("PARTS", parts);
  parts.forEach((part) => {
    // console.log("subrep", subrep);
    // console.log("headers should have metadata", part.headers);
    // //TODO we dont need this?
    // const headers = part.headers;

    // const pos = startingPosition(defaultHeaders()).unwrap();
    // const startingPly = 0;
    // // ctx: Ctx = {
    // //   pos: pos,
    // //   ply: startingPly
    // // }
    // part.moves = transform(part.moves, { pos, ply: startingPly } satisfies Ctx, (ctx, node) => {
    //   const move = parseSan(pos, node.san);
    //   pos.play(move!);

    //   const metadata = node.comments![0].split(',');
    //   node.training = {};
    //   node.training.id = parseInt(metadata[0]);
    //   node.training.disabled = metadata[1] == 'true';
    //   node.training.seen = metadata[2] == 'true';
    //   node.training.group = parseInt(metadata[3]);
    //   node.training.dueAt = metadata[4] == 'Infinity' ? Infinity : parseInt(metadata[4]);
    //   // console.log('node', node);

    //   //TODO dont remove all comments
    //   // node.comments!.shift();
    //   node.comments = [];
    //   console.log(node);

    //   return {
    //     ...node,
    //     fen: makeFen(pos.toSetup()),
    //   };
    // });

    // console.log("HEADERS 2", headers);

    // let newEntry: RepertoireEntry = {};
    // newEntry.name = subrep.headers.get('RepertoireFileName')!;
    // newEntry.lastDueCount = parseInt(subrep.headers.get('LastDueCount')!);
    // newEntry.subrep = subrep;
    // console.log("bucketEntries", subrep.headers.get('RepertoireFileName'));

    // newEntry.subrep.meta = {
    //   trainAs: subrep.headers.get('TrainAs')! as Color,
    //   nodeCount: parseInt(subrep.headers.get('nodeCount')!),
    //   bucketEntries: subrep.headers
    //     .get('bucketEntries')!
    //     .split(',')
    //     .map((x) => parseInt(x)),
    // };

    // console.log('newEntry', newEntry);
    // // this.repertoire.push(newEntry);
    // this.addRepertoireEntry(newEntry, newEntry.subrep.meta.trainAs);

    // const parsedRoot: Node<PgnNodeData> = parsePgn(rawPgn).at(0).moves;

    const { moves, nodeCount: nodeCount } = annotateMoves(part.moves, true);
    // put initial position first
    //TODO do something about mainline, etc..
    const root: TrainableNode = {
      data: {
        comment: '',
        fen: INITIAL_BOARD_FEN,
        id: '',
        ply: 0,
        san: '',
        //TODO shortcut for disabled
        training: {
          disabled: true,
          dueAt: -1,
          group: -1,
          seen: false,
        },
      },
      children: moves.children,
    };
    console.log('trainingRoot', root);

    const bucketEntries = part.headers
      .get('bucketEntries')!
      .split(',')
      .map((x) => parseInt(x));

    const chapterName = part.headers.get('ChessrepeatChapterName');
    const asColor = part.headers.get('trainAs') as Color;

    const chapter: Chapter = {
      root: root,
      name: chapterName,
      bucketEntries: bucketEntries,
      nodeCount: nodeCount,
      lastDueCount: 0,
      trainAs: asColor,
    };
    // return chapter;
    // addNewChapter(chapter);
    chapters.push(chapter);

    // add chapter

    // return { root, nodeCount };
  });

  return chapters;
};

//TODO remove config argument
// export const importRawPgn = (rawPgn: string, trainAs: Color, name: string, config: TrainingConfig) => {
//   const addNewChapter = useTrainerStore((s) => s.addNewChapter);

//   const chapter = chapterFromPgn(rawPgn, trainAs, name, trainingConfig);
//   addNewChapter(chapter);
// };
