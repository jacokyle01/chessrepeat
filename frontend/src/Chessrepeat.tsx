//TODO better solution for syncing chessground state w/ react store state

import React, { useState } from 'react';
import { Chessground } from './components/Chessground';
import Controls, { ControlsProps } from './components/Controls';
import { path as treePath} from './components/tree/ops';

import { useEffect, useRef } from 'react';
import { Config as CbConfig } from './components/Chessground';
import {
  DequeEntry,
  Chapter,
  TrainingData,
  trainingNodeList,
  TrainableContext,
} from './spaced-repetition/types';
import { RepertoireChapter, RepertoireEntry } from './types/types';
import Repertoire from './components/repertoire/Repertoire';
import { ChildNode, defaultHeaders, Game, parsePgn, PgnNodeData, startingPosition, walk } from 'chessops/pgn';
import { Chess, Color, Move, Position, PositionError } from 'chessops';
import { annotateMoves, countDueContext } from './spaced-repetition/util';
import {
  alternates,
  catalan,
  commentTest,
  foolsMate,
  manyAlternates,
  nimzo,
  opera,
  pgn3,
  transpose,
} from './debug/pgns';
import { configure, defaults, Config as SrsConfig } from './spaced-repetition/config';
import { initial } from 'chessground/fen';
import { calcTarget, chessgroundToSan, fenToDests, toDestMap } from './util';
import { DrawShape } from 'chessground/draw';
import { Key, MoveMetadata } from 'chessground/types';
import { useTrainerStore } from './state/state';
import { Feedback, FeedbackProps } from './components/Feedback';
import Schedule from './components/Schedule';
import AddToReperotireModal from './components/modals/AddToRepertoireModal';
import RepertoireActions from './components/repertoire/RepertoireActions';
import PgnControls from './components/pgn/PgnControls';
import PgnTree from './components/pgn/PgnTree';
import { FenError, makeFen, parseFen } from 'chessops/fen';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { scalachessCharPair } from 'chessops/compat';
import { MantineProvider } from '@mantine/core';
import { Debug } from './components/Debug';
import { formatTime } from './util/time';
import Explorer from './components/Explorer';
import { Api } from 'chessground/api';
import { Analysis } from './components/Analysis';
import { getNodeList } from './components/tree/ops';
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

  const [sounds, setSounds] = useState(SOUNDS);
  //TODO dont use useEffect here?
  const ran = useRef(false);

  // prevent from running twice in dev
  // useEffect(() => {
  //   if (ran.current) return;
  //   ran.current = true;

  //   importToRepertoire(opera(), 'white', 'Opera Game');
  //   importToRepertoire(pgn3(), 'white', 'Queens Gambit');
  //   // importToRepertoire(commentTest(), 'white', 'Test');
  // }, []);

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
      id: scalachessCharPair(move),
      ply,
      san: makeSanAndPlay(pos, move),
      fen: makeFen(pos.toSetup()),
      // uci: makeUci(move),

      disabled: node.data.training.disabled,
      seen: node.data.training.seen,
      group: node.data.training.group,
      dueAt: node.data.training.dueAt,

      children: withChildren ? node.children.map((child) => readNode(child, pos.clone(), ply + 1)) : [],
      comment: node.data.comments?.join('|') || null,
      // check: pos.isCheck() ? makeSquare(pos.toSetup().board.kingOf(pos.turn)!) : undefined,
    };
  };

  // TODO provide a more detailed breakdown, like when each one is due.
  // TODO combine this with nextTrainablePath() so we don't need to walk the tree twice

  // walk entire file and describe its state- when moves are due and such
  // store result in `dueTimes` array

  /*
    Traverse repertoire and glean any useful information 
  */
  const updateDueCounts = (): void => {
    if (repertoire.length == 0) return;
    const chapter = repertoire[repertoireIndex];
    //TODO Node<unknown>
    const root = chapter.tree;
    const ctx = countDueContext(0);
    const dueCounts = new Array(1 + srsConfig.buckets!.length).fill(0);

    //TODO use explicit stack?
    const countDueRecursive = (root: Tree.Node) => {
      root.children.forEach((child) => countDueRecursive(child));
      if (!root.disabled && root.seen) {
        const secondsTilDue = root.dueAt - currentTime();
        if (secondsTilDue <= 0) {
          dueCounts[0]++;
        } else {
          for (let i = 0; i < dueCounts.length; i++) {
            if (secondsTilDue <= srsConfig.buckets!.at(i)!) {
              dueCounts[i + 1]++;
              break;
            }
          }
        }
      }
    };

    countDueRecursive(root);
    setDueTimes(dueCounts);

    chapter.lastDueCount = dueCounts[0];
  };

  /*
Returns a Tree.Path string 
- easier to set selected node in the DOM 
- have to use getNodeList() to convert to Tree.Node[] 
- generally easier to convert from path to node
- TODO: more verbose return values - give more context for why `nextTrainablePath()` failed
 */

  //TODO return path to position + target Tree.Node
  const nextTrainablePath = (): TrainableContext | null => {
    let method = useTrainerStore.getState().repertoireMethod;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;
    let repertoire = useTrainerStore.getState().repertoire;

    if (repertoireIndex == -1 || method == 'edit') return null; // no chapter selected
    //initialization
    // TODO refactor to ops or tree file?
    interface DequeEntry {
      nodeList: Tree.Node[];
      layer: number;
      pathToHere: string;
      targetNode: Tree.Node;
    }

    const deque: DequeEntry[] = [];

    let root = repertoire[repertoireIndex].tree;
    //initialize deque
    console.log('root', root);
    for (const child of root.children) {
      deque.push({
        nodeList: [child],
        layer: 0,
        pathToHere: '',
        targetNode: child,
      });
    }
    while (deque.length != 0) {
      //initialize dedequed path
      const entry = srsConfig!.getNext!.by == 'breadth' ? deque.shift()! : deque.pop()!;
      const pos = entry.nodeList.at(-1)!;

      //test if match
      if (!pos.disabled) {
        switch (method) {
          case 'recall': //recall if due
            //TODO remove some pos._ fields
            if (pos.seen && pos.dueAt <= currentTime()) {
              return {
                startingPath: entry.pathToHere,
                targetMove: entry.targetNode,
              };
            }
            break;
          case 'learn': //learn if unseen
            if (!pos.seen) {
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
      if (entry.layer < srsConfig!.getNext!.max!) {
        // TODO ?
        for (const child of pos.children) {
          const DequeEntry: DequeEntry = {
            nodeList: [...entry.nodeList, child],
            layer: ++entry.layer,
            pathToHere: entry.pathToHere + entry.targetNode.id,
            targetNode: child,
          };
          deque.push(DequeEntry);
        }
      }
    }
    return null;
  };

  /*
  are we at the end of the training path?
  */
  const atLast = (): boolean => {
    if (!trainableContext) return false;
    // return useTrainerStore.getState().pathIndex === useTrainerStore.getState().trainingNodeList.length - 2;
    //
    const selectedPath = useTrainerStore.getState().selectedPath;
    const trainingPath = useTrainerStore.getState().trainableContext?.startingPath;

    return selectedPath == trainingPath;
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

  /*
  Move node to next bucket, return time until due
  */
  const succeed = (): number => {
    let repertoire = useTrainerStore.getState().repertoire;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;

    const chapter = repertoire[repertoireIndex];
    const pathToTrain = useTrainerStore.getState().trainableContext.startingPath;
    const targetNode = useTrainerStore.getState().trainableContext.targetMove;
    const root = chapter.tree;
    const trainingNodeList: Tree.Node[] = [...getNodeList(root, pathToTrain), targetNode];
    let repertoireMethod = useTrainerStore.getState().repertoireMethod;
    let node = trainingNodeList?.at(-1);
    if (!node) return;

    let timeToAdd = 0;
    switch (repertoireMethod) {
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
        timeToAdd = srsConfig!.buckets![groupIndex];

        node.group = groupIndex;
        break;
      case 'learn':
        // };
        // TODO use node.training instead?
        node.seen = true;
        // node.dueAt = currentTime() + srsConfig!.buckets![0];
        timeToAdd = srsConfig!.buckets![0];
        node.group = 0;
        chapter.bucketEntries[0]++; //globally, mark node as seen
        break;
    }

    node.dueAt = currentTime() + timeToAdd;
    return timeToAdd;
  };

  const fail = () => {
    setShowSuccessfulGuess(false);
    let node = useTrainerStore.getState().trainableContext.targetMove;

    //TODO need more recent version?
    const chapter = repertoire[repertoireIndex];
    if (!node) return;
    let groupIndex = node.group;
    chapter.bucketEntries[groupIndex]--;
    if (repertoireMethod === 'recall') {
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

      node.group = groupIndex;
      node.dueAt = currentTime() + interval;
    }
  };

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
  const makeGuess = (san: string) => {
    setLastGuess(san);

    let repertoire = useTrainerStore.getState().repertoire;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;
    const chapter = repertoire[repertoireIndex];
    const root = chapter.tree;

    const pathToTrain = useTrainerStore.getState().trainableContext.startingPath;
    const targetNode = useTrainerStore.getState().trainableContext.targetMove;
    const trainingNodeList: Tree.Node[] = getNodeList(root, pathToTrain);

    if (repertoireIndex == -1 || !trainingNodeList || repertoireMethod == 'learn') return;
    let possibleMoves = trainingNodeList.at(-1).children.map((_) => _.san);
    return possibleMoves.includes(san) ? (targetNode.san === san ? 'success' : 'alternate') : 'failure';
  };

  // TODO better name vs. ctrl.fail()
  const handleFail = (attempt?: string) => {
    setShowSuccessfulGuess(false);
    // TODO better solution than this below?
    setLastGuess(attempt ?? null);
    setLastFeedback('fail');

    // opts should look at lastFeedback
    //TODO
    // console.log(this.chessground!.state);
  };

  const handleLearn = () => {
    const repertoire = useTrainerStore.getState().repertoire;
    const repertoireIndex = useTrainerStore.getState().repertoireIndex;

    if (repertoire.length == 0) return;
    const chapter = repertoire[repertoireIndex];
    const root = chapter.tree;
    // TODO add reset functions for different context (repertoire, method) OR add conditionals to check those
    setShowSuccessfulGuess(false);
    resetTrainingContext();
    updateDueCounts();
    //TODO
    setLastFeedback('learn');

    setRepertoireMethod('learn');
    // mututes path

    const maybeCtx: TrainableContext | null = nextTrainablePath();
    if (!maybeCtx) {
      setLastFeedback('empty');
    } else {
      setTrainableContext(maybeCtx);
      const targetPath = maybeCtx.startingPath;
      setSelectedPath(targetPath);
      const nodeList = getNodeList(root, targetPath);
      setSelectedNode(nodeList.at(-1));
    }
    //TODO
    // movesElement!.scrollTop = movesElement!.scrollHeight;
  };
  const handleRecall = () => {
    setRepertoireMethod('recall');
    setLastFeedback('recall');

    let repertoire = useTrainerStore.getState().repertoire;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;
    const root = repertoire[repertoireIndex].tree;

    // let trainingNodeList = useTrainerStore.getState().trainingNodeList;

    resetTrainingContext();
    updateDueCounts();
    // TODO do w/ usetrainerstore?
    // repertoire[repertoireIndex].lastDueCount = dueTimes[0];
    // this.chessground?.setAutoShapes([]); // TODO in separate method?
    // setCbConfig({
    //   ...cbConfig,
    //   drawable: {
    //     autoShapes: [],
    //   },
    // });

    const maybeCtx = nextTrainablePath();

    if (!maybeCtx) {
      setLastFeedback('empty');
    } else {
      setTrainableContext(maybeCtx);
      //TODO factor out common logic in learn & recall
      const targetPath = maybeCtx.startingPath;
      setSelectedPath(targetPath);
      const nodeList = getNodeList(root, targetPath);
      setSelectedNode(nodeList.at(-1));
    }

    // update scroll height
    // const movesElement = document.getElementById('moves');
    // movesElement!.scrollTop = movesElement!.scrollHeight;
  };

  /*
    Only shows alternate box, which tells user
    that a different move is needed 
  */
  const handleAlternate = () => {
    setLastFeedback('alternate');
  };

  const importToRepertoire = (pgn: string, color: Color, name: string) => {
    let repertoire = useTrainerStore.getState().repertoire;
    // TODO why is PGN undefined?
    const subreps: Game<PgnNodeData>[] = parsePgn(pgn);
    subreps.forEach((subrep, i) => {
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
      console.log(repertoire, name, color);
      // console.log([
      //   ...repertoire.slice(0, numWhiteEntries - 1),
      //   chapter,
      //   ...repertoire.slice(numWhiteEntries),
      // ]);
      switch (color) {
        case 'white':
          setRepertoire([
            ...repertoire.slice(0, numWhiteEntries + 1),
            chapter,
            ...repertoire.slice(numWhiteEntries + 1),
          ]);
          setNumWhiteEntries(numWhiteEntries + 1);
          break;

        case 'black':
          setRepertoire([...repertoire, chapter]);
          break;
      }
      console.log(repertoire);
      // setRepertoire([...repertoire, chapter]);
      // if (chapter.trainAs == 'white') setNumWhiteEntries(numWhiteEntries + 1);

      /*
      Set orientation to match repertoire orientation if this is the only entry
      */
      if (repertoire.length == 1) {
        setOrientation(chapter.trainAs);
      }
      //TODO
      // postChapter(entry, color, name);
    });
  };

  // TODO put this in global state
  const jump = (path: Tree.Path): void => {
    const repertoire = useTrainerStore.getState().repertoire;
    const repertoireIndex = useTrainerStore.getState().repertoireIndex;

    const tree = repertoire[repertoireIndex].tree;

    const currentPath = useTrainerStore.getState().selectedPath;
    //TODO
    // const pathChanged = path !== this.path,
    // isForwardStep = pathChanged && path.length === this.path.length + 2;
    setSelectedPath(path);

    // TODO why are we storing this logic here ?
    const nodeList = getNodeList(tree, path);
    const node = treeOps.last(nodeList);
    setSelectedNode(node);
  };

  //TODO ... wrong index
  const deleteChapter = (index) => {
    setRepertoire([...repertoire.slice(0, index), ...repertoire.slice(index + 1)]);
    if (repertoire[repertoireIndex].trainAs == 'white') setNumWhiteEntries(numWhiteEntries - 1);
  };

  const renameChapter = (index, name) => {
    repertoire[index].name = name;
  };

  // const jump = (path: Tree.Path): void => {
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

  const chessgroundMove = (san: string) => {
    const fen = selectedNode.fen;
    if (!selectedNode.children.map((_) => _.san).includes(san)) {
      const [pos, error] = positionFromFen(fen);
      const move = parseSan(pos, san);

      const newNode: Tree.Node = {
        id: scalachessCharPair(move),
        ply: selectedNode.ply + 1,
        san: makeSanAndPlay(pos, move),
        fen: makeFen(pos.toSetup()),
        disabled: !selectedNode.disabled,
        seen: false,
        group: -1,
        dueAt: -1,
        children: [],
      };

      // update chapter-wide metadata if necessary
      if (!newNode.disabled) repertoire[repertoireIndex].nodeCount++;
      selectedNode.children.push(newNode);
    }

    const movingTo = selectedNode.children.find((x) => x.san == san);

    const newPath = selectedPath + movingTo.id;

    /*
    Update state
    */

    setSelectedNode(movingTo);
    setSelectedPath(newPath);

    //TODO update due counts, use builtin tree operations

    /*
      find SAN in children
      if its not there, add it
      set currentNode, currentPath, etc... 

      other stuff shuld automatically work out??? 

    */

    /* Make the move

      if newPath
        add node
      else 
        adjust position 
        assume all other data can be derived from position change 







    */
    // return (orig, dest) => {
    //   chess.move({from: orig, to: dest});
    //   cg.set({
    //     turnColor: toColor(chess),
    //     movable: {
    //       color: toColor(chess),
    //       dests: toDests(chess)
    //     }
    //   });
    // };
  };

  // //TODO - delete
  // //TODO dont prop drill this?
  // //TODO dont pass in jump
  // const deleteNode = (path: Tree.Path, jump) => {
  //   const tree = repertoire[repertoireIndex].tree;
  //   const node = tree.nodeAtPath(path);
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

  const controlsProps: ControlsProps = {
    repertoireMethod,
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
  const feedbackProps = {
    handleRecall,
    fail,
  };

  // TODO should be in different component?
  const chapter = repertoire[repertoireIndex];
  const isEditing = repertoireMethod == 'edit';

  //TODO hints
  //TODO fail

  function positionFromFen(fen: string): [Chess, null] | [null, FenError | PositionError] {
    const [setup, error] = parseFen(fen).unwrap(
      (v) => [v, null],
      (e) => [null, e],
    );
    if (error) {
      return [null, error];
    }

    return Chess.fromSetup(setup).unwrap(
      (v) => [v, null],
      (e) => [null, e],
    );
  }

  const [chessPosition, error] = positionFromFen(selectedNode?.fen || initial);
  const turn = chessPosition?.turn || 'white';
  /*
  The current move we're training
  */
  const targetDest = (): Key[] => {
    const targetNode = useTrainerStore.getState().trainableContext.targetMove;
    const uci = calcTarget(selectedNode?.fen || initial, targetNode.san!);
    return uci;
  };

  const createShapes = (): DrawShape[] => {
    if (!atLast()) return [];
    const result = [];
    if (!isEditing) {
      const uci = targetDest();
      if (repertoireMethod === 'learn' && atLast()) {
        result.push({ orig: uci[0], dest: uci[1], brush: 'green' });
      } else if (showingHint) {
        result.push({ orig: uci[0], brush: 'yellow' });
      } else if (lastFeedback === 'fail') {
        result.push({ orig: uci[0], dest: uci[1], brush: 'red' });
      }
    }

    return result;
  };

  //TODO cleaner logic, reuse fenToDests w/ EDIT
  const calculateDests = () => {
    const isAtLast = atLast();
    if (repertoireMethod != 'edit' && !isAtLast) return new Map();
    if (repertoireMethod == 'learn' && isAtLast) {
      const uci = targetDest();
      return toDestMap(uci[0], uci[1]);
    }
    return fenToDests(selectedNode?.fen || initial);
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
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const coords = squareToCoords(square, bounds, orientation);

    // store coordinates relative to container
    const formattedTime = formatTime(time);
    setBox({ x: coords.x, y: coords.y, time: formattedTime });
    setTimeout(() => setBox(null), 1000);
  };

  //TODO dont try to calculate properties when we haven't initialized the repertoire yet
  return (
    <MantineProvider>
      <div id="root" className="w-full h-full bg-gray-200">
        <div id="header" className="flex items-end justify-left text-3xl mb-3">
          <img src="logo.png" alt="Logo" className="h-12 w-12" />
          <span>chess</span>
          <span className="text-stone-600">repeat</span>
        </div>
        {showingAddToRepertoireMenu && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowingAddToRepertoireMenu(false)} // close on backdrop click
            ></div>

            {/* Modal */}
            <AddToReperotireModal importToRepertoire={importToRepertoire}></AddToReperotireModal>
          </>
        )}
        {/* {showTrainingSettings && <SettingsModal></SettingsModal>} */}
        <div className="flex justify-between items-start w-full px-10 gap-5">
          <div className="flex flex-col flex-1">
            <Repertoire deleteChapter={deleteChapter} renameChapter={renameChapter} />
            <RepertoireActions></RepertoireActions>
            <Schedule />
          </div>
          <div className="flex flex-col items-between flex-1">
            <div id="board-wrap" className="bg-white p-1" ref={containerRef}>
              {/* TODO fix || initial */}
              <Chessground
                orientation={orientation}
                fen={selectedNode?.fen || initial}
                turnColor={turn}
                movable={{
                  free: false,
                  color: turn,
                  dests: calculateDests(),
                  events: {
                    after: (from: Key, to: Key, metadata: MoveMetadata) => {
                      const san = chessgroundToSan(selectedNode.fen, from, to);
                      if (!isEditing) {
                        // this.syncTime();
                        metadata.captured
                          ? sounds.capture.play().catch((err) => console.error('Audio playback error:', err))
                          : sounds.move.play().catch((err) => console.error('Audio playback error:', err));
                        if (atLast()) {
                          switch (repertoireMethod) {
                            case 'learn':
                              succeed();
                              handleLearn();
                              break;
                            case 'recall':
                              //TODO be more permissive depending on config
                              switch (makeGuess(san)) {
                                case 'success':
                                  const secsUntilDue = succeed();
                                  showBoxAtSquare(to, secsUntilDue);
                                  handleRecall();
                                  break;
                                case 'alternate':
                                  handleAlternate(san);
                                  break;
                                case 'failure':
                                  //TODO maybe dont fail right away?
                                  handleFail(san);
                                  break;
                              }
                              break;
                          }
                        }
                      } else {
                        // optionally add move
                        chessgroundMove(san);
                      }
                    },
                  },
                }}
                drawable={{ autoShapes: createShapes() }}
              />
            </div>

            <Controls {...controlsProps} />
          </div>
          <div className="flex flex-col flex-1 h-full">
            <div className="pgn-context rounded-xl border border-gray-300 overflow-hidden">
              {repertoireMethod == 'edit' && <Analysis></Analysis>}
              <PgnTree></PgnTree>
              {repertoireMethod == 'edit' ? <Explorer /> : <Feedback {...feedbackProps} />}
            </div>
            <PgnControls></PgnControls>
          </div>
        </div>
      </div>
      <Debug atLast={atLast} />
      {/*TODO handle with animation, allow multiple feedback at the same time */}
      {box && repertoireMethod == 'recall' && (
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

export default ChessOpeningTrainer;
