// frontend/src/stores/state.ts
// Complete Zustand store with PouchDB push-only sync
// Changes to localDB automatically push to remote ✅

import { create } from 'zustand';
import { localDB } from '../contexts/AuthContext';
import { ChildNode, startingPosition } from 'chessops/pgn';
import { INITIAL_FEN } from 'chessops/fen';
import {
  Chapter,
  TrainableContext,
  TrainingConfig,
  TrainingData,
  TrainingMethod,
  TrainingOutcome,
} from '../types/training';
import { Config as CbConfig } from 'chessground/config';
import { defaults } from '../util/config';
import { computeNextTrainableNode } from '../util/training';
import { currentTime } from '../util/chess';

// ============================================================================
// HELPERS
// ============================================================================

const getUserId = (): string => {
  return sessionStorage.getItem('userId') || 'anonymous';
};

const idIndex = (userId: string) => `index:${userId}`;
const idChapter = (userId: string, chapterId: string) => `chapter:${userId}:${chapterId}`;
const idNode = (userId: string, chapterId: string, nodeIdx: number) =>
  `node:${userId}:${chapterId}:${nodeIdx}`;

async function upsertDoc<T extends { _id: string; _rev?: string }>(
  docId: string,
  updateFn: (current: T | null) => T,
): Promise<T> {
  try {
    const existing = await localDB.get<T>(docId);
    const updated = updateFn(existing);
    updated._rev = existing._rev;
    const result = await localDB.put(updated);
    return { ...updated, _rev: result.rev };
  } catch (err: any) {
    if (err.status === 404) {
      const newDoc = updateFn(null);
      const result = await localDB.put(newDoc);
      return { ...newDoc, _rev: result.rev };
    }
    throw err;
  }
}

// Load chapter tree from node documents
//TODO look at API for other find options...
async function loadChapterTree(userId: string, chapterId: string) {
  const result = await localDB.find({
    selector: { type: 'node', userId, chapterId },
    limit: 99999,
  });

  const nodes = result.docs;
  console.log('NODES FROM IDB ONLY 25', nodes);
  const nodeMap = new Map();

  //TODO don't keep all these fields..
  nodes.forEach((doc) => {
    nodeMap.set(doc.nodeIdx, {
      data: {
        idx: doc.nodeIdx,
        id: doc.moveId,
        ply: doc.ply,
        san: doc.san,
        fen: doc.fen,
        comment: doc.comment,
        training: doc.training,
      },
      children: [],
    });
  });

  //TODO create root constant?
  const root = {
    data: {
      idx: -1,
      id: '',
      ply: 0,
      san: '',
      fen: INITIAL_FEN,
      comment: '',
      training: { disabled: false, seen: false, group: -1, dueAt: -1 },
    },
    children: [],
  };

  nodes.sort((a, b) => {
    if (a.parentIdx !== b.parentIdx) return a.parentIdx - b.parentIdx;
    return a.ord - b.ord;
  });

  nodes.forEach((doc) => {
    const node = nodeMap.get(doc.nodeIdx);
    if (doc.parentIdx === -1) {
      root.children.push(node);
    } else {
      const parent = nodeMap.get(doc.parentIdx);
      if (parent) parent.children.push(node);
    }
  });

  return root;
}

// Flatten tree to node documents
function flattenTree(userId: string, chapter: any) {
  const docs = [];

  //TODO Don't need every field! Also, simplify training field..
  const traverse = (node, parentIdx, ord) => {
    docs.push({
      _id: idNode(userId, chapter.id, node.data.idx),
      type: 'node',
      userId,
      chapterId: chapter.id,
      nodeIdx: node.data.idx,
      parentIdx,
      ord,
      ply: node.data.ply,
      moveId: node.data.id,
      san: node.data.san,
      fen: node.data.fen,
      comment: node.data.comment || '',
      training: node.data.training,
      updatedAt: Date.now(),
    });

    node.children.forEach((child, index) => {
      traverse(child, node.data.idx, index);
    });
  };

  chapter.root.children.forEach((child, index) => {
    traverse(child, -1, index);
  });

  return docs;
}

function getNodeList(root, path) {
  const list = [root];
  let current = root;

  for (let i = 0; i < path.length; i += 2) {
    const moveId = path.slice(i, i + 2);
    const child = current.children.find((c) => c.data.id === moveId);
    if (!child) break;
    list.push(child);
    current = child;
  }

  return list;
}

function nodeAtPath(root, path) {
  const list = getNodeList(root, path);
  return list[list.length - 1] || null;
}

function updateRecursive(root, path, updateFn) {
  const startNode = nodeAtPath(root, path);
  if (!startNode) return;

  const traverse = (node) => {
    updateFn(node);
    node.children.forEach(traverse);
  };

  traverse(startNode);
}

// ============================================================================
// STORE
// ============================================================================

//TODO separate interfaces folder?
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
  hydrateRepertoireFromDB: () => Promise<void>;

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
}

export const useTrainerStore = create<TrainerState>((set, get) => ({
  trainingMethod: 'unselected',
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
  repertoire: [],
  repertoireIndex: 0,
  showingAddToRepertoireMenu: false,
  showingImportIntoChapterModal: false,

  // Simple setters
  setTrainingMethod: (trainingMethod) => set({ trainingMethod }),
  setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),
  setShowingImportIntoChapterModal: (val) => set({ showingImportIntoChapterModal: val }),
  setRepertoireIndex: (i) => set({ repertoireIndex: i }),
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

  /**
   * Load all chapters from PouchDB
   * TODO should be ran after synced
   */
  hydrateRepertoireFromDB: async () => {
    const userId = getUserId();
    console.log('HYDRATING');

    try {
      const indexDoc = await localDB.get(idIndex(userId));
      const chapterIds = indexDoc.chapterIds || [];

      const chapters = await Promise.all(
        chapterIds.map(async (chapterId) => {
          const meta = await localDB.get(idChapter(userId, chapterId));
          const root = await loadChapterTree(userId, chapterId);

          return {
            id: meta.chapterId,
            name: meta.name,
            trainAs: meta.trainAs,
            root,
            lastDueCount: meta.lastDueCount,
            enabledCount: meta.enabledCount,
            bucketEntries: meta.bucketEntries,
            largestMoveId: meta.largestMoveId,
          };
        }),
      );

      set({ repertoire: chapters });
      console.log(`Loaded ${chapters.length} chapters`);
    } catch (err) {
      if (err.status === 404) {
        set({ repertoire: [] });
      } else {
        console.error('Load error:', err);
      }
    }
  },

  /**
   * Add new chapter - auto-pushes ✅
   */
  addNewChapter: async (chapter) => {
    const userId = getUserId();

    // Update index
    await upsertDoc(idIndex(userId), (current) => ({
      _id: idIndex(userId),
      type: 'index',
      userId,
      chapterIds: [...(current?.chapterIds || []), chapter.id],
      updatedAt: Date.now(),
    }));

    // Create chapter meta
    //TODO simplify
    await localDB.put({
      _id: idChapter(userId, chapter.id),
      type: 'chapter',
      userId,
      chapterId: chapter.id,
      name: chapter.name,
      trainAs: chapter.trainAs,
      lastDueCount: chapter.lastDueCount || 0,
      enabledCount: chapter.enabledCount || 0,
      bucketEntries: chapter.bucketEntries || [0, 0, 0, 0, 0],
      largestMoveId: chapter.largestMoveId || 0,
      updatedAt: Date.now(),
    });

    // Create nodes
    const nodeDocs = flattenTree(userId, chapter);
    if (nodeDocs.length > 0) {
      await localDB.bulkDocs(nodeDocs);
    }

    // Update in-memory
    set((state) => {
      const next = state.repertoire.slice();
      const insertAt = chapter.trainAs === 'white' ? 0 : next.length;
      next.splice(insertAt, 0, chapter);
      return { repertoire: next };
    });

    // Push happens automatically! ✅
  },

  /**
   * Delete chapter - auto-pushes ✅
   */

  //TODO does this actually delete everything?
  deleteChapterAt: async (chapterIndex) => {
    const { repertoire, repertoireIndex } = get();
    const chapter = repertoire[chapterIndex];
    if (!chapter) return;

    const userId = getUserId();

    // Delete nodes
    //TODO move DB operations to a different file?
    const result = await localDB.find({
      selector: { type: 'node', userId, chapterId: chapter.id },
    });

    const toDelete = result.docs.map((doc) => ({
      _id: doc._id,
      _rev: doc._rev,
      _deleted: true,
    }));

    if (toDelete.length > 0) {
      await localDB.bulkDocs(toDelete);
    }

    // Delete chapter
    try {
      const doc = await localDB.get(idChapter(userId, chapter.id));
      await localDB.remove(doc);
    } catch (err) {}

    // Update index

    await upsertDoc(idIndex(userId), (current) => ({
      ...current,
      chapterIds: current.chapterIds.filter((id) => id !== chapter.id),
      updatedAt: Date.now(),
    }));

    // Update in-memory
    const next = repertoire.slice();
    next.splice(chapterIndex, 1);

    let newIndex = repertoireIndex;
    if (next.length === 0) newIndex = -1;
    else if (chapterIndex <= repertoireIndex) newIndex = Math.max(0, repertoireIndex - 1);

    set({
      repertoire: next,
      repertoireIndex: newIndex,
      selectedPath: '',
      selectedNode: null,
      trainingMethod: 'unselected',
    });

    // Push happens automatically! ✅
  },

  /**
   * Rename chapter - auto-pushes ✅
   */
  renameChapter: async (chapterIndex, newName) => {
    const { repertoire } = get();
    const chapter = repertoire[chapterIndex];
    if (!chapter) return;

    const userId = getUserId();

    await upsertDoc(idChapter(userId, chapter.id), (current) => ({
      ...current,
      name: newName,
      updatedAt: Date.now(),
    }));

    const next = repertoire.slice();
    next[chapterIndex] = { ...chapter, name: newName };
    set({ repertoire: next });

    // Push happens automatically! ✅
  },

  /**
   * Make a move - auto-pushes ✅
   */
  makeMove: async (san) => {
    const { selectedNode, repertoire, repertoireIndex, selectedPath, trainingMethod } = get();
    const chapter = repertoire[repertoireIndex];
    if (!chapter || !selectedNode) return;

    const userId = getUserId();

    // Check if exists
    const existing = selectedNode.children.find((c) => c.data.san === san);
    if (existing) {
      if (trainingMethod === 'edit') {
        set({
          selectedPath: selectedPath + existing.data.id,
          selectedNode: existing,
        });
      }
      return;
    }

    // Create new node (simplified - you need your chess logic here)
    const newNode = {
      data: {
        idx: ++chapter.largestMoveId,
        id: 'xx', // Use scalachessCharPair
        ply: selectedNode.data.ply + 1,
        san,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Use makeFen
        comment: '',
        training: { disabled: false, seen: false, group: -1, dueAt: -1 },
      },
      children: [],
    };

    selectedNode.children.push(newNode);

    // Save to PouchDB
    await localDB.put({
      _id: idNode(userId, chapter.id, newNode.data.idx),
      type: 'node',
      userId,
      chapterId: chapter.id,
      nodeIdx: newNode.data.idx,
      parentIdx: selectedNode.data.idx,
      ord: selectedNode.children.length - 1,
      ply: newNode.data.ply,
      moveId: newNode.data.id,
      san: newNode.data.san,
      fen: newNode.data.fen,
      comment: '',
      training: newNode.data.training,
      updatedAt: Date.now(),
    });

    // Update chapter meta
    await upsertDoc(idChapter(userId, chapter.id), (current) => ({
      ...current,
      largestMoveId: chapter.largestMoveId,
      updatedAt: Date.now(),
    }));

    // Update in-memory
    if (trainingMethod === 'edit') {
      set({
        repertoire: [...repertoire],
        selectedPath: selectedPath + newNode.data.id,
        selectedNode: newNode,
      });
    } else {
      set({ repertoire: [...repertoire] });
    }

    // Push happens automatically! ✅
  },

  /**
   * Set comment - auto-pushes ✅
   */
  setCommentAt: async (comment, path) => {
    const { repertoire, repertoireIndex } = get();
    const chapter = repertoire[repertoireIndex];
    if (!chapter) return;

    const userId = getUserId();
    const node = nodeAtPath(chapter.root, path);
    if (!node) return;

    node.data.comment = comment;

    await upsertDoc(idNode(userId, chapter.id, node.data.idx), (current) => ({
      ...current,
      comment,
      updatedAt: Date.now(),
    }));

    set({ repertoire: [...repertoire] });

    // Push happens automatically! ✅
  },

  /**
   * Enable line - auto-pushes ✅
   */
  enableLine: async (path) => {
    const { repertoire, repertoireIndex } = get();
    const chapter = repertoire[repertoireIndex];
    if (!chapter) return;

    const userId = getUserId();
    const updatedNodes = [];

    updateRecursive(chapter.root, path, (node) => {
      if (node.data.training.disabled) {
        node.data.training.disabled = false;
        chapter.enabledCount++;
        updatedNodes.push(node.data.idx);
      }
    });

    // Update nodes in PouchDB
    const updates = await Promise.all(
      updatedNodes.map(async (idx) => {
        const doc = await localDB.get(idNode(userId, chapter.id, idx));
        return {
          ...doc,
          training: { ...doc.training, disabled: false },
          updatedAt: Date.now(),
        };
      }),
    );

    if (updates.length > 0) {
      await localDB.bulkDocs(updates);
    }

    // Update chapter meta
    await upsertDoc(idChapter(userId, chapter.id), (current) => ({
      ...current,
      enabledCount: chapter.enabledCount,
      updatedAt: Date.now(),
    }));

    set({ repertoire: [...repertoire] });

    // Push happens automatically! ✅
  },

  /**
   * Disable line - auto-pushes ✅
   */
  disableLine: async (path) => {
    const { repertoire, repertoireIndex } = get();
    const chapter = repertoire[repertoireIndex];
    if (!chapter) return;

    const userId = getUserId();
    const updatedNodes = [];

    updateRecursive(chapter.root, path, (node) => {
      if (!node.data.training.disabled) {
        node.data.training.disabled = true;
        chapter.enabledCount--;
        updatedNodes.push(node.data.idx);
      }
    });

    // Update nodes in PouchDB
    const updates = await Promise.all(
      updatedNodes.map(async (idx) => {
        const doc = await localDB.get(idNode(userId, chapter.id, idx));
        return {
          ...doc,
          training: { ...doc.training, disabled: true },
          updatedAt: Date.now(),
        };
      }),
    );

    if (updates.length > 0) {
      await localDB.bulkDocs(updates);
    }

    // Update chapter meta
    await upsertDoc(idChapter(userId, chapter.id), (current) => ({
      ...current,
      enabledCount: chapter.enabledCount,
      updatedAt: Date.now(),
    }));

    set({ repertoire: [...repertoire] });

    // Push happens automatically! ✅
  },

  /**
   * Training success - auto-pushes ✅
   * */

  succeed: async (): Promise<number | null> => {
    const { repertoire, repertoireIndex, trainableContext, trainingMethod, trainingConfig } = get();
    const userId = getUserId();

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
    await upsertDoc(idNode(userId, chapter.id, targetNode.data.idx), (current) => ({
      ...current,
      training: { ...targetNode.data.training },
      updatedAt: Date.now(),
    }));

    return timeToAdd;
  },

  /**
   * Training failure - auto-pushes ✅
   */
  fail: async () => {
    const { repertoire, repertoireIndex, trainableContext, trainingConfig } = get();
    const chapter = repertoire[repertoireIndex];
    const node = trainableContext?.targetMove;
    if (!chapter || !node) return;

    const userId = getUserId();

    let group = node.data.training.group;
    chapter.bucketEntries[group]--;
    group = Math.max(group - 1, 0);
    chapter.bucketEntries[group]++;

    const dueAt = Date.now() + trainingConfig.buckets[group] * 1000;
    node.data.training.group = group;
    node.data.training.dueAt = dueAt;

    await upsertDoc(idNode(userId, chapter.id, node.data.idx), (current) => ({
      ...current,
      training: { ...current.training, group, dueAt },
      updatedAt: Date.now(),
    }));

    set({ repertoire: [...repertoire] });

    // Push happens automatically! ✅
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

  // Navigation
  setRepertoireIndex: (index) => {
    set({
      repertoireIndex: index,
      selectedPath: '',
      selectedNode: null,
      trainingMethod: 'edit',
    });
  },

  clearChapterContext: () => {
    set({
      trainingMethod: 'unselected',
      selectedPath: '',
      selectedNode: null,
      trainableContext: null,
    });
  },

  jump: (path) => {
    const { repertoire, repertoireIndex } = get();
    const chapter = repertoire[repertoireIndex];
    if (!chapter) return;

    const nodeList = getNodeList(chapter.root, path);
    set({
      selectedPath: path,
      selectedNode: nodeList[nodeList.length - 1] || null,
    });
  },

  // TODO: Implement these based on your training logic
  deleteLine: async (path) => {
    console.log('deleteLine not yet implemented');
  },

  importIntoChapter: async (chapterIndex, pgn) => {
    console.log('importIntoChapter not yet implemented');
  },

  markAllAsSeen: async () => {
    console.log('markAllAsSeen not yet implemented');
  },

  updateDueCounts: () => {
    console.log('updateDueCounts not yet implemented');
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
}));

// // Zustand store integrated with PouchDB for offline-first persistence

// import { create } from 'zustand';
// import {
//   type Chapter,
//   type TrainableNode,
//   type Color,
//   saveChapter,
//   updateChapterMetadata,
//   saveNode,
//   flattenTree,
//   calculateDerivedMetadata,
//   deleteChapter,
//   loadAllChapters,
// } from '../lib/database';
// import { localDB, useAuth } from '../contexts/AuthContext';

// // Types
// type TrainingMethod = 'unselected' | 'learn' | 'recall' | 'edit';
// type UserTip = 'init' | 'empty' | 'learn' | 'recall' | 'edit';
// type TrainingOutcome = 'success' | 'alternate' | 'failure' | undefined;

// interface TrainableContext {
//   startingPath: string;
//   targetMove: TrainableNode;
// }

// interface TrainingConfig {
//   buckets: number[];
//   promotion: 'next' | 'most';
//   demotion: 'next' | 'most';
//   getNext?: (chapter: Chapter) => TrainableNode | null;
// }

// interface ChessboardConfig {
//   lastMove?: string;
//   drawable?: {
//     shapes: any[];
//   };
// }

// interface TrainerState {
//   // Training state
//   trainingMethod: TrainingMethod;
//   trainableContext?: TrainableContext;
//   selectedPath: string;
//   selectedNode: TrainableNode | null;
//   showingHint: boolean;
//   userTip: UserTip;
//   lastGuess: string;
//   showSuccessfulGuess: boolean;
//   dueTimes: number[];
//   trainingConfig: TrainingConfig;
//   cbConfig: ChessboardConfig;

//   // Repertoire state (in-memory)
//   repertoire: Chapter[];
//   repertoireIndex: number;

//   // UI state
//   showingAddToRepertoireMenu: boolean;
//   showingImportIntoChapterModal: boolean;

//   // Actions
//   setTrainingMethod: (method: TrainingMethod) => void;
//   setShowingAddToRepertoireMenu: (val: boolean) => void;
//   setShowingImportIntoChapterModal: (val: boolean) => void;
//   setRepertoireIndex: (i: number) => void;
//   setTrainableContext: (t?: TrainableContext) => void;
//   setSelectedPath: (path: string) => void;
//   setSelectedNode: (node: TrainableNode | null) => void;
//   setShowingHint: (v: boolean) => void;
//   setUserTip: (f: UserTip) => void;
//   setLastGuess: (g: string) => void;
//   setShowSuccessfulGuess: (val: boolean) => void;
//   setDueTimes: (t: number[]) => void;
//   setTrainingConfig: (cfg: TrainingConfig) => void;
//   setCbConfig: (cfg: ChessboardConfig) => void;

//   // Chapter management
//   hydrateRepertoireFromDB: () => Promise<void>;
//   addNewChapter: (chapter: Chapter) => Promise<void>;
//   renameChapter: (chapterIndex: number, newName: string) => Promise<void>;
//   deleteChapterAt: (chapterIndex: number) => Promise<void>;
//   importIntoChapter: (targetChapter: number, newPgn: string) => Promise<void>;

//   // Move management
//   jump: (path: string) => void;
//   makeMove: (san: string) => Promise<void>;
//   deleteLine: (path: string) => Promise<void>;
//   setCommentAt: (comment: string, path: string) => Promise<void>;

//   // Training
//   setNextTrainablePosition: () => void;
//   updateDueCounts: () => void;
//   clearChapterContext: () => void;
//   guess: (san: string) => TrainingOutcome;
//   succeed: () => Promise<number | null>;
//   fail: () => Promise<void>;
//   markAllAsSeen: () => Promise<void>;
//   disableLine: (path: string) => Promise<void>;
//   enableLine: (path: string) => Promise<void>;
// }

// // Helper to get localDB from auth context
// //TODO shouldnt be tied to auth?
// // const getLocalDB = () => {
// //   const { localDB } = useAuth();
// //   return localDB;
// // };

// // Default training config
// const defaults = (): TrainingConfig => ({
//   buckets: [86400, 172800, 345600, 691200, 1382400, 2764800, 5529600, 11059200, 22118400, 44236800],
//   promotion: 'next',
//   demotion: 'next',
// });

// export const useTrainerStore = create<TrainerState>()((set, get) => ({
//   // Initial state
//   trainingMethod: 'unselected',
//   trainableContext: undefined,
//   selectedPath: '',
//   selectedNode: null,
//   showingHint: false,
//   userTip: 'init',
//   lastGuess: '',
//   showSuccessfulGuess: false,
//   dueTimes: [],
//   trainingConfig: defaults(),
//   cbConfig: {},
//   repertoire: [],
//   repertoireIndex: 0,
//   showingAddToRepertoireMenu: false,
//   showingImportIntoChapterModal: false,

//   // Simple setters
//   setTrainingMethod: (trainingMethod) => set({ trainingMethod }),
//   setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),
//   setShowingImportIntoChapterModal: (val) => set({ showingImportIntoChapterModal: val }),
//   setRepertoireIndex: (i) => set({ repertoireIndex: i }),
//   setTrainableContext: (t) => set({ trainableContext: t }),
//   setSelectedPath: (path) => set({ selectedPath: path }),
//   setSelectedNode: (node) => set({ selectedNode: node }),
//   setShowingHint: (v) => set({ showingHint: v }),
//   setUserTip: (f) => set({ userTip: f }),
//   setLastGuess: (g) => set({ lastGuess: g }),
//   setShowSuccessfulGuess: (val) => set({ showSuccessfulGuess: val }),
//   setDueTimes: (t) => set({ dueTimes: t }),
//   setTrainingConfig: (cfg) => set({ trainingConfig: cfg }),
//   setCbConfig: (cfg) => set({ cbConfig: cfg }),

//   // ============================================================================
//   // Data Management
//   // ============================================================================

//   /**
//    * Load all chapters from PouchDB
//    */
//   hydrateRepertoireFromDB: async () => {

//     try {
//       const chapters = await loadAllChapters(localDB);
//       set({ repertoire: chapters });
//       console.log(`Loaded ${chapters.length} chapters from database`);
//     } catch (err) {
//       console.error('Failed to hydrate repertoire:', err);
//       set({ repertoire: [] });
//     }
//   },

//   /**
//    * Add a new chapter
//    */
//   addNewChapter: async (chapter: Chapter) => {

//     // Update in-memory state first (optimistic update)
//     set((state) => {
//       const next = state.repertoire.slice();
//       // Keep your white first, black last ordering logic
//       const insertAt = chapter.trainAs === 'white' ? 0 : next.length;
//       next.splice(insertAt, 0, chapter);
//       return { repertoire: next };
//     });

//     // Persist to PouchDB (syncs automatically)
//     //TODO this should never fail? why cant we save to localDB?
//     try {
//       await saveChapter(localDB, chapter);
//       console.log(`Chapter "${chapter.name}" saved to database`);
//     } catch (err) {
//       console.error('Failed to save chapter:', err);
//       // Rollback on error
//       set((state) => ({
//         repertoire: state.repertoire.filter((c) => c.id !== chapter.id),
//       }));
//       throw err;
//     }
//   },

//   /**
//    * Rename a chapter
//    */
//   renameChapter: async (chapterIndex: number, newName: string) => {
//     const { repertoire } = get();
//     const chapter = repertoire[chapterIndex];
//     if (!chapter) return;

//     // Update in-memory
//     set((state) => {
//       const next = state.repertoire.slice();
//       next[chapterIndex] = { ...next[chapterIndex], name: newName };
//       return { repertoire: next };
//     });

//     // Persist to database
//     try {
//       await updateChapterMetadata(localDB, chapter.id, { name: newName });
//     } catch (err) {
//       console.error('Failed to rename chapter:', err);
//       // Could rollback here if desired
//     }
//   },

//   /**
//    * Delete a chapter
//    */
//   deleteChapterAt: async (chapterIndex: number) => {
//     const { repertoire, repertoireIndex } = get();
//     const chapter = repertoire[chapterIndex];
//     if (!chapter) return;

//     const nextRepertoire = repertoire.slice();
//     nextRepertoire.splice(chapterIndex, 1);

//     // Calculate new index
//     let nextIndex = repertoireIndex;
//     if (nextRepertoire.length === 0) nextIndex = 0;
//     else if (chapterIndex < repertoireIndex) nextIndex = Math.max(0, repertoireIndex - 1);
//     else if (chapterIndex === repertoireIndex)
//       nextIndex = Math.min(repertoireIndex, nextRepertoire.length - 1);

//     // Update in-memory
//     set({
//       repertoire: nextRepertoire,
//       repertoireIndex: nextIndex,
//       selectedPath: '',
//       selectedNode: null,
//       trainableContext: undefined,
//       userTip: 'empty',
//     });

//     // Delete from database
//     try {
//       await deleteChapter(localDB, chapter.id);
//       console.log(`Chapter "${chapter.name}" deleted`);
//     } catch (err) {
//       console.error('Failed to delete chapter:', err);
//     }
//   },

//   /**
//    * Import PGN into existing chapter
//    */
//   importIntoChapter: async (targetChapter: number, newPgn: string) => {
//     const { repertoire } = get();
//     const chapter = repertoire[targetChapter];
//     if (!chapter) return;

//     // Parse PGN and merge into tree
//     // (You'll need to implement rootFromPgn and merge functions)
//     // const { root: importRoot } = rootFromPgn(newPgn, chapter.trainAs);
//     // merge(chapter.root, importRoot);

//     // Recalculate enabled count
//     const nodeDocs = flattenTree(chapter.id, chapter.root);
//     const derived = calculateDerivedMetadata(nodeDocs);
//     chapter.enabledCount = derived.enabledCount;

//     // Update in-memory
//     set((state) => {
//       const next = state.repertoire.slice();
//       next[targetChapter] = { ...chapter };
//       return { repertoire: next };
//     });

//     // Persist to database
//     try {
//       await saveChapter(localDB, chapter);
//       console.log(`Imported moves into "${chapter.name}"`);
//     } catch (err) {
//       console.error('Failed to import moves:', err);
//     }
//   },

//   // ============================================================================
//   // Navigation
//   // ============================================================================

//   /**
//    * Jump to a specific position in the tree
//    */
//   jump: (path: string) => {
//     const { repertoire, repertoireIndex } = get();
//     const root = repertoire[repertoireIndex]?.root;
//     if (!root) return;

//     // You'll need to implement getNodeList
//     // const nodeList = getNodeList(root, path);
//     // set({ selectedPath: path, selectedNode: nodeList.at(-1) || null });
//   },

//   // ============================================================================
//   // Move Management
//   // ============================================================================

//   /**
//    * Make a move in the current position
//    */
//   makeMove: async (san: string) => {
//     const { selectedNode, repertoire, repertoireIndex, selectedPath, trainingMethod } = get();
//     const chapter = repertoire[repertoireIndex];
//     if (!chapter || !selectedNode) return;

//     // Check if move already exists
//     const existingChild = selectedNode.children.find((c) => c.data.san === san);

//     if (!existingChild) {
//       // Create new move node
//       // (You'll need to implement chess logic: positionFromFen, parseSan, makeSanAndPlay, makeFen)
//       const currentColor = selectedNode.data.ply % 2 === 0 ? 'white' : 'black';
//       const disabled = currentColor !== chapter.trainAs;

//       if (!disabled) chapter.enabledCount++;

//       const newNode: TrainableNode = {
//         data: {
//           training: {
//             disabled,
//             seen: false,
//             group: -1,
//             dueAt: -1,
//           },
//           id: san.toLowerCase().replace(/[^a-z0-9]/g, ''), // Simplified ID
//           idx: ++chapter.largestMoveId,
//           san,
//           fen: '', // You'll calculate this from chess.js or similar
//           ply: selectedNode.data.ply + 1,
//           comment: '',
//         },
//         children: [],
//       };

//       // Add to tree
//       selectedNode.children.push(newNode);

//       // Persist node
//       try {
//         const ord = selectedNode.children.length - 1;
//         await saveNode(localDB, chapter.id, newNode, selectedNode.data.idx, ord);

//         // Update chapter metadata
//         await updateChapterMetadata(localDB, chapter.id, {
//           largestMoveId: chapter.largestMoveId,
//         });

//         console.log(`Move ${san} added to chapter`);
//       } catch (err) {
//         console.error('Failed to save move:', err);
//         // Rollback
//         selectedNode.children.pop();
//         if (!disabled) chapter.enabledCount--;
//         chapter.largestMoveId--;
//         throw err;
//       }
//     }

//     // Navigate to the move if in edit mode
//     if (trainingMethod === 'edit') {
//       const targetNode = existingChild || selectedNode.children[selectedNode.children.length - 1];
//       const newPath = selectedPath + targetNode.data.id;
//       set({ selectedNode: targetNode, selectedPath: newPath });
//     }
//   },

//   /**
//    * Delete a line from the current position
//    */
//   deleteLine: async (path: string) => {
//     const { repertoire, repertoireIndex, selectedPath, jump } = get();
//     const chapter = repertoire[repertoireIndex];
//     const root = chapter?.root;
//     if (!root) return;

//     // const node = nodeAtPath(root, path);
//     // if (!node) return;

//     // Count enabled moves being deleted
//     // let deleteCount = 0;
//     // forEachNode(node, (n) => {
//     //   if (!n.data.training.disabled) deleteCount++;
//     // });

//     // deleteNodeAt(root, path);
//     // chapter.enabledCount -= deleteCount;

//     // Update in-memory
//     set((state) => {
//       const next = state.repertoire.slice();
//       next[repertoireIndex] = { ...next[repertoireIndex] };
//       return { repertoire: next };
//     });

//     // Persist
//     try {
//       await saveChapter(localDB, chapter);
//     } catch (err) {
//       console.error('Failed to delete line:', err);
//     }

//     // Adjust selection if needed
//     // if (contains(selectedPath, path)) jump(init(path));
//     // else jump(path);
//   },

//   /**
//    * Set comment on a node
//    */
//   setCommentAt: async (comment: string, path: string) => {
//     const { repertoire, repertoireIndex } = get();
//     const chapter = repertoire[repertoireIndex];
//     if (!chapter) return;

//     // You'll need to implement nodeAtPath
//     // const node = nodeAtPath(chapter.root, path);
//     // if (!node) return;
//     // node.data.comment = comment;

//     // Persist
//     try {
//       // await saveNode(localDB, chapter.id, node, parentIdx, ord);
//       console.log('Comment saved');
//     } catch (err) {
//       console.error('Failed to save comment:', err);
//     }
//   },

//   // ============================================================================
//   // Training
//   // ============================================================================

//   /**
//    * Set up the next trainable position
//    */
//   setNextTrainablePosition: () => {
//     const { trainingMethod, repertoireIndex, repertoire, trainingConfig } = get();
//     if (repertoireIndex === -1 || trainingMethod === 'edit') return;

//     const chapter = repertoire[repertoireIndex];
//     if (!chapter) return;

//     // You'll need to implement computeNextTrainableNode
//     // const maybeContext = computeNextTrainableNode(
//     //   chapter.root,
//     //   trainingMethod,
//     //   trainingConfig.getNext
//     // );

//     // if (!maybeContext) {
//     //   set({
//     //     userTip: 'empty',
//     //     selectedPath: '',
//     //     selectedNode: null,
//     //     trainableContext: undefined
//     //   });
//     // } else {
//     //   const targetPath = maybeContext.startingPath;
//     //   const nodeList = getNodeList(chapter.root, targetPath);
//     //   set({
//     //     selectedPath: targetPath,
//     //     selectedNode: nodeList.at(-1) || null,
//     //     trainableContext: maybeContext,
//     //     userTip: trainingMethod,
//     //   });
//     // }
//   },

//   /**
//    * Update due counts for current chapter
//    */
//   updateDueCounts: () => {
//     const { repertoire, repertoireIndex, trainingConfig } = get();
//     if (repertoireIndex < 0) return;

//     const chapter = repertoire[repertoireIndex];
//     if (!chapter) return;

//     // You'll need to implement computeDueCounts
//     // const counts = computeDueCounts(chapter.root, trainingConfig.buckets);

//     set((state) => {
//       const nextRepertoire = state.repertoire.slice();
//       const nextChapter = { ...nextRepertoire[repertoireIndex] };
//       // nextChapter.lastDueCount = counts[0];
//       nextRepertoire[repertoireIndex] = nextChapter;

//       return {
//         // dueTimes: counts,
//         repertoire: nextRepertoire,
//       };
//     });
//   },

//   /**
//    * Clear chapter context
//    */
//   clearChapterContext: () => {
//     set({
//       trainingMethod: 'unselected',
//       selectedPath: '',
//       userTip: 'empty',
//       cbConfig: { lastMove: undefined, drawable: { shapes: [] } },
//       selectedNode: null,
//     });
//   },

//   /**
//    * Make a guess during training
//    */
//   guess: (san: string): TrainingOutcome => {
//     const { repertoire, repertoireIndex, trainableContext, trainingMethod } = get();
//     const chapter = repertoire[repertoireIndex];
//     if (!chapter || trainingMethod === 'learn') return;

//     const pathToTrain = trainableContext?.startingPath;
//     if (!pathToTrain) return;

//     // You'll need to implement getNodeList
//     // const trainableNodeList = getNodeList(chapter.root, pathToTrain);
//     // const possibleMoves = trainableNodeList.at(-1)?.children.map(c => c.data.san) || [];

//     set({ lastGuess: san });

//     // const target = trainableContext.targetMove;
//     // return possibleMoves.includes(san)
//     //   ? (target.data.san === san ? 'success' : 'alternate')
//     //   : 'failure';
//   },

//   /**
//    * Handle successful training attempt
//    */
//   succeed: async (): Promise<number | null> => {
//     const { repertoire, repertoireIndex, trainableContext, trainingMethod, trainingConfig } = get();
//     const targetNode = trainableContext?.targetMove;
//     const chapter = repertoire[repertoireIndex];
//     if (!chapter || !targetNode) return null;

//     let timeToAdd = 0;

//     switch (trainingMethod) {
//       case 'recall': {
//         let groupIndex = targetNode.data.training.group;
//         chapter.bucketEntries[groupIndex]--;

//         switch (trainingConfig.promotion) {
//           case 'most':
//             groupIndex = trainingConfig.buckets.length - 1;
//             break;
//           case 'next':
//             groupIndex = Math.min(groupIndex + 1, trainingConfig.buckets.length - 1);
//             break;
//         }

//         chapter.bucketEntries[groupIndex]++;
//         timeToAdd = trainingConfig.buckets[groupIndex];
//         targetNode.data.training.group = groupIndex;
//         break;
//       }

//       case 'learn': {
//         targetNode.data.training.seen = true;
//         timeToAdd = trainingConfig.buckets[0];
//         targetNode.data.training.group = 0;
//         chapter.bucketEntries[0]++;
//         break;
//       }
//     }

//     const now = Math.floor(Date.now() / 1000);
//     targetNode.data.training.dueAt = now + timeToAdd;

//     // Persist
//     try {
//       // await saveNode(localDB, chapter.id, targetNode, parentIdx, ord);
//       console.log('Training progress saved');
//     } catch (err) {
//       console.error('Failed to save training progress:', err);
//     }

//     return timeToAdd;
//   },

//   /**
//    * Handle failed training attempt
//    */
//   fail: async () => {
//     const { repertoire, repertoireIndex, trainableContext, trainingMethod, trainingConfig } = get();
//     const node = trainableContext?.targetMove;
//     const chapter = repertoire[repertoireIndex];
//     if (!chapter || !node) return;

//     if (trainingMethod === 'recall') {
//       let groupIndex = node.data.training.group;
//       chapter.bucketEntries[groupIndex]--;

//       switch (trainingConfig.demotion) {
//         case 'most':
//           groupIndex = 0;
//           break;
//         case 'next':
//           groupIndex = Math.max(groupIndex - 1, 0);
//           break;
//       }

//       chapter.bucketEntries[groupIndex]++;
//       const interval = trainingConfig.buckets[groupIndex];
//       node.data.training.group = groupIndex;

//       const now = Math.floor(Date.now() / 1000);
//       node.data.training.dueAt = now + interval;

//       // Persist
//       try {
//         // await saveNode(localDB, chapter.id, node, parentIdx, ord);
//         console.log('Training failure recorded');
//       } catch (err) {
//         console.error('Failed to save training failure:', err);
//       }
//     }
//   },

//   /**
//    * Mark all moves as seen
//    */
//   markAllAsSeen: async () => {
//     const { repertoireIndex, repertoire, trainingConfig } = get();
//     if (repertoireIndex < 0) return;

//     const chapter = repertoire[repertoireIndex];
//     if (!chapter) return;

//     const now = Math.floor(Date.now() / 1000);
//     const timeToAdd = trainingConfig.buckets[0];

//     // You'll need to implement updateRecursive
//     // updateRecursive(chapter.root, '', (node) => {
//     //   if (node.data.training.disabled) return;
//     //   if (node.data.training.seen) return;
//     //
//     //   chapter.bucketEntries[0]++;
//     //   node.data.training.seen = true;
//     //   node.data.training.group = 0;
//     //   node.data.training.dueAt = now + timeToAdd;
//     // });

//     set({ showSuccessfulGuess: false });

//     // Persist
//     try {
//       await saveChapter(localDB, chapter);
//       console.log('All moves marked as seen');
//     } catch (err) {
//       console.error('Failed to mark all as seen:', err);
//     }
//   },

//   /**
//    * Disable a line
//    */
//   disableLine: async (path: string) => {
//     const { repertoire, repertoireIndex } = get();
//     const chapter = repertoire[repertoireIndex];
//     if (!chapter) return;

//     // You'll need to implement updateRecursive
//     // updateRecursive(chapter.root, path, (node) => {
//     //   if (!node.data.training.disabled) {
//     //     chapter.enabledCount--;
//     //     node.data.training.disabled = true;
//     //   }
//     // });

//     // Update in-memory
//     set((state) => {
//       const next = state.repertoire.slice();
//       next[repertoireIndex] = { ...next[repertoireIndex] };
//       return { repertoire: next };
//     });

//     // Persist
//     try {
//       await saveChapter(localDB, chapter);
//       console.log('Line disabled');
//     } catch (err) {
//       console.error('Failed to disable line:', err);
//     }
//   },

//   /**
//    * Enable a line
//    */
//   enableLine: async (path: string) => {
//     const { repertoire, repertoireIndex } = get();
//     const chapter = repertoire[repertoireIndex];
//     if (!chapter) return;

//     const trainAs = chapter.trainAs;

//     // You'll need to implement updateRecursive and colorFromPly
//     // updateRecursive(chapter.root, path, (node) => {
//     //   const color = colorFromPly(node.data.ply);
//     //   if (trainAs === color && node.data.training.disabled) {
//     //     chapter.enabledCount++;
//     //     node.data.training.disabled = false;
//     //   }
//     // });

//     // Update in-memory
//     set((state) => {
//       const next = state.repertoire.slice();
//       next[repertoireIndex] = { ...next[repertoireIndex] };
//       return { repertoire: next };
//     });

//     // Persist
//     try {
//       await saveChapter(localDB, chapter);
//       console.log('Line enabled');
//     } catch (err) {
//       console.error('Failed to enable line:', err);
//     }
//   },
// }));

// // //TODO UI flags in state

// // trainerStore.pouch.ts
// // Minimal working PouchDB setup for:
// //  - hydrateRepertoireFromDB()
// //  - addNewChapter()
// // Storage model: index doc + chapter meta doc + node docs (flattened)
// // Local DB persists to IndexedDB automatically.

// import { create } from 'zustand';
// import { persist, StateStorage } from 'zustand/middleware';
// import PouchDB from 'pouchdb';
// import PouchIdb from 'pouchdb-adapter-idb';

// PouchDB.plugin(PouchIdb);

// import {
//   Chapter,
//   Color,
//   TrainableNode,
//   TrainingData,
//   TrainingMethod,
//   TrainingConfig,
//   TrainableContext,
// } from '../types/training';
// import { useAuthStore } from './AuthContext';
// import { defaults } from '../util/config';
// import { makeLocalDB } from '../util/pouch';

// // -------------------- Docs --------------------

// type IndexDoc = {
//   _id: string;
//   _rev?: string;
//   type: 'index';
//   sub: string;
//   chapterIds: string[];
//   updatedAt: number;
// };

// type ChapterMetaDoc = {
//   _id: string;
//   _rev?: string;
//   type: 'chapter';
//   sub: string;
//   chapterId: string;

//   name: string;
//   trainAs: Color;
//   lastDueCount: number;
//   enabledCount: number;
//   bucketEntries: number[];
//   largestMoveId: number;

//   updatedAt: number;
// };

// type NodeDoc = {
//   _id: string;
//   _rev?: string;
//   type: 'node';
//   sub: string;
//   chapterId: string;

//   idx: number;
//   parentIdx: number | null;
//   ord: number;

//   ply: number;
//   id: string;
//   san: string;
//   fen: string;
//   comment: string;

//   training: {
//     disabled: boolean;
//     seen: boolean;
//     group: number;
//     dueAt: number;
//   };

//   updatedAt: number;
// };

// // -------------------- ID helpers --------------------

// const idIndex = (sub: string) => `index:${sub}`;
// const idChapter = (sub: string, chapterId: string) => `chapter:${sub}:${chapterId}`;
// const idNode = (sub: string, chapterId: string, idx: number) => `node:${sub}:${chapterId}:${idx}`;

// async function upsertWithRetry<T extends { _id: string; _rev?: string }>(
//   db: PouchDB.Database,
//   docId: string,
//   mutate: (cur: T | null) => T,
//   tries = 6,
// ): Promise<void> {
//   for (let i = 0; i < tries; i++) {
//     try {
//       let cur: T | null = null;
//       try {
//         cur = await db.get<T>(docId);
//       } catch (e: any) {
//         if (e?.status !== 404) throw e;
//       }
//       const next = mutate(cur);
//       if (cur?._rev) next._rev = cur._rev;
//       await db.put(next);
//       return;
//     } catch (e: any) {
//       if (e?.status === 409) continue;
//       throw e;
//     }
//   }
//   throw new Error(`upsertWithRetry failed for ${docId}`);
// }

// // -------------------- Flatten / Build --------------------

// // NOTE: assumes every node.data.idx is unique per chapter and root has idx.
// // parentIdx for root => null, ord => 0
// function flattenTreeToNodeDocs(sub: string, chapter: Chapter): NodeDoc[] {
//   const out: NodeDoc[] = [];
//   const now = Date.now();

//   const walk = (node: TrainableNode, parentIdx: number | null, ord: number) => {
//     out.push({
//       _id: idNode(sub, chapter.id, node.data.idx),
//       type: 'node',
//       sub,
//       chapterId: chapter.id,

//       idx: node.data.idx,
//       parentIdx,
//       ord,

//       ply: node.data.ply,
//       id: node.data.id,
//       san: node.data.san,
//       fen: node.data.fen,
//       comment: node.data.comment ?? '',

//       training: {
//         disabled: !!node.data.training.disabled,
//         seen: !!node.data.training.seen,
//         group: Number(node.data.training.group),
//         dueAt: Number(node.data.training.dueAt),
//       },

//       updatedAt: now,
//     });

//     node.children.forEach((child, childOrd) => walk(child, node.data.idx, childOrd));
//   };

//   walk(chapter.root, null, 0);
//   return out;
// }

// function buildTreeFromNodeDocs(nodes: NodeDoc[]): TrainableNode {
//   const map = new Map<number, TrainableNode>();

//   for (const n of nodes) {
//     map.set(n.idx, {
//       data: {
//         training: { ...n.training },
//         ply: n.ply,
//         id: n.id,
//         idx: n.idx,
//         san: n.san,
//         fen: n.fen,
//         comment: n.comment ?? '',
//       } as TrainingData,
//       children: [],
//     });
//   }

//   for (const n of nodes) {
//     if (n.parentIdx == null) continue;
//     const parent = map.get(n.parentIdx);
//     const child = map.get(n.idx);
//     if (!parent || !child) continue;
//     parent.children[n.ord] = child;
//   }

//   // compact holes
//   for (const node of map.values()) node.children = node.children.filter(Boolean);

//   const rootDoc = nodes.find((x) => x.parentIdx == null);
//   if (!rootDoc) throw new Error('No root node found for chapter');
//   const root = map.get(rootDoc.idx);
//   if (!root) throw new Error('Root node missing in map');
//   return root;
// }

// // -------------------- DB --------------------

// // function makeLocalDB(sub: string) {
// //   // local DB is per-user (by Google sub)
// //   return new PouchDB(`chessrepeat_${sub}`);
// // }

// // -------------------- Store --------------------

// interface TrainerState {
//   // minimal UI state
//   trainingMethod: TrainingMethod;
//   setTrainingMethod: (m: TrainingMethod) => void;

//   trainingConfig: TrainingConfig;
//   setTrainingConfig: (c: TrainingConfig) => void;

//   repertoire: Chapter[];
//   repertoireIndex: number;

//   // pouch
//   localDb: PouchDB.Database;
//   initDbFromAuth: () => void;

//   // the two actions you asked for
//   hydrateRepertoireFromDB: () => Promise<void>;
//   addNewChapter: (chapter: Chapter) => Promise<void>;

//   // (optional) helper
//   setRepertoireIndex: (i: number) => void;

//   // UI flags
//   showingAddToRepertoireMenu: boolean;
//   setShowingAddToRepertoireMenu: (val: boolean) => void;
// }

// // If you still want zustand/persist for tiny UI stuff, keep it.
// // PouchDB handles the chapters, so we do NOT persist repertoire in zustand.
// const dummyStorage: StateStorage = {
//   getItem: async () => null,
//   setItem: async () => {},
//   removeItem: async () => {},
// };

// export const useTrainerStore = create<TrainerState>()(
//   persist(
//     (set, get) => ({
//       trainingMethod: 'unselected',
//       setTrainingMethod: (trainingMethod) => set({ trainingMethod }),

//       trainingConfig: defaults(),
//       setTrainingConfig: (trainingConfig) => set({ trainingConfig }),

//       repertoire: [],
//       repertoireIndex: 0,
//       setRepertoireIndex: (repertoireIndex) => set({ repertoireIndex }),

//       localDb: null, //TODO should always be initialized

//       showingAddToRepertoireMenu: false,
//       setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),

//       // Call this once after auth (or on app boot if auth already hydrated)
//       initDbFromAuth: () => {
//         const sub = useAuthStore.getState().sub;
//         if (!sub) return;
//         if (get().localDb) return; // already initialized
//         set({ localDb: makeLocalDB('chessrepeat_guest') });
//       },

//       hydrateRepertoireFromDB: async () => {
//         const sub = useAuthStore.getState().sub;
//         const db = get().localDb;
//         if (!sub || !db) return;

//         // 1) load index (list of chapterIds)
//         let idx: IndexDoc | null = null;
//         try {
//           idx = await db.get<IndexDoc>(idIndex(sub));
//         } catch (e: any) {
//           if (e?.status !== 404) throw e;
//         }

//         const chapterIds = idx?.chapterIds ?? [];
//         if (!chapterIds.length) {
//           set({ repertoire: [] });
//           return;
//         }

//         // 2) fetch meta docs in one go
//         const metaRes = await db.allDocs<ChapterMetaDoc>({
//           keys: chapterIds.map((cid) => idChapter(sub, cid)),
//           include_docs: true,
//         });

//         const chapters: Chapter[] = [];

//         for (const row of metaRes.rows) {
//           const meta = row.doc;
//           if (!meta) continue;

//           // 3) fetch all nodes for this chapter by prefix scan
//           const nodesRes = await db.allDocs<NodeDoc>({
//             include_docs: true,
//             startkey: `node:${sub}:${meta.chapterId}:`,
//             endkey: `node:${sub}:${meta.chapterId}:\ufff0`,
//           });

//           const nodes = nodesRes.rows.map((r) => r.doc).filter(Boolean) as NodeDoc[];
//           const root = buildTreeFromNodeDocs(nodes);

//           chapters.push({
//             id: meta.chapterId,
//             name: meta.name,
//             lastDueCount: meta.lastDueCount,
//             trainAs: meta.trainAs,
//             enabledCount: meta.enabledCount,
//             bucketEntries: meta.bucketEntries,
//             largestMoveId: meta.largestMoveId,
//             root,
//           } as Chapter);
//         }

//         set({ repertoire: chapters });
//       },

//       addNewChapter: async (chapter: Chapter) => {
//         const sub = useAuthStore.getState().sub;
//         const db = get().localDb;
//         if (!sub || !db) return;

//         // ---- memory first (fast UI) ----
//         set((state) => {
//           const next = state.repertoire.slice();
//           const insertAt = chapter.trainAs === 'white' ? 0 : next.length;
//           next.splice(insertAt, 0, chapter);
//           return { repertoire: next };
//         });

//         //TODO differnet mechanism to handle conflicts?
//         // ---- persist: index doc ----
//         await upsertWithRetry<IndexDoc>(db, idIndex(sub), (cur) => {
//           const base: IndexDoc =
//             cur ?? ({ _id: idIndex(sub), type: 'index', sub, chapterIds: [], updatedAt: 0 } as IndexDoc);
//           if (!base.chapterIds.includes(chapter.id)) base.chapterIds.push(chapter.id);
//           base.updatedAt = Date.now();
//           return base;
//         });

//         // ---- persist: chapter meta ----
//         const meta: ChapterMetaDoc = {
//           _id: idChapter(sub, chapter.id),
//           type: 'chapter',
//           sub,
//           chapterId: chapter.id,
//           name: chapter.name,
//           trainAs: chapter.trainAs,
//           lastDueCount: chapter.lastDueCount,
//           enabledCount: chapter.enabledCount,
//           bucketEntries: chapter.bucketEntries,
//           largestMoveId: chapter.largestMoveId,
//           updatedAt: Date.now(),
//         };

//         //TODO dont need to propagate chapter info?
//         await upsertWithRetry<ChapterMetaDoc>(db, meta._id, (cur) =>
//           cur ? { ...meta, _rev: cur._rev } : meta,
//         );

//         // ---- persist: nodes (bulk) ----
//         // For 10k nodes, you probably want batching; this is minimal so we do one bulk.
//         const nodeDocs = flattenTreeToNodeDocs(sub, chapter);
//         await db.bulkDocs(nodeDocs);
//       },
//     }),
//     {
//       name: 'trainer-store',
//       storage: dummyStorage,
//       partialize: (s) => ({
//         trainingMethod: s.trainingMethod,
//         trainingConfig: s.trainingConfig,
//         repertoireIndex: s.repertoireIndex,
//       }),
//       onRehydrateStorage: () => {
//         return async (state, err) => {
//           if (err || !state) return;
//           // initialize pouch db (local) after auth store is ready
//           state.initDbFromAuth();
//           // hydrate chapters from pouch
//           await state.hydrateRepertoireFromDB();
//         };
//       },
//     },
//   ),
// );

// import { create } from 'zustand';
// import { persist, StateStorage } from 'zustand/middleware';
// import { get, set, del } from 'idb-keyval';

// import { Config as CbConfig } from 'chessground/config';
// import {
//   Chapter,
//   Color,
//   MoveRow,
//   TrainableContext,
//   TrainableNode,
//   TrainingConfig,
//   TrainingData,
//   TrainingMethod,
//   TrainingOutcome,
// } from '../types/training';
// import { ChildNode } from 'chessops/pgn';
// import { defaults } from '../util/config';
// import { deleteNodeAt, forEachNode, getNodeList, nodeAtPath, updateRecursive } from '../util/tree';
// import { contains, init } from '../util/path';
// import { computeDueCounts, computeNextTrainableNode, merge } from '../util/training';
// import { colorFromPly, currentTime, positionFromFen } from '../util/chess';
// import { makeSanAndPlay, parseSan } from 'chessops/san';
// import { scalachessCharPair } from 'chessops/compat';
// import { makeFen } from 'chessops/fen';
// import { rootFromPgn } from '../util/io';
// import { useAuthStore } from './auth';
// import {
//   apiAddMove,
//   apiEditMoves,
//   apiGetChapters,
//   apiTrainMove,
//   MoveEdit,
//   postChapter,
// } from '../api/chapter';
// import { rebuildChapter } from '../api/util';

// interface TrainerState {
//   /* UI Flags */
//   trainingMethod: TrainingMethod;
//   setTrainingMethod: (m: TrainingMethod) => void;

//   showingAddToRepertoireMenu: boolean;
//   setShowingAddToRepertoireMenu: (val: boolean) => void;

//   showingImportIntoChapterModal: boolean;
//   setShowingImportIntoChapterModal: (val: boolean) => void;

//   repertoire: Chapter[];
//   setRepertoire: (r: Chapter[]) => Promise<void>; // now async (writes per chapter)

//   repertoireIndex: number;
//   setRepertoireIndex: (i: number) => void;

//   trainableContext: TrainableContext | undefined;
//   setTrainableContext: (t: TrainableContext) => void;

//   selectedPath: string;
//   setSelectedPath: (p: string) => void;

//   selectedNode: ChildNode<TrainingData>;
//   setSelectedNode: (n: any) => void;

//   showingHint: boolean;
//   setShowingHint: (v: boolean) => void;

//   userTip: string;
//   setUserTip: (f: string) => void;

//   lastGuess: string;
//   setLastGuess: (g: string) => void;

//   showSuccessfulGuess: boolean;
//   setShowSuccessfulGuess: (val: boolean) => void;

//   dueTimes: number[];
//   setDueTimes: (t: number[]) => void;

//   trainingConfig: TrainingConfig;
//   setTrainingConfig: (config: TrainingConfig) => void;

//   cbConfig: CbConfig;
//   setCbConfig: (cfg: CbConfig) => void;

//   // NEW: hydrate chapters from IDB after persist rehydrates small state
//   hydrateRepertoireFromIDB: () => Promise<void>;

//   jump: (path: string) => void;
//   makeMove: (san: string) => Promise<void>;

//   clearChapterContext: () => void;
//   setCommentAt: (comment: string, path: string) => Promise<void>;
//   updateDueCounts: () => void;
//   setNextTrainablePosition: () => void;
//   succeed: () => number | null;
//   fail: () => void;
//   guess: (san: string) => TrainingOutcome;

//   // higher-level ops
//   markAllAsSeen: () => Promise<void>;
//   disableLine: (path: string) => Promise<void>;
//   deleteLine: (path: string) => Promise<void>;
//   enableLine: (path: string) => Promise<void>;
//   addNewChapter: (chapter: Chapter) => Promise<void>;
//   importIntoChapter: (targetChapter: number, newPgn: string) => Promise<void>;

//   renameChapter: (index: number, name: string) => void;
//   deleteChapterAt: (index: number) => void;
//   refreshFromDb: () => void;
//   uploadChapter: (chapter: Chapter) => void;
//   syncChapter: (chapterIndex: number) => void;
//   editRemote: (chapterIndex: number, apiCall) => void;
// }

// /**
//  * ---------- IndexedDB keys ----------
//  * We store each chapter separately so we never write the whole repertoire blob.
//  *
//  * - trainer:chapters         -> string[] (chapter ids)
//  * - trainer:chapter:<cid>    -> Chapter (full chapter blob)
//  */
// const KEYS = {
//   chapterIds: 'trainer:chapters' as const,
//   chapter: (cid: string) => `trainer:chapter:${cid}`,
// };

// async function writeChapterIds(ids: string[]) {
//   await set(KEYS.chapterIds, ids);
// }
// async function readChapterIds(): Promise<string[]> {
//   return (await get(KEYS.chapterIds)) ?? [];
// }
// async function writeChapter(cid: string, chapter: Chapter) {
//   await set(KEYS.chapter(cid), chapter);
// }
// async function readChapter(cid: string): Promise<Chapter | null> {
//   return (await get(KEYS.chapter(cid))) ?? null;
// }
// async function deleteChapter(cid: string) {
//   await del(KEYS.chapter(cid));
// }

// // // ---- helpers (you already have these) ----
// // async function rewriteChapterIdsFromRepertoire(repertoire: Chapter[]) {
// //   const ids = repertoire.map((c) => c.id);
// //   await writeChapterIds(ids);
// // }

// // --- IndexedDB storage for zustand/persist (keep small) ---
// const indexedDBStorage: StateStorage = {
//   getItem: async (name) => {
//     const value = await get(name);
//     return value ?? null;
//   },
//   setItem: async (name, value) => {
//     await set(name, value);
//   },
//   removeItem: async (name) => {
//     await del(name);
//   },
// };

// // Helper: persist one chapter by index (in-memory -> IDB) and ensure id list is updated
// async function persistChapterByIndex(state: { repertoire: Chapter[] }, idx: number) {
//   const ch = state.repertoire[idx];
//   if (!ch) return;

//   const cid = ch.id;
//   await writeChapter(cid, ch);

//   const ids = await readChapterIds();
//   if (!ids.includes(cid)) {
//     await writeChapterIds([...ids, cid]);
//   }
// }

// // Helper: persist all chapters (used by setRepertoire)
// async function persistAllChapters(repertoire: Chapter[]) {
//   const ids: string[] = [];
//   for (const ch of repertoire) {
//     const cid = ch.id;
//     ids.push(cid);
//     await writeChapter(cid, ch);
//   }
//   await writeChapterIds(ids);
// }

// export const useTrainerStore = create<TrainerState>()(
//   persist(
//     (set, get) => ({
//       trainingMethod: 'unselected',
//       setTrainingMethod: (trainingMethod) => set({ trainingMethod }),

//       showingAddToRepertoireMenu: false,
//       setShowingAddToRepertoireMenu: (val) => set({ showingAddToRepertoireMenu: val }),

//       showingImportIntoChapterModal: false,
//       setShowingImportIntoChapterModal: (val) => set({ showingAddToRepertoireMenu: val }),

//       // in-memory only; loaded via hydrateRepertoireFromIDB
//       repertoire: [],
//       setRepertoire: async (repertoire) => {
//         // update memory first
//         set({ repertoire });

//         // persist per-chapter (NOT via zustand persist)
//         await persistAllChapters(repertoire);
//       },

//       repertoireIndex: 0,
//       setRepertoireIndex: (i) => set({ repertoireIndex: i }),

//       trainableContext: undefined,
//       setTrainableContext: (t) => set({ trainableContext: t }),

//       selectedPath: '',
//       setSelectedPath: (path) => set({ selectedPath: path }),

//       selectedNode: null,
//       setSelectedNode: (node) => set({ selectedNode: node }),

//       showingHint: false,
//       setShowingHint: (v) => set({ showingHint: v }),

//       userTip: 'init',
//       setUserTip: (f) => set({ userTip: f }),

//       lastGuess: '',
//       setLastGuess: (g) => set({ lastGuess: g }),

//       showSuccessfulGuess: false,
//       setShowSuccessfulGuess: (val) => set({ showSuccessfulGuess: val }),

//       dueTimes: [],
//       setDueTimes: (t) => set({ dueTimes: t }),

//       trainingConfig: defaults(),
//       setTrainingConfig: (cfg) => set({ trainingConfig: cfg }),

//       cbConfig: {},
//       setCbConfig: (cfg) => set({ cbConfig: cfg }),

//       // ---- inside create(...) actions ----
//       renameChapter: async (chapterIndex: number, newName: string) => {
//         const { repertoire } = get();
//         const chapter = repertoire[chapterIndex];
//         if (!chapter) return;

//         const cid = chapter.id;

//         // update in-memory (touch only that chapter)
//         set((state) => {
//           const next = state.repertoire.slice();
//           next[chapterIndex] = { ...next[chapterIndex], name: newName };
//           return { repertoire: next };
//         });

//         // persist only this chapter
//         await writeChapter(cid, { ...chapter, name: newName });
//       },

//       deleteChapterAt: async (chapterIndex: number) => {
//         const { repertoire, repertoireIndex } = get();
//         const chapter = repertoire[chapterIndex];
//         if (!chapter) return;

//         const cid = chapter.id;

//         const nextRepertoire = repertoire.slice();
//         nextRepertoire.splice(chapterIndex, 1);

//         let nextIndex = repertoireIndex;
//         if (nextRepertoire.length === 0) nextIndex = 0;
//         else if (chapterIndex < repertoireIndex) nextIndex = Math.max(0, repertoireIndex - 1);
//         else if (chapterIndex === repertoireIndex)
//           nextIndex = Math.min(repertoireIndex, nextRepertoire.length - 1);

//         set({
//           repertoire: nextRepertoire,
//           repertoireIndex: nextIndex,
//           selectedPath: '',
//           selectedNode: null,
//           trainableContext: null as any,
//           userTip: 'empty',
//         });

//         await deleteChapter(cid);

//         const ids = nextRepertoire.map((c) => c.id);
//         await writeChapterIds(ids);
//       },

//       // try to load from IDB on refresh
//       hydrateRepertoireFromDB: async () => {
//         const sub = useAuthStore.getState().sub; // from Google token
//         const db = get().localDb;
//         if (!sub || !db) return;

//         const chapters = await loadAllChapters(db, sub);
//         set({ repertoire: chapters });
//       },

//       addNewChapter: async (chapter: Chapter) => {
//         const sub = useAuthStore.getState().sub;
//         const db = get().localDb;
//         if (!sub || !db) return;

//         // Update memory
//         set((state) => {
//           const next = state.repertoire.slice();
//           // keep your “white first, black last” ordering logic
//           const insertAt = chapter.trainAs === 'white' ? 0 : next.length;
//           next.splice(insertAt, 0, chapter);
//           return { repertoire: next };
//         });

//         // Persist index doc
//         await upsertWithRetry<IndexDoc>(db, idIndex(sub), (cur) => {
//           const base: IndexDoc = cur ?? {
//             _id: idIndex(sub),
//             type: 'index',
//             sub,
//             chapterIds: [],
//             updatedAt: 0,
//           };
//           if (!base.chapterIds.includes(chapter.id)) base.chapterIds.push(chapter.id);
//           base.updatedAt = Date.now();
//           return base;
//         });

//         // Persist chapter meta doc
//         const meta: ChapterMetaDoc = {
//           _id: idChapter(sub, chapter.id),
//           type: 'chapter',
//           sub,
//           chapterId: chapter.id,
//           name: chapter.name,
//           trainAs: chapter.trainAs,
//           lastDueCount: chapter.lastDueCount,
//           enabledCount: chapter.enabledCount,
//           bucketEntries: chapter.bucketEntries,
//           largestMoveId: chapter.largestMoveId,
//           updatedAt: Date.now(),
//         };
//         await upsertWithRetry<ChapterMetaDoc>(db, meta._id, (cur) =>
//           cur ? { ...meta, _rev: cur._rev } : meta,
//         );

//         // Persist nodes (bulk)
//         const nodeDocs: NodeDoc[] = flattenTreeToNodeDocs(sub, chapter); // you implement using your existing traversal
//         await db.bulkDocs(nodeDocs);
//       },

//       jump: (path) => {
//         const { repertoire, repertoireIndex } = get();
//         const root = repertoire[repertoireIndex]?.root;
//         if (!root) return;
//         const nodeList = getNodeList(root, path);
//         set({ selectedPath: path, selectedNode: nodeList.at(-1) });
//       },

//       //TODO network actions for delete
//       deleteLine: async (path) => {
//         const { repertoire, repertoireIndex, selectedPath, jump } = get();
//         const chapter = repertoire[repertoireIndex];
//         const root = chapter?.root;
//         if (!root) return;

//         const node = nodeAtPath(root, path);
//         if (!node) return;

//         // count number of enabled moves we're deleted
//         let deleteCount = 0;
//         forEachNode(node, (node) => {
//           if (!node.data.training.disabled) deleteCount++;
//         });

//         deleteNodeAt(root, path);

//         chapter.enabledCount -= deleteCount;

//         // IMPORTANT: do NOT set({ repertoire }) anymore.
//         // Instead, touch just this chapter in-memory to re-render,
//         // and persist only this chapter to IDB.
//         set((state) => {
//           const next = state.repertoire.slice();
//           next[repertoireIndex] = { ...next[repertoireIndex] }; // shallow touch
//           return { repertoire: next };
//         });

//         await persistChapterByIndex(get(), repertoireIndex);

//         if (contains(selectedPath, path)) jump(init(path));
//         else jump(path);
//       },

//       setNextTrainablePosition: () => {
//         const { trainingMethod: method, repertoireIndex, repertoire, trainingConfig } = get();
//         if (repertoireIndex === -1 || method === 'edit') return null;
//         const chapter = repertoire[repertoireIndex];
//         if (!chapter) return;
//         const root = chapter.root;

//         const maybeTrainingContext = computeNextTrainableNode(chapter.root, method, trainingConfig!.getNext!);

//         if (!maybeTrainingContext) {
//           set({ userTip: 'empty', selectedPath: '', selectedNode: null, trainableContext: null });
//         } else {
//           const targetPath = maybeTrainingContext.startingPath;
//           const nodeList = getNodeList(root, targetPath);
//           set({
//             selectedPath: targetPath,
//             selectedNode: nodeList.at(-1),
//             trainableContext: maybeTrainingContext,
//             userTip: method,
//           });
//         }
//       },

//       updateDueCounts: () => {
//         const { repertoire, repertoireIndex, trainingConfig } = get();
//         if (repertoireIndex < 0) return;

//         const activeChapter = repertoire[repertoireIndex];
//         if (!activeChapter) return;

//         const counts = computeDueCounts(activeChapter.root, trainingConfig.buckets);

//         set((state) => {
//           const nextRepertoire = state.repertoire.slice();

//           // shallow clone only the active chapter so React/Zustand notices
//           const nextChapter = { ...nextRepertoire[repertoireIndex] };

//           // update derived metadata
//           nextChapter.lastDueCount = counts[0];

//           nextRepertoire[repertoireIndex] = nextChapter;

//           return {
//             dueTimes: counts,
//             repertoire: nextRepertoire,
//           };
//         });
//       },

//       clearChapterContext: () => {
//         set({
//           trainingMethod: 'unselected',
//           selectedPath: '',
//           userTip: 'empty',
//           cbConfig: { lastMove: undefined, drawable: { shapes: [] } },
//           selectedNode: null,
//         });
//       },

//       setCommentAt: async (comment: string, path: string) => {
//         const authed = useAuthStore.getState().isAuthenticated();
//         const { repertoire, repertoireIndex, editRemote } = get();
//         const chapter = repertoire[repertoireIndex];
//         if (!chapter) return;
//         const node = nodeAtPath(chapter.root, path);
//         if (!node) return;
//         node.data.comment = comment;
//         //TODO abstraction over both persistence mechanisms?
//         //TODO better naming
//         await persistChapterByIndex(get(), get().repertoireIndex);
//         await editRemote(repertoireIndex, () =>
//           apiEditMoves(chapter.id, [{ idx: node.data.idx, patch: { comment } }]),
//         );
//       },

//       fail: async () => {
//         const { repertoire, repertoireIndex, trainableContext, trainingMethod, trainingConfig, editRemote } =
//           get();

//         const node = trainableContext?.targetMove;
//         const chapter = repertoire[repertoireIndex];
//         if (!chapter || !node) return;

//         let groupIndex = node.data.training.group;
//         chapter.bucketEntries[groupIndex]--;

//         if (trainingMethod === 'recall') {
//           switch (trainingConfig!.demotion) {
//             case 'most':
//               groupIndex = 0;
//               break;
//             case 'next':
//               groupIndex = Math.max(groupIndex - 1, 0);
//               break;
//           }

//           chapter.bucketEntries[groupIndex]++;
//           const interval = trainingConfig!.buckets![groupIndex];
//           node.data.training.group = groupIndex;
//           node.data.training.dueAt = currentTime() + interval;

//           // local-first persist
//           await persistChapterByIndex(get(), repertoireIndex);

//           // remote best-effort (optimistic, don’t await)
//           await editRemote(repertoireIndex, () =>
//             apiEditMoves(chapter.id, [
//               {
//                 idx: node.data.idx,
//                 patch: {
//                   training: {
//                     group: node.data.training.group,
//                     dueAt: node.data.training.dueAt,
//                   },
//                 },
//               },
//             ]),
//           );
//         }
//       },

//       guess: (san: string): TrainingOutcome => {
//         console.log('guess', san);
//         const { repertoire, repertoireIndex, selectedPath, trainableContext, trainingMethod } = get();
//         const chapter = repertoire[repertoireIndex];
//         if (!chapter) return;

//         const root = chapter.root;
//         const pathToTrain = trainableContext?.startingPath;
//         if (pathToTrain == null) return;

//         const trainableNodeList: ChildNode<TrainingData>[] = getNodeList(root, pathToTrain);
//         if (repertoireIndex === -1 || !trainableNodeList || trainingMethod === 'learn') return;

//         const possibleMoves = trainableNodeList.at(-1)!.children.map((_) => _.data.san);
//         set({ lastGuess: san });

//         const target = trainableContext.targetMove;
//         return possibleMoves.includes(san) ? (target.data.san === san ? 'success' : 'alternate') : 'failure';
//       },

//       markAllAsSeen: async () => {
//         const nowSec = currentTime();

//         set(
//           produce((state) => {
//             const idx = state.repertoireIndex;
//             if (idx < 0) return;

//             const chapter = state.repertoire[idx];
//             if (!chapter) return;

//             const buckets = state.trainingConfig.buckets;
//             const timeToAdd = buckets?.[0] ?? 0;

//             updateRecursive(chapter.tree, '', (node) => {
//               const t = node.data.training;
//               if (t.disabled) return;
//               if (t.seen) return;

//               chapter.bucketEntries[0] = (chapter.bucketEntries[0] ?? 0) + 1;

//               t.seen = true;
//               t.group = 0;
//               t.dueAt = nowSec + timeToAdd;
//             });

//             state.showSuccessfulGuess = false;
//           }),
//         );

//         await persistChapterByIndex(get(), get().repertoireIndex);
//       },

//       disableLine: async (path: string) => {
//         const { repertoire, repertoireIndex, editRemote } = get();
//         const chapter = repertoire[repertoireIndex];
//         const root = chapter?.root;
//         if (!chapter || !root) return;

//         const edits: MoveEdit[] = [];

//         updateRecursive(root, path, (node) => {
//           if (!node.data.training.disabled) {
//             chapter.enabledCount--;
//             node.data.training.disabled = true;

//             edits.push({
//               idx: node.data.idx,
//               patch: { training: { disabled: true } },
//             });
//           }
//         });

//         // touch so UI updates
//         set((state) => {
//           const next = state.repertoire.slice();
//           next[repertoireIndex] = { ...next[repertoireIndex] };
//           return { repertoire: next };
//         });

//         // local-first persist
//         await persistChapterByIndex(get(), repertoireIndex);

//         // remote best-effort (don’t block UI)
//         if (edits.length > 0) {
//           await editRemote(repertoireIndex, () => apiEditMoves(chapter.id, edits));
//         }
//       },

//       enableLine: async (path: string) => {
//         const { repertoire, repertoireIndex, editRemote } = get();
//         const chapter = repertoire[repertoireIndex];
//         if (!chapter) return;

//         const edits: MoveEdit[] = [];
//         const trainAs = chapter.trainAs;

//         updateRecursive(chapter.root, path, (node) => {
//           const color: Color = colorFromPly(node.data.ply);

//           // your existing logic: only enable moves for the side being trained
//           if (trainAs === color && node.data.training.disabled) {
//             chapter.enabledCount++;
//             node.data.training.disabled = false;

//             edits.push({
//               idx: node.data.idx,
//               patch: { training: { disabled: false } },
//             });
//           }
//         });

//         set((state) => {
//           const next = state.repertoire.slice();
//           next[repertoireIndex] = { ...next[repertoireIndex] };
//           return { repertoire: next };
//         });

//         await persistChapterByIndex(get(), repertoireIndex);

//         if (edits.length > 0) {
//           void editRemote(repertoireIndex, () => apiEditMoves(chapter.id, edits));
//         }
//       },

//       makeMove: async (san: string) => {
//         const { selectedNode, repertoire, repertoireIndex, selectedPath, trainingMethod } = get();
//         const chapter = repertoire[repertoireIndex];
//         if (!chapter || !selectedNode) return;

//         const fen = selectedNode.data.fen;

//         if (!selectedNode.children.map((_) => _.data.san).includes(san)) {
//           const [pos] = positionFromFen(fen);
//           const move = parseSan(pos, san);
//           const currentColor = colorFromPly(selectedNode.data.ply);
//           const trainAs = chapter.trainAs;
//           const disabled = currentColor == trainAs;
//           if (!disabled) chapter.enabledCount++;
//           console.log('CHAPTER MOVEID', chapter.largestMoveId);

//           //TODO do we have to save chapter here..?
//           //TODO factor out makeMove ??
//           const newNode: TrainableNode = {
//             data: {
//               training: {
//                 disabled: disabled,
//                 seen: false,
//                 group: -1,
//                 dueAt: -1,
//               },
//               ply: selectedNode.data.ply + 1,
//               id: scalachessCharPair(move),
//               idx: ++chapter.largestMoveId,
//               san: makeSanAndPlay(pos, move),
//               fen: makeFen(pos.toSetup()),
//               comment: '',
//             },
//             children: [],
//           };

//           console.log('NEW NODE', newNode);

//           selectedNode.children.push(newNode);
//           //TODO abstraction here...
//           //TODO iff logged in ...

//           // flattened fields
//           let ord = selectedNode.children.length - 1;
//           let parentIdx = selectedNode.data.idx;
//           try {
//             // ✅ persist to backend

//             let flatMove: MoveRow;
//             flatMove = {
//               ...newNode.data,
//               parentIdx: parentIdx,
//               ord: ord,
//             };
//             await apiAddMove(chapter.id, flatMove);

//             // If backend is authoritative and might adjust fields, you could merge returned move:
//             // const saved = await apiAddMove(chapter.id, newNode.data);
//             // newNode.data = { ...newNode.data, ...saved };
//           } catch (e) {
//             // // rollback optimistic update if you want strict correctness
//             // selectedNode.children.pop();
//             // if (!newNode.data.training.disabled) chapter.enabledCount--;
//             // chapter.largestMoveId--; // rollback local id allocation

//             throw e; // or toast + return
//           }
//         }

//         //TODO separate "play move" state action?
//         if (trainingMethod == 'edit') {
//           const movingTo = selectedNode.children.find((x) => x.data.san === san)!;
//           const newPath = selectedPath + movingTo.data.id;

//           set({ selectedNode: movingTo, selectedPath: newPath });
//         }
//         // persist only this chapter
//         await persistChapterByIndex(get(), repertoireIndex);
//       },
//       // TODO should network actions be in state?
//       uploadChapter: async (chapter: Chapter) => {
//         // 2) if signed in, push to backend
//         const isAuthed = useAuthStore.getState().isAuthenticated();
//         if (!isAuthed) return;

//         try {
//           const resp = await postChapter(chapter);
//           console.log('RESP', resp);
//           // optionally store resp.revision back into IndexedDB/store
//           // await idb.updateChapterRevision(chapter.id, resp.revision)
//         } catch (e) {
//           // optional: mark as "needsSync" instead of rolling back
//           // set((s) => markChapterNeedsSync(s, chapter.id))
//           console.error(e);
//         }
//       },

//       // addNewChapter: async (chapter: Chapter) => {
//       //   const { repertoire } = get();
//       //   const ids = await readChapterIds();
//       //   if (ids.includes(chapter.id)) return; // don't write duplicates

//       //   let newRepertoire: Chapter[];
//       //   switch (chapter.trainAs) {
//       //     case 'white':
//       //       newRepertoire = [chapter, ...repertoire];
//       //       break;
//       //     case 'black':
//       //       newRepertoire = [...repertoire, chapter];
//       //       break;
//       //   }

//       //   // update memory
//       //   set({ repertoire: newRepertoire });

//       //   // add to indexedDB
//       //   const cid = chapter.id;
//       //   await writeChapter(cid, chapter);
//       //   writeChapterIds([...ids, cid]);
//       // },

//       importIntoChapter: async (targetChapter: number, newPgn: string) => {
//         const isAuthenticated = useAuthStore.getState().isAuthenticated();
//         const { repertoire } = get();
//         const chapter = repertoire[targetChapter];
//         if (!chapter) return;

//         const { root: importRoot } = rootFromPgn(newPgn, chapter.trainAs);
//         merge(chapter.root, importRoot);
//         //TODO can we make this part of merge?

//         let enabledCount = 0;
//         forEachNode(chapter.root, (node) => {
//           if (!node.data.training.disabled) enabledCount++;
//         });
//         chapter.enabledCount = enabledCount;

//         // touch only this chapter so UI updates (no set({ repertoire }) on whole array reference)
//         set((state) => {
//           const next = state.repertoire.slice();
//           next[targetChapter] = { ...next[targetChapter] };
//           return { repertoire: next };
//         });

//         // persist only this chapter
//         await persistChapterByIndex(get(), targetChapter);
//         // isAuthenticated ?
//       },
//     }),

//     {
//       name: 'trainer-store',
//       storage: indexedDBStorage,

//       // ✅ CRITICAL: do NOT persist repertoire anymore (it lives as per-chapter blobs)
//       partialize: (state) => ({
//         repertoireIndex: state.repertoireIndex,
//         trainingConfig: state.trainingConfig,
//         // (optional) store last selection stuff if you want:
//         selectedPath: state.selectedPath,
//       }),

//       // ✅ After small state is rehydrated, load chapters from IDB into memory
//       onRehydrateStorage: () => {
//         return async (state, err) => {
//           if (err || !state) return;
//           await state.hydrateRepertoireFromIDB();
//         };
//       },
//     },
//   ),
// );

// /**
//  * Usage note:
//  * - Your existing components can keep using `repertoire` from Zustand as before.
//  * - The big win: random `set({ selectedPath })` no longer triggers a huge IDB rewrite.
//  * - Chapter mutations now persist only the touched chapter (import/move/comment/etc).
//  */
