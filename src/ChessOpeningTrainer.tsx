import React, { useState } from 'react';
import { Chess } from 'chess.js';
import Chessboard, { Key } from './components/Chessboard';
import Controls, { ControlsProps } from './components/Controls';

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
import { DequeEntry, Method, Subrepertoire, TrainingData, TrainingPath } from './spaced-repetition/types';
import { RepertoireEntry } from './types/types';
import Repertoire, { RepertoireProps } from './components/repertoire/Repertoire';
import { ChildNode, Game, parsePgn, PgnNodeData, walk } from 'chessops/pgn';
import { Color } from 'chessops';
import { countDueContext, generateSubrepertoire } from './spaced-repetition/util';
import { pgn3 } from './debug/pgns';
import { configure, defaults, Config as SrsConfig } from './spaced-repetition/config';
import { initial } from 'chessground/fen';
import { calcTarget, chessgroundToSan, fenToDests, toDestMap } from './util';
import { DrawShape } from 'chessground/draw';
import { MoveMetadata } from 'chessground/types';
import { useAtom } from 'jotai';
import { useTrainerStore } from './state/state';
import { Feedback, FeedbackProps } from './components/Feedback';
import { PgnTree, PgnTreeProps } from './components/PgnTree';
import InsightChart from './components/InsightChart';
import Schedule from './components/Schedule';
import AddToReperotireModal from './components/repertoire/AddToRepertoireModal';
import RepertoireActions from './components/repertoire/RepertoireActions';
import SettingsModal from './components/SettingsModal';
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

  const subrep = () => {
    return repertoire[repertoireIndex]?.subrep;
  };

  //TODO put in util
  const currentTime = (): number => {
    return Math.round(Date.now() / 1000);
  };

  // TODO provide a more detailed breakdown, like when each one is due.
  // TODO combine this with getNext() so we don't need to walk the tree twice

  // walk entire file and describe its state- when moves are due and such
  // store result in `dueTimes` array
  const updateDueCounts = (): void => {
    const current = repertoire[repertoireIndex].subrep;
    const root = current.moves;
    const ctx = countDueContext(0);
    const dueCounts = new Array(1 + srsConfig.buckets!.length).fill(0);

    walk(root, ctx, (ctx, data) => {
      ctx.count++;
      if (!data.training.disabled && data.training.seen) {
        const secondsTilDue = data.training.dueAt - currentTime();
        // console.log('seconds til due', secondsTilDue);
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
    });
    setDueTimes(dueCounts);
  };

  // TODO return trainingPath, then we set it
  const getNext = () => {
    let method = useTrainerStore.getState().trainingMethod;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;
    let repertoire = useTrainerStore.getState().repertoire;

    console.log(repertoireIndex, trainingMethod);
    if (repertoireIndex == -1 || method == 'unselected') return false; // no subrepertoire selected
    console.log('GET NEXT NOW');
    //initialization
    let deque: DequeEntry[] = [];
    console.log('rep index', repertoireIndex);
    let subrep = repertoire[repertoireIndex].subrep;
    console.log('tree', subrep);
    //initialize deque
    for (const child of subrep.moves.children) {
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
      if (!pos.data.training.disabled) {
        switch (method) {
          case 'recall': //recall if due
            if (pos.data.training.dueAt <= currentTime()) {
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
            if (!pos.data.training.seen) {
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
    let trainingPath = useTrainerStore.getState().trainingPath;
    let repertoire = useTrainerStore.getState().repertoire;
    let repertoireIndex = useTrainerStore.getState().repertoireIndex;

    console.log('state', useTrainerStore.getState());

    const node = trainingPath?.at(-1);
    const subrep = repertoire[repertoireIndex].subrep;
    if (!node) return;
    // annotate node
    // node
    // console.log('INDICES' + this.correctMoveIndices);

    switch (trainingMethod) {
      case 'recall':
        setLastResult('succeed');
        let groupIndex = node.data.training.group;
        subrep.meta.bucketEntries[groupIndex]--;
        switch (srsConfig!.promotion) {
          case 'most':
            groupIndex = srsConfig!.buckets!.length - 1;
            break;
          case 'next':
            groupIndex = Math.min(groupIndex + 1, srsConfig!.buckets!.length - 1);
            break;
        }
        subrep.meta.bucketEntries[groupIndex]++;
        const interval = srsConfig!.buckets![groupIndex];

        node.data.training = {
          ...node.data.training,
          group: groupIndex,
          dueAt: currentTime() + interval,
        };
        break;
      case 'learn':
        node.data.training = {
          ...node.data.training,
          seen: true,
          dueAt: currentTime() + srsConfig!.buckets![0],
          group: 0,
        };
        subrep.meta.bucketEntries[0]++; //globally, mark node as seen
        break;
    }
  };

  const fail = () => {
    let node = trainingPath?.at(-1);
    const subrep = repertoire[repertoireIndex].subrep;
    if (!node) return;
    let groupIndex = node.data.training.group;
    subrep.meta.bucketEntries[groupIndex]--;
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
      subrep.meta.bucketEntries[groupIndex]++;
      const interval = srsConfig!.buckets![groupIndex];

      node.data.training = {
        ...node.data.training,
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
    // this.lastGuess = null;
    // this.lastResult = "none";
  };

  const makeGuess = (san: string) => {
    setLastGuess('san');
    console.log('last guess', san);
    const index = repertoireIndex;
    if (index == -1 || !trainingPath || trainingMethod == 'learn') return;
    let candidates: ChildNode<TrainingData>[] = [];
    if (trainingPath.length == 1) {
      repertoire[index].subrep.moves.children.forEach((child) => candidates.push(child));
    } else {
      trainingPath.at(-2)?.children.forEach((child) => candidates.push(child));
    }

    let moves: string[] = [];
    moves = candidates.map((candidate) => candidate.data.san);

    return moves.includes(san)
      ? trainingPath.at(-1)?.data.san === san
        ? 'success'
        : 'alternate'
      : 'failure';
  };

  // TODO better name vs. ctrl.fail()
  const handleFail = (attempt?: string) => {
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
    // console.log('trainingPath in opts from store', trainingPath);
    // console.log('pathIndex in opts', pathIndex);
    // console.log('Make CG OPTS');
    // console.log('trainingPath', trainingPath);

    const fen = trainingPath.at(-2)?.data.fen || initial;

    // get last move, if it exists
    let lastMoves: Key[] = [];
    if (atLast() && trainingPath && trainingPath!.length > 1) {
      const fen2 = trainingPath?.at(-3)?.data.fen || initial;
      const oppMoveSan = trainingPath?.at(-2)?.data.san;
      const uci2 = calcTarget(fen2, oppMoveSan!);
      lastMoves = [uci2[0], uci2[1]];
    }

    const targetSan = trainingPath?.at(-1)?.data.san;
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
      orientation: subrep().meta.trainAs,
      fen: trainingPath[pathIndex]?.data.fen || initial,
      lastMove: lastMoves,
      turnColor: subrep().meta.trainAs,

      movable: {
        free: false,
        color: subrep().meta.trainAs,
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
            console.log('atlast?', atLast());
            if (atLast()) {
              switch (trainingMethod) {
                case 'learn':
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
    resetTrainingContext();
    updateDueCounts();
    repertoire[repertoireIndex].lastDueCount = dueTimes[0];
    setLastFeedback('learn');

    setTrainingMethod('learn');
    console.log('handlelearn --> ', useTrainerStore.getState().trainingMethod);
    // mututes path
    if (!getNext('learn')) {
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
      console.log('real config rn', apiRef.current.state);
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

  const addToRepertoire = (pgn: string, color: Color, name: string) => {
    // TODO why is PGN undefined?
    const subreps: Game<PgnNodeData>[] = parsePgn(pgn);
    subreps.forEach((subrep, i) => {
      //augment subrepertoire with a) color to train as, and b) training data
      const annotatedSubrep: Subrepertoire<TrainingData> = {
        ...subrep,
        ...generateSubrepertoire(subrep.moves, color, srsConfig.buckets!),
      };
      if (i > 0) name += ` (${i + 1})`;
      const entry: RepertoireEntry = {
        subrep: annotatedSubrep,
        name,
        lastDueCount: 0,
      };
      addRepertoireEntry(entry, color);
    });
  };

  const addRepertoireEntry = (entry: RepertoireEntry, color: Color) => {
    // TODO place repertoire correctly
    setRepertoire([...repertoire, entry]);

    // if (color == 'white') {
    //   this.repertoire = [
    //     ...this.repertoire.slice(0, this.numWhiteEntries),
    //     entry,
    //     ...this.repertoire.slice(this.numWhiteEntries),
    //   ];
    //   this.numWhiteEntries++;
    // } else {
    //   this.repertoire.push(entry);
    //   this.numBlackEntries++;
    // }
  };

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
    addToRepertoire(pgn3(), 'white', 'QGD Exchange');
    setRepertoireIndex(0);
    setTrainingMethod('learn');
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
  const repertoireProps: RepertoireProps = {
    repertoire,
    numWhiteEntries,
    setShowingAddToRepertoireMenu,
    repertoireIndex,
  };
  const feedbackProps: FeedbackProps = {
    handleFail,
  };
  const pgnTreeProps: PgnTreeProps = {
    jump,
  };
  return (
    <div id="root" className="w-full h-full">
      <div id="header" className="flex items-end justify-left text-3xl mb-3">
        <img src="logo.png" alt="Logo" className="h-12 w-12" />
        <span>chess</span>
        <span className="text-stone-600">repeat</span>
      </div>
      {/* h('div#body.flex.justify-center.gap-5.items-start.w-full.px-10', [ */}
      {showingAddToRepertoireMenu && <AddToReperotireModal></AddToReperotireModal>}
      {showTrainingSettings && <SettingsModal></SettingsModal>}
      <div className="flex justify-between items-start w-full px-10 gap-5">
        <div className="flex flex-col flex-1">
          <Repertoire {...repertoireProps} />
          {/* <InsightChart /> */}
          <RepertoireActions></RepertoireActions>
          <Schedule />
        </div>
        <div className="flex flex-col items-center flex-1">
          <Chessboard width={550} height={550} config={cbConfig} ref={apiRef} />
          <Controls {...controlsProps} />
        </div>
        <div className="flex flex-col flex-1">
          <PgnTree jump={jump} />
          <Feedback {...feedbackProps} />
        </div>
      </div>
    </div>
  );
};
export default ChessOpeningTrainer;
