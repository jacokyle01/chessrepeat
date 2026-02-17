import { create } from 'zustand';
import { persist, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

import { Config as CbConfig } from 'chessground/config';
import {
  Chapter,
  DEFAULT_NODE_SEARCH,
  LiveChapterData,
  NodeSearch,
  TrainableContext,
  TrainableNode,
  TrainingData,
  TrainingMethod,
  TrainingOutcome,
} from '../types/training';
import { ChildNode } from 'chessops/pgn';
import { deleteNodeAt, forEachNode, getNodeList, nodeAtPath, updateRecursive } from '../util/tree';
import { contains, init } from '../util/path';
import { computeDueCounts, computeNextTrainableNode, merge } from '../util/training';
import { colorFromPly, positionFromFen } from '../util/chess';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { scalachessCharPair } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { rootFromPgn } from '../util/io';
import { createCard, review } from '../util/srs';
import { Color } from 'chessops';

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

  cbConfig: CbConfig;
  setCbConfig: (cfg: CbConfig) => void;

  // NEW: hydrate chapters from IDB after persist rehydrates small state
  hydrateRepertoireFromIDB: () => Promise<void>;

  jump: (path: string) => void;
  makeMove: (san: string) => Promise<void>;

  clearChapterContext: () => void;
  setCommentAt: (comment: string, path: string) => Promise<void>;
  updateDueCounts: () => void;
  setNextTrainablePosition: () => void;
  // succeed: () => number | null;
  // fail: () => void;
  learn: () => void;
  train: (correct: boolean) => number;
  guess: (san: string) => TrainingOutcome;

  // higher-level ops
  disableLine: (path: string) => Promise<void>;
  deleteLine: (path: string) => Promise<void>;
  enableLine: (path: string) => Promise<void>;
  addNewChapter: (chapter: Chapter) => Promise<void>;
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
async function deleteChapter(cid: string) {
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

// Helper: persist one chapter by index (in-memory -> IDB) and ensure id list is updated
async function persistChapter(chapter: Chapter) {
  await writeChapter(chapter.id, chapter);

  // if new chapter, insert into id list
  const ids = await readChapterIds();
  if (!ids.includes(chapter.id)) {
    await writeChapterIds([...ids, chapter.id]);
  }
}

// Helper: persist all chapters (used by setRepertoire)
async function persistAllChapters(repertoire: Chapter[]) {
  const ids: string[] = [];
  for (const ch of repertoire) {
    const cid = ch.id;
    ids.push(cid);
    await writeChapter(cid, ch);
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

      liveChapterData: null,
      setLiveChapterData: (val: LiveChapterData) => set({ liveChapterData: val }),

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

      cbConfig: {},
      setCbConfig: (cfg) => set({ cbConfig: cfg }),

      // ---- inside create(...) actions ----
      renameChapter: async (chapterIndex: number, newName: string) => {
        const { repertoire } = get();
        const chapter = repertoire[chapterIndex];
        if (!chapter) return;

        const cid = chapter.id;

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

        const cid = chapter.id;

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

        await deleteChapter(cid);

        const ids = nextRepertoire.map((c) => c.id);
        await writeChapterIds(ids);
      },

      // try to load from IDB on refresh
      hydrateRepertoireFromIDB: async () => {
        const { repertoire } = get();
        if (repertoire.length > 0) return;
        const ids = await readChapterIds();
        if (!ids.length) return;

        const chapters: Chapter[] = [];
        for (const cid of ids) {
          const ch = await readChapter(cid);
          if (ch) chapters.push(ch);
        }

        // hydrate in-memory
        set({ repertoire: chapters });
      },

      jump: (path) => {
        const { repertoire, repertoireIndex } = get();
        const root = repertoire[repertoireIndex]?.root;
        if (!root) return;
        const nodeList = getNodeList(root, path);
        set({ selectedPath: path, selectedNode: nodeList.at(-1) });
      },

      //TODO network actions for delete
      deleteLine: async (path) => {
        const { repertoire, repertoireIndex, selectedPath, jump } = get();
        const chapter = repertoire[repertoireIndex];
        const root = chapter?.root;
        if (!root) return;

        const node = nodeAtPath(root, path);
        if (!node) return;

        // count number of enabled moves we're deleted
        let deleteCount = 0;
        forEachNode(node, (node) => {
          if (node.data.enabled) deleteCount++;
        });

        deleteNodeAt(root, path);

        chapter.enabledCount -= deleteCount;

        // IMPORTANT: do NOT set({ repertoire }) anymore.
        // Instead, touch just this chapter in-memory to re-render,
        // and persist only this chapter to IDB.
        set((state) => {
          const next = state.repertoire.slice();
          next[repertoireIndex] = { ...next[repertoireIndex] }; // shallow touch
          return { repertoire: next };
        });

        await persistChapter(chapter);

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
        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;

        let dueSummary = [];
        let countDueNow = 0;
        forEachNode(chapter.root, (node) => {
          const d = node.data;
          // only enabled, seen nodes
          if (!d.enabled || !d.training) return;

          const msTilDue = d.training.dueAt - Date.now();
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
        const { repertoire, repertoireIndex, trainableContext } = get();
        // console.log('REP', repertoire);
        const chapter = repertoire[repertoireIndex];
        const targetNode = trainableContext?.targetMove;
        if (!chapter || !targetNode) return;
        targetNode.data.training = createCard();
        await persistChapter(chapter);
      },

      /*
        Update node's card based on the result of a training
      */
      train: (correct: boolean) => {
        const { repertoire, repertoireIndex, trainableContext } = get();
        const targetNode = trainableContext?.targetMove;
        const chapter = repertoire[repertoireIndex];
        if (!chapter || !targetNode) return null;

        targetNode.data.training = review(targetNode.data.training, correct);
        void persistChapter(chapter);
        return Math.trunc((targetNode.data.training.dueAt - Date.now()) / 1000);
        // let timeToAdd = 0;

        // switch (trainingMethod) {
        //   case 'recall': {
        //     let groupIndex = parseInt(targetNode.data.training.group + '');
        //     chapter.bucketEntries[groupIndex]--;

        //     switch (trainingConfig!.promotion) {
        //       case 'most':
        //         groupIndex = trainingConfig!.buckets!.length - 1;
        //         break;
        //       case 'next':
        //         groupIndex = Math.min(groupIndex + 1, trainingConfig!.buckets!.length - 1);
        //         break;
        //     }

        //     chapter.bucketEntries[groupIndex]++;
        //     timeToAdd = trainingConfig!.buckets![groupIndex];
        //     targetNode.data.training.group = groupIndex;
        //     break;
        //   }

        //   case 'learn': {
        //     targetNode.data.training.seen = true;
        //     timeToAdd = trainingConfig!.buckets![0];
        //     targetNode.data.training.group = 0;
        //     chapter.bucketEntries[0]++;
        //     break;
        //   }
        // }

        // const dueAt = currentTime() + timeToAdd;
        // targetNode.data.training.dueAt = dueAt;

        // // local-first persist
        // await persistChapter(get(), repertoireIndex);

        // return timeToAdd;
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

      //TODO need to edit live state
      disableLine: async (path: string) => {
        const { repertoire, repertoireIndex, liveChapterData } = get();
        const chapter = repertoire[repertoireIndex];
        const root = chapter?.root;
        if (!chapter || !root) return;

        updateRecursive(root, path, (node) => {
          if (node.data.enabled) {
            liveChapterData.enabledCount--;
            node.data.enabled = false;
          }
        });

        // local-first persist
        await persistChapter(chapter);
      },

      enableLine: async (path: string) => {
        const { repertoire, repertoireIndex, liveChapterData } = get();
        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;
        const trainAs = chapter.trainAs;

        updateRecursive(chapter.root, path, (node) => {
          const color: Color = colorFromPly(node.data.ply);

          // your existing logic: only enable moves for the side being trained
          if (trainAs === color && !node.data.enabled) {
            liveChapterData.enabledCount++;
            node.data.enabled = true;
          }
        });

        set((state) => {
          const next = state.repertoire.slice();
          next[repertoireIndex] = { ...next[repertoireIndex] };
          return { repertoire: next };
        });

        await persistChapter(chapter);
      },

      makeMove: async (san: string) => {
        const { selectedNode, repertoire, repertoireIndex, selectedPath, trainingMethod } = get();
        const chapter = repertoire[repertoireIndex];
        if (!chapter || !selectedNode) return;

        const fen = selectedNode.data.fen;

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
              training: null,
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

          selectedNode.children.push(newNode);
          //TODO abstraction here...
          //TODO iff logged in ...
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
        const { repertoire } = get();
        const ids = await readChapterIds();
        if (ids.includes(chapter.id)) return; // don't write duplicates

        let newRepertoire: Chapter[];
        switch (chapter.trainAs) {
          case 'white':
            newRepertoire = [chapter, ...repertoire];
            break;
          case 'black':
            newRepertoire = [...repertoire, chapter];
            break;
        }

        // update memory
        set({ repertoire: newRepertoire });

        // add to indexedDB
        const cid = chapter.id;
        await writeChapter(cid, chapter);
        writeChapterIds([...ids, cid]);
      },

      //TODO namespace
      importIntoChapter: async (targetChapter: number, newPgn: string) => {
        alert('WIP');
        // const { repertoire, liveChapterData } = get();
        // const chapter = repertoire[targetChapter];
        // if (!chapter) return;

        // const { root: importRoot } = rootFromPgn(newPgn, chapter.trainAs);
        // merge(chapter.root, importRoot);
        // //TODO can we make this part of merge?

        // let enabledCount = 0;
        // forEachNode(chapter.root, (node) => {
        //   if (node.data.enabled) enabledCount++;
        // });
        // liveChapterData.enabledCount = enabledCount;

        // // touch only this chapter so UI updates (no set({ repertoire }) on whole array reference)
        // set((state) => {
        //   const next = state.repertoire.slice();
        //   next[targetChapter] = { ...next[targetChapter] };
        //   return { repertoire: next };
        // });

        // // persist only this chapter
        // await persistChapter(chapter);
        // // isAuthenticated ?
      },
    }),

    {
      name: 'trainer-store',
      storage: indexedDBStorage,

      // ✅ CRITICAL: do NOT persist repertoire anymore (it lives as per-chapter blobs)
      partialize: (state) => ({
        repertoireIndex: state.repertoireIndex,
        trainingConfig: state.searchConfig,
        // (optional) store last selection stuff if you want:
        selectedPath: state.selectedPath,
      }),

      // ✅ After small state is rehydrated, load chapters from IDB into memory
      onRehydrateStorage: () => {
        return async (state, err) => {
          if (err || !state) return;
          await state.hydrateRepertoireFromIDB();
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
