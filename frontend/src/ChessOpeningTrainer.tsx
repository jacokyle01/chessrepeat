import React, { useState } from 'react';
import { Chess } from 'chess.js';
import Chessboard, { Key } from './components/Chessboard';
import Controls, { ControlsProps } from './components/Controls';
import {
  build as makeTree,
  path as treePath,
  ops as treeOps,
  type TreeWrapper,
} from './components/tree/tree';

// const pgn = 'd4 d5 c4 e6 Nf3 Nf6 g3';
// const moves = pgn.split(' ');

// const ChessOpeningTrainer: React.FC = () => {
//   const [game, setGame] = useState(new Chess());
//   const [moveIndex, setMoveIndex] = useState(0);
//   const [message, setMessage] = useState('Your move (White)');

//   const onDrop = (sourceSquare: string, targetSquare: string) => {
//     const move = {
//       from: sourceSquare,
//       to: targetSquare,
//       promotion: 'q',
//     };

//     const expectedMove = moves[moveIndex];
//     const tempGame = new Chess(game.fen());
//     const result = tempGame.move(move);

//     if (result && result.san === expectedMove) {
//       setGame(tempGame);
//       setMoveIndex(moveIndex + 1);
//       setMessage('✔ Correct');

//       setTimeout(() => {
//         const blackMove = moves[moveIndex + 1];
//         if (blackMove) {
//           const updatedGame = new Chess(tempGame.fen());
//           updatedGame.move(blackMove);
//           setGame(updatedGame);
//           setMoveIndex((prev) => prev + 1);
//         }
//       }, 400);
//     } else {
//       setMessage(`✘ Incorrect. Expected: ${expectedMove}`);
//     }
//   };

//   return (
//     <div className="flex flex-col items-center p-4">
//       <h1 className="text-xl mb-2 font-semibold">Chess Opening Trainer</h1>
//       <p className="mb-2">{message}</p>
//       <Chessboard position={game.fen()} onPieceDrop={onDrop} boardWidth={400} />
//     </div>
//   );
// };

// export default ChessOpeningTrainer;

import { useEffect, useRef } from 'react';
import { Config as CbConfig } from './components/Chessboard';
import { DequeEntry, Method, Chapter, TrainingData, TrainingPath } from './spaced-repetition/types';
import { RepertoireChapter, RepertoireEntry } from './types/types';
import Repertoire from './components/repertoire/Repertoire';
import { ChildNode, defaultHeaders, Game, parsePgn, PgnNodeData, startingPosition, walk } from 'chessops/pgn';
import { Color, Position } from 'chessops';
import { annotateMoves, countDueContext } from './spaced-repetition/util';
import { alternates, foolsMate, nimzo, pgn3, transpose } from './debug/pgns';
import { configure, defaults, Config as SrsConfig } from './spaced-repetition/config';
import { initial } from 'chessground/fen';
import { calcTarget, chessgroundToSan, fenToDests, toDestMap } from './util';
import { DrawShape } from 'chessground/draw';
import { MoveMetadata } from 'chessground/types';
import { useAtom } from 'jotai';
import { useTrainerStore } from './state/state';
import { Feedback, FeedbackProps } from './components/Feedback';
import { PgnTree, PgnTreeProps } from './components/pgn/PgnTree';
import InsightChart from './components/InsightChart';
import Schedule from './components/Schedule';
import AddToReperotireModal from './components/repertoire/AddToRepertoireModal';
import RepertoireActions from './components/repertoire/RepertoireActions';
import SettingsModal from './components/SettingsModal';
import PgnControls from './components/pgn/PgnControls';
import { postChapter } from './services/postChapter';
import NewPgnTree from './components/tree/NewPgnTree';
import { makeFen } from 'chessops/fen';
import { makeSanAndPlay, parseSan } from 'chessops/san';
// import Chessground, { Api, Config, Key } from "@react-chess/chessground";

// these styles must be imported somewhere
// import "chessground/assets/chessground.base.css";
// import "chessground/assets/chessground.brown.css";
// import "chessground/assets/chessground.cburnett.css";

// Demo game moves in long algebraic form
const MOVES = (
  'e2e4 e7e5 g1f3 d7d6 d2d4 c8g4 d4e5 g4f3 d1f3 d6e5 ' +
  'f1c4 g8f6 f3b3 d8e7 b1c3 c7c6 c1g5 b7b5 c3b5 c6b5 ' +
  'c4b5 b8d7 e1c1 a8d8 d1d7 d8d7 h1d1 e7e6 b5d7 f6d7 ' +
  'b3b8 d7b8 d1d8'
).split(' ');

const SRS_CONFIG = {
  buckets: [1, 1, 1],
  getNext: {
    by: 'depth',
    max: 60, // ply
  },
};

const CONFIG = defaults();
const SOUNDS = {
  move: new Audio('/sound/public_sound_standard_Move.mp3'),
  capture: new Audio('/sound/public_sound_standard_Capture.mp3'),
};

export const ChessOpeningTrainer = () => {
  const {
    repertoireMode,
    setRepertoireMode,
    trainingMethod,
    setTrainingMethod,
    showTrainingSettings,
    setShowTrainingSettings,
    showingAddToRepertoireMenu,
    setShowingAddToRepertoireMenu,

    repertoire,
    setRepertoire,
    numWhiteEntries,
    setNumWhiteEntries,
    repertoireIndex,
    setRepertoireIndex,

    trainingPath,
    setTrainingPath,
    pathIndex,
    setPathIndex,
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

    orientation,
    setOrientation,
    srsConfig,
    setSrsConfig,
    cbConfig,
    setCbConfig,
  } = useTrainerStore();

  const [sounds, setSounds] = useState(SOUNDS);
  //TODO put in util
  const currentTime = (): number => {
    return Math.round(Date.now() / 1000);
  };

  //TODO move somewhere else?
  interface Opts {
    parentPath: Tree.Path;
    isMainline: boolean;
    depth: number;
    inline?: Tree.Node;
    withIndex?: boolean;
    truncate?: number;
  }

  interface Ctx {
    truncateComments: boolean;
    currentPath: Tree.Path | undefined;
  }

  //TODO
  // export const renderIndexText = (ply: Ply, withDots?: boolean): string =>
  //   plyToTurn(ply) + (withDots ? (ply % 2 === 1 ? '.' : '...') : '');

  function treeReconstruct(parts: Tree.Node[], sidelines?: Tree.Node[][]): Tree.Node {
    const root = parts[0],
      nb = parts.length;
    let node = root;
    root.id = '';
    for (let i = 1; i < nb; i++) {
      const n = parts[i];
      const variations = sidelines ? sidelines[i] : [];
      if (node.children) node.children.unshift(n, ...variations);
      else node.children = [n, ...variations];
      node = n;
    }
    node.children = node.children || [];
    return root;
  }

  const readNode = (
    node: ChildNode<TrainingData>,
    pos: Position,
    ply: number,
    withChildren = true,
  ): Tree.Node => {
    const move = parseSan(pos, node.data.san);
    if (!move) throw new Error(`Can't play ${node.data.san} at move ${Math.ceil(ply / 2)}, ply ${ply}`);
    return {
      id: '', //TODO
      ply,
      san: makeSanAndPlay(pos, move),
      fen: makeFen(pos.toSetup()),
      // uci: makeUci(move),

      //TODO flatten <TrainingData>
      disabled: node.data.training.disabled,
      seen: node.data.training.seen,
      group: node.data.training.group,
      dueAt: node.data.training.dueAt,

      children: withChildren ? node.children.map((child) => readNode(child, pos.clone(), ply + 1)) : [],
      // check: pos.isCheck() ? makeSquare(pos.toSetup().board.kingOf(pos.turn)!) : undefined,
    };
  };

  // TODO provide a more detailed breakdown, like when each one is due.
  // TODO combine this with getNext() so we don't need to walk the tree twice

  // walk entire file and describe its state- when moves are due and such
  // store result in `dueTimes` array
  const updateDueCounts = (): void => {
    // if (repertoire.length == 0) return;
    // const chapter = repertoire[repertoireIndex];
    // //TODO Node<unknown>
    // const root = chapter.tree.root;
    // const ctx = countDueContext(0);
    // const dueCounts = new Array(1 + srsConfig.buckets!.length).fill(0);
    // TODO implement walk for Tree type
    // use updateAll in opts.ts lichess
    // walk(root, ctx, (ctx, data) => {
    //   ctx.count++;
    //   if (!data.training.disabled && data.training.seen) {
    //     const secondsTilDue = data.training.dueAt - currentTime();
    //     // console.log('seconds til due', secondsTilDue);
    //     if (secondsTilDue <= 0) {
    //       dueCounts[0]++;
    //     } else {
    //       for (let i = 0; i < dueCounts.length; i++) {
    //         if (secondsTilDue <= srsConfig.buckets!.at(i)!) {
    //           dueCounts[i + 1]++;
    //           break;
    //         }
    //       }
    //     }
    //   }
    // });
    // setDueTimes(dueCounts);
  };

  // TODO return trainingPath, then we set it
  const getNext = () => {
    let method = useTrainerStore.getState().trainingMethod;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;
    let repertoire = useTrainerStore.getState().repertoire;

    console.log(repertoireIndex, trainingMethod);
    if (repertoireIndex == -1 || method == 'unselected') return false; // no chapter selected
    console.log('GET NEXT NOW');
    //initialization
    // TODO refactor to ops or tree file?
    interface DequeEntry {
      path: Tree.Node[];
      layer: number;
    }

    const deque: DequeEntry[] = [];

    let tree = repertoire[repertoireIndex].tree;
    console.log('tree', tree);
    //initialize deque
    const root = tree.root;
    for (const child of root.children) {
      console.log('tree child', child);
      deque.push({
        path: [child],
        layer: 0,
      });
    }
    while (deque.length != 0) {
      //initialize dedequed path
      const entry = srsConfig!.getNext!.by == 'breadth' ? deque.shift()! : deque.pop()!;
      const pos = entry.path.at(-1)!;

      //test if match
      if (!pos.disabled) {
        switch (method) {
          case 'recall': //recall if due
            if (pos.dueAt <= currentTime()) {
              // this.changedLines = !this.pathIsContinuation(this.trainingPath, entry.path);
              // TODO better way of doing this
              // shouldn't be handled in getNext(). use handleLineChange().
              // if (this.changedLines) {
              // }

              setTrainingPath(entry.path);
              return true;
            }
            break;
          case 'learn': //learn if unseen
            if (!pos.seen) {
              console.log('Here');
              console.log('path', entry.path);
              // this.changedLines = !this.pathIsContinuation(this.trainingPath, entry.path);
              setTrainingPath(entry.path);
              return true;
            }
            break;
        }
      }

      //push child nodes
      //TODO guarantee non-full
      if (entry.layer < srsConfig!.getNext!.max!) {
        // TODO ?
        for (const child of pos.children) {
          const DequeEntry: DequeEntry = {
            path: [...entry.path, child],
            layer: ++entry.layer,
          };
          deque.push(DequeEntry);
        }
      }
    }
    return false;
  };

  const atLast = () => {
    return useTrainerStore.getState().pathIndex === useTrainerStore.getState().trainingPath.length - 2;
  };

  const flipBoard = () => {
    const newOrientation = orientation === 'white' ? 'black' : 'white';
    setOrientation(newOrientation);
    useTrainerStore.setState((state) => ({
      cbConfig: {
        ...state.cbConfig,
        orientation: newOrientation,
      },
    }));
  };

  const succeed = () => {
    console.log('succeed');
    let trainingPath = useTrainerStore.getState().trainingPath;
    let repertoire = useTrainerStore.getState().repertoire;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;
    let trainingMethod = useTrainerStore.getState().trainingMethod;

    const chapter = repertoire[repertoireIndex];

    // console.log('state', useTrainerStore.getState());
    console.log('training path in succeed', trainingPath);
    let node = trainingPath?.at(-1);
    // const subrep = repertoire[repertoireIndex].subrep;
    if (!node) return;

    switch (trainingMethod) {
      case 'recall':
        setLastResult('succeed');
        setShowSuccessfulGuess(true);

        let groupIndex = node.group;
        chapter.bucketEntries[groupIndex]--;
        switch (srsConfig!.promotion) {
          case 'most':
            groupIndex = srsConfig!.buckets!.length - 1;
            break;
          case 'next':
            groupIndex = Math.min(groupIndex + 1, srsConfig!.buckets!.length - 1);
            break;
        }
        chapter.bucketEntries[groupIndex]++;
        const interval = srsConfig!.buckets![groupIndex];

        node = {
          ...node,
          group: groupIndex,
          dueAt: currentTime() + interval,
        };
        break;
      case 'learn':
        console.log('succeed successful');
        node = {
          ...node,
          seen: true,
          dueAt: currentTime() + srsConfig!.buckets![0],
          group: 0,
        };
        chapter.bucketEntries[0]++; //globally, mark node as seen
        break;
    }
  };

  const fail = () => {
    setShowSuccessfulGuess(false);
    let node = trainingPath?.at(-1);
    //TODO need more recent version?
    const chapter = repertoire[repertoireIndex];
    if (!node) return;
    let groupIndex = node.group;
    chapter.bucketEntries[groupIndex]--;
    if (trainingMethod === 'recall') {
      setLastResult('fail');
      switch (srsConfig!.demotion) {
        case 'most':
          groupIndex = 0;
          break;
        case 'next':
          groupIndex = Math.max(groupIndex - 1, 0);
          break;
      }
      chapter.bucketEntries[groupIndex]++;
      const interval = srsConfig!.buckets![groupIndex];

      node = {
        ...node,
        group: groupIndex,
        dueAt: currentTime() + interval,
      };
    }
  };

  const resetTrainingContext = () => {
    // this.syncTime();

    // this.chessground!.setAutoShapes([]);
    setCbConfig({
      ...cbConfig,
      drawable: {
        autoShapes: [],
      },
    });
    // showingHint = false;
    setShowingHint(false);
    // setLastFeedback('')
    // this.lastGuess = null;
    // this.lastResult = "none";
  };

  //TODO clean this up
  const makeGuess = (san: string) => {
    setLastGuess(san);
    console.log('last guess', san);
    let trainingPath = useTrainerStore.getState().trainingPath;
    let repertoire = useTrainerStore.getState().repertoire;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;

    if (repertoireIndex == -1 || !trainingPath || trainingMethod == 'learn') return;

    const chapter = repertoire[repertoireIndex];

    let candidates: Tree.Node[] = [];
    if (trainingPath.length == 1) {
      repertoire[repertoireIndex].tree.root.children.forEach((child) => candidates.push(child));
    } else {
      trainingPath.at(-2)?.children.forEach((child) => candidates.push(child));
    }

    let moves: string[] = [];
    moves = candidates.map((candidate) => candidate.san);

    return moves.includes(san) ? (trainingPath.at(-1)?.san === san ? 'success' : 'alternate') : 'failure';
  };

  // TODO better name vs. ctrl.fail()
  const handleFail = (attempt?: string) => {
    setShowSuccessfulGuess(false);
    // TODO better solution than this below?
    console.log(attempt);
    setLastGuess(attempt ?? null);
    setLastFeedback('fail');

    // opts should look at lastFeedback
    const opts = makeCgOpts();
    console.log(opts);
    // this.chessground!.set(opts);
    setCbConfig(opts);
    // console.log(this.chessground!.state);
  };

  // TODO refactor out of file? (since it doesnt deal w/ UI) (maybe a hook?)
  const makeCgOpts = (): CbConfig => {
    let trainingPath = useTrainerStore.getState().trainingPath;
    let pathIndex = useTrainerStore.getState().pathIndex;
    let trainingMethod = useTrainerStore.getState().trainingMethod;

    //TODO get this
    const chapter = repertoire[repertoireIndex];
    // console.log('trainingPath in opts from store', trainingPath);
    // console.log('pathIndex in opts', pathIndex);
    // console.log('Make CG OPTS');
    // console.log('trainingPath', trainingPath);

    const fen = trainingPath.at(-2)?.fen || initial;

    // get last move, if it exists
    let lastMoves: Key[] = [];
    if (atLast() && trainingPath && trainingPath!.length > 1) {
      const fen2 = trainingPath?.at(-3)?.fen || initial;
      const oppMoveSan = trainingPath?.at(-2)?.san;
      const uci2 = calcTarget(fen2, oppMoveSan!);
      lastMoves = [uci2[0], uci2[1]];
    }

    const targetSan = trainingPath?.at(-1).san;
    const uci = calcTarget(fen, targetSan!);

    // shapes
    const shapes: DrawShape[] = [];
    console.log('atlast?', atLast());
    if (trainingMethod === 'learn' && atLast()) {
      console.log(`orig: ${uci[0]}, dest: ${uci[1]}`);
      shapes.push({ orig: uci[0], dest: uci[1], brush: 'green' });
    } else if (showingHint) {
      shapes.push({ orig: uci[0], brush: 'yellow' });
    } else if (lastFeedback === 'fail') {
      shapes.push({ orig: uci[0], dest: uci[1], brush: 'red' });
    }

    // if (this.correctMoveIndices.includes(pathIndex)) {
    //   // generate uci for pathIndex
    //   let fen3 = initial;
    //   // TODO fix
    //   if (this.pathIndex > 0) {
    //     fen3 = this.trainingPath.at(this.pathIndex - 1)?.data.fen || initial;
    //   }

    //   const targetSan = this.trainingPath?.at(this.pathIndex)?.data.san;
    //   const uci = calcTarget(fen3, targetSan!);

    //   shapes.push({ orig: uci[1], customSvg: { html: correctMoveI() } });
    // }

    // shapes.push({orig: 'e5', brush: 'green', customSvg: {html: correctMoveI()}})

    console.log('pathIndex', useTrainerStore.getState().pathIndex);
    console.log('trainingPath', trainingPath);

    const config: CbConfig = {
      orientation: chapter.trainAs,
      fen: trainingPath[pathIndex]?.fen || initial,
      lastMove: lastMoves,
      turnColor: chapter.trainAs,

      movable: {
        free: false,
        color: chapter.trainAs,
        dests:
          lastFeedback != 'fail' && atLast()
            ? trainingMethod === 'learn'
              ? toDestMap(uci[0], uci[1])
              : fenToDests(fen)
            : new Map(),
        events: {
          after: (from: Key, to: Key, metadata: MoveMetadata) => {
            // this.syncTime();
            metadata.captured
              ? sounds.capture.play().catch((err) => console.error('Audio playback error:', err))
              : sounds.move.play().catch((err) => console.error('Audio playback error:', err));
            console.log('atlast? makecgopts', atLast());
            if (atLast()) {
              switch (trainingMethod) {
                case 'learn':
                  console.log('learn + atlast');
                  succeed();
                  handleLearn();
                  break;
                case 'recall':
                  const san = chessgroundToSan(fen, from, to);
                  //TODO be more permissive depending on config
                  switch (makeGuess(san)) {
                    case 'success':
                      succeed();
                      handleRecall();
                      break;
                    case 'alternate':
                      succeed();
                      handleRecall();
                      break;
                    case 'failure':
                      //TODO maybe dont fail right away?
                      handleFail(san);
                      break;
                  }
                  break;
              }
            }
          },
        },
      },
      drawable: {
        autoShapes: shapes,
      },
    };
    console.log('config', config);
    return config;
  };

  const handleLearn = () => {
    const repertoire = useTrainerStore.getState().repertoire;
    const repertoireIndex = useTrainerStore.getState().repertoireIndex;

    if (repertoire.length == 0) return;
    console.log("repertoire", repertoire);
    
    const chapter = repertoire[repertoireIndex];
    console.log("chapter", chapter);
    // TODO add reset functions for different context (repertoire, method) OR add conditionals to check those
    setShowSuccessfulGuess(false);
    resetTrainingContext();
    updateDueCounts();
    //TODO
    // repertoire[repertoireIndex].lastDueCount = dueTimes[0];
    chapter.lastDueCount = 420;
    setLastFeedback('learn');

    setTrainingMethod('learn');
    console.log('handlelearn --> ', useTrainerStore.getState().trainingMethod);
    // mututes path
    if (!getNext()) {
      // lastFeedback = 'empty';
      setLastFeedback('empty');
      console.log('no next');
    } else {
      // update path and pathIndex
      // pathIndex = trainingPath.length - 2;
      let trainingPath = useTrainerStore.getState().trainingPath;
      setPathIndex(trainingPath.length - 2);
      // console.log('new opts', opts);
      // setCbConfig(opts);
      // this.chessground!.set(opts);
      const opts = makeCgOpts();
      useTrainerStore.setState((state) => ({
        cbConfig: {
          ...state.cbConfig,
          ...opts,
        },
      }));

      console.log('config state at learn', useTrainerStore.getState().cbConfig);
      // console.log('real config rn', apiRef.current.state);
      console.log;

      // this.redraw();
      // update scroll height
      // TODO
      // const movesElement = document.getElementById('moves');
      // movesElement!.scrollTop = movesElement!.scrollHeight;
    }
  };
  const handleRecall = () => {
    let trainingPath = useTrainerStore.getState().trainingPath;
    let repertoire = useTrainerStore.getState().repertoire;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;

    resetTrainingContext();
    updateDueCounts();
    setLastFeedback('recall');
    // TODO do w/ usetrainerstore?
    repertoire[repertoireIndex].lastDueCount = dueTimes[0];
    // this.chessground?.setAutoShapes([]); // TODO in separate method?
    setCbConfig({
      ...cbConfig,
      drawable: {
        autoShapes: [],
      },
    });

    setTrainingMethod('recall');

    if (!getNext()) {
      setLastFeedback('empty');
      console.log('no next in recall');
    } else {
      let trainingPath = useTrainerStore.getState().trainingPath;
      setPathIndex(trainingPath.length - 2);
      // const opts = this.makeCgOpts();
      // this.chessground!.set(opts);
      // setCbConfig(makeCgOpts());
      const opts = makeCgOpts();
      console.log('recall opts', opts);
      useTrainerStore.setState((state) => ({
        cbConfig: {
          ...state.cbConfig,
          ...opts,
        },
      }));

      // update scroll height
      const movesElement = document.getElementById('moves');
      movesElement!.scrollTop = movesElement!.scrollHeight;
    }
  };

  const apiRef = useRef<Api | undefined>();

  // const addToRepertoire = (pgn: string, color: Color, name: string) => {
  //   console.log('HERE');
  //   // TODO why is PGN undefined?
  //   const subreps: Game<PgnNodeData>[] = parsePgn(pgn);
  //   subreps.forEach((subrep, i) => {
  //     //augment chapter with a) color to train as, and b) training data
  //     const annotatedSubrep: Chapter<TrainingData> = {
  //       ...subrep,
  //       ...generateChapter(subrep.moves, color, srsConfig.buckets!),
  //     };
  //     if (i > 0) name += ` (${i + 1})`;
  //     const entry: RepertoireEntry = {
  //       subrep: annotatedSubrep,
  //       name,
  //       lastDueCount: 0,
  //     };
  //     addRepertoireEntry(entry, color);
  //   });
  // };

  const importToRepertoire = (pgn: string, color: Color, name: string) => {
    console.log('HERE');
    // TODO why is PGN undefined?
    const subreps: Game<PgnNodeData>[] = parsePgn(pgn);
    subreps.forEach((subrep, i) => {
      //augment chapter with a) color to train as, and b) training data
      // const annotatedSubrep: Chapter<TrainingData> = {
      //   ...subrep,
      //   ...generateChapter(subrep.moves, color, srsConfig.buckets!),
      // };

      const annotatedMoves = annotateMoves(subrep.moves, color);
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
        },
      ];
      let tree = annotatedMoves.moves;
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
      console.log('treeparts', treeParts);
      console.log('sidelines', sidelines);
      const newTree = makeTree(treeReconstruct(treeParts, sidelines));
      // return newTree;
      console.log('new tree', newTree);

      if (i > 0) name += ` (${i + 1})`;

      //TODO refactor (and possibly combine) annotateMoves and the above logic ^ creating a Tree
      const chapter: RepertoireChapter = {
        tree: newTree,
        name: name,
        bucketEntries: srsConfig.buckets.map(() => 0),
        nodeCount: 100, //TODO
        lastDueCount: 0,
        trainAs: color,
      };

      // // add to local store
      // addRepertoireEntry(entry, color);

      // // POST to backend
      // console.log('entry', entry);
      // postChapter(entry, color, name);
    });
  };

  // const addRepertoireEntry = (entry: RepertoireEntry, color: Color) => {
  //   // TODO place repertoire correctly
  //   setRepertoire([...repertoire, entry]);

  //   // if (color == 'white') {
  //   //   this.repertoire = [
  //   //     ...this.repertoire.slice(0, this.numWhiteEntries),
  //   //     entry,
  //   //     ...this.repertoire.slice(this.numWhiteEntries),
  //   //   ];
  //   //   this.numWhiteEntries++;
  //   // } else {
  //   //   this.repertoire.push(entry);
  //   //   this.numBlackEntries++;
  //   // }
  // };

  const jump = (index: number) => {
    // this.pathIndex = index;
    // const opts = this.makeCgOpts();
    // this.chessground!.set(opts);
    // this.redraw();
    setPathIndex(index);
    const opts = makeCgOpts();
    useTrainerStore.setState((state) => ({
      cbConfig: {
        ...state.cbConfig,
        ...opts,
      },
    }));
  };

  // TODO fix (really glitched)
  const markAllSeen = () => {
    if (
      useTrainerStore.getState().repertoireIndex == -1 ||
      useTrainerStore.getState().trainingMethod != 'learn'
    )
      return;
    console.log('damn');
    while (getNext()) {
      console.log('damn');
      succeed();
    }
    return;
  };

  //TODO dont use useEffect here?
  useEffect(() => {
    // addToRepertoire(alternates(), 'black', 'Alternates');
    importToRepertoire(nimzo(), 'black', 'nimzo dimzo');

    setRepertoireIndex(0);
    setTrainingMethod('learn');
    handleLearn();
    succeed();
    handleLearn();
    succeed();
    handleLearn();
    succeed();
    handleLearn();
    // succeed();
    // handleLearn();
    // succeed();
    // handleLearn();
    // succeed();
    // handleLearn();
    // succeed();
    // handleRecall();
    // handleRecall();

    // handleLearn();
    // handleLearn();

    // markAllSeen();
  }, []);

  // useEffect(() => {
  //   // Make a move every 2 seconds
  //   const interval = setInterval(() => {
  //     const move = MOVES.shift();
  //     if (move) {
  //       apiRef.current!.move(move.substring(0, 2) as Key, move.substring(2, 4) as Key);
  //     } else {
  //       clearInterval(interval);
  //     }
  //   }, 2000);
  //   return () => clearInterval(interval);
  // });

  const controlsProps: ControlsProps = {
    trainingMethod,
    handleLearn,
    handleRecall,
    setShowTrainingSettings,
  };
  // const repertoireProps: RepertoireProps = {
  //   repertoire,
  //   numWhiteEntries,
  //   setShowingAddToRepertoireMenu,
  //   repertoireIndex,
  // };
  const feedbackProps: FeedbackProps = {
    handleFail,
  };
  const pgnTreeProps: PgnTreeProps = {
    // jump,
    makeCgOpts,
  };
  return (
    <div id="root" className="w-full h-full bg-gray-200">
      <div id="header" className="flex items-end justify-left text-3xl mb-3">
        <img src="logo.png" alt="Logo" className="h-12 w-12" />
        <span>chess</span>
        <span className="text-stone-600">repeat</span>
      </div>
      {/* h('div#body.flex.justify-center.gap-5.items-start.w-full.px-10', [ */}
      {showingAddToRepertoireMenu && (
        <AddToReperotireModal importToRepertoire={importToRepertoire}></AddToReperotireModal>
      )}
      {/* {showTrainingSettings && <SettingsModal></SettingsModal>} */}
      <div className="flex justify-between items-start w-full px-10 gap-5">
        <div className="flex flex-col flex-1">
          <Repertoire />
          {/* <InsightChart /> */}
          <RepertoireActions></RepertoireActions>
          <Schedule />
        </div>
        <div className="flex flex-col items-between flex-1">
          <div id="board-wrap" className="bg-white p-1">
            <Chessboard width={550} height={550} config={cbConfig} ref={apiRef} />
          </div>

          <Controls {...controlsProps} />
        </div>
        <div className="flex flex-col flex-1 h-full">
          {/* <PgnTree makeCgOpts={makeCgOpts} /> */}
          <NewPgnTree></NewPgnTree>
          <Feedback {...feedbackProps} />
          <PgnControls makeCgOpts={makeCgOpts}></PgnControls>
        </div>
      </div>
    </div>
  );
};
export default ChessOpeningTrainer;
