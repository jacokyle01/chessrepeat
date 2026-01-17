// state/trainerStore.ts
import { create } from 'zustand';
import { produce } from 'immer';

import type { Config as CbConfig } from 'chessground/config';
import type { ChildNode } from 'chessops/pgn';

import {
  Chapter,
  Color,
  TrainableContext,
  TrainableNode,
  TrainingConfig,
  TrainingData,
  TrainingMethod,
  TrainingOutcome,
} from '../types/training';

import { defaults } from '../util/config';
import { deleteNodeAt, getNodeList, nodeAtPath, updateRecursive } from '../util/tree';
import { contains, init } from '../util/path';
import { computeDueCounts, computeNextTrainableNode, merge } from '../util/training';
import { colorFromPly, currentTime, positionFromFen } from '../util/chess';
import { makeSanAndPlay, parseSan } from 'chessops/san';
import { scalachessCharPair } from 'chessops/compat';
import { makeFen } from 'chessops/fen';
import { rootFromPgn } from '../util/io';
import {
  deleteFullChapter,
  getChapterMetaFromIDB,
  loadChapterRuntime,
  movesDB,
  persistFullChapter,
  setChapterMetaInIDB,
} from './idb';
import { PersistedChapterMeta } from '../types/state';
//TODO
/*
deleteChapterById
renameChapterById
*/

interface TrainerState {
  // UI flags
  trainingMethod: TrainingMethod;
  setTrainingMethod: (m: TrainingMethod) => void;

  showingTrainingSettings: boolean;
  setShowingTrainingSettings: (val: boolean) => void;

  showingAddToRepertoireMenu: boolean;
  setShowingAddToRepertoireMenu: (val: boolean) => void;

  showingImportIntoChapterModal: boolean;
  setShowingImportIntoChapterModal: (val: boolean) => void;

  // NEW: only one loaded chapter at a time
  activeChapterId: string | null;
  activeChapter: Chapter | null;
  setActiveChapterById: (chapterId: string) => Promise<void>;

  // selection context
  trainableContext: TrainableContext | undefined;
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

  trainingConfig: TrainingConfig;
  setTrainingConfig: (config: TrainingConfig) => void;

  cbConfig: CbConfig;
  setCbConfig: (cfg: CbConfig) => void;

  // actions
  jump: (path: string) => void;
  makeMove: (san: string) => void;

  clearChapterContext: () => void;
  setCommentAt: (comment: string, path: string) => void;
  updateDueCounts: () => void;
  setNextTrainablePosition: () => void;
  succeed: () => number | null;
  fail: () => void;
  guess: (san: string) => TrainingOutcome;

  // higher-level ops
  markAllAsSeen: () => void;
  disableLine: (path: string) => void;
  deleteLine: (path: string) => void;
  enableLine: (path: string) => void;

  addNewChapter: (chapter: Chapter) => Promise<void>;
  addChapters: (chapters: Chapter[]) => Promise<void>;

  importIntoChapter: (targetChapterId: string, newPgn: string) => Promise<void>;

  // meta (chapter data except root)
  chapterMeta: PersistedChapterMeta[];
  getChapterMeta: () => Promise<PersistedChapterMeta[]>;
  setChapterMeta: (next: PersistedChapterMeta[]) => Promise<void>;
  // ✅ one-time hydration
  hydrateChapterMeta: () => Promise<void>;
}

export const useTrainerStore = create<TrainerState>()((set, get) => ({
  // ---------- state ----------
  trainingMethod: 'unselected',
  showingTrainingSettings: false,
  showingAddToRepertoireMenu: false,
  showingImportIntoChapterModal: false,

  chapterMeta: [],
  activeChapterId: null,
  activeChapter: null,

  trainableContext: undefined,
  selectedPath: '',
  selectedNode: null,

  showingHint: false,
  userTip: 'init',
  lastGuess: '',
  showSuccessfulGuess: false,

  dueTimes: [],
  trainingConfig: defaults(),
  cbConfig: {},

  // ---------- setters ----------
  setTrainingMethod: (trainingMethod) => set({ trainingMethod }),
  setShowingTrainingSettings: (val) => set({ showingTrainingSettings: val }),
  setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),
  setShowingImportIntoChapterModal: (val) => set({ showingImportIntoChapterModal: val }),

  // ✅ "get" = load from IDB and also set in-memory state
getChapterMeta: async () => {
  const meta = await getChapterMetaFromIDB();
  set({ chapterMeta: meta });
  return meta;
},


  // ✅ "set" = write to IDB, then set in-memory state
  setChapterMeta: async (next) => {
    await setChapterMetaInIDB(next);
    set({ chapterMeta: next });
  },

  hydrateChapterMeta: async () => {
    const metas = await getChapterMetaFromIDB();
    set({ chapterMeta: metas });
  },

  setTrainableContext: (t) => set({ trainableContext: t }),
  setSelectedPath: (path) => set({ selectedPath: path }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setShowingHint: (v) => set({ showingHint: v }),
  setUserTip: (f) => set({ userTip: f }),
  setLastGuess: (g) => set({ lastGuess: g }),
  setShowSuccessfulGuess: (val) => set({ showSuccessfulGuess: val }),
  setDueTimes: (t) => set({ dueTimes: t }),
  setTrainingConfig: (cfg) => set({ trainingConfig: cfg }),
  setCbConfig: (cfg) => set({ cbConfig: cfg }),

  // ---------- persistence orchestration ----------
  //TODO do we have to "refresh"? just store meta like we are storing other things e.x. lastGuess
  // refreshChapterMeta: async () => {
  //   const all = await movesDB.getAllChapterMeta();
  //   // stable ordering: whites first then blacks, or whatever you want
  //   const next = all.slice().sort((a, b) => a.trainAs.localeCompare(b.trainAs));
  //   set({ chapterMeta: next });
  // },

  setActiveChapterById: async (chapterId: string) => {
    const ch = await loadChapterRuntime(chapterId);
    set({
      activeChapterId: chapterId,
      activeChapter: ch,
      selectedPath: '',
      selectedNode: ch?.root ?? null,
      trainableContext: undefined,
      userTip: 'init',
    });
  },

  // ---------- core actions (updated to activeChapter) ----------
  jump: (path) => {
    const { activeChapter } = get();
    const root = activeChapter?.root;
    if (!root) return;

    const nodeList = getNodeList(root, path);
    const node = nodeList.at(-1) ?? null;
    set({ selectedPath: path, selectedNode: node });
  },

  deleteLine: (path) => {
    const { activeChapter, selectedPath, jump } = get();
    if (!activeChapter?.root) return;

    const root = activeChapter.root;
    const node = nodeAtPath(root, path);
    if (!node) return;

    // mutate runtime
    deleteNodeAt(root, path);

    // update UI selection
    if (contains(selectedPath, path)) jump(init(path));
    else jump(path);

    // ⚠️ persistence for delete is more involved (must delete all subtree nodes + remove edge)
    // For now, simplest correct approach: persist whole chapter after structural deletes.
    // Optimize later with subtree deletes if needed.
    persistFullChapter(activeChapter);

    set({ activeChapter: { ...activeChapter } });
  },

  setNextTrainablePosition: () => {
    const { trainingMethod: method, activeChapter, trainingConfig } = get();
    if (!activeChapter?.root) return null;
    if (method === 'edit') return null;

    const root = activeChapter.root;
    const maybeTrainingContext = computeNextTrainableNode(root, method, trainingConfig.getNext!);

    if (!maybeTrainingContext) {
      set({ userTip: 'empty', selectedPath: '', selectedNode: null, trainableContext: null as any });
      return null;
    }

    const targetPath = maybeTrainingContext.startingPath;
    const nodeList = getNodeList(root, targetPath);
    const targetNode = nodeList.at(-1) ?? null;

    set({
      userTip: method,
      selectedPath: targetPath,
      selectedNode: targetNode,
      trainableContext: maybeTrainingContext,
    });

    return maybeTrainingContext;
  },

  updateDueCounts: () => {
    const { activeChapter, trainingConfig } = get();
    if (!activeChapter?.root) return;

    const counts = computeDueCounts(activeChapter.root, trainingConfig.buckets);

    // update runtime chapter meta
    const nextChapter = { ...activeChapter, lastDueCount: counts[0] };

    set({ dueTimes: counts, activeChapter: nextChapter });

    // persist only chapter meta (bucketEntries/nodeCount/etc) if you store them there
    // (dueTimes itself can be derived, so don’t store it)
    movesDB.setChapterMeta({
      id: nextChapter.id,
      name: nextChapter.name,
      trainAs: nextChapter.trainAs,
      rootId: nextChapter.root.data.id,
      nodeCount: nextChapter.nodeCount,
      bucketEntries: nextChapter.bucketEntries,
      updatedAt: Date.now(),
    });
  },

  clearChapterContext: () => {
    set({
      trainingMethod: 'unselected',
      selectedPath: '',
      userTip: 'empty',
      cbConfig: { lastMove: undefined, drawable: { shapes: [] } },
      selectedNode: null,
      trainableContext: undefined,
    });
  },

  setCommentAt: (comment: string, path: string) => {
    const { activeChapter } = get();
    if (!activeChapter?.root) return;

    const node = nodeAtPath(activeChapter.root, path);
    if (!node) return;

    node.data.comment = comment;

    set({ activeChapter: { ...activeChapter } });

    // ✅ persist ONLY this node
    movesDB.patchNode(activeChapter.id, node.data.id, { comment });
  },

  succeed: (): number | null => {
    const { activeChapter, trainableContext, trainingMethod, trainingConfig } = get();
    if (!activeChapter || !trainableContext?.targetMove) return null;

    const chapter = activeChapter;
    const targetNode = trainableContext.targetMove;

    let timeToAdd = 0;

    switch (trainingMethod) {
      case 'recall': {
        let groupIndex = Number(targetNode.data.training.group);
        chapter.bucketEntries[groupIndex]--;

        switch (trainingConfig.promotion) {
          case 'most':
            groupIndex = trainingConfig.buckets.length - 1;
            break;
          case 'next':
            groupIndex = Math.min(groupIndex + 1, trainingConfig.buckets.length - 1);
            break;
        }

        chapter.bucketEntries[groupIndex]++;
        timeToAdd = trainingConfig.buckets[groupIndex];
        targetNode.data.training.group = groupIndex;
        break;
      }

      case 'learn': {
        targetNode.data.training.seen = true;
        targetNode.data.training.group = 0;
        chapter.bucketEntries[0]++;
        timeToAdd = trainingConfig.buckets[0];
        break;
      }

      default:
        return null;
    }

    targetNode.data.training.dueAt = currentTime() + timeToAdd;

    set({ activeChapter: { ...chapter } });

    // ✅ persist ONLY changed node + chapter meta
    movesDB.patchNode(chapter.id, targetNode.data.id, { training: { ...targetNode.data.training } });
    movesDB.setChapterMeta({
      id: chapter.id,
      name: chapter.name,
      trainAs: chapter.trainAs,
      rootId: chapter.root.data.id,
      nodeCount: chapter.nodeCount,
      bucketEntries: chapter.bucketEntries,
      updatedAt: Date.now(),
    });

    return timeToAdd;
  },

  fail: () => {
    const { activeChapter, trainableContext, trainingMethod, trainingConfig } = get();
    if (!activeChapter || !trainableContext?.targetMove) return;

    const chapter = activeChapter;
    const node = trainableContext.targetMove;

    let groupIndex = node.data.training.group;
    chapter.bucketEntries[groupIndex]--;

    if (trainingMethod === 'recall') {
      switch (trainingConfig.demotion) {
        case 'most':
          groupIndex = 0;
          break;
        case 'next':
          groupIndex = Math.max(groupIndex - 1, 0);
          break;
      }
      chapter.bucketEntries[groupIndex]++;

      const interval = trainingConfig.buckets[groupIndex];
      node.data.training.group = groupIndex;
      node.data.training.dueAt = currentTime() + interval;

      set({ activeChapter: { ...chapter } });

      // ✅ persist only node + chapter meta
      movesDB.patchNode(chapter.id, node.data.id, { training: { ...node.data.training } });
      movesDB.setChapterMeta({
        id: chapter.id,
        name: chapter.name,
        trainAs: chapter.trainAs,
        rootId: chapter.root.data.id,
        nodeCount: chapter.nodeCount,
        bucketEntries: chapter.bucketEntries,
        updatedAt: Date.now(),
      });
    }
  },

  guess: (san: string): TrainingOutcome => {
    const { activeChapter, trainableContext, trainingMethod } = get();
    if (!activeChapter?.root || trainingMethod === 'learn') return 'failure';
    if (!trainableContext?.startingPath || !trainableContext?.targetMove) return 'failure';

    const root = activeChapter.root;
    const nodeList = getNodeList(root, trainableContext.startingPath);
    const current = nodeList.at(-1);
    if (!current) return 'failure';

    const possible = current.children.map((c) => c.data.san);
    set({ lastGuess: san });

    if (!possible.includes(san)) return 'failure';
    return trainableContext.targetMove.data.san === san ? 'success' : 'alternate';
  },

  markAllAsSeen: () => {
    const { activeChapter, trainingConfig } = get();
    if (!activeChapter?.root) return;

    const nowSec = currentTime();
    const timeToAdd = trainingConfig.buckets?.[0] ?? 0;
    const chapter = activeChapter;

    // This touches MANY nodes -> persist as a batch of node patches.
    // simplest correct approach: walk nodes and patch each node’s training (queued).
    updateRecursive(chapter.root, '', (node) => {
      const t = node.data.training;
      if (t.disabled) return;
      if (t.seen) return;

      chapter.bucketEntries[0] = (chapter.bucketEntries[0] ?? 0) + 1;
      t.seen = true;
      t.group = 0;
      t.dueAt = nowSec + timeToAdd;

      movesDB.patchNode(chapter.id, node.data.id, { training: { ...t } });
    });

    set({ activeChapter: { ...chapter }, showSuccessfulGuess: false });

    movesDB.setChapterMeta({
      id: chapter.id,
      name: chapter.name,
      trainAs: chapter.trainAs,
      rootId: chapter.root.data.id,
      nodeCount: chapter.nodeCount,
      bucketEntries: chapter.bucketEntries,
      updatedAt: Date.now(),
    });
  },

  disableLine: (path: string) => {
    const { activeChapter, updateDueCounts } = get();
    if (!activeChapter?.root) return;

    const chapter = activeChapter;
    updateRecursive(chapter.root, path, (node) => {
      node.data.training.disabled = true;
      movesDB.patchNode(chapter.id, node.data.id, { training: { ...node.data.training } });
    });

    set({ activeChapter: { ...chapter } });
    updateDueCounts();
  },

  enableLine: (path: string) => {
    const { activeChapter, updateDueCounts } = get();
    if (!activeChapter?.root) return;

    const chapter = activeChapter;
    const trainAs = chapter.trainAs;

    updateRecursive(chapter.root, path, (node) => {
      const color: Color = colorFromPly(node.data.ply);
      if (trainAs === color) {
        node.data.training.disabled = false;
        movesDB.patchNode(chapter.id, node.data.id, { training: { ...node.data.training } });
      }
    });

    set({ activeChapter: { ...chapter } });
    updateDueCounts();
  },

  makeMove: (san: string) => {
    const { activeChapter, selectedNode, selectedPath } = get();
    if (!activeChapter?.root || !selectedNode) return;

    const chapter = activeChapter;
    const parent = selectedNode;

    const fen = parent.data.fen;

    // if child exists, just move there
    const existing = parent.children.find((c) => c.data.san === san);
    if (existing) {
      set({ selectedNode: existing, selectedPath: selectedPath + existing.data.id });
      return;
    }

    const [pos] = positionFromFen(fen);
    const move = parseSan(pos, san);

    const newNode: TrainableNode = {
      data: {
        training: {
          disabled: !parent.data.training.disabled,
          seen: false,
          group: -1,
          dueAt: -1,
        },
        ply: parent.data.ply + 1,
        id: scalachessCharPair(move),
        san: makeSanAndPlay(pos, move),
        fen: makeFen(pos.toSetup()),
        comment: '',
      },
      children: [],
    };

    if (!newNode.data.training.disabled) chapter.nodeCount++;
    parent.children.push(newNode);

    const newPath = selectedPath + newNode.data.id;

    set({ activeChapter: { ...chapter }, selectedNode: newNode as any, selectedPath: newPath });

    // ✅ persist new node + parent edge + meta
    movesDB.setNode(chapter.id, {
      id: newNode.data.id,
      parentId: parent.data.id,
      ply: newNode.data.ply,
      san: newNode.data.san,
      // fen: newNode.data.fen, // optional
      comment: newNode.data.comment ?? null,
      training: { ...newNode.data.training },
      childrenIds: [],
    });
    movesDB.addChildEdge(chapter.id, parent.data.id, newNode.data.id);

    // append-only nodeIds index
    movesDB.getNodeIds(chapter.id).then((ids) => {
      if (!ids.includes(newNode.data.id)) movesDB.setNodeIds(chapter.id, [...ids, newNode.data.id]);
    });

    movesDB.setChapterMeta({
      id: chapter.id,
      name: chapter.name,
      trainAs: chapter.trainAs,
      rootId: chapter.root.data.id,
      nodeCount: chapter.nodeCount,
      bucketEntries: chapter.bucketEntries,
      updatedAt: Date.now(),
    });
  },
addNewChapter: async (chapter: Chapter) => {
  await persistFullChapter(chapter);

  const meta: PersistedChapterMeta = {
    id: chapter.id,
    name: chapter.name,
    trainAs: chapter.trainAs,
    rootId: chapter.root.data.id,
    nodeCount: chapter.nodeCount,
    bucketEntries: [...chapter.bucketEntries],
    updatedAt: Date.now(),
    lastDueCount: 0,
  };

  const existing = get().chapterMeta;

  // de-dupe
  const without = existing.filter((m) => m.id !== meta.id);

  const next = meta.trainAs === 'white' ? [meta, ...without] : [...without, meta];

  await get().setChapterMeta(next);
},


  //TODO
  addChapters: async (chapters: Chapter[]) => {
    if (!chapters.length) return;

    // 1) Persist full chapters (nodes etc)
    for (const ch of chapters) {
      await persistFullChapter(ch);
    }

    // 2) Build metas for these chapters
    const newMetas: PersistedChapterMeta[] = chapters.map((ch) => ({
      id: ch.id,
      name: ch.name,
      trainAs: ch.trainAs,
      rootId: ch.root.data.id,
      nodeCount: ch.nodeCount,
      bucketEntries: [...ch.bucketEntries],
      updatedAt: Date.now(),
      lastDueCount: ch.lastDueCount ?? 0,
    }));

    // 3) Write per-chapter meta records
    for (const meta of newMetas) {
      await movesDB.setChapterMeta(meta);
    }

    // 4) Update the meta index list + Zustand state in one go
    //    - dedupe by id (new wins)
    //    - keep stable ordering: whites first, then blacks
    const prev = get().chapterMeta;

    const byId = new Map<string, PersistedChapterMeta>();
    for (const m of prev) byId.set(m.id, m);
    for (const m of newMetas) byId.set(m.id, m); // overwrite/insert

    const merged = Array.from(byId.values());

    // optional: stable sort (white first, then black, then name)
    merged.sort((a, b) => {
      if (a.trainAs !== b.trainAs) return a.trainAs === 'white' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // ✅ update UI immediately
    set({ chapterMeta: merged });

    // ✅ persist index list
    await movesDB.setAllChapterMeta(merged);

    // 5) Optionally activate first newly added chapter
    await get().setActiveChapterById(chapters[0].id);
  },

  importIntoChapter: async (targetChapterId: string, newPgn: string) => {
    // load runtime chapter if not active
    let { activeChapter } = get();
    if (!activeChapter || activeChapter.id !== targetChapterId) {
      await get().setActiveChapterById(targetChapterId);
      activeChapter = get().activeChapter;
    }
    if (!activeChapter) return;

    const chapter = activeChapter;
    const { root: importRoot } = rootFromPgn(newPgn, chapter.trainAs);

    // mutate runtime tree
    merge(chapter.root, importRoot);

    set({ activeChapter: { ...chapter } });

    // structural change -> simplest correct: persist full chapter
    await persistFullChapter(chapter);
    // await get().refreshChapterMeta();
  },

  deleteChapterById: async (chapterId: string) => {
    const { chapterMeta, activeChapterId } = get();

    // 1️⃣ Remove from meta list
    const nextMeta = chapterMeta.filter((m) => m.id !== chapterId);

    // 2️⃣ Persist meta list
    await setChapterMetaInIDB(nextMeta);

    // 3️⃣ Update Zustand
    set({ chapterMeta: nextMeta });

    // 4️⃣ If this chapter was active, clear or switch
    if (activeChapterId === chapterId) {
      if (nextMeta.length > 0) {
        // optional: auto-open next chapter
        await get().setActiveChapterById(nextMeta[0].id);
      } else {
        // nothing left
        set({
          activeChapterId: null,
          activeChapter: null,
          selectedPath: '',
          selectedNode: null,
          trainableContext: undefined,
          userTip: 'init',
        });
      }
    }

    // 5️⃣ Delete full chapter data (nodes, edges, etc.)
    await deleteFullChapter(chapterId);
  },
}));
