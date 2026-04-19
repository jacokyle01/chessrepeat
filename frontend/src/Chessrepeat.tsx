//TODO better solution for syncing chessground state w/ react store state

import React, { useState } from 'react';
import { Chessground } from './components/Chessground';
import Controls from './components/TrainingControls';

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
import Schedule from './components/MemorySchedule';
import AddToRepertoireModal from './components/modals/AddToRepertoireModal';
import RepertoireActions from './components/repertoire/RepertoireActions';
import PgnControls from './components/pgn/PgnControls';
import PgnTree from './components/pgn/PgnTree';
import { INITIAL_BOARD_FEN, parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { MantineProvider } from '@mantine/core';
import { formatTime } from './util/time';
import { SiDiscord, SiGithub } from 'react-icons/si';
import {
  Bug,
  ClipboardCheck,
  ClipboardCopy,
  FolderCog2Icon,
  LogIn,
  LogOut,
  Mail,
  NetworkIcon,
  User,
  UserX,
} from 'lucide-react';
import SettingsModal from './components/modals/SettingsModal';
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
import { useAuthStore } from './state/auth';
import { GoogleLoginButton, applyLoginResponse } from './components/GoogleLoginButton';
import { useNavigate, useParams } from 'react-router-dom';
import './css/layout.css';
import { Debug } from './components/Debug';
import { MigrationModal } from './components/modals/MigrationModal';

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
    repertoireIndex,

    showingHint,
    userTip,
    setUserTip,
    setLastGuess,

    selectedNode,
    selectedPath,

    trainingMethod,

    updateDueCounts,
    learn,
    train,

    guess,
    makeMove,
    hydrateRepertoireFromIDB,
    addMove,
    addNewChapterLocally,
    deleteNodeRemote,
    disableNodeRemote,
    enableNodeRemote,
    updateTrainingRemote,

    setWebSocket,
    setConnectedUsers,
    addConnectedUser,
    removeConnectedUser,
  } = useTrainerStore();

  const connectedUsers = useTrainerStore((s) => s.connectedUsers);
  const authUser = useAuthStore((s) => s.user);
  const repertoireId = useAuthStore((s) => s.repertoireId);
  const setUser = useAuthStore((s) => s.setUser);
  const setRepertoireId = useAuthStore((s) => s.setRepertoireId);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const { username: viewedUsername } = useParams<{ username?: string }>();
  const navigate = useNavigate();

  // auto-login. The URL (/@/:username) is the source of truth for which
  // repertoire to load — router handles that. This effect just resolves
  // the session: hydrate auth state from /me, or fall back to IDB for
  // anonymous/playground users. On successful /me with no username in the
  // URL, redirect to the user's own /@/{username}.
  useEffect(() => {
    // The real session cookie is HttpOnly, but the backend also sets a
    // JS-readable hint cookie at login. If it's absent we know we're not
    // logged in and can skip the /me round-trip entirely.
    const hasSessionHint = document.cookie
      .split('; ')
      .some((c) => c.startsWith('chessrepeat_has_session='));

    let cancelled = false;
    (async () => {
      if (!hasSessionHint) {
        await hydrateRepertoireFromIDB();
        return;
      }
      try {
        const res = await fetch('http://localhost:8080/me', {
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) {
          // Not authenticated — enter playground mode, hydrate from IDB
          await hydrateRepertoireFromIDB();
          return;
        }
        const data = await res.json();
        setUser({
          sub: data.user.tokenId,
          username: data.user.username,
          email: data.user.email,
          picture: data.user.picture,
        });
        // if URL isn't a /@/{username} route, default to the user's own
        // repertoire so their link is shareable.

        //TODO why is this here? 
        if (!viewedUsername && data.user?.username) {
          navigate(`/@/${data.user.username}`, { replace: true });
        }
      } catch (err) {
        console.warn('auto-login failed', err);
        // Network error — fall back to playground mode
        if (!cancelled) await hydrateRepertoireFromIDB();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // once we know which username we're viewing (from the URL), resolve it to
  // the owner's repertoire + chapters. The repertoire id comes back here so
  // postChapter can tag its WebSocket messages with the owning repertoire.

  // TODO can be hook 
  useEffect(() => {
    if (!viewedUsername) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`http://localhost:8080/u/${viewedUsername}`, {
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) {
          console.error('failed to load user repertoire', res.status);
          return;
        }
        const data = await res.json();
        if (data.repertoire?.id) setRepertoireId(data.repertoire.id);
        const chapters = (data.chapters ?? []).map((c: any) => ({
          uuid: c.uuid,
          name: c.name,
          trainAs: c.trainAs,
          root: c.root,
          enabledCount: c.enabledCount,
          unseenCount: c.unseenCount,
          lastDueCount: 0,
        }));
        void setRepertoire(chapters);
      } catch (err) {
        console.error('repertoire fetch failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewedUsername]);

  const isTraining = trainingMethod === 'learn' || trainingMethod === 'recall';

  const [sounds, setSounds] = useState(SOUNDS);
  const [activeMoveId, setActiveMoveId] = useState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fenCopied, setFenCopied] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<{
    idToken: string;
    hasPlaygroundData: boolean;
  } | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');

  const movesContainerRef = useRef<HTMLDivElement>(null);

  /*
    Create websocket to send and receive moves.
    Only open once we have an authenticated user — the backend rejects
    unauthenticated handshakes (401), and the session cookie is what
    identifies the connection.
  */

  // handle incoming websocket
  //TODO hook herE?
  //TODO should be part of GET /@/{user}?
  useEffect(() => {
    if (!authUser || !viewedUsername) return;
    // rooms are keyed per-owner since each user has exactly one repertoire;
    // events fan out only to collaborators viewing the same username.
    const ws = new WebSocket(`ws://localhost:8080/subscribe/${viewedUsername}`);
    setWebSocket(ws);
    ws.onopen = () => console.log('ws live');
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      switch (payload.type) {
        case 'crowd':
          setConnectedUsers(payload.users);
          break;
        case 'user_joined':
          addConnectedUser(payload.user);
          break;
        case 'user_left':
          removeConnectedUser(payload.user.userId);
          break;
        case 'move_created':
          addMove(payload.chapterId, payload.path, { data: payload.move, children: [] });
          break;
        case 'node_deleted':
          deleteNodeRemote(payload.chapterId, payload.path);
          break;
        case 'node_disabled':
          disableNodeRemote(payload.chapterId, payload.path);
          break;
        case 'node_enabled':
          enableNodeRemote(payload.chapterId, payload.path);
          break;
        case 'training_updated':
          updateTrainingRemote(payload.chapterId, payload.path, payload.userSub, payload.card);
          break;
        case 'chapter_created':
          addNewChapterLocally({
            uuid: payload.chapterId,
            name: payload.name,
            trainAs: payload.trainAs,
            root: { data: { id: '', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ply: 0, san: '', comment: '', enabled: false, training: {} }, children: [] },
            enabledCount: payload.enabledCount,
            unseenCount: payload.enabledCount,
            lastDueCount: 0,
          });
          break;
      }
    };
    return () => {
      ws.close();
      setConnectedUsers([]);
    };
  }, [authUser, viewedUsername]);

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
        <div id="header" className='flex items-end pb-1'>
          <div className="logo-wrap flex items-end">
            <img src="logo.png" alt="Logo" />
            <span>chess</span>
            <span className="accent">repeat</span>
          </div>

          <a
            href="https://discord.gg/xhjra9W6Bh"
            target="_blank"
            rel="noopener noreferrer"
            title="Join our Discord"
            className="header-link"
          >
            <span>join discord</span>
            <SiDiscord />
          </a>

          <a
            href="https://github.com/jacokyle01/chessrepeat"
            target="_blank"
            rel="noopener noreferrer"
            title="View on GitHub"
            className="header-link"
          >
            <span>view github</span>
            <SiGithub />
          </a>

          <a
            href="mailto:jacokyle01@gmail.com?subject=Bug Report | chessrepeat"
            title="Report a Bug"
            className="header-link"
          >
            <span>report bug</span>
            <Bug />
          </a>

          <div className="ml-auto flex items-end gap-3">
            {/* Other connected users */}
            {connectedUsers.filter((u) => u.userId !== authUser?.sub).length > 0 && (
              <div className="flex items-end -space-x-1.5">
                {connectedUsers
                  .filter((u) => u.userId !== authUser?.sub)
                  .map((u) => (
                    <img
                      key={u.userId}
                      src={u.picture}
                      alt={u.username}
                      title={u.username}
                      referrerPolicy="no-referrer"
                      className="h-6 w-6 rounded-full ring-2 ring-white"
                    />
                  ))}
              </div>
            )}

            {authUser ? (
              <>
                <span className="flex items-end gap-2">
                  {authUser.picture ? (
                    <img
                      src={authUser.picture}
                      alt={authUser.username ?? 'profile'}
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-md"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                  <span className="text-sm">{authUser.username ?? 'Unnamed'}</span>
                </span>
                <button
                  type="button"
                  onClick={clearAuth}
                  title="Sign out"
                  className="header-link"
                >
                  <LogOut />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSignupOpen(true)}
                className="header-link"
                title="Sign up"
              >
                <span>sign in</span>
                <LogIn />
              </button>
            )}
          </div>
        </div>

        {signupOpen && (
          <>
            <div
              className="modal-backdrop"
              style={{ zIndex: 50 }}
              onClick={() => {
                setSignupOpen(false);
                setPendingSignup(null);
                setPendingUsername('');
              }}
            />
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
              <div className="bg-white rounded-xl shadow-lg p-6 w-96 pointer-events-auto relative">
                <button
                  onClick={() => {
                    setSignupOpen(false);
                    setPendingSignup(null);
                    setPendingUsername('');
                  }}
                  className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                >
                  &times;
                </button>
                {pendingSignup ? (
                  <>
                    <h2 className="text-lg font-semibold mb-2">Pick a username</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      This will be your URL handle (chessrepeat.com/@/your-username).
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const username = pendingUsername.trim();
                        if (!username) return;
                        try {
                          const res = await fetch('http://localhost:8080/login', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ idToken: pendingSignup.idToken, username }),
                          });
                          if (!res.ok) {
                            console.error('signup failed', res.status, await res.text());
                            return;
                          }
                          const data = await res.json();
                          await applyLoginResponse(
                            data,
                            pendingSignup.hasPlaygroundData,
                            navigate,
                            () => { setSignupOpen(false); setShowMigration(true); },
                          );
                          setPendingSignup(null);
                          setPendingUsername('');
                          if (!pendingSignup.hasPlaygroundData) setSignupOpen(false);
                        } catch (err) {
                          console.error('signup request failed', err);
                        }
                      }}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={pendingUsername}
                        onChange={(e) => setPendingUsername(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-sm"
                        placeholder="username"
                      />
                      <button
                        type="submit"
                        className="w-full bg-slate-800 text-white text-sm font-semibold py-2 rounded hover:bg-slate-700"
                      >
                        Continue
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold mb-2">Sign up</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Your playground repertoire will be migrated to your account after signing in.
                    </p>
                    <GoogleLoginButton
                      onPlaygroundMigration={() => { setSignupOpen(false); setShowMigration(true); }}
                      onNeedsUsername={(idToken, hasPlaygroundData) =>
                        setPendingSignup({ idToken, hasPlaygroundData })
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {showMigration && (
          <>
            <div className="modal-backdrop" style={{ zIndex: 50 }} />
            <MigrationModal onClose={() => setShowMigration(false)} />
          </>
        )}

        {showingAddToRepertoireMenu && (
          <>
            <div className="modal-backdrop" onClick={() => setShowingAddToRepertoireMenu(false)} />
            <AddToRepertoireModal />
          </>
        )}

        <div className="app-main">
          {/* BOARD */}
          <div className="area-board" id="board-wrap" ref={containerRef}>
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

          {/* CONTROLS */}
          <div className="area-controls">
            <div className="flex items-start gap-1">
              <Controls />
            </div>
            <div className="inline-flex rounded-b-xl bg-white p-1">
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
          <div className="area-pgn" ref={movesContainerRef}>
            {/* Header + tree: hidden on mobile during learn/recall */}
            <div
              className={`flex flex-col min-h-0 flex-1 overflow-hidden ${isTraining ? 'hidden md:flex' : ''}`}
            >
              <div id="repertoire-header" className="shrink-0 flex flex-row items-center p-3 gap-2">
                <div id="reperoire-icon-wrap" className="text-gray-500 bg-gray-200 p-1 rounded">
                  <NetworkIcon />
                </div>
                <span className="text-gray-800 font-semibold text-xl">Chapter</span>
                {/* copy icon */}
                <div className="inline-flex p-1 ml-auto bg-gray-200 rounded-md">
                  <button
                    type="button"
                    onClick={async () => {
                      const fen = selectedNode?.data.fen || INITIAL_BOARD_FEN;
                      if (!fen) return;
                      await navigator.clipboard.writeText(fen);
                      setFenCopied(true);
                      setTimeout(() => setFenCopied(false), 1200);
                    }}
                    className={`
                      text-sm font-semibold
                      transition-all duration-200 hover:text-green-400
                      ${
                        fenCopied
                          ? 'bg-white text-green-600 ring-1 ring-green-300'
                          : 'hover:text-slate-800 hover:bg-slate-200'
                      }
                    `}
                    aria-label="Copy FEN"
                    title="Copy FEN"
                  >
                    {fenCopied ? <ClipboardCheck size={18} /> : <ClipboardCopy size={18} />}
                  </button>
                </div>
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

          {/* REPERTOIRE */}
          <div className="area-repertoire">
            {/* Desktop: full inline repertoire */}
            <div className="hidden md:flex flex-col flex-1 min-h-0">
              <Repertoire />
            </div>
            {/* Mobile: repertoire as modal trigger */}
            <RepertoireActions />
            <Schedule />
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
