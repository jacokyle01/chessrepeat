import { create } from 'zustand';
import { persist, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

import { Config as CbConfig } from 'chessground/config';
import {
  Chapter,
  Color,
  MoveRow,
  TrainableContext,
  TrainableNode,
  TrainingConfig,
  TrainingData,
  TrainingMethod,
  TrainingOutcome,
} from '../types/training';
import { ChildNode } from 'chessops/pgn';
import { defaults } from '../util/config';
import { deleteNodeAt, forEachNode, getNodeList, nodeAtPath, updateRecursive } from '../util/tree';
import { contains, init } from '../util/path';
import { computeDueCounts, computeNextTrainableNode, merge } from '../util/training';
import { colorFromPly, currentTime, positionFromFen } from '../util/chess';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { scalachessCharPair } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { rootFromPgn } from '../util/io';
import { useAuthStore } from './auth';
import {
  apiAddMove,
  apiEditMoves,
  apiGetChapters,
  apiTrainMove,
  MoveEdit,
  postChapter,
} from '../api/chapter';
import { rebuildChapter } from '../api/util';

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

  trainingConfig: TrainingConfig;
  setTrainingConfig: (config: TrainingConfig) => void;

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
  succeed: () => number | null;
  fail: () => void;
  guess: (san: string) => TrainingOutcome;

  // higher-level ops
  markAllAsSeen: () => Promise<void>;
  disableLine: (path: string) => Promise<void>;
  deleteLine: (path: string) => Promise<void>;
  enableLine: (path: string) => Promise<void>;
  addNewChapter: (chapter: Chapter) => Promise<void>;
  importIntoChapter: (targetChapter: number, newPgn: string) => Promise<void>;

  renameChapter: (index: number, name: string) => void;
  deleteChapterAt: (index: number) => void;
  refreshFromDb: () => void;
  uploadChapter: (chapter: Chapter) => void;
  syncChapter: (chapterIndex: number) => void;
  editRemote: (chapterIndex: number, apiCall) => void;
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

// // ---- helpers (you already have these) ----
// async function rewriteChapterIdsFromRepertoire(repertoire: Chapter[]) {
//   const ids = repertoire.map((c) => c.id);
//   await writeChapterIds(ids);
// }

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
async function persistChapterByIndex(state: { repertoire: Chapter[] }, idx: number) {
  const ch = state.repertoire[idx];
  if (!ch) return;

  const cid = ch.id;
  await writeChapter(cid, ch);

  const ids = await readChapterIds();
  if (!ids.includes(cid)) {
    await writeChapterIds([...ids, cid]);
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
      trainingMethod: 'unselected',
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

      trainingConfig: defaults(),
      setTrainingConfig: (cfg) => set({ trainingConfig: cfg }),

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
          if (!node.data.training.disabled) deleteCount++;
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

        await persistChapterByIndex(get(), repertoireIndex);

        if (contains(selectedPath, path)) jump(init(path));
        else jump(path);
      },

      setNextTrainablePosition: () => {
        const { trainingMethod: method, repertoireIndex, repertoire, trainingConfig } = get();
        if (repertoireIndex === -1 || method === 'edit') return null;
        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;
        const root = chapter.root;

        const maybeTrainingContext = computeNextTrainableNode(chapter.root, method, trainingConfig!.getNext!);

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

      updateDueCounts: () => {
        const { repertoire, repertoireIndex, trainingConfig } = get();
        if (repertoireIndex < 0) return;

        const activeChapter = repertoire[repertoireIndex];
        if (!activeChapter) return;

        const counts = computeDueCounts(activeChapter.root, trainingConfig.buckets);

        set((state) => {
          const nextRepertoire = state.repertoire.slice();

          // shallow clone only the active chapter so React/Zustand notices
          const nextChapter = { ...nextRepertoire[repertoireIndex] };

          // update derived metadata
          nextChapter.lastDueCount = counts[0];

          nextRepertoire[repertoireIndex] = nextChapter;

          return {
            dueTimes: counts,
            repertoire: nextRepertoire,
          };
        });
      },

      clearChapterContext: () => {
        set({
          trainingMethod: 'unselected',
          selectedPath: '',
          userTip: 'empty',
          cbConfig: { lastMove: undefined, drawable: { shapes: [] } },
          selectedNode: null,
        });
      },

      setCommentAt: async (comment: string, path: string) => {
        const authed = useAuthStore.getState().isAuthenticated();
        const { repertoire, repertoireIndex, editRemote } = get();
        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;
        const node = nodeAtPath(chapter.root, path);
        if (!node) return;
        node.data.comment = comment;
        //TODO abstraction over both persistence mechanisms?
        //TODO better naming
        await persistChapterByIndex(get(), get().repertoireIndex);
        await editRemote(repertoireIndex, () =>
          apiEditMoves(chapter.id, [{ idx: node.data.idx, patch: { comment } }]),
        );
      },

      succeed: async (): Promise<number | null> => {
        const { repertoire, repertoireIndex, trainableContext, trainingMethod, trainingConfig, editRemote } =
          get();
        const targetNode = trainableContext?.targetMove;
        const chapter = repertoire[repertoireIndex];
        if (!chapter || !targetNode) return null;

        let timeToAdd = 0;

        switch (trainingMethod) {
          case 'recall': {
            let groupIndex = parseInt(targetNode.data.training.group + '');
            chapter.bucketEntries[groupIndex]--;

            switch (trainingConfig!.promotion) {
              case 'most':
                groupIndex = trainingConfig!.buckets!.length - 1;
                break;
              case 'next':
                groupIndex = Math.min(groupIndex + 1, trainingConfig!.buckets!.length - 1);
                break;
            }

            chapter.bucketEntries[groupIndex]++;
            timeToAdd = trainingConfig!.buckets![groupIndex];
            targetNode.data.training.group = groupIndex;
            break;
          }

          case 'learn': {
            targetNode.data.training.seen = true;
            timeToAdd = trainingConfig!.buckets![0];
            targetNode.data.training.group = 0;
            chapter.bucketEntries[0]++;
            break;
          }
        }

        const dueAt = currentTime() + timeToAdd;
        targetNode.data.training.dueAt = dueAt;

        // local-first persist
        await persistChapterByIndex(get(), repertoireIndex);

        await editRemote(repertoireIndex, () =>
          apiEditMoves(chapter.id, [
            {
              idx: targetNode.data.idx,
              patch: {
                training: {
                  seen: targetNode.data.training.seen,
                  group: targetNode.data.training.group,
                  dueAt: targetNode.data.training.dueAt,
                },
              },
            },
          ]),
        );

        return timeToAdd;
      },

      fail: async () => {
        const { repertoire, repertoireIndex, trainableContext, trainingMethod, trainingConfig, editRemote } =
          get();

        const node = trainableContext?.targetMove;
        const chapter = repertoire[repertoireIndex];
        if (!chapter || !node) return;

        let groupIndex = node.data.training.group;
        chapter.bucketEntries[groupIndex]--;

        if (trainingMethod === 'recall') {
          switch (trainingConfig!.demotion) {
            case 'most':
              groupIndex = 0;
              break;
            case 'next':
              groupIndex = Math.max(groupIndex - 1, 0);
              break;
          }

          chapter.bucketEntries[groupIndex]++;
          const interval = trainingConfig!.buckets![groupIndex];
          node.data.training.group = groupIndex;
          node.data.training.dueAt = currentTime() + interval;

          // local-first persist
          await persistChapterByIndex(get(), repertoireIndex);

          // remote best-effort (optimistic, don’t await)
          await editRemote(repertoireIndex, () =>
            apiEditMoves(chapter.id, [
              {
                idx: node.data.idx,
                patch: {
                  training: {
                    group: node.data.training.group,
                    dueAt: node.data.training.dueAt,
                  },
                },
              },
            ]),
          );
        }
      },

      guess: (san: string): TrainingOutcome => {
        console.log('guess', san);
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

      markAllAsSeen: async () => {
        const nowSec = currentTime();

        set(
          produce((state) => {
            const idx = state.repertoireIndex;
            if (idx < 0) return;

            const chapter = state.repertoire[idx];
            if (!chapter) return;

            const buckets = state.trainingConfig.buckets;
            const timeToAdd = buckets?.[0] ?? 0;

            updateRecursive(chapter.tree, '', (node) => {
              const t = node.data.training;
              if (t.disabled) return;
              if (t.seen) return;

              chapter.bucketEntries[0] = (chapter.bucketEntries[0] ?? 0) + 1;

              t.seen = true;
              t.group = 0;
              t.dueAt = nowSec + timeToAdd;
            });

            state.showSuccessfulGuess = false;
          }),
        );

        await persistChapterByIndex(get(), get().repertoireIndex);
      },

      disableLine: async (path: string) => {
        const { repertoire, repertoireIndex, editRemote } = get();
        const chapter = repertoire[repertoireIndex];
        const root = chapter?.root;
        if (!chapter || !root) return;

        const edits: MoveEdit[] = [];

        updateRecursive(root, path, (node) => {
          if (!node.data.training.disabled) {
            chapter.enabledCount--;
            node.data.training.disabled = true;

            edits.push({
              idx: node.data.idx,
              patch: { training: { disabled: true } },
            });
          }
        });

        // touch so UI updates
        set((state) => {
          const next = state.repertoire.slice();
          next[repertoireIndex] = { ...next[repertoireIndex] };
          return { repertoire: next };
        });

        // local-first persist
        await persistChapterByIndex(get(), repertoireIndex);

        // remote best-effort (don’t block UI)
        if (edits.length > 0) {
          await editRemote(repertoireIndex, () => apiEditMoves(chapter.id, edits));
        }
      },

      enableLine: async (path: string) => {
        const { repertoire, repertoireIndex, editRemote } = get();
        const chapter = repertoire[repertoireIndex];
        if (!chapter) return;

        const edits: MoveEdit[] = [];
        const trainAs = chapter.trainAs;

        updateRecursive(chapter.root, path, (node) => {
          const color: Color = colorFromPly(node.data.ply);

          // your existing logic: only enable moves for the side being trained
          if (trainAs === color && node.data.training.disabled) {
            chapter.enabledCount++;
            node.data.training.disabled = false;

            edits.push({
              idx: node.data.idx,
              patch: { training: { disabled: false } },
            });
          }
        });

        set((state) => {
          const next = state.repertoire.slice();
          next[repertoireIndex] = { ...next[repertoireIndex] };
          return { repertoire: next };
        });

        await persistChapterByIndex(get(), repertoireIndex);

        if (edits.length > 0) {
          void editRemote(repertoireIndex, () => apiEditMoves(chapter.id, edits));
        }
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
          if (!disabled) chapter.enabledCount++;
          console.log('CHAPTER MOVEID', chapter.largestMoveId);

          //TODO do we have to save chapter here..?
          //TODO factor out makeMove ??
          const newNode: TrainableNode = {
            data: {
              training: {
                disabled: disabled,
                seen: false,
                group: -1,
                dueAt: -1,
              },
              ply: selectedNode.data.ply + 1,
              id: scalachessCharPair(move),
              idx: ++chapter.largestMoveId,
              san: makeSanAndPlay(pos, move),
              fen: makeFen(pos.toSetup()),
              comment: '',
            },
            children: [],
          };

          console.log('NEW NODE', newNode);

          selectedNode.children.push(newNode);
          //TODO abstraction here...
          //TODO iff logged in ...

          // flattened fields
          let ord = selectedNode.children.length - 1;
          let parentIdx = selectedNode.data.idx;
          try {
            // ✅ persist to backend

            let flatMove: MoveRow;
            flatMove = {
              ...newNode.data,
              parentIdx: parentIdx,
              ord: ord,
            };
            await apiAddMove(chapter.id, flatMove);

            // If backend is authoritative and might adjust fields, you could merge returned move:
            // const saved = await apiAddMove(chapter.id, newNode.data);
            // newNode.data = { ...newNode.data, ...saved };
          } catch (e) {
            // // rollback optimistic update if you want strict correctness
            // selectedNode.children.pop();
            // if (!newNode.data.training.disabled) chapter.enabledCount--;
            // chapter.largestMoveId--; // rollback local id allocation

            throw e; // or toast + return
          }
        }

        //TODO separate "play move" state action?
        if (trainingMethod == 'edit') {
          const movingTo = selectedNode.children.find((x) => x.data.san === san)!;
          const newPath = selectedPath + movingTo.data.id;

          set({ selectedNode: movingTo, selectedPath: newPath });
        }
        // persist only this chapter
        await persistChapterByIndex(get(), repertoireIndex);
      },
      // TODO should network actions be in state?
      uploadChapter: async (chapter: Chapter) => {
        // 2) if signed in, push to backend
        const isAuthed = useAuthStore.getState().isAuthenticated();
        if (!isAuthed) return;

        try {
          const resp = await postChapter(chapter);
          console.log('RESP', resp);
          // optionally store resp.revision back into IndexedDB/store
          // await idb.updateChapterRevision(chapter.id, resp.revision)
        } catch (e) {
          // optional: mark as "needsSync" instead of rolling back
          // set((s) => markChapterNeedsSync(s, chapter.id))
          console.error(e);
        }
      },

      addNewChapter: async (chapter: Chapter) => {
        console.log('add new chapter');
        console.log('adding this chapter', chapter);
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

        // update memory
        set({ repertoire: newRepertoire });

        // persist only the new chapter + ids list (not all chapters)
        const cid = chapter.id;
        await writeChapter(cid, chapter);
        const ids = await readChapterIds();
        console.log('ids so far', ids);
        if (!ids.includes(cid)) await writeChapterIds([...ids, cid]);
      },

      importIntoChapter: async (targetChapter: number, newPgn: string) => {
        const isAuthenticated = useAuthStore.getState().isAuthenticated();
        const { repertoire } = get();
        const chapter = repertoire[targetChapter];
        if (!chapter) return;

        const { root: importRoot } = rootFromPgn(newPgn, chapter.trainAs);
        merge(chapter.root, importRoot);
        //TODO can we make this part of merge?

        let enabledCount = 0;
        forEachNode(chapter.root, (node) => {
          if (!node.data.training.disabled) enabledCount++;
        });
        chapter.enabledCount = enabledCount;

        // touch only this chapter so UI updates (no set({ repertoire }) on whole array reference)
        set((state) => {
          const next = state.repertoire.slice();
          next[targetChapter] = { ...next[targetChapter] };
          return { repertoire: next };
        });

        // persist only this chapter
        await persistChapterByIndex(get(), targetChapter);
        // isAuthenticated ?
      },

      //TODO should this really be a state action?
      //TODO also, it is inefficient...
      //TODO use local storage as cache
      refreshFromDb: async () => {
        const { addNewChapter } = get();
        let chapters = await apiGetChapters();

        let rebuiltChapters: Chapter[];
        rebuiltChapters = chapters.map((_) => rebuildChapter(_));
        console.log('CHAPTERS', rebuiltChapters);

        for (const chapter of rebuiltChapters) {
          addNewChapter(chapter);
        }
      },

      markChapterUnsaved: (idx: number) => {
        set((state) => {
          const next = state.repertoire.slice();
          const ch = next[idx];
          if (!ch) return state;
          next[idx] = { ...ch, synced: true };
          return { repertoire: next };
        });
      },

      // if we save chapter to database
      markChapterSaved: (idx: number) => {
        set((state) => {
          const next = state.repertoire.slice();
          const ch = next[idx];
          if (!ch) return state;
          next[idx] = { ...ch, synced: false };
          return { repertoire: next };
        });
      },
      /*  
        Try to propagate changes to remote database, 
        if fail, set chapter as "unsynced" and try to 
        re-sync at next possible moment

        Enables users to edit repertoire 
      */
      editRemote: async <T>(chapterIndex: number, apiCall: () => Promise<T>) => {
        const { repertoire, syncChapter } = get();
        const chapter = repertoire[chapterIndex];
        if (!chapter) return { executed: false as const };

        // if not authed/online -> can't remote edit
        const authed = useAuthStore.getState().isAuthenticated();
        const online = typeof navigator === 'undefined' ? true : navigator.onLine;

        if (!authed || !online) {
          // mark unsynced and exit
          set((state) => {
            const next = state.repertoire.slice();
            next[chapterIndex] = { ...next[chapterIndex], synced: false };
            return { repertoire: next };
          });
          return { executed: false as const };
        }

        const wasUnsynced = !chapter.synced;

        try {
          const value = await apiCall();

          // If local was unsynced (offline edits existed), reconcile now
          if (wasUnsynced) {
            // best-effort; if it fails it will re-mark unsynced
            try {
              await syncChapter(chapterIndex);
            } catch {
              set((state) => {
                const next = state.repertoire.slice();
                next[chapterIndex] = { ...next[chapterIndex], synced: false };
                return { repertoire: next };
              });
            }
          } else {
            // remote edit succeeded and local wasn't behind -> consider synced
            set((state) => {
              const next = state.repertoire.slice();
              next[chapterIndex] = { ...next[chapterIndex], synced: true };
              return { repertoire: next };
            });
          }

          return { executed: true as const, value };
        } catch {
          set((state) => {
            const next = state.repertoire.slice();
            next[chapterIndex] = { ...next[chapterIndex], synced: false };
            return { repertoire: next };
          });
          return { executed: false as const };
        }
      },
      //TODO implement on backend..
      syncChapter: async (chapterIndex: number) => {
        const { repertoire } = get();
        const chapter = repertoire[chapterIndex];
        if (!chapter) return;

        // must be authed + online
        if (!useAuthStore.getState().isAuthenticated()) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;

        // const res = await apiSyncChapter(chapter); // server resolves conflicts via updatedAt

        // if (res.chapter) {
        //   // server returned canonical chapter -> replace local
        //   set((state) => {
        //     const next = state.repertoire.slice();
        //     next[chapterIndex] = { ...res.chapter, unsynced: false };
        //     return { repertoire: next };
        //   });
        // } else {
        //   // server accepted local -> just mark synced
        //   set((state) => {
        //     const next = state.repertoire.slice();
        //     next[chapterIndex] = { ...next[chapterIndex], unsynced: false };
        //     return { repertoire: next };
        //   });
        // }
      },
    }),

    {
      name: 'trainer-store',
      storage: indexedDBStorage,

      // ✅ CRITICAL: do NOT persist repertoire anymore (it lives as per-chapter blobs)
      partialize: (state) => ({
        repertoireIndex: state.repertoireIndex,
        trainingConfig: state.trainingConfig,
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
