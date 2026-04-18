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
import { deleteNodeAt, forEachNode, getNodeList, nodeAtPath, updateAt, updateRecursive } from '../util/tree';
import { contains, init } from '../util/path';
import { computeDueCounts, computeNextTrainableNode, merge } from '../util/training';
import { colorFromPly, positionFromFen } from '../util/chess';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { scalachessCharPair } from 'chessops/compat';
import { INITIAL_BOARD_FEN, makeFen } from 'chessops/fen';
import { annotatePgn, chapterFromPgn, rootFromPgn } from '../util/io';
import { createCard, reviewCard, defaultSrsConfig, updateScheduler, type SrsConfig, type Card } from '../util/srs';
import { Color } from 'chessops';
import { postChapter } from '../services/postChapter';
import { PLAYGROUND_SUB, useAuthStore } from './auth';

export type Peer = {
  userId: string;
  username: string;
  picture: string;
};

/** Get the current user's sub from the auth store, falling back to playground sub. */
function currentUserSub(): string | null {
  const auth = useAuthStore.getState();
  return auth.user?.sub ?? (auth.isPlayground() ? PLAYGROUND_SUB : null);
}

function isPlayground(): boolean {
  return useAuthStore.getState().isPlayground();
}

import { userCard } from '../util/userCard';
export { userCard };

const EXAMPLE_PGN = `1. e4 e5 { This is an example chapter of a chessrepeat repertoire. You can add your own chapter by clicking "Add to Repertoire" and selecting a PGN (game file) to import. Then, you can train your own openings with spaced repetition! Click "Learn" to see positions for the first time, then click "Recall" to train them after increasingly long intervals of time.
Spaced repetition can help you memorize new openings more efficiently and effectively than other techniques.
Enjoy! } 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# *`;

interface TrainerState {
  /* UI Flags */
  trainingMethod: TrainingMethod;
  setTrainingMethod: (m: TrainingMethod) => void;

  showingAddToRepertoireMenu: boolean;
  setShowingAddToRepertoireMenu: (val: boolean) => void;

  showingImportIntoChapterModal: boolean;
  setShowingImportIntoChapterModal: (val: boolean) => void;

  repertoire: Chapter[];
  setRepertoire: (r: Chapter[]) => Promise<void>; // now async (writes per chapter)

  repertoireIndex: number;
  setRepertoireIndex: (i: number) => void;

  trainableContext: TrainableContext | undefined;
  setTrainableContext: (t: TrainableContext) => void;

  selectedPath: string;
  setSelectedPath: (p: string) => void;

  selectedNode: ChildNode<TrainingData>;
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

  connectedUsers: Peer[];
  setConnectedUsers: (users: Peer[]) => void;
  addConnectedUser: (user: Peer) => void;
  removeConnectedUser: (userId: string) => void;

  // NEW: hydrate chapters from IDB after persist rehydrates small state
  hydrateRepertoireFromIDB: () => Promise<void>;

  jump: (path: string) => void;
  makeMove: (san: string) => Promise<void>;
  addMove: (chapterId: string, path: string, node: TrainableNode) => Promise<void>;

  clearChapterContext: () => void;
  setCommentAt: (comment: string, path: string) => Promise<void>;
  updateDueCounts: () => void;
  setNextTrainablePosition: () => void;
  learn: () => void;
  train: (correct: boolean) => number;
  guess: (san: string) => TrainingOutcome;

  // higher-level ops
  disableLine: (path: string) => Promise<void>;
  deleteLine: (path: string) => Promise<void>;
  enableLine: (path: string) => Promise<void>;
  deleteNodeRemote: (chapterId: string, path: string) => void;
  disableNodeRemote: (chapterId: string, path: string) => void;
  enableNodeRemote: (chapterId: string, path: string) => void;
  updateTrainingRemote: (chapterId: string, path: string, userSub: string, card: Card) => void;
  addNewChapter: (chapter: Chapter) => Promise<void>;
  addNewChapterLocally: (chapter: Chapter) => Promise<void>;
  importIntoChapter: (targetChapter: number, newPgn: string) => Promise<void>;

  renameChapter: (index: number, name: string) => void;
  deleteChapterAt: (index: number) => void;
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
  if (!isPlayground()) return;
  await writeChapter(chapter.uuid, chapter);

  const ids = await readChapterIds();
  if (!ids.includes(chapter.uuid)) {
    await writeChapterIds([...ids, chapter.uuid]);
  }
}

// Helper: persist all chapters to IDB (playground mode only)
async function persistAllChapters(repertoire: Chapter[]) {
  if (!isPlayground()) return;
  const ids: string[] = [];
  for (const ch of repertoire) {
    ids.push(ch.uuid);
    await writeChapter(ch.uuid, ch);
  }
  await writeChapterIds(ids);
}

/** Clear all playground data from IDB. */
export async function clearPlaygroundIDB() {
  const ids = await readChapterIds();
  for (const cid of ids) {
    await deleteChapterIDB(cid);
  }
  await writeChapterIds([]);
}

/** Load playground chapters from IDB (for migration). */
export async function loadPlaygroundChapters(): Promise<Chapter[]> {
  const ids = await readChapterIds();
  const chapters: Chapter[] = [];
  for (const cid of ids) {
    const ch = await readChapter(cid);
    if (ch) chapters.push(ch);
  }
  return chapters;
}

export const useTrainerStore = create<TrainerState>()(
  persist(
    (set, get) => ({
      trainingMethod: null,
      setTrainingMethod: (trainingMethod) => set({ trainingMethod }),

      showingAddToRepertoireMenu: false,
      setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),

      showingImportIntoChapterModal: false,
      setShowingImportIntoChapterModal: (val) => set({ showingAddToRepertoireMenu: val }),

      // in-memory only; loaded via hydrateRepertoireFromIDB
      repertoire: [],
      setRepertoire: async (repertoire) => {
        // update memory first
        set({ repertoire });

        // persist per-chapter (NOT via zustand persist)
        await persistAllChapters(repertoire);
      },

      repertoireIndex: 0,
      setRepertoireIndex: (i) => set({ repertoireIndex: i }),

      trainableContext: undefined,
      setTrainableContext: (t) => set({ trainableContext: t }),

      selectedPath: '',
      setSelectedPath: (path) => set({ selectedPath: path }),

      selectedNode: null,
      setSelectedNode: (node) => set({ selectedNode: node }),

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
      addConnectedUser: (user) => set((state) => ({
        connectedUsers: state.connectedUsers.some((u) => u.userId === user.userId)
          ? state.connectedUsers
          : [...state.connectedUsers, user],
      })),
      removeConnectedUser: (userId) => set((state) => ({
        connectedUsers: state.connectedUsers.filter((u) => u.userId !== userId),
      })),

      // ---- inside create(...) actions ----
      renameChapter: async (chapterIndex: number, newName: string) => {
        const { repertoire } = get();
        const chapter = repertoire[chapterIndex];
        if (!chapter) return;

        const cid = chapter.uuid;

        // update in-memory (touch only that chapter)
        set((state) => {
          const next = state.repertoire.slice();
          next[chapterIndex] = { ...next[chapterIndex], name: newName };
          return { repertoire: next };
        });

        // persist only this chapter
        await writeChapter(cid, { ...chapter, name: newName });
      },

      deleteChapterAt: async (chapterIndex: number) => {
        const { repertoire, repertoireIndex } = get();
        const chapter = repertoire[chapterIndex];
        if (!chapter) return;

        const cid = chapter.uuid;

        const nextRepertoire = repertoire.slice();
        nextRepertoire.splice(chapterIndex, 1);

        let nextIndex = repertoireIndex;
        if (nextRepertoire.length === 0) nextIndex = 0;
        else if (chapterIndex < repertoireIndex) nextIndex = Math.max(0, repertoireIndex - 1);
        else if (chapterIndex === repertoireIndex)
          nextIndex = Math.min(repertoireIndex, nextRepertoire.length - 1);

        set({
          repertoire: nextRepertoire,
          repertoireIndex: nextIndex,
          selectedPath: '',
          selectedNode: null,
          trainableContext: null as any,
          userTip: 'empty',
        });

        await deleteChapterIDB(cid);

        const ids = nextRepertoire.map((c) => c.uuid);
        await writeChapterIds(ids);
      },

      // Load playground chapters from IDB on refresh (playground mode only)
      hydrateRepertoireFromIDB: async () => {
        const { repertoire, addNewChapterLocally } = get();
        if (repertoire.length > 0) return;
        const ids = await readChapterIds();

        if (!ids.length) {
          // Seed example repertoire for new playground users
          const exampleChapter = chapterFromPgn(EXAMPLE_PGN, 'white', 'Example Repertoire');
          await addNewChapterLocally(exampleChapter);
          return;
        }

        const chapters: Chapter[] = [];
        for (const cid of ids) {
          const ch = await readChapter(cid);
          if (ch) chapters.push(ch);
        }

        set({ repertoire: chapters });
      },

      jump: (path) => {
        const { repertoire, repertoireIndex } = get();
        const root = repertoire[repertoireIndex]?.root;
        if (!root) return;
        const nodeList = getNodeList(root, path);
        set({ selectedPath: path, selectedNode: nodeList.at(-1) });
      },

      deleteLine: async (path) => {
        const { repertoire, repertoireIndex, selectedPath, jump, updateDueCounts, socket } = get();
        const chapter = repertoire[repertoireIndex];
        const root = chapter.root;
        const node = nodeAtPath(root, path);
        if (!node) return;

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
          next[repertoireIndex] = { ...next[repertoireIndex] };
          return { repertoire: next };
        });

        await persistChapter(chapter);

        if (!isPlayground() && socket && socket.readyState === WebSocket.OPEN) {
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
        const { trainingMethod: method, repertoireIndex, repertoire, searchConfig } = get();
        if (repertoireIndex === -1 || method === 'edit') return null;
        const chapter = repertoire[repertoireIndex];
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
        const { repertoire, repertoireIndex } = get();
        const sub = currentUserSub();
        const chapter = repertoire[repertoireIndex];
        if (!chapter || !sub) return;

        let dueSummary = [];
        let countDueNow = 0;
        forEachNode(chapter.root, (node) => {
          const d = node.data;
          if (!d.enabled) return;
          const card = userCard(d, sub);
          if (!card) return;

          const msTilDue = new Date(card.due).getTime() - Date.now();
          if (msTilDue < 0) {
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
        });
      },

      setCommentAt: async (comment: string, path: string) => {
        const { repertoire, repertoireIndex } = get();
        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;
        const node = nodeAtPath(chapter.root, path);
        if (!node) return;
        node.data.comment = comment;
        //TODO abstraction over both persistence mechanisms?
        //TODO better naming
        await persistChapter(chapter);
        set({ repertoire });
      },

      /*
        Initialize card training data upon
        seeing a node for the first time
      */
      learn: async () => {
        const { repertoire, repertoireIndex, trainableContext, socket } = get();
        const sub = currentUserSub();
        const chapter = repertoire[repertoireIndex];
        const targetNode = trainableContext?.targetMove;
        if (!chapter || !targetNode || !sub) return;
        const card = createCard();
        if (!targetNode.data.training) targetNode.data.training = {};
        targetNode.data.training[sub] = card;
        chapter.unseenCount--;
        await persistChapter(chapter);

        if (!isPlayground() && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'training_updated',
            chapterId: chapter.uuid,
            path: trainableContext.startingPath,
            userSub: sub,
            card,
          }));
        }
      },

      /*
        Update node's card based on the result of a training
      */
      train: (correct: boolean) => {
        const { repertoire, repertoireIndex, trainableContext, socket } = get();
        const sub = currentUserSub();
        const targetNode = trainableContext?.targetMove;
        const chapter = repertoire[repertoireIndex];
        if (!chapter || !targetNode || !sub) return null;

        const oldCard = userCard(targetNode.data, sub);
        if (!oldCard) return null;
        const card = reviewCard(oldCard, correct);
        targetNode.data.training[sub] = card;
        void persistChapter(chapter);

        if (!isPlayground() && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'training_updated',
            chapterId: chapter.uuid,
            path: trainableContext.startingPath,
            userSub: sub,
            card,
          }));
        }

        return Math.trunc((new Date(card.due).getTime() - Date.now()) / 1000);
      },

      guess: (san: string): TrainingOutcome => {
        // console.log('guess', san);
        const { repertoire, repertoireIndex, selectedPath, trainableContext, trainingMethod } = get();
        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;

        const root = chapter.root;
        const pathToTrain = trainableContext?.startingPath;
        if (pathToTrain == null) return;

        const trainableNodeList: ChildNode<TrainingData>[] = getNodeList(root, pathToTrain);
        if (repertoireIndex === -1 || !trainableNodeList || trainingMethod === 'learn') return;

        const possibleMoves = trainableNodeList.at(-1)!.children.map((_) => _.data.san);
        set({ lastGuess: san });

        const target = trainableContext.targetMove;
        return possibleMoves.includes(san) ? (target.data.san === san ? 'success' : 'alternate') : 'failure';
      },

      disableLine: async (path: string) => {
        const { repertoire, repertoireIndex, socket } = get();
        const chapter = repertoire[repertoireIndex];
        const root = chapter?.root;
        if (!chapter || !root) return;

        updateRecursive(root, path, (node) => {
          if (node.data.enabled) {
            chapter.enabledCount--;
            node.data.enabled = false;
          }
        });

        set((state) => {
          const next = state.repertoire.slice();
          next[repertoireIndex] = { ...next[repertoireIndex] };
          return { repertoire: next };
        });

        await persistChapter(chapter);

        if (!isPlayground() && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'node_disabled', chapterId: chapter.uuid, path }));
        }
      },

      enableLine: async (path: string) => {
        const { repertoire, repertoireIndex, socket } = get();
        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;
        const trainAs = chapter.trainAs;

        updateRecursive(chapter.root, path, (node) => {
          const color: Color = colorFromPly(node.data.ply);

          if (trainAs === color && !node.data.enabled) {
            chapter.enabledCount++;
            node.data.enabled = true;
          }
        });

        set((state) => {
          const next = state.repertoire.slice();
          next[repertoireIndex] = { ...next[repertoireIndex] };
          return { repertoire: next };
        });

        await persistChapter(chapter);

        if (!isPlayground() && socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'node_enabled', chapterId: chapter.uuid, path }));
        }
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
        //TODO test for existing
        updateAt(root, path, (parent: TrainableNode) => parent.children.push(node));

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

      disableNodeRemote: (chapterId: string, path: string) => {
        const { repertoire } = get();
        const chapter = repertoire.find((c) => c.uuid === chapterId);
        if (!chapter) return;

        updateRecursive(chapter.root, path, (node) => {
          if (node.data.enabled) {
            chapter.enabledCount--;
            node.data.enabled = false;
          }
        });

        set((state) => {
          const next = state.repertoire.slice();
          const idx = next.findIndex((c) => c.uuid === chapterId);
          if (idx !== -1) next[idx] = { ...next[idx] };
          return { repertoire: next };
        });
      },

      enableNodeRemote: (chapterId: string, path: string) => {
        const { repertoire } = get();
        const chapter = repertoire.find((c) => c.uuid === chapterId);
        if (!chapter) return;
        const trainAs = chapter.trainAs;

        updateRecursive(chapter.root, path, (node) => {
          const color: Color = colorFromPly(node.data.ply);
          if (trainAs === color && !node.data.enabled) {
            chapter.enabledCount++;
            node.data.enabled = true;
          }
        });

        set((state) => {
          const next = state.repertoire.slice();
          const idx = next.findIndex((c) => c.uuid === chapterId);
          if (idx !== -1) next[idx] = { ...next[idx] };
          return { repertoire: next };
        });
      },

      // handle a training_updated event received from another client
      updateTrainingRemote: (chapterId: string, path: string, userSub: string, card: Card) => {
        const { repertoire } = get();
        const chapter = repertoire.find((c) => c.uuid === chapterId);
        if (!chapter) return;

        const node = nodeAtPath(chapter.root, path);
        if (!node) return;

        if (!node.data.training) node.data.training = {};
        node.data.training[userSub] = card;

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
        const { selectedNode, repertoire, repertoireIndex, selectedPath, trainingMethod } = get();
        const chapter = repertoire[repertoireIndex];
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

          if (isPlayground()) {
            await persistChapter(chapter);
          } else {
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
        if (!isPlayground()) {
          void postChapter(chapter);
        }
      },

      addNewChapterLocally: async (chapter: Chapter) => {
        const { repertoire } = get();

        let newRepertoire: Chapter[];
        switch (chapter.trainAs) {
          case 'white':
            newRepertoire = [chapter, ...repertoire];
            break;
          case 'black':
            newRepertoire = [...repertoire, chapter];
            break;
        }

        set({ repertoire: newRepertoire });

        if (isPlayground()) {
          const cid = chapter.uuid;
          await writeChapter(cid, chapter);
          const ids = await readChapterIds();
          if (!ids.includes(cid)) {
            await writeChapterIds([...ids, cid]);
          }
        }
      },

      //TODO namespace
      importIntoChapter: async (targetChapter: number, newPgn: string) => {
        const { repertoire } = get();
        const chapter = repertoire[targetChapter];
        if (!chapter) return;

        const importedPgnRoot = annotatePgn(newPgn, chapter.trainAs);
        console.log(importedPgnRoot, newPgn);

        const importRoot = {
          data: {
            comment: '',
            fen: INITIAL_BOARD_FEN,
            id: '',
            ply: 0,
            san: '',
            enabled: false,
            training: null,
          },
          children: importedPgnRoot.children,
        };

        merge(chapter.root, importRoot);

        // //TODO can we make this part of merge?
        let enabledCount = 0;
        let unseenCount = 0;
        forEachNode(chapter.root, (node) => {
          if (node.data.enabled) {
            enabledCount++;
          }
          if (!userCard(node.data)) unseenCount++;
        });

        chapter.enabledCount = enabledCount;
        chapter.unseenCount = unseenCount;

        // touch only this chapter so UI updates (no set({ repertoire }) on whole array reference)
        set((state) => {
          const next = state.repertoire.slice();
          next[targetChapter] = { ...next[targetChapter] };
          return { repertoire: next };
        });

        // persist only this chapter
        await persistChapter(chapter);
        // isAuthenticated ?
      },
    }),

    {
      name: 'trainer-store',
      storage: indexedDBStorage,

      // ✅ CRITICAL: do NOT persist repertoire anymore (it lives as per-chapter blobs)
      partialize: (state) => ({
        // repertoireIndex: state.repertoireIndex,
        // trainingConfig: state.searchConfig,
        // selectedPath: state.selectedPath,
        // searchConfig: state.searchConfig,
        // srsConfig: state.srsConfig,
      }),

      onRehydrateStorage: () => {
        return async (state, err) => {
          if (err || !state) return;
          // In playground mode, hydrate chapters from IDB on page load.
          // When authenticated, chapters come from the server instead.
          if (isPlayground()) {
            await state.hydrateRepertoireFromIDB();
          }
        };
      },
    },
  ),
);

/**
 * Usage note:
 * - Your existing components can keep using `repertoire` from Zustand as before.
 * - The big win: random `set({ selectedPath })` no longer triggers a huge IDB rewrite.
 * - Chapter mutations now persist only the touched chapter (import/move/comment/etc).
 */
