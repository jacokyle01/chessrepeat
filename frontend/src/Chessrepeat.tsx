//TODO better solution for syncing chessground state w/ react store state

import React, { useState } from 'react';
import { Chessground } from './components/Chessground';
import Controls from './components/TrainingControls';
import MobileCommentPopout from './components/MobileCommentPopout';

import { useCallback, useEffect, useRef } from 'react';
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
  Check,
  ClipboardCheck,
  ClipboardCopy,
  FileIcon,
  FolderCog2Icon,
  GraduationCap,
  History,
  MessageSquareOff,
  MessageSquareText,
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
import './css/chessrepeat.css';
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

// The progress segments and the "+time" reward are positioned from live data,
// which CSS can't derive on its own. Both hand the value over as a custom
// property so the actual declarations stay in chessrepeat.css.
const segmentWidth = (ratio: number): React.CSSProperties =>
  ({ '--segment-width': `${ratio * 100}%` }) as React.CSSProperties;

const rewardPosition = (x: number, y: number): React.CSSProperties =>
  ({ '--reward-x': `${x - 5}px`, '--reward-y': `${y - 25}px` }) as React.CSSProperties;

// The hover pie shares the bar's split, so it takes the same two ratios and
// hands over the angles where each slice ends; whatever is left of the circle
// is the "known" remainder.
const pieSlices = (unseenRatio: number, dueRatio: number): React.CSSProperties =>
  ({
    '--unseen-end': `${unseenRatio * 360}deg`,
    '--due-end': `${(unseenRatio + dueRatio) * 360}deg`,
  }) as React.CSSProperties;

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
  const [showComments, setShowComments] = useState(true);
  const movesContainerRef = useRef<HTMLDivElement>(null);

  const scrollActiveIntoView = useCallback(() => {
    const activeEl = movesContainerRef.current?.querySelector('.active') as HTMLElement | null;
    if (!activeEl) return;

    activeEl.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, []);

  // Hiding or showing comments reflows the whole tree without changing any
  // move's class, so the observer below never fires — bring the selected move
  // back on screen by hand, a frame later so the new layout has settled.
  useEffect(() => {
    const frame = requestAnimationFrame(scrollActiveIntoView);
    return () => cancelAnimationFrame(frame);
  }, [showComments, scrollActiveIntoView]);

  //TODO this can be a useEffect in PGNtree. when current move changes, adjust view
  useEffect(() => {
    const container = movesContainerRef.current;
    if (!container) return;

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
  }, [scrollActiveIntoView]);

  const [pendingPromo, setPendingPromo] = useState<PendingPromotion | null>(null);

  const closePromo = () => setPendingPromo(null);

  // TODO should be in different component?
  const chapter = repertoire.find((c) => c.uuid === selectedChapterId);
  const isEditing = trainingMethod == 'edit';

  // whatever the bar leaves uncoloured: seen moves that aren't due yet
  const knownCount = chapter
    ? Math.max(0, chapter.enabledCount - chapter.unseenCount - chapter.lastDueCount)
    : 0;

  // automatically select root node of chapter. fires on chapter change or page reload.
  useEffect(() => {
    if (chapter?.root) setSelectedNode(chapter.root);
  }, [chapter?.root]);

  const [chessPosition, error] = positionFromFen(selectedNode?.data.fen || initial);
  const turn = chessPosition?.turn || 'white';
  /*
  The current move we're training
  */

  //TODO Fix logic here..
  const targetDest = (): Key[] => {
    console.log('SELECTED NODE', selectedNode);
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
  /* Chessground publishes the board's *rendered* width here (it floors the
     board to a whole number of 8 device pixels), so the progress bar can
     match the board's right edge instead of the card's. */
  const boardCardRef = useRef<HTMLDivElement>(null);
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
                // null when the move was deleted under us (train resynced instead)
                if (secsUntilDue != null) showBoxAtSquare(to, secsUntilDue);
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

  const onAfterMove = async (from: Key, to: Key, meta: MoveMetadata) => {
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
    await finishMove(san, meta, to);
    updateDueCounts();
  };

  //TODO dont try to calculate properties when we haven't initialized the repertoire yet
  return (
    <MantineProvider>
      {/* <Debug /> */}
      <div className="app-root">
        <Header connectedUsers={connectedUsers} incomingCollaboratorsCount={incomingCollaborators.length} />

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
            <div className="board-card" ref={boardCardRef}>
              {chapter && chapter.enabledCount > 0 && (
                <div className="board-progress">
                  <div className="board-progress-bar">
                    <div
                      className="board-progress-unseen"
                      style={segmentWidth(chapter.unseenCount / chapter.enabledCount)}
                    />
                    <div
                      className="board-progress-due"
                      style={segmentWidth(chapter.lastDueCount / chapter.enabledCount)}
                    />
                  </div>

                  {/* Breakdown tooltip on hover: the same split as the bar, as a
                      pie over the chapter's total, with the counts beside it. */}
                  <div className="board-progress-tooltip">
                    <div
                      className="board-progress-pie"
                      style={pieSlices(
                        chapter.unseenCount / chapter.enabledCount,
                        chapter.lastDueCount / chapter.enabledCount,
                      )}
                    />
                    <table>
                      <tbody>
                        <tr>
                          <td className="cell-icon cell-icon-learn">
                            <GraduationCap size={14} />
                          </td>
                          <td className="cell-label">To Learn</td>
                          <td className="cell-count">{chapter.unseenCount}</td>
                          <td className="cell-percent">
                            {Math.round((chapter.unseenCount / chapter.enabledCount) * 100)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="cell-icon cell-icon-due">
                            <History size={14} />
                          </td>
                          <td className="cell-label">Due Now</td>
                          <td className="cell-count">{chapter.lastDueCount}</td>
                          <td className="cell-percent">
                            {Math.round((chapter.lastDueCount / chapter.enabledCount) * 100)}%
                          </td>
                        </tr>
                        <tr>
                          <td className="cell-icon cell-icon-known">
                            <Check size={14} />
                          </td>
                          <td className="cell-label">Known</td>
                          <td className="cell-count">{knownCount}</td>
                          <td className="cell-percent">
                            {Math.round((knownCount / chapter.enabledCount) * 100)}%
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div ref={containerRef}>
                <Chessground
                  dimensionsRef={boardCardRef}
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
              <div className="controls-group">
                <Controls />
              </div>
              <MobileCommentPopout />
              <div className="control-tab">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="control-tab-btn settings-btn"
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
              <div
                className="modal-backdrop modal-backdrop-settings"
                onClick={() => setSettingsOpen(false)}
              />
              <SettingsModal setSettingsOpen={setSettingsOpen} />
            </>
          )}

          {/* USER TIP / EXPLORER */}
          <div className="area-usertip">
            <UserTip />
          </div>

          {/* PGN TREE */}
          <div className="area-pgn">
            <div className="pgn-card" ref={movesContainerRef}>
              {/* Header + tree: hidden on mobile during learn/recall */}
              <div className={`pgn-panel-body ${isTraining ? 'is-training-hidden' : ''}`}>
                <div className="panel-header">
                  <div className="panel-icon">
                    <FileIcon />
                  </div>
                  <div className="panel-titles">
                    <span className="panel-title">Chapter</span>
                    <span className="panel-subtitle">
                      {chapter?.enabledCount ?? 0} move{chapter?.enabledCount === 1 ? '' : 's'}
                    </span>
                  </div>
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
                    className={`copy-fen-btn ${fenCopied ? 'is-copied' : ''}`}
                    aria-label="Copy FEN"
                    title="Copy FEN"
                  >
                    {fenCopied ? <ClipboardCheck /> : <ClipboardCopy />}
                    <span>copy fen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComments((v) => !v)}
                    className="toggle-comments-btn"
                    aria-pressed={!showComments}
                    aria-label={showComments ? 'Hide comments' : 'Show comments'}
                    title={showComments ? 'Hide comments' : 'Show comments'}
                  >
                    {showComments ? <MessageSquareOff /> : <MessageSquareText />}
                    <span>{showComments ? 'hide comments' : 'show comments'}</span>
                  </button>
                </div>
                <div className="pgn-tree-scroll">
                  <PgnTree setActiveMoveId={setActiveMoveId} showComments={showComments} />
                </div>
              </div>
            </div>
            {/* Move navigation sits below the card, centered under it. */}
            <div className="pgn-controls-bar">
              <PgnControls />
            </div>
          </div>

          {/* SIDEBAR (repertoire + memory schedule) */}
          <div className="area-sidebar">
            <div className="area-repertoire">
              <Repertoire onOpenCollaborators={() => setCollaboratorsOpen(true)} />
            </div>

            <div className="area-schedule">
              <Schedule />
            </div>
          </div>
        </div>
      </div>

      {/* +time overlay */}
      {box && trainingMethod === 'recall' && (
        <div className="time-reward" style={rewardPosition(box.x, box.y)}>
          <div className="time-reward-label">+{box.time}</div>
        </div>
      )}
    </MantineProvider>
  );
};

export default Chessrepeat;