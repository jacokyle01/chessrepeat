import { create } from 'zustand';
import { persist, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

import { Config as CbConfig } from 'chessground/config';
import {
  Chapter,
  DEFAULT_NODE_SEARCH,
  NodeSearch,
  TrainableContext,
  TrainableNode,
  TrainingData,
  TrainingMethod,
  TrainingOutcome,
} from '../types/training';
import { ChildNode } from 'chessops/pgn';
import { deleteNodeAt, forEachNode, getNodeList, nodeAtPath, updateAt } from '../util/tree';
import { contains, init } from '../util/path';
import { computeDueCounts, computeNextTrainableNode } from '../util/training';
import { colorFromPly, positionFromFen } from '../util/chess';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { scalachessCharPair } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { chapterFromPgn } from '../util/io';
import {
  createCard,
  reviewCard,
  defaultSrsConfig,
  updateScheduler,
  type SrsConfig,
  type Card,
} from '../util/srs';
import { postChapter } from '../services/postChapter';
import { PLAYGROUND_KEY, useAuthStore } from './auth';
import { fetchRepertoire } from '../services/repertoire';

// Permission a connected peer holds against the joined room.
// 'owner' is the repertoire owner; 'edit' has full CRUD; 'train' can
// only persist their own training updates. The UI uses this to color
// each connected user's avatar ring.
export type Permission = 'owner' | 'edit' | 'train';

export type Peer = {
  username: string;
  picture: string;
  permission: Permission;
};

// Resolve the training-map key for the current user: their username if
// signed in, the playground key for the IDB-only local mode, or null
// while we don't yet know which (during bootstrap).
function currentUserKey(): string | null {
  const auth = useAuthStore.getState();
  return auth.user?.username ?? (!auth.isAuthenticated() ? PLAYGROUND_KEY : null);
}

// Resolve the currently selected chapter from a repertoire + selection id.
// Returns undefined when nothing is selected or the id is stale.
function selectedChapterOf(repertoire: Chapter[], id: string | null): Chapter | undefined {
  return id == null ? undefined : repertoire.find((c) => c.uuid === id);
}

// function persistChapter(chapter: Chapter) {
//   if
// }

import { userCard } from '../util/userCard';
export { userCard };

// Cap a single move's comment. Mirrors store.MaxCommentChars on the
// backend (which truncates anything over this and broadcasts the
// canonical text). Textareas use it for `maxLength` so users hit it
// before round-tripping.
export const MAX_COMMENT_CHARS = 1000;

const EXAMPLE_PGN = `1. e4 e5 { This is an example chapter. To train your own openings, click "add" and choose a PGN (opening file) to train. chessrepeat uses spaced repetition to schedule your reviews after you learn a move. Enjoy!} 
2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# *`;

interface TrainerState {
  /* UI Flags */
  trainingMethod: TrainingMethod;
  setTrainingMethod: (m: TrainingMethod) => void;

  showingAddToRepertoireMenu: boolean;
  setShowingAddToRepertoireMenu: (val: boolean) => void;

  repertoire: Chapter[];
  setRepertoire: (r: Chapter[]) => Promise<void>; // now async (writes per chapter)

  // uuid of the currently selected/active chapter, or null when none is
  // selected (empty repertoire, or the selected chapter was deleted).
  selectedChapterId: string | null;
  setSelectedChapterId: (id: string | null) => void;

  trainableContext: TrainableContext | null;
  setTrainableContext: (t: TrainableContext) => void;

  selectedPath: string;
  setSelectedPath: (p: string) => void;

  selectedNode: ChildNode<TrainingData> | null;
  setSelectedNode: (n: any) => void;

  showingHint: boolean;
  setShowingHint: (v: boolean) => void;

  userTip: string;
  setUserTip: (f: string) => void;

  lastGuess: string;
  setLastGuess: (g: string) => void;

  showSuccessfulGuess: boolean;
  setShowSuccessfulGuess: (val: boolean) => void;

  dueTimes: number[];
  setDueTimes: (t: number[]) => void;

  /* Library config */
  searchConfig: NodeSearch;
  setSearchConfig: (config: NodeSearch) => void;

  srsConfig: SrsConfig;
  setSrsConfig: (config: SrsConfig) => void;

  cbConfig: CbConfig;
  setCbConfig: (cfg: CbConfig) => void;

  socket: WebSocket;
  setWebSocket: (ws: WebSocket) => void;

  // whose repertoire are we looking at? `useWebsocket` watches this to automatically start a session
  repertoireAuthor: string | null;
  setRepertoireAuthor: (author: string) => void;

  connectedUsers: Peer[];
  setConnectedUsers: (users: Peer[]) => void;
  addConnectedUser: (user: Peer) => void;
  removeConnectedUser: (username: string) => void;

  // NEW: hydrate chapters from IDB after persist rehydrates small state
  hydrateRepertoireFromIDB: () => Promise<void>;

  jump: (path: string) => void;
  makeMove: (san: string) => Promise<void>;
  addMove: (chapterId: string, path: string, node: TrainableNode) => Promise<void>;

  clearChapterContext: () => void;
  setCommentAt: (comment: string, path: string) => Promise<void>;
  setCommentRemote: (chapterId: string, path: string, comment: string) => void;
  updateDueCounts: () => void;
  setNextTrainablePosition: () => void;
  learn: () => void;
  train: (correct: boolean) => number | null;
  guess: (san: string) => TrainingOutcome;

  // higher-level ops
  deleteLine: (path: string) => Promise<void>;
  deleteNodeRemote: (chapterId: string, path: string) => void;
  updateTrainingRemote: (chapterId: string, path: string, username: string, card: Card) => void;
  addNewChapter: (chapter: Chapter) => Promise<void>;
  addNewChapterLocally: (chapter: Chapter) => Promise<void>;
  renameChapter: (chapterId: string, name: string) => void;
  deleteChapterAt: (chapterId: string) => void;
  deleteChapterRemote: (chapterId: string) => void;
}

/**
 * ---------- IndexedDB keys ----------
 * We store each chapter separately so we never write the whole repertoire blob.
 *
 * - trainer:chapters         -> string[] (chapter ids)
 * - trainer:chapter:<cid>    -> Chapter (full chapter blob)
 */
const KEYS = {
  chapterIds: 'trainer:chapters' as const,
  chapter: (cid: string) => `trainer:chapter:${cid}`,
};

async function writeChapterIds(ids: string[]) {
  await set(KEYS.chapterIds, ids);
}
async function readChapterIds(): Promise<string[]> {
  return (await get(KEYS.chapterIds)) ?? [];
}
async function writeChapter(cid: string, chapter: Chapter) {
  await set(KEYS.chapter(cid), chapter);
}
async function readChapter(cid: string): Promise<Chapter | null> {
  return (await get(KEYS.chapter(cid))) ?? null;
}
async function deleteChapterIDB(cid: string) {
  await del(KEYS.chapter(cid));
}

// --- IndexedDB storage for zustand/persist (keep small) ---
const indexedDBStorage: StateStorage = {
  getItem: async (name) => {
    const value = await get(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  },
};

// Helper: persist one chapter to IDB (playground mode only)
async function persistChapter(chapter: Chapter) {
  if (useAuthStore.getState().isAuthenticated()) return;
  await writeChapter(chapter.uuid, chapter);

  const ids = await readChapterIds();
  if (!ids.includes(chapter.uuid)) {
    await writeChapterIds([...ids, chapter.uuid]);
  }
}

// Helper: persist all chapters to IDB (playground mode only)
async function persistAllChapters(repertoire: Chapter[]) {
  if (useAuthStore.getState().isAuthenticated()) return;
  const ids: string[] = [];
  for (const ch of repertoire) {
    ids.push(ch.uuid);
    await writeChapter(ch.uuid, ch);
  }
  await writeChapterIds(ids);
}

export const useTrainerStore = create<TrainerState>()(
  persist(
    (set, get) => ({
      trainingMethod: null,
      setTrainingMethod: (trainingMethod) => set({ trainingMethod }),

      showingAddToRepertoireMenu: false,
      setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),

      // in-memory only; loaded via hydrateRepertoireFromIDB
      repertoire: [],
      setRepertoire: async (repertoire) => {
        // update memory first; keep the active selection if it still exists,
        // otherwise fall back to the first chapter (or none when empty).
        set((state) => ({
          repertoire,
          selectedChapterId: repertoire.some((c) => c.uuid === state.selectedChapterId)
            ? state.selectedChapterId
            : (repertoire[0]?.uuid ?? null),
        }));

        // persist per-chapter (NOT via zustand persist)
        await persistAllChapters(repertoire);
      },

      selectedChapterId: null,
      setSelectedChapterId: (id) => set({ selectedChapterId: id }),

      trainableContext: undefined,
      setTrainableContext: (t) => set({ trainableContext: t }),

      selectedPath: '',
      setSelectedPath: (path) => set({ selectedPath: path }),

      selectedNode: null,
      setSelectedNode: (node) => set({ selectedNode: node }),

      repertoireAuthor: null,
      setRepertoireAuthor: (author) => set({ repertoireAuthor: author }),

      showingHint: false,
      setShowingHint: (v) => set({ showingHint: v }),

      userTip: 'init',
      setUserTip: (f) => set({ userTip: f }),

      lastGuess: '',
      setLastGuess: (g) => set({ lastGuess: g }),

      showSuccessfulGuess: false,
      setShowSuccessfulGuess: (val) => set({ showSuccessfulGuess: val }),

      dueTimes: [],
      setDueTimes: (t) => set({ dueTimes: t }),

      searchConfig: DEFAULT_NODE_SEARCH,
      setSearchConfig: (cfg) => set({ searchConfig: cfg }),

      srsConfig: defaultSrsConfig,
      setSrsConfig: (config) => {
        updateScheduler(config);
        set({ srsConfig: config });
      },

      cbConfig: {},
      setCbConfig: (cfg) => set({ cbConfig: cfg }),

      socket: null,
      setWebSocket: (ws) => set({ socket: ws }),

      connectedUsers: [],
      setConnectedUsers: (users) => set({ connectedUsers: users }),
      addConnectedUser: (user) =>
        set((state) => ({
          connectedUsers: state.connectedUsers.some((u) => u.username === user.username)
            ? state.connectedUsers
            : [...state.connectedUsers, user],
        })),
      removeConnectedUser: (username) =>
        set((state) => ({
          connectedUsers: state.connectedUsers.filter((u) => u.username !== username),
        })),

      // ---- inside create(...) actions ----
      renameChapter: async (chapterId: string, newName: string) => {
        const { repertoire, socket } = get();
        const chapter = repertoire.find((c) => c.uuid === chapterId);
        if (!chapter) return;

        const cid = chapter.uuid;

        // update in-memory optimistically (touch only that chapter)
        set((state) => {
          const next = state.repertoire.slice();
          const idx = next.findIndex((c) => c.uuid === chapterId);
          if (idx !== -1) next[idx] = { ...next[idx], name: newName };
          return { repertoire: next };
        });

        // Playground state lives in IDB; authenticated state lives on
        // the server and is mirrored to peers via the WebSocket (the
        // server broadcasts 'reload' so other tabs/sessions resync).
        if (!useAuthStore.getState().isAuthenticated()) {
          await writeChapter(cid, { ...chapter, name: newName });
        } else if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'chapter_renamed', chapterId: cid, name: newName }));
        } else {
          console.warn('socket not open; chapter rename not broadcast');
        }
      },

      deleteChapterAt: async (chapterId: string) => {
        const { repertoire, selectedChapterId, socket } = get();
        const idx = repertoire.findIndex((c) => c.uuid === chapterId);
        if (idx === -1) return;

        const cid = chapterId;

        const nextRepertoire = repertoire.slice();
        nextRepertoire.splice(idx, 1);

        // If we deleted the active chapter, select a neighbor (the chapter
        // that slid into its slot, clamped to the end) — or nothing when the
        // repertoire is now empty. Deleting a background chapter leaves the
        // current selection and training view untouched.
        const clearingActive = selectedChapterId === chapterId;
        const nextSelected = clearingActive
          ? (nextRepertoire[Math.min(idx, nextRepertoire.length - 1)]?.uuid ?? null)
          : selectedChapterId;

        set({
          repertoire: nextRepertoire,
          selectedChapterId: nextSelected,
          ...(clearingActive
            ? { selectedPath: '', selectedNode: null, trainableContext: null as any, userTip: 'empty' }
            : {}),
        });

        // playground state lives in IDB; authenticated state lives on the
        // server and is mirrored to peers via the WebSocket.
        if (!useAuthStore.getState().isAuthenticated()) {
          await deleteChapterIDB(cid);
          await writeChapterIds(nextRepertoire.map((c) => c.uuid));
        } else if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'chapter_deleted', chapterId: cid }));
        } else {
          console.warn('socket not open; chapter deletion not broadcast');
        }
      },

      // handle a chapter_deleted event received from another client
      deleteChapterRemote: (chapterId: string) => {
        const { repertoire, selectedChapterId } = get();
        const idx = repertoire.findIndex((c) => c.uuid === chapterId);
        if (idx === -1) return;

        const nextRepertoire = repertoire.slice();
        nextRepertoire.splice(idx, 1);

        // mirror deleteChapterAt: if a remote peer drops the chapter we're
        // viewing, select a neighbor; otherwise the selection is unaffected.
        const clearingActive = selectedChapterId === chapterId;
        const nextSelected = clearingActive
          ? (nextRepertoire[Math.min(idx, nextRepertoire.length - 1)]?.uuid ?? null)
          : selectedChapterId;

        set({
          repertoire: nextRepertoire,
          selectedChapterId: nextSelected,
          ...(clearingActive
            ? { selectedPath: '', selectedNode: null, trainableContext: null as any, userTip: 'empty' }
            : {}),
        });
      },

      // Load playground chapters from IDB on refresh (playground mode only)
      hydrateRepertoireFromIDB: async () => {
        console.log('hydrate');
        const { repertoire, addNewChapterLocally } = get();
        if (repertoire.length > 0) return;
        const ids = await readChapterIds();

        if (!ids.length) {
          // Seed example chapter for new playground users
          const exampleChapter = chapterFromPgn(EXAMPLE_PGN, 'white', 'Example Chapter');
          if (exampleChapter) await addNewChapterLocally(exampleChapter);
          return;
        }

        const chapters: Chapter[] = [];
        for (const cid of ids) {
          const ch = await readChapter(cid);
          if (ch) chapters.push(ch);
        }

        //sort
        //TODO refactor (fetch repertoire has similiar logic)
        const sortChapters = (ch1: Chapter, ch2: Chapter): number => {
          if (ch1.trainAs != ch2.trainAs) {
            return ch1.trainAs == 'white' ? -1 : 1;
          }
          return ch1.uuid.localeCompare(ch2.uuid);
        };

        chapters.sort(sortChapters);

        set({ repertoire: chapters, selectedChapterId: chapters[0]?.uuid ?? null });
      },

      jump: (path) => {
        const { repertoire, selectedChapterId } = get();
        const root = selectedChapterOf(repertoire, selectedChapterId)?.root;
        if (!root) return;
        const nodeList = getNodeList(root, path);
        set({ selectedPath: path, selectedNode: nodeList.at(-1) });
      },

      deleteLine: async (path) => {
        const { repertoire, selectedChapterId, selectedPath, jump, updateDueCounts, socket } = get();
        const chapter = selectedChapterOf(repertoire, selectedChapterId);
        if (!chapter) return;
        const root = chapter.root;
        const node = nodeAtPath(root, path);
        if (!node) {
          // The path we're asked to delete isn't in our local tree —
          // we've drifted from the server. Resync rather than no-op.
          console.warn('deleteLine: path not found, reloading', { path });
          await fetchRepertoire();
          return;
        }

        // count number of enabled moves we're deleting
        let deleteCount = 0;
        let unseenCount = 0;
        forEachNode(node, (node) => {
          if (node.data.enabled) deleteCount++;
          if (node.data.enabled && !userCard(node.data)) unseenCount++;
        });

        deleteNodeAt(root, path);

        chapter.enabledCount -= deleteCount;
        chapter.unseenCount -= unseenCount;
        updateDueCounts();

        set((state) => {
          const next = state.repertoire.slice();
          const idx = next.findIndex((c) => c.uuid === chapter.uuid);
          if (idx !== -1) next[idx] = { ...next[idx] };
          return { repertoire: next };
        });

        await persistChapter(chapter);

        if (useAuthStore.getState().isAuthenticated() && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'node_deleted',
              chapterId: chapter.uuid,
              path,
            }),
          );
        }

        if (contains(selectedPath, path)) jump(init(path));
        else jump(path);
      },

      setNextTrainablePosition: () => {
        const { trainingMethod: method, selectedChapterId, repertoire, searchConfig } = get();
        if (!method || method === 'edit') return null;
        const chapter = selectedChapterOf(repertoire, selectedChapterId);
        if (!chapter) return;
        const root = chapter.root;

        const maybeTrainingContext = computeNextTrainableNode(chapter.root, method, searchConfig);

        if (!maybeTrainingContext) {
          set({ userTip: 'empty', selectedPath: '', selectedNode: null, trainableContext: null });
        } else {
          const targetPath = maybeTrainingContext.startingPath;
          const nodeList = getNodeList(root, targetPath);
          set({
            selectedPath: targetPath,
            selectedNode: nodeList.at(-1),
            trainableContext: maybeTrainingContext,
            userTip: method,
          });
        }
      },

      // get milliseconds til due for each node
      updateDueCounts: () => {
        const { repertoire, selectedChapterId } = get();
        const key = currentUserKey();
        const chapter = selectedChapterOf(repertoire, selectedChapterId);
        if (!chapter || !key) return;

        let dueSummary = [];
        let countDueNow = 0;
        forEachNode(chapter.root, (node) => {
          const d = node.data;
          if (!d.enabled) return;
          const card = userCard(d, key);
          if (!card) return;

          const msTilDue = new Date(card.due).getTime() - Date.now();
          if (msTilDue <= 0) {
            countDueNow++;
          }
          dueSummary.push(msTilDue);
        });

        chapter.lastDueCount = countDueNow;
        set({ dueTimes: dueSummary, repertoire });
      },

      clearChapterContext: () => {
        set({
          trainingMethod: null,
          selectedPath: '',
          userTip: 'empty',
          cbConfig: { lastMove: undefined, drawable: { shapes: [] } },
          selectedNode: null,
          trainableContext: null,
        });
      },

      setCommentAt: async (comment: string, path: string) => {
        const { repertoire, selectedChapterId, socket } = get();
        const chapter = selectedChapterOf(repertoire, selectedChapterId);
        if (!chapter) return;
        const node = nodeAtPath(chapter.root, path);
        if (!node) {
          // Commenting on a path our tree doesn't have — we've drifted
          // from the server. Resync rather than silently dropping it.
          console.warn('setCommentAt: path not found, reloading', { path });
          await fetchRepertoire();
          return;
        }
        // Defensive cap: the textarea already enforces maxLength, but
        // a programmatic caller (or paste-bypass) could exceed it. The
        // server truncates by runes too, so this just avoids a wasted
        // round-trip + reconciles to the same canonical length.
        if (comment.length > MAX_COMMENT_CHARS) comment = comment.slice(0, MAX_COMMENT_CHARS);
        node.data.comment = comment;
        //TODO abstraction over both persistence mechanisms?
        //TODO better naming
        await persistChapter(chapter);
        set({ repertoire });

        if (useAuthStore.getState().isAuthenticated() && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: 'set_comment',
              chapterId: chapter.uuid,
              path,
              comment,
            }),
          );
        }
      },

      // handle a set_comment event received from another client
      setCommentRemote: (chapterId: string, path: string, comment: string) => {
        const { repertoire } = get();
        const chapter = repertoire.find((c) => c.uuid === chapterId);
        if (!chapter) return;
        const node = nodeAtPath(chapter.root, path);
        if (!node) return; // server stays authoritative; missing locally means we'll resync separately
        node.data.comment = comment;
        set((state) => {
          const next = state.repertoire.slice();
          const idx = next.findIndex((c) => c.uuid === chapterId);
          if (idx !== -1) next[idx] = { ...next[idx] };
          return { repertoire: next };
        });
      },

      /*
        Initialize card training data upon
        seeing a node for the first time
      */
      learn: () => {
        const { repertoire, selectedChapterId, trainableContext, socket } = get();
        const key = currentUserKey();
        const chapter = selectedChapterOf(repertoire, selectedChapterId);
        const targetNode = trainableContext?.targetMove;
        if (!chapter || !targetNode || !key) return;

        // The target move may have been deleted by another client since we
        // computed this trainable position. Writing a card onto a node that's
        // no longer in the tree would silently drift us from the server, so
        // verify it still exists and resync the whole repertoire if not.
        const targetPath = trainableContext.startingPath + targetNode.data.id;
        if (!nodeAtPath(chapter.root, targetPath)) {
          console.warn('learn: target move not found, reloading', { targetPath });
          void fetchRepertoire();
          return;
        }

        const card = createCard();
        if (!targetNode.data.training) targetNode.data.training = {};
        targetNode.data.training[key] = card;
        chapter.unseenCount--;
        void persistChapter(chapter);

        if (useAuthStore.getState().isAuthenticated() && socket && socket.readyState === WebSocket.OPEN) {
          // Wire path must be the *target move's* path, not the parent's
          // (startingPath = pathToHere is the position the move is
          // played from). Cards live on the target node both locally
          // and in the moves table; mergeCardsIntoMoves attaches them
          // by path equality, so sending the parent path used to anchor
          // the card on the wrong row and the card "disappeared" on the
          // next reload.
          socket.send(
            JSON.stringify({
              type: 'training_updated',
              chapterId: chapter.uuid,
              path: targetPath,
              username: key,
              card,
            }),
          );
        }
      },

      /*
        Update node's card based on the result of a training
      */
      train: (correct: boolean) => {
        const { repertoire, selectedChapterId, trainableContext, socket } = get();
        const key = currentUserKey();
        const targetNode = trainableContext?.targetMove;
        const chapter = selectedChapterOf(repertoire, selectedChapterId);
        if (!chapter || !targetNode || !key) return null;

        // The target move may have been deleted by another client since we
        // computed this trainable position. Reviewing a card on a node that's
        // no longer in the tree would silently drift us from the server, so
        // verify it still exists and resync the whole repertoire if not.
        const targetPath = trainableContext.startingPath + targetNode.data.id;
        if (!nodeAtPath(chapter.root, targetPath)) {
          console.warn('train: target move not found, reloading', { targetPath });
          void fetchRepertoire();
          return null;
        }

        const oldCard = userCard(targetNode.data, key);
        if (!oldCard) return null;
        const card = reviewCard(oldCard, correct);
        targetNode.data.training[key] = card;
        void persistChapter(chapter);

        if (useAuthStore.getState().isAuthenticated() && socket && socket.readyState === WebSocket.OPEN) {
          // Target move's path (see learn() comment above).
          socket.send(
            JSON.stringify({
              type: 'training_updated',
              chapterId: chapter.uuid,
              path: targetPath,
              username: key,
              card,
            }),
          );
        }

        return Math.trunc((new Date(card.due).getTime() - Date.now()) / 1000);
      },

      guess: (san: string): TrainingOutcome => {
        // console.log('guess', san);
        const { repertoire, selectedChapterId, selectedPath, trainableContext, trainingMethod } = get();
        const chapter = selectedChapterOf(repertoire, selectedChapterId);
        if (!chapter) return;

        const root = chapter.root;
        const pathToTrain = trainableContext?.startingPath;
        if (pathToTrain == null) return;

        const trainableNodeList: ChildNode<TrainingData>[] = getNodeList(root, pathToTrain);
        if (!trainableNodeList || trainingMethod === 'learn') return;

        const possibleMoves = trainableNodeList.at(-1)!.children.map((_) => _.data.san);
        set({ lastGuess: san });

        const target = trainableContext.targetMove;
        return possibleMoves.includes(san) ? (target.data.san === san ? 'success' : 'alternate') : 'failure';
      },

      //TODO separate state action for makeMove, addMove ?

      /*
        Intended for receiving moves over websockets.
        The chapter is looked up by id so the move lands in the correct
        chapter regardless of what the user currently has selected.
        TODO: we can implement a "follow" option that can set the path to whatever was just added
      */
      addMove: async (chapterId: string, path: string, node: TrainableNode) => {
        const { repertoire } = get();
        const chapter = repertoire.find((c) => c.uuid === chapterId);
        if (!chapter) {
          console.warn('addMove: no chapter found for id', chapterId);
          return;
        }
        const root = chapter.root;
        const parent = updateAt(root, path, (p: TrainableNode) => p.children.push(node));
        if (!parent) {
          // The path we're attaching to doesn't exist locally — our
          // tree has drifted from the server's. Don't persist an
          // orphan; resync the whole repertoire over HTTP instead.
          console.warn('addMove: path not found, reloading', { chapterId, path });
          await fetchRepertoire();
          return;
        }

        if (node.data.enabled) chapter.enabledCount++;
        if (!userCard(node.data)) chapter.unseenCount++;
        set({ repertoire }); // we have to do this to trigger a state update
        await persistChapter(chapter);
      },

      // handle a node_deleted event received from another client via websocket
      deleteNodeRemote: (chapterId: string, path: string) => {
        const { repertoire, selectedPath, jump, updateDueCounts } = get();
        const chapter = repertoire.find((c) => c.uuid === chapterId);
        if (!chapter) return;

        const node = nodeAtPath(chapter.root, path);
        if (!node) return;

        let deleteCount = 0;
        let unseenCount = 0;
        forEachNode(node, (n) => {
          if (n.data.enabled) deleteCount++;
          if (n.data.enabled && !userCard(n.data)) unseenCount++;
        });

        deleteNodeAt(chapter.root, path);
        chapter.enabledCount -= deleteCount;
        chapter.unseenCount -= unseenCount;
        updateDueCounts();

        set((state) => {
          const next = state.repertoire.slice();
          const idx = next.findIndex((c) => c.uuid === chapterId);
          if (idx !== -1) next[idx] = { ...next[idx] };
          return { repertoire: next };
        });

        // if we were viewing a node inside the deleted subtree, jump to the parent
        if (contains(selectedPath, path)) jump(init(path));
      },

      // handle a training_updated event received from another client
      updateTrainingRemote: (chapterId: string, path: string, username: string, card: Card) => {
        const { repertoire } = get();
        const chapter = repertoire.find((c) => c.uuid === chapterId);
        if (!chapter) return;

        const node = nodeAtPath(chapter.root, path);
        if (!node) return;

        if (!node.data.training) node.data.training = {};
        node.data.training[username] = card;

        set((state) => {
          const next = state.repertoire.slice();
          const idx = next.findIndex((c) => c.uuid === chapterId);
          if (idx !== -1) next[idx] = { ...next[idx] };
          return { repertoire: next };
        });
      },

      /*
        Make move via UI
        Send move over via POST for now
      */
      makeMove: async (san: string) => {
        const { selectedNode, repertoire, selectedChapterId, selectedPath, trainingMethod } = get();
        const chapter = selectedChapterOf(repertoire, selectedChapterId);
        if (!chapter || !selectedNode) return;

        const fen = selectedNode.data.fen;

        // if adding new move
        if (!selectedNode.children.map((_) => _.data.san).includes(san)) {
          const [pos] = positionFromFen(fen);
          const move = parseSan(pos, san);
          const currentColor = colorFromPly(selectedNode.data.ply);
          const trainAs = chapter.trainAs;
          const disabled = currentColor == trainAs;

          //TODO do we have to save chapter here..?
          //TODO factor out makeMove ??
          const newNode: TrainableNode = {
            data: {
              training: {},
              enabled: !disabled, //TODO
              ply: selectedNode.data.ply + 1,
              id: scalachessCharPair(move),
              san: makeSanAndPlay(pos, move),
              fen: makeFen(pos.toSetup()),
              comment: '',
            },
            children: [],
          };

          // console.log('NEW NODE', newNode);

          //update chapter metadata
          chapter.enabledCount += newNode.data.enabled ? 1 : 0;
          chapter.unseenCount += newNode.data.enabled ? 1 : 0;

          selectedNode.children.push(newNode);
          //TODO abstraction here...
          //TODO iff logged in ...
          //TODO put network actions somewhere
          //TODO why void?

          if (!useAuthStore.getState().isAuthenticated()) {
            await persistChapter(chapter);
          } else {
            console.log('try send over socket');
            const { socket } = get();
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  type: 'move_created',
                  chapterId: chapter.uuid,
                  path: selectedPath,
                  move: newNode.data,
                }),
              );
            } else {
              console.warn('socket not open; move not broadcast');
            }
          }
        }

        //TODO separate "play move" state action?
        if (trainingMethod == 'edit') {
          const movingTo = selectedNode.children.find((x) => x.data.san === san)!;
          const newPath = selectedPath + movingTo.data.id;

          set({ selectedNode: movingTo, selectedPath: newPath });
        }
        // persist only this chapter
        await persistChapter(chapter);
      },
      // TODO should network actions be in state?

      addNewChapter: async (chapter: Chapter) => {
        const { addNewChapterLocally } = get();
        await addNewChapterLocally(chapter);
        if (useAuthStore.getState().isAuthenticated()) {
          void postChapter(chapter);
        }
      },

      addNewChapterLocally: async (chapter: Chapter) => {
        const { repertoire } = get();
        let newRepertoire: Chapter[];
        switch (chapter.trainAs) {
          //TODO more sophisticated chapter adding, user1 and user2 may see different orderings
          case 'white':
            newRepertoire = [chapter, ...repertoire];
            break;
          case 'black':
            newRepertoire = [...repertoire, chapter];
            break;
        }

        // Keep the current selection stable; if nothing was selected yet
        // (e.g. the seed example chapter on first load), select the new one.
        set((state) => ({
          repertoire: newRepertoire,
          selectedChapterId: state.selectedChapterId ?? chapter.uuid,
        }));
        if (!useAuthStore.getState().isAuthenticated()) {
          const cid = chapter.uuid;
          await writeChapter(cid, chapter);
          const ids = await readChapterIds();
          if (!ids.includes(cid)) {
            await writeChapterIds([...ids, cid]);
          }
        }
      },
    }),

    {
      name: 'trainer-store',
      storage: indexedDBStorage,

      // ✅ CRITICAL: do NOT persist repertoire anymore (it lives as per-chapter blobs)
      partialize: (state) => ({
        // selectedChapterId: state.selectedChapterId,
        // trainingConfig: state.searchConfig,
        // selectedPath: state.selectedPath,
        // searchConfig: state.searchConfig,
        // srsConfig: state.srsConfig,
      }),

      //TODO don't need? handled but `useStartup()` hook..
      // onRehydrateStorage: () => {
      //   return async (state, err) => {
      //     if (err || !state) return;
      //     // In playground mode, hydrate chapters from IDB on page load.
      //     // When authenticated, chapters come from the server instead.
      //     if (!useAuthStore.getState().isAuthenticated()) {
      //       console.log("hydrate")
      //       await state.hydrateRepertoireFromIDB();
      //     }
      //   };
      // },
    },
  ),
);

/**
 * Usage note:
 * - Your existing components can keep using `repertoire` from Zustand as before.
 * - The big win: random `set({ selectedPath })` no longer triggers a huge IDB rewrite.
 * - Chapter mutations now persist only the touched chapter (import/move/comment/etc).
 */
