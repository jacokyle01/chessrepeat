//TODO better solution for syncing chessground state w/ react store state

import React, { useState } from 'react';
import { Chessground } from './components/Chessground';
import Controls, { ControlsProps } from './components/Controls';

import { useEffect, useRef } from 'react';
import { Config as CbConfig } from './components/Chessground';
import {
  DequeEntry,
  Chapter,
  TrainingData,
  TrainableNodeList,
  TrainableContext,
  TrainableNode,
} from './training/types';
import Repertoire from './components/repertoire/Repertoire';
import {
  ChildNode,
  defaultHeaders,
  Game,
  makePgn,
  parsePgn,
  PgnNodeData,
  startingPosition,
  transform,
  walk,
} from 'chessops/pgn';
import { Chess, Color, Move, Position, PositionError } from 'chessops';
import { chessgroundMove } from 'chessops/compat';
import { annotateMoves, atLast, countDueContext } from './training/util';
import {
  alternates,
  catalan,
  commentTest,
  example,
  foolsMate,
  manyAlternates,
  nimzo,
  opera,
  pgn3,
  transpose,
} from './debug/pgns';
import { initial } from 'chessground/fen';
import { calcTarget, chessgroundToSan, currentTime, fenToDests, positionFromFen, toDestMap } from './util';
import { DrawShape } from 'chessground/draw';
import { Key, MoveMetadata } from 'chessground/types';
import { useTrainerStore } from './state/state';
import { UserTip } from './components/UserTip';
import Schedule from './components/Schedule';
import AddToRepertoireModal from './components/modals/AddToRepertoireModal';
import RepertoireActions from './components/repertoire/RepertoireActions';
import PgnControls from './components/pgn/PgnControls';
import PgnTree from './components/pgn/PgnTree';
import { FenError, makeFen, parseFen } from 'chessops/fen';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { chessgroundDests, scalachessCharPair } from 'chessops/compat';
import { MantineProvider } from '@mantine/core';
import { Debug } from './components/Debug';
import { formatTime } from './util/time';
import Explorer from './components/Explorer';
import { Api } from 'chessground/api';
import { CommentBox } from './components/CommentBox';
import { CopyFen } from './components/CopyFen';
import { parseIntoChapter } from './io/util';
import { getNodeList } from './tree/ops';
import SettingsModal from './components/modals/SettingsModal';
// import Chessground, { Api, Config, Key } from "@react-chess/chessground";

// these styles must be imported somewhere
// import "chessground/assets/chessground.base.css";
// import "chessground/assets/chessground.brown.css";
// import "chessground/assets/chessground.cburnett.css";

const SRS_CONFIG = {
  buckets: [1, 1, 1],
  getNext: {
    by: 'depth',
    max: 60, // ply
  },
};

// const CONFIG = defaults();
const SOUNDS = {
  move: new Audio('/sound/public_sound_standard_Move.mp3'),
  capture: new Audio('/sound/public_sound_standard_Capture.mp3'),
};
export const Chessrepeat = () => {
  const {
    setNextTrainablePosition,
    showingTrainingSettings,
    setShowingTrainingSettings,
    showingAddToRepertoireMenu,
    setShowingAddToRepertoireMenu,

    repertoire,
    setRepertoire,
    repertoireIndex,
    setRepertoireIndex,

    showingHint,
    setShowingHint,
    userTip,
    setUserTip,
    lastGuess,
    setLastGuess,
    dueTimes,
    setDueTimes,

    trainingConfig,
    setTrainingConfig,
    cbConfig,
    setCbConfig,

    setSelectedPath,
    setSelectedNode,

    selectedNode,
    selectedPath,
    // trainingPath,
    // setTrainingPath,

    trainingMethod,
    setTrainingMethod,

    trainableContext,
    setTrainableContext,

    updateDueCounts,

    succeed,
    fail,
    guess,
    makeMove,
  } = useTrainerStore();

  const [sounds, setSounds] = useState(SOUNDS);
  const [activeMoveId, setActiveMoveId] = useState();

  const movesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = movesContainerRef.current;
    console.log('container', container);
    console.log('should be the pgn tree container (and have overflow set to scroll');
    if (!container) return;

    const scrollActiveIntoView = () => {
      const activeEl = container.querySelector('.active') as HTMLElement | null;
      if (!activeEl) return;

      activeEl.scrollIntoView({
        // behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    };

    // // Initial sync (in case active already exists)
    // scrollActiveIntoView();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          scrollActiveIntoView();
          break;
        }
      }
    });

    observer.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  //TODO dont use useEffect here?
  // const ran = useRef(false);

  // prevent from running twice in dev
  // (() => {
  //   if (ran.current) return;
  //   ran.current = true;

  //   // importToRepertoire(alternates(), 'white', 'Alternates');
  //   // importToRepertoire(example(), 'white', 'Example Repertoire');
  //   // importToRepertoire(example(), 'white', 'Example Repertoire');
  //   // importToRepertoire(example(), 'white', 'Example Repertoire');
  //   // importToRepertoire(example(), 'white', 'Example Repertoire');
  // }, []);

  //TODO move somewhere else?
  interface Opts {
    parentPath: string;
    isMainline: boolean;
    depth: number;
    inline?: ChildNode<TrainingData>;
    withIndex?: boolean;
    truncate?: number;
  }

  interface Ctx {
    truncateComments: boolean;
    currentPath: string | undefined;
  }

  /*
  are we at the end of the training path?
  */

  // /*
  // Move node to next bucket, return time until due
  // */
  // const succeed = (): number => {
  //   let repertoire = useTrainerStore.getState().repertoire;
  //   let repertoireIndex = useTrainerStore.getState().repertoireIndex;

  //   const chapter = repertoire[repertoireIndex];
  //   const pathToTrain = useTrainerStore.getState().trainableContext.startingPath;
  //   const targetNode = useTrainerStore.getState().trainableContext.targetMove;
  //   const root = chapter.tree;
  //   const TrainableNodeList: ChildNode<TrainingData>[] = [...getNodeList(root, pathToTrain), targetNode];
  //   let TrainingMethod = useTrainerStore.getState().TrainingMethod;
  //   let node = TrainableNodeList?.at(-1);
  //   if (!node) return;

  //   let timeToAdd = 0;
  //   switch (TrainingMethod) {
  //     case 'recall':
  //       setLastResult('succeed');
  //       setShowSuccessfulGuess(true);

  //       let groupIndex = node.group;
  //       chapter.bucketEntries[groupIndex]--;
  //       switch (trainingConfig!.promotion) {
  //         case 'most':
  //           groupIndex = trainingConfig!.buckets!.length - 1;
  //           break;
  //         case 'next':
  //           groupIndex = Math.min(groupIndex + 1, trainingConfig!.buckets!.length - 1);
  //           break;
  //       }
  //       chapter.bucketEntries[groupIndex]++;
  //       timeToAdd = trainingConfig!.buckets![groupIndex];

  //       node.group = groupIndex;
  //       break;
  //     case 'learn':
  //       // };
  //       // TODO use node.training instead?
  //       node.seen = true;
  //       // node.dueAt = currentTime() + trainingConfig!.buckets![0];
  //       timeToAdd = trainingConfig!.buckets![0];
  //       node.group = 0;
  //       chapter.bucketEntries[0]++; //globally, mark node as seen
  //       break;
  //   }

  //   node.dueAt = currentTime() + timeToAdd;
  //   return timeToAdd;
  // };

  // const fail = () => {
  //   setShowSuccessfulGuess(false);
  //   let node = useTrainerStore.getState().trainableContext.targetMove;

  //   //TODO need more recent version?
  //   const chapter = repertoire[repertoireIndex];
  //   if (!node) return;
  //   let groupIndex = node.group;
  //   chapter.bucketEntries[groupIndex]--;
  //   if (TrainingMethod === 'recall') {
  //     setLastResult('fail');
  //     switch (trainingConfig!.demotion) {
  //       case 'most':
  //         groupIndex = 0;
  //         break;
  //       case 'next':
  //         groupIndex = Math.max(groupIndex - 1, 0);
  //         break;
  //     }
  //     chapter.bucketEntries[groupIndex]++;
  //     const interval = trainingConfig!.buckets![groupIndex];

  //     node.group = groupIndex;
  //     node.dueAt = currentTime() + interval;
  //   }
  // };

  const resetTrainingContext = () => {
    setCbConfig({
      ...cbConfig,
      drawable: {
        autoShapes: [],
      },
    });
    setShowingHint(false);
  };

  //TODO clean this up
  // const makeGuess = (san: string) => {
  //   setLastGuess(san);

  //   let repertoire = useTrainerStore.getState().repertoire;
  //   let repertoireIndex = useTrainerStore.getState().repertoireIndex;
  //   const chapter = repertoire[repertoireIndex];
  //   const root = chapter.tree;

  //   const pathToTrain = useTrainerStore.getState().trainableContext.startingPath;
  //   const targetNode = useTrainerStore.getState().trainableContext.targetMove;
  //   const TrainableNodeList: ChildNode<TrainingData>[] = getNodeList(root, pathToTrain);

  //   if (repertoireIndex == -1 || !TrainableNodeList || TrainingMethod == 'learn') return;
  //   let possibleMoves = TrainableNodeList.at(-1).children.map((_) => _.san);
  //   return possibleMoves.includes(san) ? (targetNode.san === san ? 'success' : 'alternate') : 'failure';
  // };

  // TODO better name vs. ctrl.fail()
  // const handleFail = (attempt?: string) => {
  //   // TODO better solution than this below?
  //   setUserTip('fail');

  //   // opts should look at userTip
  //   //TODO
  //   // console.log(this.chessground!.state);
  // };

  // const handleLearn = () => {
  //   const repertoire = useTrainerStore.getState().repertoire;
  //   const repertoireIndex = useTrainerStore.getState().repertoireIndex;

  //   if (repertoire.length == 0) return;
  //   const chapter = repertoire[repertoireIndex];
  //   const root = chapter.tree;
  //   // TODO add reset functions for different context (repertoire, method) OR add conditionals to check those
  //   setShowSuccessfulGuess(false);
  //   resetTrainingContext();
  //   updateDueCounts();
  //   //TODO
  //   setUserTip('learn');

  //   setTrainingMethod('learn');
  //   // mututes path

  //   const maybeCtx: TrainableContext | null = nextTrainablePath();
  //   if (!maybeCtx) {
  //     setUserTip('empty');
  //   } else {
  //     setTrainableContext(maybeCtx);
  //     const targetPath = maybeCtx.startingPath;
  //     setSelectedPath(targetPath);
  //     const nodeList = getNodeList(root, targetPath);
  //     setSelectedNode(nodeList.at(-1));
  //   }
  //   //TODO
  //   // movesElement!.scrollTop = movesElement!.scrollHeight;
  // };
  // const handleRecall = () => {
  //   setTrainingMethod('recall');
  //   setUserTip('recall');

  //   let repertoire = useTrainerStore.getState().repertoire;
  //   let repertoireIndex = useTrainerStore.getState().repertoireIndex;
  //   const root = repertoire[repertoireIndex].tree;

  //   // let TrainableNodeList = useTrainerStore.getState().TrainableNodeList;

  //   resetTrainingContext();
  //   updateDueCounts();
  //   // TODO do w/ usetrainerstore?
  //   // repertoire[repertoireIndex].lastDueCount = dueTimes[0];
  //   // this.chessground?.setAutoShapes([]); // TODO in separate method?
  //   // setCbConfig({
  //   //   ...cbConfig,
  //   //   drawable: {
  //   //     autoShapes: [],
  //   //   },
  //   // });

  //   const maybeCtx = nextTrainablePath();

  //   if (!maybeCtx) {
  //     setUserTip('empty');
  //   } else {
  //     setTrainableContext(maybeCtx);
  //     //TODO factor out common logic in learn & recall
  //     const targetPath = maybeCtx.startingPath;
  //     setSelectedPath(targetPath);
  //     const nodeList = getNodeList(root, targetPath);
  //     setSelectedNode(nodeList.at(-1));
  //   }

  //   // update scroll height
  //   // const movesElement = document.getElementById('moves');
  //   // movesElement!.scrollTop = movesElement!.scrollHeight;
  // };

  /*
const autoScroll = throttle(150, (ctrl: PuzzleCtrl, el: HTMLElement) => {
  const cont = el.parentNode as HTMLElement;
  const target = el.querySelector('.active') as HTMLElement | null;
  if (!target) {
    cont.scrollTop = ctrl.path === treePath.root ? 0 : 99999;
    return;
  }
  const targetOffset = target.getBoundingClientRect().y - el.getBoundingClientRect().y;
  cont.scrollTop = targetOffset - cont.offsetHeight / 2 + target.offsetHeight;
});
*/

  const handleEdit = () => {
    setTrainingMethod('edit');
    console.log('edit');

    // // find active element
    // const target = el.querySelector('.active') as HTMLElement | null;
    // console.log("target", target);
    // // scroll to it
  };

  /*
    Only shows alternate box, which tells user
    that a different move is needed 
  */
  const handleAlternate = () => {
    setUserTip('alternate');
  };

  const importAnnotatedIntoRepertoire = () => {};

  // const importToRepertoire = (pgn: string, color: Color, name: string) => {
  //   let repertoire = useTrainerStore.getState().repertoire;
  //   // TODO why is PGN undefined?
  //   const subreps: Game<PgnNodeData>[] = parsePgn(pgn);
  //   subreps.forEach((subrep, i) => {
  //     //augment chapter with a) color to train as, and b) training data
  //     // const annotatedSubrep: Chapter<TrainingData> = {
  //     //   ...subrep,
  //     //   ...generateChapter(subrep.moves, color, trainingConfig.buckets!),
  //     // };

  //     const { moves: moves, nodeCount: nodeCount } = annotateMoves(subrep.moves, color);

  //     // game<trainingData> --> ChildNode<TrainingData>
  //     // empower chapters w/ tree operations

  //     const start = startingPosition(defaultHeaders()).unwrap();
  //     const fen = makeFen(start.toSetup());
  //     const initialPly = (start.toSetup().fullmoves - 1) * 2 + (start.turn === 'white' ? 0 : 1);
  //     const treeParts: ChildNode<TrainingData>[] = [
  //       {
  //         id: '',
  //         ply: initialPly,
  //         fen,
  //         children: [],
  //         //TODO ???? make this optional?
  //         disabled: false,
  //         dueAt: -1,
  //         group: 0,
  //         seen: false,
  //         comment: '',
  //       },
  //     ];
  //     let tree = moves;

  //     const pos = start;
  //     const sidelines: ChildNode<TrainingData>[][] = [[]];
  //     let index = 0;
  //     while (tree.children.length) {
  //       const [mainline, ...variations] = tree.children;
  //       const ply = initialPly + index + 1;
  //       sidelines.push(variations.map((variation) => readNode(variation, pos.clone(), ply)));
  //       treeParts.push(readNode(mainline, pos, ply, false));
  //       tree = mainline;
  //       index += 1;
  //     }
  //     const newTree = treeReconstruct(treeParts, sidelines);
  //     // return newTree;

  //     if (i > 0) name += ` (${i + 1})`;

  //     //

  //     //TODO refactor (and possibly combine) annotateMoves and the above logic ^ creating a Tree
  //     const chapter: RepertoireChapter = {
  //       tree: newTree,
  //       name: name,
  //       bucketEntries: trainingConfig.buckets.map(() => 0),
  //       nodeCount: nodeCount,
  //       lastDueCount: 0,
  //       trainAs: color,
  //     };

  //     // TODO handle correct placement
  //     console.log('------------');
  //     // console.log(repertoire, name, color);
  //     switch (color) {
  //       case 'white':
  //         setRepertoire([chapter, ...repertoire]);
  //         break;

  //       case 'black':
  //         setRepertoire([...repertoire, chapter]);
  //         break;
  //     }
  //     console.log(repertoire);
  //     //TODO
  //     // postChapter(entry, color, name);
  //   });
  // };

  //TODO move to state.ts
  const deleteChapter = (index) => {
    setRepertoire([...repertoire.slice(0, index), ...repertoire.slice(index + 1)]);
  };

  const renameChapter = (index, name) => {
    repertoire[index].name = name;
  };

  // const jump = (path: string): void => {
  //   const repertoire = useTrainerStore.getState().repertoire;
  //   const repertoireIndex = useTrainerStore.getState().repertoireIndex;

  //   const tree = repertoire[repertoireIndex].tree;

  //   const currentPath = useTrainerStore.getState().selectedPath;
  //   //TODO
  //   // const pathChanged = path !== this.path,
  //   // isForwardStep = pathChanged && path.length === this.path.length + 2;
  //   setSelectedPath(path);

  //   // TODO why are we storing this logic here ?
  //   const nodeList = tree.getNodeList(path);
  //   const node = treeOps.last(nodeList);
  //   setSelectedNode(node);
  // };

  /*
  After we make a move in editing
  */
  // //TODO put in state
  // const playMove = (san: string) => {
  //   const fen = selectedNode.data.fen;
  //   if (!selectedNode.children.map((_) => _.data.san).includes(san)) {
  //     const [pos, error] = positionFromFen(fen);
  //     const move = parseSan(pos, san);

  //     const newNode: TrainableNode = {
  //       id: scalachessCharPair(move),
  //       ply: selectedNode.data.ply + 1,
  //       san: makeSanAndPlay(pos, move),
  //       fen: makeFen(pos.toSetup()),
  //       disabled: !selectedNode.data.disabled,
  //       seen: false,
  //       group: -1,
  //       dueAt: -1,
  //       children: [],
  //     };

  //     // update chapter-wide metadata if necessary
  //     if (!newNode.data.training.disabled) repertoire[repertoireIndex].nodeCount++;
  //     selectedNode.children.push(newNode);
  //   }

  //   const movingTo = selectedNode.children.find((x) => x.data.san == san);

  //   const newPath = selectedPath + movingTo.data.id;

  //   /*
  //   Update state
  //   */

  //   setSelectedNode(movingTo);
  //   setSelectedPath(newPath);

  //   //TODO update due counts, use builtin tree operations

  //   /*
  //     find SAN in children
  //     if its not there, add it
  //     set currentNode, currentPath, etc...

  //     other stuff shuld automatically work out???

  //   */

  //   /* Make the move

  //     if newPath
  //       add node
  //     else
  //       adjust position
  //       assume all other data can be derived from position change

  //   */
  //   // return (orig, dest) => {
  //   //   chess.move({from: orig, to: dest});
  //   //   cg.set({
  //   //     turnColor: toColor(chess),
  //   //     movable: {
  //   //       color: toColor(chess),
  //   //       dests: toDests(chess)
  //   //     }
  //   //   });
  //   // };
  // };

  // //TODO - delete
  // //TODO dont prop drill this?
  // //TODO dont pass in jump
  // const deleteNode = (path: string, jump) => {
  //   const tree = repertoire[repertoireIndex].tree;
  //   const node = ChildNode<TrainingData>AtPath(path);
  //   if (!node) return;
  //   //TODO count nodes to determine what we need to remove
  //   // const count = treeOps.countChildrenAndComments(node);
  //   tree.deleteNodeAt(path);
  //   if (treePath.contains(selectedPath, path)) jump(treePath.init(path));
  //   // else jump(this.path);
  //   else jump(path);

  //   // if (this.study) this.study.deleteNode(path);
  //   // this.redraw();
  // };

  // const controlsProps: ControlsProps = {
  //   trainingMethod,
  //   handleLearn,
  //   handleRecall,
  //   handleEdit,
  //   setShowingTrainingSettings,
  // };

  // const UserTipProps = {
  //   handleRecall,
  //   fail,
  // };

  // TODO should be in different component?
  const chapter = repertoire[repertoireIndex];
  const isEditing = trainingMethod == 'edit';

  //TODO hints
  //TODO fail

  const [chessPosition, error] = positionFromFen(selectedNode?.data.fen || initial);
  const turn = chessPosition?.turn || 'white';
  /*
  The current move we're training
  */
  const targetDest = (): Key[] => {
    const targetNode = useTrainerStore.getState().trainableContext.targetMove;
    const uci = calcTarget(selectedNode?.data.fen || initial, targetNode.data.san!);
    return uci;
  };

  const createShapes = (): DrawShape[] => {
    if (!atLast()) return [];
    const result = [];
    if (!isEditing) {
      const uci = targetDest();
      if (trainingMethod === 'learn' && atLast()) {
        result.push({ orig: uci[0], dest: uci[1], brush: 'green' });
      } else if (showingHint) {
        result.push({ orig: uci[0], brush: 'yellow' });
      } else if (userTip === 'fail') {
        result.push({ orig: uci[0], dest: uci[1], brush: 'red' });
      }
    }

    return result;
  };

  //TODO cleaner logic, reuse fenToDests w/ EDIT
  const calculateDests = () => {
    const isAtLast = atLast();
    // don't allow moves if user isn't on trainable move
    if (trainingMethod != 'edit' && !isAtLast) return new Map();
    // don't allow moves immediately after recall fail
    if (userTip == 'fail') return new Map();
    if (trainingMethod == 'learn' && isAtLast) {
      const uci = targetDest();
      return toDestMap(uci[0], uci[1]);
    }
    return fenToDests(selectedNode?.data.fen || initial);
  };

  function squareToCoords(square: string, bounds: DOMRect, orientation: 'white' | 'black') {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square[1]) - 1;

    const squareSize = bounds.width / 8;

    let x = orientation === 'white' ? file : 7 - file;
    let y = orientation === 'white' ? 7 - rank : rank;

    return {
      x: bounds.left + (x + 0.5) * squareSize,
      y: bounds.top + (y + 0.5) * squareSize,
    };
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; time: string } | null>(null);

  const showBoxAtSquare = (square: string, time: number) => {
    const chapter = repertoire[repertoireIndex];
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const coords = squareToCoords(square, bounds, chapter.trainAs);

    // store coordinates relative to container
    const formattedTime = formatTime(time);
    setBox({ x: coords.x, y: coords.y, time: formattedTime });
    setTimeout(() => setBox(null), 1000);
  };

  console.log('selectedNode (before we make a move', selectedNode);

  //TODO refactor common logic here
  const prevMoveIfExists = () => {
    let repertoire = useTrainerStore.getState().repertoire;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;

    const chapter = repertoire[repertoireIndex];
    if (!chapter) return undefined;
    const root = chapter.root;
    const nodeList = getNodeList(root, selectedPath);
    const lastNode = nodeList.at(-1);
    const lastlastNode = nodeList.at(-2);
    if (!lastNode || !lastlastNode) return undefined;
    console.log('lastNode', lastNode, 'before that', lastlastNode);

    const fen = lastlastNode.data.fen;
    const setup = parseFen(fen);
    if (!setup.isOk) throw new Error('Invalid FEN: ' + fen);

    let pos = Chess.fromSetup(setup.value).unwrap();
    console.log('pos', pos);
    const move = parseSan(pos, lastNode.data.san);
    console.log('move', move);
    // return [move.from, move.to];
    return chessgroundMove(move);
  };

  const prevMove = prevMoveIfExists();
  const lastMove = selectedNode ? prevMove : undefined;

  console.log('lastMove (should be like [a1, a2]', lastMove);
  //TODO dont try to calculate properties when we haven't initialized the repertoire yet
  return (
    <MantineProvider>
      <div id="root" className="w-full h-full bg-gray-200">
        <div id="header" className="flex items-center justify-start text-3xl mb-3 gap-10">
          {/* Logo + Title */}
          <div className="flex items-end">
            <img src="logo.png" alt="Logo" className="h-12 w-12 mr-2" />
            <span>chess</span>
            <span className="text-stone-600">repeat</span>
          </div>

          {/* Links */}
          <div className="flex gap-6 text-base font-light text-gray-500 font-mono mt-auto">
            <a
              href="https://discord.gg/xhjra9W6Bh"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-black capitalize font-mono"
              title="Join our Discord"
            >
              JOIN DISCORD
            </a>
            <span>•</span>
            <a
              href="https://github.com/jacokyle01/chessrepeat"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-black"
              title="View on GitHub"
            >
              VIEW GITHUB
            </a>
            <span>•</span>
            <a
              href="mailto:jacokyle01@gmail.com?subject=Bug Report | chessrepeat"
              className="hover:text-black"
              title="Report a Bug via Email"
            >
              REPORT BUG
            </a>
          </div>
        </div>
        {/* //TODO overlap wrapper component? */}
        {showingAddToRepertoireMenu && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-100"
              onClick={() => setShowingAddToRepertoireMenu(false)} // close on backdrop click
            ></div>

            {/* Modal */}
            <AddToRepertoireModal></AddToRepertoireModal>
          </>
        )}
        {showingTrainingSettings && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowingTrainingSettings(false)} // close on backdrop click
            ></div>

            {/* Modal */}
            <SettingsModal></SettingsModal>
          </>
        )}

        {/* <SettingsModal></SettingsModal> */}
        {/* {showTrainingSettings && <SettingsModal></SettingsModal>} */}
        <div className="flex justify-between items-start w-full px-10 gap-5">
          <div className="repertoire-wrap flex flex-col flex-1 w-1/3">
            <Repertoire deleteChapter={deleteChapter} renameChapter={renameChapter} />
            <RepertoireActions></RepertoireActions>
            <Schedule />
          </div>
          <div className="game-wrap flex flex-col items-between flex-1">
            <div id="board-wrap" className="bg-white p-1" ref={containerRef}>
              {/* TODO fix || initial */}
              <Chessground
                orientation={chapter?.trainAs || 'white'}
                fen={selectedNode?.data.fen || initial}
                turnColor={turn}
                lastMove={lastMove}
                movable={{
                  free: false,
                  color: turn,
                  dests: calculateDests(),
                  events: {
                    after: (from: Key, to: Key, metadata: MoveMetadata) => {
                      const san = chessgroundToSan(selectedNode.data.fen, from, to);
                      if (!isEditing) {
                        // this.syncTime();
                        metadata.captured
                          ? sounds.capture.play().catch((err) => console.error('Audio playback error:', err))
                          : sounds.move.play().catch((err) => console.error('Audio playback error:', err));
                        //TODO separate function here! and for sound!
                        if (atLast()) {
                          //TODO find good time to update due counts
                          updateDueCounts();
                          switch (trainingMethod) {
                            case 'learn':
                              console.log('learn callback');
                              succeed();
                              console.log('does trainable have fen?', selectedNode);
                              setNextTrainablePosition();
                              //TODO just call setNextTrainable..
                              break;
                            case 'recall':
                              //TODO be more permissive depending on config
                              setLastGuess(san);
                              switch (guess(san)) {
                                case 'success':
                                  const secsUntilDue = succeed();
                                  showBoxAtSquare(to, secsUntilDue);
                                  // handleRecall();
                                  // succeed();
                                  setNextTrainablePosition();
                                  break;
                                case 'alternate':
                                  setUserTip('alternate');
                                  break;
                                case 'failure':
                                  // set user tip to fail, this hsould inform UI to not let user play move
                                  //TODO maybe dont fail right away?
                                  setUserTip('fail');
                                  break;
                              }
                              break;
                          }
                        }
                      } else {
                        // optionally add move
                        makeMove(san);
                      }
                    },
                  },
                }}
                drawable={{ autoShapes: createShapes() }}
              />
            </div>

            <Controls />
            <CommentBox></CommentBox>
            <CopyFen></CopyFen>
          </div>
          <div className="tree-wrap flex flex-col flex-1 h-full w-1/3">
            {/* TODO should be in PGNTree? */}
            <div
              className="pgn-context rounded-xl border border-gray-300 overflow-hidden"
              ref={movesContainerRef}
            >
              <PgnTree setActiveMoveId={setActiveMoveId}></PgnTree>
              {trainingMethod == 'edit' ? <Explorer /> : <UserTip />}
            </div>
            <PgnControls></PgnControls>
          </div>
        </div>
      </div>
      {/* <Debug atLast={atLast} /> */}
      {/*TODO handle with animation, allow multiple UserTip at the same time */}
      {box && trainingMethod == 'recall' && (
        <div
          style={{
            position: 'absolute',
            left: `${box.x - 5}px`,
            top: `${box.y - 25}px`,
            width: '40px',
            height: '40px',
            // backgroundColor: 'black',
            pointerEvents: 'none',
            transition: 'opacity 1s ease',
            zIndex: 10,
            fontStyle: 'oblique',
            fontWeight: 'bold',
            color: 'black',
            transform: 'rotate(45deg)', // <-- rotation here
          }}
        >
          +{box.time}
        </div>
      )}
    </MantineProvider>
  );
};

export default Chessrepeat;
