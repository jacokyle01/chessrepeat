//TODO better solution for syncing chessground state w/ react store state

import React, { useState } from 'react';
import { Chessground } from './components/Chessground';
import Controls from './components/Controls';

import { useEffect, useRef } from 'react';
import Repertoire from './components/repertoire/Repertoire';
import { ChildNode } from 'chessops/pgn';
import { Chess } from 'chessops';
import { chessgroundMove } from 'chessops/compat';
import { initial } from 'chessground/fen';
import { DrawShape } from 'chessground/draw';
import { Key, MoveMetadata } from 'chessground/types';
import { useTrainerStore } from './state/state';
import { UserTip } from './components/UserTip';
import Schedule from './components/Schedule';
import AddToRepertoireModal from './components/modals/AddToRepertoireModal';
import RepertoireActions from './components/repertoire/RepertoireActions';
import PgnControls from './components/pgn/PgnControls';
import PgnTree from './components/pgn/PgnTree';
import { parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { MantineProvider } from '@mantine/core';
import { formatTime } from './util/time';
import Explorer from './components/Explorer';
import { CommentBox } from './components/CommentBox';
import { CopyFen } from './components/CopyFen';
import { SiDiscord, SiGithub } from 'react-icons/si';
import { Bug, Mail, User, UserX } from 'lucide-react';
import {
  calcTarget,
  chessgroundToSan,
  fenToDests,
  isPromotionMove,
  positionFromFen,
  promotionColorFromFen,
  toDestMap,
} from './util/chess';
import { getNodeList } from './util/tree';
import { PendingPromotion } from './types/types';
import { PromoRole, PromotionOverlay } from './components/PromotionOverlay';
import { ProfileButton } from './components/ProfileButton';
import { useAuthStore } from './state/auth';

//TODO better sound handling, separate sound for check?
const SOUNDS = {
  move: new Audio('/sound/public_sound_standard_Move.mp3'),
  capture: new Audio('/sound/public_sound_standard_Capture.mp3'),
};
export const Chessrepeat = () => {
  const {
    setNextTrainablePosition,
    showingAddToRepertoireMenu,
    setShowingAddToRepertoireMenu,

    repertoire,
    setRepertoire,
    repertoireIndex,

    showingHint,
    userTip,
    setUserTip,
    setLastGuess,

    selectedNode,
    selectedPath,

    trainingMethod,

    updateDueCounts,

    succeed,
    guess,
    makeMove,
    hydrateRepertoireFromIDB,
    fail,
  } = useTrainerStore();


  // hydrate repertoire from IDB
  useEffect(() => {
    console.log('test');
    hydrateRepertoireFromIDB();
  }, []);

  // hydrate token
  const hydrate = useAuthStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const user = useAuthStore((s) => s.user);
  const isAuthed = useAuthStore((s) => s.isAuthenticated());

  const [sounds, setSounds] = useState(SOUNDS);
  const [activeMoveId, setActiveMoveId] = useState();

  const movesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = movesContainerRef.current;
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

  const [pendingPromo, setPendingPromo] = useState<PendingPromotion | null>(null);

  // TODO dont store this directly. .
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const closePromo = () => setPendingPromo(null);

  //TODO move to state.ts
  const deleteChapter = (index) => {
    setRepertoire([...repertoire.slice(0, index), ...repertoire.slice(index + 1)]);
  };

  const renameChapter = (index, name) => {
    repertoire[index].name = name;
  };

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
    // if (userTip == 'fail') return new Map();
    if ((trainingMethod == 'learn' || userTip == 'fail') && isAtLast) {
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
    // console.log('lastNode', lastNode, 'before that', lastlastNode);

    const fen = lastlastNode.data.fen;
    const setup = parseFen(fen);
    if (!setup.isOk) throw new Error('Invalid FEN: ' + fen);

    let pos = Chess.fromSetup(setup.value).unwrap();
    // console.log('pos', pos);
    const move = parseSan(pos, lastNode.data.san);
    // console.log('move', move);
    // return [move.from, move.to];
    return chessgroundMove(move);
  };

  const atLast = (): boolean => {
    const trainableContext = useTrainerStore.getState().trainableContext;
    if (!trainableContext) return false;
    const selectedPath = useTrainerStore.getState().selectedPath;
    const trainingPath = useTrainerStore.getState().trainableContext?.startingPath;

    return selectedPath == trainingPath;
  };

  const prevMove = prevMoveIfExists();
  const lastMove = selectedNode ? prevMove : undefined;

  const finishMove = (san: string, meta: MoveMetadata, to: Key) => {
    if (!isEditing) {
      meta.captured ? sounds.capture.play().catch(console.error) : sounds.move.play().catch(console.error);

      if (atLast()) {
        updateDueCounts();
        switch (trainingMethod) {
          case 'learn':
            succeed();
            setNextTrainablePosition();
            break;
          case 'recall':
            if (userTip == 'fail') {
              fail();
              setNextTrainablePosition();
              return;
            }
            setLastGuess(san);
            switch (guess(san)) {
              case 'success': {
                const secsUntilDue = succeed();
                showBoxAtSquare(to, secsUntilDue);
                setNextTrainablePosition();
                break;
              }
              case 'alternate':
                setUserTip('alternate');
                break;
              case 'failure':
                setUserTip('fail');
                break;
            }
            break;
        }
      }
    } else {
      makeMove(san);
    }
  };

  const onAfterMove = (from: Key, to: Key, meta: MoveMetadata) => {
    const fenBefore = selectedNode?.data.fen || initial;
    console.log('fenBefore, from, to', fenBefore, from, to);

    // If a promo is already open, ignore additional moves (defensive)
    if (pendingPromo) return;

    // Detect promotion and pause
    console.log('meta', meta);
    if (isPromotionMove(fenBefore, from, to)) {
      console.log('promotion move');
      // Lichess-like: ctrlKey forces choice; otherwise you can auto-queen.
      setPendingPromo({ from, to, meta, fenBefore });
      return;
    }

    // Normal move
    const san = chessgroundToSan(fenBefore, from, to);
    finishMove(san, meta, to);
    updateDueCounts();
  };

  //TODO dont try to calculate properties when we haven't initialized the repertoire yet
  return (
    <MantineProvider>
      <div id="root" className="w-full h-dvh min-h-0 flex flex-col bg-gray-200">
        <div id="header" className="flex items-end justify-start text-3xl mb-3 gap-10">
          {/* Logo + Title */}
          <div className="flex items-end">
            <img src="logo.png" alt="Logo" className="h-12 w-12 mr-2" />
            <span>chess</span>
            <span className="text-stone-600">repeat</span>
          </div>

          <div className="flex items-end w-full text-gray-500 ml-10">
            <div className="flex items-end gap-10">
              {/* Discord */}
              <a
                href="https://discord.gg/xhjra9W6Bh"
                target="_blank"
                rel="noopener noreferrer"
                title="Join our Discord"
                className="flex items-end gap-1 text-base hover:text-black transition"
              >
                <span>join discord</span>
                <SiDiscord className="w-5 h-5" />
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/jacokyle01/chessrepeat"
                target="_blank"
                rel="noopener noreferrer"
                title="View on GitHub"
                className="flex items-end gap-1 text-base hover:text-black transition"
              >
                <span>view github</span>
                <SiGithub className="w-5 h-5" />
              </a>

              {/* Bug report */}
              <a
                href="mailto:jacokyle01@gmail.com?subject=Bug Report | chessrepeat"
                title="Report a Bug"
                className="flex items-end gap-1 text-base hover:text-black transition"
              >
                <span>report bug</span>
                <Bug className="w-5 h-5" />
              </a>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            <ProfileButton />
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
        <div className="flex justify-between items-start w-full px-10 gap-5 flex-1 min-h-0 overflow-hidden">
          <div className="repertoire-wrap flex flex-col w-1/3 h-full min-h-0 overflow-hidden flex-1">
            <Repertoire deleteChapter={deleteChapter} renameChapter={renameChapter} />
            <RepertoireActions></RepertoireActions>
            <Schedule />
          </div>
          <div className="game-wrap flex flex-col items-between flex-1 h-dvh">
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
                    after: onAfterMove,
                  },
                }}
                drawable={{ autoShapes: createShapes() }}
              />
              {pendingPromo && (
                <PromotionOverlay
                  dest={pendingPromo.to}
                  color={promotionColorFromFen(pendingPromo.fenBefore)}
                  orientation={chapter?.trainAs || 'white'}
                  onCancel={closePromo}
                  onPick={(role: PromoRole) => {
                    const { fenBefore, from, to, meta } = pendingPromo;
                    closePromo();
                    const san = chessgroundToSan(fenBefore, from, to, role);
                    finishMove(san, meta, to);
                  }}
                />
              )}
            </div>

            <Controls />
            <CommentBox />
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
