/*
  Functions for importing and exporting repertoire chapters
*/
// TODO should be util file instead?

import { defaultHeaders, Game, parsePgn, PgnNodeData, startingPosition } from 'chessops/pgn';
import { Color } from '../spaced-repetition/types';
import { useTrainerStore } from '../state/state';
import { annotateMoves } from '../spaced-repetition/util';
import { makeFen } from 'chessops/fen';
import { readNode, treeReconstruct } from '../util';
import { RepertoireChapter } from '../types/types';

import { configure, defaults, Config as SrsConfig } from '../spaced-repetition/config';

export const ChessOpeningTrainer = () => {
  const {
    showTrainingSettings,
    setShowTrainingSettings,
    showingAddToRepertoireMenu,
    setShowingAddToRepertoireMenu,

    repertoire,
    setRepertoire,
    repertoireIndex,
    setRepertoireIndex,

    showingHint,
    setShowingHint,
    lastFeedback,
    setLastFeedback,
    lastResult,
    setLastResult,
    lastGuess,
    setLastGuess,
    showSuccessfulGuess,
    setShowSuccessfulGuess,
    dueTimes,
    setDueTimes,

    srsConfig,
    setSrsConfig,
    cbConfig,
    setCbConfig,

    setSelectedPath,
    setSelectedNode,

    selectedNode,
    selectedPath,
    // trainingPath,
    // setTrainingPath,

    repertoireMethod,
    setRepertoireMethod,

    trainableContext,
    setTrainableContext,
  } = useTrainerStore();

  const importToRepertoire = (pgn: string, color: Color, name: string) => {
    let repertoire = useTrainerStore.getState().repertoire;
    // TODO why is PGN undefined?
    //TODO shouldnt be game?
    const chapters: Game<PgnNodeData>[] = parsePgn(pgn);
    chapters.forEach((subrep, i) => {
      //augment chapter with a) color to train as, and b) training data
      // const annotatedSubrep: Chapter<TrainingData> = {
      //   ...subrep,
      //   ...generateChapter(subrep.moves, color, srsConfig.buckets!),
      // };

      const { moves: moves, nodeCount: nodeCount } = annotateMoves(subrep.moves, color);

      // game<trainingData> --> Tree.Node
      // empower chapters w/ tree operations

      const start = startingPosition(defaultHeaders()).unwrap();
      const fen = makeFen(start.toSetup());
      const initialPly = (start.toSetup().fullmoves - 1) * 2 + (start.turn === 'white' ? 0 : 1);
      const treeParts: Tree.Node[] = [
        {
          id: '',
          ply: initialPly,
          fen,
          children: [],
          //TODO ???? make this optional?
          disabled: false,
          dueAt: -1,
          group: 0,
          seen: false,
          comment: '',
        },
      ];
      let tree = moves;

      const pos = start;
      const sidelines: Tree.Node[][] = [[]];
      let index = 0;
      while (tree.children.length) {
        const [mainline, ...variations] = tree.children;
        const ply = initialPly + index + 1;
        sidelines.push(variations.map((variation) => readNode(variation, pos.clone(), ply)));
        treeParts.push(readNode(mainline, pos, ply, false));
        tree = mainline;
        index += 1;
      }
      const newTree = treeReconstruct(treeParts, sidelines);
      // return newTree;

      if (i > 0) name += ` (${i + 1})`;

      //

      //TODO refactor (and possibly combine) annotateMoves and the above logic ^ creating a Tree
      const chapter: RepertoireChapter = {
        tree: newTree,
        name: name,
        bucketEntries: srsConfig.buckets.map(() => 0),
        nodeCount: nodeCount,
        lastDueCount: 0,
        trainAs: color,
      };

      // TODO handle correct placement
      console.log('------------');
      // console.log(repertoire, name, color);
      switch (color) {
        case 'white':
          setRepertoire([chapter, ...repertoire]);
          break;

        case 'black':
          setRepertoire([...repertoire, chapter]);
          break;
      }
      console.log(repertoire);
      //TODO
      // postChapter(entry, color, name);
    });
  };
};

/*

  */
export const parseIntoChapter = (
  game: Game<PgnNodeData>,
  name: string,
  color: Color,
  config: SrsConfig,
): RepertoireChapter => {
  // TODO implement annotated imports
  let repertoire = useTrainerStore.getState().repertoire;
  //TODO shouldnt be game?

  const { moves: moves, nodeCount: nodeCount } = annotateMoves(game.moves, color);

  // game<trainingData> --> Tree.Node
  // empower chapters w/ tree operations

  const start = startingPosition(defaultHeaders()).unwrap();
  const fen = makeFen(start.toSetup());
  const initialPly = (start.toSetup().fullmoves - 1) * 2 + (start.turn === 'white' ? 0 : 1);
  const treeParts: Tree.Node[] = [
    {
      id: '',
      ply: initialPly,
      fen,
      children: [],
      //TODO ???? make this optional?
      disabled: false,
      dueAt: -1,
      group: 0,
      seen: false,
      comment: '',
    },
  ];
  let tree = moves;

  const pos = start;
  const sidelines: Tree.Node[][] = [[]];
  let index = 0;
  while (tree.children.length) {
    const [mainline, ...variations] = tree.children;
    const ply = initialPly + index + 1;
    sidelines.push(variations.map((variation) => readNode(variation, pos.clone(), ply)));
    treeParts.push(readNode(mainline, pos, ply, false));
    tree = mainline;
    index += 1;
  }
  const newTree = treeReconstruct(treeParts, sidelines);
  // return newTree;

  // if (i > 0) name += ` (${i + 1})`;

  //

  //TODO refactor (and possibly combine) annotateMoves and the above logic ^ creating a Tree
  const chapter: RepertoireChapter = {
    tree: newTree,
    name: name,
    bucketEntries: config.buckets.map(() => 0),
    nodeCount: nodeCount,
    lastDueCount: 0,
    trainAs: color,
  };

  return chapter;
};
// TODO export const exportChapter TODO
