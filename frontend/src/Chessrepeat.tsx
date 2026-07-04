//TODO better solution for syncing chessground state w/ react store state

import React, { useState } from 'react';
import { Chessground } from './components/Chessground';
import Controls from './components/TrainingControls';
import MobileCommentPopout from './components/MobileCommentPopout';

import { useEffect, useRef } from 'react';
import Repertoire from './components/repertoire/Repertoire';
import { ChildNode } from 'chessops/pgn';
import { Chess } from 'chessops';
import { chessgroundMove } from 'chessops/compat';
import { initial } from 'chessground/fen';
import { DrawShape } from 'chessground/draw';
import { Key, MoveMetadata } from 'chessground/types';
import { useTrainerStore } from './store/state';
import { UserTip } from './components/UserTip';
import Schedule from './components/MemorySchedule';
import AddToRepertoireModal from './components/modals/AddToRepertoireModal';
import PgnControls from './components/pgn/TreeControls';
import PgnTree from './components/pgn/Tree';
import { INITIAL_BOARD_FEN, parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { MantineProvider } from '@mantine/core';
import { formatTime } from './util/time';
import {
  ClipboardCheck,
  ClipboardCopy,
  FileIcon,
  FolderCog2Icon,
  GraduationCap,
  History,
  NetworkIcon,
} from 'lucide-react';
import SettingsModal from './components/modals/SettingsModal';
import { Header } from './components/Header';
import { CollaboratorsPanel } from './components/collaborators/CollaboratorsPanel';
import {
  addCollaborator as addCollaboratorService,
  fetchIncomingCollaborators,
  fetchOutgoingCollaborators,
  removeCollaborator as removeCollaboratorService,
  viewUserRepertoire,
  type Collaborator,
} from './services/collaborators';
import { useAuthStore } from './store/auth';
import {
  calcTarget,
  castlingKingTwoSquare,
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
import './css/layout.css';
import { Debug } from './components/Debug';
import { useWebsocket } from './hooks/useWebsocket';
import { useStartup } from './hooks/useStartup';

//TODO we should use chessops library to get promotion role instead of regex..
// unclear if trainingContext stores enough state to get promotion role dynamically
// can optionally store promotion target in trainingContext as its calculated in getNextTrainablePosition..?
// most drastically, can refactor what is stored in targetPath!

function promoRoleFromSan(san?: string): PromoRole | undefined {
  if (!san) return undefined;
  const m = san.match(/=([QRBN])/);
  if (!m) return undefined;
  const map: Record<string, PromoRole> = { Q: 'queen', R: 'rook', B: 'bishop', N: 'knight' };
  return map[m[1]];
}

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
    selectedChapterId,

    showingHint,
    userTip,
    setUserTip,
    setLastGuess,

    selectedNode,
    selectedPath,
    setSelectedNode,

    trainingMethod,

    updateDueCounts,
    learn,
    train,

    guess,
    makeMove,
  } = useTrainerStore();

  const connectedUsers = useTrainerStore((s) => s.connectedUsers);
  const authUsername = useAuthStore((s) => s.user?.username);

  // Bootstraps /repertoire, owns the WebSocket, and re-fetches on
  // repertoireOwner changes. Replaces the previous /me + URL-param flow.
  useStartup();
  useWebsocket();

  const [collaboratorsOpen, setCollaboratorsOpen] = useState(false);
  const [outgoingCollaborators, setOutgoingCollaborators] = useState<Collaborator[]>([]);
  const [incomingCollaborators, setIncomingCollaborators] = useState<Collaborator[]>([]);

  // Refresh both lists when signed in / on panel open.
  useEffect(() => {
    if (!authUsername) {
      setOutgoingCollaborators([]);
      setIncomingCollaborators([]);
      return;
    }
    void (async () => {
      const [outgoing, incoming] = await Promise.all([
        fetchOutgoingCollaborators(),
        fetchIncomingCollaborators(),
      ]);
      setOutgoingCollaborators(outgoing);
      setIncomingCollaborators(incoming);
    })();
  }, [authUsername, collaboratorsOpen]);

  const handleAddCollaborator = async (username: string, permission: 'edit' | 'train') => {
    const result = await addCollaboratorService(username, permission);
    if (result.ok && result.collaborator) {
      setOutgoingCollaborators((prev) =>
        prev.some((c) => c.username === result.collaborator!.username)
          ? prev
          : [result.collaborator!, ...prev],
      );
    }
    return { ok: result.ok, error: result.error };
  };

  const handleRemoveCollaborator = async (username: string) => {
    setOutgoingCollaborators((prev) => prev.filter((c) => c.username !== username));
    await removeCollaboratorService(username);
  };

  const handleViewRepertoire = async (username: string) => {
    setCollaboratorsOpen(false);
    await viewUserRepertoire(username);
  };

  const isTraining = trainingMethod === 'learn' || trainingMethod === 'recall';

  const [sounds, setSounds] = useState(SOUNDS);
  const [activeMoveId, setActiveMoveId] = useState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fenCopied, setFenCopied] = useState(false);
  const movesContainerRef = useRef<HTMLDivElement>(null);

  //TODO this can be a useEffect in PGNtree. when current move changes, adjust view
  useEffect(() => {
    const container = movesContainerRef.current;
    if (!container) return;

    const scrollActiveIntoView = () => {
      const activeEl = container.querySelector('.active') as HTMLElement | null;
      if (!activeEl) return;

      activeEl.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    };

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

  const closePromo = () => setPendingPromo(null);

  // TODO should be in different component?
  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
  const isEditing = trainingMethod == 'edit';

  // automatically select root node of chapter. fires on chapter change or page reload.
  useEffect(() => {
    if (chapter?.root) setSelectedNode(chapter.root);
  }, [chapter?.root]);

  //TODO hints
  //TODO fail

  const [chessPosition, error] = positionFromFen(selectedNode?.data.fen || initial);
  const turn = chessPosition?.turn || 'white';
  /*
  The current move we're training
  */

  //TODO Fix logic here..  
  const targetDest = (): Key[] => {
    // console.log("selectedNode fen", selectedNode?.data.fen)
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
  //TODO should be in util file
  const calculateDests = () => {
    const isAtLast = atLast();
    // don't allow moves if user isn't on trainable move
    if (trainingMethod != 'edit' && !isAtLast) return new Map();
    // don't allow moves immediately after recall fail
    // if (userTip == 'fail') return new Map();
    // TODO fix. this is supposed to be just the move we're looking to see, e.x. for learning or correcting on fail
    if ((trainingMethod == 'learn' || userTip == 'fail') && isAtLast) {
      const uci = targetDest();
      // calcTarget returns castling as king→rook (e1h1, e1a1). Most
      // chess UIs also accept king→two-squares (e1g1, e1c1), so when
      // the target is a castle, include both as valid drop squares.
      const fen = selectedNode?.data.fen || initial;
      const kingTwo = castlingKingTwoSquare(fen, uci[0], uci[1]);
      if (kingTwo) {
        return new Map([[uci[0], [uci[1], kingTwo]]]);
      }
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
    const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
    if (!chapter || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const coords = squareToCoords(square, bounds, chapter.trainAs);

    // store coordinates relative to container
    const formattedTime = formatTime(time);
    setBox({ x: coords.x, y: coords.y, time: formattedTime });
    setTimeout(() => setBox(null), 1000);
  };

  //TODO refactor common logic here
  const prevMoveIfExists = () => {
    const { repertoire, selectedChapterId } = useTrainerStore.getState();

    const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
    if (!chapter) return undefined;
    const root = chapter.root;
    const nodeList = getNodeList(root, selectedPath);
    const lastNode = nodeList.at(-1);
    const lastlastNode = nodeList.at(-2);
    if (!lastNode || !lastlastNode) return undefined;

    const fen = lastlastNode.data.fen;
    const setup = parseFen(fen);
    if (!setup.isOk) throw new Error('Invalid FEN: ' + fen);

    let pos = Chess.fromSetup(setup.value).unwrap();
    const move = parseSan(pos, lastNode.data.san);
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
            learn();
            setNextTrainablePosition();
            break;
          case 'recall':
            if (userTip == 'fail') {
              train(false);
              setNextTrainablePosition();
              return;
            }
            setLastGuess(san);
            switch (guess(san)) {
              case 'success': {
                const secsUntilDue = train(true);
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

    // If a promo is already open, ignore additional moves (defensive)
    if (pendingPromo) return;

    // Detect promotion and pause
    if (isPromotionMove(fenBefore, from, to)) {
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
      {/* <Debug /> */}
      <div className="app-root">
        <Header
          connectedUsers={connectedUsers}
          incomingCollaboratorsCount={incomingCollaborators.length}
          onOpenCollaborators={() => setCollaboratorsOpen(true)}
        />

        {showingAddToRepertoireMenu && (
          <>
            <div className="modal-backdrop" onClick={() => setShowingAddToRepertoireMenu(false)} />
            <AddToRepertoireModal />
          </>
        )}

        <CollaboratorsPanel
          open={collaboratorsOpen}
          onClose={() => setCollaboratorsOpen(false)}
          outgoing={outgoingCollaborators}
          incoming={incomingCollaborators}
          onAdd={handleAddCollaborator}
          onRemove={handleRemoveCollaborator}
          onViewRepertoire={handleViewRepertoire}
        />

        <div className="app-main">
          {/* BOARD */}
          <div className="area-board" id="board-wrap">
            <div className="board-card">
            {chapter && chapter.enabledCount > 0 && (
              <div className="group relative">
                <div className="flex h-2 w-full overflow-hidden rounded-md bg-gray-200 cursor-default">
                  <div
                    className="h-full bg-brand-blue-light"
                    style={{ width: `${(chapter.unseenCount / chapter.enabledCount) * 100}%` }}
                  />
                  <div
                    className="h-full bg-brand-blue"
                    style={{ width: `${(chapter.lastDueCount / chapter.enabledCount) * 100}%` }}
                  />
                </div>

                {/* Breakdown tooltip on hover */}
                <div
                  className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2
                    whitespace-nowrap rounded-md border border-gray-200 bg-white px-3 py-2 text-xs
                    text-gray-700 shadow-lg opacity-0 transition-opacity duration-150
                    group-hover:opacity-100"
                >
                  <div className="flex items-center gap-2 py-0.5">
                    <GraduationCap size={14} className="text-sky-700" />
                    <span className="flex-1">To learn</span>
                    <span className="font-mono font-semibold">{chapter.unseenCount}</span>
                  </div>
                  <div className="flex items-center gap-2 py-0.5">
                    <History size={14} className="text-blue-800" />
                    <span className="flex-1">Due</span>
                    <span className="font-mono font-semibold">{chapter.lastDueCount}</span>
                  </div>
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gray-200" />
                    <span className="flex-1">Learned</span>
                    <span className="font-mono font-semibold">
                      {chapter.enabledCount - chapter.unseenCount - chapter.lastDueCount}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 border-t border-gray-100 pt-1">
                    <span className="flex-1 font-semibold">Total</span>
                    <span className="font-mono font-semibold">{chapter.enabledCount}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={containerRef}>
              <Chessground
                orientation={chapter?.trainAs || 'white'}
                fen={selectedNode?.data.fen || initial}
                turnColor={turn}
                lastMove={lastMove}
                movable={{
                  free: false,
                  color: turn,
                  dests: calculateDests(),
                  events: { after: onAfterMove },
                }}
                drawable={{ autoShapes: createShapes() }}
              />
              {pendingPromo && (
                <PromotionOverlay
                  dest={pendingPromo.to}
                  color={promotionColorFromFen(pendingPromo.fenBefore)}
                  orientation={chapter?.trainAs || 'white'}
                  onCancel={closePromo}
                  requiredRole={
                    trainingMethod === 'learn'
                      ? promoRoleFromSan(useTrainerStore.getState().trainableContext?.targetMove?.data?.san)
                      : undefined
                  }
                  onPick={(role: PromoRole) => {
                    const { fenBefore, from, to, meta } = pendingPromo;
                    closePromo();
                    const san = chessgroundToSan(fenBefore, from, to, role);
                    finishMove(san, meta, to);
                  }}
                />
              )}
            </div>
            </div>

            {/* CONTROLS — part of the same board panel, always directly
                beneath the board (single grid area). */}
            <div className="area-controls">
              <div className="flex items-start gap-1">
                <Controls />
              </div>
              <MobileCommentPopout />
              <div className="inline-flex rounded-b-xl bg-white shadow-md p-1">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                    transition-all duration-200 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                  aria-label="Settings"
                  title="Settings"
                >
                  <FolderCog2Icon size={18} />
                </button>
              </div>
            </div>
          </div>

          {settingsOpen && (
            <>
              <div className="modal-backdrop" style={{ zIndex: 40 }} onClick={() => setSettingsOpen(false)} />
              <SettingsModal setSettingsOpen={setSettingsOpen} />
            </>
          )}

          {/* USER TIP / EXPLORER */}
          <div className="area-usertip">
            <UserTip />
          </div>

          {/* PGN TREE */}
          <div className="area-pgn shadow-md" ref={movesContainerRef}>
            {/* Header + tree: hidden on mobile during learn/recall */}
            <div
              className={`flex flex-col min-h-0 flex-1 overflow-hidden ${isTraining ? 'hidden md:flex' : ''}`}
            >
              <div id="repertoire-header" className="shrink-0 flex flex-row items-center p-3 gap-2">
                <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
                  <FileIcon className="w-5 h-5" />
                </div>
                <span className="text-gray-800 font-semibold text-lg">Chapter</span>
                {/* copy icon */}
                <button
                  type="button"
                  onClick={async () => {
                    const fen = selectedNode?.data.fen || INITIAL_BOARD_FEN;
                    if (!fen) return;
                    await navigator.clipboard.writeText(fen);
                    setFenCopied(true);
                    setTimeout(() => setFenCopied(false), 1200);
                  }}
                  className={`ml-auto p-1.5 rounded-md transition flex gap-1 text-sm items-end ${
                    fenCopied
                      ? 'bg-white text-green-600'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-gray-100'
                  }`}
                  aria-label="Copy FEN"
                  title="Copy FEN"
                >
                  <span>copy fen</span>
                  {fenCopied ? <ClipboardCheck className="w-5 h-5" /> : <ClipboardCopy className="w-5 h-5" />}
                </button>
              </div>
              <div className="pgn-tree-scroll">
                <PgnTree setActiveMoveId={setActiveMoveId} />
              </div>
            </div>
            {/* Controls + comment: mobile only during learn/recall */}
            <div className="pgn-controls-bar">
              <PgnControls />
            </div>
          </div>

          {/* SIDEBAR (repertoire + memory schedule) */}
          <div className="area-sidebar">
            <div className="area-repertoire">
              <Repertoire />
            </div>

            <div className="area-schedule">
              <Schedule />
            </div>
          </div>
        </div>
      </div>

      {/* +time overlay */}
      {box && trainingMethod === 'recall' && (
        <div
          style={{
            position: 'absolute',
            left: `${box.x - 5}px`,
            top: `${box.y - 25}px`,
            pointerEvents: 'none',
            transition: 'opacity 300ms ease',
            zIndex: 10,
            transform: 'rotate(45deg)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              fontStyle: 'italic',
              color: '#111',
              padding: '2px 6px',
              border: 'rgba(255,255,255,0.2)',
              whiteSpace: 'nowrap',
              letterSpacing: '0.5px',
              background: 'rgba(255,255,255,0.2)',
            }}
          >
            +{box.time}
          </div>
        </div>
      )}
    </MantineProvider>
  );
};

export default Chessrepeat;
